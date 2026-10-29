import pytest


@pytest.fixture
def api_setup(client):
    # Setup Owner
    client.post(
        "/auth/register",
        json={"name": "Owner User", "email": "owner@domain.com", "password": "password123"},
    )
    owner_token = client.post(
        "/auth/login",
        json={"email": "owner@domain.com", "password": "password123"},
    ).json()["access_token"]
    owner_headers = {"Authorization": f"Bearer {owner_token}"}

    # Setup Member
    client.post(
        "/auth/register",
        json={"name": "Dev Member", "email": "dev@domain.com", "password": "password123"},
    )
    dev_token = client.post(
        "/auth/login",
        json={"email": "dev@domain.com", "password": "password123"},
    ).json()["access_token"]
    dev_headers = {"Authorization": f"Bearer {dev_token}"}

    # Setup Outsider
    client.post(
        "/auth/register",
        json={"name": "Outsider", "email": "stranger@domain.com", "password": "password123"},
    )
    stranger_token = client.post(
        "/auth/login",
        json={"email": "stranger@domain.com", "password": "password123"},
    ).json()["access_token"]
    stranger_headers = {"Authorization": f"Bearer {stranger_token}"}

    # Create Project 1
    p1 = client.post(
        "/projects",
        json={"name": "Project 1", "description": "Desc 1"},
        headers=owner_headers,
    ).json()

    # Add Dev to Project 1
    client.post(
        f"/projects/{p1['id']}/members",
        json={"email": "dev@domain.com"},
        headers=owner_headers,
    )

    # Create Labels in Project 1
    l_bug = client.post(
        f"/projects/{p1['id']}/labels",
        json={"name": "bug", "color": "#ff0000"},
        headers=owner_headers,
    ).json()

    l_feature = client.post(
        f"/projects/{p1['id']}/labels",
        json={"name": "feature", "color": "#00ff00"},
        headers=owner_headers,
    ).json()

    # Create Project 2
    p2 = client.post(
        "/projects",
        json={"name": "Project 2", "description": "Desc 2"},
        headers=owner_headers,
    ).json()

    return {
        "p1": p1,
        "p2": p2,
        "owner_headers": owner_headers,
        "dev_headers": dev_headers,
        "stranger_headers": stranger_headers,
        "labels": {"bug": l_bug, "feature": l_feature},
        "dev_id": client.get("/auth/me", headers=dev_headers).json()["id"],
    }


def test_non_member_cannot_access_project_issues(client, api_setup):
    # 1. Non-member cannot GET, PATCH or list issues in a project (404)
    p1_id = api_setup["p1"]["id"]
    owner_headers = api_setup["owner_headers"]
    stranger_headers = api_setup["stranger_headers"]

    # Create an issue
    issue = client.post(
        f"/projects/{p1_id}/issues",
        json={"title": "Private Issue", "type": "bug"},
        headers=owner_headers,
    ).json()

    # Non-member lists issues -> 404
    list_res = client.get(f"/projects/{p1_id}/issues", headers=stranger_headers)
    assert list_res.status_code == 404
    assert list_res.json() == {"detail": "Project not found"}

    # Non-member gets issue -> 404
    get_res = client.get(f"/projects/{p1_id}/issues/{issue['number']}", headers=stranger_headers)
    assert get_res.status_code == 404
    assert get_res.json() == {"detail": "Project not found"}

    # Non-member patches issue -> 404
    patch_res = client.patch(
        f"/projects/{p1_id}/issues/{issue['number']}",
        json={"title": "Hacked Title"},
        headers=stranger_headers,
    )
    assert patch_res.status_code == 404
    assert patch_res.json() == {"detail": "Project not found"}


def test_illegal_status_jump_returns_400(client, api_setup):
    # 2. PATCH with an illegal status jump returns 400 and leaves the issue unchanged
    p1_id = api_setup["p1"]["id"]
    owner_headers = api_setup["owner_headers"]

    issue = client.post(
        f"/projects/{p1_id}/issues",
        json={"title": "Workflow Check", "type": "task"},
        headers=owner_headers,
    ).json()
    assert issue["status"] == "open"

    # Try illegal transition: open -> closed
    bad_patch = client.patch(
        f"/projects/{p1_id}/issues/{issue['number']}",
        json={"status": "closed"},
        headers=owner_headers,
    )
    assert bad_patch.status_code == 400
    assert "Cannot move issue from 'open' to 'closed'" in bad_patch.json()["detail"]

    # Verify status unchanged
    refreshed = client.get(
        f"/projects/{p1_id}/issues/{issue['number']}",
        headers=owner_headers,
    ).json()
    assert refreshed["status"] == "open"


def test_issue_filters(client, api_setup):
    # 3. Filters work: status, assignee, label, and q
    p1_id = api_setup["p1"]["id"]
    owner_headers = api_setup["owner_headers"]
    dev_id = api_setup["dev_id"]
    l_bug_id = api_setup["labels"]["bug"]["id"]
    l_feature_id = api_setup["labels"]["feature"]["id"]

    # Issue 1: bug, critical, assignee=dev, label=bug
    i1 = client.post(
        f"/projects/{p1_id}/issues",
        json={
            "title": "Fix login crash",
            "description": "App crashes when entering spaces",
            "type": "bug",
            "priority": "critical",
            "assignee_id": dev_id,
            "label_ids": [l_bug_id],
        },
        headers=owner_headers,
    ).json()

    # Move i1 to in_progress
    client.patch(
        f"/projects/{p1_id}/issues/{i1['number']}",
        json={"status": "in_progress"},
        headers=owner_headers,
    )

    # Issue 2: task, low, no assignee, label=feature
    client.post(
        f"/projects/{p1_id}/issues",
        json={
            "title": "Add dark mode UI",
            "description": "Theme selector in settings",
            "type": "task",
            "priority": "low",
            "label_ids": [l_feature_id],
        },
        headers=owner_headers,
    )

    # Filter by status=in_progress
    res_status = client.get(f"/projects/{p1_id}/issues?status=in_progress", headers=owner_headers).json()
    assert res_status["total"] == 1
    assert res_status["items"][0]["title"] == "Fix login crash"

    # Filter by assignee_id
    res_assignee = client.get(f"/projects/{p1_id}/issues?assignee_id={dev_id}", headers=owner_headers).json()
    assert res_assignee["total"] == 1
    assert res_assignee["items"][0]["title"] == "Fix login crash"

    # Filter by label_id
    res_label = client.get(f"/projects/{p1_id}/issues?label_id={l_feature_id}", headers=owner_headers).json()
    assert res_label["total"] == 1
    assert res_label["items"][0]["title"] == "Add dark mode UI"

    # Filter by text search q (case-insensitive over title/description)
    res_q_title = client.get(f"/projects/{p1_id}/issues?q=LOGIN", headers=owner_headers).json()
    assert res_q_title["total"] == 1
    assert res_q_title["items"][0]["title"] == "Fix login crash"

    res_q_desc = client.get(f"/projects/{p1_id}/issues?q=spaces", headers=owner_headers).json()
    assert res_q_desc["total"] == 1
    assert res_q_desc["items"][0]["title"] == "Fix login crash"


def test_issue_pagination(client, api_setup):
    # 4. Pagination returns the right slice and total
    p1_id = api_setup["p1"]["id"]
    owner_headers = api_setup["owner_headers"]

    for i in range(5):
        client.post(
            f"/projects/{p1_id}/issues",
            json={"title": f"Page Issue {i + 1}", "type": "task"},
            headers=owner_headers,
        )

    # Request page 1 with page_size 2
    p1_res = client.get(f"/projects/{p1_id}/issues?page=1&page_size=2", headers=owner_headers).json()
    assert p1_res["total"] == 5
    assert len(p1_res["items"]) == 2
    assert p1_res["page"] == 1
    assert p1_res["page_size"] == 2

    # Request page 2 with page_size 2
    p2_res = client.get(f"/projects/{p1_id}/issues?page=2&page_size=2", headers=owner_headers).json()
    assert p2_res["total"] == 5
    assert len(p2_res["items"]) == 2
    assert p2_res["page"] == 2

    # Request page 3 with page_size 2
    p3_res = client.get(f"/projects/{p1_id}/issues?page=3&page_size=2", headers=owner_headers).json()
    assert p3_res["total"] == 5
    assert len(p3_res["items"]) == 1
    assert p3_res["page"] == 3


def test_issue_lookup_does_not_leak_across_projects(client, api_setup):
    # 6. Issue number lookup does not leak across projects
    p1_id = api_setup["p1"]["id"]
    p2_id = api_setup["p2"]["id"]
    owner_headers = api_setup["owner_headers"]

    # Create issue #1 in Project 1
    p1_issue = client.post(
        f"/projects/{p1_id}/issues",
        json={"title": "Project 1 Secret Issue", "type": "task"},
        headers=owner_headers,
    ).json()
    assert p1_issue["number"] == 1

    # Project 2 currently has no issue #1
    p2_lookup = client.get(
        f"/projects/{p2_id}/issues/1",
        headers=owner_headers,
    )
    assert p2_lookup.status_code == 404
    assert p2_lookup.json() == {"detail": "Issue not found"}
