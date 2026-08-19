"""
Iteration 44 — In-app Notifications feature.

Covers:
- 5 REST endpoints (list, unread-count, mark-read, delete one, delete all)
- 9 auto-trigger points across the codebase
- Auth, ownership, filtering behaviour
"""

import os
import time
import uuid

import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}


# ---------- helpers ----------
def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['mobile']}: {r.status_code} {r.text}"
    d = r.json()
    return d["token"], d["user"]


def _h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def _clear_notifs(token):
    requests.delete(f"{API}/notifications", headers=_h(token), timeout=15)


def _list_notifs(token, unread_only=False, limit=50):
    params = {"limit": limit}
    if unread_only:
        params["unread_only"] = "true"
    r = requests.get(f"{API}/notifications", headers=_h(token), params=params, timeout=15)
    assert r.status_code == 200, f"list failed: {r.status_code} {r.text}"
    return r.json()


def _wait_for_notif(token, ntype, timeout=8):
    """Poll notifications for a matching type. Returns notif dict or None."""
    end = time.time() + timeout
    while time.time() < end:
        items = _list_notifs(token, limit=50)
        for it in items:
            if it.get("type") == ntype:
                return it
        time.sleep(0.4)
    return None


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def tokens():
    wt, wu = _login(WORKER)
    ct, cu = _login(CLIENT)
    xt, xu = _login(CONTRACTOR)
    at, au = _login(ADMIN)
    return {
        "worker": (wt, wu),
        "client": (ct, cu),
        "contractor": (xt, xu),
        "admin": (at, au),
    }


@pytest.fixture(scope="module", autouse=True)
def _clean_notifs(tokens):
    for role in ("worker", "client", "contractor", "admin"):
        _clear_notifs(tokens[role][0])
    yield


# ---------- 1. auth / basic endpoints ----------
class TestNotificationAuth:
    def test_list_requires_auth(self):
        r = requests.get(f"{API}/notifications", timeout=10)
        assert r.status_code in (401, 403), f"expected 401/403 got {r.status_code}"

    def test_unread_count_requires_auth(self):
        r = requests.get(f"{API}/notifications/unread-count", timeout=10)
        assert r.status_code in (401, 403)

    def test_mark_read_requires_auth(self):
        r = requests.post(f"{API}/notifications/mark-read", json={"all": True}, timeout=10)
        assert r.status_code in (401, 403)

    def test_delete_requires_auth(self):
        r = requests.delete(f"{API}/notifications/xyz", timeout=10)
        assert r.status_code in (401, 403)

    def test_clear_all_requires_auth(self):
        r = requests.delete(f"{API}/notifications", timeout=10)
        assert r.status_code in (401, 403)


class TestNotificationCoreEndpoints:
    def test_unread_count_shape(self, tokens):
        t, _ = tokens["worker"]
        r = requests.get(f"{API}/notifications/unread-count", headers=_h(t), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "count" in d and isinstance(d["count"], int)

    def test_list_shape(self, tokens):
        t, _ = tokens["worker"]
        items = _list_notifs(t)
        assert isinstance(items, list)

    def test_mark_read_requires_ids_or_all(self, tokens):
        t, _ = tokens["worker"]
        r = requests.post(f"{API}/notifications/mark-read", headers=_h(t), json={}, timeout=10)
        assert r.status_code == 400, f"expected 400 got {r.status_code} {r.text}"

    def test_delete_missing_returns_404(self, tokens):
        t, _ = tokens["worker"]
        r = requests.delete(f"{API}/notifications/{uuid.uuid4()}", headers=_h(t), timeout=10)
        assert r.status_code == 404


# ---------- 2. application flow ----------
class TestApplicationTriggers:
    def test_application_new_and_status(self, tokens):
        wt, wu = tokens["worker"]
        ct, cu = tokens["client"]
        _clear_notifs(wt)
        _clear_notifs(ct)

        # Client posts a job
        job_payload = {
            "title": f"TEST_Notif_Job_{uuid.uuid4().hex[:8]}",
            "description": "Notif trigger test",
            "skill": "Mason",
            "workers_needed": 1,
            "daily_wage": 700,
            "location": "Mumbai",
            "duration_days": 3,
            "lat": 19.076,
            "lng": 72.877,
        }
        r = requests.post(f"{API}/jobs", headers=_h(ct), json=job_payload, timeout=15)
        assert r.status_code == 200, f"post job failed {r.status_code} {r.text}"
        job = r.json()

        # Worker applies
        r = requests.post(f"{API}/applications", headers=_h(wt), json={"job_id": job["id"], "message": "want job"}, timeout=15)
        assert r.status_code == 200, r.text
        appn = r.json()

        # Client should receive application_new
        n = _wait_for_notif(ct, "application_new")
        assert n, "client did not receive application_new"
        assert n["data"].get("job_id") == job["id"]
        assert n["data"].get("application_id") == appn["id"]
        assert n["data"].get("worker_id") == wu["id"]
        assert n["read"] is False
        assert "created_at" in n

        # Client accepts application → worker should get application_accepted
        r = requests.post(f"{API}/applications/{appn['id']}/status", headers=_h(ct), json={"status": "accepted"}, timeout=15)
        assert r.status_code == 200, r.text

        n = _wait_for_notif(wt, "application_accepted")
        assert n, "worker did not receive application_accepted"
        assert n["data"].get("job_id") == job["id"]
        assert n["data"].get("application_id") == appn["id"]

        # store job for downstream tests
        pytest._notif_job = job
        pytest._notif_app = appn

    def test_application_rejected_triggers(self, tokens):
        wt, _ = tokens["worker"]
        ct, _ = tokens["client"]

        # New separate job for rejection path
        job_payload = {
            "title": f"TEST_Reject_Job_{uuid.uuid4().hex[:8]}",
            "description": "Rejection notif",
            "skill": "Painter",
            "workers_needed": 1,
            "daily_wage": 600,
            "location": "Delhi",
            "duration_days": 2,
        }
        r = requests.post(f"{API}/jobs", headers=_h(ct), json=job_payload, timeout=15)
        job = r.json()
        r = requests.post(f"{API}/applications", headers=_h(wt), json={"job_id": job["id"]}, timeout=15)
        appn = r.json()
        r = requests.post(f"{API}/applications/{appn['id']}/status", headers=_h(ct), json={"status": "rejected"}, timeout=15)
        assert r.status_code == 200

        n = _wait_for_notif(wt, "application_rejected")
        assert n, "worker did not receive application_rejected"
        assert n["data"].get("application_id") == appn["id"]


# ---------- 3. attendance ----------
class TestAttendanceTriggers:
    def test_check_in_and_check_out_notify_poster(self, tokens):
        wt, wu = tokens["worker"]
        ct, _ = tokens["client"]
        job = pytest._notif_job

        # check_in
        payload = {
            "job_id": job["id"],
            "type": "check_in",
            "lat": job["lat"],
            "lng": job["lng"],
            "selfie": "data:image/png;base64,AAAA",
        }
        r = requests.post(f"{API}/attendance", headers=_h(wt), json=payload, timeout=15)
        assert r.status_code == 200, r.text

        n = _wait_for_notif(ct, "attendance_check_in")
        assert n, "client did not receive attendance_check_in"
        assert n["data"].get("job_id") == job["id"]
        assert n["data"].get("worker_id") == wu["id"]
        assert n["data"].get("type") == "check_in"

        # check_out
        payload["type"] = "check_out"
        r = requests.post(f"{API}/attendance", headers=_h(wt), json=payload, timeout=15)
        assert r.status_code == 200

        n = _wait_for_notif(ct, "attendance_check_out")
        assert n, "client did not receive attendance_check_out"
        assert n["data"].get("type") == "check_out"


# ---------- 4. complaint → notify all admins ----------
class TestComplaintTriggers:
    def test_complaint_notifies_admins(self, tokens):
        at, _ = tokens["admin"]
        wt, wu = tokens["worker"]
        _clear_notifs(at)

        subject = f"TEST_Complaint_{uuid.uuid4().hex[:6]}"
        r = requests.post(
            f"{API}/complaints",
            headers=_h(wt),
            json={"subject": subject, "description": "test complaint body"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        comp = r.json()
        pytest._notif_complaint = comp

        n = _wait_for_notif(at, "complaint_new")
        assert n, "admin did not receive complaint_new"
        assert n["data"].get("complaint_id") == comp["id"]
        assert n["data"].get("by_user_id") == wu["id"]
        assert subject in n["body"]

    def test_complaint_resolve_notifies_user(self, tokens):
        at, _ = tokens["admin"]
        wt, _ = tokens["worker"]
        comp = pytest._notif_complaint
        r = requests.post(
            f"{API}/admin/complaints/{comp['id']}/resolve",
            headers=_h(at),
            params={"note": "handled"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        n = _wait_for_notif(wt, "complaint_resolved")
        assert n, "worker did not receive complaint_resolved"
        assert n["data"].get("complaint_id") == comp["id"]

    def test_complaint_reject_notifies_user(self, tokens):
        at, _ = tokens["admin"]
        wt, _ = tokens["worker"]
        r = requests.post(
            f"{API}/complaints",
            headers=_h(wt),
            json={"subject": f"TEST_Reject_{uuid.uuid4().hex[:6]}", "description": "reject me"},
            timeout=15,
        )
        comp = r.json()
        r = requests.post(
            f"{API}/admin/complaints/{comp['id']}/reject",
            headers=_h(at),
            params={"note": "invalid"},
            timeout=15,
        )
        assert r.status_code == 200
        n = _wait_for_notif(wt, "complaint_rejected")
        assert n, "worker did not receive complaint_rejected"
        assert n["data"].get("complaint_id") == comp["id"]


# ---------- 5. escrow release → wallet_credit ----------
class TestEscrowTriggers:
    def test_escrow_release_notifies_worker(self, tokens):
        ct, _ = tokens["client"]
        wt, wu = tokens["worker"]
        job = pytest._notif_job

        # deposit
        r = requests.post(f"{API}/escrow/deposit", headers=_h(ct), json={"job_id": job["id"], "amount": 500}, timeout=15)
        assert r.status_code == 200, r.text
        esc = r.json()["escrow"]

        # release
        r = requests.post(
            f"{API}/escrow/release",
            headers=_h(ct),
            json={"escrow_id": esc["id"], "worker_id": wu["id"], "amount": 200},
            timeout=15,
        )
        assert r.status_code == 200, r.text

        n = _wait_for_notif(wt, "wallet_credit")
        assert n, "worker did not receive wallet_credit"
        assert n["data"].get("escrow_id") == esc["id"]
        assert n["data"].get("job_id") == job["id"]
        assert float(n["data"].get("amount", 0)) == 200.0


# ---------- 6. leave request/decision ----------
class TestLeaveTriggers:
    def test_leave_request_and_decision(self, tokens):
        wt, wu = tokens["worker"]
        ct, _ = tokens["client"]
        job = pytest._notif_job

        r = requests.post(
            f"{API}/leave/request",
            headers=_h(wt),
            json={
                "from_date": "2026-02-01",
                "to_date": "2026-02-03",
                "reason": "family function",
                "job_id": job["id"],
            },
            timeout=15,
        )
        assert r.status_code == 200, r.text
        leave = r.json()

        # Approver (client, poster of job) should get leave_request
        n = _wait_for_notif(ct, "leave_request")
        assert n, "approver did not receive leave_request"
        assert n["data"].get("leave_id") == leave["id"]
        assert n["data"].get("worker_id") == wu["id"]

        # Approve
        r = requests.post(
            f"{API}/leave/{leave['id']}/decision",
            headers=_h(ct),
            json={"decision": "approved", "note": "ok"},
            timeout=15,
        )
        assert r.status_code == 200

        n = _wait_for_notif(wt, "leave_approved")
        assert n, "worker did not receive leave_approved"
        assert n["data"].get("leave_id") == leave["id"]
        assert n["data"].get("decision") == "approved"

    def test_leave_rejected(self, tokens):
        wt, _ = tokens["worker"]
        ct, _ = tokens["client"]
        job = pytest._notif_job

        r = requests.post(
            f"{API}/leave/request",
            headers=_h(wt),
            json={"from_date": "2026-03-01", "to_date": "2026-03-02", "reason": "personal", "job_id": job["id"]},
            timeout=15,
        )
        leave = r.json()
        r = requests.post(
            f"{API}/leave/{leave['id']}/decision",
            headers=_h(ct),
            json={"decision": "rejected", "note": "no cover"},
            timeout=15,
        )
        assert r.status_code == 200
        n = _wait_for_notif(wt, "leave_rejected")
        assert n, "worker did not receive leave_rejected"
        assert n["data"].get("decision") == "rejected"


# ---------- 7. admin verify/suspend/unsuspend ----------
class TestAdminUserTriggers:
    def test_verify_suspend_unsuspend(self, tokens):
        at, _ = tokens["admin"]
        # target — contractor (avoids poisoning worker attendance flow)
        xt, xu = tokens["contractor"]
        _clear_notifs(xt)

        r = requests.post(f"{API}/admin/users/{xu['id']}/verify", headers=_h(at), timeout=15)
        assert r.status_code == 200
        n = _wait_for_notif(xt, "profile_verified")
        assert n, "contractor did not receive profile_verified"

        r = requests.post(f"{API}/admin/users/{xu['id']}/suspend", headers=_h(at), timeout=15)
        assert r.status_code == 200
        n = _wait_for_notif(xt, "account_suspended")
        assert n, "contractor did not receive account_suspended"

        r = requests.post(f"{API}/admin/users/{xu['id']}/unsuspend", headers=_h(at), timeout=15)
        assert r.status_code == 200
        n = _wait_for_notif(xt, "account_unsuspended")
        assert n, "contractor did not receive account_unsuspended"


# ---------- 8. management endpoints (isolation / read / delete) ----------
class TestNotificationManagement:
    def test_unread_only_filter_and_mark_read(self, tokens):
        wt, _ = tokens["worker"]
        # ensure at least one notif exists
        items = _list_notifs(wt)
        assert len(items) > 0, "worker should have received several notifs by now"

        # unread count > 0
        r = requests.get(f"{API}/notifications/unread-count", headers=_h(wt), timeout=10)
        assert r.status_code == 200
        unread_before = r.json()["count"]
        assert unread_before > 0

        unread_list = _list_notifs(wt, unread_only=True)
        assert all(x["read"] is False for x in unread_list)
        assert len(unread_list) == unread_before

        # Mark first two IDs as read
        ids = [x["id"] for x in unread_list[:2]]
        r = requests.post(f"{API}/notifications/mark-read", headers=_h(wt), json={"ids": ids}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert d.get("modified") == len(ids)

        # verify unread went down by len(ids)
        r = requests.get(f"{API}/notifications/unread-count", headers=_h(wt), timeout=10)
        assert r.json()["count"] == unread_before - len(ids)

    def test_mark_all_read_only_affects_current_user(self, tokens):
        wt, _ = tokens["worker"]
        ct, _ = tokens["client"]

        # Ensure client has some unread notifs — file a complaint to admin?  Instead, poster already has application_new + attendance notifs.
        client_unread_before = requests.get(
            f"{API}/notifications/unread-count", headers=_h(ct), timeout=10
        ).json()["count"]

        # Worker marks all read
        r = requests.post(f"{API}/notifications/mark-read", headers=_h(wt), json={"all": True}, timeout=10)
        assert r.status_code == 200

        # Worker unread should be 0
        worker_unread = requests.get(
            f"{API}/notifications/unread-count", headers=_h(wt), timeout=10
        ).json()["count"]
        assert worker_unread == 0

        # Client unread untouched
        client_unread_after = requests.get(
            f"{API}/notifications/unread-count", headers=_h(ct), timeout=10
        ).json()["count"]
        assert client_unread_after == client_unread_before

    def test_delete_others_notif_returns_404(self, tokens):
        wt, _ = tokens["worker"]
        ct, _ = tokens["client"]
        # pick a notif from client (posted from application_new)
        c_items = _list_notifs(ct, limit=5)
        assert len(c_items) > 0, "client has no notifs to test cross-user delete"
        target_id = c_items[0]["id"]

        # worker tries to delete client's notif
        r = requests.delete(f"{API}/notifications/{target_id}", headers=_h(wt), timeout=10)
        assert r.status_code == 404, f"expected 404 got {r.status_code}"

        # verify still exists for client
        c_items2 = _list_notifs(ct, limit=5)
        assert any(x["id"] == target_id for x in c_items2)

    def test_delete_own_notif(self, tokens):
        wt, _ = tokens["worker"]
        items = _list_notifs(wt, limit=5)
        assert items, "worker should have notifications"
        nid = items[0]["id"]
        r = requests.delete(f"{API}/notifications/{nid}", headers=_h(wt), timeout=10)
        assert r.status_code == 200
        assert r.json().get("ok") is True

        items2 = _list_notifs(wt, limit=200)
        assert not any(x["id"] == nid for x in items2), "notif still present after delete"

    def test_clear_all_isolation(self, tokens):
        wt, _ = tokens["worker"]
        ct, _ = tokens["client"]
        # Client count before
        c_before = requests.get(
            f"{API}/notifications/unread-count", headers=_h(ct), timeout=10
        ).json()["count"]

        r = requests.delete(f"{API}/notifications", headers=_h(wt), timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is True
        assert isinstance(d.get("deleted"), int)

        w_items = _list_notifs(wt)
        assert w_items == []

        # Client should not be affected
        c_after = requests.get(
            f"{API}/notifications/unread-count", headers=_h(ct), timeout=10
        ).json()["count"]
        assert c_after == c_before


# ---------- teardown ----------
def teardown_module(module):
    for creds in (WORKER, CLIENT, CONTRACTOR, ADMIN):
        try:
            t, _ = _login(creds)
            requests.delete(f"{API}/notifications", headers=_h(t), timeout=10)
        except Exception:
            pass
