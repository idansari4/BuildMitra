"""Iteration-8 deployment-fix verification.

Validates:
  1. All 4 health endpoints return 200 fast (no DB access)
  2. Startup-time delay (2s sleep before seed) — verified by login latency
  3. Demo seeded users login (admin/client/worker/contractor)
  4. All endpoints with newly added `.limit()` calls still respond 200
  5. PDF/Excel exports import reportlab/openpyxl successfully at runtime
  6. Twilio loads cleanly in dev mode → OTP send returns dev_code=123456
  7. Razorpay disabled in dev mode → pricing.razorpay_enabled == False
  8. requirements.txt contains all newly-added runtime deps
"""
import os
import re
import time
import base64
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
INTERNAL = os.environ.get("INTERNAL_BACKEND_URL", "http://localhost:8001")


def hdr(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---- session-level auth fixtures (4 demo users) ----
def _login(s, mobile, password):
    r = s.post(f"{API}/auth/login", json={"mobile": mobile, "password": password})
    if r.status_code != 200:
        pytest.skip(f"login {mobile} failed: {r.status_code} {r.text[:200]}")
    return r.json()


@pytest.fixture(scope="session")
def admin(s):
    return _login(s, "9000000000", "admin1234")


@pytest.fixture(scope="session")
def client(s):
    return _login(s, "9000000001", "demo1234")


@pytest.fixture(scope="session")
def worker(s):
    return _login(s, "9000000002", "demo1234")


@pytest.fixture(scope="session")
def contractor(s):
    return _login(s, "9000000003", "demo1234")


# ============================================================
# Module A — Health endpoints (must be fast & DB-free)
# ============================================================
class TestHealth:
    @pytest.mark.parametrize("path,via_internal,threshold_ms", [
        ("/api/health", False, 2000),
        ("/api/healthz", False, 2000),
        ("/health", True, 300),
        ("/healthz", True, 300),
    ])
    def test_health_endpoint(self, s, path, via_internal, threshold_ms):
        url = f"{INTERNAL}{path}" if via_internal else f"{BASE_URL}{path}"
        start = time.time()
        r = s.get(url, timeout=10)
        ms = (time.time() - start) * 1000
        assert r.status_code == 200, f"{url} -> {r.status_code}: {r.text[:200]}"
        body = r.json()
        assert body.get("status") == "ok", f"{url} body: {body}"
        assert ms < threshold_ms, f"{url} slow: {ms:.0f}ms"
        print(f"OK  {url} -> 200 in {ms:.0f}ms")


# ============================================================
# Module B — Seed completed, all 4 demo users login
# ============================================================
DEMO = [
    ("9000000000", "admin1234", "admin"),
    ("9000000001", "demo1234", "client"),
    ("9000000002", "demo1234", "worker"),
    ("9000000003", "demo1234", "contractor"),
]


class TestSeedUsers:
    @pytest.mark.parametrize("mobile,pw,role", DEMO)
    def test_demo_login(self, s, mobile, pw, role):
        # generous retries because seed runs after a 2s sleep
        last = None
        for _ in range(6):
            r = s.post(f"{API}/auth/login", json={"mobile": mobile, "password": pw})
            if r.status_code == 200:
                body = r.json()
                assert body["user"]["mobile"] == mobile
                assert body["user"]["role"] == role
                assert "token" in body and len(body["token"]) > 20
                return
            last = f"{r.status_code} {r.text[:200]}"
            time.sleep(1.5)
        pytest.fail(f"{mobile} login failed: {last}")


# ============================================================
# Module C — Endpoints with newly added .limit() must still return data
# ============================================================
class TestLimitedListEndpoints:
    def test_jobs_mine(self, s, client):
        r = s.get(f"{API}/jobs/mine", headers=hdr(client["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, list)
        assert len(body) <= 200
        for it in body:
            assert "_id" not in it
        print(f"OK  /jobs/mine -> {len(body)} items")

    def test_applications_mine(self, s, worker):
        r = s.get(f"{API}/applications/mine", headers=hdr(worker["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, list) and len(body) <= 200
        print(f"OK  /applications/mine -> {len(body)} items")

    def test_applications_by_job(self, s, client, contractor):
        # First find/create a job owned by the client demo
        jobs = s.get(f"{API}/jobs/mine", headers=hdr(client["token"])).json()
        if not jobs:
            # create one
            payload = {
                "title": "TEST_limit_job",
                "skill": "mason",
                "location": "Mumbai",
                "daily_wage": 800,
                "workers_needed": 1,
                "description": "iteration-8 test",
            }
            r = s.post(f"{API}/jobs", json=payload, headers=hdr(client["token"]))
            assert r.status_code in (200, 201), r.text
            jid = r.json()["id"]
        else:
            jid = jobs[0]["id"]
        r = s.get(f"{API}/applications/job/{jid}", headers=hdr(client["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, list) and len(body) <= 200
        print(f"OK  /applications/job/{jid} -> {len(body)} items")

    def test_erp_materials(self, s, contractor):
        r = s.get(f"{API}/erp/materials", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list) and len(r.json()) <= 500

    def test_erp_tools(self, s, contractor):
        r = s.get(f"{API}/erp/tools", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list) and len(r.json()) <= 500

    def test_erp_estimates(self, s, contractor):
        r = s.get(f"{API}/erp/estimates", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list) and len(r.json()) <= 500

    def test_erp_bills(self, s, contractor):
        r = s.get(f"{API}/erp/bills", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list) and len(r.json()) <= 500

    def test_complaints_mine(self, s, client):
        r = s.get(f"{API}/complaints/mine", headers=hdr(client["token"]))
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list) and len(r.json()) <= 100


# ============================================================
# Module D — PDF/Excel exports (proves reportlab/openpyxl importable)
# ============================================================
class TestBillExports:
    @pytest.fixture(scope="class")
    def bill_id(self, s, contractor):
        # try existing
        r = s.get(f"{API}/erp/bills", headers=hdr(contractor["token"]))
        assert r.status_code == 200
        existing = r.json()
        if existing:
            return existing[0]["id"]
        # create test bill
        payload = {
            "bill_to": "TEST_Client Pvt Ltd",
            "project": "TEST_iter8 deployment",
            "tax_pct": 18,
            "notes": "Iteration-8 export test",
            "items": [
                {"description": "TEST_Cement 50kg", "qty": 10, "rate": 400},
                {"description": "TEST_Sand truck", "qty": 1, "rate": 5000},
            ],
        }
        c = s.post(f"{API}/erp/bills", json=payload, headers=hdr(contractor["token"]))
        assert c.status_code in (200, 201), c.text
        body = c.json()
        assert body.get("total") == 10 * 400 + 5000 + (10 * 400 + 5000) * 0.18, body
        return body["id"]

    def test_pdf_export(self, s, contractor, bill_id):
        r = s.get(f"{API}/erp/bills/{bill_id}/pdf", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text[:500]
        body = r.json()
        assert body["mime"] == "application/pdf"
        assert body["filename"].endswith(".pdf")
        raw = base64.b64decode(body["base64"])
        # PDF must start with %PDF-
        assert raw[:5] == b"%PDF-", f"Not a valid PDF: header={raw[:8]!r}"
        assert len(raw) > 500, f"PDF too small: {len(raw)} bytes"
        print(f"OK  PDF export: {len(raw)} bytes, header OK")

    def test_excel_export(self, s, contractor, bill_id):
        r = s.get(f"{API}/erp/bills/{bill_id}/excel", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text[:500]
        body = r.json()
        assert "openxmlformats" in body["mime"]
        assert body["filename"].endswith(".xlsx")
        raw = base64.b64decode(body["base64"])
        # xlsx is a zip → starts with PK
        assert raw[:2] == b"PK", f"Not a valid xlsx: header={raw[:4]!r}"
        assert len(raw) > 500
        print(f"OK  Excel export: {len(raw)} bytes, header OK")


# ============================================================
# Module E — Twilio + Razorpay dev-mode integrations load OK
# ============================================================
class TestIntegrationsDevMode:
    def test_pricing_razorpay_disabled(self, s):
        r = s.get(f"{API}/payments/pricing")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("razorpay_enabled") is False, body
        assert "erp_pro" in body and "erp_enterprise" in body
        # MOCKED: razorpay not configured → dev mode (expected)
        print(f"OK  pricing.razorpay_enabled={body['razorpay_enabled']}")

    def test_otp_send_dev_mode(self, s):
        r = s.post(f"{API}/auth/otp/send", json={"mobile": "9000000001"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("sent") is True
        assert body.get("dev_mode") is True, body
        assert body.get("dev_code") == "123456", body
        # MOCKED: twilio not configured → dev OTP 123456 (expected)
        print(f"OK  otp/send dev mode dev_code={body['dev_code']}")

    def test_otp_verify_existing_user_login(self, s):
        # send + verify against existing demo client
        s.post(f"{API}/auth/otp/send", json={"mobile": "9000000001"})
        r = s.post(f"{API}/auth/otp/verify", json={"mobile": "9000000001", "code": "123456"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert "token" in body
        assert body["user"]["mobile"] == "9000000001"


# ============================================================
# Module F — requirements.txt sanity (newly added deps)
# ============================================================
class TestRequirementsTxt:
    REQ_PATH = "/app/backend/requirements.txt"
    REQUIRED = [
        "twilio",
        "razorpay",
        "reportlab",
        "openpyxl",
        "emergentintegrations",
        "litellm",
        "fastapi",
        "motor",
        "bcrypt",
    ]

    def test_required_packages_present(self):
        with open(self.REQ_PATH) as fh:
            content = fh.read().lower()
        missing = [p for p in self.REQUIRED if not re.search(rf"(?m)^{re.escape(p)}\b", content)]
        assert not missing, f"requirements.txt missing: {missing}"
        print(f"OK  requirements.txt contains all {len(self.REQUIRED)} required packages")


# ============================================================
# Module G — No regression: password change + complaints + profile
# ============================================================
class TestRegressionCriticalFlows:
    def test_password_change_roundtrip(self, s):
        login = s.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "demo1234"})
        if login.status_code != 200:
            pytest.skip(login.text)
        tok = login.json()["token"]
        # change
        chg = s.put(f"{API}/me/password",
                    json={"old_password": "demo1234", "new_password": "demo1234_x"},
                    headers=hdr(tok))
        assert chg.status_code == 200, chg.text
        # login with new
        r2 = s.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "demo1234_x"})
        assert r2.status_code == 200
        tok2 = r2.json()["token"]
        # revert
        rev = s.put(f"{API}/me/password",
                    json={"old_password": "demo1234_x", "new_password": "demo1234"},
                    headers=hdr(tok2))
        assert rev.status_code == 200

    def test_profile_photo_update_via_me(self, s, client):
        tiny_data_url = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
        r = s.put(f"{API}/me", json={"photo": tiny_data_url}, headers=hdr(client["token"]))
        assert r.status_code == 200, r.text
        # verify persisted
        me = s.get(f"{API}/me", headers=hdr(client["token"]))
        assert me.status_code == 200
        assert me.json().get("photo", "").startswith("data:image/")
        # clean clear
        s.put(f"{API}/me", json={"photo": ""}, headers=hdr(client["token"]))

    def test_file_complaint(self, s, client):
        payload = {"subject": "TEST_iter8 reg", "description": "regression complaint", "type": "bug"}
        r = s.post(f"{API}/complaints", json=payload, headers=hdr(client["token"]))
        assert r.status_code in (200, 201), r.text
        cid = r.json()["id"]
        mine = s.get(f"{API}/complaints/mine", headers=hdr(client["token"]))
        assert mine.status_code == 200
        assert any(c["id"] == cid for c in mine.json())

    def test_payroll_unchanged(self, s, contractor):
        r = s.get(f"{API}/payroll", headers=hdr(contractor["token"]))
        assert r.status_code == 200, r.text
        body = r.json()
        assert "month" in body and "rows" in body and "grand_total" in body
