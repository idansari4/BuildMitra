from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta
import uuid
import bcrypt
import jwt as pyjwt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'dev')
JWT_ALGO = os.environ.get('JWT_ALGO', 'HS256')
EMERGENT_LLM_KEY = os.environ.get('EMERGENT_LLM_KEY')
TWILIO_SID = os.environ.get('TWILIO_ACCOUNT_SID', '')
TWILIO_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN', '')
TWILIO_VERIFY = os.environ.get('TWILIO_VERIFY_SERVICE_SID', '')
TWILIO_ENABLED = bool(TWILIO_SID and TWILIO_TOKEN and TWILIO_VERIFY)
DEV_OTP_CODE = "123456"
_twilio_client = None
if TWILIO_ENABLED:
    try:
        from twilio.rest import Client as _TwilioClient
        _twilio_client = _TwilioClient(TWILIO_SID, TWILIO_TOKEN)
    except Exception as e:
        TWILIO_ENABLED = False

RAZORPAY_KEY_ID = os.environ.get('RAZORPAY_KEY_ID', '')
RAZORPAY_KEY_SECRET = os.environ.get('RAZORPAY_KEY_SECRET', '')
RAZORPAY_WEBHOOK_SECRET = os.environ.get('RAZORPAY_WEBHOOK_SECRET', '')
RAZORPAY_ENABLED = bool(RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET)
_rzp_client = None
if RAZORPAY_ENABLED:
    try:
        import razorpay as _rzp
        _rzp_client = _rzp.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))
    except Exception:
        RAZORPAY_ENABLED = False

app = FastAPI(title="BuildMitra API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("buildmitra")

SKILLS = [
    "Mason", "Helper", "Painter", "Electrician", "Plumber", "Carpenter",
    "Welder", "Tile Worker", "POP Worker", "Steel Fixer",
    "Scaffolding Worker", "Concrete Worker", "Site Supervisor"
]

# ---------- helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def make_token(user_id: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
    }
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing token")
    token = authorization.split(" ", 1)[1]
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def gen_referral_code(mobile: str) -> str:
    return ("BM" + mobile[-4:] + uuid.uuid4().hex[:4]).upper()

# ---------- models ----------
class RegisterIn(BaseModel):
    name: str
    mobile: str
    password: str
    role: str  # worker | contractor | client
    referred_by: Optional[str] = None

class LoginIn(BaseModel):
    mobile: str
    password: str

class OtpSendIn(BaseModel):
    mobile: str

class OtpVerifyIn(BaseModel):
    mobile: str
    code: str
    name: Optional[str] = None
    role: Optional[str] = None  # required only on first signup
    referred_by: Optional[str] = None

class AadhaarIn(BaseModel):
    aadhaar: str

# Payments
class OrderIn(BaseModel):
    amount_inr: int  # rupees, will multiply by 100 internally
    purpose: str  # wallet_topup | erp_pro | erp_enterprise

class VerifyIn(BaseModel):
    order_id: str
    payment_id: Optional[str] = None
    signature: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    photo: Optional[str] = None  # base64
    skills: Optional[List[str]] = None
    experience_years: Optional[int] = None
    daily_wage: Optional[int] = None
    available: Optional[bool] = None
    city: Optional[str] = None
    company_name: Optional[str] = None
    aadhaar_verified: Optional[bool] = None
    language: Optional[str] = None

class JobIn(BaseModel):
    title: str
    description: str
    skill: str
    workers_needed: int = 1
    daily_wage: int
    location: str
    site_address: Optional[str] = ""
    start_date: Optional[str] = None
    duration_days: int = 1
    working_hours: Optional[str] = "8 hrs"
    urgency: Optional[str] = "Normal"
    lat: Optional[float] = None
    lng: Optional[float] = None
    geofence_radius_m: Optional[int] = 200  # geofence radius in meters

class ApplyIn(BaseModel):
    job_id: str
    message: Optional[str] = ""

class AttendanceIn(BaseModel):
    job_id: str
    type: str  # check_in | check_out
    lat: float
    lng: float
    selfie: str  # base64

class ComplaintIn(BaseModel):
    against_user_id: Optional[str] = None
    subject: str
    description: str

class MaterialIn(BaseModel):
    name: str
    category: Optional[str] = ""
    unit: Optional[str] = "unit"
    qty: float = 0
    min_qty: float = 0
    cost_per_unit: float = 0
    site: Optional[str] = ""

class ToolIn(BaseModel):
    name: str
    code: Optional[str] = ""
    assigned_to: Optional[str] = ""
    status: str = "available"
    purchase_cost: float = 0
    notes: Optional[str] = ""

class EstimateIn(BaseModel):
    project_name: str
    client_name: Optional[str] = ""
    site: Optional[str] = ""
    labour_cost: float = 0
    material_cost: float = 0
    equipment_cost: float = 0
    transport_cost: float = 0
    misc_cost: float = 0
    revenue: float = 0
    notes: Optional[str] = ""

class BillLine(BaseModel):
    description: str
    qty: float = 1
    rate: float = 0

class BillIn(BaseModel):
    bill_to: str
    project: Optional[str] = ""
    items: List[BillLine]
    tax_pct: float = 18
    notes: Optional[str] = ""

class ChatSendIn(BaseModel):
    to_user_id: str
    text: str

class RatingIn(BaseModel):
    target_user_id: str
    job_id: Optional[str] = None
    stars: int
    comment: Optional[str] = ""

# ---------- routes ----------
@api.get("/")
async def root():
    return {"app": "BuildMitra", "ok": True}

@api.get("/skills")
async def skills():
    return {"skills": SKILLS}

@api.post("/auth/register")
async def register(body: RegisterIn):
    if body.role not in ("worker", "contractor", "client"):
        raise HTTPException(400, "Invalid role")
    if len(body.mobile) < 10:
        raise HTTPException(400, "Invalid mobile")
    if await db.users.find_one({"mobile": body.mobile}):
        raise HTTPException(400, "Mobile already registered")
    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "name": body.name,
        "mobile": body.mobile,
        "password": hash_pw(body.password),
        "role": body.role,
        "photo": None,
        "skills": [],
        "experience_years": 0,
        "daily_wage": 0,
        "available": True,
        "city": "",
        "company_name": "",
        "aadhaar_verified": False,
        "language": "en",
        "rating_avg": 0.0,
        "rating_count": 0,
        "referral_code": gen_referral_code(body.mobile),
        "referred_by": body.referred_by,
        "wallet_balance": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc)
    doc.pop("_id", None)
    # referral reward (simplified: ₹50 credit to referrer at signup)
    if body.referred_by:
        ref = await db.users.find_one({"referral_code": body.referred_by})
        if ref:
            await db.users.update_one(
                {"id": ref["id"]}, {"$inc": {"wallet_balance": 50}}
            )
            await db.wallet_txns.insert_one({
                "id": str(uuid.uuid4()),
                "user_id": ref["id"],
                "amount": 50,
                "type": "referral_credit",
                "note": f"Referral signup: {body.name}",
                "created_at": now_iso(),
            })
    token = make_token(uid, body.role)
    user_resp = {k: v for k, v in doc.items() if k != "password"}
    return {"token": token, "user": user_resp}

@api.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"mobile": body.mobile})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(401, "Invalid credentials")
    if user.get("suspended"):
        raise HTTPException(403, "Account suspended. Contact support.")
    token = make_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("password", None)
    return {"token": token, "user": user}

# --- Twilio OTP (with dev fallback when creds not configured) ---
def _normalise_mobile(m: str) -> str:
    digits = "".join(ch for ch in m if ch.isdigit())
    if len(digits) == 12 and digits.startswith("91"):
        return "+" + digits
    if len(digits) == 10:
        return "+91" + digits
    raise HTTPException(400, "Invalid Indian mobile (10 digits)")

@api.post("/auth/otp/send")
async def otp_send(body: OtpSendIn):
    e164 = _normalise_mobile(body.mobile)
    if TWILIO_ENABLED and _twilio_client:
        try:
            _twilio_client.verify.v2.services(TWILIO_VERIFY).verifications.create(
                to=e164, channel="sms"
            )
            return {"sent": True, "dev_mode": False, "mobile": e164}
        except Exception as e:
            logger.warning(f"Twilio send failed: {e}")
            raise HTTPException(502, "Could not send OTP. Try again.")
    # dev mode — always succeed, code is DEV_OTP_CODE
    logger.info(f"[DEV OTP] {e164} → {DEV_OTP_CODE}")
    return {"sent": True, "dev_mode": True, "mobile": e164, "dev_code": DEV_OTP_CODE}

@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn):
    e164 = _normalise_mobile(body.mobile)
    # 1) verify code
    if TWILIO_ENABLED and _twilio_client:
        try:
            check = _twilio_client.verify.v2.services(TWILIO_VERIFY).verification_checks.create(
                to=e164, code=body.code
            )
            if check.status != "approved":
                raise HTTPException(401, "Invalid or expired OTP")
        except HTTPException:
            raise
        except Exception as e:
            logger.warning(f"Twilio verify error: {e}")
            raise HTTPException(401, "OTP verification failed")
    else:
        if body.code != DEV_OTP_CODE:
            raise HTTPException(401, "Invalid OTP (dev mode: use 123456)")
    # 2) get-or-create user (mobile stored without +91 for compatibility with demo accounts)
    bare = e164.replace("+91", "")
    user = await db.users.find_one({"mobile": bare})
    if not user:
        if not body.name or not body.role:
            raise HTTPException(400, "name and role required for first OTP signup")
        if body.role not in ("worker", "contractor", "client"):
            raise HTTPException(400, "Invalid role")
        uid = str(uuid.uuid4())
        user = {
            "id": uid, "name": body.name.strip(), "mobile": bare,
            "password": hash_pw(uuid.uuid4().hex),  # random, never used
            "role": body.role, "photo": None, "skills": [], "experience_years": 0,
            "daily_wage": 0, "available": True, "city": "",
            "company_name": "", "aadhaar_verified": False, "language": "en",
            "rating_avg": 0.0, "rating_count": 0,
            "referral_code": gen_referral_code(bare),
            "referred_by": body.referred_by, "wallet_balance": 0,
            "created_at": now_iso(),
        }
        await db.users.insert_one(user)
        if body.referred_by:
            ref = await db.users.find_one({"referral_code": body.referred_by})
            if ref:
                await db.users.update_one({"id": ref["id"]}, {"$inc": {"wallet_balance": 50}})
                await db.wallet_txns.insert_one({
                    "id": str(uuid.uuid4()), "user_id": ref["id"], "amount": 50,
                    "type": "referral_credit", "note": f"Referral signup: {body.name}",
                    "created_at": now_iso(),
                })
    if user.get("suspended"):
        raise HTTPException(403, "Account suspended. Contact support.")
    token = make_token(user["id"], user["role"])
    user.pop("_id", None); user.pop("password", None)
    return {"token": token, "user": user, "is_new_user": not user.get("aadhaar_verified")}

# --- Payments (Razorpay + dev mode fallback) ---
PRICING = {
    "erp_pro": 299,
    "erp_enterprise": 999,
}

def _apply_purpose(user: dict, purpose: str, amount_inr: int):
    """Returns dict of updates to apply to user after successful payment."""
    updates = {}
    txn_note = ""
    if purpose == "wallet_topup":
        updates["$inc"] = {"wallet_balance": amount_inr}
        txn_note = f"Wallet top-up ₹{amount_inr}"
    elif purpose in ("erp_pro", "erp_enterprise"):
        tier = "pro" if purpose == "erp_pro" else "enterprise"
        expires = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
        updates["$set"] = {
            "subscription_tier": tier,
            "subscription_expires_at": expires,
        }
        txn_note = f"ERP {tier.title()} subscription (30 days)"
    return updates, txn_note

@api.post("/payments/create-order")
async def create_order(body: OrderIn, user=Depends(current_user)):
    if body.purpose not in ("wallet_topup", "erp_pro", "erp_enterprise"):
        raise HTTPException(400, "Invalid purpose")
    if body.purpose == "erp_pro" and user["role"] != "contractor":
        raise HTTPException(403, "ERP subscription is for contractors only")
    if body.purpose == "erp_enterprise" and user["role"] != "contractor":
        raise HTTPException(403, "ERP subscription is for contractors only")
    # Force fixed pricing for subscription
    if body.purpose in PRICING:
        amount_inr = PRICING[body.purpose]
    else:
        amount_inr = max(1, int(body.amount_inr))
    amount_paise = amount_inr * 100

    order_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "purpose": body.purpose,
        "amount_inr": amount_inr,
        "amount_paise": amount_paise,
        "status": "created",
        "dev_mode": not RAZORPAY_ENABLED,
        "created_at": now_iso(),
    }
    if RAZORPAY_ENABLED and _rzp_client:
        try:
            rzp_order = _rzp_client.order.create({
                "amount": amount_paise,
                "currency": "INR",
                "payment_capture": 1,
                "notes": {"purpose": body.purpose, "user_id": user["id"]},
            })
            order_doc["razorpay_order_id"] = rzp_order["id"]
        except Exception as e:
            logger.warning(f"Razorpay order failed: {e}")
            raise HTTPException(502, "Could not create payment order")
    else:
        order_doc["razorpay_order_id"] = f"order_DEV_{order_doc['id'][:8]}"

    await db.payment_orders.insert_one(order_doc)
    order_doc.pop("_id", None)
    return {
        "order_id": order_doc["id"],
        "razorpay_order_id": order_doc["razorpay_order_id"],
        "amount_inr": amount_inr,
        "amount_paise": amount_paise,
        "key_id": RAZORPAY_KEY_ID,
        "dev_mode": order_doc["dev_mode"],
        "purpose": body.purpose,
    }

@api.post("/payments/verify")
async def verify_payment(body: VerifyIn, user=Depends(current_user)):
    order = await db.payment_orders.find_one({"id": body.order_id, "user_id": user["id"]})
    if not order:
        raise HTTPException(404, "Order not found")
    if order["status"] == "paid":
        return {"ok": True, "already_paid": True}
    # Verify signature with Razorpay in prod
    if RAZORPAY_ENABLED and _rzp_client and order.get("razorpay_order_id", "").startswith("order_") and not order["dev_mode"]:
        try:
            _rzp_client.utility.verify_payment_signature({
                "razorpay_order_id": order["razorpay_order_id"],
                "razorpay_payment_id": body.payment_id or "",
                "razorpay_signature": body.signature or "",
            })
        except Exception as e:
            logger.warning(f"Signature verify failed: {e}")
            raise HTTPException(400, "Invalid payment signature")
    # Apply purpose
    updates, note = _apply_purpose(user, order["purpose"], order["amount_inr"])
    if updates:
        await db.users.update_one({"id": user["id"]}, updates)
    await db.payment_orders.update_one(
        {"id": body.order_id},
        {"$set": {"status": "paid", "payment_id": body.payment_id, "paid_at": now_iso()}}
    )
    await db.wallet_txns.insert_one({
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "amount": order["amount_inr"] if order["purpose"] == "wallet_topup" else -order["amount_inr"],
        "type": order["purpose"],
        "note": note,
        "created_at": now_iso(),
    })
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return {"ok": True, "purpose": order["purpose"], "user": fresh}

@api.get("/payments/history")
async def payment_history(user=Depends(current_user)):
    cur = db.payment_orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cur.to_list(length=50)

@api.get("/payments/pricing")
async def pricing():
    return {
        "erp_pro": {"amount_inr": PRICING["erp_pro"], "label": "ERP Pro", "duration_days": 30,
                    "features": ["Unlimited bills", "PDF/Excel exports", "Multi-site inventory", "Priority support"]},
        "erp_enterprise": {"amount_inr": PRICING["erp_enterprise"], "label": "ERP Enterprise", "duration_days": 30,
                           "features": ["All Pro features", "AI material forecasting", "Custom invoice branding", "Dedicated CSM"]},
        "razorpay_enabled": RAZORPAY_ENABLED,
    }

# --- Aadhaar verify (Verhoeff checksum, mock for MVP) ---
_VERHOEFF_D = [
    [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
    [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
    [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
    [9,8,7,6,5,4,3,2,1,0],
]
_VERHOEFF_P = [
    [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
    [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
    [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
]

def _aadhaar_valid(s: str) -> bool:
    if not s.isdigit() or len(s) != 12 or s[0] in ("0", "1"):
        return False
    c = 0
    for i, ch in enumerate(reversed(s)):
        c = _VERHOEFF_D[c][_VERHOEFF_P[i % 8][int(ch)]]
    return c == 0

@api.post("/profile/aadhaar/verify")
async def aadhaar_verify(body: AadhaarIn, user=Depends(current_user)):
    aadhaar = "".join(ch for ch in body.aadhaar if ch.isdigit())
    if not _aadhaar_valid(aadhaar):
        raise HTTPException(400, "Invalid Aadhaar number")
    # Check uniqueness
    other = await db.users.find_one({"aadhaar_last4": aadhaar[-4:], "aadhaar_hash": hash_pw(aadhaar)[-30:], "id": {"$ne": user["id"]}})
    if other:
        raise HTTPException(400, "This Aadhaar is already linked to another account")
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "aadhaar_verified": True,
            "aadhaar_last4": aadhaar[-4:],
            "aadhaar_verified_at": now_iso(),
        }}
    )
    return {"verified": True, "last4": aadhaar[-4:]}

@api.get("/me")
async def me(user=Depends(current_user)):
    return user

@api.put("/me")
async def update_me(body: ProfileUpdate, user=Depends(current_user)):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if update:
        await db.users.update_one({"id": user["id"]}, {"$set": update})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password": 0})
    return updated

# --- Jobs ---
@api.post("/jobs")
async def post_job(body: JobIn, user=Depends(current_user)):
    if user["role"] not in ("client", "contractor"):
        raise HTTPException(403, "Only client/contractor can post jobs")
    job = {
        "id": str(uuid.uuid4()),
        "posted_by": user["id"],
        "posted_by_name": user["name"],
        "posted_by_role": user["role"],
        **body.model_dump(),
        "status": "open",
        "applicants_count": 0,
        "created_at": now_iso(),
    }
    await db.jobs.insert_one(job)
    job.pop("_id", None)
    return job

@api.get("/jobs")
async def list_jobs(skill: Optional[str] = None, status: str = "open", limit: int = 50):
    q = {"status": status}
    if skill:
        q["skill"] = skill
    cursor = db.jobs.find(q, {"_id": 0}).sort("created_at", -1).limit(limit)
    return await cursor.to_list(length=limit)

@api.get("/jobs/mine")
async def my_jobs(user=Depends(current_user)):
    cursor = db.jobs.find({"posted_by": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)

@api.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    return job

# --- Applications ---
@api.post("/applications")
async def apply(body: ApplyIn, user=Depends(current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Only workers can apply")
    job = await db.jobs.find_one({"id": body.job_id})
    if not job:
        raise HTTPException(404, "Job not found")
    existing = await db.applications.find_one({"job_id": body.job_id, "worker_id": user["id"]})
    if existing:
        raise HTTPException(400, "Already applied")
    appn = {
        "id": str(uuid.uuid4()),
        "job_id": body.job_id,
        "job_title": job["title"],
        "worker_id": user["id"],
        "worker_name": user["name"],
        "worker_skills": user.get("skills", []),
        "worker_wage": user.get("daily_wage", 0),
        "message": body.message,
        "status": "pending",
        "created_at": now_iso(),
    }
    await db.applications.insert_one(appn)
    await db.jobs.update_one({"id": body.job_id}, {"$inc": {"applicants_count": 1}})
    appn.pop("_id", None)
    return appn

@api.get("/applications/mine")
async def my_applications(user=Depends(current_user)):
    cursor = db.applications.find({"worker_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)

@api.get("/applications/job/{job_id}")
async def job_applicants(job_id: str, user=Depends(current_user)):
    job = await db.jobs.find_one({"id": job_id})
    if not job or job["posted_by"] != user["id"]:
        raise HTTPException(403, "Not your job")
    cursor = db.applications.find({"job_id": job_id}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=200)

# --- Attendance ---
def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    import math
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1); dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2 * R * math.asin(math.sqrt(a))

@api.post("/attendance")
async def attendance(body: AttendanceIn, user=Depends(current_user)):
    within = True
    distance = None
    job = None
    if body.job_id and body.job_id != "self":
        job = await db.jobs.find_one({"id": body.job_id})
        if job and job.get("lat") is not None and job.get("lng") is not None:
            distance = _haversine_m(body.lat, body.lng, job["lat"], job["lng"])
            radius = job.get("geofence_radius_m", 200)
            within = distance <= radius
    rec = {
        "id": str(uuid.uuid4()),
        "worker_id": user["id"],
        "worker_name": user["name"],
        "job_id": body.job_id,
        "job_title": job.get("title") if job else None,
        "type": body.type,
        "lat": body.lat,
        "lng": body.lng,
        "selfie": body.selfie[:200000],
        "face_verified": True,
        "within_geofence": within,
        "distance_from_site_m": round(distance, 1) if distance is not None else None,
        "created_at": now_iso(),
    }
    await db.attendance.insert_one(rec)
    rec.pop("_id", None); rec.pop("selfie", None)
    return rec

@api.get("/attendance/mine")
async def my_attendance(user=Depends(current_user)):
    cursor = db.attendance.find({"worker_id": user["id"]}, {"_id": 0, "selfie": 0}).sort("created_at", -1).limit(60)
    return await cursor.to_list(length=60)

# --- Workers search (for client/contractor) ---
@api.get("/workers")
async def list_workers(skill: Optional[str] = None, city: Optional[str] = None):
    q = {"role": "worker"}
    if skill:
        q["skills"] = skill
    if city:
        q["city"] = city
    cursor = db.users.find(q, {"_id": 0, "password": 0}).limit(100)
    return await cursor.to_list(length=100)

# --- Wallet ---
@api.get("/wallet")
async def wallet(user=Depends(current_user)):
    txns = await db.wallet_txns.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=50)
    fresh = await db.users.find_one({"id": user["id"]}, {"_id": 0, "wallet_balance": 1, "referral_code": 1})
    return {"balance": fresh.get("wallet_balance", 0), "referral_code": fresh.get("referral_code"), "transactions": txns}

# --- Ratings ---
@api.post("/ratings")
async def rate(body: RatingIn, user=Depends(current_user)):
    rec = {
        "id": str(uuid.uuid4()),
        "by": user["id"],
        "by_name": user["name"],
        "target_user_id": body.target_user_id,
        "job_id": body.job_id,
        "stars": max(1, min(5, body.stars)),
        "comment": body.comment,
        "created_at": now_iso(),
    }
    await db.ratings.insert_one(rec)
    agg = await db.ratings.aggregate([
        {"$match": {"target_user_id": body.target_user_id}},
        {"$group": {"_id": "$target_user_id", "avg": {"$avg": "$stars"}, "count": {"$sum": 1}}}
    ]).to_list(length=1)
    if agg:
        await db.users.update_one(
            {"id": body.target_user_id},
            {"$set": {"rating_avg": round(agg[0]["avg"], 2), "rating_count": agg[0]["count"]}}
        )
    rec.pop("_id", None)
    return rec

@api.get("/ratings/{user_id}")
async def get_ratings(user_id: str):
    cursor = db.ratings.find({"target_user_id": user_id}, {"_id": 0}).sort("created_at", -1).limit(50)
    return await cursor.to_list(length=50)

# --- AI Matching ---
@api.post("/ai/match-jobs")
async def ai_match_jobs(user=Depends(current_user)):
    if user["role"] != "worker":
        raise HTTPException(403, "Workers only")
    jobs = await db.jobs.find({"status": "open"}, {"_id": 0}).limit(40).to_list(length=40)
    if not jobs:
        return {"summary": "No jobs available yet. Check back soon.", "top_job_ids": []}
    skills = ", ".join(user.get("skills", []) or ["General"])
    wage = user.get("daily_wage", 0)
    city = user.get("city", "")
    job_brief = "\n".join([
        f"- id={j['id']} | {j['title']} | skill={j['skill']} | wage=₹{j['daily_wage']} | loc={j['location']}"
        for j in jobs[:20]
    ])
    prompt = (
        f"Worker skills: {skills}. Expected wage: ₹{wage}/day. City: {city}.\n"
        f"Available jobs:\n{job_brief}\n\n"
        "Pick top 3 best matching job ids and explain in 1 short Hindi+English sentence why. "
        "Return strictly as: IDS: id1,id2,id3 \\n REASON: <one line>"
    )
    text = "IDS: " + ",".join([j["id"] for j in jobs[:3]]) + "\nREASON: Matched by skill and wage."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"match-{user['id']}",
            system_message="You are a job matcher for Indian construction workers. Be concise."
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp)
    except Exception as e:
        logger.warning(f"AI match fallback: {e}")
    ids: List[str] = []
    reason = ""
    for line in text.splitlines():
        line = line.strip()
        if line.upper().startswith("IDS:"):
            ids = [x.strip() for x in line.split(":", 1)[1].split(",") if x.strip()][:3]
        elif line.upper().startswith("REASON:"):
            reason = line.split(":", 1)[1].strip()
    if not ids:
        ids = [j["id"] for j in jobs[:3]]
        reason = reason or "Matched by skill and wage."
    return {"summary": reason, "top_job_ids": ids}

# --- ERP (Contractor scope) ---
async def contractor_user(user=Depends(current_user)) -> dict:
    if user.get("role") != "contractor":
        raise HTTPException(403, "Contractors only")
    return user

# Materials
@api.post("/erp/materials")
async def add_material(body: MaterialIn, user=Depends(contractor_user)):
    rec = {"id": str(uuid.uuid4()), "owner": user["id"], **body.model_dump(), "created_at": now_iso()}
    await db.materials.insert_one(rec); rec.pop("_id", None); return rec

@api.get("/erp/materials")
async def list_materials(user=Depends(contractor_user)):
    cur = db.materials.find({"owner": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=500)

@api.put("/erp/materials/{mid}")
async def update_material(mid: str, body: MaterialIn, user=Depends(contractor_user)):
    res = await db.materials.update_one({"id": mid, "owner": user["id"]}, {"$set": body.model_dump()})
    if not res.matched_count: raise HTTPException(404, "Not found")
    return {"ok": True}

@api.delete("/erp/materials/{mid}")
async def del_material(mid: str, user=Depends(contractor_user)):
    res = await db.materials.delete_one({"id": mid, "owner": user["id"]})
    if not res.deleted_count: raise HTTPException(404, "Not found")
    return {"ok": True}

# Tools
@api.post("/erp/tools")
async def add_tool(body: ToolIn, user=Depends(contractor_user)):
    rec = {"id": str(uuid.uuid4()), "owner": user["id"], **body.model_dump(), "created_at": now_iso()}
    await db.tools.insert_one(rec); rec.pop("_id", None); return rec

@api.get("/erp/tools")
async def list_tools(user=Depends(contractor_user)):
    cur = db.tools.find({"owner": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=500)

@api.put("/erp/tools/{tid}")
async def update_tool(tid: str, body: ToolIn, user=Depends(contractor_user)):
    res = await db.tools.update_one({"id": tid, "owner": user["id"]}, {"$set": body.model_dump()})
    if not res.matched_count: raise HTTPException(404, "Not found")
    return {"ok": True}

@api.delete("/erp/tools/{tid}")
async def del_tool(tid: str, user=Depends(contractor_user)):
    res = await db.tools.delete_one({"id": tid, "owner": user["id"]})
    if not res.deleted_count: raise HTTPException(404, "Not found")
    return {"ok": True}

# Estimates
@api.post("/erp/estimates")
async def add_estimate(body: EstimateIn, user=Depends(contractor_user)):
    d = body.model_dump()
    total_cost = d["labour_cost"] + d["material_cost"] + d["equipment_cost"] + d["transport_cost"] + d["misc_cost"]
    profit = d["revenue"] - total_cost
    margin = round((profit / d["revenue"]) * 100, 2) if d["revenue"] else 0
    rec = {"id": str(uuid.uuid4()), "owner": user["id"], **d,
           "total_cost": total_cost, "profit": profit, "margin_pct": margin,
           "created_at": now_iso()}
    await db.estimates.insert_one(rec); rec.pop("_id", None); return rec

@api.get("/erp/estimates")
async def list_estimates(user=Depends(contractor_user)):
    cur = db.estimates.find({"owner": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=500)

@api.delete("/erp/estimates/{eid}")
async def del_estimate(eid: str, user=Depends(contractor_user)):
    res = await db.estimates.delete_one({"id": eid, "owner": user["id"]})
    if not res.deleted_count: raise HTTPException(404, "Not found")
    return {"ok": True}

# Bills
def _calc_bill(items, tax_pct):
    subtotal = sum((it.get("qty", 0) * it.get("rate", 0)) for it in items)
    tax = round(subtotal * tax_pct / 100, 2)
    return subtotal, tax, subtotal + tax

@api.post("/erp/bills")
async def add_bill(body: BillIn, user=Depends(contractor_user)):
    items = [it.model_dump() for it in body.items]
    sub, tax, total = _calc_bill(items, body.tax_pct)
    count = await db.bills.count_documents({"owner": user["id"]})
    bill_no = f"BM-{datetime.now(timezone.utc).year}-{count+1:04d}"
    rec = {"id": str(uuid.uuid4()), "owner": user["id"], "bill_no": bill_no,
           "bill_to": body.bill_to, "project": body.project, "items": items,
           "tax_pct": body.tax_pct, "subtotal": sub, "tax_amount": tax, "total": total,
           "notes": body.notes, "status": "unpaid", "created_at": now_iso()}
    await db.bills.insert_one(rec); rec.pop("_id", None); return rec

@api.get("/erp/bills")
async def list_bills(user=Depends(contractor_user)):
    cur = db.bills.find({"owner": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cur.to_list(length=500)

@api.post("/erp/bills/{bid}/mark-paid")
async def mark_bill_paid(bid: str, user=Depends(contractor_user)):
    res = await db.bills.update_one({"id": bid, "owner": user["id"]}, {"$set": {"status": "paid"}})
    if not res.matched_count: raise HTTPException(404, "Not found")
    return {"ok": True}

@api.delete("/erp/bills/{bid}")
async def del_bill(bid: str, user=Depends(contractor_user)):
    res = await db.bills.delete_one({"id": bid, "owner": user["id"]})
    if not res.deleted_count: raise HTTPException(404, "Not found")
    return {"ok": True}

@api.get("/erp/dashboard")
async def erp_dashboard(user=Depends(contractor_user)):
    mat = await db.materials.count_documents({"owner": user["id"]})
    low = await db.materials.count_documents({"owner": user["id"], "$expr": {"$lte": ["$qty", "$min_qty"]}})
    tools_total = await db.tools.count_documents({"owner": user["id"]})
    tools_inuse = await db.tools.count_documents({"owner": user["id"], "status": "in_use"})
    est = await db.estimates.count_documents({"owner": user["id"]})
    bills_total = await db.bills.count_documents({"owner": user["id"]})
    bills_paid = await db.bills.count_documents({"owner": user["id"], "status": "paid"})
    rev_agg = await db.bills.aggregate([
        {"$match": {"owner": user["id"]}},
        {"$group": {"_id": "$status", "sum": {"$sum": "$total"}}}
    ]).to_list(length=10)
    revenue_paid = sum(r["sum"] for r in rev_agg if r["_id"] == "paid")
    revenue_pending = sum(r["sum"] for r in rev_agg if r["_id"] != "paid")
    return {
        "materials_total": mat, "materials_low_stock": low,
        "tools_total": tools_total, "tools_in_use": tools_inuse,
        "estimates_total": est,
        "bills_total": bills_total, "bills_paid": bills_paid,
        "revenue_paid": revenue_paid, "revenue_pending": revenue_pending,
    }

# --- Chat ---
def _thread_id(a: str, b: str) -> str:
    return "-".join(sorted([a, b]))

@api.post("/chat/send")
async def chat_send(body: ChatSendIn, user=Depends(current_user)):
    peer = await db.users.find_one({"id": body.to_user_id}, {"_id": 0, "id": 1, "name": 1, "role": 1})
    if not peer:
        raise HTTPException(404, "Recipient not found")
    msg = {
        "id": str(uuid.uuid4()),
        "thread_id": _thread_id(user["id"], body.to_user_id),
        "from_id": user["id"], "from_name": user["name"],
        "to_id": body.to_user_id, "to_name": peer["name"],
        "text": body.text[:2000],
        "read": False,
        "created_at": now_iso(),
    }
    await db.chat_messages.insert_one(msg)
    msg.pop("_id", None)
    return msg

@api.get("/chat/threads")
async def chat_threads(user=Depends(current_user)):
    pipeline = [
        {"$match": {"$or": [{"from_id": user["id"]}, {"to_id": user["id"]}]}},
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": "$thread_id",
            "last_text": {"$first": "$text"},
            "last_at": {"$first": "$created_at"},
            "from_id": {"$first": "$from_id"},
            "to_id": {"$first": "$to_id"},
            "from_name": {"$first": "$from_name"},
            "to_name": {"$first": "$to_name"},
        }},
        {"$sort": {"last_at": -1}},
    ]
    raw = await db.chat_messages.aggregate(pipeline).to_list(length=100)
    out = []
    for t in raw:
        peer_id = t["to_id"] if t["from_id"] == user["id"] else t["from_id"]
        peer_name = t["to_name"] if t["from_id"] == user["id"] else t["from_name"]
        out.append({
            "thread_id": t["_id"], "peer_id": peer_id, "peer_name": peer_name,
            "last_text": t["last_text"], "last_at": t["last_at"],
        })
    return out

@api.get("/chat/messages/{peer_id}")
async def chat_messages(peer_id: str, user=Depends(current_user)):
    tid = _thread_id(user["id"], peer_id)
    msgs = await db.chat_messages.find({"thread_id": tid}, {"_id": 0}).sort("created_at", 1).to_list(length=500)
    await db.chat_messages.update_many({"thread_id": tid, "to_id": user["id"], "read": False}, {"$set": {"read": True}})
    return msgs

# --- Payroll (Contractor or Client view of worker wages) ---
@api.get("/payroll")
async def payroll(month: Optional[str] = None, user=Depends(current_user)):
    if user["role"] not in ("contractor", "client", "admin"):
        raise HTTPException(403, "Only contractor/client/admin can view payroll")
    # filter attendance by month YYYY-MM, default current month
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
    att = await db.attendance.find(
        {"type": "check_in", "created_at": {"$regex": f"^{month}"}, "within_geofence": True},
        {"_id": 0, "selfie": 0}
    ).to_list(length=2000)
    by_worker: dict = {}
    for a in att:
        wid = a["worker_id"]
        by_worker.setdefault(wid, {"worker_id": wid, "worker_name": a["worker_name"], "days_present": 0, "jobs": set()})
        by_worker[wid]["days_present"] += 1
        if a.get("job_id"): by_worker[wid]["jobs"].add(a["job_id"])
    out = []
    for wid, row in by_worker.items():
        worker = await db.users.find_one({"id": wid}, {"_id": 0, "daily_wage": 1, "mobile": 1})
        wage = (worker or {}).get("daily_wage", 0)
        out.append({
            "worker_id": wid, "worker_name": row["worker_name"],
            "mobile": (worker or {}).get("mobile"),
            "days_present": row["days_present"],
            "daily_wage": wage,
            "total_wage": row["days_present"] * wage,
            "jobs_count": len(row["jobs"]),
        })
    total = sum(r["total_wage"] for r in out)
    return {"month": month, "rows": sorted(out, key=lambda x: -x["total_wage"]), "grand_total": total}

# --- AI Worker Recommendation (for client/contractor) ---
@api.get("/ai/recommend-workers/{job_id}")
async def ai_recommend_workers(job_id: str, user=Depends(current_user)):
    if user["role"] not in ("client", "contractor"):
        raise HTTPException(403, "Clients/contractors only")
    job = await db.jobs.find_one({"id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found")
    candidates = await db.users.find(
        {"role": "worker", "skills": job["skill"], "available": True},
        {"_id": 0, "password": 0}
    ).limit(30).to_list(length=30)
    if not candidates:
        candidates = await db.users.find(
            {"role": "worker", "available": True},
            {"_id": 0, "password": 0}
        ).limit(20).to_list(length=20)
    if not candidates:
        return {"summary": "No available workers right now.", "top_ids": [], "candidates": []}
    brief = "\n".join([
        f"- id={c['id']} | {c['name']} | skills={c.get('skills')} | wage=₹{c.get('daily_wage',0)} | rating={c.get('rating_avg',0)} ({c.get('rating_count',0)}) | city={c.get('city','')} | verified={c.get('aadhaar_verified', False)}"
        for c in candidates
    ])
    prompt = (
        f"Job: {job['title']} ({job['skill']}) at {job['location']}. Pays ₹{job['daily_wage']}/day, needs {job['workers_needed']} worker(s).\n"
        f"Candidates:\n{brief}\n\nPick the TOP 3 best-fit workers and explain in 1 short sentence why. "
        "Reply strictly as:\nIDS: id1,id2,id3\nREASON: <one line>"
    )
    text = "IDS: " + ",".join([c["id"] for c in candidates[:3]]) + "\nREASON: Matched by skill, wage and rating."
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"rec-{job_id}",
            system_message="You are a hiring advisor for an Indian construction marketplace. Be concise."
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp)
    except Exception as e:
        logger.warning(f"AI recommend fallback: {e}")
    ids: List[str] = []
    reason = "Matched by skill and rating."
    for line in text.splitlines():
        line = line.strip()
        if line.upper().startswith("IDS:"):
            ids = [x.strip() for x in line.split(":", 1)[1].split(",") if x.strip()][:3]
        elif line.upper().startswith("REASON:"):
            reason = line.split(":", 1)[1].strip()
    if not ids:
        ids = [c["id"] for c in candidates[:3]]
    return {"summary": reason, "top_ids": ids, "candidates": [c for c in candidates if c["id"] in ids]}

# --- Bill exports (PDF + Excel) ---
def _build_bill_pdf(bill: dict, owner_name: str) -> bytes:
    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors as rl
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm,
        title=f"BuildMitra Invoice {bill['bill_no']}",
    )
    styles = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=styles["Heading1"], textColor=rl.HexColor("#18181B"), fontSize=22, spaceAfter=4)
    brand = ParagraphStyle("brand", parent=styles["Normal"], textColor=rl.HexColor("#F59E0B"), fontSize=11, fontName="Helvetica-Bold")
    label = ParagraphStyle("label", parent=styles["Normal"], textColor=rl.HexColor("#71717A"), fontSize=9, fontName="Helvetica-Bold")
    body = ParagraphStyle("body", parent=styles["Normal"], fontSize=11, textColor=rl.HexColor("#18181B"))
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=rl.HexColor("#71717A"))

    story = []
    # Header
    story.append(Paragraph("BuildMitra", brand))
    story.append(Paragraph("INVOICE", h1))
    story.append(Spacer(1, 8))

    meta = Table([
        [Paragraph("INVOICE NO", label), Paragraph(bill["bill_no"], body)],
        [Paragraph("DATE", label), Paragraph(bill["created_at"][:10], body)],
        [Paragraph("STATUS", label), Paragraph(bill["status"].upper(), body)],
    ], colWidths=[35*mm, 80*mm])
    meta.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    story.append(meta)
    story.append(Spacer(1, 14))

    parties = Table([
        [Paragraph("FROM", label), Paragraph("BILL TO", label)],
        [Paragraph(owner_name, body), Paragraph(bill["bill_to"], body)],
        [Paragraph(bill.get("project", "") or "", small), Paragraph("", small)],
    ], colWidths=[85*mm, 85*mm])
    parties.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    story.append(parties)
    story.append(Spacer(1, 16))

    # Line items
    rows = [["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]]
    for i, it in enumerate(bill["items"], 1):
        amt = it["qty"] * it["rate"]
        rows.append([str(i), it["description"], f"{it['qty']:g}", f"{it['rate']:,.2f}", f"{amt:,.2f}"])
    tbl = Table(rows, colWidths=[12*mm, 88*mm, 20*mm, 25*mm, 30*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), rl.HexColor("#F59E0B")),
        ("TEXTCOLOR", (0,0), (-1,0), rl.HexColor("#18181B")),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("ALIGN", (0,0), (-1,0), "LEFT"),
        ("ALIGN", (2,0), (-1,-1), "RIGHT"),
        ("FONTSIZE", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("LINEBELOW", (0,0), (-1,-1), 0.4, rl.HexColor("#E4E4E7")),
    ]))
    story.append(tbl)
    story.append(Spacer(1, 12))

    totals = Table([
        ["Subtotal", f"₹{bill['subtotal']:,.2f}"],
        [f"GST ({bill['tax_pct']:g}%)", f"₹{bill['tax_amount']:,.2f}"],
        ["TOTAL", f"₹{bill['total']:,.2f}"],
    ], colWidths=[140*mm, 35*mm])
    totals.setStyle(TableStyle([
        ("ALIGN", (0,0), (-1,-1), "RIGHT"),
        ("FONTSIZE", (0,0), (-1,-1), 11),
        ("FONTNAME", (0,2), (-1,2), "Helvetica-Bold"),
        ("BACKGROUND", (0,2), (-1,2), rl.HexColor("#FEF3C7")),
        ("TEXTCOLOR", (0,2), (-1,2), rl.HexColor("#B45309")),
        ("FONTSIZE", (0,2), (-1,2), 14),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(totals)
    story.append(Spacer(1, 20))

    if bill.get("notes"):
        story.append(Paragraph("Notes", label))
        story.append(Paragraph(bill["notes"], body))
        story.append(Spacer(1, 12))

    story.append(Paragraph("Generated by BuildMitra · India's construction workforce platform", small))
    doc.build(story)
    return buf.getvalue()

def _build_bill_xlsx(bill: dict, owner_name: str) -> bytes:
    from io import BytesIO
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
    wb = Workbook(); ws = wb.active; ws.title = "Invoice"
    bold = Font(bold=True); white = Font(bold=True, color="18181B")
    brand_fill = PatternFill("solid", fgColor="F59E0B")
    total_fill = PatternFill("solid", fgColor="FEF3C7")
    thin = Side(style="thin", color="E4E4E7"); border = Border(bottom=thin)
    right = Alignment(horizontal="right")

    ws["A1"] = "BuildMitra Invoice"; ws["A1"].font = Font(bold=True, size=18, color="F59E0B")
    ws["A3"] = "Invoice No"; ws["A3"].font = bold; ws["B3"] = bill["bill_no"]
    ws["A4"] = "Date"; ws["A4"].font = bold; ws["B4"] = bill["created_at"][:10]
    ws["A5"] = "Status"; ws["A5"].font = bold; ws["B5"] = bill["status"].upper()
    ws["A7"] = "From"; ws["A7"].font = bold; ws["B7"] = owner_name
    ws["A8"] = "Bill To"; ws["A8"].font = bold; ws["B8"] = bill["bill_to"]
    ws["A9"] = "Project"; ws["A9"].font = bold; ws["B9"] = bill.get("project", "") or ""

    headers = ["#", "Description", "Qty", "Rate (₹)", "Amount (₹)"]
    start = 11
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=start, column=c, value=h)
        cell.font = white; cell.fill = brand_fill
    r = start + 1
    for i, it in enumerate(bill["items"], 1):
        ws.cell(row=r, column=1, value=i)
        ws.cell(row=r, column=2, value=it["description"])
        ws.cell(row=r, column=3, value=it["qty"]).alignment = right
        ws.cell(row=r, column=4, value=it["rate"]).alignment = right
        ws.cell(row=r, column=5, value=it["qty"] * it["rate"]).alignment = right
        for c in range(1, 6):
            ws.cell(row=r, column=c).border = border
        r += 1
    r += 1
    ws.cell(row=r, column=4, value="Subtotal").font = bold
    ws.cell(row=r, column=5, value=bill["subtotal"]).alignment = right; r += 1
    ws.cell(row=r, column=4, value=f"GST ({bill['tax_pct']}%)").font = bold
    ws.cell(row=r, column=5, value=bill["tax_amount"]).alignment = right; r += 1
    tc1 = ws.cell(row=r, column=4, value="TOTAL"); tc1.font = bold; tc1.fill = total_fill
    tc2 = ws.cell(row=r, column=5, value=bill["total"]); tc2.font = bold; tc2.fill = total_fill; tc2.alignment = right

    ws.column_dimensions["A"].width = 6
    ws.column_dimensions["B"].width = 48
    ws.column_dimensions["C"].width = 10
    ws.column_dimensions["D"].width = 14
    ws.column_dimensions["E"].width = 16
    buf = BytesIO(); wb.save(buf); return buf.getvalue()

import base64 as _b64

@api.get("/erp/bills/{bid}/pdf")
async def bill_pdf(bid: str, user=Depends(contractor_user)):
    bill = await db.bills.find_one({"id": bid, "owner": user["id"]}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Bill not found")
    pdf = _build_bill_pdf(bill, user.get("company_name") or user["name"])
    return {
        "filename": f"{bill['bill_no']}.pdf",
        "mime": "application/pdf",
        "base64": _b64.b64encode(pdf).decode(),
    }

@api.get("/erp/bills/{bid}/excel")
async def bill_excel(bid: str, user=Depends(contractor_user)):
    bill = await db.bills.find_one({"id": bid, "owner": user["id"]}, {"_id": 0})
    if not bill:
        raise HTTPException(404, "Bill not found")
    xlsx = _build_bill_xlsx(bill, user.get("company_name") or user["name"])
    return {
        "filename": f"{bill['bill_no']}.xlsx",
        "mime": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "base64": _b64.b64encode(xlsx).decode(),
    }

# --- Complaints (any user can file) ---
@api.post("/complaints")
async def file_complaint(body: ComplaintIn, user=Depends(current_user)):
    rec = {
        "id": str(uuid.uuid4()),
        "by_user_id": user["id"],
        "by_user_name": user["name"],
        "by_user_role": user["role"],
        "against_user_id": body.against_user_id,
        "subject": body.subject,
        "description": body.description,
        "status": "open",  # open | resolved | rejected
        "admin_note": "",
        "created_at": now_iso(),
    }
    await db.complaints.insert_one(rec)
    rec.pop("_id", None)
    return rec

@api.get("/complaints/mine")
async def my_complaints(user=Depends(current_user)):
    cursor = db.complaints.find({"by_user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(length=100)

# --- Admin ---
async def admin_user(user=Depends(current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user

@api.get("/admin/stats")
async def admin_stats(_=Depends(admin_user)):
    total_workers = await db.users.count_documents({"role": "worker"})
    total_contractors = await db.users.count_documents({"role": "contractor"})
    total_clients = await db.users.count_documents({"role": "client"})
    total_jobs = await db.jobs.count_documents({})
    active_jobs = await db.jobs.count_documents({"status": "open"})
    completed_jobs = await db.jobs.count_documents({"status": "closed"})
    total_applications = await db.applications.count_documents({})
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    daily_attendance = await db.attendance.count_documents({"created_at": {"$regex": f"^{today}"}})
    open_complaints = await db.complaints.count_documents({"status": "open"})
    pending_verifications = await db.users.count_documents({
        "role": {"$in": ["worker", "contractor"]}, "aadhaar_verified": False
    })
    total_wallet = await db.users.aggregate([
        {"$group": {"_id": None, "sum": {"$sum": "$wallet_balance"}}}
    ]).to_list(length=1)
    revenue_proxy = (total_wallet[0]["sum"] if total_wallet else 0)
    return {
        "total_workers": total_workers,
        "total_contractors": total_contractors,
        "total_clients": total_clients,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "total_applications": total_applications,
        "daily_attendance": daily_attendance,
        "open_complaints": open_complaints,
        "pending_verifications": pending_verifications,
        "wallet_payouts": revenue_proxy,
    }

@api.get("/admin/users")
async def admin_users(role: Optional[str] = None, q: Optional[str] = None, _=Depends(admin_user)):
    query: dict = {}
    if role:
        query["role"] = role
    if q:
        query["$or"] = [{"name": {"$regex": q, "$options": "i"}}, {"mobile": {"$regex": q}}]
    cursor = db.users.find(query, {"_id": 0, "password": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(length=200)

@api.post("/admin/users/{user_id}/verify")
async def admin_verify(user_id: str, _=Depends(admin_user)):
    res = await db.users.update_one({"id": user_id}, {"$set": {"aadhaar_verified": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}

@api.post("/admin/users/{user_id}/suspend")
async def admin_suspend(user_id: str, _=Depends(admin_user)):
    res = await db.users.update_one({"id": user_id}, {"$set": {"suspended": True, "available": False}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}

@api.post("/admin/users/{user_id}/unsuspend")
async def admin_unsuspend(user_id: str, _=Depends(admin_user)):
    res = await db.users.update_one({"id": user_id}, {"$set": {"suspended": False, "available": True}})
    if res.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"ok": True}

@api.get("/admin/jobs")
async def admin_jobs(_=Depends(admin_user)):
    cursor = db.jobs.find({}, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(length=200)

@api.post("/admin/jobs/{job_id}/close")
async def admin_close_job(job_id: str, _=Depends(admin_user)):
    res = await db.jobs.update_one({"id": job_id}, {"$set": {"status": "closed"}})
    if res.matched_count == 0:
        raise HTTPException(404, "Job not found")
    return {"ok": True}

@api.get("/admin/attendance")
async def admin_attendance(_=Depends(admin_user)):
    cursor = db.attendance.find({}, {"_id": 0, "selfie": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(length=200)

@api.get("/admin/complaints")
async def admin_complaints(status: Optional[str] = None, _=Depends(admin_user)):
    query: dict = {}
    if status:
        query["status"] = status
    cursor = db.complaints.find(query, {"_id": 0}).sort("created_at", -1).limit(200)
    return await cursor.to_list(length=200)

@api.post("/admin/complaints/{cid}/resolve")
async def admin_resolve_complaint(cid: str, note: Optional[str] = "", _=Depends(admin_user)):
    res = await db.complaints.update_one({"id": cid}, {"$set": {"status": "resolved", "admin_note": note or ""}})
    if res.matched_count == 0:
        raise HTTPException(404, "Complaint not found")
    return {"ok": True}

@api.post("/admin/complaints/{cid}/reject")
async def admin_reject_complaint(cid: str, note: Optional[str] = "", _=Depends(admin_user)):
    res = await db.complaints.update_one({"id": cid}, {"$set": {"status": "rejected", "admin_note": note or ""}})
    if res.matched_count == 0:
        raise HTTPException(404, "Complaint not found")
    return {"ok": True}

# --- Seed ---
async def seed():
    if await db.users.count_documents({"role": "client"}) > 0:
        return
    logger.info("Seeding demo data...")
    demo_client = {
        "id": str(uuid.uuid4()), "name": "Sharma Builders",
        "mobile": "9000000001", "password": hash_pw("demo1234"),
        "role": "client", "photo": None, "skills": [], "experience_years": 0,
        "daily_wage": 0, "available": True, "city": "Mumbai",
        "company_name": "Sharma Builders Pvt Ltd", "aadhaar_verified": True,
        "language": "en", "rating_avg": 4.6, "rating_count": 12,
        "referral_code": "BM0001AAAA", "referred_by": None, "wallet_balance": 0,
        "created_at": now_iso(),
    }
    demo_worker = {
        "id": str(uuid.uuid4()), "name": "Ramesh Kumar",
        "mobile": "9000000002", "password": hash_pw("demo1234"),
        "role": "worker", "photo": None,
        "skills": ["Mason", "Tile Worker"], "experience_years": 6,
        "daily_wage": 800, "available": True, "city": "Mumbai",
        "company_name": "", "aadhaar_verified": True, "language": "en",
        "rating_avg": 4.4, "rating_count": 9,
        "referral_code": "BM0002BBBB", "referred_by": None, "wallet_balance": 50,
        "created_at": now_iso(),
    }
    demo_contractor = {
        "id": str(uuid.uuid4()), "name": "Suresh Patel",
        "mobile": "9000000003", "password": hash_pw("demo1234"),
        "role": "contractor", "photo": None,
        "skills": [], "experience_years": 12, "daily_wage": 0,
        "available": True, "city": "Pune",
        "company_name": "Patel Construction Co", "aadhaar_verified": True,
        "language": "en", "rating_avg": 4.8, "rating_count": 24,
        "referral_code": "BM0003CCCC", "referred_by": None, "wallet_balance": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_many([demo_client, demo_worker, demo_contractor])

    admin_user_doc = {
        "id": str(uuid.uuid4()), "name": "BuildMitra Admin",
        "mobile": "9000000000", "password": hash_pw("admin1234"),
        "role": "admin", "photo": None, "skills": [], "experience_years": 0,
        "daily_wage": 0, "available": True, "city": "HQ",
        "company_name": "BuildMitra", "aadhaar_verified": True, "language": "en",
        "rating_avg": 0.0, "rating_count": 0,
        "referral_code": "BMADMIN001", "referred_by": None, "wallet_balance": 0,
        "created_at": now_iso(),
    }
    await db.users.insert_one(admin_user_doc)

    # Seed two demo complaints so admin panel has content
    await db.complaints.insert_many([
        {
            "id": str(uuid.uuid4()),
            "by_user_id": demo_worker["id"],
            "by_user_name": demo_worker["name"],
            "by_user_role": "worker",
            "against_user_id": demo_client["id"],
            "subject": "Payment delayed by 7 days",
            "description": "Worked at Andheri site for 5 days, payment still pending.",
            "status": "open", "admin_note": "",
            "created_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "by_user_id": demo_client["id"],
            "by_user_name": demo_client["name"],
            "by_user_role": "client",
            "against_user_id": demo_worker["id"],
            "subject": "Worker not reporting on time",
            "description": "Two workers consistently late by 1+ hour.",
            "status": "open", "admin_note": "",
            "created_at": now_iso(),
        },
    ])

    sample_jobs = [
        ("Mason needed for 2BHK plastering", "Need experienced mason for wall plastering work. Daily basis.", "Mason", 5, 900, "Andheri, Mumbai", "Urgent"),
        ("Tile workers for villa", "Italian tiles to be laid in 3 rooms. Skilled tile workers only.", "Tile Worker", 3, 1100, "Bandra, Mumbai", "Normal"),
        ("Electrician for new office", "Complete wiring + DB installation for 1500sqft office.", "Electrician", 2, 1200, "Powai, Mumbai", "Normal"),
        ("Painter team for apartment", "Interior painting (3 coats) of 3BHK + ceiling.", "Painter", 4, 850, "Thane, Mumbai", "Urgent"),
        ("Plumber for villa", "PVC + CPVC plumbing complete fitting.", "Plumber", 2, 1000, "Pune, Maharashtra", "Normal"),
        ("Helper required at site", "General site helper required immediately.", "Helper", 8, 500, "Andheri, Mumbai", "Urgent"),
        ("Steel fixer for slab", "RCC slab steel fixing 2000 sqft.", "Steel Fixer", 6, 1100, "Vashi, Navi Mumbai", "Normal"),
        ("Carpenter for furniture", "Wardrobe + modular kitchen carpentry.", "Carpenter", 2, 1300, "Goregaon, Mumbai", "Normal"),
    ]
    for title, desc, skill, n, wage, loc, urgency in sample_jobs:
        await db.jobs.insert_one({
            "id": str(uuid.uuid4()),
            "posted_by": demo_client["id"],
            "posted_by_name": demo_client["name"],
            "posted_by_role": "client",
            "title": title, "description": desc, "skill": skill,
            "workers_needed": n, "daily_wage": wage,
            "location": loc, "site_address": loc,
            "start_date": None, "duration_days": 10,
            "working_hours": "8 hrs", "urgency": urgency,
            "lat": None, "lng": None,
            "status": "open", "applicants_count": 0,
            "created_at": now_iso(),
        })
    logger.info("Seed done.")

app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_start():
    await seed()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
