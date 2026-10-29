import pytest


@pytest.fixture
def project_setup(client):
    # Register Owner, Member, Outsider
    client.post(
        "/auth/register",
        json={"name": "Project Boss", "email": "boss@example.com", "password": "password123"},
    )
    client.post(
        "/auth/register",
        json={"name": "Team Member", "email": "member@example.com", "password": "password123"},
    )
    client.post(
        "/auth/register",
        json={"name": "Outsider", "email": "outsider@example.com", "password": "password123"},
    )

    boss_token = client.post(
        "/auth/login",
        json={"email": "boss@example.com", "password": "password123"},
    ).json()["access_token"]
    member_token = client.post(
        "/auth/login",
        json={"email": "member@example.com", "password": "password123"},
    ).json()["access_token"]
    outsider_token = client.post(
        "/auth/login",
        json={"email": "outsider@example.com", "password": "password123"},
    ).json()["access_token"]

    boss_headers = {"Authorization": f"Bearer {boss_token}"}
    member_headers = {"Authorization": f"Bearer {member_token}"}
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    create_res = client.post(
        "/projects",
        json={"name": "Alpha Project", "description": "Primary internal tracker"},
        headers=boss_headers,
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    return {
        "project_id": project_id,
        "boss_headers": boss_headers,
        "member_headers": member_headers,
        "outsider_headers": outsider_headers,
    }


def test_create_project_adds_owner_member(client):
    client.post(
        "/auth/register",
        json={"name": "Creator", "email": "creator@example.com", "password": "password123"},
    )
    token = client.post(
        "/auth/login",
        json={"email": "creator@example.com", "password": "password123"},
    ).json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    create_res = client.post(
        "/projects",
        json={"name": "Creator Project", "description": "Owner check"},
        headers=headers,
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    # Verify project exists and caller is owner
    members_res = client.get(f"/projects/{project_id}/members", headers=headers)
    assert members_res.status_code == 200
    members = members_res.json()
    assert len(members) == 1
    assert members[0]["email"] == "creator@example.com"
    assert members[0]["role"] == "owner"


def test_list_shows_only_my_projects(client, project_setup):
    project_id = project_setup["project_id"]
    boss_headers = project_setup["boss_headers"]
    member_headers = project_setup["member_headers"]
    outsider_headers = project_setup["outsider_headers"]

    # Add member to project
    client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )

    boss_projects = client.get("/projects", headers=boss_headers).json()
    assert len(boss_projects) == 1
    assert boss_projects[0]["id"] == project_id

    member_projects = client.get("/projects", headers=member_headers).json()
    assert len(member_projects) == 1
    assert member_projects[0]["id"] == project_id

    outsider_projects = client.get("/projects", headers=outsider_headers).json()
    assert len(outsider_projects) == 0


def test_non_member_gets_404(client, project_setup):
    project_id = project_setup["project_id"]
    outsider_headers = project_setup["outsider_headers"]

    outsider_access = client.get(
        f"/projects/{project_id}",
        headers=outsider_headers,
    )
    assert outsider_access.status_code == 404
    assert outsider_access.json() == {"detail": "Project not found"}


def test_non_owner_cannot_add_members(client, project_setup):
    project_id = project_setup["project_id"]
    boss_headers = project_setup["boss_headers"]
    member_headers = project_setup["member_headers"]

    # Add member
    client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )

    # Member (non-owner) cannot add members (403)
    member_add_attempt = client.post(
        f"/projects/{project_id}/members",
        json={"email": "outsider@example.com"},
        headers=member_headers,
    )
    assert member_add_attempt.status_code == 403
    assert member_add_attempt.json() == {"detail": "Project owner privileges required"}


def test_duplicate_member_returns_409(client, project_setup):
    project_id = project_setup["project_id"]
    boss_headers = project_setup["boss_headers"]

    # Add member
    add_member_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )
    assert add_member_res.status_code == 201
    assert add_member_res.json()["email"] == "member@example.com"
    assert add_member_res.json()["role"] == "member"

    # Adding duplicate member returns 409
    dup_member_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )
    assert dup_member_res.status_code == 409


def test_unknown_email_returns_404(client, project_setup):
    project_id = project_setup["project_id"]
    boss_headers = project_setup["boss_headers"]

    # Adding non-existent user returns 404
    no_user_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "ghost@example.com"},
        headers=boss_headers,
    )
    assert no_user_res.status_code == 404


def test_label_create_and_duplicate_label_returns_409(client, project_setup):
    project_id = project_setup["project_id"]
    boss_headers = project_setup["boss_headers"]
    member_headers = project_setup["member_headers"]

    # Add member so they can read labels
    client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )

    # Owner creates label, member reads it
    label_res = client.post(
        f"/projects/{project_id}/labels",
        json={"name": "frontend", "color": "#112233"},
        headers=boss_headers,
    )
    assert label_res.status_code == 201

    labels_list = client.get(f"/projects/{project_id}/labels", headers=member_headers)
    assert labels_list.status_code == 200
    assert len(labels_list.json()) == 1
    assert labels_list.json()[0]["name"] == "frontend"

    # Creating duplicate label returns 409
    dup_label_res = client.post(
        f"/projects/{project_id}/labels",
        json={"name": "frontend", "color": "#445566"},
        headers=boss_headers,
    )
    assert dup_label_res.status_code == 409
