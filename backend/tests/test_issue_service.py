import pytest
from sqlalchemy import select

from app.models import (
    IssueHistory,
    IssuePriority,
    IssueStatus,
    IssueType,
    Label,
    Project,
    ProjectMember,
    ProjectRole,
    User,
)
from app.schemas import IssueCreate
from app.services.exceptions import ValidationError, WorkflowError
from app.services.issue_service import create_issue, update_issue


@pytest.fixture
def test_setup(db_session):
    owner = User(name="Owner User", email="owner@test.com", password_hash="dummy")
    member = User(name="Member User", email="member@test.com", password_hash="dummy")
    non_member = User(name="Non Member", email="nonmember@test.com", password_hash="dummy")
    project = Project(name="Project One", owner=owner)
    db_session.add_all([owner, member, non_member, project])
    db_session.commit()

    # Add owner and member memberships
    m_owner = ProjectMember(project_id=project.id, user_id=owner.id, role=ProjectRole.owner)
    m_member = ProjectMember(project_id=project.id, user_id=member.id, role=ProjectRole.member)

    # Add project labels
    lbl_backend = Label(project_id=project.id, name="backend", color="#112233")
    lbl_bug = Label(project_id=project.id, name="bug", color="#ff0000")

    db_session.add_all([m_owner, m_member, lbl_backend, lbl_bug])
    db_session.commit()

    return {
        "owner": owner,
        "member": member,
        "non_member": non_member,
        "project": project,
        "labels": {"backend": lbl_backend, "bug": lbl_bug},
    }


def test_update_writes_history_per_changed_field(db_session, test_setup):
    # 3. Update writes one history row per changed field with correct old/new values and actor
    owner = test_setup["owner"]
    member = test_setup["member"]
    project = test_setup["project"]
    lbl_bug = test_setup["labels"]["bug"]
    lbl_backend = test_setup["labels"]["backend"]

    issue = create_issue(
        db_session,
        project.id,
        owner,
        IssueCreate(
            title="Initial Title",
            description="Initial Description",
            type=IssueType.bug,
            priority=IssuePriority.low,
            label_ids=[lbl_bug.id],
        ),
    )
    assert issue.number == 1
    assert issue.status == IssueStatus.open

    # Perform multi-field update
    changes = {
        "title": "Updated Title",
        "priority": IssuePriority.critical,
        "status": IssueStatus.in_progress,
        "assignee_id": member.id,
        "label_ids": [lbl_bug.id, lbl_backend.id],
    }

    updated = update_issue(db_session, issue, member, changes)
    assert updated.title == "Updated Title"
    assert updated.priority == IssuePriority.critical
    assert updated.status == IssueStatus.in_progress
    assert updated.assignee_id == member.id
    assert len(updated.labels) == 2

    # Query all history rows for this issue
    history = db_session.scalars(
        select(IssueHistory).where(IssueHistory.issue_id == issue.id).order_by(IssueHistory.id)
    ).all()

    # 1 created + 5 update rows = 6 history records
    history_by_field = {h.field: h for h in history}
    assert "created" in history_by_field
    assert history_by_field["created"].new_value == "Initial Title"

    assert "title" in history_by_field
    assert history_by_field["title"].old_value == "Initial Title"
    assert history_by_field["title"].new_value == "Updated Title"
    assert history_by_field["title"].actor_id == member.id

    assert "priority" in history_by_field
    assert history_by_field["priority"].old_value == "low"
    assert history_by_field["priority"].new_value == "critical"

    assert "status" in history_by_field
    assert history_by_field["status"].old_value == "open"
    assert history_by_field["status"].new_value == "in_progress"

    assert "assignee" in history_by_field
    assert history_by_field["assignee"].old_value == "unassigned"
    assert history_by_field["assignee"].new_value == "Member User"

    assert "labels" in history_by_field
    assert history_by_field["labels"].old_value == "bug"
    assert history_by_field["labels"].new_value == "backend, bug"


def test_unchanged_update_writes_zero_history(db_session, test_setup):
    # 4. An unchanged update writes zero history rows
    owner = test_setup["owner"]
    project = test_setup["project"]

    issue = create_issue(
        db_session,
        project.id,
        owner,
        IssueCreate(
            title="Stable Title",
            description="Stable Description",
            type=IssueType.task,
            priority=IssuePriority.medium,
        ),
    )

    initial_history_count = len(
        db_session.scalars(
            select(IssueHistory).where(IssueHistory.issue_id == issue.id)
        ).all()
    )
    assert initial_history_count == 1  # Only "created" history row

    # Attempt to update with identical values
    updated = update_issue(
        db_session,
        issue,
        owner,
        {
            "title": "Stable Title",
            "description": "Stable Description",
            "type": IssueType.task,
            "priority": IssuePriority.medium,
        },
    )

    after_history_count = len(
        db_session.scalars(
            select(IssueHistory).where(IssueHistory.issue_id == issue.id)
        ).all()
    )
    assert after_history_count == initial_history_count
    assert updated.title == "Stable Title"


def test_failed_transition_writes_no_history_and_leaves_status(db_session, test_setup):
    # 5. A failed transition writes no history and leaves status unchanged
    owner = test_setup["owner"]
    project = test_setup["project"]

    issue = create_issue(
        db_session,
        project.id,
        owner,
        IssueCreate(
            title="Workflow Issue",
            type=IssueType.bug,
            priority=IssuePriority.medium,
        ),
    )
    assert issue.status == IssueStatus.open

    # Try invalid jump: open -> closed
    with pytest.raises(WorkflowError):
        update_issue(
            db_session,
            issue,
            owner,
            {"status": IssueStatus.closed},
        )

    db_session.refresh(issue)
    assert issue.status == IssueStatus.open

    # Ensure no status history row was created
    status_history = db_session.scalars(
        select(IssueHistory).where(
            IssueHistory.issue_id == issue.id,
            IssueHistory.field == "status",
        )
    ).all()
    assert len(status_history) == 0


def test_assigning_non_member_raises_validation_error(db_session, test_setup):
    # 6. Assigning a non-member raises ValidationError
    owner = test_setup["owner"]
    non_member = test_setup["non_member"]
    project = test_setup["project"]

    # In create_issue
    with pytest.raises(ValidationError):
        create_issue(
            db_session,
            project.id,
            owner,
            IssueCreate(
                title="Invalid Assignee Issue",
                type=IssueType.bug,
                assignee_id=non_member.id,
            ),
        )

    # In update_issue
    valid_issue = create_issue(
        db_session,
        project.id,
        owner,
        IssueCreate(
            title="Valid Issue",
            type=IssueType.bug,
        ),
    )
    with pytest.raises(ValidationError):
        update_issue(
            db_session,
            valid_issue,
            owner,
            {"assignee_id": non_member.id},
        )


def test_project_issue_numbering_sequences(db_session, test_setup):
    # 7. Two issues in one project get numbers 1 and 2, and a second project starts at 1
    owner = test_setup["owner"]
    project1 = test_setup["project"]

    # Create second project
    project2 = Project(name="Project Two", owner=owner)
    db_session.add(project2)
    db_session.commit()

    # Issues in Project 1
    p1_issue1 = create_issue(
        db_session,
        project1.id,
        owner,
        IssueCreate(title="P1 - Issue 1", type=IssueType.task),
    )
    p1_issue2 = create_issue(
        db_session,
        project1.id,
        owner,
        IssueCreate(title="P1 - Issue 2", type=IssueType.task),
    )

    # Issue in Project 2
    p2_issue1 = create_issue(
        db_session,
        project2.id,
        owner,
        IssueCreate(title="P2 - Issue 1", type=IssueType.task),
    )

    assert p1_issue1.number == 1
    assert p1_issue2.number == 2
    assert p2_issue1.number == 1
