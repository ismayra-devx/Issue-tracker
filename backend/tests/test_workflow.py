import pytest

from app.models import IssueStatus
from app.services.exceptions import WorkflowError
from app.services.workflow import ALLOWED_TRANSITIONS, validate_transition

ALL_STATUSES = list(IssueStatus)

ALLOWED_PAIRS = [
    (IssueStatus.open, IssueStatus.in_progress),
    (IssueStatus.in_progress, IssueStatus.in_review),
    (IssueStatus.in_review, IssueStatus.closed),
    (IssueStatus.closed, IssueStatus.open),
]

DISALLOWED_PAIRS = [
    (c, t)
    for c in ALL_STATUSES
    for t in ALL_STATUSES
    if t not in ALLOWED_TRANSITIONS.get(c, set())
]


@pytest.mark.parametrize("current,target", ALLOWED_PAIRS)
def test_every_allowed_transition_succeeds(current, target):
    # 1. Every allowed transition succeeds
    validate_transition(current, target)


@pytest.mark.parametrize("current,target", DISALLOWED_PAIRS)
def test_every_disallowed_transition_raises_workflow_error(current, target):
    # 2. Every disallowed transition raises WorkflowError
    with pytest.raises(WorkflowError) as exc_info:
        validate_transition(current, target)
    assert f"Cannot move issue from '{current.value}' to '{target.value}'" in str(exc_info.value)
