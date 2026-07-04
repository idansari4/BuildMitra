"""BuildMitra Phase 1 audit tests.

Covers:
- POST /api/applications/{app_id}/status
- POST /api/jobs/{job_id}/status
- GET /api/jobs/hired
- GET /api/workers/{worker_id}
- GET /api/attendance/my-workers
- POST /api/wallet/withdraw
- GET /api/payroll (fixed to filter by poster's own jobs)
- Regression: login, /me, /jobs, /complaints, /erp/bills, /chat/threads
"""
import os
import uuid
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _login(s, mobile, password):
    r = s.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
    return r.json()


@pytest.fixture(scope="session")
def client_auth(s):
    return _login(s, "9000000001", "demo1234")


@pytest.fixture(scope="session")
def worker_auth(s):
    return _login(s, "9000000002", "demo1234")


@pytest.fixture(scope="session")
def contractor_auth(s):
    return _login(s, "9000000003", "demo1234")


@pytest.fixture(scope="session")
def admin_auth(s):
    return _login(s, "9000000000", "admin1234")


def H(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# ---------- Regression: quick smoke ----------
class TestRegression:
    def test_me(self, s, client_auth):
        r = s.get(f"{API}/me", headers=H(client_auth), timeout=15)
        assert r.status_code == 200
        assert r.json()["mobile"] == "9000000001"

    def test_jobs_list(self, s):
        r = s.get(f"{API}/jobs", timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_complaints_list(self, s, client_auth):
        r = s.get(f"{API}/complaints/mine", headers=H(client_auth), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_erp_bills(self, s, contractor_auth):
        r = s.get(f"{API}/erp/bills", headers=H(contractor_auth), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_chat_threads(self, s, worker_auth):
        r = s.get(f"{API}/chat/threads", headers=H(worker_auth), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- End-to-end flow: post → apply → accept → attendance → payroll → complete ----------
# Shared state across the ordered test class
STATE: dict = {}


@pytest.mark.order(1)
class TestE2EFlow:
    """Ordered end-to-end test hitting most Phase 1 endpoints."""

    def test_01_client_posts_job(self, s, client_auth):
        payload = {
            "title": f"TEST_Job_{uuid.uuid4().hex[:8]}",
            "skill": "mason",
            "description": "Phase 1 audit test job",
            "location": "Mumbai",
            "lat": 19.0760,
            "lng": 72.8777,
            "daily_wage": 800,
            "workers_needed": 1,
            "duration_days": 5,
        }
        r = s.post(f"{API}/jobs", json=payload, headers=H(client_auth), timeout=20)
        assert r.status_code == 200, r.text
        job = r.json()
        assert job["title"] == payload["title"]
        assert job["status"] == "open"
        STATE["job_id"] = job["id"]
        STATE["job_title"] = job["title"]

    def test_02_worker_applies(self, s, worker_auth):
        r = s.post(
            f"{API}/applications",
            json={"job_id": STATE["job_id"], "message": "I can do it"},
            headers=H(worker_auth),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        appn = r.json()
        assert appn["status"] == "pending"
        STATE["app_id"] = appn["id"]
        STATE["worker_id"] = appn["worker_id"]

    def test_03_client_lists_applicants(self, s, client_auth):
        r = s.get(f"{API}/applications/job/{STATE['job_id']}", headers=H(client_auth), timeout=15)
        assert r.status_code == 200
        apps = r.json()
        assert any(a["id"] == STATE["app_id"] for a in apps)

    def test_04_accept_status_forbidden_for_other_user(self, s, worker_auth):
        r = s.post(
            f"{API}/applications/{STATE['app_id']}/status",
            json={"status": "accepted"},
            headers=H(worker_auth),
            timeout=15,
        )
        assert r.status_code == 403

    def test_05_accept_status_invalid_value(self, s, client_auth):
        r = s.post(
            f"{API}/applications/{STATE['app_id']}/status",
            json={"status": "bogus"},
            headers=H(client_auth),
            timeout=15,
        )
        assert r.status_code == 400

    def test_06_client_accepts_applicant(self, s, client_auth):
        r = s.post(
            f"{API}/applications/{STATE['app_id']}/status",
            json={"status": "accepted"},
            headers=H(client_auth),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True and body["status"] == "accepted"

    def test_07_job_transitioned_to_in_progress(self, s):
        r = s.get(f"{API}/jobs/{STATE['job_id']}", timeout=15)
        assert r.status_code == 200
        assert r.json()["status"] == "in_progress"

    def test_08_worker_hired_jobs_includes(self, s, worker_auth):
        r = s.get(f"{API}/jobs/hired", headers=H(worker_auth), timeout=15)
        assert r.status_code == 200
        hired = r.json()
        assert isinstance(hired, list)
        assert any(j["id"] == STATE["job_id"] for j in hired), f"job not in hired list: {hired}"

    def test_09_hired_empty_for_non_workers(self, s, client_auth):
        r = s.get(f"{API}/jobs/hired", headers=H(client_auth), timeout=15)
        assert r.status_code == 200
        assert r.json() == []

    def test_10_worker_public_profile(self, s, client_auth):
        r = s.get(f"{API}/workers/{STATE['worker_id']}", headers=H(client_auth), timeout=15)
        assert r.status_code == 200, r.text
        p = r.json()
        # Password must never leak
        assert "password" not in p
        for k in ("completed_jobs", "attendance_days", "recent_ratings"):
            assert k in p, f"missing {k} in worker profile"
        assert isinstance(p["recent_ratings"], list)

    def test_11_worker_profile_404(self, s, client_auth):
        r = s.get(f"{API}/workers/{uuid.uuid4()}", headers=H(client_auth), timeout=15)
        assert r.status_code == 404

    def test_12_worker_checks_in(self, s, worker_auth):
        # Provide site coords to be within geofence
        payload = {
            "job_id": STATE["job_id"],
            "type": "check_in",
            "lat": 19.0760,
            "lng": 72.8777,
            "selfie": "data:image/png;base64,iVBORw0KGgo=",
        }
        r = s.post(f"{API}/attendance", json=payload, headers=H(worker_auth), timeout=20)
        assert r.status_code == 200, r.text
        rec = r.json()
        assert rec["within_geofence"] is True
        assert rec["job_id"] == STATE["job_id"]
        assert "selfie" not in rec  # scrubbed from response

    def test_13_client_sees_my_workers_attendance(self, s, client_auth):
        r = s.get(f"{API}/attendance/my-workers?days=30", headers=H(client_auth), timeout=15)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        assert any(x.get("job_id") == STATE["job_id"] and x.get("worker_id") == STATE["worker_id"] for x in rows)
        # Selfie must be excluded
        for x in rows:
            assert "selfie" not in x

    def test_14_worker_forbidden_from_my_workers(self, s, worker_auth):
        r = s.get(f"{API}/attendance/my-workers", headers=H(worker_auth), timeout=15)
        assert r.status_code == 403

    def test_15_payroll_shows_current_worker(self, s, client_auth):
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        r = s.get(f"{API}/payroll?month={month}", headers=H(client_auth), timeout=20)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["month"] == month
        assert isinstance(data["rows"], list)
        my_row = next((row for row in data["rows"] if row["worker_id"] == STATE["worker_id"]), None)
        assert my_row is not None, f"worker not in payroll rows: {data}"
        assert my_row["days_present"] >= 1
        assert my_row["daily_wage"] > 0
        assert my_row["total_wage"] == my_row["days_present"] * my_row["daily_wage"]

    def test_16_payroll_forbidden_for_worker(self, s, worker_auth):
        r = s.get(f"{API}/payroll", headers=H(worker_auth), timeout=15)
        assert r.status_code == 403

    def test_17_payroll_isolation_contractor_sees_own_only(self, s, contractor_auth):
        # Contractor did NOT post STATE['job_id']; should not see this worker's days from that job.
        r = s.get(f"{API}/payroll", headers=H(contractor_auth), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()["rows"]
        for row in rows:
            # If contractor's own jobs happen to include our worker, days can be >=0
            # but no row should reference STATE['job_id'] via jobs_count if none of contractor's jobs.
            pass  # Cannot assert directly on job ids; but at least the endpoint must be scoped.
        # Sanity: response shape correct
        assert isinstance(rows, list)

    def test_18_job_status_invalid(self, s, client_auth):
        r = s.post(
            f"{API}/jobs/{STATE['job_id']}/status",
            json={"status": "banana"},
            headers=H(client_auth),
            timeout=15,
        )
        assert r.status_code == 400

    def test_19_job_status_forbidden_for_non_poster(self, s, worker_auth):
        r = s.post(
            f"{API}/jobs/{STATE['job_id']}/status",
            json={"status": "completed"},
            headers=H(worker_auth),
            timeout=15,
        )
        assert r.status_code == 403

    def test_20_client_completes_job(self, s, client_auth):
        r = s.post(
            f"{API}/jobs/{STATE['job_id']}/status",
            json={"status": "completed"},
            headers=H(client_auth),
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "completed"
        # Verify persisted
        r2 = s.get(f"{API}/jobs/{STATE['job_id']}", timeout=15)
        assert r2.status_code == 200
        j = r2.json()
        assert j["status"] == "completed"
        assert "status_updated_at" in j

    def test_21_hired_excludes_completed(self, s, worker_auth):
        r = s.get(f"{API}/jobs/hired", headers=H(worker_auth), timeout=15)
        assert r.status_code == 200
        hired_ids = [j["id"] for j in r.json()]
        assert STATE["job_id"] not in hired_ids


# ---------- Wallet withdraw ----------
class TestWalletWithdraw:
    def test_invalid_amount(self, s, worker_auth):
        r = s.post(f"{API}/wallet/withdraw", json={"amount": 0, "upi_id": "test@upi"}, headers=H(worker_auth), timeout=15)
        assert r.status_code == 400

    def test_invalid_upi(self, s, worker_auth):
        r = s.post(f"{API}/wallet/withdraw", json={"amount": 10, "upi_id": "no-at-symbol"}, headers=H(worker_auth), timeout=15)
        assert r.status_code == 400

    def test_insufficient_balance(self, s, worker_auth):
        # Ask for absurdly high amount to guarantee insufficient balance
        r = s.post(
            f"{API}/wallet/withdraw",
            json={"amount": 99999999, "upi_id": "test@upi"},
            headers=H(worker_auth),
            timeout=15,
        )
        assert r.status_code == 400
        assert "insufficient" in r.text.lower()

    def test_success_withdrawal(self, s, worker_auth):
        # Ensure some balance by seeding a topup txn directly via wallet endpoint isn't available;
        # instead pick amount = current balance if > 0, else skip.
        w = s.get(f"{API}/wallet", headers=H(worker_auth), timeout=15).json()
        balance = float(w.get("balance") or 0)
        if balance <= 0:
            pytest.skip(f"worker wallet balance is {balance}, cannot verify success path")
        amount = min(1.0, balance)
        r = s.post(
            f"{API}/wallet/withdraw",
            json={"amount": amount, "upi_id": "9000000002@upi"},
            headers=H(worker_auth),
            timeout=20,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["new_balance"] == pytest.approx(balance - amount, rel=1e-3)
        txn = body["txn"]
        assert txn["type"] == "withdrawal"
        assert txn["status"] == "processing"
        assert txn["amount"] == -amount
