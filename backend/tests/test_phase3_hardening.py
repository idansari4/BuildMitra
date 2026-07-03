"""Phase 3 - Security + Performance backend tests.
Covers rate limiting, input sanitization, photo validation,
CORS in dev mode, and Mongo indexes.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"mobile": "9000000000", "password": "admin1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
WORKER = {"mobile": "9000000002", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}


def _login(creds):
    r = requests.post(f"{API}/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json()["token"]


def _auth(tok):
    return {"Authorization": f"Bearer {tok}"}


def _uid_ip():
    """Unique IP so tests don't interfere with each other (rate-limit-safe)."""
    return f"10.99.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"


# ---------- Rate limiting ----------
class TestRateLimit:
    """Verifies auth endpoints throttle on rapid repeated calls per IP."""

    def test_login_rate_limit_returns_429(self):
        ip = _uid_ip()
        h = {"X-Forwarded-For": ip}
        # 10 allowed. Use bad creds to avoid affecting real accounts.
        bad = {"mobile": "9999999999", "password": "wrong"}
        codes = []
        for _ in range(11):
            r = requests.post(f"{API}/auth/login", json=bad, headers=h, timeout=20)
            codes.append(r.status_code)
        # At least one 429 in the last few
        assert 429 in codes, f"expected 429 within first 11 hits, got {codes}"
        # First 10 should be 401 (invalid creds), then 429
        assert codes[:10].count(401) >= 8, f"expected 401s before throttle, got {codes}"

    def test_register_rate_limit_5_per_min(self):
        ip = _uid_ip()
        h = {"X-Forwarded-For": ip}
        codes = []
        for i in range(6):
            body = {
                "name": f"TEST_ratelimit_{i}",
                "mobile": f"77{uuid.uuid4().int % 100000000:08d}",
                "password": "demo1234",
                "role": "worker",
            }
            r = requests.post(f"{API}/auth/register", json=body, headers=h, timeout=20)
            codes.append(r.status_code)
        assert 429 in codes, f"expected 429 on 6th register hit, got {codes}"

    def test_otp_send_rate_limit_3_per_min(self):
        ip = _uid_ip()
        h = {"X-Forwarded-For": ip}
        codes = []
        for _ in range(4):
            r = requests.post(f"{API}/auth/otp/send", json={"mobile": "9000000002"}, headers=h, timeout=20)
            codes.append(r.status_code)
        assert codes[-1] == 429, f"expected 429 on 4th OTP send, got {codes}"

    def test_forgot_password_rate_limit_10_per_min(self):
        ip = _uid_ip()
        h = {"X-Forwarded-For": ip}
        codes = []
        for _ in range(11):
            r = requests.post(f"{API}/auth/forgot-password", json={"mobile": "9000000002"}, headers=h, timeout=20)
            codes.append(r.status_code)
        assert 429 in codes, f"expected 429 within 11 forgot hits, got {codes}"

    def test_different_ips_not_shared(self):
        """Rate limits are per-IP; different IPs should not affect each other."""
        ip_a = _uid_ip()
        ip_b = _uid_ip()
        bad = {"mobile": "9999999999", "password": "wrong"}
        # Exhaust IP A
        for _ in range(11):
            requests.post(f"{API}/auth/login", json=bad, headers={"X-Forwarded-For": ip_a}, timeout=20)
        # IP B should still work
        r = requests.post(f"{API}/auth/login", json=bad, headers={"X-Forwarded-For": ip_b}, timeout=20)
        assert r.status_code == 401, f"IP B should not be throttled, got {r.status_code}"


# ---------- Photo / sanitization ----------
class TestProgressPhotoValidation:
    @classmethod
    def setup_class(cls):
        cls.client_tok = _login(CLIENT)
        # Ensure at least one job exists
        r = requests.get(f"{API}/jobs", headers=_auth(cls.client_tok), timeout=20)
        assert r.status_code == 200
        jobs = r.json()
        if not jobs:
            # create one
            body = {"title": "TEST_p3_job", "description": "phase3 test", "skill": "Mason",
                    "location": "Testville", "lat": 12.9, "lng": 77.6, "budget": 1000}
            rc = requests.post(f"{API}/jobs", json=body, headers=_auth(cls.client_tok), timeout=20)
            assert rc.status_code == 200, rc.text
            jobs = [rc.json()]
        cls.job_id = jobs[0]["id"]

    def test_photo_too_large_returns_413(self):
        big = "data:image/png;base64," + ("A" * 4_000_001)
        body = {"job_id": self.job_id, "photo": big, "caption": "big"}
        r = requests.post(f"{API}/progress-photos", json=body, headers=_auth(self.client_tok), timeout=30)
        assert r.status_code == 413, f"expected 413, got {r.status_code} {r.text[:200]}"
        assert "too large" in r.text.lower()

    def test_photo_invalid_format_400(self):
        body = {"job_id": self.job_id, "photo": "plain-string-no-data-url", "caption": "x"}
        r = requests.post(f"{API}/progress-photos", json=body, headers=_auth(self.client_tok), timeout=20)
        assert r.status_code == 400, r.text
        assert "invalid image" in r.text.lower()

    def test_caption_sanitization_strips_nulls(self):
        # tiny valid data URL
        photo = "data:image/png;base64,iVBORw0KGgo="
        raw_caption = "hello\x00world\x01test\x1f end"
        body = {"job_id": self.job_id, "photo": photo, "caption": raw_caption}
        r = requests.post(f"{API}/progress-photos", json=body, headers=_auth(self.client_tok), timeout=20)
        assert r.status_code == 200, r.text
        stored_caption = r.json().get("caption", "")
        assert "\x00" not in stored_caption, f"null byte not stripped: {stored_caption!r}"
        assert "\x01" not in stored_caption
        assert "\x1f" not in stored_caption
        # printable chars retained
        assert "hello" in stored_caption
        assert "world" in stored_caption

    def test_empty_photo_allowed(self):
        body = {"job_id": self.job_id, "photo": "", "caption": "no photo"}
        r = requests.post(f"{API}/progress-photos", json=body, headers=_auth(self.client_tok), timeout=20)
        assert r.status_code == 200, r.text


# ---------- Mongo indexes ----------
class TestMongoIndexes:
    """Verify indexes were created via a Mongo-driver connection.
    Uses the same MONGO_URL as backend."""
    @classmethod
    def setup_class(cls):
        try:
            from pymongo import MongoClient
        except ImportError:
            pytest.skip("pymongo not installed")
        # Load backend env
        env_path = "/app/backend/.env"
        env = {}
        if os.path.exists(env_path):
            for line in open(env_path):
                if "=" in line and not line.strip().startswith("#"):
                    k, _, v = line.strip().partition("=")
                    env[k] = v.strip().strip('"').strip("'")
        mongo_url = env.get("MONGO_URL") or os.environ.get("MONGO_URL")
        db_name = env.get("DB_NAME") or os.environ.get("DB_NAME")
        if not mongo_url or not db_name:
            pytest.skip("Mongo env not available")
        cls.mc = MongoClient(mongo_url, serverSelectionTimeoutMS=3000)
        cls.db = cls.mc[db_name]

    def _idx_keys(self, coll):
        return {tuple(i["key"].items()): i for i in self.db[coll].list_indexes()}

    def test_users_mobile_unique_index(self):
        idxs = list(self.db.users.list_indexes())
        # Find mobile index
        mobile_idx = next((i for i in idxs if i["key"].get("mobile") is not None), None)
        assert mobile_idx is not None, "users.mobile index missing"
        assert mobile_idx.get("unique") is True, f"users.mobile not unique: {mobile_idx}"

    def test_users_role_and_id_indexes(self):
        keys = {list(i["key"].keys())[0] for i in self.db.users.list_indexes()}
        assert "role" in keys, f"users.role missing, got {keys}"
        assert "id" in keys, f"users.id missing, got {keys}"

    def test_jobs_indexes(self):
        keys = {list(i["key"].keys())[0] for i in self.db.jobs.list_indexes()}
        for req in ("posted_by", "status", "skill", "created_at", "id"):
            assert req in keys, f"jobs.{req} index missing (have {keys})"

    def test_applications_composite_index(self):
        idxs = list(self.db.applications.list_indexes())
        keys = [tuple(i["key"].items()) for i in idxs]
        composite = (("worker_id", 1), ("status", 1))
        assert composite in keys, f"applications composite {composite} missing, got {keys}"

    def test_attendance_composite_indexes(self):
        idxs = list(self.db.attendance.list_indexes())
        keys = [tuple(i["key"].items()) for i in idxs]
        assert (("worker_id", 1), ("created_at", -1)) in keys, f"missing, got {keys}"
        assert (("job_id", 1), ("created_at", -1)) in keys, f"missing, got {keys}"

    def test_erp_collections_indexed(self):
        for coll in ("materials", "tools", "estimates", "bills"):
            names = {list(i["key"].keys())[0] for i in self.db[coll].list_indexes()}
            assert "owner" in names, f"{coll}.owner missing (have {names})"

    def test_chat_messages_composite(self):
        idxs = list(self.db.chat_messages.list_indexes())
        keys = [tuple(i["key"].items()) for i in idxs]
        assert (("thread_id", 1), ("created_at", -1)) in keys, keys

    def test_progress_photos_composite(self):
        idxs = list(self.db.progress_photos.list_indexes())
        keys = [tuple(i["key"].items()) for i in idxs]
        assert (("job_id", 1), ("created_at", -1)) in keys, keys

    def test_password_resets_ttl(self):
        idxs = list(self.db.password_resets.list_indexes())
        ttl_idx = next((i for i in idxs if i["key"].get("expires_at") is not None), None)
        assert ttl_idx is not None, "expires_at TTL index missing"
        # expireAfterSeconds should be 0
        assert ttl_idx.get("expireAfterSeconds") == 0, ttl_idx

        mobile_idx = next((i for i in idxs if i["key"].get("mobile") is not None), None)
        assert mobile_idx is not None and mobile_idx.get("unique") is True

    def test_wallet_txns_composite(self):
        idxs = list(self.db.wallet_txns.list_indexes())
        keys = [tuple(i["key"].items()) for i in idxs]
        assert (("user_id", 1), ("created_at", -1)) in keys, keys


# ---------- CORS ----------
class TestCORS:
    def test_default_cors_allows_all_when_env_unset(self):
        """OPTIONS preflight should respond with '*' or the requesting origin in dev."""
        r = requests.options(
            f"{API}/health",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
            },
            timeout=20,
        )
        # Preflight can return 200 or 204
        assert r.status_code in (200, 204), r.status_code
        allow = r.headers.get("access-control-allow-origin", "")
        # In dev (no ALLOWED_ORIGINS set) it should be '*' OR echo the origin.
        assert allow in ("*", "https://example.com"), f"unexpected CORS header: {allow!r}"

    def test_get_health_returns_ok(self):
        r = requests.get(f"{API}/health", timeout=20)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"


# ---------- Smoke: no new breakage ----------
class TestSmokeNoBreakage:
    def test_login_valid_creds(self):
        tok = _login(WORKER)
        assert isinstance(tok, str) and len(tok) > 10

    def test_me_returns_user(self):
        tok = _login(WORKER)
        r = requests.get(f"{API}/me", headers=_auth(tok), timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("mobile") == WORKER["mobile"]
        assert data.get("role") == "worker"
        assert "password" not in data
        assert "_id" not in data

    def test_jobs_list(self):
        tok = _login(WORKER)
        r = requests.get(f"{API}/jobs", headers=_auth(tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_complaints_mine(self):
        tok = _login(WORKER)
        r = requests.get(f"{API}/complaints/mine", headers=_auth(tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)
