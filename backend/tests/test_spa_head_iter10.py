"""Tests for SPA-serving HEAD support (iteration 10).

Some link-previewers/crawlers (WhatsApp, iMessage, Facebook) issue HEAD
requests to validate URLs. Previously HEAD returned 405 because only GET
handlers were declared. This iteration adds `@app.head` decorators
alongside `@app.get` for SPA routes.
"""
import pytest
import requests

BASE_URL = "http://localhost:8001"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------------- HEAD support for SPA routes ----------------

class TestHeadSpa:
    def test_head_root(self, s):
        r = s.head(f"{BASE_URL}/")
        assert r.status_code == 200, f"HEAD / -> {r.status_code}"
        ct = r.headers.get("content-type", "")
        # Should be HTML (or empty body is fine, but content-type set)
        assert "text/html" in ct, f"Unexpected content-type: {ct}"
        # HEAD must have empty body per RFC
        assert r.content == b"" or len(r.content) == 0

    def test_head_random_route_spa_fallback(self, s):
        r = s.head(f"{BASE_URL}/random-route")
        assert r.status_code == 200, f"HEAD /random-route -> {r.status_code}"
        ct = r.headers.get("content-type", "")
        assert "text/html" in ct, f"Unexpected content-type: {ct}"

    def test_head_deep_nested_route(self, s):
        r = s.head(f"{BASE_URL}/deep/nested/route")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")

    def test_head_favicon(self, s):
        r = s.head(f"{BASE_URL}/favicon.ico")
        assert r.status_code == 200, f"HEAD /favicon.ico -> {r.status_code}"

    def test_head_api_health(self, s):
        # FastAPI auto-supports HEAD on GET routes (Starlette behavior).
        r = s.head(f"{BASE_URL}/api/health")
        assert r.status_code == 200, f"HEAD /api/health -> {r.status_code}"

    def test_head_root_health(self, s):
        r = s.head(f"{BASE_URL}/health")
        assert r.status_code == 200


# ---------------- GET regression smoke (no body checks duplicated) ----------------

class TestGetRegression:
    def test_get_root_has_html_root(self, s):
        r = s.get(f"{BASE_URL}/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert '<div id="root">' in r.text

    def test_get_spa_fallback_serves_index(self, s):
        r = s.get(f"{BASE_URL}/some-unknown-path")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert '<div id="root">' in r.text

    def test_get_api_not_shadowed_health(self, s):
        r = s.get(f"{BASE_URL}/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_get_api_skills(self, s):
        r = s.get(f"{BASE_URL}/api/skills")
        assert r.status_code == 200

    def test_get_api_login(self, s):
        r = s.post(
            f"{BASE_URL}/api/auth/login",
            json={"mobile": "9000000002", "password": "demo1234"},
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert (data.get("token") or data.get("access_token"))

    def test_get_api_unknown_json_404(self, s):
        r = s.get(f"{BASE_URL}/api/nonexistent")
        assert r.status_code == 404
        assert "application/json" in r.headers.get("content-type", "")
