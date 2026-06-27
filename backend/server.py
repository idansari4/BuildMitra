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
    urgency: Optional[str] = "Normal"  # Normal | Urgent
    lat: Optional[float] = None
    lng: Optional[float] = None

class ApplyIn(BaseModel):
    job_id: str
    message: Optional[str] = ""

class AttendanceIn(BaseModel):
    job_id: str
    type: str  # check_in | check_out
    lat: float
    lng: float
    selfie: str  # base64

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
    token = make_token(user["id"], user["role"])
    user.pop("_id", None)
    user.pop("password", None)
    return {"token": token, "user": user}

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
@api.post("/attendance")
async def attendance(body: AttendanceIn, user=Depends(current_user)):
    rec = {
        "id": str(uuid.uuid4()),
        "worker_id": user["id"],
        "worker_name": user["name"],
        "job_id": body.job_id,
        "type": body.type,
        "lat": body.lat,
        "lng": body.lng,
        "selfie": body.selfie[:200000],
        "face_verified": True,  # mocked
        "created_at": now_iso(),
    }
    await db.attendance.insert_one(rec)
    rec.pop("_id", None)
    rec.pop("selfie", None)
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
