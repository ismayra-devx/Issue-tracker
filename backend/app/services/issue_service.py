from typing import Any, Union

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    Issue,
    IssueHistory,
    IssuePriority,
    IssueStatus,
    IssueType,
    Label,
    Project,
    ProjectMember,
    User,
)
from app.schemas import IssueCreate
from app.services.exceptions import NotFoundError, ValidationError
from app.services.workflow import validate_transition


def _compute_next_issue_number(db: Session, project_id: int) -> int:
    max_num = db.scalar(
        select(func.max(Issue.number)).where(Issue.project_id == project_id)
    )
    return (max_num or 0) + 1


def create_issue(
    db: Session,
    project_id: int,
    actor: User,
    data: Union[IssueCreate, dict[str, Any]],
) -> Issue:
    """
    Creates an issue within a project, assigning the next sequential issue number.
    Validates assignee membership and label ownership within the project.
    Always starts in 'open' status and records a 'created' history entry.
    """
    if isinstance(data, dict):
        title = data["title"]
        description = data.get("description")
        issue_type = data["type"]
        priority = data.get("priority", IssuePriority.medium)
        assignee_id = data.get("assignee_id")
        label_ids = data.get("label_ids", [])
    else:
        title = data.title
        description = data.description
        issue_type = data.type
        priority = data.priority
        assignee_id = data.assignee_id
        label_ids = data.label_ids or []

    if isinstance(issue_type, str):
        issue_type = IssueType(issue_type)
    if isinstance(priority, str):
        priority = IssuePriority(priority)

    # 1. Verify project exists
    project = db.get(Project, project_id)
    if project is None:
        raise NotFoundError(f"Project {project_id} not found")

    # 2. Validate assignee is a project member
    if assignee_id is not None:
        assignee_member = db.scalar(
            select(ProjectMember).where(
                ProjectMember.project_id == project_id,
                ProjectMember.user_id == assignee_id,
            )
        )
        if assignee_member is None:
            raise ValidationError(
                f"User {assignee_id} is not a member of project {project_id}"
            )

    # 3. Validate labels belong to the same project
    labels = []
    if label_ids:
        labels = list(
            db.scalars(
                select(Label).where(
                    Label.project_id == project_id,
                    Label.id.in_(label_ids),
                )
            ).all()
        )
        if len(labels) != len(set(label_ids)):
            raise ValidationError(
                "One or more labels do not belong to this project or do not exist"
            )

    # 4. Attempt assignment with retry on sequence race conditions
    for attempt in range(2):
        try:
            next_num = _compute_next_issue_number(db, project_id)
            issue = Issue(
                project_id=project_id,
                number=next_num,
                title=title,
                description=description,
                type=issue_type,
                priority=priority,
                status=IssueStatus.open,
                assignee_id=assignee_id,
                reporter_id=actor.id,
                labels=labels,
            )
            db.add(issue)
            db.flush()

            history = IssueHistory(
                issue_id=issue.id,
                actor_id=actor.id,
                field="created",
                old_value=None,
                new_value=title,
            )
            db.add(history)
            db.commit()
            db.refresh(issue)
            return issue
        except IntegrityError:
            db.rollback()
            if attempt == 1:
                raise
        except Exception:
            db.rollback()
            raise


def update_issue(
    db: Session,
    issue: Issue,
    actor: User,
    changes: dict[str, Any],
) -> Issue:
    """
    The canonical modifier for an issue.
    Compares incoming fields with current values, validates workflow transitions,
    checks project membership for assignees, applies changes, and records
    IssueHistory rows in a single atomic transaction.
    """
    if not changes:
        return issue

    history_entries: list[IssueHistory] = []

    try:
        # Title
        if "title" in changes:
            new_title = changes["title"]
            if new_title != issue.title:
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="title",
                        old_value=issue.title,
                        new_value=new_title,
                    )
                )
                issue.title = new_title

        # Description
        if "description" in changes:
            new_desc = changes["description"]
            if new_desc != issue.description:
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="description",
                        old_value=issue.description,
                        new_value=new_desc,
                    )
                )
                issue.description = new_desc

        # Type
        if "type" in changes:
            new_type = changes["type"]
            if isinstance(new_type, str):
                new_type = IssueType(new_type)
            if new_type != issue.type:
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="type",
                        old_value=issue.type.value,
                        new_value=new_type.value,
                    )
                )
                issue.type = new_type

        # Priority
        if "priority" in changes:
            new_priority = changes["priority"]
            if isinstance(new_priority, str):
                new_priority = IssuePriority(new_priority)
            if new_priority != issue.priority:
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="priority",
                        old_value=issue.priority.value,
                        new_value=new_priority.value,
                    )
                )
                issue.priority = new_priority

        # Status (must validate workflow transition first)
        if "status" in changes:
            new_status = changes["status"]
            if isinstance(new_status, str):
                new_status = IssueStatus(new_status)
            if new_status != issue.status:
                validate_transition(issue.status, new_status)
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="status",
                        old_value=issue.status.value,
                        new_value=new_status.value,
                    )
                )
                issue.status = new_status

        # Assignee
        if "assignee_id" in changes:
            new_assignee_id = changes["assignee_id"]
            if new_assignee_id != issue.assignee_id:
                if new_assignee_id is not None:
                    member = db.scalar(
                        select(ProjectMember).where(
                            ProjectMember.project_id == issue.project_id,
                            ProjectMember.user_id == new_assignee_id,
                        )
                    )
                    if member is None:
                        raise ValidationError(
                            f"User {new_assignee_id} is not a member of project {issue.project_id}"
                        )
                    new_user = db.get(User, new_assignee_id)
                    new_name = new_user.name if new_user else "unassigned"
                else:
                    new_name = "unassigned"

                old_name = issue.assignee.name if issue.assignee else "unassigned"
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="assignee",
                        old_value=old_name,
                        new_value=new_name,
                    )
                )
                issue.assignee_id = new_assignee_id

        # Labels
        if "label_ids" in changes:
            new_label_ids = changes["label_ids"]
            new_labels = []
            if new_label_ids:
                new_labels = list(
                    db.scalars(
                        select(Label).where(
                            Label.project_id == issue.project_id,
                            Label.id.in_(new_label_ids),
                        )
                    ).all()
                )
                if len(new_labels) != len(set(new_label_ids)):
                    raise ValidationError(
                        "One or more labels do not belong to this project or do not exist"
                    )

            current_ids = {lbl.id for lbl in issue.labels}
            incoming_ids = set(new_label_ids or [])
            if current_ids != incoming_ids:
                old_labels_str = ", ".join(sorted(lbl.name for lbl in issue.labels))
                new_labels_str = ", ".join(sorted(lbl.name for lbl in new_labels))
                history_entries.append(
                    IssueHistory(
                        issue_id=issue.id,
                        actor_id=actor.id,
                        field="labels",
                        old_value=old_labels_str,
                        new_value=new_labels_str,
                    )
                )
                issue.labels = new_labels

        # Only persist when actual changes occurred
        if history_entries:
            db.add_all(history_entries)
            db.commit()
            db.refresh(issue)

        return issue
    except Exception:
        db.rollback()
        raise
