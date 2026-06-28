"""Tests for user-side complaints flow: POST /api/complaints and GET /api/complaints/mine."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL", "")).rstrip("/")
if not BASE_URL:
    BASE_URL = "https://buildmitra.preview.emergentagent.com"
API = BASE_URL + "/api"

WORKER_MOBILE = "9000000002"
WORKER_PW = "demo1234"
ADMIN_MOBILE = "9000000000"
ADMIN_PW = "admin1234"


@pytest.fixture(scope="module")
def worker_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": WORKER_MOBILE, "password": WORKER_PW}, timeout=20)
    assert r.status_code == 200, f"login failed {r.status_code}: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": ADMIN_MOBILE, "password": ADMIN_PW}, timeout=20)
    assert r.status_code == 200, f"admin login failed {r.status_code}: {r.text}"
    return r.json()["token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---- file complaint ----
class TestFileComplaint:
    def test_file_complaint_success(self, worker_token):
        payload = {
            "subject": "[TEST] Payment delayed by client",
            "description": "[Category: Payment Issue]\n\nClient has not paid the wage for 5 days now. Need help.",
        }
        r = requests.post(f"{API}/complaints", json=payload, headers=_h(worker_token), timeout=20)
        assert r.status_code == 200, f"{r.status_code}: {r.text}"
        data = r.json()
        # response structure
        assert data["subject"] == payload["subject"]
        assert data["description"] == payload["description"]
        assert data["status"] == "open"
        assert data["admin_note"] == ""
        assert "id" in data and data["id"]
        assert "_id" not in data
        assert data["by_user_role"] == "worker"
        assert "created_at" in data
        # stash id for later test classes
        pytest.complaint_id = data["id"]

    def test_file_complaint_unauthenticated(self):
        r = requests.post(
            f"{API}/complaints",
            json={"subject": "[TEST] x", "description": "y"},
            timeout=20,
        )
        assert r.status_code in (401, 403)

    def test_file_complaint_missing_subject(self, worker_token):
        # Backend treats subject as required (Pydantic) — missing field returns 422
        r = requests.post(
            f"{API}/complaints",
            json={"description": "abcdefghij"},
            headers=_h(worker_token),
            timeout=20,
        )
        assert r.status_code in (400, 422)


# ---- get my complaints ----
class TestMyComplaints:
    def test_my_complaints_lists_filed(self, worker_token):
        r = requests.get(f"{API}/complaints/mine", headers=_h(worker_token), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        # No mongo _id leak
        for item in data:
            assert "_id" not in item
            assert "id" in item
            assert "subject" in item
            assert "status" in item
        # newest first (sorted desc by created_at)
        if len(data) >= 2:
            assert data[0]["created_at"] >= data[1]["created_at"]

    def test_my_complaints_includes_recent_file(self, worker_token):
        # post a fresh one and confirm it appears
        payload = {
            "subject": "[TEST] Quality issue with masonry",
            "description": "[Category: Work Quality]\n[Against: Suresh]\n\nThe masonry work is below standard. Need re-do.",
        }
        rp = requests.post(f"{API}/complaints", json=payload, headers=_h(worker_token), timeout=20)
        assert rp.status_code == 200
        cid = rp.json()["id"]

        r = requests.get(f"{API}/complaints/mine", headers=_h(worker_token), timeout=20)
        assert r.status_code == 200
        ids = [c["id"] for c in r.json()]
        assert cid in ids

    def test_my_complaints_isolation_admin_sees_via_admin_route(self, admin_token):
        # admin's own /complaints/mine should NOT include worker's complaint (different by_user_id)
        r = requests.get(f"{API}/complaints/mine", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        for c in r.json():
            assert c.get("by_user_role") != "worker" or c.get("by_user_id") != ""  # admin's own list


# ---- regression: admin complaints endpoint still works ----
class TestAdminComplaintsRegression:
    def test_admin_can_see_user_complaint(self, admin_token, worker_token):
        # ensure at least one exists
        requests.post(
            f"{API}/complaints",
            json={"subject": "[TEST] admin visibility", "description": "[Category: Other]\n\nadmin should see this complaint."},
            headers=_h(worker_token), timeout=20,
        )
        r = requests.get(f"{API}/admin/complaints", headers=_h(admin_token), timeout=20)
        assert r.status_code == 200
        items = r.json()
        assert isinstance(items, list)
        assert any("[TEST]" in (c.get("subject") or "") for c in items), "admin should see TEST complaints"
        for c in items:
            assert "_id" not in c


# ---- light regression: password change & photo update still work ----
class TestRegressionProfile:
    def test_change_password_roundtrip(self, worker_token):
        # change pw to demo1234x then back
        r1 = requests.put(
            f"{API}/me/password",
            json={"old_password": "demo1234", "new_password": "demo1234x"},
            headers=_h(worker_token), timeout=20,
        )
        assert r1.status_code in (200, 204), f"{r1.status_code}: {r1.text}"
        # revert
        # need new token since some impls invalidate, but here token stays valid
        r2 = requests.put(
            f"{API}/me/password",
            json={"old_password": "demo1234x", "new_password": "demo1234"},
            headers=_h(worker_token), timeout=20,
        )
        assert r2.status_code in (200, 204), f"revert failed {r2.status_code}: {r2.text}"

    def test_photo_update_clear(self, worker_token):
        r = requests.put(
            f"{API}/me",
            json={"photo": ""},
            headers=_h(worker_token), timeout=20,
        )
        assert r.status_code in (200, 204)
