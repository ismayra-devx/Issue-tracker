import pytest


@pytest.fixture
def comments_history_setup(client):
    # Register Owner
    client.post(
        "/auth/register",
        json={"name": "Owner User", "email": "owner@example.com", "password": "password123"},
    )
    owner_token = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "password123"},
    ).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # Register Member
    client.post(
        "/auth/register",
        json={"name": "Member User", "email": "member@example.com", "password": "password123"},
    )
    member_token = client.post(
        "/auth/login",
        json={"email": "member@example.com", "password": "password123"},
    ).json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    # Register Outsider (Non-Member)
    client.post(
        "/auth/register",
        json={"name": "Outsider", "email": "outsider@example.com", "password": "password123"},
    )
    outsider_token = client.post(
        "/auth/login",
        json={"email": "outsider@example.com", "password": "password123"},
    ).json()["access_token"]
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # Create Project
    project = client.post(
        "/projects",
        json={"name": "Comments Project", "description": "Discussion testing"},
        headers=owner_headers,
    ).json()

    # Add Member to Project
    client.post(
        f"/projects/{project['id']}/members",
        json={"email": "member@example.com"},
        headers=owner_headers,
    )

    # Create an Issue in Project
    issue = client.post(
        f"/projects/{project['id']}/issues",
        json={"title": "Issue for Comments", "type": "task"},
        headers=owner_headers,
    ).json()

    return {
        "project": project,
        "issue": issue,
        "owner_headers": owner_headers,
        "member_headers": member_headers,
        "outsider_headers": outsider_headers,
        "member_id": client.get("/auth/me", headers=member_headers).json()["id"],
    }


def test_non_member_cannot_read_or_post_comments(client, comments_history_setup):
    # 1. A non-member cannot read or post comments (404)
    pid = comments_history_setup["project"]["id"]
    inum = comments_history_setup["issue"]["number"]
    outsider_headers = comments_history_setup["outsider_headers"]

    post_res = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": "Unauthorized comment"},
        headers=outsider_headers,
    )
    assert post_res.status_code == 404
    assert post_res.json() == {"detail": "Project not found"}

    get_res = client.get(
        f"/projects/{pid}/issues/{inum}/comments",
        headers=outsider_headers,
    )
    assert get_res.status_code == 404
    assert get_res.json() == {"detail": "Project not found"}


def test_comment_and_history_ordering(client, comments_history_setup):
    # 2. Comment order is oldest first, issue history newest first
    pid = comments_history_setup["project"]["id"]
    inum = comments_history_setup["issue"]["number"]
    owner_headers = comments_history_setup["owner_headers"]
    member_headers = comments_history_setup["member_headers"]

    # Post comments in sequence
    c1 = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": "First comment (oldest)"},
        headers=owner_headers,
    ).json()

    c2 = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": "Second comment"},
        headers=member_headers,
    ).json()

    c3 = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": "Third comment (newest)"},
        headers=owner_headers,
    ).json()

    comments_res = client.get(
        f"/projects/{pid}/issues/{inum}/comments",
        headers=owner_headers,
    )
    assert comments_res.status_code == 200
    comments = comments_res.json()
    assert len(comments) == 3
    # Oldest first
    assert comments[0]["id"] == c1["id"]
    assert comments[0]["body"] == "First comment (oldest)"
    assert comments[0]["author"]["name"] == "Owner User"
    assert comments[1]["id"] == c2["id"]
    assert comments[1]["body"] == "Second comment"
    assert comments[1]["author"]["name"] == "Member User"
    assert comments[2]["id"] == c3["id"]
    assert comments[2]["body"] == "Third comment (newest)"

    # Make updates to generate multiple history entries
    client.patch(
        f"/projects/{pid}/issues/{inum}",
        json={"title": "Updated Title Once"},
        headers=owner_headers,
    )
    client.patch(
        f"/projects/{pid}/issues/{inum}",
        json={"priority": "high"},
        headers=owner_headers,
    )

    history_res = client.get(
        f"/projects/{pid}/issues/{inum}/history",
        headers=owner_headers,
    )
    assert history_res.status_code == 200
    history = history_res.json()
    # Newest first: priority, title, created
    assert len(history) == 3
    assert history[0]["field"] == "priority"
    assert history[0]["new_value"] == "high"
    assert history[1]["field"] == "title"
    assert history[1]["new_value"] == "Updated Title Once"
    assert history[2]["field"] == "created"


def test_empty_or_whitespace_comment_rejected(client, comments_history_setup):
    # 3. An empty or whitespace-only comment returns 422
    pid = comments_history_setup["project"]["id"]
    inum = comments_history_setup["issue"]["number"]
    owner_headers = comments_history_setup["owner_headers"]

    empty_res = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": ""},
        headers=owner_headers,
    )
    assert empty_res.status_code == 422

    whitespace_res = client.post(
        f"/projects/{pid}/issues/{inum}/comments",
        json={"body": "     "},
        headers=owner_headers,
    )
    assert whitespace_res.status_code == 422


def test_patch_three_fields_history_entries(client, comments_history_setup):
    # 4. After PATCHing three fields, the history endpoint shows three entries with correct old/new values
    pid = comments_history_setup["project"]["id"]
    inum = comments_history_setup["issue"]["number"]
    owner_headers = comments_history_setup["owner_headers"]
    member_id = comments_history_setup["member_id"]

    # Current: title="Issue for Comments", priority="medium", assignee=None, status="open"
    patch_res = client.patch(
        f"/projects/{pid}/issues/{inum}",
        json={
            "title": "Renamed Issue",
            "priority": "critical",
            "status": "in_progress",
        },
        headers=owner_headers,
    )
    assert patch_res.status_code == 200

    history_res = client.get(
        f"/projects/{pid}/issues/{inum}/history",
        headers=owner_headers,
    )
    assert history_res.status_code == 200
    history = history_res.json()

    # Total 4 entries: 3 from patch + 1 from created
    assert len(history) == 4

    history_by_field = {h["field"]: h for h in history}
    assert history_by_field["title"]["old_value"] == "Issue for Comments"
    assert history_by_field["title"]["new_value"] == "Renamed Issue"

    assert history_by_field["priority"]["old_value"] == "medium"
    assert history_by_field["priority"]["new_value"] == "critical"

    assert history_by_field["status"]["old_value"] == "open"
    assert history_by_field["status"]["new_value"] == "in_progress"

    # All three entries attribute the owner actor
    assert history_by_field["title"]["actor"]["name"] == "Owner User"


def test_no_write_routes_under_history(client, comments_history_setup):
    # 5. There is no POST/PUT/DELETE route under /history (assert 405 or 404)
    pid = comments_history_setup["project"]["id"]
    inum = comments_history_setup["issue"]["number"]
    owner_headers = comments_history_setup["owner_headers"]

    post_res = client.post(
        f"/projects/{pid}/issues/{inum}/history",
        json={"field": "fake", "new_value": "hack"},
        headers=owner_headers,
    )
    assert post_res.status_code in (404, 405)

    put_res = client.put(
        f"/projects/{pid}/issues/{inum}/history",
        json={"field": "fake", "new_value": "hack"},
        headers=owner_headers,
    )
    assert put_res.status_code in (404, 405)

    delete_res = client.delete(
        f"/projects/{pid}/issues/{inum}/history",
        headers=owner_headers,
    )
    assert delete_res.status_code in (404, 405)
