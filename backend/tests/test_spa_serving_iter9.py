"""Tests for SPA-serving fix (iteration 9).

Verifies that backend at :8001 serves both the Expo web SPA at `/` and
the JSON API at `/api/*`, and that the SPA catch-all does NOT shadow
API routes.
"""
import os
import pytest
import requests

# Test against local backend directly (the fix is at the serving layer).
BASE_URL = "http://localhost:8001"

JS_BUNDLE = "/_expo/static/js/web/entry-456d011a83a4b02851a76a6f8a26e89c.js"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------------- SPA root + static ----------------

class TestSpaRoot:
    def test_root_returns_html(self, s):
        r = s.get(f"{BASE_URL}/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        body = r.text
        assert '<div id="root">' in body
        assert "_expo/static/js/web/entry-" in body

    def test_js_bundle_served(self, s):
        r = s.get(f"{BASE_URL}{JS_BUNDLE}")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert ("javascript" in ct), f"Unexpected content-type: {ct}"
        # Bundle is ~2.78 MB
        assert len(r.content) > 500_000

    def test_favicon_served(self, s):
        r = s.get(f"{BASE_URL}/favicon.ico")
        assert r.status_code == 200
        assert len(r.content) > 1000  # binary file

    def test_missing_static_asset_returns_404(self, s):
        r = s.get(f"{BASE_URL}/_expo/static/some-fake-asset.js")
        assert r.status_code == 404


# ---------------- SPA fallback ----------------

class TestSpaFallback:
    @pytest.mark.parametrize("path", ["random-route", "complaints", "help", "deep/nested/route"])
    def test_unknown_route_returns_spa(self, s, path):
        r = s.get(f"{BASE_URL}/{path}")
        assert r.status_code == 200, f"{path} -> {r.status_code}"
        assert "text/html" in r.headers.get("content-type", "")
        assert '<div id="root">' in r.text


# ---------------- API not shadowed ----------------

class TestApiNotShadowed:
    def test_api_root(self, s):
        r = s.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "BuildMitra"
        assert data.get("ok") is True

    def test_api_health(self, s):
        r = s.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_api_healthz(self, s):
        r = s.get(f"{BASE_URL}/api/healthz")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_api_skills(self, s):
        r = s.get(f"{BASE_URL}/api/skills")
        assert r.status_code == 200
        body = r.json()
        # Could be {"skills":[...]} or a list — accept both
        if isinstance(body, dict):
            skills = body.get("skills") or body.get("items") or []
        else:
            skills = body
        assert isinstance(skills, list)
        assert len(skills) > 0

    def test_api_login_password(self, s):
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"mobile": "9000000002", "password": "demo1234"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        token = data.get("token") or data.get("access_token")
        assert token, f"No token in response: {data}"
        assert "user" in data or "id" in data

    def test_api_unknown_returns_404_json(self, s):
        r = s.get(f"{BASE_URL}/api/nonexistent")
        assert r.status_code == 404
        # FastAPI default JSON 404, not HTML SPA fallback
        assert "application/json" in r.headers.get("content-type", "")


# ---------------- Root-level health endpoints ----------------

class TestRootHealth:
    def test_health(self, s):
        r = s.get(f"{BASE_URL}/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_healthz(self, s):
        r = s.get(f"{BASE_URL}/healthz")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}


# ---------------- Regression: auth-protected endpoints still work ----------------

@pytest.fixture(scope="module")
def worker_token(s):
    r = s.post(
        f"{BASE_URL}/api/auth/login",
        json={"mobile": "9000000002", "password": "demo1234"},
    )
    if r.status_code != 200:
        pytest.skip(f"Login failed: {r.status_code} {r.text}")
    return (r.json().get("token") or r.json().get("access_token"))


class TestRegressionAuth:
    def test_me_with_token(self, s, worker_token):
        r = s.get(
            f"{BASE_URL}/api/me",
            headers={"Authorization": f"Bearer {worker_token}"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("mobile") == "9000000002"

    def test_complaints_list(self, s, worker_token):
        r = s.get(
            f"{BASE_URL}/api/complaints/mine",
            headers={"Authorization": f"Bearer {worker_token}"},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, (list, dict))
