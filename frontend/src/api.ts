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
  me: () => req("GET", "/me"),
  updateMe: (b: any) => req("PUT", "/me", b),
  skills: () => req("GET", "/skills"),
  jobs: (skill?: string) => req("GET", `/jobs${skill ? `?skill=${encodeURIComponent(skill)}` : ""}`),
  job: (id: string) => req("GET", `/jobs/${id}`),
  myJobs: () => req("GET", "/jobs/mine"),
  postJob: (b: any) => req("POST", "/jobs", b),
  apply: (b: any) => req("POST", "/applications", b),
  myApplications: () => req("GET", "/applications/mine"),
  jobApplicants: (jobId: string) => req("GET", `/applications/job/${jobId}`),
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
};
