"""
Iter 23 - Worker Profile updates:
- experience_level field on ProfileUpdate
- availability toggle
- skills list (new job titles)
- regression: daily_wage / experience_years / city
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
WORKER_MOBILE = "9000000002"
WORKER_PASSWORD = "demo1234"


@pytest.fixture(scope="module")
def worker_token():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"mobile": WORKER_MOBILE, "password": WORKER_PASSWORD}, timeout=15)
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    return data["token"]


@pytest.fixture
def worker_headers(worker_token):
    return {"Authorization": f"Bearer {worker_token}", "Content-Type": "application/json"}


class TestProfileExperienceLevel:
    def test_put_me_experience_level_full_trained(self, worker_headers):
        r = requests.put(f"{BASE_URL}/api/me", json={"experience_level": "Full trained"}, headers=worker_headers, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("experience_level") == "Full trained", data

        # verify via GET
        g = requests.get(f"{BASE_URL}/api/me", headers=worker_headers, timeout=15)
        assert g.status_code == 200
        assert g.json().get("experience_level") == "Full trained"

    def test_put_me_experience_level_semi_trained(self, worker_headers):
        r = requests.put(f"{BASE_URL}/api/me", json={"experience_level": "Semi trained"}, headers=worker_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("experience_level") == "Semi trained"


class TestProfileAvailability:
    def test_toggle_available_false(self, worker_headers):
        r = requests.put(f"{BASE_URL}/api/me", json={"available": False}, headers=worker_headers, timeout=15)
        assert r.status_code == 200, r.text
        assert r.json().get("available") is False

        g = requests.get(f"{BASE_URL}/api/me", headers=worker_headers, timeout=15)
        assert g.json().get("available") is False

    def test_toggle_available_true(self, worker_headers):
        r = requests.put(f"{BASE_URL}/api/me", json={"available": True}, headers=worker_headers, timeout=15)
        assert r.status_code == 200
        assert r.json().get("available") is True

        g = requests.get(f"{BASE_URL}/api/me", headers=worker_headers, timeout=15)
        assert g.json().get("available") is True


class TestProfileSkills:
    def test_put_me_new_skill_list(self, worker_headers):
        skills = ["Mason", "AC Technician", "Marbal Mason"]
        r = requests.put(f"{BASE_URL}/api/me", json={"skills": skills}, headers=worker_headers, timeout=15)
        assert r.status_code == 200, r.text
        returned = r.json().get("skills") or []
        assert set(returned) == set(skills), f"Expected {skills}, got {returned}"

        g = requests.get(f"{BASE_URL}/api/me", headers=worker_headers, timeout=15)
        assert set(g.json().get("skills") or []) == set(skills)


class TestProfileRegression:
    def test_put_me_regression_fields(self, worker_headers):
        r = requests.put(
            f"{BASE_URL}/api/me",
            json={"daily_wage": 800, "city": "Pune", "experience_years": 6},
            headers=worker_headers,
            timeout=15,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("daily_wage") == 800
        assert d.get("city") == "Pune"
        assert d.get("experience_years") == 6

        g = requests.get(f"{BASE_URL}/api/me", headers=worker_headers, timeout=15).json()
        assert g.get("daily_wage") == 800
        assert g.get("city") == "Pune"
        assert g.get("experience_years") == 6
