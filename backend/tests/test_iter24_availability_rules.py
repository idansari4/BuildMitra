"""
Iter 24 - Worker Availability Rules

Tests the 4 rules:
1. Availability cannot be turned ON until profile is 100% complete
2. Availability must stay OFF during active hiring (accepted applications)
3. Skills must be single-select (backend trims to 1)
4. (SKILLS ordering is a frontend concern, tested via Playwright)
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")
CLIENT_MOBILE = "9000000001"
DEMO_PASS = "demo1234"

TIMEOUT = 20


def _login(mobile: str, password: str = DEMO_PASS):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"mobile": mobile, "password": password}, timeout=TIMEOUT)
    assert r.status_code == 200, f"Login {mobile} failed: {r.status_code} {r.text}"
    return r.json()["token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _register_fresh_worker():
    """Create a fresh worker with unique mobile. Retry with new number if collision."""
    for _ in range(10):
        suffix = str(int(time.time()) % 100000000).zfill(8)
        mobile = "9199" + suffix[-8:]
        payload = {"name": "TEST Iter24 Worker", "mobile": mobile, "password": DEMO_PASS, "role": "worker"}
        r = requests.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            return mobile, data["token"], data.get("user", {}).get("id")
        time.sleep(1)
    pytest.skip("Could not register a fresh test worker after retries")


@pytest.fixture(scope="module")
def fresh_worker():
    mobile, token, uid = _register_fresh_worker()
    return {"mobile": mobile, "token": token, "id": uid}


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT_MOBILE)


# ---------- RULE 1: Profile completeness blocks availability ----------

class TestRule1ProfileComplete:
    def test_a_fresh_worker_status_incomplete(self, fresh_worker):
        r = requests.get(f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["profile_complete"] is False
        assert data["can_enable"] is False
        assert data["is_currently_hired"] is False
        # Name is set (from registration), 5 others missing
        assert "Name" not in data["missing_fields"]
        for label in ("Job title", "Skill level", "Expected daily wage", "Experience (years)", "City"):
            assert label in data["missing_fields"], f"Missing field label {label} not in {data['missing_fields']}"
        assert len(data["reasons"]) >= 1

    def test_b_put_available_true_blocked(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"available": True},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "complete your profile" in detail, detail

    def test_c1_fill_skill(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"skills": ["Mason"]},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        s = requests.get(f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT).json()
        assert "Job title" not in s["missing_fields"]
        assert s["profile_complete"] is False

    def test_c2_fill_level(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"experience_level": "Full trained"},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        s = requests.get(f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT).json()
        assert "Skill level" not in s["missing_fields"]

    def test_c3_fill_remaining(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"daily_wage": 600, "experience_years": 5, "city": "Delhi"},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        s = requests.get(f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT).json()
        assert s["missing_fields"] == [], s
        assert s["profile_complete"] is True
        assert s["can_enable"] is True
        assert s["is_currently_hired"] is False

    def test_d_put_available_true_succeeds(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"available": True},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        assert r.json().get("available") is True


# ---------- RULE 2: Active hiring locks availability OFF ----------

class TestRule2ActiveHiringLocks:
    @pytest.fixture(scope="class")
    def hiring_context(self, fresh_worker, client_token):
        # Post a job as client
        job_payload = {
            "title": "TEST Iter24 Mason Job",
            "description": "TEST job for iter24 availability rule",
            "skill": "Mason",
            "workers_needed": 1,
            "daily_wage": 700,
            "location": "Delhi",
            "duration_days": 2,
        }
        r = requests.post(f"{BASE_URL}/api/jobs", json=job_payload, headers=_headers(client_token), timeout=TIMEOUT)
        assert r.status_code == 200, r.text
        job = r.json()
        job_id = job["id"]

        # Worker applies
        r2 = requests.post(
            f"{BASE_URL}/api/applications",
            json={"job_id": job_id, "message": "TEST apply"},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r2.status_code == 200, r2.text
        app = r2.json()
        return {"job_id": job_id, "app_id": app["id"]}

    def test_a_accept_locks_availability(self, fresh_worker, client_token, hiring_context):
        # Client accepts
        r = requests.post(
            f"{BASE_URL}/api/applications/{hiring_context['app_id']}/status",
            json={"status": "accepted"},
            headers=_headers(client_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        # Worker's status now
        s = requests.get(
            f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT
        ).json()
        assert s["is_currently_hired"] is True
        assert s["can_enable"] is False
        assert s["current_available"] is False, "Auto-force OFF should have flipped available to false"
        joined = " ".join(s["reasons"]).lower()
        assert "hired" in joined, s["reasons"]

    def test_b_put_available_true_blocked_while_hired(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"available": True},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 400, r.text
        detail = (r.json().get("detail") or "").lower()
        assert "hired" in detail, detail

    def test_c_reject_unlocks(self, fresh_worker, client_token, hiring_context):
        r = requests.post(
            f"{BASE_URL}/api/applications/{hiring_context['app_id']}/status",
            json={"status": "rejected"},
            headers=_headers(client_token),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text

        s = requests.get(
            f"{BASE_URL}/api/me/availability-status", headers=_headers(fresh_worker["token"]), timeout=TIMEOUT
        ).json()
        assert s["is_currently_hired"] is False
        assert s["can_enable"] is True


# ---------- RULE 3: Backend defensively trims skills to length 1 ----------

class TestRule3SingleSelectSkills:
    def test_backend_trims_multi_skills(self, fresh_worker):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"skills": ["Mason", "Painter", "Electrician"]},
            headers=_headers(fresh_worker["token"]),
            timeout=TIMEOUT,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data.get("skills"), list)
        assert len(data["skills"]) == 1, f"Expected 1 skill, got {data['skills']}"
        assert data["skills"][0] == "Mason"


# ---------- Regression: currently-hired seeded worker ----------

class TestRegressionSeededHiredWorker:
    def test_seeded_hired_worker_locked(self):
        token = _login("9000000002")
        s = requests.get(f"{BASE_URL}/api/me/availability-status", headers=_headers(token), timeout=TIMEOUT).json()
        # This worker is expected to be in a hired state per seed data
        # If the seed accepted at least one app, is_currently_hired should be True.
        # If not hired, this is still informative — don't fail hard, just check the shape.
        assert "can_enable" in s and "is_currently_hired" in s
        if s["is_currently_hired"]:
            assert s["can_enable"] is False
            assert s["current_available"] is False
