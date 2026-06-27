# BuildMitra — PRD

## Vision
Uber/Ola-style marketplace for India's construction workforce connecting Workers, Contractors and Clients.

## MVP Implemented
**Auth**: JWT-based mobile + password (3 seeded demo accounts: worker/contractor/client).
**Worker flow**: Splash → Role select → Login → Bottom tabs (Jobs / Applied / Attendance / Wallet / Profile). Browse jobs by skill chips, AI Job Match (Claude Haiku via Emergent LLM key), job detail with apply, attendance via GPS + selfie (front cam), profile editing of skills + daily wage.
**Client/Contractor flow**: Home shows posted jobs, Post Job tab to create listings (skill, wage, location, urgency), Activity shows applicants per job.
**Wallet & Referral**: Unique referral code per user, ₹50 credit when referee signs up, gamified Bronze/Silver/Gold badges + share sheet.
**Ratings**: 1–5 stars on users with average + count (endpoint ready).
**WhatsApp/Call**: Tap-to-call and WhatsApp deeplink on job detail.

## Tech
- Expo SDK 54 + expo-router + TypeScript
- FastAPI + MongoDB (Motor)
- Emergent LLM key (Claude Haiku 4.5) for AI matching
- expo-camera, expo-location, expo-image-picker for attendance
- Plus Jakarta Sans typography, Amber (#F59E0B) brand on charcoal

## Backend endpoints (all under /api)
- POST /auth/register, /auth/login
- GET /me, PUT /me, GET /skills
- POST /jobs, GET /jobs?skill=, GET /jobs/mine, GET /jobs/{id}
- POST /applications, GET /applications/mine, GET /applications/job/{id}
- POST /attendance, GET /attendance/mine
- GET /workers, GET /wallet
- POST /ratings, GET /ratings/{user_id}
- POST /ai/match-jobs

## Roadmap (deferred from full spec)
- Real OTP via Twilio SMS, Aadhaar verification API, Stripe/Razorpay UPI payments
- Contractor ERP (materials, tools, project cost)
- Admin panel, fraud detection, analytics dashboards
- Hindi i18n toggle, push notifications, real face verification AI
- Geo-fencing radius validation, offline attendance sync
- In-app chat with voice messages
