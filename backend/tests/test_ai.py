from app.services.ai_classifier import get_llm, normalize, tokens
from app.main import app
from tests.helpers import add, cat_id, signup


class FakeLLM:
    def __init__(self, answer):
        self.answer, self.calls = answer, 0

    def classify(self, description, amount, txn_type, categories):
        self.calls += 1
        return self.answer


def test_normalize_and_tokens():
    assert normalize("Domino's  Pizza!") == "dominos pizza"
    assert tokens("Swiggy order UPI") == {"swiggy"}


def test_rule_based_categorization_on_create(client):
    h = signup(client)
    t = add(client, h, 450, "Swiggy order")
    assert t["category"]["name"] == "Food"
    assert t["category_source"] == "rule" and t["category_confidence"] == 0.9


def test_longest_keyword_wins(client):
    h = signup(client)
    assert add(client, h, 299, "Amazon Prime renewal")["category"]["name"] == "Entertainment"
    assert add(client, h, 999, "Amazon order")["category"]["name"] == "Shopping"


def test_unknown_merchant_stays_uncategorized_without_llm(client):
    h = signup(client)
    t = add(client, h, 120, "Ramesh general store")
    assert t["category"] is None and t["category_source"] is None


def test_user_history_overrides_rules_and_learns_from_edits(client):
    h = signup(client)
    shopping = cat_id(client, h, "Shopping")
    # The user says Swiggy Instamart is Shopping for them, not Food.
    add(client, h, 300, "Swiggy instamart", category_id=shopping)
    t = add(client, h, 500, "Swiggy instamart again")
    assert t["category"]["name"] == "Shopping" and t["category_source"] == "history"

    # Correcting an auto-categorized transaction becomes new training data.
    unknown = add(client, h, 80, "Ramesh store")
    client.put(f"/transactions/{unknown['id']}", headers=h, json={"category_id": cat_id(client, h, "Food")})
    again = add(client, h, 60, "Ramesh store snacks")
    assert again["category"]["name"] == "Food" and again["category_source"] == "history"


def test_auto_assigned_labels_do_not_feed_history(client):
    h = signup(client)
    add(client, h, 100, "Quickmart groceries")  # rule -> Food, source "rule"
    r = client.post("/ai/categorize", headers=h, json={"description": "Quickmart"})
    assert r.json()["category"] is None  # a rule-labelled txn is not "history"


def test_llm_fallback_and_validation(client):
    h = signup(client)
    llm = FakeLLM(("Health", 0.97))
    app.dependency_overrides[get_llm] = lambda: llm
    r = client.post("/ai/categorize", headers=h, json={"description": "Dr Mehta consultation fee"})
    body = r.json()
    assert body["category"] == "Health" and body["source"] == "llm"
    assert body["confidence"] == 0.8  # capped
    assert body["auto_apply"] is True

    # An invented category is rejected rather than trusted.
    app.dependency_overrides[get_llm] = lambda: FakeLLM(("Crypto", 0.99))
    r = client.post("/ai/categorize", headers=h, json={"description": "mystery merchant xyz"})
    assert r.json()["category"] is None


def test_llm_not_called_when_rule_is_confident(client):
    h = signup(client)
    llm = FakeLLM(("Other", 0.9))
    app.dependency_overrides[get_llm] = lambda: llm
    add(client, h, 100, "Zomato")
    assert llm.calls == 0


def test_low_confidence_is_suggested_not_applied(client):
    h = signup(client)
    app.dependency_overrides[get_llm] = lambda: FakeLLM(("Other", 0.3))
    t = add(client, h, 100, "mystery merchant xyz")
    assert t["category"] is None
    r = client.post("/ai/categorize", headers=h, json={"description": "mystery merchant xyz"}).json()
    assert r["category"] == "Other" and r["auto_apply"] is False


def test_explicit_category_is_never_overridden(client):
    h = signup(client)
    t = add(client, h, 100, "Swiggy", category_id=cat_id(client, h, "Bills"))
    assert t["category"]["name"] == "Bills" and t["category_source"] == "user"


def test_recharge_wording_does_not_hijack_other_categories(client):
    h = signup(client)
    assert add(client, h, 200, "Metro recharge")["category"]["name"] == "Transport"
    assert add(client, h, 299, "Mobile recharge")["category"]["name"] == "Bills"
    assert add(client, h, 500, "Recharge")["category"] is None   # ambiguous: leave it for the user
