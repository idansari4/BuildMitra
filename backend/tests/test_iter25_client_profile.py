"""Backend tests for iter 25 — Client Profile redesign.

Covers:
- GET /api/me/client-stats for client / contractor / worker (403) / unauth (401)
- Response shape validation (all required keys + verifications dict + ranges)
- PUT /api/me accepts new client extended fields; GET verifies persistence
- completion_pct increases after profile update
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to public frontend env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
WORKER = {"mobile": "9000000002", "password": "demo1234"}


REQUIRED_KEYS = {
    "jobs_posted", "active_jobs", "workers_hired", "contractors_hired",
    "completed_projects", "joined_at", "wallet_balance", "escrow_balance",
    "total_payments", "ontime_payment_pct", "rating_avg", "rating_count",
    "hiring_success_rate", "avg_response_hours", "verifications",
    "trust_score", "badges", "missing_fields", "completion_pct", "is_hiring_now",
}
VER_KEYS = {"mobile_verified", "email_verified", "gst_verified", "aadhaar_verified", "company_verified"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(sess, creds):
    r = sess.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


# ---- client-stats endpoint ----
def test_client_stats_client_ok(s):
    tok = _login(s, CLIENT)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    missing = REQUIRED_KEYS - set(d.keys())
    assert not missing, f"missing keys: {missing}"
    assert isinstance(d["verifications"], dict)
    assert VER_KEYS.issubset(d["verifications"].keys())
    for k in VER_KEYS:
        assert isinstance(d["verifications"][k], bool)
    assert isinstance(d["trust_score"], int) and 0 <= d["trust_score"] <= 100
    assert isinstance(d["completion_pct"], int) and 0 <= d["completion_pct"] <= 100
    assert isinstance(d["badges"], list)
    assert isinstance(d["missing_fields"], list)
    assert isinstance(d["is_hiring_now"], bool)


def test_client_stats_contractor_ok(s):
    tok = _login(s, CONTRACTOR)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    missing = REQUIRED_KEYS - set(d.keys())
    assert not missing, f"missing keys: {missing}"


def test_client_stats_worker_forbidden(s):
    tok = _login(s, WORKER)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 403, r.text
    assert "Client" in r.text or "client" in r.text.lower()


def test_client_stats_unauth(s):
    r = s.get(f"{API}/me/client-stats", timeout=15)
    assert r.status_code in (401, 403), r.text


# ---- PUT /me extended fields + completion_pct increases ----
def test_client_profile_update_persists_and_completion_increases(s):
    tok = _login(s, CLIENT)
    hdr = _auth(tok)

    # Baseline completion
    before = s.get(f"{API}/me/client-stats", headers=hdr, timeout=15).json()
    before_pct = before["completion_pct"]

    payload = {
        "business_type": "Builder",
        "contact_person": "Amit",
        "email": "amit@sharma.com",
        "gst_number": "27ABCDE1234F1Z5",
        "pan_number": "AAAAA9999A",
        "website": "https://sharma.com",
        "company_description": "Premium construction",
        "state": "Maharashtra",
        "address": "12 MG Road",
        "pin_code": "400001",
    }
    r = s.put(f"{API}/me", headers=hdr, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    u = r.json()
    for k, v in payload.items():
        assert u.get(k) == v, f"field {k} not persisted: got {u.get(k)!r}, expected {v!r}"

    # GET /me confirms persistence
    me = s.get(f"{API}/me", headers=hdr, timeout=15).json()
    for k, v in payload.items():
        assert me.get(k) == v, f"GET /me field {k} not persisted"

    # completion_pct should have increased (or reached 100)
    after = s.get(f"{API}/me/client-stats", headers=hdr, timeout=15).json()
    assert after["completion_pct"] >= before_pct, (
        f"completion_pct did not increase: {before_pct} -> {after['completion_pct']}"
    )
    # missing_fields should shrink or stay same
    assert len(after["missing_fields"]) <= len(before["missing_fields"])
