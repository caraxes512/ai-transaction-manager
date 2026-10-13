from datetime import date
from decimal import Decimal

from app.services.analytics import add_months
from app.services.budgets import projected_spend, status_for
from tests.helpers import add, cat_id, signup

THIS = date.today().replace(day=1)
LAST = add_months(THIS, -1)
MONTH = THIS.strftime("%Y-%m")


def d(ms, day=3):
    return ms.replace(day=day).isoformat()


def make_budget(client, h, category, limit, month=None):
    body = {"category_id": cat_id(client, h, category), "limit_amount": str(limit)}
    if month:
        body["month"] = month
    return client.post("/budgets", headers=h, json=body)


def test_status_thresholds():
    assert [status_for(x) for x in (0, 79.9, 80, 99.9, 100, 140)] == \
           ["ok", "ok", "warning", "warning", "exceeded", "exceeded"]


OCT = date(2026, 10, 1)


def _daily(y, m, days, amount="100"):
    return [(date(y, m, d), Decimal(amount)) for d in range(1, days + 1)]


EVEN = _daily(2026, 7, 31) + _daily(2026, 8, 31) + _daily(2026, 9, 30)


def test_projection_scales_evenly_spread_spending():
    # ~48% of a month's food spend is normally done by the 15th, so 6000 so far => ~12400
    assert projected_spend(Decimal("6000"), OCT, date(2026, 10, 15), EVEN) == Decimal("12400")


def test_front_loaded_bill_projects_to_itself_not_to_a_huge_number():
    rent = [(date(2026, m, 3), Decimal("15000")) for m in (7, 8, 9)]
    assert projected_spend(Decimal("15000"), OCT, date(2026, 10, 8), rent) == Decimal("15000")


def test_no_projection_when_little_is_normally_spent_by_now():
    # transport: 1 of 4 equal trips (25%) is normally done by the 8th, so one big airport ride must not be x4
    trips = [(date(2026, m, d), Decimal("600")) for m in (7, 8, 9) for d in (6, 12, 18, 24)]
    assert projected_spend(Decimal("3000"), OCT, date(2026, 10, 8), trips) is None


def test_late_month_subscription_gets_no_projection():
    netflix = [(date(2026, m, 15), Decimal("649")) for m in (7, 8, 9)]
    assert projected_spend(Decimal("649"), OCT, date(2026, 10, 8), netflix) is None


def test_projection_needs_history_the_current_month_and_a_week_of_data():
    assert projected_spend(Decimal("6000"), OCT, date(2026, 10, 15), []) is None
    assert projected_spend(Decimal("6000"), OCT, date(2026, 10, 15), _daily(2026, 9, 30)) is None  # only 1 month
    assert projected_spend(Decimal("6000"), OCT, date(2026, 10, 6), EVEN) is None   # too early in the month
    assert projected_spend(Decimal("6000"), OCT, date(2026, 11, 15), EVEN) is None  # not the current month


def test_budget_without_history_shows_no_projection_or_warning(client):
    h = signup(client)
    add(client, h, 649, "Netflix", date=d(THIS), category_id=cat_id(client, h, "Entertainment"))
    b = make_budget(client, h, "Entertainment", 2000).json()
    assert b["projected_spend"] is None and b["projected_to_exceed"] is False


def test_budget_status_math(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    add(client, h, 8000, "groceries", date=d(THIS), category_id=food)
    add(client, h, 500, "dinner", date=d(THIS, 4), category_id=food)
    add(client, h, 99999, "salary", type="income", date=d(THIS), category_id=food)       # income ignored
    add(client, h, 7777, "last month", date=d(LAST), category_id=food)                   # other month ignored
    add(client, h, 3000, "shirt", date=d(THIS), category_id=cat_id(client, h, "Shopping"))  # other category

    r = make_budget(client, h, "Food", 10000)
    assert r.status_code == 201, r.text
    b = r.json()
    assert b["month"] == MONTH and b["category"] == "Food"
    assert b["spent"] == "8500.00" and b["remaining"] == "1500.00"
    assert b["percent_used"] == 85.0 and b["status"] == "warning"


def test_exceeded_and_ok_and_ordering(client):
    h = signup(client)
    add(client, h, 12000, "big", date=d(THIS), category_id=cat_id(client, h, "Food"))
    add(client, h, 500, "bus", date=d(THIS), category_id=cat_id(client, h, "Transport"))
    make_budget(client, h, "Transport", 1000)
    make_budget(client, h, "Food", 10000)
    rows = client.get("/budgets", params={"month": MONTH}, headers=h).json()
    assert [r["category"] for r in rows] == ["Food", "Transport"]   # most-used first
    assert rows[0]["status"] == "exceeded" and rows[0]["remaining"] == "-2000.00" and rows[0]["percent_used"] == 120.0
    assert rows[1]["status"] == "ok" and rows[1]["percent_used"] == 50.0


def test_alerts_only_lists_warning_and_exceeded(client):
    h = signup(client)
    add(client, h, 9000, "a", date=d(THIS), category_id=cat_id(client, h, "Food"))
    add(client, h, 100, "b", date=d(THIS), category_id=cat_id(client, h, "Transport"))
    make_budget(client, h, "Food", 10000)
    make_budget(client, h, "Transport", 1000)
    alerts = client.get("/budgets/alerts", headers=h).json()
    assert [a["category"] for a in alerts] == ["Food"]


def test_duplicate_update_delete(client):
    h = signup(client)
    b = make_budget(client, h, "Food", 5000).json()
    assert make_budget(client, h, "Food", 6000).status_code == 409
    assert make_budget(client, h, "Food", 6000, month=LAST.strftime("%Y-%m")).status_code == 201  # other month is fine

    r = client.put(f"/budgets/{b['id']}", headers=h, json={"limit_amount": "7500"})
    assert r.status_code == 200 and r.json()["limit_amount"] == "7500.00"
    assert client.delete(f"/budgets/{b['id']}", headers=h).status_code == 204
    assert client.delete(f"/budgets/{b['id']}", headers=h).status_code == 404
    assert len(client.get("/budgets", headers=h).json()) == 0


def test_validation(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    for bad in ({"category_id": food, "limit_amount": "0"},
                {"category_id": food, "limit_amount": "-5"},
                {"category_id": food, "limit_amount": "100", "month": "2026-13"},
                {"category_id": 99999, "limit_amount": "100"}):
        assert client.post("/budgets", headers=h, json=bad).status_code == 422, bad
    assert client.get("/budgets", params={"month": "nope"}, headers=h).status_code == 422
    assert client.get("/budgets").status_code == 401


def test_isolation_between_users(client):
    h1, h2 = signup(client, "one@example.com"), signup(client, "two@example.com")
    b = make_budget(client, h1, "Food", 5000).json()
    assert client.get("/budgets", headers=h2).json() == []
    assert client.put(f"/budgets/{b['id']}", headers=h2, json={"limit_amount": "1"}).status_code == 404
    assert client.delete(f"/budgets/{b['id']}", headers=h2).status_code == 404
    # cannot budget against someone else's category
    r = client.post("/budgets", headers=h2, json={"category_id": b["category_id"], "limit_amount": "100"})
    assert r.status_code == 422


def test_deleting_a_category_removes_its_budgets(client):
    h = signup(client)
    cat = client.post("/categories", headers=h, json={"name": "Pets"}).json()
    client.post("/budgets", headers=h, json={"category_id": cat["id"], "limit_amount": "500"})
    assert len(client.get("/budgets", headers=h).json()) == 1
    client.delete(f"/categories/{cat['id']}", headers=h)
    assert client.get("/budgets", headers=h).json() == []


def test_budget_findings_appear_in_insights(client):
    h = signup(client)
    food, shop = cat_id(client, h, "Food"), cat_id(client, h, "Shopping")
    add(client, h, 12000, "dinners", date=d(THIS), category_id=food)
    add(client, h, 850, "shirt", date=d(THIS), category_id=shop)
    make_budget(client, h, "Food", 10000)
    make_budget(client, h, "Shopping", 1000)
    body = client.get("/ai/insights", params={"month": MONTH}, headers=h).json()
    msgs = [f["message"] for f in body["findings"] if f["kind"] == "budget"]
    assert any("Food budget exceeded: ₹12,000 spent of ₹10,000 (120.0%), ₹2,000 over." == m for m in msgs)
    assert any("Shopping budget is 85.0% used: ₹850 of ₹1,000." == m for m in msgs)
    assert {b["category"] for b in body["facts"]["budgets"]} == {"Food", "Shopping"}
    assert any("Food budget" in t for t in body["tips"])
