"""Iteration 43 — Attendance Monitoring Contractor/Client fix.

Focused test on:
1. Enrichment of /api/attendance/my-workers (worker_name, worker_photo, worker_mobile,
   job_title, job_location, has_selfie boolean; raw selfie base64 stripped).
2. End-to-end session flow: Client posts job → Worker applies → Client accepts →
   Worker check_in → Client sees enriched row → Worker check_out → Client sees updated row.
3. Scoping regression: Contractor cannot see Client's jobs' events (and vice versa).
4. Worker regression: /attendance/mine still works and worker gets 403 on /my-workers.
"""
import os
import re
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/") or "https://buildmitra.preview.emergentagent.com"
API = BASE_URL + "/api"

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}

# Job site near Delhi (used for geofence check)
JOB_LAT = 28.6139
JOB_LNG = 77.2090

# Tiny 1x1 red PNG base64 for selfie
DUMMY_SELFIE_B64 = (
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8"
    "z8DwHwAFAAH/2LhY6QAAAABJRU5ErkJggg=="
)


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"login failed for {creds['mobile']}: {r.status_code} {r.text}"
    tok = r.json().get("token") or r.json().get("access_token")
    assert tok, f"no token in login response: {r.json()}"
    return tok


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


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


@pytest.fixture(scope="module")
def worker_profile(worker_token):
    r = requests.get(f"{API}/me", headers=_h(worker_token), timeout=15)
    assert r.status_code == 200
    return r.json()


# ---------- 1. Enrichment schema ----------
class TestEnrichmentSchema:
    def test_client_my_workers_enriched(self, client_token):
        r = requests.get(f"{API}/attendance/my-workers?days=30", headers=_h(client_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        # It's possible no data; enrichment guarantees only apply when rows exist.
        for row in data:
            for k in ("worker_name", "job_title", "has_selfie"):
                assert k in row, f"missing {k} in row {row}"
            assert isinstance(row["worker_name"], str) and row["worker_name"], "worker_name must be non-empty string"
            assert isinstance(row["job_title"], str), "job_title must be string (empty ok)"
            assert isinstance(row["has_selfie"], bool), "has_selfie must be boolean"
            # Raw selfie payload MUST NOT be present
            assert "selfie" not in row, f"selfie payload should be stripped, got: {list(row.keys())}"
            # Optional keys present (photo/mobile/location) — types when present
            if row.get("worker_photo") is not None:
                assert isinstance(row["worker_photo"], str)
            if row.get("worker_mobile") is not None:
                assert isinstance(row["worker_mobile"], str)

    def test_contractor_my_workers_enriched(self, contractor_token):
        r = requests.get(f"{API}/attendance/my-workers?days=30", headers=_h(contractor_token), timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, list)
        for row in data:
            for k in ("worker_name", "job_title", "has_selfie"):
                assert k in row, f"missing {k} in row {row}"
            assert isinstance(row["has_selfie"], bool)
            assert "selfie" not in row

    def test_worker_my_workers_forbidden(self, worker_token):
        r = requests.get(f"{API}/attendance/my-workers?days=1", headers=_h(worker_token), timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code} {r.text}"


# ---------- 2. End-to-end session flow ----------
class TestSessionFlow:
    @pytest.fixture(scope="class")
    def flow_ctx(self, client_token, worker_token, worker_profile):
        # Client posts a job with GPS coords (small workers_needed=1)
        payload = {
            "title": f"TEST_iter43_MonitorFlow_{int(time.time())}",
            "description": "iter43 monitor session flow",
            "skill": "Mason",
            "workers_needed": 1,
            "daily_wage": 500,
            "location": "Delhi Test Site",
            "duration_days": 1,
            "lat": JOB_LAT,
            "lng": JOB_LNG,
            "geofence_radius_m": 500,
        }
        r = requests.post(f"{API}/jobs", headers=_h(client_token), json=payload, timeout=15)
        assert r.status_code == 200, f"post job failed: {r.status_code} {r.text}"
        job = r.json()
        job_id = job["id"]

        # Worker applies
        r = requests.post(
            f"{API}/applications",
            headers=_h(worker_token),
            json={"job_id": job_id, "message": "iter43"},
            timeout=15,
        )
        if r.status_code == 400 and "Already applied" in r.text:
            # find existing app
            r2 = requests.get(f"{API}/applications/mine", headers=_h(worker_token), timeout=15)
            assert r2.status_code == 200
            app = next((a for a in r2.json() if a["job_id"] == job_id), None)
            assert app, "expected existing application"
        else:
            assert r.status_code == 200, f"apply failed: {r.status_code} {r.text}"
            app = r.json()
        app_id = app["id"]

        # Client accepts
        r = requests.post(
            f"{API}/applications/{app_id}/status",
            headers=_h(client_token),
            json={"status": "accepted"},
            timeout=15,
        )
        assert r.status_code == 200, f"accept failed: {r.status_code} {r.text}"

        return {"job_id": job_id, "job_title": payload["title"], "worker_id": worker_profile["id"], "worker_name": worker_profile.get("name", "")}

    def test_full_check_in_then_out_and_client_sees_enriched(self, flow_ctx, worker_token, client_token):
        job_id = flow_ctx["job_id"]

        # Worker check_in (within geofence)
        ci = requests.post(
            f"{API}/attendance",
            headers=_h(worker_token),
            json={
                "job_id": job_id,
                "type": "check_in",
                "lat": JOB_LAT,
                "lng": JOB_LNG,
                "selfie": DUMMY_SELFIE_B64,
            },
            timeout=15,
        )
        assert ci.status_code == 200, f"check_in failed: {ci.status_code} {ci.text}"
        ci_data = ci.json()
        assert ci_data["within_geofence"] is True
        assert "selfie" not in ci_data  # never returned in response

        # Client GET my-workers → find the row for this job/worker
        r = requests.get(f"{API}/attendance/my-workers?days=1", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        matches = [x for x in rows if x.get("job_id") == job_id and x.get("worker_id") == flow_ctx["worker_id"] and x.get("type") == "check_in"]
        assert matches, f"expected a check_in row for this job/worker; total_rows={len(rows)}"
        row = matches[0]

        # Enrichment checks
        assert row.get("worker_name"), f"worker_name empty: {row}"
        assert row["worker_name"] != "Worker", "worker_name should be actual applied worker's name, not fallback"
        if flow_ctx["worker_name"]:
            assert row["worker_name"] == flow_ctx["worker_name"], f"expected {flow_ctx['worker_name']}, got {row['worker_name']}"
        assert row.get("job_title") == flow_ctx["job_title"], f"job_title mismatch: {row.get('job_title')}"
        assert row.get("has_selfie") is True, "has_selfie should be True after check-in with selfie payload"
        assert "selfie" not in row, "raw selfie base64 must not be exposed"
        assert row.get("within_geofence") is True

        # Wait a couple seconds then Worker check_out
        time.sleep(2)
        co = requests.post(
            f"{API}/attendance",
            headers=_h(worker_token),
            json={
                "job_id": job_id,
                "type": "check_out",
                "lat": JOB_LAT,
                "lng": JOB_LNG,
                "selfie": DUMMY_SELFIE_B64,
            },
            timeout=15,
        )
        assert co.status_code == 200, f"check_out failed: {co.status_code} {co.text}"

        # Client re-fetch → both events present, both enriched, no raw selfie
        r = requests.get(f"{API}/attendance/my-workers?days=1", headers=_h(client_token), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        job_rows = [x for x in rows if x.get("job_id") == job_id and x.get("worker_id") == flow_ctx["worker_id"]]
        types = {x["type"] for x in job_rows}
        assert "check_in" in types and "check_out" in types, f"expected both types, got {types}"
        for x in job_rows:
            assert x.get("worker_name") and x["worker_name"] != "Worker"
            assert x.get("job_title") == flow_ctx["job_title"]
            assert isinstance(x.get("has_selfie"), bool)
            assert x["has_selfie"] is True
            assert "selfie" not in x


# ---------- 3. Scoping regression ----------
class TestScoping:
    def test_contractor_does_not_see_client_jobs(self, client_token, contractor_token):
        # Rows from client account
        rc = requests.get(f"{API}/attendance/my-workers?days=30", headers=_h(client_token), timeout=15)
        assert rc.status_code == 200
        client_job_ids = {x.get("job_id") for x in rc.json() if x.get("job_id")}

        # Rows from contractor account
        rk = requests.get(f"{API}/attendance/my-workers?days=30", headers=_h(contractor_token), timeout=15)
        assert rk.status_code == 200
        contractor_rows = rk.json()
        contractor_job_ids = {x.get("job_id") for x in contractor_rows if x.get("job_id")}

        # Contractor's returned job_ids must not overlap with client's — SCOPING
        overlap = client_job_ids & contractor_job_ids
        assert not overlap, f"scoping leak: contractor sees client's jobs: {overlap}"

    def test_admin_sees_all(self, admin_token):
        # Admin endpoint returns all events (up to 200); simply verify 200 and list shape
        r = requests.get(f"{API}/admin/attendance", headers=_h(admin_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # If any row exists it should have basic fields (unchanged behaviour)
        if data:
            assert "id" in data[0] and "type" in data[0]


# ---------- 4. Worker regression ----------
class TestWorkerRegression:
    def test_worker_mine_still_works(self, worker_token):
        r = requests.get(f"{API}/attendance/mine", headers=_h(worker_token), timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        if data:
            row = data[0]
            for k in ("id", "type", "created_at"):
                assert k in row
            # selfie stripped on this endpoint too
            assert "selfie" not in row

    def test_worker_can_still_check_in_generic(self, worker_token):
        # Non-blocking sanity: existing endpoint still accepts payload with job_id='self'
        r = requests.post(
            f"{API}/attendance",
            headers=_h(worker_token),
            json={
                "job_id": "self",
                "type": "check_in",
                "lat": JOB_LAT,
                "lng": JOB_LNG,
                "selfie": DUMMY_SELFIE_B64,
            },
            timeout=15,
        )
        assert r.status_code == 200, f"worker self check_in failed: {r.status_code} {r.text}"
        j = r.json()
        assert j.get("type") == "check_in"
        assert "selfie" not in j
