"""
Iteration 39 — Retest of Phase 4 per-slot wage refinement.

Covers:
  1. Mixed-skill job (Full Trained x2 @900 + Helper x2 @500) → 4 items,
     each carrying slot_skill / slot_daily_wage / slot_wage_type='day'.
  2. Supervisor-only vacancy (Site Supervisor x1, hourly) → 1 item with
     slot_wage_type='hour', slot_hours, slot_total_wage.
  3. After accepting one Full Trained applicant, per-slot mapping shifts
     so remaining slots are Full Trained x1 + Helper x2.
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
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": mobile, "password": pw},
        timeout=15,
    )
    assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
    return r.json()


def _register_worker(name: str) -> dict:
    mobile = f"9931{uuid.uuid4().hex[:6]}"
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


def _post_job(client_token: str, **overrides) -> dict:
    payload = {
        "title": f"TEST_SlotWage {uuid.uuid4().hex[:6]}",
        "description": "Iter39 per-slot wage refinement",
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


# ---------------- 1. Mixed-skill expansion ----------------
class TestMixedSkillExpansion:
    def test_four_slots_carry_per_slot_skill_and_wage(self, client_ctx):
        c_token, _ = client_ctx

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

        # Use a *new* worker to avoid the "already applied" filter
        w = _register_worker("TEST_MixedWorker")
        w_token = w["token"]

        r = requests.get(
            f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w_token), timeout=15
        )
        assert r.status_code == 200, r.text
        mine = [i for i in r.json() if i["id"] == job_id]
        assert len(mine) == 4, f"expected 4 slots, got {len(mine)}"

        mine_sorted = sorted(mine, key=lambda x: int(x["slot_index"]))
        assert [int(m["slot_index"]) for m in mine_sorted] == [1, 2, 3, 4]

        # slot 1 & 2 → Full Trained @ ₹900/day
        for m in mine_sorted[:2]:
            assert m.get("slot_skill") == "Full Trained", m
            assert m.get("slot_wage_type") == "day", m
            assert m.get("slot_daily_wage") == 900, m

        # slot 3 & 4 → Helper @ ₹500/day
        for m in mine_sorted[2:]:
            assert m.get("slot_skill") == "Helper", m
            assert m.get("slot_wage_type") == "day", m
            assert m.get("slot_daily_wage") == 500, m


# ---------------- 2. Supervisor-only hourly ----------------
class TestSupervisorHourly:
    def test_supervisor_slot_carries_hourly_metadata(self, client_ctx):
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

        w = _register_worker("TEST_SupvWorker")
        r = requests.get(
            f"{BASE_URL}/api/jobs/vacancies", headers=_auth(w["token"]), timeout=15
        )
        assert r.status_code == 200, r.text
        mine = [i for i in r.json() if i["id"] == job_id]
        assert len(mine) == 1, f"expected 1 supervisor slot, got {len(mine)}"

        m = mine[0]
        assert m.get("slot_skill") == "Site Supervisor", m
        assert m.get("slot_wage_type") == "hour", m
        assert m.get("slot_hours") == 5, m
        assert m.get("slot_total_wage") == 1500, m


# ---------------- 3. Mapping shifts after acceptance ----------------
class TestSlotShiftAfterAcceptance:
    def test_remaining_slots_shift_after_one_full_trained_accepted(self, client_ctx):
        c_token, _ = client_ctx

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

        # applicant worker applies then gets accepted
        appl = _register_worker("TEST_ShiftApplicant")
        ar = requests.post(
            f"{BASE_URL}/api/applications",
            json={"job_id": job_id, "message": ""},
            headers=_auth(appl["token"]),
            timeout=15,
        )
        assert ar.status_code == 200, ar.text

        # client fetches applicants and accepts the first
        apps = requests.get(
            f"{BASE_URL}/api/applications/job/{job_id}",
            headers=_auth(c_token),
            timeout=15,
        ).json()
        assert len(apps) == 1, apps
        acc = requests.post(
            f"{BASE_URL}/api/applications/{apps[0]['id']}/status",
            json={"status": "accepted"},
            headers=_auth(c_token),
            timeout=15,
        )
        assert acc.status_code == 200, acc.text

        # A fresh worker views vacancies → 3 items, mapping shifted
        fresh = _register_worker("TEST_ShiftViewer")
        r = requests.get(
            f"{BASE_URL}/api/jobs/vacancies",
            headers=_auth(fresh["token"]),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        mine = sorted(
            [i for i in r.json() if i["id"] == job_id],
            key=lambda x: int(x["slot_index"]),
        )
        assert len(mine) == 3, f"expected 3 remaining slots, got {len(mine)}"

        # filled=1 remaining=3 on every item
        for m in mine:
            assert m.get("filled") == 1, m
            assert m.get("remaining") == 3, m

        # slot 1 → remaining Full Trained @ 900
        assert mine[0].get("slot_skill") == "Full Trained", mine[0]
        assert mine[0].get("slot_daily_wage") == 900, mine[0]
        assert mine[0].get("slot_wage_type") == "day", mine[0]
        # slots 2 & 3 → Helper @ 500
        for m in mine[1:]:
            assert m.get("slot_skill") == "Helper", m
            assert m.get("slot_daily_wage") == 500, m
            assert m.get("slot_wage_type") == "day", m

        # GET /jobs/{id} enrichment must also mirror this
        jr = requests.get(f"{BASE_URL}/api/jobs/{job_id}", timeout=15).json()
        assert jr.get("accepted_count") == 1, jr
        assert jr.get("remaining") == 3, jr
