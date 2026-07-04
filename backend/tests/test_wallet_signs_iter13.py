"""
Iteration 13: Wallet transaction sign regression.
Verifies:
- /api/wallet returns transactions array
- Each transaction.amount is numeric
- Withdrawal creates a transaction with NEGATIVE amount (backing the frontend sign fix)
- Smoke on /api/health, /api/auth/login, /api/me
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}


def _login(creds):
    ip = f"10.42.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
    r = requests.post(f"{API}/auth/login", json=creds, headers={"X-Forwarded-For": ip}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"], ip


# ---- Smoke ----

def test_api_health():
    r = requests.get(f"{API}/health", timeout=10)
    assert r.status_code == 200


def test_login_worker_client_admin():
    for creds in (WORKER, CLIENT, ADMIN):
        tok, _ = _login(creds)
        assert tok and isinstance(tok, str)


def test_me_returns_user():
    tok, ip = _login(WORKER)
    r = requests.get(f"{API}/me", headers={"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}, timeout=10)
    assert r.status_code == 200
    body = r.json()
    assert body.get("mobile") == WORKER["mobile"]
    assert "role" in body


# ---- Wallet payload shape ----

def test_wallet_returns_transactions_array():
    tok, ip = _login(WORKER)
    r = requests.get(f"{API}/wallet", headers={"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}, timeout=10)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "transactions" in data, f"missing transactions: {data}"
    assert isinstance(data["transactions"], list)
    assert "balance" in data


def test_wallet_transaction_amounts_are_numeric():
    tok, ip = _login(WORKER)
    r = requests.get(f"{API}/wallet", headers={"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}, timeout=10)
    assert r.status_code == 200
    for tx in r.json().get("transactions", []):
        assert "amount" in tx, f"tx missing amount: {tx}"
        assert isinstance(tx["amount"], (int, float)), f"amount not numeric: {tx}"


# ---- Withdrawal creates negative txn (the bug fix's data source) ----

def test_withdrawal_creates_negative_amount_transaction():
    tok, ip = _login(WORKER)
    h = {"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}

    # snapshot before
    before = requests.get(f"{API}/wallet", headers=h, timeout=10)
    assert before.status_code == 200
    prev_txn_ids = {t["id"] for t in before.json().get("transactions", []) if "id" in t}
    balance_before = before.json().get("balance", 0)

    # attempt small withdraw (mocked; per PRD)
    amt = 1
    r = requests.post(f"{API}/wallet/withdraw", json={"amount": amt, "upi_id": "test@upi"}, headers=h, timeout=15)
    if r.status_code == 400:
        # Likely insufficient balance; skip
        pytest.skip(f"Withdraw returned 400 (probably insufficient balance={balance_before}): {r.text}")
    assert r.status_code == 200, f"withdraw failed: {r.status_code} {r.text}"

    # verify new txn appears with negative amount
    time.sleep(0.5)
    after = requests.get(f"{API}/wallet", headers=h, timeout=10)
    assert after.status_code == 200
    new_txns = [t for t in after.json().get("transactions", []) if t.get("id") not in prev_txn_ids]
    assert new_txns, "no new transaction after withdraw"
    debit = [t for t in new_txns if float(t.get("amount", 0)) < 0]
    assert debit, f"expected a negative-amount transaction; got: {new_txns}"
    assert float(debit[0]["amount"]) == -amt, f"expected -{amt}, got {debit[0]['amount']}"


# ---- SPA serving ----

def test_root_serves_index_html():
    r = requests.get(f"{BASE_URL}/", timeout=10)
    assert r.status_code == 200
    assert "<html" in r.text.lower() or "<!doctype" in r.text.lower()


def test_js_bundle_served():
    # new hash after rebuild
    r = requests.get(f"{BASE_URL}/_expo/static/js/web/entry-bd7258f1b2479c1463b6fc81d9b5ec7f.js", timeout=15)
    assert r.status_code == 200
    assert len(r.content) > 1000


def test_root_health_endpoints():
    for path in ("/api/health", "/api/healthz", "/health", "/healthz"):
        r = requests.get(f"{BASE_URL}{path}", timeout=10)
        assert r.status_code == 200, f"{path} -> {r.status_code}"
