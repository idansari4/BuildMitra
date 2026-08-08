"""Iter33 — Tests for new `working_duration` field on Post Job.

Covers:
- POST /api/jobs with `working_duration: "2-4 Weeks"` → 200, persisted via GET.
- POST /api/jobs with `working_duration: "Custom: 45 Days"` → 200, persisted.
- POST /api/jobs WITHOUT `working_duration` → still 200 (backward compat).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")

CLIENT_MOBILE = "9000000001"
CLIENT_PASSWORD = "demo1234"


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": CLIENT_MOBILE, "password": CLIENT_PASSWORD},
        timeout=15,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture()
def auth_headers(client_token):
    return {"Authorization": f"Bearer {client_token}", "Content-Type": "application/json"}


BASE_PAYLOAD = {
    "title": "TEST_WD_Mason",
    "description": "Test description for working_duration",
    "skill": "Mason",
    "workers_needed": 2,
    "daily_wage": 0,
    "location": "Mumbai, Maharashtra",
    "site_address": "TEST site",
    "duration_days": 1,
    "urgency": "Normal",
    "site_project_type": "residential",
    "worker_type": "daily_worker",
    "working_start_date": "2026-02-01",
    "address": "TEST Bandra East",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pin_code": "400001",
}


class TestWorkingDurationField:
    def test_post_job_with_standard_duration_persists(self, auth_headers):
        payload = {**BASE_PAYLOAD, "title": "TEST_WD_Standard", "working_duration": "2-4 Weeks"}
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"
        job = r.json()
        assert job.get("working_duration") == "2-4 Weeks"
        job_id = job["id"]

        # GET verification
        g = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        assert g.json().get("working_duration") == "2-4 Weeks"

    def test_post_job_with_custom_duration_persists(self, auth_headers):
        payload = {**BASE_PAYLOAD, "title": "TEST_WD_Custom", "working_duration": "Custom: 45 Days"}
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"
        job = r.json()
        assert job.get("working_duration") == "Custom: 45 Days"
        job_id = job["id"]

        # GET verification — literal "Custom: 45 Days" is stored
        g = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        assert g.json().get("working_duration") == "Custom: 45 Days"

    def test_post_job_without_working_duration_backward_compatible(self, auth_headers):
        payload = {**BASE_PAYLOAD, "title": "TEST_WD_Legacy"}
        payload.pop("working_duration", None)
        r = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=auth_headers, timeout=15)
        assert r.status_code == 200, f"POST failed: {r.status_code} {r.text}"
        job = r.json()
        # Field should either be absent or None (Optional field)
        assert job.get("working_duration") in (None, "", None)
        job_id = job["id"]

        g = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15)
        assert g.status_code == 200
        got = g.json().get("working_duration")
        assert got is None or got == ""
