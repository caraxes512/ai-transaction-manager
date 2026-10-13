from datetime import date, timedelta

from tests.helpers import add, cat_id, signup

TODAY = date.today()


def ago(n):
    return (TODAY - timedelta(days=n)).isoformat()


def seed_food_history(client, h, food):
    # Typical Food spend ~₹345 (median), spread over the previous ~2 months.
    for i, amt in enumerate([300, 320, 350, 380, 400, 330, 360, 340]):
        add(client, h, amt, f"meal {i}", date=ago(40 + i * 3), category_id=food)


def anomalies(client, h, days=30):
    r = client.get("/ai/anomalies", params={"days": days}, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


def test_amount_outlier_flagged_with_reason(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    seed_food_history(client, h, food)
    big = add(client, h, 5000, "Fancy dinner", date=ago(1), category_id=food)
    found = anomalies(client, h)
    assert len(found) == 1
    a = found[0]
    assert a["transaction_id"] == big["id"] and a["kind"] == "amount_outlier" and a["severity"] == "high"
    assert "typical Food expense" in a["reason"] and "₹5,000" in a["reason"]


def test_normal_and_small_amounts_not_flagged(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    seed_food_history(client, h, food)
    add(client, h, 360, "usual meal", date=ago(2), category_id=food)
    add(client, h, 500, "slightly pricey", date=ago(1), category_id=food)  # ratio < 1.5
    assert anomalies(client, h) == []


def test_needs_enough_history(client):
    h = signup(client)
    travel = cat_id(client, h, "Travel")
    for i in range(3):
        add(client, h, 400, f"trip {i}", date=ago(50 + i), category_id=travel)
    add(client, h, 9000, "big trip", date=ago(1), category_id=travel)
    assert anomalies(client, h) == []  # only 3 earlier data points: not enough to judge


def test_regular_bills_use_tolerance_when_mad_is_zero(client):
    h = signup(client)
    bills = cat_id(client, h, "Bills")
    for k in range(5):
        add(client, h, 15000, f"rent {k}", date=ago(35 + 30 * k), category_id=bills)
    add(client, h, 15300, "rent now", date=ago(2), category_id=bills)
    assert anomalies(client, h) == []
    add(client, h, 25000, "rent hike?", date=ago(1), category_id=bills)
    found = anomalies(client, h)
    assert [a["description"] for a in found] == ["rent hike?"]


def test_duplicate_detection(client):
    h = signup(client)
    first = add(client, h, 649, "Dominos", date=ago(1))
    dup = add(client, h, 649, "Domino's", date=ago(1))
    add(client, h, 649, "Dominos", date=ago(10))      # a week+ apart: fine
    add(client, h, 40, "chai", date=ago(1))
    add(client, h, 40, "chai", date=ago(1))          # tiny: ignored
    found = [a for a in anomalies(client, h) if a["kind"] == "possible_duplicate"]
    assert len(found) == 1
    assert found[0]["transaction_id"] == dup["id"] and found[0]["related_transaction_id"] == first["id"]


def test_window_and_isolation_and_validation(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    seed_food_history(client, h, food)
    add(client, h, 5000, "old splurge", date=ago(20), category_id=food)
    assert len(anomalies(client, h, days=30)) == 1
    assert anomalies(client, h, days=5) == []      # outside the window
    other = signup(client, "other@example.com")
    assert anomalies(client, other) == []
    assert client.get("/ai/anomalies", params={"days": 0}, headers=h).status_code == 422
    assert client.get("/ai/anomalies").status_code == 401


def test_high_severity_needs_a_big_jump_not_just_tight_history(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    for i, amt in enumerate([1300, 1305, 1295, 1300, 1310, 1290, 1300, 1300]):  # very tight history
        add(client, h, amt, f"grocery run {i}", date=ago(40 + i * 3), category_id=food)
    mild = add(client, h, 2100, "BigBasket", date=ago(2), category_id=food)       # 1.6x typical
    huge = add(client, h, 9500, "Banquet", date=ago(1), category_id=food)         # 7.3x typical
    sev = {a["transaction_id"]: a["severity"] for a in anomalies(client, h)}
    assert sev[mild["id"]] == "medium" and sev[huge["id"]] == "high"


def test_anomalies_can_be_scoped_to_a_month(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    seed_food_history(client, h, food)
    add(client, h, 5000, "Fancy dinner", date=ago(1), category_id=food)
    month = ago(1)[:7]
    r = client.get("/ai/anomalies", params={"month": month}, headers=h)
    assert r.status_code == 200 and [a["description"] for a in r.json()] == ["Fancy dinner"]
    assert client.get("/ai/anomalies", params={"month": "2020-01"}, headers=h).json() == []
    assert client.get("/ai/anomalies", params={"month": "2020-13"}, headers=h).status_code == 422
