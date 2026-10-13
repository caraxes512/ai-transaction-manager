def signup(client, email="a@example.com"):
    r = client.post("/auth/register", json={"name": "A", "email": email, "password": "password123"})
    assert r.status_code == 201, r.text
    r = client.post("/auth/login", data={"username": email, "password": "password123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def cat_id(client, headers, name):
    return next(c["id"] for c in client.get("/categories", headers=headers).json() if c["name"] == name)


def add(client, headers, amount, description, type="expense", date=None, category_id=None):
    body = {"amount": str(amount), "type": type, "description": description}
    if date:
        body["date"] = date
    if category_id:
        body["category_id"] = category_id
    r = client.post("/transactions", headers=headers, json=body)
    assert r.status_code == 201, r.text
    return r.json()
