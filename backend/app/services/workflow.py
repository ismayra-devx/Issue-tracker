from app.models import IssueStatus
from app.services.exceptions import WorkflowError

ALLOWED_TRANSITIONS: dict[IssueStatus, set[IssueStatus]] = {
    IssueStatus.open: {IssueStatus.in_progress},
    IssueStatus.in_progress: {IssueStatus.in_review},
    IssueStatus.in_review: {IssueStatus.closed},
    IssueStatus.closed: {IssueStatus.open},
}


def validate_transition(current: IssueStatus, target: IssueStatus) -> None:
    """
    Validates whether an issue status transition is allowed.

    Allowed transitions:
      open -> in_progress
      in_progress -> in_review
      in_review -> closed
      closed -> open (Reopen)

    Raises WorkflowError if target is the same as current or not allowed.
    """
    if current == target:
        raise WorkflowError(
            f"Cannot move issue from '{current.value}' to '{target.value}'. Issue is already '{current.value}'."
        )

    allowed = ALLOWED_TRANSITIONS.get(current, set())
    if target not in allowed:
        allowed_str = ", ".join(sorted(s.value for s in allowed)) if allowed else "none"
        raise WorkflowError(
            f"Cannot move issue from '{current.value}' to '{target.value}'. Allowed: {allowed_str}."
        )
