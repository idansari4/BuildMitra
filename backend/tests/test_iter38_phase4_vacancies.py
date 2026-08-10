"""
Iteration 38 — Phase 4 tests: Worker Home Vacancy System

Covers:
  1. Vacancy expansion (workers_needed=4 → 4 items each with slot_index)
  2. Already-applied workers filtered from vacancies list
  3. Overbooking prevention (POST /applications/{id}/status)
  4. GET /jobs/{id} enrichment (accepted_count, remaining)
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


def _login(mobile: str, pw: str = "demo1234") -> dict:
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"mobile": mobile, "password": pw}, timeout=15)
    assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
    return r.json()


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_ctx():
    d = _login("9000000001")
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def worker_ctx():
    d = _login("9000000002")
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def contractor_ctx():
    d = _login("9000000003")
    return d["token"], d["user"]


def _post_job(client_token: str, **overrides) -> dict:
    payload = {
        "title": f"TEST_Vacancy {uuid.uuid4().hex[:6]}",
        "description": "Phase-4 vacancy test job",
        "skill": "Mason",
        "workers_needed": 4,
        "daily_wage": 900,
        "location": "Test City",
        "site_address": "TEST",
        "duration_days": 5,
        "urgency": "Normal",
        "working_start_date": "2026-02-01",
    }
    payload.update(overrides)
    r = requests.post(f"{BASE_URL}/api/jobs", json=payload, headers=_auth(client_token), timeout=15)
    assert r.status_code == 200, f"post_job failed: {r.status_code} {r.text}"
    return r.json()


# ---------------- 1. Vacancy expansion ----------------
class TestVacancyExpansion:
    def test_vacancy_expands_to_four_slots_and_filters_after_apply(self, client_ctx, worker_ctx):
        c_token, _ = client_ctx
        w_token, worker = worker_ctx

        job = _post_job(
            c_token,
            workers_needed=4,
            skill="Mason",
            skills_required=[
                {"skill": "Full Trained", "count": 2, "daily_wage": 900},
                {"skill": "Helper", "count": 2, "daily_wage": 500},
            ],
        )
        job_id = job["id"]

        # Worker fetches vacancies — expect 4 items for this job
        r = requests.get(f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w_token), timeout=15)
        assert r.status_code == 200, r.text
        items = r.json()
        mine = [i for i in items if i["id"] == job_id]
        assert len(mine) == 4, f"expected 4 slots for job, got {len(mine)}"

        slot_indexes = sorted(int(i["slot_index"]) for i in mine)
        assert slot_indexes == [1, 2, 3, 4], slot_indexes
        for it in mine:
            assert it["remaining"] == 4
            assert it["filled"] == 0

        # Worker applies once — backend rejects duplicates
        ar = requests.post(
            f"{BASE_URL}/api/applications",
            json={"job_id": job_id, "message": ""},
            headers=_auth(w_token),
            timeout=15,
        )
        assert ar.status_code == 200, ar.text

        # Re-fetch vacancies → job should no longer appear
        r2 = requests.get(f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w_token), timeout=15)
        assert r2.status_code == 200
        mine2 = [i for i in r2.json() if i["id"] == job_id]
        assert len(mine2) == 0, f"worker who applied still sees {len(mine2)} slots"


# ---------------- 2. Overbooking prevention ----------------
class TestOverbookingPrevention:
    def test_second_accept_blocked_when_vacancies_full(
        self, client_ctx, worker_ctx, contractor_ctx
    ):
        c_token, _ = client_ctx
        w1_token, worker1 = worker_ctx
        # Register a fresh disposable second worker (contractor login is a contractor, not worker)
        w2_mobile = f"9911{uuid.uuid4().hex[:6]}"
        rr = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "name": "TEST_Worker2",
                "mobile": w2_mobile,
                "password": "demo1234",
                "role": "worker",
            },
            timeout=15,
        )
        assert rr.status_code == 200, rr.text
        w2 = rr.json()
        w2_token = w2["token"]
        w2_id = w2["user"]["id"]

        job = _post_job(c_token, workers_needed=1, skill="Helper", daily_wage=500)
        job_id = job["id"]

        # Both workers apply
        for tok in (w1_token, w2_token):
            ar = requests.post(
                f"{BASE_URL}/api/applications",
                json={"job_id": job_id, "message": ""},
                headers=_auth(tok),
                timeout=15,
            )
            assert ar.status_code == 200, f"apply failed: {ar.status_code} {ar.text}"

        # Fetch applicants list as poster
        apps_r = requests.get(
            f"{BASE_URL}/api/applications/job/{job_id}", headers=_auth(c_token), timeout=15
        )
        assert apps_r.status_code == 200, apps_r.text
        apps = apps_r.json()
        assert len(apps) == 2, apps

        # Accept the first one → 200
        first_accept = requests.post(
            f"{BASE_URL}/api/applications/{apps[0]['id']}/status",
            json={"status": "accepted"},
            headers=_auth(c_token),
            timeout=15,
        )
        assert first_accept.status_code == 200, first_accept.text

        # Attempt to accept the second → 400 with "vacancies … filled"
        second_accept = requests.post(
            f"{BASE_URL}/api/applications/{apps[1]['id']}/status",
            json={"status": "accepted"},
            headers=_auth(c_token),
            timeout=15,
        )
        assert second_accept.status_code == 400, (
            f"expected 400, got {second_accept.status_code}: {second_accept.text}"
        )
        detail = second_accept.json().get("detail", "")
        assert "vacancies" in detail.lower() and "filled" in detail.lower(), detail

        # GET /jobs/{id} → accepted_count=1, remaining=0
        jr = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15)
        assert jr.status_code == 200, jr.text
        jj = jr.json()
        assert jj.get("accepted_count") == 1, jj
        assert jj.get("remaining") == 0, jj

        # GET /jobs/vacancies as a *third-party* worker → job must NOT appear
        # (w1 & w2 already applied; register a new worker to check fair filter)
        w3_mobile = f"9922{uuid.uuid4().hex[:6]}"
        rr3 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"name": "TEST_Worker3", "mobile": w3_mobile, "password": "demo1234", "role": "worker"},
            timeout=15,
        )
        assert rr3.status_code == 200
        w3_token = rr3.json()["token"]
        vac = requests.get(f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w3_token), timeout=15)
        assert vac.status_code == 200
        assert not any(i["id"] == job_id for i in vac.json()), "filled job leaked into vacancies"

        # Cleanup — try to remove test users we created
        try:
            import os as _os
            # Not exposing admin cleanup here; leave TEST_ prefix for identification
        except Exception:
            pass


# ---------------- 3. /api/jobs/{id} enrichment ----------------
class TestJobEnrichment:
    def test_job_response_has_accepted_count_and_remaining(self, client_ctx):
        c_token, _ = client_ctx
        job = _post_job(c_token, workers_needed=3, skill="Painter", daily_wage=700)
        r = requests.get(f"{BASE_URL}/api/jobs/{job['id']}", timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert "accepted_count" in j and isinstance(j["accepted_count"], int)
        assert "remaining" in j and isinstance(j["remaining"], int)
        assert j["accepted_count"] == 0
        assert j["remaining"] == 3
