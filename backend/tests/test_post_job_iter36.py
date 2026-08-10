"""Iter36 — Post-a-Job per-skill wage persistence tests.

Backend must accept & persist skills_required rows that carry extra keys
(daily_wage, hours, first_hour_rate, additional_hour_rate, total_wage)
since JobIn declares skills_required: List[Dict[str, Any]].
"""
import os
import pytest
import requests

BASE_URL = os.environ.get(
    "EXPO_PUBLIC_BACKEND_URL",
    "https://buildmitra.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


def _login(mobile: str, password: str = "demo1234") -> str:
    r = requests.post(
        f"{API}/auth/login",
        json={"mobile": mobile, "password": password},
        timeout=15,
    )
    assert r.status_code == 200, f"login {mobile}: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    return _login("9000000001")


@pytest.fixture(scope="module")
def contractor_token():
    return _login("9000000003")


def _auth(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------------- Per-skill wage & supervisor persistence ----------------
class TestPerSkillWages:
    def test_full_submit_with_wages_and_supervisor(self, client_token):
        skills_required = [
            {"skill": "Full Trained", "count": 2, "daily_wage": 900},
            {"skill": "Helper", "count": 3, "daily_wage": 500},
            {
                "skill": "Site Supervisor",
                "count": 1,
                "hours": 3,
                "first_hour_rate": 500,
                "additional_hour_rate": 250,
                "total_wage": 1000,
            },
        ]
        payload = {
            "title": "TEST_Mason_iter36",
            "description": "Iter36 wages persistence test",
            "skill": "Mason",
            "workers_needed": 6,
            "location": "Mumbai",
            "site_project_type": "residential",
            "worker_type": "daily_worker",
            "skills_required": skills_required,
            "working_start_date": "2026-07-15",
            "working_duration": "2-4 Weeks",
            "site_stay_allowed": True,
            "address": "Bandra East",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400051",
        }
        r = requests.post(
            f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15
        )
        assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"
        job = r.json()
        assert "id" in job
        job_id = job["id"]

        # Response body must retain skills_required with extra keys intact
        assert job["skills_required"] == skills_required, (
            f"POST response skills_required mismatch: {job['skills_required']}"
        )

        # GET verifies persistence in DB
        g = requests.get(f"{API}/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        gd = g.json()
        got = gd.get("skills_required")
        assert got is not None, "skills_required missing on GET"
        assert len(got) == 3, f"expected 3 rows, got {len(got)}"

        # Row 0 — Full Trained
        assert got[0]["skill"] == "Full Trained"
        assert got[0]["count"] == 2
        assert got[0]["daily_wage"] == 900

        # Row 1 — Helper
        assert got[1]["skill"] == "Helper"
        assert got[1]["count"] == 3
        assert got[1]["daily_wage"] == 500

        # Row 2 — Site Supervisor with all wage-math keys
        sup = got[2]
        assert sup["skill"] == "Site Supervisor"
        assert sup["count"] == 1
        assert sup["hours"] == 3
        assert sup["first_hour_rate"] == 500
        assert sup["additional_hour_rate"] == 250
        assert sup["total_wage"] == 1000

    def test_only_full_trained_with_wage(self, client_token):
        skills_required = [{"skill": "Full Trained", "count": 1, "daily_wage": 750}]
        payload = {
            "title": "TEST_Full_Only_iter36",
            "description": "single-skill row wage",
            "skill": "Carpenter",
            "workers_needed": 1,
            "location": "Pune",
            "site_project_type": "residential",
            "worker_type": "daily_worker",
            "skills_required": skills_required,
            "working_start_date": "2026-07-20",
            "working_duration": "1-2 Weeks",
            "site_stay_allowed": False,
            "address": "Kothrud",
            "city": "Pune",
            "state": "Maharashtra",
            "pin_code": "411038",
        }
        r = requests.post(
            f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15
        )
        assert r.status_code == 200, r.text
        job_id = r.json()["id"]

        g = requests.get(f"{API}/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        got = g.json()["skills_required"]
        assert got[0]["daily_wage"] == 750

    def test_only_supervisor_row(self, client_token):
        # hours=5 → 500 + 4*250 = 1500
        skills_required = [
            {
                "skill": "Site Supervisor",
                "count": 2,
                "hours": 5,
                "first_hour_rate": 500,
                "additional_hour_rate": 250,
                "total_wage": 1500,
            }
        ]
        payload = {
            "title": "TEST_Super_Only_iter36",
            "description": "supervisor-only",
            "skill": "Mason",
            "workers_needed": 2,
            "location": "Delhi",
            "site_project_type": "commercial",
            "worker_type": "daily_worker",
            "skills_required": skills_required,
            "working_start_date": "2026-08-05",
            "working_duration": "1-3 Months",
            "site_stay_allowed": False,
            "address": "Connaught Place",
            "city": "Delhi",
            "state": "Delhi",
            "pin_code": "110001",
        }
        r = requests.post(
            f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15
        )
        assert r.status_code == 200, r.text
        job_id = r.json()["id"]

        g = requests.get(f"{API}/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        sup = g.json()["skills_required"][0]
        assert sup["hours"] == 5
        assert sup["total_wage"] == 1500
        assert sup["first_hour_rate"] == 500
        assert sup["additional_hour_rate"] == 250


# ---------------- Contractor regression (no skills_required) ----------------
class TestContractorRegression:
    def test_contractor_no_skills_required(self, client_token):
        payload = {
            "title": "TEST_Contractor_iter36",
            "description": "contractor path",
            "skill": "Plumber",
            "location": "Delhi",
            "site_project_type": "commercial",
            "worker_type": "contractor",
            "working_start_date": "2026-08-01",
            "working_duration": "2-4 Weeks",
            "address": "Karol Bagh",
            "city": "Delhi",
            "state": "Delhi",
            "pin_code": "110005",
        }
        r = requests.post(
            f"{API}/jobs", json=payload, headers=_auth(client_token), timeout=15
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["worker_type"] == "contractor"
        assert not d.get("skills_required")


# ---------------- Seed / existing jobs still load ----------------
class TestSeedRegression:
    def test_list_jobs_no_500(self):
        r = requests.get(f"{API}/jobs", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
