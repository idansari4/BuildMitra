"""BuildMitra Admin Panel backend tests (iteration 2)."""
import uuid
import pytest
import requests

BASE_URL = "https://buildmitra.preview.emergentagent.com"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, mobile, pw):
    r = session.post(f"{API}/auth/login", json={"mobile": mobile, "password": pw})
    return r


@pytest.fixture(scope="module")
def admin_auth(session):
    r = _login(session, "9000000000", "admin1234")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def worker_auth(session):
    r = _login(session, "9000000002", "demo1234")
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="module")
def client_auth(session):
    r = _login(session, "9000000001", "demo1234")
    assert r.status_code == 200, r.text
    return r.json()


def hdr(auth):
    return {"Authorization": f"Bearer {auth['token']}", "Content-Type": "application/json"}


# --- Admin auth & basic role checks ---
class TestAdminAuth:
    def test_admin_login_role_and_token(self, admin_auth):
        assert admin_auth["user"]["role"] == "admin"
        assert admin_auth["user"]["mobile"] == "9000000000"
        assert "token" in admin_auth and len(admin_auth["token"]) > 20
        assert "password" not in admin_auth["user"]


# --- Stats ---
class TestAdminStats:
    def test_stats_keys_and_types(self, session, admin_auth):
        r = session.get(f"{API}/admin/stats", headers=hdr(admin_auth))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in [
            "total_workers", "total_contractors", "total_clients",
            "total_jobs", "active_jobs", "completed_jobs",
            "total_applications", "daily_attendance", "open_complaints",
            "pending_verifications", "wallet_payouts",
        ]:
            assert k in d, f"missing key {k}"
            assert isinstance(d[k], (int, float)), f"{k} should be number"
        # Seeded baseline
        assert d["total_workers"] >= 1
        assert d["total_contractors"] >= 1
        assert d["total_clients"] >= 1
        assert d["total_jobs"] >= 8

    def test_stats_non_admin_forbidden(self, session, worker_auth):
        r = session.get(f"{API}/admin/stats", headers=hdr(worker_auth))
        assert r.status_code == 403

    def test_stats_no_token(self, session):
        r = session.get(f"{API}/admin/stats")
        assert r.status_code == 401


# --- Users listing & filter ---
class TestAdminUsers:
    def test_list_all_users(self, session, admin_auth):
        r = session.get(f"{API}/admin/users", headers=hdr(admin_auth))
        assert r.status_code == 200
        users = r.json()
        assert isinstance(users, list) and len(users) >= 4
        # password must be excluded
        assert all("password" not in u for u in users)

    def test_filter_by_role_worker(self, session, admin_auth):
        r = session.get(f"{API}/admin/users", headers=hdr(admin_auth), params={"role": "worker"})
        assert r.status_code == 200
        users = r.json()
        assert len(users) >= 1
        assert all(u["role"] == "worker" for u in users)

    def test_search_by_mobile(self, session, admin_auth):
        r = session.get(f"{API}/admin/users", headers=hdr(admin_auth), params={"q": "9000000002"})
        assert r.status_code == 200
        users = r.json()
        assert any(u["mobile"] == "9000000002" for u in users)

    def test_users_non_admin_forbidden(self, session, client_auth):
        r = session.get(f"{API}/admin/users", headers=hdr(client_auth))
        assert r.status_code == 403


# --- Verify / Suspend / Unsuspend flow ---
class TestAdminUserActions:
    @pytest.fixture(scope="class")
    def temp_user(self, session):
        """Register a TEST_ user we can verify/suspend without affecting demo data."""
        mobile = f"99{uuid.uuid4().int % 100000000:08d}"
        r = session.post(f"{API}/auth/register", json={
            "name": f"TEST_AdminTarget_{mobile[-4:]}",
            "mobile": mobile,
            "password": "test1234",
            "role": "worker",
        })
        assert r.status_code == 200, r.text
        return {"id": r.json()["user"]["id"], "mobile": mobile, "password": "test1234",
                "token": r.json()["token"]}

    def test_verify_user(self, session, admin_auth, temp_user):
        r = session.post(f"{API}/admin/users/{temp_user['id']}/verify", headers=hdr(admin_auth))
        assert r.status_code == 200
        assert r.json().get("ok") is True
        # Check via admin users list
        ul = session.get(f"{API}/admin/users", headers=hdr(admin_auth),
                         params={"q": temp_user["mobile"]}).json()
        assert any(u["id"] == temp_user["id"] and u["aadhaar_verified"] is True for u in ul)

    def test_suspend_and_login_blocked(self, session, admin_auth, temp_user):
        r = session.post(f"{API}/admin/users/{temp_user['id']}/suspend", headers=hdr(admin_auth))
        assert r.status_code == 200
        # suspended user gets 403 on login
        lr = _login(session, temp_user["mobile"], temp_user["password"])
        assert lr.status_code == 403, f"expected 403, got {lr.status_code}: {lr.text}"

    def test_unsuspend_and_login_works(self, session, admin_auth, temp_user):
        r = session.post(f"{API}/admin/users/{temp_user['id']}/unsuspend", headers=hdr(admin_auth))
        assert r.status_code == 200
        lr = _login(session, temp_user["mobile"], temp_user["password"])
        assert lr.status_code == 200, lr.text

    def test_verify_unknown_404(self, session, admin_auth):
        r = session.post(f"{API}/admin/users/nonexistent-id/verify", headers=hdr(admin_auth))
        assert r.status_code == 404

    def test_suspend_by_non_admin_forbidden(self, session, worker_auth, temp_user):
        r = session.post(f"{API}/admin/users/{temp_user['id']}/suspend", headers=hdr(worker_auth))
        assert r.status_code == 403


# --- Jobs admin ---
class TestAdminJobs:
    def test_list_all_jobs(self, session, admin_auth):
        r = session.get(f"{API}/admin/jobs", headers=hdr(admin_auth))
        assert r.status_code == 200
        jobs = r.json()
        assert isinstance(jobs, list) and len(jobs) >= 8

    def test_close_job(self, session, admin_auth, client_auth):
        # create a fresh job to close
        payload = {
            "title": f"TEST_close_{uuid.uuid4().hex[:6]}", "description": "t", "skill": "Helper",
            "workers_needed": 1, "daily_wage": 500, "location": "Mumbai", "duration_days": 1
        }
        jr = session.post(f"{API}/jobs", json=payload, headers=hdr(client_auth))
        assert jr.status_code == 200
        jid = jr.json()["id"]
        # close as admin
        cr = session.post(f"{API}/admin/jobs/{jid}/close", headers=hdr(admin_auth))
        assert cr.status_code == 200
        # verify status persisted
        g = session.get(f"{API}/jobs/{jid}").json()
        assert g["status"] == "closed"

    def test_close_unknown_404(self, session, admin_auth):
        r = session.post(f"{API}/admin/jobs/nonexistent/close", headers=hdr(admin_auth))
        assert r.status_code == 404

    def test_jobs_non_admin_forbidden(self, session, worker_auth):
        r = session.get(f"{API}/admin/jobs", headers=hdr(worker_auth))
        assert r.status_code == 403


# --- Complaints admin ---
class TestAdminComplaints:
    def test_list_open_complaints_has_seed(self, session, admin_auth):
        r = session.get(f"{API}/admin/complaints", headers=hdr(admin_auth), params={"status": "open"})
        assert r.status_code == 200
        items = r.json()
        # 2 demo complaints seeded
        assert len(items) >= 2, f"expected >=2 open complaints, got {len(items)}"
        assert all(c["status"] == "open" for c in items)

    def test_resolve_complaint(self, session, admin_auth, worker_auth):
        # File a fresh complaint
        fc = session.post(f"{API}/complaints",
                          json={"subject": "TEST_resolve", "description": "test resolve flow"},
                          headers=hdr(worker_auth))
        assert fc.status_code == 200
        cid = fc.json()["id"]
        r = session.post(f"{API}/admin/complaints/{cid}/resolve", headers=hdr(admin_auth))
        assert r.status_code == 200
        # verify via list
        items = session.get(f"{API}/admin/complaints", headers=hdr(admin_auth),
                            params={"status": "resolved"}).json()
        assert any(c["id"] == cid for c in items)

    def test_reject_complaint(self, session, admin_auth, worker_auth):
        fc = session.post(f"{API}/complaints",
                          json={"subject": "TEST_reject", "description": "test reject flow"},
                          headers=hdr(worker_auth))
        assert fc.status_code == 200
        cid = fc.json()["id"]
        r = session.post(f"{API}/admin/complaints/{cid}/reject", headers=hdr(admin_auth))
        assert r.status_code == 200
        items = session.get(f"{API}/admin/complaints", headers=hdr(admin_auth),
                            params={"status": "rejected"}).json()
        assert any(c["id"] == cid for c in items)

    def test_resolve_unknown_404(self, session, admin_auth):
        r = session.post(f"{API}/admin/complaints/nonexistent/resolve", headers=hdr(admin_auth))
        assert r.status_code == 404

    def test_complaints_non_admin_forbidden(self, session, worker_auth):
        r = session.get(f"{API}/admin/complaints", headers=hdr(worker_auth))
        assert r.status_code == 403
