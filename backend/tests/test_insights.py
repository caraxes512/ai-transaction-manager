from datetime import date

from app.main import app
from app.services.analytics import add_months
from app.services.fmt import inr
from app.services.insights import get_insight_writer, numbers_are_grounded
from tests.helpers import add, cat_id, signup

THIS = date.today().replace(day=1)
LAST = add_months(THIS, -1)
MONTH = THIS.strftime("%Y-%m")


def d(ms, day=3):
    return ms.replace(day=day).isoformat()


class FakeWriter:
    def __init__(self, out):
        self.out, self.payloads = out, []

    def write(self, payload):
        self.payloads.append(payload)
        return self.out


def seed(client, h):
    food, shop = cat_id(client, h, "Food"), cat_id(client, h, "Shopping")
    add(client, h, 7820, "groceries", date=d(LAST), category_id=food)
    add(client, h, 6000, "dinners", date=d(THIS), category_id=food)
    add(client, h, 4240, "restaurants", date=d(THIS, 4), category_id=food)
    add(client, h, 1500, "shirt", date=d(THIS), category_id=shop)
    add(client, h, 90000, "pay", type="income", date=d(THIS), category_id=cat_id(client, h, "Salary"))


def test_inr_formatting():
    assert inr(10240) == "₹10,240"
    assert inr(1234567) == "₹12,34,567"
    assert inr("450.5") == "₹450.50"
    assert inr(-2500) == "-₹2,500"
    assert inr(0) == "₹0"


def test_template_insights_use_computed_numbers(client):
    h = signup(client)
    seed(client, h)
    r = client.get("/ai/insights", params={"month": MONTH}, headers=h)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["source"] == "template"
    kinds = {f["kind"]: f for f in body["findings"]}
    assert "rose 30.9% from ₹7,820 to ₹10,240" in kinds["increase"]["message"]
    assert kinds["new_category"]["category"] == "Shopping"
    assert "87.0%" in kinds["savings"]["message"]   # (90,000 - 11,740) / 90,000
    assert body["facts"]["total_expense"] == 11740.0
    assert body["facts"]["categories"][0]["category"] == "Food"
    assert any("monthly limit for Food" in t for t in body["tips"])
    # the summary is a short headline; the details live in findings and are not said twice
    assert "largest category" not in body["summary"] and "kept" not in body["summary"]
    assert body["summary"].startswith("In ") and len(body["summary"].split(". ")) == 1  # one sentence


def test_grounded_llm_output_is_used(client):
    h = signup(client)
    seed(client, h)
    w = FakeWriter({"summary": "Food spending rose 30.9% to ₹10,240 this month.",
                    "tips": ["Try a ₹10,240 cap on Food next month."]})
    app.dependency_overrides[get_insight_writer] = lambda: w
    body = client.get("/ai/insights", params={"month": MONTH}, headers=h).json()
    assert body["source"] == "llm" and "30.9%" in body["summary"]
    # the writer received finished numbers, not raw transactions
    assert w.payloads[0]["facts"]["total_expense"] == 11740.0
    assert "groceries" not in str(w.payloads[0])


def test_hallucinated_numbers_fall_back_to_template(client):
    h = signup(client)
    seed(client, h)
    app.dependency_overrides[get_insight_writer] = lambda: FakeWriter(
        {"summary": "You overspent by ₹99,999 on Food.", "tips": []})
    body = client.get("/ai/insights", params={"month": MONTH}, headers=h).json()
    assert body["source"] == "template" and "99,999" not in body["summary"]


def test_bad_or_missing_llm_output_falls_back(client):
    h = signup(client)
    seed(client, h)
    for bad in (None, {"tips": ["x"]}, {"summary": 5}, "text", {"summary": "ok", "tips": [1, 2]}):
        app.dependency_overrides[get_insight_writer] = lambda bad=bad: FakeWriter(bad)
        body = client.get("/ai/insights", params={"month": MONTH}, headers=h).json()
        assert body["source"] == "template"


def test_empty_month_skips_llm(client):
    h = signup(client)
    w = FakeWriter({"summary": "x", "tips": []})
    app.dependency_overrides[get_insight_writer] = lambda: w
    body = client.get("/ai/insights", params={"month": "2020-01"}, headers=h).json()
    assert body["findings"][0]["kind"] == "no_data" and body["source"] == "template"
    assert w.payloads == []


def test_unusual_transactions_flow_into_insights(client):
    h = signup(client)
    food = cat_id(client, h, "Food")
    for i, amt in enumerate([300, 320, 350, 380, 400, 330]):
        add(client, h, amt, f"meal {i}", date=d(LAST, 3 + i), category_id=food)
    add(client, h, 6000, "Banquet", date=d(THIS), category_id=food)
    body = client.get("/ai/insights", params={"month": MONTH}, headers=h).json()
    unusual = [f for f in body["findings"] if f["kind"] == "unusual"]
    assert unusual and "Banquet" in unusual[0]["message"]
    assert any("flagged" in t for t in body["tips"])


def test_grounding_checker_directly():
    facts = {"total_expense": 10240.0, "total_change_pct": 30.9, "month": "2026-10"}
    ok = lambda s: numbers_are_grounded([s], facts, [{"message": "rose ₹7,820"}])
    assert ok("You spent ₹10,240, up 30.9%.")
    assert ok("That is about 31% more, from ₹7,820.")     # rounding of a given number is allowed
    assert ok("Top 3 categories in 2026.")
    assert not ok("You spent ₹12,000.")
    assert not ok("Up 45.5%.")


def test_insights_validation_and_auth(client):
    h = signup(client)
    assert client.get("/ai/insights", params={"month": "2026-99"}, headers=h).status_code == 422
    assert client.get("/ai/insights").status_code == 401
