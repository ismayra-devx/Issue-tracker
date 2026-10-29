from fastapi import Depends

from app.auth import create_access_token, get_project_member, require_project_owner
from app.main import app
from app.models import Project, ProjectMember, ProjectRole, User

# Tiny test-only routes to verify authorization dependencies
@app.get("/test/projects/{project_id}/member-only")
def member_only_endpoint(member: ProjectMember = Depends(get_project_member)):
    return {"project_id": member.project_id, "role": member.role.value}


@app.get("/test/projects/{project_id}/owner-only")
def owner_only_endpoint(member: ProjectMember = Depends(require_project_owner)):
    return {"project_id": member.project_id, "role": member.role.value}


def test_register_then_login_returns_token(client):
    # 1. Register then login returns a token
    reg_res = client.post(
        "/auth/register",
        json={
            "name": "Alice Developer",
            "email": "alice@example.com",
            "password": "securepassword123",
        },
    )
    assert reg_res.status_code == 201
    user_data = reg_res.json()
    assert user_data["name"] == "Alice Developer"
    assert user_data["email"] == "alice@example.com"
    assert "password_hash" not in user_data
    assert "id" in user_data

    login_res = client.post(
        "/auth/login",
        json={
            "email": "alice@example.com",
            "password": "securepassword123",
        },
    )
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert token_data["token_type"].lower() == "bearer"


def test_duplicate_email_returns_409(client):
    # 2. Duplicate email returns 409
    client.post(
        "/auth/register",
        json={
            "name": "First User",
            "email": "duplicate@example.com",
            "password": "password123",
        },
    )

    dup_res = client.post(
        "/auth/register",
        json={
            "name": "Second User",
            "email": "DUPLICATE@example.com",  # verify case insensitivity
            "password": "password456",
        },
    )
    assert dup_res.status_code == 409
    assert dup_res.json() == {"detail": "Email already registered"}


def test_wrong_password_returns_401(client):
    # 3. Wrong password returns 401
    client.post(
        "/auth/register",
        json={
            "name": "Bob User",
            "email": "bob@example.com",
            "password": "correctpassword",
        },
    )

    # Wrong password
    wrong_pw_res = client.post(
        "/auth/login",
        json={
            "email": "bob@example.com",
            "password": "wrongpassword",
        },
    )
    assert wrong_pw_res.status_code == 401
    assert wrong_pw_res.json() == {"detail": "Invalid email or password"}

    # Non-existent email should return same generic 401 message
    unknown_email_res = client.post(
        "/auth/login",
        json={
            "email": "nonexistent@example.com",
            "password": "correctpassword",
        },
    )
    assert unknown_email_res.status_code == 401
    assert unknown_email_res.json() == {"detail": "Invalid email or password"}


def test_auth_me_requires_token(client):
    # 4. /auth/me without a token returns 401
    unauth_res = client.get("/auth/me")
    assert unauth_res.status_code == 401
    assert "detail" in unauth_res.json()

    # Valid token works
    client.post(
        "/auth/register",
        json={
            "name": "Charlie",
            "email": "charlie@example.com",
            "password": "mypassword123",
        },
    )
    login_res = client.post(
        "/auth/login",
        json={
            "email": "charlie@example.com",
            "password": "mypassword123",
        },
    )
    token = login_res.json()["access_token"]

    auth_res = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert auth_res.status_code == 200
    me_data = auth_res.json()
    assert me_data["email"] == "charlie@example.com"
    assert me_data["name"] == "Charlie"
    assert "password_hash" not in me_data


def test_project_member_and_owner_dependencies(client, db_session):
    # 5. A non-member calling a route protected by get_project_member gets 404
    owner = User(
        name="Owner User",
        email="owner@example.com",
        password_hash="dummy_hash",
    )
    non_member = User(
        name="Non Member",
        email="nonmember@example.com",
        password_hash="dummy_hash",
    )
    regular_member = User(
        name="Regular Member",
        email="regular@example.com",
        password_hash="dummy_hash",
    )
    project = Project(name="Private Project", owner=owner)
    db_session.add_all([owner, non_member, regular_member, project])
    db_session.commit()

    owner_membership = ProjectMember(
        project_id=project.id,
        user_id=owner.id,
        role=ProjectRole.owner,
    )
    regular_membership = ProjectMember(
        project_id=project.id,
        user_id=regular_member.id,
        role=ProjectRole.member,
    )
    db_session.add_all([owner_membership, regular_membership])
    db_session.commit()

    owner_token = create_access_token(owner.id)
    non_member_token = create_access_token(non_member.id)
    regular_token = create_access_token(regular_member.id)

    # Calling with non_member token returns 404
    non_member_res = client.get(
        f"/test/projects/{project.id}/member-only",
        headers={"Authorization": f"Bearer {non_member_token}"},
    )
    assert non_member_res.status_code == 404
    assert non_member_res.json() == {"detail": "Project not found"}

    # Calling with non-existent project_id also returns 404 (does not reveal project existence)
    non_existent_res = client.get(
        "/test/projects/999999/member-only",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert non_existent_res.status_code == 404
    assert non_existent_res.json() == {"detail": "Project not found"}

    # Calling with member token returns 200
    member_res = client.get(
        f"/test/projects/{project.id}/member-only",
        headers={"Authorization": f"Bearer {regular_token}"},
    )
    assert member_res.status_code == 200
    assert member_res.json() == {"project_id": project.id, "role": "member"}

    # Regular member calling require_project_owner gets 403
    forbidden_res = client.get(
        f"/test/projects/{project.id}/owner-only",
        headers={"Authorization": f"Bearer {regular_token}"},
    )
    assert forbidden_res.status_code == 403
    assert forbidden_res.json() == {"detail": "Project owner privileges required"}

    # Project owner calling require_project_owner gets 200
    owner_res = client.get(
        f"/test/projects/{project.id}/owner-only",
        headers={"Authorization": f"Bearer {owner_token}"},
    )
    assert owner_res.status_code == 200
    assert owner_res.json() == {"project_id": project.id, "role": "owner"}


def test_bcrypt_rounds_configuration_and_verification():
    # Prove that the default setting definition on Settings model is 12
    from app.config import Settings
    assert Settings.model_fields["BCRYPT_ROUNDS"].default == 12

    # Prove that test environment configured low cost (4)
    from app.config import settings
    assert settings.BCRYPT_ROUNDS == 4

    # Prove hash_password still verifies correctly with low cost
    from app.auth import hash_password, verify_password
    raw_password = "SecurePassword123!"
    hashed = hash_password(raw_password)
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword123!", hashed) is False
