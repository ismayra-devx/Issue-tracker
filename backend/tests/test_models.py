import pytest
from sqlalchemy.exc import IntegrityError

from app.models import (
    Issue,
    IssuePriority,
    IssueStatus,
    IssueType,
    Project,
    ProjectMember,
    ProjectRole,
    User,
)


def test_unique_project_member_and_issue_number_constraints(db_session):
    # Setup base owner and project
    owner = User(
        name="Project Owner",
        email="owner@example.com",
        password_hash="secret_hash",
    )
    member_user = User(
        name="Member User",
        email="member@example.com",
        password_hash="secret_hash",
    )
    project = Project(name="Workflow Tracker", owner=owner)
    db_session.add_all([owner, member_user, project])
    db_session.commit()

    # 1. Proves creating two members for the same project/user raises an integrity error
    member1 = ProjectMember(
        project_id=project.id,
        user_id=member_user.id,
        role=ProjectRole.member,
    )
    db_session.add(member1)
    db_session.commit()

    duplicate_member = ProjectMember(
        project_id=project.id,
        user_id=member_user.id,
        role=ProjectRole.member,
    )
    db_session.add(duplicate_member)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()

    # 2. Proves creating two issues with the same (project_id, number) raises an integrity error
    issue1 = Issue(
        project_id=project.id,
        number=1,
        title="First Issue",
        type=IssueType.bug,
        priority=IssuePriority.high,
        status=IssueStatus.open,
        reporter_id=owner.id,
    )
    db_session.add(issue1)
    db_session.commit()

    duplicate_issue = Issue(
        project_id=project.id,
        number=1,
        title="Conflicting Issue Number",
        type=IssueType.task,
        priority=IssuePriority.medium,
        status=IssueStatus.open,
        reporter_id=owner.id,
    )
    db_session.add(duplicate_issue)
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()
