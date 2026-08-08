"""Iter32 — Post-a-Job redesign v31 backend tests.

Tests the JobIn model extension with new v31 fields:
- site_project_type, worker_type
- skills_required (list of {skill, count})
- working_start_date, drawing_url/type/name
- site_stay_allowed
- address, city, state, pin_code
- daily_wage is now optional (default 0)
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _login(mobile: str, password: str = "demo1234") -> str:
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {mobile}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    return _login("9000000001")


@pytest.fixture(scope="module")
def contractor_token():
    return _login("9000000003")


@pytest.fixture(scope="module")
def worker_token():
    return _login("9000000002")


def _auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# --- Daily worker full payload ---
class TestDailyWorkerJob:
    def test_post_daily_worker_full(self, client_token):
        payload = {
            "title": "TEST_Full Trained Mason",
            "description": "2BHK plaster work",
            "skill": "Mason",
            "workers_needed": 5,
            "location": "Mumbai",
            "site_project_type": "residential",
            "worker_type": "daily_worker",
            "skills_required": [
                {"skill": "Full Trained", "count": 2},
                {"skill": "Helper", "count": 3},
            ],
            "working_start_date": "2026-07-15",
            "site_stay_allowed": True,
            "address": "Bandra East",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400051",
            "lat": 19.06,
            "lng": 72.87,
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        assert data["site_project_type"] == "residential"
        assert data["worker_type"] == "daily_worker"
        assert data["skills_required"] == payload["skills_required"]
        assert data["working_start_date"] == "2026-07-15"
        assert data["site_stay_allowed"] is True
        assert data["address"] == "Bandra East"
        assert data["city"] == "Mumbai"
        assert data["state"] == "Maharashtra"
        assert data["pin_code"] == "400051"
        assert data["lat"] == 19.06
        assert data["lng"] == 72.87
        assert data["status"] == "open"
        assert "id" in data
        job_id = data["id"]

        # GET verifies persistence
        g = requests.get(f"{API}/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        gd = g.json()
        assert gd["skills_required"] == payload["skills_required"]
        assert gd["site_stay_allowed"] is True
        assert gd["worker_type"] == "daily_worker"
        assert gd["site_project_type"] == "residential"


# --- Contractor payload (no skills_required, no site_stay) ---
class TestContractorJob:
    def test_post_contractor_no_optional(self, client_token):
        payload = {
            "title": "TEST_Plumber",
            "description": "Kitchen re-piping",
            "skill": "Plumber",
            "location": "Delhi",
            "site_project_type": "commercial",
            "worker_type": "contractor",
            "working_start_date": "2026-08-01",
            "address": "Karol Bagh",
            "city": "Delhi",
            "state": "Delhi",
            "pin_code": "110005",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        # daily_wage should default to 0
        assert data.get("daily_wage") == 0
        assert data["worker_type"] == "contractor"
        assert data["site_project_type"] == "commercial"
        # unset fields should be None or absent
        assert not data.get("skills_required")
        assert data.get("site_stay_allowed") is None


# --- Backward compatibility (no new fields at all) ---
class TestBackwardCompat:
    def test_post_minimal_no_new_fields(self, client_token):
        payload = {
            "title": "TEST_Legacy Job",
            "description": "Legacy path — no new fields",
            "skill": "Carpenter",
            "location": "Pune",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15)
        assert r.status_code == 200, f"expected 200, got {r.status_code} {r.text}"
        data = r.json()
        assert data["title"] == "TEST_Legacy Job"
        assert data.get("daily_wage") == 0
        assert data["status"] == "open"


# --- Worker forbidden ---
class TestWorkerForbidden:
    def test_worker_cannot_post(self, worker_token):
        payload = {
            "title": "TEST_Should Fail",
            "description": "worker attempt",
            "skill": "Mason",
            "location": "Mumbai",
            "site_project_type": "residential",
            "worker_type": "daily_worker",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=_auth(worker_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


# --- Regression: GET /api/jobs still returns seeded jobs ---
class TestJobsListRegression:
    def test_list_jobs_ok(self):
        r = requests.get(f"{API}/jobs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # Should have at least the ones we just posted
        titles = [j.get("title", "") for j in data]
        assert any("TEST_" in t for t in titles)

    def test_contractor_can_also_post(self, contractor_token):
        payload = {
            "title": "TEST_Contractor_Post",
            "description": "verifying contractor role can post",
            "skill": "Electrician",
            "location": "Bangalore",
            "site_project_type": "commercial",
            "worker_type": "contractor",
            "working_start_date": "2026-09-01",
            "address": "MG Road",
            "city": "Bangalore",
            "state": "Karnataka",
            "pin_code": "560001",
        }
        r = requests.post(f"{API}/jobs", json=payload, headers=_auth(contractor_token), timeout=15)
        assert r.status_code == 200, f"got {r.status_code} {r.text}"
        assert r.json()["worker_type"] == "contractor"
