"""BuildMitra — Password change & Profile photo update tests.

Covers:
  - PUT /api/me/password (validation, auth guards, success, login-after-change)
  - PUT /api/me with `photo` (set / clear) + regression on other fields
  - Existing endpoints unaffected (POST /api/auth/login, GET /api/me, PUT /api/me)

Uses Worker account 9000000002/demo1234. Reverts the password at the end of the
class via teardown so subsequent runs and the UI demo flow keep working.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

WORKER_MOBILE = "9000000002"
WORKER_PW = "demo1234"
NEW_PW = "newpass99"

TINY_JPEG_B64 = (
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw"
    "8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh"
    "4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAABAAEDASIAAh"
    "EBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAA"
    "AAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwBVAB//2Q=="
)


# ---------- fixtures ----------
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _login(session, mobile, password):
    return session.post(f"{API}/auth/login", json={"mobile": mobile, "password": password})


def _hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="class")
def worker(session):
    r = _login(session, WORKER_MOBILE, WORKER_PW)
    assert r.status_code == 200, f"baseline login failed: {r.status_code} {r.text}"
    data = r.json()
    return {"token": data["token"], "user": data["user"]}


# ---------- 1. Password change ----------
class TestPasswordChange:
    """All tests share the worker fixture; final test reverts password back."""

    def test_no_auth_returns_401_or_403(self, session):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW, "new_password": NEW_PW},
        )
        # current_user dep raises 401 on missing Bearer
        assert r.status_code in (401, 403), r.text

    def test_invalid_token_returns_401(self, session):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW, "new_password": NEW_PW},
            headers={"Authorization": "Bearer not-a-real-token"},
        )
        assert r.status_code == 401

    def test_missing_old_password_empty_string(self, session, worker):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": "", "new_password": NEW_PW},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code == 400
        assert r.json().get("detail") == "Old and new password required"

    def test_missing_new_password_empty_string(self, session, worker):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW, "new_password": ""},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code == 400
        assert r.json().get("detail") == "Old and new password required"

    def test_missing_field_returns_422(self, session, worker):
        """Pydantic model requires both fields — missing key triggers 422 validation."""
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code in (400, 422), r.text

    def test_new_password_too_short(self, session, worker):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW, "new_password": "abc"},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code == 400
        assert r.json().get("detail") == "New password must be at least 4 characters"

    def test_wrong_old_password(self, session, worker):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": "wrong-old-pw", "new_password": NEW_PW},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code == 401
        assert r.json().get("detail") == "Old password is incorrect"

    def test_change_success(self, session, worker):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": WORKER_PW, "new_password": NEW_PW},
            headers=_hdr(worker["token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("ok") is True
        assert body.get("message") == "Password updated"

    def test_password_updated_at_set_on_user(self, session, worker):
        r = session.get(f"{API}/me", headers=_hdr(worker["token"]))
        assert r.status_code == 200
        me = r.json()
        assert "password_updated_at" in me, "password_updated_at must be persisted"
        assert me["password_updated_at"], "password_updated_at must not be empty"
        # passes through current_user dep which strips raw password
        assert "password" not in me

    def test_old_password_rejected_after_change(self, session):
        r = _login(session, WORKER_MOBILE, WORKER_PW)
        assert r.status_code == 401
        assert r.json().get("detail") == "Invalid credentials"

    def test_login_with_new_password_works(self, session):
        r = _login(session, WORKER_MOBILE, NEW_PW)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "token" in data
        assert data["user"]["mobile"] == WORKER_MOBILE

    def test_revert_password_to_demo(self, session):
        """Teardown — revert so demo creds keep working for next runs / UI demo."""
        r = _login(session, WORKER_MOBILE, NEW_PW)
        assert r.status_code == 200, "must be able to login with new pw to revert"
        token = r.json()["token"]
        rv = session.put(
            f"{API}/me/password",
            json={"old_password": NEW_PW, "new_password": WORKER_PW},
            headers=_hdr(token),
        )
        assert rv.status_code == 200, rv.text
        # final sanity — login with demo1234 works again
        verify = _login(session, WORKER_MOBILE, WORKER_PW)
        assert verify.status_code == 200, "post-revert login with demo1234 must work"


# ---------- 2. Profile photo update + regression ----------
@pytest.fixture(scope="class")
def worker_fresh(session):
    """Independent login (after revert) for profile tests."""
    r = _login(session, WORKER_MOBILE, WORKER_PW)
    assert r.status_code == 200, r.text
    return {"token": r.json()["token"], "user": r.json()["user"]}


class TestProfilePhoto:
    def test_set_photo_persists(self, session, worker_fresh):
        r = session.put(
            f"{API}/me",
            json={"photo": TINY_JPEG_B64},
            headers=_hdr(worker_fresh["token"]),
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("photo") == TINY_JPEG_B64

        # verify persisted via GET /me
        me = session.get(f"{API}/me", headers=_hdr(worker_fresh["token"])).json()
        assert me.get("photo") == TINY_JPEG_B64

    def test_clear_photo_with_empty_string(self, session, worker_fresh):
        r = session.put(
            f"{API}/me",
            json={"photo": ""},
            headers=_hdr(worker_fresh["token"]),
        )
        assert r.status_code == 200, r.text
        # photo must now be empty string (cleared)
        assert r.json().get("photo") == ""
        me = session.get(f"{API}/me", headers=_hdr(worker_fresh["token"])).json()
        assert me.get("photo") == ""

    def test_other_fields_regression(self, session, worker_fresh):
        """skills/city/daily_wage updates still work (no regression)."""
        payload = {
            "skills": ["Mason", "Plumber"],
            "city": "TEST_City_Pune",
            "daily_wage": 777,
            "experience_years": 5,
            "available": True,
            "language": "hi",
        }
        r = session.put(f"{API}/me", json=payload, headers=_hdr(worker_fresh["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["skills"] == ["Mason", "Plumber"]
        assert body["city"] == "TEST_City_Pune"
        assert body["daily_wage"] == 777
        assert body["experience_years"] == 5
        assert body["available"] is True
        assert body["language"] == "hi"

        me = session.get(f"{API}/me", headers=_hdr(worker_fresh["token"])).json()
        assert me["skills"] == ["Mason", "Plumber"]
        assert me["city"] == "TEST_City_Pune"
        assert me["daily_wage"] == 777

    def test_partial_update_does_not_wipe_fields(self, session, worker_fresh):
        """Only update name; city/daily_wage from prior test must remain."""
        r = session.put(
            f"{API}/me",
            json={"name": "Ramesh Kumar"},
            headers=_hdr(worker_fresh["token"]),
        )
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "Ramesh Kumar"
        assert body["city"] == "TEST_City_Pune"
        assert body["daily_wage"] == 777

    def test_put_me_no_auth(self, session):
        r = session.put(f"{API}/me", json={"photo": TINY_JPEG_B64})
        assert r.status_code in (401, 403)


# ---------- 3. Existing-endpoints sanity ----------
class TestExistingEndpoints:
    def test_login_still_works(self, session):
        r = _login(session, WORKER_MOBILE, WORKER_PW)
        assert r.status_code == 200
        body = r.json()
        assert "token" in body
        assert body["user"]["role"] == "worker"
        assert "password" not in body["user"]

    def test_login_other_roles(self, session):
        for mob, role in (("9000000001", "client"), ("9000000003", "contractor")):
            r = _login(session, mob, WORKER_PW)
            assert r.status_code == 200, f"{mob} login failed: {r.text}"
            assert r.json()["user"]["role"] == role

    def test_get_me_returns_full_user(self, session):
        r = _login(session, WORKER_MOBILE, WORKER_PW)
        token = r.json()["token"]
        me = session.get(f"{API}/me", headers=_hdr(token))
        assert me.status_code == 200
        u = me.json()
        # important fields present
        for k in ("id", "mobile", "role", "name", "referral_code", "wallet_balance"):
            assert k in u, f"missing field {k}"
        # password never leaks
        assert "password" not in u

    def test_put_me_full_profile_body(self, session):
        """Full-shape PUT /me with all ProfileUpdate fields still works."""
        r = _login(session, WORKER_MOBILE, WORKER_PW)
        token = r.json()["token"]
        payload = {
            "name": "Ramesh Kumar",
            "photo": None,  # None ignored by filter, so prior value retained
            "skills": ["Mason"],
            "experience_years": 6,
            "daily_wage": 800,
            "available": True,
            "city": "Pune",
            "company_name": "",
            "language": "en",
        }
        r2 = session.put(f"{API}/me", json=payload, headers=_hdr(token))
        assert r2.status_code == 200, r2.text
        body = r2.json()
        assert body["name"] == "Ramesh Kumar"
        assert body["daily_wage"] == 800
        assert body["experience_years"] == 6
        assert body["city"] == "Pune"
        assert body["language"] == "en"
