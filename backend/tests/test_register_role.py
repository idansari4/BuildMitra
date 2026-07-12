"""Tests for the role-selection register flow.

Validates:
- POST /api/auth/register accepts each valid role (worker/contractor/client)
- Persists the correct role via token->/api/me
- Rejects invalid roles with HTTP 400
- Existing demo accounts still login (regression)
"""
import os
import random
import string
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback used only when the outer env doesn't propagate; production URL
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("EXPO_PUBLIC_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL missing"


def _rand_mobile() -> str:
    # 10-digit test mobile starting with 7 (avoids collision with demo 9xxxxxx)
    return "7" + "".join(random.choice(string.digits) for _ in range(9))


@pytest.fixture
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Register (role selection) ----------
class TestRegisterRoles:
    @pytest.mark.parametrize("role", ["worker", "contractor", "client"])
    def test_register_each_role_succeeds_and_persists(self, api, role):
        mobile = _rand_mobile()
        payload = {
            "name": f"TEST_{role}_user",
            "mobile": mobile,
            "password": "test1234",
            "role": role,
        }
        r = api.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
        assert r.status_code == 200, f"register {role} failed: {r.status_code} {r.text}"
        data = r.json()
        assert "token" in data and data["token"], "token missing"
        assert data.get("user", {}).get("role") == role, "role mismatch in response"

        # Confirm role persisted by calling /api/me with the returned token
        me = api.get(
            f"{BASE_URL}/api/me",
            headers={"Authorization": f"Bearer {data['token']}"},
            timeout=15,
        )
        assert me.status_code == 200
        assert me.json().get("role") == role
        assert me.json().get("mobile") == mobile

    @pytest.mark.parametrize("bad_role", ["admin", "foo", "", "WORKER"])
    def test_register_invalid_role_returns_400(self, api, bad_role):
        payload = {
            "name": "TEST_bad_role",
            "mobile": _rand_mobile(),
            "password": "test1234",
            "role": bad_role,
        }
        r = api.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=15)
        # Empty role may also be caught by pydantic as 422; both are acceptable
        assert r.status_code in (400, 422), f"expected 4xx, got {r.status_code} {r.text}"


# ---------- Regression: demo logins still work ----------
class TestDemoLogins:
    @pytest.mark.parametrize(
        "mobile,password,expected_role",
        [
            ("9000000002", "demo1234", "worker"),
            ("9000000001", "demo1234", "client"),
            ("9000000003", "demo1234", "contractor"),
            ("9000000000", "admin1234", "admin"),
        ],
    )
    def test_demo_login(self, api, mobile, password, expected_role):
        r = api.post(
            f"{BASE_URL}/api/auth/login",
            json={"mobile": mobile, "password": password},
            timeout=15,
        )
        assert r.status_code == 200, f"login {mobile} failed: {r.status_code} {r.text}"
        data = r.json()
        assert data.get("user", {}).get("role") == expected_role
        assert data.get("token")
