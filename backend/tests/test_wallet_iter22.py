"""Iter 22 tests: Wallet CSV/PDF export + withdrawal history endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "http://localhost:8001").rstrip("/")

WORKER = {"mobile": "9000000002", "password": "demo1234"}
CLIENT = {"mobile": "9000000001", "password": "demo1234"}
CONTRACTOR = {"mobile": "9000000003", "password": "demo1234"}
ADMIN = {"mobile": "9000000000", "password": "admin1234"}

EXPECTED_CSV_HEADER = "Date,Time,Type,Description,Amount (₹),Balance Effect,Status,Reference"


@pytest.fixture(scope="module")
def sess():
    return requests.Session()


def _login(sess, creds):
    r = sess.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=15)
    assert r.status_code == 200, f"Login failed for {creds['mobile']}: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, "No token in login response"
    return tok


@pytest.fixture(scope="module")
def worker_tok(sess):
    return _login(sess, WORKER)


@pytest.fixture(scope="module")
def client_tok(sess):
    return _login(sess, CLIENT)


@pytest.fixture(scope="module")
def contractor_tok(sess):
    return _login(sess, CONTRACTOR)


@pytest.fixture(scope="module")
def admin_tok(sess):
    return _login(sess, ADMIN)


# --- CSV export ---
class TestCsvExport:
    def test_worker_csv_export_ok(self, sess, worker_tok):
        r = sess.get(
            f"{BASE_URL}/api/wallet/export/csv",
            params={"months": 6},
            headers={"Authorization": f"Bearer {worker_tok}"},
            timeout=20,
        )
        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert ct.startswith("text/csv"), f"content-type={ct}"
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd.lower() and ".csv" in cd.lower(), f"disposition={cd}"
        body = r.text
        first_line = body.splitlines()[0].lstrip("\ufeff")
        assert first_line == EXPECTED_CSV_HEADER, f"first line: {first_line!r}"
        assert "TOTAL CREDIT" in body, "TOTAL CREDIT summary row missing"
        assert "NET" in body, "NET summary row missing"

    def test_client_csv_export_ok(self, sess, client_tok):
        r = sess.get(
            f"{BASE_URL}/api/wallet/export/csv",
            params={"months": 6},
            headers={"Authorization": f"Bearer {client_tok}"},
            timeout=20,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("text/csv")

    def test_csv_export_unauthenticated_401(self, sess):
        r = sess.get(f"{BASE_URL}/api/wallet/export/csv?months=6", timeout=10)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"


# --- PDF export ---
class TestPdfExport:
    def test_worker_pdf_export_ok(self, sess, worker_tok):
        r = sess.get(
            f"{BASE_URL}/api/wallet/export/pdf",
            params={"months": 6},
            headers={"Authorization": f"Bearer {worker_tok}"},
            timeout=30,
        )
        assert r.status_code == 200, r.text
        assert r.content.startswith(b"%PDF-"), f"PDF magic missing, first bytes: {r.content[:8]!r}"
        cd = r.headers.get("content-disposition", "")
        assert ".pdf" in cd.lower(), f"disposition={cd}"

    def test_pdf_export_unauthenticated_401(self, sess):
        r = sess.get(f"{BASE_URL}/api/wallet/export/pdf?months=6", timeout=10)
        assert r.status_code == 401


# --- /api/wallet/withdrawals ---
class TestWithdrawalsEndpoint:
    def _fetch(self, sess, tok):
        r = sess.get(
            f"{BASE_URL}/api/wallet/withdrawals",
            headers={"Authorization": f"Bearer {tok}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert isinstance(body, list), f"expected list, got {type(body)}"
        return body

    def test_worker_withdrawals_shape(self, sess, worker_tok):
        # Create a withdrawal to guarantee at least one row exists
        # First check balance; if too low, top up
        wr = sess.get(f"{BASE_URL}/api/wallet",
                      headers={"Authorization": f"Bearer {worker_tok}"}, timeout=10)
        assert wr.status_code == 200
        bal = float(wr.json().get("balance") or 0)
        if bal < 10:
            tp = sess.post(f"{BASE_URL}/api/wallet/topup", json={"amount": 100},
                           headers={"Authorization": f"Bearer {worker_tok}"}, timeout=15)
            assert tp.status_code in (200, 201), tp.text
        # Withdraw ₹5 to a test UPI (may 200 or 400 depending on constraints; treat 200/201 as success)
        wd = sess.post(f"{BASE_URL}/api/wallet/withdraw",
                       json={"amount": 5, "upi_id": "test@upi"},
                       headers={"Authorization": f"Bearer {worker_tok}"}, timeout=15)
        # Not fatal if withdrawal endpoint rejects; we just need to test /withdrawals response
        items = self._fetch(sess, worker_tok)
        for it in items:
            assert it.get("type") == "withdrawal", f"non-withdrawal item: {it}"
            assert float(it.get("amount") or 0) <= 0, f"positive amount: {it}"

    def test_client_withdrawals_ok(self, sess, client_tok):
        items = self._fetch(sess, client_tok)
        for it in items:
            assert it.get("type") == "withdrawal"

    def test_contractor_withdrawals_ok(self, sess, contractor_tok):
        self._fetch(sess, contractor_tok)

    def test_admin_withdrawals_ok(self, sess, admin_tok):
        self._fetch(sess, admin_tok)

    def test_withdrawals_unauth_401(self, sess):
        r = sess.get(f"{BASE_URL}/api/wallet/withdrawals", timeout=10)
        assert r.status_code == 401


# --- Regression on wallet endpoints ---
class TestWalletRegression:
    def test_wallet_get_shape(self, sess, worker_tok):
        r = sess.get(f"{BASE_URL}/api/wallet",
                     headers={"Authorization": f"Bearer {worker_tok}"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        assert "balance" in d and "referral_code" in d and "transactions" in d
        assert isinstance(d["transactions"], list)

    def test_referral_stats_shape(self, sess, worker_tok):
        r = sess.get(f"{BASE_URL}/api/wallet/referral-stats",
                     headers={"Authorization": f"Bearer {worker_tok}"}, timeout=10)
        assert r.status_code == 200
        d = r.json()
        for k in ("invited", "earned", "code"):
            assert k in d, f"missing key {k}"
