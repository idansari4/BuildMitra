"""
Iteration 21: Wallet module — referral-stats endpoint + regression on withdraw + payments.
Covers:
- GET /api/wallet/referral-stats (200 for worker/client/contractor/admin, 401 for anon, verify code)
- GET /api/wallet regression
- POST /api/wallet/withdraw (success, invalid UPI, over-balance)
- POST /api/payments/create-order + /api/payments/verify (dev_mode topup)
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}


def _login(creds):
    ip = f"10.42.{uuid.uuid4().int % 250}.{uuid.uuid4().int % 250}"
    r = requests.post(f"{API}/auth/login", json=creds, headers={"X-Forwarded-For": ip}, timeout=15)
    assert r.status_code == 200, f"login failed {r.status_code} {r.text}"
    return r.json()["token"], ip


def _headers(tok, ip):
    return {"Authorization": f"Bearer {tok}", "X-Forwarded-For": ip}


# ---------- Referral stats ----------

def test_referral_stats_worker_shape_and_code():
    tok, ip = _login(WORKER)
    r = requests.get(f"{API}/wallet/referral-stats", headers=_headers(tok, ip), timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert set(j.keys()) >= {"invited", "earned", "code"}, f"missing keys: {j}"
    assert isinstance(j["invited"], int)
    assert isinstance(j["earned"], (int, float))
    assert j["code"] == "BM0002BBBB", f"unexpected code: {j['code']}"


@pytest.mark.parametrize("creds", [CLIENT, CONTRACTOR, ADMIN])
def test_referral_stats_other_roles_200(creds):
    tok, ip = _login(creds)
    r = requests.get(f"{API}/wallet/referral-stats", headers=_headers(tok, ip), timeout=10)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "invited" in j and "earned" in j and "code" in j


def test_referral_stats_unauthenticated_401():
    r = requests.get(f"{API}/wallet/referral-stats", timeout=10)
    assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"


# ---------- Wallet regression ----------

def test_wallet_payload_shape():
    tok, ip = _login(WORKER)
    r = requests.get(f"{API}/wallet", headers=_headers(tok, ip), timeout=10)
    assert r.status_code == 200
    j = r.json()
    assert "balance" in j and "referral_code" in j and "transactions" in j
    assert isinstance(j["transactions"], list)


# ---------- Withdraw ----------

def test_withdraw_success_deducts_balance_and_returns_txn():
    tok, ip = _login(WORKER)
    h = _headers(tok, ip)
    before = requests.get(f"{API}/wallet", headers=h, timeout=10).json()
    bal_before = float(before.get("balance", 0))
    if bal_before < 5:
        pytest.skip(f"insufficient seed balance: {bal_before}")
    amt = 1
    r = requests.post(f"{API}/wallet/withdraw", json={"amount": amt, "upi_id": "test@upi"}, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("ok") is True
    assert "txn" in j and "new_balance" in j
    assert j["txn"]["type"] == "withdrawal"
    assert float(j["txn"]["amount"]) == -amt
    assert abs(float(j["new_balance"]) - (bal_before - amt)) < 0.01

    # verify via GET
    after = requests.get(f"{API}/wallet", headers=h, timeout=10).json()
    assert abs(float(after["balance"]) - (bal_before - amt)) < 0.01


def test_withdraw_invalid_upi_400():
    tok, ip = _login(WORKER)
    r = requests.post(f"{API}/wallet/withdraw", json={"amount": 5, "upi_id": "nothing"}, headers=_headers(tok, ip), timeout=10)
    assert r.status_code == 400, r.text
    assert "UPI" in r.text or "upi" in r.text.lower()


def test_withdraw_over_balance_400():
    tok, ip = _login(WORKER)
    h = _headers(tok, ip)
    bal = float(requests.get(f"{API}/wallet", headers=h, timeout=10).json().get("balance", 0))
    r = requests.post(f"{API}/wallet/withdraw", json={"amount": bal + 100000, "upi_id": "test@upi"}, headers=h, timeout=10)
    assert r.status_code == 400, r.text
    assert "insufficient" in r.text.lower() or "balance" in r.text.lower()


# ---------- Payments: dev_mode top-up ----------

def test_payments_create_and_verify_credits_wallet():
    tok, ip = _login(WORKER)
    h = _headers(tok, ip)
    bal_before = float(requests.get(f"{API}/wallet", headers=h, timeout=10).json().get("balance", 0))

    r = requests.post(f"{API}/payments/create-order", json={"purpose": "wallet_topup", "amount_inr": 500}, headers=h, timeout=15)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order.get("order_id")
    assert order.get("dev_mode") is True
    assert int(order.get("amount_inr")) == 500

    v = requests.post(f"{API}/payments/verify", json={"order_id": order["order_id"]}, headers=h, timeout=15)
    assert v.status_code == 200, v.text
    assert v.json().get("ok") is True

    time.sleep(0.4)
    bal_after = float(requests.get(f"{API}/wallet", headers=h, timeout=10).json().get("balance", 0))
    assert abs((bal_after - bal_before) - 500) < 0.01, f"expected +500, got {bal_after - bal_before}"
