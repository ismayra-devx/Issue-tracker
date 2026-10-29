import pytest
from pydantic import ValidationError

from app.models import IssueType
from app.schemas import IssueCreate, IssueUpdate, LabelCreate, RegisterIn


def test_issue_create_rejects_empty_or_whitespace_title():
    # Test 1: IssueCreate rejects an empty or whitespace-only title
    with pytest.raises(ValidationError):
        IssueCreate(title="", type=IssueType.bug)

    with pytest.raises(ValidationError):
        IssueCreate(title="   ", type=IssueType.bug)


def test_issue_create_rejects_unknown_field():
    # Test 2: IssueCreate rejects an unknown field like "reporter_id"
    with pytest.raises(ValidationError):
        IssueCreate(
            title="Valid Issue",
            type=IssueType.bug,
            reporter_id=1,  # Not allowed in IssueCreate
        )


def test_issue_update_distinguishes_sent_null_from_omitted():
    # Test 3: IssueUpdate distinguishes assignee_id=None (sent) from assignee_id missing (not sent)
    update_sent_null = IssueUpdate(assignee_id=None)
    assert "assignee_id" in update_sent_null.model_fields_set
    assert update_sent_null.changes() == {"assignee_id": None}

    update_omitted = IssueUpdate(title="Updated Title")
    assert "assignee_id" not in update_omitted.model_fields_set
    assert "title" in update_omitted.model_fields_set
    assert update_omitted.changes() == {"title": "Updated Title"}


def test_issue_update_rejects_empty_body():
    # Test 4: IssueUpdate with an empty body is rejected
    with pytest.raises(ValidationError):
        IssueUpdate()

    with pytest.raises(ValidationError):
        IssueUpdate.model_validate({})


def test_register_in_lowercases_email_and_rejects_short_password():
    # Test 5: RegisterIn lowercases the email and rejects a 7-char password
    valid = RegisterIn(
        name="Alice User",
        email="Alice.User@Example.COM",
        password="securepassword123",
    )
    assert valid.email == "alice.user@example.com"

    with pytest.raises(ValidationError):
        RegisterIn(
            name="Alice User",
            email="alice@example.com",
            password="1234567",  # 7 characters (min 8 required)
        )


def test_label_create_rejects_invalid_color():
    # Test 6: LabelCreate rejects an invalid color like "red"
    with pytest.raises(ValidationError):
        LabelCreate(name="Bug", color="red")

    valid = LabelCreate(name="Bug", color="#ff0000")
    assert valid.color == "#ff0000"

    default_color = LabelCreate(name="Bug")
    assert default_color.color == "#888888"
