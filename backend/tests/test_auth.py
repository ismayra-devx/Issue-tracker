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
