import { storage } from "@/src/utils/storage";

const BASE = (process.env.EXPO_PUBLIC_BACKEND_URL || "").replace(/\/$/, "") + "/api";

let _token: string | null = null;

export async function loadToken() {
  if (_token) return _token;
  _token = await storage.secureGet<string>("bm_token", "");
  return _token || null;
}

export async function setToken(t: string | null) {
  _token = t;
  if (t) await storage.secureSet("bm_token", t);
  else await storage.secureRemove("bm_token");
}

async function req<T = any>(method: string, path: string, body?: any): Promise<T> {
  await loadToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (_token) headers.Authorization = `Bearer ${_token}`;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { json = { detail: txt }; }
  if (!res.ok) throw new Error(json?.detail || `HTTP ${res.status}`);
  return json as T;
}

export const api = {
  register: (b: any) => req("POST", "/auth/register", b),
  login: (b: any) => req("POST", "/auth/login", b),
  otpSend: (mobile: string) => req("POST", "/auth/otp/send", { mobile }),
  otpVerify: (b: any) => req("POST", "/auth/otp/verify", b),
  aadhaarVerify: (aadhaar: string) => req("POST", "/profile/aadhaar/verify", { aadhaar }),
  me: () => req("GET", "/me"),
  updateMe: (b: any) => req("PUT", "/me", b),
  changePassword: (old_password: string, new_password: string) => req("PUT", "/me/password", { old_password, new_password }),
  skills: () => req("GET", "/skills"),
  jobs: (skill?: string) => req("GET", `/jobs${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`),
  job: (id: string) => req("GET", `/jobs/${id}`),
  myJobs: () => req("GET", "/jobs/mine"),
  postJob: (b: any) => req("POST", "/jobs", b),
  apply: (b: any) => req("POST", "/applications", b),
  myApplications: () => req("GET", "/applications/mine"),
  jobApplicants: (jobId: string) => req("GET", `/applications/job/${jobId}`),
  updateApplication: (appId: string, status: "accepted" | "rejected" | "pending") =>
    req("POST", `/applications/${appId}/status`, { status }),
  updateJobStatus: (jobId: string, status: "open" | "in_progress" | "completed" | "cancelled") =>
    req("POST", `/jobs/${jobId}/status`, { status }),
  hiredJobs: () => req("GET", "/jobs/hired"),
  workerProfile: (wid: string) => req("GET", `/workers/${wid}`),
  attendanceMyWorkers: (days = 30) => req("GET", `/attendance/my-workers?days=${days}`),
  walletWithdraw: (amount: number, upi_id: string) =>
    req("POST", "/wallet/withdraw", { amount, upi_id }),

  // ---- Phase 2 ----
  forgotPassword: (mobile: string) => req("POST", "/auth/forgot-password", { mobile }),
  resetPassword: (mobile: string, otp: string, new_password: string) =>
    req("POST", "/auth/reset-password", { mobile, otp, new_password }),

  escrowDeposit: (job_id: string, amount: number) => req("POST", "/escrow/deposit", { job_id, amount }),
  escrowMine: () => req("GET", "/escrow/mine"),
  escrowRelease: (escrow_id: string, worker_id: string, amount: number) =>
    req("POST", "/escrow/release", { escrow_id, worker_id, amount }),
  escrowRefund: (escrow_id: string) => req("POST", "/escrow/refund", { escrow_id }),

  ratingsForUser: (uid: string) => req("GET", `/ratings/user/${uid}`),
  ratingsMine: () => req("GET", "/ratings/mine"),
  submitRating: (target_user_id: string, stars: number, comment?: string, job_id?: string) =>
    req("POST", "/ratings", { target_user_id, stars, comment: comment || "", job_id: job_id || null }),

  leaveRequest: (body: any) => req("POST", "/leave/request", body),
  leaveMine: () => req("GET", "/leave/mine"),
  leaveInbox: () => req("GET", "/leave/inbox"),
  leaveDecision: (id: string, decision: "approved" | "rejected", note?: string) =>
    req("POST", `/leave/${id}/decision`, { decision, note: note || "" }),

  addProgressPhoto: (body: any) => req("POST", "/progress-photos", body),
  listProgressPhotos: (job_id: string) => req("GET", `/progress-photos/${job_id}`),
  deleteProgressPhoto: (id: string) => req("DELETE", `/progress-photos/${id}`),

  projectProgress: () => req("GET", "/projects/progress"),
  salarySummary: (months = 6) => req("GET", `/salary/summary?months=${months}`),

  adminActivity: (limit = 100) => req("GET", `/admin/activity?limit=${limit}`),
  adminMonitor: () => req("GET", "/admin/monitor"),

  jobsSearch: (params: { min_wage?: number; max_wage?: number; skill?: string; city?: string; status?: string }) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== "") qs.append(k, String(v)); });
    return req("GET", `/jobs/search?${qs.toString()}`);
  },
  attendance: (b: any) => req("POST", "/attendance", b),
  myAttendance: () => req("GET", "/attendance/mine"),
  workers: (skill?: string) => req("GET", `/workers${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`),
  wallet: () => req("GET", "/wallet"),
  rate: (b: any) => req("POST", "/ratings", b),
  aiMatch: () => req("POST", "/ai/match-jobs"),
  // complaints
  fileComplaint: (b: any) => req("POST", "/complaints", b),
  myComplaints: () => req("GET", "/complaints/mine"),
  // admin
  adminStats: () => req("GET", "/admin/stats"),
  adminUsers: (role?: string, q?: string) => {
    const params = new URLSearchParams();
    if (role) params.set("role", role);
    if (q) params.set("q", q);
    const qs = params.toString();
    return req("GET", `/admin/users${qs ? "?" + qs : ""}`);
  },
  adminVerify: (uid: string) => req("POST", `/admin/users/${uid}/verify`),
  adminSuspend: (uid: string) => req("POST", `/admin/users/${uid}/suspend`),
  adminUnsuspend: (uid: string) => req("POST", `/admin/users/${uid}/unsuspend`),
  adminJobs: () => req("GET", "/admin/jobs"),
  adminCloseJob: (jid: string) => req("POST", `/admin/jobs/${jid}/close`),
  adminAttendance: () => req("GET", "/admin/attendance"),
  adminComplaints: (status?: string) => req("GET", `/admin/complaints${status ? `?status=${status}` : ""}`),
  adminResolveComplaint: (cid: string) => req("POST", `/admin/complaints/${cid}/resolve`),
  adminRejectComplaint: (cid: string) => req("POST", `/admin/complaints/${cid}/reject`),
  // ERP
  erpDashboard: () => req("GET", "/erp/dashboard"),
  materialsList: () => req("GET", "/erp/materials"),
  materialAdd: (b: any) => req("POST", "/erp/materials", b),
  materialDel: (id: string) => req("DELETE", `/erp/materials/${id}`),
  toolsList: () => req("GET", "/erp/tools"),
  toolAdd: (b: any) => req("POST", "/erp/tools", b),
  toolDel: (id: string) => req("DELETE", `/erp/tools/${id}`),
  estimatesList: () => req("GET", "/erp/estimates"),
  estimateAdd: (b: any) => req("POST", "/erp/estimates", b),
  estimateDel: (id: string) => req("DELETE", `/erp/estimates/${id}`),
  billsList: () => req("GET", "/erp/bills"),
  billAdd: (b: any) => req("POST", "/erp/bills", b),
  billPaid: (id: string) => req("POST", `/erp/bills/${id}/mark-paid`),
  billDel: (id: string) => req("DELETE", `/erp/bills/${id}`),
  billPdf: (id: string) => req("GET", `/erp/bills/${id}/pdf`),
  billExcel: (id: string) => req("GET", `/erp/bills/${id}/excel`),
  // Payments
  paymentPricing: () => req("GET", "/payments/pricing"),
  createOrder: (b: any) => req("POST", "/payments/create-order", b),
  verifyPayment: (b: any) => req("POST", "/payments/verify", b),
  paymentHistory: () => req("GET", "/payments/history"),
  // Chat
  chatSend: (to_user_id: string, text: string) => req("POST", "/chat/send", { to_user_id, text }),
  chatThreads: () => req("GET", "/chat/threads"),
  chatMessages: (peer_id: string) => req("GET", `/chat/messages/${peer_id}`),
  // Payroll & AI
  payroll: (month?: string) => req("GET", `/payroll${month ? `?month=${month}` : ""}`),
  recommendWorkers: (jobId: string) => req("GET", `/ai/recommend-workers/${jobId}`),
};
