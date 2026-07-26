"""Iteration 18: Attendance module role-based endpoints regression."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "https://buildmitra.preview.emergentagent.com"
API = BASE_URL + "/api"

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


@pytest.fixture(scope="module")
def worker_token():
    return _login(WORKER)


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def contractor_token():
    return _login(CONTRACTOR)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


# ---------- Worker endpoints ----------
class TestWorkerAttendance:
    def test_worker_my_attendance(self, worker_token):
        r = requests.get(f"{API}/attendance/mine", headers=_h(worker_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list), f"expected list, got {type(data)}"
        if data:
            row = data[0]
            for k in ("id", "type", "created_at"):
                assert k in row, f"missing {k} in {row}"

    def test_salary_summary_worker(self, worker_token):
        r = requests.get(f"{API}/salary/summary?months=3", headers=_h(worker_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        for k in ("rows", "current_wage", "total_earned", "wallet_balance"):
            assert k in j, f"missing key {k} in salary summary: {j.keys()}"
        assert isinstance(j["rows"], list)
        for row in j["rows"]:
            for k in ("month", "days_present", "jobs_count", "daily_wage", "earned"):
                assert k in row, f"missing {k} in salary row {row}"
            assert isinstance(row["days_present"], int)
            assert isinstance(row["jobs_count"], int)


# ---------- 403 role guard tests ----------
class TestRoleGuards:
    def test_salary_summary_client_403(self, client_token):
        r = requests.get(f"{API}/salary/summary", headers=_h(client_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_salary_summary_admin_403(self, admin_token):
        r = requests.get(f"{API}/salary/summary", headers=_h(admin_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_my_workers_worker_403(self, worker_token):
        r = requests.get(f"{API}/attendance/my-workers?days=1", headers=_h(worker_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"

    def test_admin_attendance_worker_403(self, worker_token):
        r = requests.get(f"{API}/admin/attendance", headers=_h(worker_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


# ---------- Client/Contractor monitor endpoint ----------
class TestMonitorEndpoint:
    def test_my_workers_client(self, client_token):
        r = requests.get(f"{API}/attendance/my-workers?days=1", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_my_workers_client_7d(self, client_token):
        r = requests.get(f"{API}/attendance/my-workers?days=7", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_my_workers_client_30d(self, client_token):
        r = requests.get(f"{API}/attendance/my-workers?days=30", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_my_workers_contractor(self, contractor_token):
        r = requests.get(f"{API}/attendance/my-workers?days=7", headers=_h(contractor_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------- Admin endpoint ----------
class TestAdminAttendance:
    def test_admin_attendance(self, admin_token):
        r = requests.get(f"{API}/admin/attendance", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            # Should have worker context for monitoring
            assert "id" in row
            assert "type" in row
            assert "created_at" in row


# ---------- Unauthenticated ----------
class TestUnauthed:
    def test_no_token_401(self):
        r = requests.get(f"{API}/attendance/mine", timeout=15)
        assert r.status_code in (401, 403), r.status_code
