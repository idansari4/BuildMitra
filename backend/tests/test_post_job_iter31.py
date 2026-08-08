"""Backend tests for redesigned Post-a-Job flow (iteration 31).
Focus:
- New optional fields on JobIn: site_project_type, worker_skill_level
- Client + Contractor can post
- Worker still gets 403
- GET /api/jobs and GET /api/jobs/{id} return the new fields
- Backward-compat: posting WITHOUT the new fields still succeeds
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
if not BASE_URL:
    BASE_URL = "https://buildmitra.preview.emergentagent.com"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


def _login(mobile: str, password: str = "demo1234") -> str:
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=20)
    assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    return _login("9000000001")


@pytest.fixture(scope="module")
def contractor_token():
    return _login("9000000003")


@pytest.fixture(scope="module")
def worker_token():
    return _login("9000000002")


def _headers(tok: str):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _payload(extra=None):
    p = {
        "title": "TEST_ Post Job iter31",
        "description": "TEST job for site_project_type + worker_skill_level fields",
        "skill": "Mason",
        "workers_needed": 2,
        "daily_wage": 900,
        "location": "Bengaluru",
        "site_address": "Bengaluru",
        "duration_days": 10,
        "urgency": "Normal",
    }
    if extra:
        p.update(extra)
    return p


# ---------- Client posts with new fields ----------
def test_client_post_job_with_new_fields(client_token):
    body = _payload({"site_project_type": "Residential", "worker_skill_level": "Full Trained"})
    r = requests.post(f"{API}/jobs", json=body, headers=_headers(client_token), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("site_project_type") == "Residential"
    assert j.get("worker_skill_level") == "Full Trained"
    assert j.get("posted_by_role") == "client"
    job_id = j["id"]

    # GET /api/jobs/{id}
    g = requests.get(f"{API}/jobs/{job_id}", timeout=20)
    assert g.status_code == 200
    jg = g.json()
    assert jg["site_project_type"] == "Residential"
    assert jg["worker_skill_level"] == "Full Trained"

    # GET /api/jobs list
    l = requests.get(f"{API}/jobs?status=open&limit=100", timeout=20)
    assert l.status_code == 200
    hits = [x for x in l.json() if x.get("id") == job_id]
    assert hits, "posted job missing in list"
    assert hits[0]["site_project_type"] == "Residential"
    assert hits[0]["worker_skill_level"] == "Full Trained"


# ---------- Contractor posts with new fields ----------
def test_contractor_post_job_with_new_fields(contractor_token):
    body = _payload({
        "title": "TEST_ Contractor Job iter31",
        "site_project_type": "Commercial",
        "worker_skill_level": "Site Supervisor",
    })
    r = requests.post(f"{API}/jobs", json=body, headers=_headers(contractor_token), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["site_project_type"] == "Commercial"
    assert j["worker_skill_level"] == "Site Supervisor"
    assert j["posted_by_role"] == "contractor"


# ---------- Backward compat: no new fields ----------
def test_post_job_without_new_fields_backward_compat(client_token):
    body = _payload({"title": "TEST_ Legacy Job iter31"})
    # explicitly not adding site_project_type/worker_skill_level
    r = requests.post(f"{API}/jobs", json=body, headers=_headers(client_token), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    # Both should be present but None
    assert "site_project_type" in j
    assert "worker_skill_level" in j
    assert j["site_project_type"] is None
    assert j["worker_skill_level"] is None


# ---------- Worker cannot post ----------
def test_worker_cannot_post_job(worker_token):
    body = _payload({"site_project_type": "Residential", "worker_skill_level": "Helper"})
    r = requests.post(f"{API}/jobs", json=body, headers=_headers(worker_token), timeout=20)
    assert r.status_code == 403, r.text


# ---------- Regression: existing seeded jobs list still readable ----------
def test_list_jobs_regression():
    r = requests.get(f"{API}/jobs?status=open&limit=200", timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    # Should have at least the ones we just created
    assert any(x.get("title", "").startswith("TEST_") for x in data)
