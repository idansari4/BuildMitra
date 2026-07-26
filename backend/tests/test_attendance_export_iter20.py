"""Iter 20 — Attendance CSV/PDF export tests.

Covers new endpoints:
  GET /api/attendance/export/csv  (query: days, scope)
  GET /api/attendance/export/pdf  (query: days, scope)

Scope semantics:
  scope='mine'   -> workers only (403 for others)
  scope='workers' -> client/contractor (their jobs) or admin (all); worker gets 403
"""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL") or "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_CSV_HEADER = "Date,Time,Worker,Type,Job Title,Job ID,Verified,Distance (m),Latitude,Longitude"


# --- fixtures / helpers ------------------------------------------------------

def _login(mobile: str, password: str) -> str:
    r = requests.post(f"{API}/auth/login", json={"mobile": mobile, "password": password}, timeout=15)
    assert r.status_code == 200, f"Login failed for {mobile}: {r.status_code} {r.text}"
    tok = r.json().get("token")
    assert tok, f"No token returned for {mobile}"
    return tok


@pytest.fixture(scope="session")
def tokens():
    return {
        "admin":      _login("9000000000", "admin1234"),
        "worker":     _login("9000000002", "demo1234"),
        "client":     _login("9000000001", "demo1234"),
        "contractor": _login("9000000003", "demo1234"),
    }


def _hdr(tok: str):
    return {"Authorization": f"Bearer {tok}"}


def _assert_csv_ok(r: requests.Response):
    assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:200]}"
    ctype = r.headers.get("content-type", "")
    assert ctype.startswith("text/csv"), f"bad content-type: {ctype}"
    cdisp = r.headers.get("content-disposition", "")
    assert "attachment" in cdisp.lower(), f"missing attachment in {cdisp}"
    assert ".csv" in cdisp.lower(), f"no .csv in {cdisp}"
    body = r.text
    first_line = body.splitlines()[0] if body else ""
    assert first_line == EXPECTED_CSV_HEADER, f"unexpected CSV header: {first_line!r}"


def _assert_pdf_ok(r: requests.Response):
    assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text[:200]}"
    ctype = r.headers.get("content-type", "")
    assert ctype == "application/pdf", f"bad content-type: {ctype}"
    cdisp = r.headers.get("content-disposition", "")
    assert "attachment" in cdisp.lower(), f"missing attachment in {cdisp}"
    assert ".pdf" in cdisp.lower(), f"no .pdf in {cdisp}"
    assert r.content[:5] == b"%PDF-", f"body not a PDF, first bytes: {r.content[:8]!r}"


# --- Worker scope=mine (allowed) ---------------------------------------------

class TestWorkerMine:
    def test_csv_worker_mine(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["worker"]), timeout=30)
        _assert_csv_ok(r)

    def test_pdf_worker_mine(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["worker"]), timeout=30)
        _assert_pdf_ok(r)


# --- Worker scope=workers (forbidden) ----------------------------------------

class TestWorkerWorkersForbidden:
    def test_csv_worker_workers_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["worker"]), timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"

    def test_pdf_worker_workers_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["worker"]), timeout=15)
        assert r.status_code == 403


# --- Client scope=workers (allowed) + scope=mine (forbidden) -----------------

class TestClient:
    def test_csv_client_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["client"]), timeout=30)
        _assert_csv_ok(r)

    def test_pdf_client_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["client"]), timeout=30)
        _assert_pdf_ok(r)

    def test_csv_client_mine_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["client"]), timeout=15)
        assert r.status_code == 403

    def test_pdf_client_mine_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["client"]), timeout=15)
        assert r.status_code == 403


# --- Contractor scope=workers (allowed) --------------------------------------

class TestContractor:
    def test_csv_contractor_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["contractor"]), timeout=30)
        _assert_csv_ok(r)

    def test_pdf_contractor_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["contractor"]), timeout=30)
        _assert_pdf_ok(r)


# --- Admin ------------------------------------------------------------------

class TestAdmin:
    def test_csv_admin_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["admin"]), timeout=30)
        _assert_csv_ok(r)

    def test_pdf_admin_workers(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "workers"},
                         headers=_hdr(tokens["admin"]), timeout=30)
        _assert_pdf_ok(r)

    def test_csv_admin_mine_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["admin"]), timeout=15)
        assert r.status_code == 403

    def test_pdf_admin_mine_403(self, tokens):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "mine"},
                         headers=_hdr(tokens["admin"]), timeout=15)
        assert r.status_code == 403


# --- Unauthenticated ---------------------------------------------------------

class TestUnauth:
    def test_csv_no_auth_401(self):
        r = requests.get(f"{API}/attendance/export/csv", params={"days": 30, "scope": "workers"},
                         timeout=15)
        assert r.status_code == 401, f"expected 401 got {r.status_code}"

    def test_pdf_no_auth_401(self):
        r = requests.get(f"{API}/attendance/export/pdf", params={"days": 30, "scope": "workers"},
                         timeout=15)
        assert r.status_code == 401
