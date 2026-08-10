"""
Iter37 — Phase 3 Worker & Contractor profile enhancement backend tests.

Coverage:
- PUT /me (Worker) with new fields (working_hours_*, conveyance_allowance,
  permanent_*, aadhaar_document_*). Verify aadhaar_status forced to "pending"
  even if client tries to set "verified", and rejection_reason cleared.
- PUT /me (Worker) follow-up sending aadhaar_status=verified without a new
  document → status must remain "pending" (silently ignored).
- PUT /me (Contractor) with permanent_* fields → 200 + persisted.
- PUT /me (Client) with permanent_* fields → API accepts backward-compat.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    raise RuntimeError("EXPO_PUBLIC_BACKEND_URL not set")

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def worker_hdr():
    return _login(WORKER)


@pytest.fixture(scope="module")
def contractor_hdr():
    return _login(CONTRACTOR)


@pytest.fixture(scope="module")
def client_hdr():
    return _login(CLIENT)


# -------- Worker PUT /me with new fields ----------
def test_worker_put_me_new_fields_and_aadhaar_forced_pending(worker_hdr):
    payload = {
        "working_hours_start": "09:00 AM",
        "working_hours_end": "05:00 PM",
        "conveyance_allowance": True,
        "permanent_address": "Vill Sohna",
        "permanent_city": "Patna",
        "permanent_state": "Bihar",
        "permanent_pin_code": "800001",
        "permanent_country": "India",
        "aadhaar_document_url": "data:image/jpeg;base64,AAAA",
        "aadhaar_document_type": "image",
        "aadhaar_document_name": "aadhaar.jpg",
        # Attempt to self-verify — MUST be rewritten to "pending"
        "aadhaar_status": "verified",
        "aadhaar_rejection_reason": "should-be-cleared",
    }
    r = requests.put(f"{BASE_URL}/api/me", json=payload, headers=worker_hdr, timeout=15)
    assert r.status_code == 200, f"PUT /me failed: {r.status_code} {r.text}"
    body = r.json()
    # Assert every field persisted correctly
    assert body["working_hours_start"] == "09:00 AM"
    assert body["working_hours_end"] == "05:00 PM"
    assert body["conveyance_allowance"] is True
    assert body["permanent_address"] == "Vill Sohna"
    assert body["permanent_city"] == "Patna"
    assert body["permanent_state"] == "Bihar"
    assert body["permanent_pin_code"] == "800001"
    assert body["permanent_country"] == "India"
    assert body["aadhaar_document_url"].startswith("data:image/jpeg;base64,")
    assert body["aadhaar_document_type"] == "image"
    assert body["aadhaar_document_name"] == "aadhaar.jpg"
    # SAFETY: user cannot self-verify — must be "pending"
    assert body["aadhaar_status"] == "pending", (
        f"aadhaar_status must be forced to pending, got {body.get('aadhaar_status')}"
    )
    # rejection_reason cleared on re-upload
    assert body.get("aadhaar_rejection_reason", "") == ""


def test_worker_get_me_verifies_persistence(worker_hdr):
    r = requests.get(f"{BASE_URL}/api/me", headers=worker_hdr, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["working_hours_start"] == "09:00 AM"
    assert body["working_hours_end"] == "05:00 PM"
    assert body["conveyance_allowance"] is True
    assert body["permanent_address"] == "Vill Sohna"
    assert body["permanent_pin_code"] == "800001"
    assert body["aadhaar_status"] == "pending"


def test_worker_cannot_self_verify_status_without_document(worker_hdr):
    # No aadhaar_document_url in payload → status change must be ignored
    payload = {"aadhaar_status": "verified"}
    r = requests.put(f"{BASE_URL}/api/me", json=payload, headers=worker_hdr, timeout=15)
    assert r.status_code == 200
    body = r.json()
    assert body["aadhaar_status"] == "pending", (
        "user must not be able to self-verify without a new document"
    )
    # Confirm via GET
    r2 = requests.get(f"{BASE_URL}/api/me", headers=worker_hdr, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["aadhaar_status"] == "pending"


# -------- Contractor PUT /me with permanent_* ----------
def test_contractor_put_me_permanent_address(contractor_hdr):
    payload = {
        "permanent_address": "Plot 42 Sector 5",
        "permanent_city": "Gurgaon",
        "permanent_state": "Haryana",
        "permanent_pin_code": "122001",
        "permanent_country": "India",
        "aadhaar_document_url": "data:application/pdf;base64,BBBB",
        "aadhaar_document_type": "pdf",
        "aadhaar_document_name": "aadhaar.pdf",
    }
    r = requests.put(f"{BASE_URL}/api/me", json=payload, headers=contractor_hdr, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    assert body["permanent_address"] == "Plot 42 Sector 5"
    assert body["permanent_city"] == "Gurgaon"
    assert body["permanent_state"] == "Haryana"
    assert body["permanent_pin_code"] == "122001"
    assert body["permanent_country"] == "India"
    assert body["aadhaar_document_type"] == "pdf"
    assert body["aadhaar_status"] == "pending"
    # GET persistence check
    r2 = requests.get(f"{BASE_URL}/api/me", headers=contractor_hdr, timeout=15)
    assert r2.status_code == 200
    assert r2.json()["permanent_city"] == "Gurgaon"


# -------- Client backward-compat ----------
def test_client_put_me_accepts_permanent_backward_compat(client_hdr):
    payload = {
        "permanent_address": "TEST_Client Addr",
        "permanent_city": "Mumbai",
        "permanent_state": "MH",
        "permanent_pin_code": "400001",
        "permanent_country": "India",
    }
    r = requests.put(f"{BASE_URL}/api/me", json=payload, headers=client_hdr, timeout=15)
    assert r.status_code == 200, f"{r.status_code} {r.text}"
    body = r.json()
    assert body["permanent_city"] == "Mumbai"
    assert body["permanent_pin_code"] == "400001"


# -------- Regression: basic profile save still works ----------
def test_regression_worker_basic_name_update(worker_hdr):
    r = requests.put(f"{BASE_URL}/api/me", json={"language": "en"}, headers=worker_hdr, timeout=15)
    assert r.status_code == 200
    assert r.json().get("language") == "en"


def test_regression_client_basic_update(client_hdr):
    r = requests.put(f"{BASE_URL}/api/me", json={"language": "en"}, headers=client_hdr, timeout=15)
    assert r.status_code == 200


def test_regression_contractor_basic_update(contractor_hdr):
    r = requests.put(f"{BASE_URL}/api/me", json={"language": "en"}, headers=contractor_hdr, timeout=15)
    assert r.status_code == 200
