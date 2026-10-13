from tests.helpers import signup


def test_register_login_me_and_default_categories(client):
    h = signup(client)
    assert client.get("/auth/me", headers=h).json()["email"] == "a@example.com"
    names = [c["name"] for c in client.get("/categories", headers=h).json()]
    assert "Food" in names and len(names) == 10


def test_duplicate_email_and_bad_login(client):
    signup(client)
    r = client.post("/auth/register", json={"name": "B", "email": "A@example.com", "password": "password123"})
    assert r.status_code == 409
    r = client.post("/auth/login", data={"username": "a@example.com", "password": "wrong"})
    assert r.status_code == 401


def test_requires_auth(client):
    assert client.get("/transactions").status_code == 401


def test_transaction_crud(client):
    h = signup(client)
    food = next(c for c in client.get("/categories", headers=h).json() if c["name"] == "Food")
    r = client.post("/transactions", headers=h, json={
        "amount": "450.50", "type": "expense", "description": "Swiggy order",
        "payment_method": "UPI", "category_id": food["id"], "date": "2026-10-07"})
    assert r.status_code == 201, r.text
    t = r.json()
    assert t["category"]["name"] == "Food" and t["amount"] == "450.50"

    assert len(client.get("/transactions", headers=h).json()) == 1
    assert client.get("/transactions", params={"type": "income"}, headers=h).json() == []

    r = client.put(f"/transactions/{t['id']}", headers=h, json={"description": "Zomato order"})
    assert r.json()["description"] == "Zomato order" and r.json()["category"]["name"] == "Food"

    assert client.delete(f"/transactions/{t['id']}", headers=h).status_code == 204
    assert client.get(f"/transactions/{t['id']}", headers=h).status_code == 404


def test_validation(client):
    h = signup(client)
    bad = {"amount": "-5", "type": "expense", "description": "x"}
    assert client.post("/transactions", headers=h, json=bad).status_code == 422


def test_users_are_isolated(client):
    h1, h2 = signup(client, "one@example.com"), signup(client, "two@example.com")
    t = client.post("/transactions", headers=h1, json={"amount": "10", "type": "expense", "description": "tea"}).json()
    assert client.get(f"/transactions/{t['id']}", headers=h2).status_code == 404
    assert client.delete(f"/transactions/{t['id']}", headers=h2).status_code == 404
    # can't attach another user's category either
    c1 = client.get("/categories", headers=h1).json()[0]["id"]
    r = client.post("/transactions", headers=h2, json={"amount": "10", "type": "expense", "description": "x", "category_id": c1})
    assert r.status_code == 422


def test_deleting_category_keeps_transaction(client):
    h = signup(client)
    cat = client.post("/categories", headers=h, json={"name": "Pets"}).json()
    t = client.post("/transactions", headers=h, json={"amount": "99", "type": "expense", "description": "food", "category_id": cat["id"]}).json()
    assert client.delete(f"/categories/{cat['id']}", headers=h).status_code == 204
    assert client.get(f"/transactions/{t['id']}", headers=h).json()["category"] is None


def test_cors_allows_the_web_dashboard_origin(client):
    r = client.options("/transactions", headers={
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert r.status_code == 200
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    evil = client.options("/transactions", headers={"Origin": "http://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in evil.headers


def test_cors_allows_the_expo_web_dev_server(client):
    r = client.options("/ai/receipt", headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "POST",
                                               "Access-Control-Request-Headers": "authorization"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] == "http://localhost:8081"
