"""
Iteration 42 — Worker Home distance feature regression.
- No backend changes this iter; verify /api/jobs/vacancies still returns
  lat/lng when the source job has them, and works fine when absent.
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ["EXPO_PUBLIC_BACKEND_URL"].rstrip("/")

CLIENT = {"mobile": "9000000001", "password": "demo1234"}
WORKER = {"mobile": "9000000002", "password": "demo1234"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    return _login(CLIENT)


@pytest.fixture(scope="module")
def worker_token():
    return _login(WORKER)


def test_vacancies_endpoint_ok(worker_token):
    r = requests.get(
        f"{BASE_URL}/api/jobs/vacancies",
        headers={"Authorization": f"Bearer {worker_token}"},
        timeout=20,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert isinstance(body, list)
    # Each item must expose lat + lng keys (possibly null); vacancy_key too
    for item in body[:20]:
        assert "lat" in item, f"missing lat in {item.get('id')}"
        assert "lng" in item, f"missing lng in {item.get('id')}"
        assert "id" in item


def test_post_job_persists_lat_lng(client_token):
    """POST a Delhi job with lat/lng, then GET /jobs/vacancies as worker,
    confirm the same lat/lng shows up (verifying persistence + vacancy join)."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "title": f"TEST_iter42 Delhi GPS {suffix}",
        "description": "Distance-row regression test",
        "skill": "Mason",
        "workers_needed": 1,
        "daily_wage": 800,
        "location": "Delhi",
        "city": "Delhi",
        "state": "Delhi",
        "pincode": "110001",
        "urgency": "Normal",
        "lat": 28.6139,
        "lng": 77.2090,
    }
    r = requests.post(
        f"{BASE_URL}/api/jobs",
        json=payload,
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    job = r.json()
    assert job.get("lat") == 28.6139
    assert job.get("lng") == 77.2090
    job_id = job["id"]

    # Sanity — GET single job (via /jobs list filter) should carry lat/lng
    worker_token = _login(WORKER)
    r2 = requests.get(
        f"{BASE_URL}/api/jobs/vacancies",
        headers={"Authorization": f"Bearer {worker_token}"},
        timeout=20,
    )
    assert r2.status_code == 200
    matches = [it for it in r2.json() if it["id"] == job_id]
    assert matches, f"posted job {job_id} not found in vacancies"
    assert matches[0]["lat"] == 28.6139
    assert matches[0]["lng"] == 77.2090


def test_post_job_without_lat_lng(client_token):
    """Post without lat/lng — API must accept, and item shows in vacancies
    with lat/lng == None (front-end will hide the Distance row)."""
    suffix = uuid.uuid4().hex[:6]
    payload = {
        "title": f"TEST_iter42 NoGPS {suffix}",
        "description": "no coord",
        "skill": "Mason",
        "workers_needed": 1,
        "daily_wage": 700,
        "location": "Somewhere",
        "urgency": "Normal",
    }
    r = requests.post(
        f"{BASE_URL}/api/jobs",
        json=payload,
        headers={"Authorization": f"Bearer {client_token}"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    job = r.json()
    assert job.get("lat") is None
    assert job.get("lng") is None

    worker_token = _login(WORKER)
    r2 = requests.get(
        f"{BASE_URL}/api/jobs/vacancies",
        headers={"Authorization": f"Bearer {worker_token}"},
        timeout=20,
    )
    matches = [it for it in r2.json() if it["id"] == job["id"]]
    assert matches
    assert matches[0]["lat"] is None
    assert matches[0]["lng"] is None
