"""Iter 34 — Phase 1 backend regression: 'Other' custom job title flow.

Verifies that a client can post a job with a fully custom (non-canonical)
`title` and `skill`, and the created job is fetchable via GET /api/jobs/{id}.
"""
import os
import requests
import pytest

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")

CLIENT = {"mobile": "9000000001", "password": "demo1234"}
WORKER = {"mobile": "9000000002", "password": "demo1234"}


def _login(session, creds):
    r = session.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok
    session.headers.update({"Authorization": f"Bearer {tok}"})
    return r.json()


@pytest.fixture
def client_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    _login(s, CLIENT)
    return s


@pytest.fixture
def worker_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    _login(s, WORKER)
    return s


class TestOtherCustomJobTitle:
    def test_post_job_with_custom_other_title(self, client_session):
        payload = {
            "title": "False Ceiling Specialist",
            "description": "TEST_iter34 custom title job for Other flow",
            "skill": "False Ceiling Specialist",
            "workers_needed": 1,
            "daily_wage": 0,
            "location": "Mumbai",
            "site_address": "Test address",
            "duration_days": 1,
            "urgency": "Normal",
            "site_project_type": "residential",
            "worker_type": "daily_worker",
            "working_start_date": "2026-01-20",
            "working_duration": "1-2 Weeks",
            "address": "Test address",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pin_code": "400001",
            "skills_required": [{"skill": "Full Trained", "count": 1}],
            "site_stay_allowed": True,
        }
        r = client_session.post(f"{BASE_URL}/api/jobs", json=payload, timeout=20)
        assert r.status_code in (200, 201), f"Create failed: {r.status_code} {r.text}"
        job = r.json()
        assert job.get("title") == "False Ceiling Specialist"
        assert job.get("skill") == "False Ceiling Specialist"
        jid = job.get("id") or job.get("_id")
        assert jid, f"No job id in response: {job}"

        # Verify persistence via GET
        r2 = client_session.get(f"{BASE_URL}/api/jobs/{jid}", timeout=15)
        assert r2.status_code == 200, f"GET failed: {r2.status_code} {r2.text}"
        j = r2.json()
        assert j.get("title") == "False Ceiling Specialist"
        assert j.get("skill") == "False Ceiling Specialist"
        assert j.get("working_start_date") == "2026-01-20"


class TestWorkerCustomSkillPersistence:
    def test_worker_can_save_custom_skill(self, worker_session):
        # Save "Chimney Fitter" as the worker's skill (custom "Other" text)
        r = worker_session.put(
            f"{BASE_URL}/api/me",
            json={"skills": ["Chimney Fitter"]},
            timeout=15,
        )
        assert r.status_code == 200, f"Update failed: {r.status_code} {r.text}"

        # Re-fetch and confirm skill persisted
        r2 = worker_session.get(f"{BASE_URL}/api/me", timeout=15)
        assert r2.status_code == 200
        me = r2.json()
        assert "Chimney Fitter" in (me.get("skills") or []), f"skills={me.get('skills')}"
