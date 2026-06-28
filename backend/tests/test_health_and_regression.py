"""Tests for the deployment fix: health endpoints + regression on critical APIs.

Validates:
  1. /api/health, /api/healthz, /health, /healthz, /api/ all return 200 fast
  2. Light load: 50 rapid hits to /api/health
  3. Seed users present (demo users seeded in background task)
  4. No regression on auth, /api/me, /api/me/password, complaints, payroll
"""
import os
import time
import pytest
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
# K8s liveness/readiness probes hit the pod containerPort directly (not via public ingress).
# The public ingress only routes /api/* to the backend; root paths go to the Expo frontend.
# So we validate root-level /health and /healthz against the internal backend port.
INTERNAL_BACKEND = os.environ.get("INTERNAL_BACKEND_URL", "http://localhost:8001")

# ---- helpers ----
@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def hdr(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---- Module 1: Health endpoints ----
class TestHealthEndpoints:
    """All health endpoints return 200 with {'status':'ok'} and respond fast (<2s over network)."""

    @pytest.mark.parametrize("path,expected_key,via_internal", [
        ("/api/health", "status", False),
        ("/api/healthz", "status", False),
        # Root-level health endpoints exist for K8s liveness/readiness probes which
        # hit the pod containerPort (8001) directly. The public ingress only routes
        # /api/* to the backend, so we validate these on the internal port.
        ("/health", "status", True),
        ("/healthz", "status", True),
    ])
    def test_health_endpoint_200(self, session, path, expected_key, via_internal):
        url = f"{INTERNAL_BACKEND}{path}" if via_internal else f"{BASE_URL}{path}"
        start = time.time()
        r = session.get(url)
        elapsed_ms = (time.time() - start) * 1000
        assert r.status_code == 200, f"{url} -> {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get(expected_key) == "ok", f"{url} body: {body}"
        # Internal should be <100ms; over public ingress allow 2s
        threshold = 200 if via_internal else 2000
        assert elapsed_ms < threshold, f"{url} too slow: {elapsed_ms:.0f}ms"
        print(f"{url} -> 200 in {elapsed_ms:.0f}ms")

    def test_api_root_alive(self, session):
        r = session.get(f"{API}/")
        assert r.status_code == 200
        body = r.json()
        assert body.get("ok") is True
        assert body.get("app") == "BuildMitra"


# ---- Module 2: Light load test (simulates K8s probe pattern) ----
class TestHealthLoad:
    def test_50_rapid_sequential_hits(self, session):
        latencies = []
        failures = 0
        for _ in range(50):
            start = time.time()
            r = session.get(f"{API}/health")
            latencies.append((time.time() - start) * 1000)
            if r.status_code != 200 or r.json().get("status") != "ok":
                failures += 1
        avg = sum(latencies) / len(latencies)
        p95 = sorted(latencies)[int(0.95 * len(latencies))]
        print(f"50 sequential: avg={avg:.1f}ms p95={p95:.1f}ms failures={failures}")
        assert failures == 0, f"{failures}/50 health probes failed"
        # network-tolerant
        assert avg < 1000, f"avg latency too high: {avg:.1f}ms"

    def test_50_concurrent_hits(self, session):
        def hit(_):
            try:
                r = requests.get(f"{API}/health", timeout=10)
                return r.status_code == 200 and r.json().get("status") == "ok"
            except Exception:
                return False
        start = time.time()
        with ThreadPoolExecutor(max_workers=20) as ex:
            results = list(ex.map(hit, range(50)))
        elapsed = time.time() - start
        ok = sum(1 for x in results if x)
        print(f"50 concurrent (20 workers): {ok}/50 ok in {elapsed:.2f}s")
        assert ok == 50, f"only {ok}/50 succeeded"


# ---- Module 3: Seed data (background task should have completed) ----
DEMO_USERS = [
    ("9000000001", "demo1234", "client"),
    ("9000000002", "demo1234", "worker"),
    ("9000000003", "demo1234", "contractor"),
    ("9000000000", "admin1234", "admin"),
]


class TestSeedUsers:
    """Demo users must be reachable via login (seeded as a background task)."""

    @pytest.mark.parametrize("mobile,password,role", DEMO_USERS)
    def test_demo_login(self, session, mobile, password, role):
        # Give the background seed task a small grace window if needed
        last_err = None
        for attempt in range(5):
            r = session.post(f"{API}/auth/login", json={"mobile": mobile, "password": password})
            if r.status_code == 200:
                body = r.json()
                assert body["user"]["mobile"] == mobile, body
                assert body["user"]["role"] == role, body
                assert "token" in body
                return
            last_err = f"{r.status_code}: {r.text[:200]}"
            time.sleep(1.5)
        pytest.fail(f"Demo user {mobile} ({role}) not seeded after 5 retries. last={last_err}")


# ---- Module 4: Regression on critical existing endpoints ----
@pytest.fixture(scope="session")
def client_auth(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000001", "password": "demo1234"})
    if r.status_code != 200:
        pytest.skip(f"client demo login failed: {r.status_code} {r.text[:200]}")
    return r.json()


@pytest.fixture(scope="session")
def worker_auth(session):
    r = session.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "demo1234"})
    if r.status_code != 200:
        pytest.skip(f"worker demo login failed: {r.status_code} {r.text[:200]}")
    return r.json()


class TestAuthAndProfile:
    def test_login_works(self, client_auth):
        assert client_auth["user"]["role"] == "client"
        assert client_auth["user"]["mobile"] == "9000000001"

    def test_me_endpoint(self, session, client_auth):
        r = session.get(f"{API}/me", headers=hdr(client_auth["token"]))
        assert r.status_code == 200
        body = r.json()
        assert body["mobile"] == "9000000001"
        assert body["role"] == "client"

    def test_me_unauthorized(self, session):
        r = session.get(f"{API}/me")
        assert r.status_code == 401

    def test_password_change_roundtrip(self, session):
        """Roundtrip password change for contractor demo (non-disruptive)."""
        r = session.post(f"{API}/auth/login", json={"mobile": "9000000003", "password": "demo1234"})
        if r.status_code != 200:
            pytest.skip(f"contractor seed login failed: {r.text[:200]}")
        token = r.json()["token"]

        # change to a new password
        chg = session.put(
            f"{API}/me/password",
            json={"old_password": "demo1234", "new_password": "demo1234_tmp"},
            headers=hdr(token),
        )
        assert chg.status_code == 200, chg.text

        # login with new
        r2 = session.post(f"{API}/auth/login", json={"mobile": "9000000003", "password": "demo1234_tmp"})
        assert r2.status_code == 200, r2.text
        t2 = r2.json()["token"]

        # revert
        rev = session.put(
            f"{API}/me/password",
            json={"old_password": "demo1234_tmp", "new_password": "demo1234"},
            headers=hdr(t2),
        )
        assert rev.status_code == 200, rev.text

        # confirm original works again
        r3 = session.post(f"{API}/auth/login", json={"mobile": "9000000003", "password": "demo1234"})
        assert r3.status_code == 200

    def test_password_change_wrong_old(self, session, client_auth):
        r = session.put(
            f"{API}/me/password",
            json={"old_password": "WRONG_PASS", "new_password": "newpw1234"},
            headers=hdr(client_auth["token"]),
        )
        assert r.status_code in (400, 401), r.text


class TestComplaints:
    def test_create_and_get_mine(self, session, client_auth):
        payload = {
            "type": "bug",
            "subject": "TEST_health_regression",
            "description": "automated test from test_health_and_regression",
        }
        r = session.post(f"{API}/complaints", json=payload, headers=hdr(client_auth["token"]))
        assert r.status_code in (200, 201), r.text
        body = r.json()
        assert body.get("subject") == "TEST_health_regression"
        cid = body.get("id")
        assert cid

        mine = session.get(f"{API}/complaints/mine", headers=hdr(client_auth["token"]))
        assert mine.status_code == 200, mine.text
        ids = [c.get("id") for c in mine.json()]
        assert cid in ids, f"new complaint {cid} not in /complaints/mine"


class TestPayroll:
    def test_payroll_get(self, session, client_auth):
        # Payroll requires contractor/client/admin role
        r = session.get(f"{API}/payroll", headers=hdr(client_auth["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        items = body if isinstance(body, list) else body.get("items", body.get("payroll", []))
        assert isinstance(items, list)
        for it in items:
            assert "_id" not in it, "Mongo _id leaked in payroll response"

    def test_payroll_forbidden_for_worker(self, session, worker_auth):
        r = session.get(f"{API}/payroll", headers=hdr(worker_auth["token"]))
        assert r.status_code == 403
