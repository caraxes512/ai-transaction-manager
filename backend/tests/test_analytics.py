from datetime import date

from app.services.analytics import add_months, parse_month, pct_change
from decimal import Decimal
import pytest

from tests.helpers import add, cat_id, signup

THIS = date.today().replace(day=1)
LAST = add_months(THIS, -1)


def d(month_start, day=5):
    return month_start.replace(day=day).isoformat()


def test_pct_change_matches_the_plan_example():
    assert pct_change(Decimal("10240"), Decimal("7820")) == 30.9
    assert pct_change(Decimal("5"), Decimal("0")) is None


def test_parse_month():
    assert parse_month("2026-10") == date(2026, 10, 1)
    for bad in ("2026-13", "26-10", "october"):
        with pytest.raises(ValueError):
            parse_month(bad)


def test_category_breakdown_with_month_over_month(client):
    h = signup(client)
    food, shop = cat_id(client, h, "Food"), cat_id(client, h, "Shopping")
    add(client, h, 7820, "groceries", date=d(LAST), category_id=food)
    add(client, h, 6000, "dinners", date=d(THIS), category_id=food)
    add(client, h, 4240, "restaurants", date=d(THIS, 6), category_id=food)
    add(client, h, 1000, "shirt", date=d(THIS), category_id=shop)
    add(client, h, 50, "mystery", date=d(THIS))  # uncategorized
    add(client, h, 90000, "salary", type="income", date=d(THIS), category_id=cat_id(client, h, "Salary"))

    r = client.get("/analytics/categories", params={"month": THIS.strftime("%Y-%m")}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["total_expense"] == "11290.00"   # income is excluded
    assert body["previous_total_expense"] == "7820.00"
    cats = {c["category"]: c for c in body["categories"]}
    assert cats["Food"]["total"] == "10240.00" and cats["Food"]["count"] == 2
    assert cats["Food"]["change_pct"] == 30.9
    assert cats["Shopping"]["change_pct"] is None   # nothing last month
    assert cats["Uncategorized"]["total"] == "50.00"
    assert body["categories"][0]["category"] == "Food"  # sorted by spend
    assert sum(c["percent_of_total"] for c in body["categories"]) == pytest.approx(100, abs=0.2)


def test_category_only_in_previous_month_shows_drop(client):
    h = signup(client)
    add(client, h, 500, "movie", date=d(LAST), category_id=cat_id(client, h, "Entertainment"))
    body = client.get("/analytics/categories", headers=h).json()
    ent = body["categories"][0]
    assert ent["total"] == "0.00" and ent["change_pct"] == -100.0


def test_bad_month_rejected(client):
    h = signup(client)
    assert client.get("/analytics/categories", params={"month": "2026-99"}, headers=h).status_code == 422


def test_monthly_summary_fills_gaps_and_is_per_user(client):
    h = signup(client)
    add(client, h, 1000, "rent", date=d(THIS))
    add(client, h, 5000, "pay", type="income", date=d(THIS))
    add(client, h, 200, "tea", date=d(add_months(THIS, -2)))
    other = signup(client, "other@example.com")
    add(client, other, 99999, "not mine", date=d(THIS))

    rows = client.get("/analytics/monthly", params={"months": 3}, headers=h).json()
    assert [r["month"] for r in rows] == [add_months(THIS, -2).strftime("%Y-%m"),
                                          LAST.strftime("%Y-%m"), THIS.strftime("%Y-%m")]
    assert rows[0]["expense"] == "200.00"
    assert rows[1] == {"month": LAST.strftime("%Y-%m"), "income": "0.00", "expense": "0.00", "net": "0.00"}
    assert rows[2]["income"] == "5000.00" and rows[2]["expense"] == "1000.00" and rows[2]["net"] == "4000.00"


def test_analytics_requires_auth(client):
    assert client.get("/analytics/monthly").status_code == 401


def test_monthly_can_end_at_a_chosen_month(client):
    h = signup(client)
    add(client, h, 700, "last month spend", date=d(LAST))
    add(client, h, 300, "this month spend", date=d(THIS))
    rows = client.get("/analytics/monthly", params={"months": 3, "end": LAST.strftime("%Y-%m")}, headers=h).json()
    assert [r["month"] for r in rows][-1] == LAST.strftime("%Y-%m") and len(rows) == 3
    assert rows[-1]["expense"] == "700.00"                       # this month's 300 is outside the window
    assert all(r["month"] != THIS.strftime("%Y-%m") for r in rows)
    assert client.get("/analytics/monthly", params={"end": "2026-13"}, headers=h).status_code == 422
