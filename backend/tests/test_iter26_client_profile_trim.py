"""Backend regression for iter 26 — Client Profile SIMPLIFICATION.

Checks:
1. GET /api/me/client-stats still returns 200 for client & contractor; 403 for worker.
2. `missing_fields` list references only trimmed-required labels
   (email / About Company should no longer be listed as missing).
3. PUT /api/me still tolerates now-hidden fields (email, pan_number, website,
   company_description) — persistence verified via GET /me.
4. completion_pct math is consistent with 9-item required list
   (each field ≈ 11%, all present → 100%).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"

CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
WORKER = {"mobile": "9000000002", "password": "demo1234"}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


def _login(sess, creds):
    r = sess.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---- client-stats access ----

def test_client_stats_client_200(s):
    tok = _login(s, CLIENT)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, r.text
    d = r.json()
    assert "missing_fields" in d and "completion_pct" in d


def test_client_stats_contractor_200(s):
    tok = _login(s, CONTRACTOR)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 200, r.text


def test_client_stats_worker_403(s):
    tok = _login(s, WORKER)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 403, r.text


# ---- missing_fields no longer contains trimmed labels ----

TRIMMED_LABELS = {"Email", "email", "About company", "Description", "Company description"}


def test_missing_fields_excludes_trimmed(s):
    tok = _login(s, CLIENT)
    r = s.get(f"{API}/me/client-stats", headers=_auth(tok), timeout=15)
    assert r.status_code == 200
    missing = r.json()["missing_fields"]
    for label in missing:
        assert label not in TRIMMED_LABELS, (
            f"trimmed label {label!r} still appears in missing_fields — "
            "required list should be 9 fields (no Email/About Company)"
        )


# ---- completion_pct implies 9-item required list ----

def test_completion_pct_math_9_items(s):
    """If we fill *all* 9 required fields, completion_pct should reach 100."""
    tok = _login(s, CLIENT)
    hdr = _auth(tok)
    # ensure all required fields present
    payload = {
        "company_name": "TEST_Sharma Builders",
        "business_type": "Builder",
        "contact_person": "Amit",
        "state": "Maharashtra",
        "city": "Mumbai",
        "address": "12 MG Road",
        "pin_code": "400001",
        "gst_number": "27ABCDE1234F1Z5",
        # photo — set a tiny data-url so 'Company logo' is not missing
        "photo": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
    }
    r = s.put(f"{API}/me", headers=hdr, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    stats = s.get(f"{API}/me/client-stats", headers=hdr, timeout=15).json()
    assert stats["completion_pct"] == 100, (
        f"expected 100% after filling 9 required fields, got {stats['completion_pct']}%. "
        f"missing={stats['missing_fields']}"
    )
    assert stats["missing_fields"] == []


# ---- endpoint tolerance for now-hidden fields ----

def test_put_me_tolerates_hidden_fields(s):
    """UI removed email/pan/website/description, but backend must still accept them
    (no 400/422) since older clients may still send them."""
    tok = _login(s, CLIENT)
    hdr = _auth(tok)
    payload = {
        "email": "TEST_amit@sharma.com",
        "pan_number": "AAAAA9999A",
        "website": "https://sharma.com",
        "company_description": "Premium construction",
    }
    r = s.put(f"{API}/me", headers=hdr, json=payload, timeout=15)
    assert r.status_code == 200, r.text
    body = r.json()
    for k, v in payload.items():
        assert body.get(k) == v, f"field {k} not persisted: got {body.get(k)!r}"

    # GET /me confirms
    me = s.get(f"{API}/me", headers=hdr, timeout=15).json()
    for k, v in payload.items():
        assert me.get(k) == v, f"GET /me field {k} not persisted"
