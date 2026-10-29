def test_project_crud_and_membership_rules(client):
    # 1. Register Owner and Member users
    owner_reg = client.post(
        "/auth/register",
        json={"name": "Project Boss", "email": "boss@example.com", "password": "password123"},
    )
    assert owner_reg.status_code == 201

    member_reg = client.post(
        "/auth/register",
        json={"name": "Team Member", "email": "member@example.com", "password": "password123"},
    )
    assert member_reg.status_code == 201

    outsider_reg = client.post(
        "/auth/register",
        json={"name": "Outsider", "email": "outsider@example.com", "password": "password123"},
    )
    assert outsider_reg.status_code == 201

    boss_token = client.post(
        "/auth/login",
        json={"email": "boss@example.com", "password": "password123"},
    ).json()["access_token"]
    boss_headers = {"Authorization": f"Bearer {boss_token}"}

    member_token = client.post(
        "/auth/login",
        json={"email": "member@example.com", "password": "password123"},
    ).json()["access_token"]
    member_headers = {"Authorization": f"Bearer {member_token}"}

    outsider_token = client.post(
        "/auth/login",
        json={"email": "outsider@example.com", "password": "password123"},
    ).json()["access_token"]
    outsider_headers = {"Authorization": f"Bearer {outsider_token}"}

    # 2. Boss creates Project
    create_res = client.post(
        "/projects",
        json={"name": "Alpha Project", "description": "Primary internal tracker"},
        headers=boss_headers,
    )
    assert create_res.status_code == 201
    project_id = create_res.json()["id"]

    # 3. Boss adds Member
    add_member_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )
    assert add_member_res.status_code == 201
    assert add_member_res.json()["email"] == "member@example.com"
    assert add_member_res.json()["role"] == "member"

    # 4. Adding duplicate member returns 409
    dup_member_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "member@example.com"},
        headers=boss_headers,
    )
    assert dup_member_res.status_code == 409

    # 5. Adding non-existent user returns 404
    no_user_res = client.post(
        f"/projects/{project_id}/members",
        json={"email": "ghost@example.com"},
        headers=boss_headers,
    )
    assert no_user_res.status_code == 404

    # 6. Test 5 requirement: a member (non-owner) cannot add members (403)
    member_add_attempt = client.post(
        f"/projects/{project_id}/members",
        json={"email": "outsider@example.com"},
        headers=member_headers,
    )
    assert member_add_attempt.status_code == 403
    assert member_add_attempt.json() == {"detail": "Project owner privileges required"}

    # 7. Non-member cannot access GET /projects/{id} (404)
    outsider_access = client.get(
        f"/projects/{project_id}",
        headers=outsider_headers,
    )
    assert outsider_access.status_code == 404
    assert outsider_access.json() == {"detail": "Project not found"}

    # 8. List my projects returns only projects the caller belongs to
    boss_projects = client.get("/projects", headers=boss_headers).json()
    assert len(boss_projects) == 1
    assert boss_projects[0]["id"] == project_id

    member_projects = client.get("/projects", headers=member_headers).json()
    assert len(member_projects) == 1
    assert member_projects[0]["id"] == project_id

    outsider_projects = client.get("/projects", headers=outsider_headers).json()
    assert len(outsider_projects) == 0

    # 9. Labels: Owner creates label, member reads it
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
