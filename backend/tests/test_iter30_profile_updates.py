"""Iteration 30 — Profile update tests (worker + client + contractor).

Focus: new fields on PUT /api/me — age, gender, overtime_accepted,
minor_tools_available, plus new experience_level casing.
Also verifies existing fields still persist and availability-status endpoint
still works. No mocked APIs.
"""

import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

CREDS = {
    "worker": {"mobile": "9000000002", "password": "demo1234"},
    "client": {"mobile": "9000000001", "password": "demo1234"},
    "contractor": {"mobile": "9000000003", "password": "demo1234"},
}


@pytest.fixture(scope="module")
def tokens():
    """Login all 3 roles and cache tokens."""
    out = {}
    for role, cred in CREDS.items():
        r = requests.post(f"{API}/auth/login", json=cred, timeout=15)
        assert r.status_code == 200, f"{role} login failed: {r.status_code} {r.text}"
        out[role] = r.json()["token"]
    return out


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --------------------------------------------------------------------------
# Worker: new profile fields
# --------------------------------------------------------------------------
class TestWorkerProfileNewFields:
    def test_login_worker(self, tokens):
        assert tokens["worker"]

    def test_put_and_get_new_worker_fields(self, tokens):
        tok = tokens["worker"]
        payload = {
            "age": 34,
            "gender": "Male",
            "overtime_accepted": True,
            "minor_tools_available": False,
            "experience_level": "Full Trained",
            "skills": ["Mason"],
            "daily_wage": 750,
            "experience_years": 8,
            "city": "Pune",
        }
        r = requests.put(f"{API}/me", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        updated = r.json()
        for k, v in payload.items():
            assert updated.get(k) == v, f"PUT response mismatch on {k}: {updated.get(k)} != {v}"

        # GET verifies persistence
        r2 = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15)
        assert r2.status_code == 200
        got = r2.json()
        for k, v in payload.items():
            assert got.get(k) == v, f"GET mismatch on {k}: {got.get(k)} != {v}"

    def test_experience_level_casings(self, tokens):
        tok = tokens["worker"]
        for lvl in ("Semi Trained", "Site Supervisor", "Helper", "Full Trained"):
            r = requests.put(f"{API}/me", json={"experience_level": lvl}, headers=_hdr(tok), timeout=15)
            assert r.status_code == 200
            assert r.json().get("experience_level") == lvl
            r2 = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15)
            assert r2.json().get("experience_level") == lvl

    def test_gender_female_and_flags_false(self, tokens):
        tok = tokens["worker"]
        payload = {"gender": "Female", "overtime_accepted": False, "minor_tools_available": True, "age": 29}
        r = requests.put(f"{API}/me", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        got = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15).json()
        assert got["gender"] == "Female"
        assert got["overtime_accepted"] is False
        assert got["minor_tools_available"] is True
        assert got["age"] == 29

    def test_availability_status_still_works(self, tokens):
        tok = tokens["worker"]
        r = requests.get(f"{API}/me/availability-status", headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        data = r.json()
        for key in ("can_enable", "profile_complete", "missing_fields", "is_currently_hired", "reasons", "current_available"):
            assert key in data, f"missing key {key} in availability-status"


# --------------------------------------------------------------------------
# Client: business_type + location fields
# --------------------------------------------------------------------------
class TestClientProfileFields:
    def test_client_put_business_and_location(self, tokens):
        tok = tokens["client"]
        payload = {
            "business_type": "Builder",
            "company_name": "TEST_Sharma Builders",
            "contact_person": "Rakesh Sharma",
            "address": "12 MG Road, Sector 5",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400001",
        }
        r = requests.put(f"{API}/me", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        got = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15).json()
        for k, v in payload.items():
            assert got.get(k) == v, f"client field mismatch on {k}: {got.get(k)} != {v}"

    def test_client_business_type_options(self, tokens):
        tok = tokens["client"]
        for bt in ("Individual", "Contractor", "Builder", "Developer", "Company"):
            r = requests.put(f"{API}/me", json={"business_type": bt}, headers=_hdr(tok), timeout=15)
            assert r.status_code == 200
            assert r.json().get("business_type") == bt


# --------------------------------------------------------------------------
# Contractor: same location fields, no business_type requirement
# --------------------------------------------------------------------------
class TestContractorProfileFields:
    def test_contractor_put_location(self, tokens):
        tok = tokens["contractor"]
        payload = {
            "company_name": "TEST_Suresh Contracts",
            "contact_person": "Suresh Patel",
            "address": "45 Park Street",
            "city": "Ahmedabad",
            "state": "Gujarat",
            "pin_code": "380001",
        }
        r = requests.put(f"{API}/me", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200, r.text
        got = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15).json()
        for k, v in payload.items():
            assert got.get(k) == v, f"contractor field mismatch on {k}: {got.get(k)} != {v}"


# --------------------------------------------------------------------------
# Regression: existing fields still persist correctly
# --------------------------------------------------------------------------
class TestExistingFieldsRegression:
    def test_worker_existing_fields(self, tokens):
        tok = tokens["worker"]
        payload = {
            "skills": ["Painter"],
            "daily_wage": 900,
            "experience_years": 10,
            "city": "Delhi",
        }
        r = requests.put(f"{API}/me", json=payload, headers=_hdr(tok), timeout=15)
        assert r.status_code == 200
        got = requests.get(f"{API}/me", headers=_hdr(tok), timeout=15).json()
        assert got["skills"] == ["Painter"]
        assert got["daily_wage"] == 900
        assert got["experience_years"] == 10
        assert got["city"] == "Delhi"
