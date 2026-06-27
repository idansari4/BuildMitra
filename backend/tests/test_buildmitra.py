"""BuildMitra backend tests."""
import os
import uuid
import pytest
import requests

BASE_URL = "https://buildmitra.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def worker_auth(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def client_auth(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000001", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def contractor_auth(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000003", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()


def hdr(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# --- Auth ---
class TestAuth:
    def test_login_worker(self, worker_auth):
        assert "token" in worker_auth and worker_auth["user"]["role"] == "worker"
        assert worker_auth["user"]["mobile"] == "9000000002"

    def test_login_invalid(self, session):
        r = session.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "wrong"})
        assert r.status_code == 401

    def test_register_and_me(self, session):
        mobile = f"99{uuid.uuid4().int % 100000000:08d}"
        r = session.post(f"{API}/auth/register", json={
            "name": "TEST_User", "mobile": mobile, "password": "test1234", "role": "worker"
        })
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        me = session.get(f"{API}/me", headers={"Authorization": f"Bearer {data['token']}"})
        assert me.status_code == 200 and me.json()["mobile"] == mobile

    def test_me_no_token(self, session):
        r = session.get(f"{API}/me")
        assert r.status_code == 401


# --- Jobs ---
class TestJobs:
    def test_list_jobs_seeded(self, session):
        r = session.get(f"{API}/jobs")
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list) and len(jobs) >= 8
        assert all("title" in j and "skill" in j for j in jobs)

    def test_list_jobs_filter_skill(self, session):
        r = session.get(f"{API}/jobs", params={"skill": "Mason"})
        assert r.status_code == 200
        assert all(j["skill"] == "Mason" for j in r.json())

    def test_post_job_client(self, session, client_auth):
        payload = {
            "title": "TEST_Mason job", "description": "TEST", "skill": "Mason",
            "workers_needed": 2, "daily_wage": 900, "location": "Mumbai",
            "duration_days": 5, "urgency": "Normal"
        }
        r = session.post(f"{API}/jobs", json=payload, headers=hdr(client_auth))
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["title"] == "TEST_Mason job" and job["posted_by"] == client_auth["user"]["id"]
        # verify persistence via GET
        g = session.get(f"{API}/jobs/{job['id']}")
        assert g.status_code == 200 and g.json()["title"] == "TEST_Mason job"

    def test_post_job_worker_forbidden(self, session, worker_auth):
        payload = {"title": "x", "description": "y", "skill": "Mason",
                   "workers_needed": 1, "daily_wage": 500, "location": "Mumbai"}
        r = session.post(f"{API}/jobs", json=payload, headers=hdr(worker_auth))
        assert r.status_code == 403


# --- Applications ---
class TestApplications:
    def test_apply_and_list(self, session, worker_auth, client_auth):
        # Create a fresh job
        job_payload = {
            "title": f"TEST_apply_{uuid.uuid4().hex[:6]}", "description": "t", "skill": "Helper",
            "workers_needed": 1, "daily_wage": 500, "location": "Mumbai", "duration_days": 1
        }
        jr = session.post(f"{API}/jobs", json=job_payload, headers=hdr(client_auth))
        assert jr.status_code == 200
        job_id = jr.json()["id"]

        # Apply
        ar = session.post(f"{API}/applications", json={"job_id": job_id, "message": "I can do it"},
                          headers=hdr(worker_auth))
        assert ar.status_code == 200, ar.text
        assert ar.json()["job_id"] == job_id

        # Duplicate apply -> 400
        ar2 = session.post(f"{API}/applications", json={"job_id": job_id},
                           headers=hdr(worker_auth))
        assert ar2.status_code == 400

        # My applications contains it
        mine = session.get(f"{API}/applications/mine", headers=hdr(worker_auth))
        assert mine.status_code == 200
        assert any(a["job_id"] == job_id for a in mine.json())


# --- Attendance ---
class TestAttendance:
    def test_attendance_create(self, session, worker_auth, client_auth):
        # Need a job_id
        jobs = session.get(f"{API}/jobs").json()
        job_id = jobs[0]["id"]
        payload = {
            "job_id": job_id, "type": "check_in",
            "lat": 19.0760, "lng": 72.8777,
            "selfie": "data:image/jpeg;base64,/9j/4AAQ"
        }
        r = session.post(f"{API}/attendance", json=payload, headers=hdr(worker_auth))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["face_verified"] is True and d["job_id"] == job_id
        assert "selfie" not in d  # stripped from response


# --- Wallet ---
class TestWallet:
    def test_wallet_worker(self, session, worker_auth):
        r = session.get(f"{API}/wallet", headers=hdr(worker_auth))
        assert r.status_code == 200
        d = r.json()
        assert "balance" in d and "referral_code" in d and "transactions" in d
        assert isinstance(d["transactions"], list)


# --- AI Match ---
class TestAIMatch:
    def test_ai_match_worker(self, session, worker_auth):
        r = session.post(f"{API}/ai/match-jobs", headers=hdr(worker_auth), json={})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "summary" in d and "top_job_ids" in d
        assert isinstance(d["top_job_ids"], list) and len(d["top_job_ids"]) >= 1

    def test_ai_match_client_forbidden(self, session, client_auth):
        r = session.post(f"{API}/ai/match-jobs", headers=hdr(client_auth), json={})
        assert r.status_code == 403
