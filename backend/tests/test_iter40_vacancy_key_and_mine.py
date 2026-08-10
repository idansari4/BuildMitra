"""
Iteration 40 — Phase 4 cleanup retest.

Focused tests:
1. GET /api/jobs/vacancies emits `vacancy_key` (string ~12 hex chars) and NO `slot_index`.
   slot_skill / slot_wage_type / slot_daily_wage / slot_hours / slot_total_wage
   remain populated for mixed-skill and hourly slots.
2. GET /api/jobs/mine enriches every job with numeric `accepted_count` and `remaining`.
   For a job with workers_needed=4 and no accepted apps → accepted_count=0, remaining=4.
"""
import os
import re
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[2] / "frontend" / ".env")
BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")


def _login(mobile: str, pw: str = "demo1234") -> dict:
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": mobile, "password": pw},
        timeout=15,
    )
    assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
    return r.json()


def _register_worker(name: str) -> dict:
    mobile = f"9932{uuid.uuid4().hex[:6]}"
    r = requests.post(
        f"{BASE_URL}/api/auth/register",
        json={"name": name, "mobile": mobile, "password": "demo1234", "role": "worker"},
        timeout=15,
    )
    assert r.status_code == 200, f"register {mobile} failed: {r.status_code} {r.text}"
    return r.json()


def _auth(tok: str) -> dict:
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


@pytest.fixture(scope="module")
def client_ctx():
    d = _login("9000000001")
    return d["token"], d["user"]


@pytest.fixture(scope="module")
def worker_ctx():
    # fresh worker for vacancies (avoid "already applied" filter noise)
    w = _register_worker("TEST_Iter40Worker")
    return w["token"], w["user"]


def _post_job(client_token: str, **overrides) -> dict:
    payload = {
        "title": f"TEST_Iter40 {uuid.uuid4().hex[:6]}",
        "description": "Iter40 cleanup retest",
        "skill": "Mason",
        "workers_needed": 1,
        "daily_wage": 500,
        "location": "Test City",
        "site_address": "TEST",
        "duration_days": 3,
        "urgency": "Normal",
        "working_start_date": "2026-02-15",
    }
    payload.update(overrides)
    r = requests.post(
        f"{BASE_URL}/api/jobs", json=payload, headers=_auth(client_token), timeout=15
    )
    assert r.status_code == 200, f"post_job failed: {r.status_code} {r.text}"
    return r.json()


# ---------------- 1. vacancy_key present, slot_index absent ----------------
class TestVacancyKeyReplacesSlotIndex:
    def test_vacancy_key_present_slot_index_absent_all_items(self, client_ctx, worker_ctx):
        c_token, _ = client_ctx
        w_token, _ = worker_ctx

        # Post a mixed-skill 4-slot job so we exercise per-slot metadata too
        job = _post_job(
            c_token,
            workers_needed=4,
            skill="Full Trained",
            skills_required=[
                {"skill": "Full Trained", "count": 2, "daily_wage": 900},
                {"skill": "Helper", "count": 2, "daily_wage": 500},
            ],
        )
        job_id = job["id"]

        r = requests.get(
            f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w_token), timeout=15
        )
        assert r.status_code == 200, r.text
        all_items = r.json()
        assert isinstance(all_items, list) and len(all_items) > 0

        # Global assertion — NO item anywhere should have slot_index
        for it in all_items:
            assert "slot_index" not in it, f"slot_index leaked: {it}"
            assert "vacancy_key" in it, f"missing vacancy_key: {it}"
            vk = it["vacancy_key"]
            assert isinstance(vk, str) and re.fullmatch(r"[0-9a-f]{12}", vk), (
                f"vacancy_key not 12-hex: {vk}"
            )
            assert "remaining" in it and isinstance(it["remaining"], int)
            assert "filled" in it and isinstance(it["filled"], int)

        # Mixed-skill job specifically → 4 items, each carrying slot_skill + slot_wage_type + slot_daily_wage
        mine = [i for i in all_items if i["id"] == job_id]
        assert len(mine) == 4, f"expected 4 mixed slots, got {len(mine)}"
        skills = sorted(m["slot_skill"] for m in mine)
        assert skills == ["Full Trained", "Full Trained", "Helper", "Helper"], skills
        for m in mine:
            assert m["slot_wage_type"] == "day"
            assert m["slot_daily_wage"] in (900, 500)
            # None of them expose slot_index
            assert "slot_index" not in m

        # vacancy_keys within same job must all be unique
        vks = [m["vacancy_key"] for m in mine]
        assert len(set(vks)) == len(vks), f"duplicate vacancy_keys: {vks}"

    def test_supervisor_slot_carries_hourly_metadata_with_vacancy_key(self, client_ctx):
        c_token, _ = client_ctx
        job = _post_job(
            c_token,
            workers_needed=1,
            skill="Site Supervisor",
            skills_required=[
                {
                    "skill": "Site Supervisor",
                    "count": 1,
                    "hours": 5,
                    "first_hour_rate": 500,
                    "additional_hour_rate": 250,
                    "total_wage": 1500,
                }
            ],
        )
        job_id = job["id"]

        w = _register_worker("TEST_Iter40Supv")
        r = requests.get(
            f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w["token"]), timeout=15
        )
        assert r.status_code == 200, r.text
        mine = [i for i in r.json() if i["id"] == job_id]
        assert len(mine) == 1
        m = mine[0]
        assert "slot_index" not in m
        assert re.fullmatch(r"[0-9a-f]{12}", m["vacancy_key"])
        assert m["slot_skill"] == "Site Supervisor"
        assert m["slot_wage_type"] == "hour"
        assert m["slot_hours"] == 5
        assert m["slot_total_wage"] == 1500


# ---------------- 2. /jobs/mine enrichment ----------------
class TestJobsMineEnrichment:
    def test_mine_returns_accepted_count_and_remaining(self, client_ctx):
        c_token, _ = client_ctx

        # Create a fresh 4-worker job so we have a deterministic baseline
        job = _post_job(c_token, workers_needed=4, daily_wage=500)
        job_id = job["id"]

        r = requests.get(
            f"{BASE_URL}/api/jobs/mine", headers=_auth(c_token), timeout=15
        )
        assert r.status_code == 200, r.text
        mine = r.json()
        assert isinstance(mine, list) and len(mine) > 0

        # Every job must carry numeric accepted_count + remaining
        for j in mine:
            assert "accepted_count" in j, f"missing accepted_count: {j.get('id')}"
            assert "remaining" in j, f"missing remaining: {j.get('id')}"
            assert isinstance(j["accepted_count"], int)
            assert isinstance(j["remaining"], int)
            assert j["accepted_count"] >= 0
            assert j["remaining"] >= 0
            needed = int(j.get("workers_needed") or 1)
            assert j["accepted_count"] + j["remaining"] <= needed + 0  # sanity

        # Our freshly-posted job → 0 accepted, 4 remaining
        target = next((j for j in mine if j["id"] == job_id), None)
        assert target is not None, "posted job missing from /jobs/mine"
        assert target["accepted_count"] == 0
        assert target["remaining"] == 4
        assert int(target["workers_needed"]) == 4


# ---------------- 3. Regression sanity ----------------
class TestRegression:
    def test_login_flow_intact(self):
        for m in ("9000000001", "9000000002", "9000000003"):
            d = _login(m)
            assert "token" in d and "user" in d and d["user"]["mobile"] == m

    def test_post_job_still_works(self, client_ctx):
        c_token, _ = client_ctx
        job = _post_job(c_token, workers_needed=2, daily_wage=600)
        assert job.get("id")
        assert int(job.get("workers_needed")) == 2

    def test_profile_me_endpoint(self, client_ctx):
        c_token, _ = client_ctx
        r = requests.get(f"{BASE_URL}/api/me", headers=_auth(c_token), timeout=15)
        assert r.status_code == 200, r.text
        me = r.json()
        assert me.get("mobile") == "9000000001"
        assert me.get("role") == "client"
