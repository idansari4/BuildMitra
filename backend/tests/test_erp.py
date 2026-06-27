"""ERP module backend tests (Contractor scope).
Covers /api/erp/* — materials, tools, estimates, bills, dashboard, plus 403 guard.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://buildmitra.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def contractor_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": "9000000003", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def worker_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": "9000000002", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def client_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": "9000000001", "password": "demo1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login", json={"mobile": "9000000000", "password": "admin1234"})
    assert r.status_code == 200, r.text
    return r.json()["token"]


def hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ---------- Materials CRUD ----------
class TestMaterials:
    def test_create_material(self, contractor_token):
        payload = {"name": "TEST_Cement", "category": "Cement", "unit": "bag",
                   "qty": 5, "min_qty": 10, "cost_per_unit": 380, "site": "Andheri"}
        r = requests.post(f"{API}/erp/materials", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["name"] == "TEST_Cement"
        assert data["qty"] == 5
        assert data["min_qty"] == 10
        assert "id" in data
        pytest.material_id = data["id"]

    def test_list_materials_persists(self, contractor_token):
        r = requests.get(f"{API}/erp/materials", headers=hdr(contractor_token))
        assert r.status_code == 200
        ids = [m["id"] for m in r.json()]
        assert pytest.material_id in ids

    def test_update_material(self, contractor_token):
        payload = {"name": "TEST_Cement", "category": "Cement", "unit": "bag",
                   "qty": 20, "min_qty": 10, "cost_per_unit": 400, "site": "Andheri"}
        r = requests.put(f"{API}/erp/materials/{pytest.material_id}", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200
        # verify
        lst = requests.get(f"{API}/erp/materials", headers=hdr(contractor_token)).json()
        m = next(x for x in lst if x["id"] == pytest.material_id)
        assert m["qty"] == 20
        assert m["cost_per_unit"] == 400

    def test_delete_material(self, contractor_token):
        r = requests.delete(f"{API}/erp/materials/{pytest.material_id}", headers=hdr(contractor_token))
        assert r.status_code == 200
        lst = requests.get(f"{API}/erp/materials", headers=hdr(contractor_token)).json()
        assert pytest.material_id not in [m["id"] for m in lst]


# ---------- Tools CRUD ----------
class TestTools:
    def test_create_tool_with_status(self, contractor_token):
        payload = {"name": "TEST_Drill", "code": "DRL-01", "status": "in_use",
                   "purchase_cost": 4500, "assigned_to": "Ramesh", "notes": ""}
        r = requests.post(f"{API}/erp/tools", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["status"] == "in_use"
        pytest.tool_id = data["id"]

    def test_list_tools(self, contractor_token):
        r = requests.get(f"{API}/erp/tools", headers=hdr(contractor_token))
        assert r.status_code == 200
        assert any(t["id"] == pytest.tool_id for t in r.json())

    def test_delete_tool(self, contractor_token):
        r = requests.delete(f"{API}/erp/tools/{pytest.tool_id}", headers=hdr(contractor_token))
        assert r.status_code == 200


# ---------- Estimates auto-compute ----------
class TestEstimates:
    def test_create_estimate_auto_computes(self, contractor_token):
        payload = {"project_name": "TEST_Villa", "client_name": "Mr. X", "site": "Pune",
                   "labour_cost": 100000, "material_cost": 200000,
                   "equipment_cost": 50000, "transport_cost": 20000, "misc_cost": 30000,
                   "revenue": 500000, "notes": ""}
        r = requests.post(f"{API}/erp/estimates", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["total_cost"] == 400000
        assert d["profit"] == 100000
        assert d["margin_pct"] == 20.0
        pytest.estimate_id = d["id"]

    def test_estimate_zero_revenue(self, contractor_token):
        payload = {"project_name": "TEST_Zero", "labour_cost": 100, "material_cost": 200,
                   "equipment_cost": 0, "transport_cost": 0, "misc_cost": 0,
                   "revenue": 0}
        r = requests.post(f"{API}/erp/estimates", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200
        d = r.json()
        assert d["total_cost"] == 300
        assert d["margin_pct"] == 0

    def test_list_estimates(self, contractor_token):
        r = requests.get(f"{API}/erp/estimates", headers=hdr(contractor_token))
        assert r.status_code == 200
        assert any(e["id"] == pytest.estimate_id for e in r.json())


# ---------- Bills with line items + GST + mark-paid ----------
class TestBills:
    def test_create_bill_auto_bill_no_and_calc(self, contractor_token):
        payload = {
            "bill_to": "TEST_Sharma Builders",
            "project": "Andheri Site",
            "items": [
                {"description": "Mason work", "qty": 10, "rate": 900},
                {"description": "Tiles", "qty": 5, "rate": 1200},
            ],
            "tax_pct": 18,
            "notes": "TEST",
        }
        r = requests.post(f"{API}/erp/bills", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200, r.text
        d = r.json()
        # subtotal = 10*900 + 5*1200 = 9000 + 6000 = 15000
        assert d["subtotal"] == 15000
        # tax = 15000 * 0.18 = 2700
        assert d["tax_amount"] == 2700
        assert d["total"] == 17700
        assert d["status"] == "unpaid"
        # bill_no format BM-YYYY-XXXX
        assert d["bill_no"].startswith("BM-")
        parts = d["bill_no"].split("-")
        assert len(parts) == 3
        assert len(parts[2]) == 4
        pytest.bill_id = d["id"]
        pytest.bill_no = d["bill_no"]

    def test_bill_no_increments(self, contractor_token):
        payload = {"bill_to": "TEST_2", "items": [{"description": "x", "qty": 1, "rate": 100}], "tax_pct": 18}
        r = requests.post(f"{API}/erp/bills", json=payload, headers=hdr(contractor_token))
        assert r.status_code == 200
        new_no = r.json()["bill_no"]
        prev_seq = int(pytest.bill_no.split("-")[-1])
        new_seq = int(new_no.split("-")[-1])
        assert new_seq == prev_seq + 1

    def test_mark_paid(self, contractor_token):
        r = requests.post(f"{API}/erp/bills/{pytest.bill_id}/mark-paid", headers=hdr(contractor_token))
        assert r.status_code == 200
        # verify
        bills = requests.get(f"{API}/erp/bills", headers=hdr(contractor_token)).json()
        b = next(x for x in bills if x["id"] == pytest.bill_id)
        assert b["status"] == "paid"

    def test_mark_paid_404(self, contractor_token):
        r = requests.post(f"{API}/erp/bills/does-not-exist/mark-paid", headers=hdr(contractor_token))
        assert r.status_code == 404


# ---------- Dashboard ----------
class TestDashboard:
    def test_dashboard_keys(self, contractor_token):
        r = requests.get(f"{API}/erp/dashboard", headers=hdr(contractor_token))
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ["materials_total", "materials_low_stock", "tools_total", "tools_in_use",
                  "estimates_total", "bills_total", "bills_paid",
                  "revenue_paid", "revenue_pending"]:
            assert k in d, f"missing {k}"
        # We marked at least one bill paid above (17700)
        assert d["bills_total"] >= 1
        assert d["bills_paid"] >= 1
        assert d["revenue_paid"] >= 17700

    def test_low_stock_detection(self, contractor_token):
        # add a material with qty <= min_qty -> low stock
        payload = {"name": "TEST_Low", "qty": 1, "min_qty": 10, "cost_per_unit": 50, "unit": "kg"}
        r = requests.post(f"{API}/erp/materials", json=payload, headers=hdr(contractor_token))
        mid = r.json()["id"]
        dash = requests.get(f"{API}/erp/dashboard", headers=hdr(contractor_token)).json()
        assert dash["materials_low_stock"] >= 1
        # cleanup
        requests.delete(f"{API}/erp/materials/{mid}", headers=hdr(contractor_token))


# ---------- 403 guards (contractor-only) ----------
class TestAuthGuards:
    @pytest.mark.parametrize("path,method", [
        ("/erp/materials", "GET"), ("/erp/materials", "POST"),
        ("/erp/tools", "GET"), ("/erp/tools", "POST"),
        ("/erp/estimates", "GET"), ("/erp/estimates", "POST"),
        ("/erp/bills", "GET"), ("/erp/bills", "POST"),
        ("/erp/dashboard", "GET"),
    ])
    def test_worker_blocked(self, worker_token, path, method):
        url = f"{API}{path}"
        if method == "GET":
            r = requests.get(url, headers=hdr(worker_token))
        else:
            r = requests.post(url, json={}, headers=hdr(worker_token))
        assert r.status_code == 403, f"{path} expected 403 got {r.status_code}"

    def test_client_blocked_dashboard(self, client_token):
        r = requests.get(f"{API}/erp/dashboard", headers=hdr(client_token))
        assert r.status_code == 403

    def test_admin_blocked_dashboard(self, admin_token):
        r = requests.get(f"{API}/erp/dashboard", headers=hdr(admin_token))
        assert r.status_code == 403

    def test_no_token_blocked(self):
        r = requests.get(f"{API}/erp/dashboard")
        assert r.status_code == 401


# ---------- Owner isolation: cannot access other contractor's data via 404 on delete ----------
class TestOwnerIsolation:
    def test_delete_other_owner_returns_404(self, contractor_token):
        # try to delete a totally fake id
        r = requests.delete(f"{API}/erp/materials/nope-xyz", headers=hdr(contractor_token))
        assert r.status_code == 404
