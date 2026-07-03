import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, SKILL_IMAGES, type as t } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton, Card, SecondaryButton } from "@/src/ui";

import { RatingSheet } from "@/src/rating-sheet";

const STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  open:         { bg: "#DCFCE7", color: "#16A34A", label: "OPEN" },
  in_progress:  { bg: "#FEF3C7", color: "#D97706", label: "IN PROGRESS" },
  completed:    { bg: "#DBEAFE", color: "#2563EB", label: "COMPLETED" },
  cancelled:    { bg: "#FEE2E2", color: "#DC2626", label: "CANCELLED" },
};
const APP_STATUS_META: Record<string, { bg: string; color: string; label: string }> = {
  pending:  { bg: "#FEF3C7", color: "#D97706", label: "Pending" },
  accepted: { bg: "#DCFCE7", color: "#16A34A", label: "Hired" },
  rejected: { bg: "#FEE2E2", color: "#DC2626", label: "Rejected" },
};

export default function JobDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [applicants, setApplicants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState("");
  const [applied, setApplied] = useState(false);
  const [busyAppId, setBusyAppId] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState(false);
  const [rateFor, setRateFor] = useState<{ id: string; name: string } | null>(null);

  const loadAll = async () => {
    try {
      const j = await api.job(id);
      setJob(j);
      if (user && user.id === j.posted_by) {
        try { setApplicants(await api.jobApplicants(id)); } catch {}
      }
      if (user?.role === "worker") {
        try {
          const mine = await api.myApplications();
          setApplied(mine.some((a: any) => a.job_id === id));
        } catch {}
      }
    } catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); /* eslint-disable-line */ }, [id, user]);

  const apply = async () => {
    setApplying(true); setMsg("");
    try { await api.apply({ job_id: id, message: "" }); setApplied(true); setMsg("Applied ✓"); }
    catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setApplying(false); }
  };

  const handleApplication = async (appId: string, status: "accepted" | "rejected") => {
    setBusyAppId(appId); setMsg("");
    try {
      await api.updateApplication(appId, status);
      setMsg(status === "accepted" ? "Worker hired ✓" : "Applicant rejected");
      setApplicants(await api.jobApplicants(id));
      const j = await api.job(id); setJob(j);
    } catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setBusyAppId(null); }
  };

  const changeJobStatus = async (status: "in_progress" | "completed" | "cancelled") => {
    const labels: any = { in_progress: "Start job", completed: "Mark complete", cancelled: "Cancel job" };
    Alert.alert(labels[status], "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: async () => {
        setBusyStatus(true); setMsg("");
        try {
          await api.updateJobStatus(id, status);
          const j = await api.job(id); setJob(j);
          setMsg("Job status updated ✓");
        } catch (e: any) { setMsg(e?.message || "Failed"); }
        finally { setBusyStatus(false); }
      } },
    ]);
  };

  const callPoster = () => job?.posted_by_name && Linking.openURL("tel:+919000000000").catch(() => {});
  const whatsapp = () => Linking.openURL(`https://wa.me/919000000000?text=${encodeURIComponent("Hi, regarding " + (job?.title || "your job posting"))}`).catch(() => {});
  const openChat = () => {
    if (!job || !user || user.id === job.posted_by) return;
    router.push({ pathname: "/chat/[peerId]", params: { peerId: job.posted_by, peerName: job.posted_by_name } } as any);
  };
  const viewWorker = (wid: string) => router.push({ pathname: "/worker/[id]", params: { id: wid } } as any);

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} />
    </SafeAreaView>
  );
  if (!job) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" }}>
      <Body>Job not found</Body>
    </SafeAreaView>
  );

  const heroImg = SKILL_IMAGES[job.skill] || SKILL_IMAGES.default;
  const isOwner = user?.id === job.posted_by;
  const isWorker = user?.role === "worker";
  const status = job.status || "open";
  const statusMeta = STATUS_META[status] || STATUS_META.open;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.hero}>
        <Image source={heroImg} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["top"]} style={{ flex: 1, padding: spacing.md, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Pressable testID="job-back" onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={colors.surface} />
            </Pressable>
            <View style={[styles.statusPill, { backgroundColor: statusMeta.bg }]}>
              <Body style={{ color: statusMeta.color, fontSize: 11, fontWeight: "800" }} testID="job-status-pill">
                {statusMeta.label}
              </Body>
            </View>
          </View>
          <View>
            <View style={styles.urgentBadge}>
              <Body style={{ color: colors.surface, fontSize: t.sm, fontWeight: "700" }}>{job.skill}</Body>
            </View>
            <H1 style={{ color: colors.surface, marginTop: 8 }} testID="job-title">{job.title}</H1>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
              <Ionicons name="location" size={16} color={colors.surfaceTertiary} />
              <Body style={{ color: colors.surfaceTertiary }}>{job.location}</Body>
            </View>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 160, gap: spacing.md }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Stat label="Daily Wage" value={`₹${job.daily_wage}`} highlight />
          <Stat label="Workers" value={String(job.workers_needed)} />
          <Stat label="Duration" value={`${job.duration_days}d`} />
        </View>

        <Card>
          <Body style={{ fontWeight: "700" }}>About the work</Body>
          <Body style={{ marginTop: 8, lineHeight: 22 }}>{job.description}</Body>
        </Card>

        <Card>
          <Body style={{ fontWeight: "700", marginBottom: 8 }}>Posted by</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.posterAvatar}>
              <Body style={{ fontWeight: "800", color: colors.onBrandPrimary }}>{job.posted_by_name?.[0]?.toUpperCase()}</Body>
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "700" }}>{job.posted_by_name}</Body>
              <Muted>{job.posted_by_role}</Muted>
            </View>
            <Pressable testID="call-poster" onPress={callPoster} style={styles.iconBtn}>
              <Ionicons name="call" size={20} color={colors.brand} />
            </Pressable>
            <Pressable testID="chat-poster" onPress={openChat} style={styles.iconBtn}>
              <Ionicons name="chatbubble" size={20} color={colors.brand} />
            </Pressable>
            <Pressable testID="whatsapp-poster" onPress={whatsapp} style={styles.iconBtn}>
              <Ionicons name="logo-whatsapp" size={20} color={colors.success} />
            </Pressable>
          </View>
        </Card>

        {isOwner && applicants.length > 0 && (
          <View>
            <Body style={{ fontWeight: "700", marginBottom: 8 }}>Applicants ({applicants.length})</Body>
            {applicants.map((a) => {
              const meta = APP_STATUS_META[a.status] || APP_STATUS_META.pending;
              return (
                <Card key={a.id} style={{ marginBottom: 8 }} testID={`applicant-${a.id}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Pressable style={{ flex: 1 }} onPress={() => viewWorker(a.worker_id)}>
                      <Body style={{ fontWeight: "700" }}>{a.worker_name}</Body>
                      <Muted>{(a.worker_skills || []).join(", ") || "—"}</Muted>
                    </Pressable>
                    <View style={{ alignItems: "flex-end", marginLeft: 8 }}>
                      <Body style={{ fontWeight: "700", color: colors.brand }}>₹{a.worker_wage}/day</Body>
                      <View style={[styles.appBadge, { backgroundColor: meta.bg, marginTop: 4 }]}>
                        <Body style={{ color: meta.color, fontSize: 10, fontWeight: "800" }}>{meta.label}</Body>
                      </View>
                    </View>
                  </View>
                  {a.status === "pending" && status !== "completed" && status !== "cancelled" && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <Pressable
                        testID={`hire-${a.id}`}
                        onPress={() => handleApplication(a.id, "accepted")}
                        style={[styles.hireBtn, { backgroundColor: colors.success }]}
                        disabled={busyAppId === a.id}
                      >
                        <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                        <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>
                          {busyAppId === a.id ? "..." : "Hire"}
                        </Body>
                      </Pressable>
                      <Pressable
                        testID={`reject-${a.id}`}
                        onPress={() => handleApplication(a.id, "rejected")}
                        style={[styles.hireBtn, { backgroundColor: colors.surfaceSecondary }]}
                        disabled={busyAppId === a.id}
                      >
                        <Ionicons name="close-circle" size={16} color={colors.error} />
                        <Body style={{ color: colors.error, fontWeight: "800", marginLeft: 4 }}>Reject</Body>
                      </Pressable>
                    </View>
                  )}
                  {a.status === "accepted" && (status === "completed" || status === "in_progress") && (
                    <Pressable
                      testID={`rate-${a.id}`}
                      onPress={() => setRateFor({ id: a.worker_id, name: a.worker_name })}
                      style={[styles.hireBtn, { backgroundColor: colors.warning, marginTop: 8 }]}
                    >
                      <Ionicons name="star" size={16} color="#FFF" />
                      <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Rate {a.worker_name}</Body>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {isOwner && (
          <Pressable testID="site-photos-link" onPress={() => router.push({ pathname: "/site-photos" as any, params: { jobId: id } })} style={styles.payrollLink}>
            <Ionicons name="camera" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Site Progress Photos</Body>
              <Muted style={{ fontSize: 11 }}>Upload daily photos of this site</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}
        {isWorker && applied && (
          <Pressable testID="site-photos-link-w" onPress={() => router.push({ pathname: "/site-photos" as any, params: { jobId: id } })} style={styles.payrollLink}>
            <Ionicons name="camera" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Site Photos</Body>
              <Muted style={{ fontSize: 11 }}>View or upload progress</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}

        {isOwner && (
          <Card>
            <Body style={{ fontWeight: "700", marginBottom: 10 }}>Manage Job</Body>
            {status === "open" && (
              <PrimaryButton
                testID="start-job"
                label="Start Job (In Progress)"
                icon="play-circle"
                loading={busyStatus}
                onPress={() => changeJobStatus("in_progress")}
              />
            )}
            {status === "in_progress" && (
              <PrimaryButton
                testID="complete-job"
                label="Mark as Completed"
                icon="checkmark-done"
                loading={busyStatus}
                onPress={() => changeJobStatus("completed")}
              />
            )}
            {(status === "open" || status === "in_progress") && (
              <SecondaryButton
                testID="cancel-job"
                label="Cancel Job"
                onPress={() => changeJobStatus("cancelled")}
              />
            )}
            {status === "completed" && (
              <Body style={{ color: colors.success, fontWeight: "700", textAlign: "center" }}>✓ Job completed</Body>
            )}
            {status === "cancelled" && (
              <Body style={{ color: colors.error, fontWeight: "700", textAlign: "center" }}>✗ Job cancelled</Body>
            )}
          </Card>
        )}

        {msg ? <Body style={{ color: msg.includes("✓") ? colors.success : colors.error }}>{msg}</Body> : null}
      </ScrollView>

      {isWorker && status === "open" && (
        <View style={styles.stickyCTA}>
          <PrimaryButton
            testID="apply-button"
            label={applied ? "Already Applied" : "Apply for Job"}
            icon={applied ? "checkmark-done" : "send"}
            loading={applying}
            disabled={applied}
            onPress={apply}
          />
        </View>
      )}

      <RatingSheet
        visible={!!rateFor}
        target_user_id={rateFor?.id || ""}
        target_name={rateFor?.name}
        job_id={id}
        onClose={() => setRateFor(null)}
        onSubmit={() => setMsg("Rating saved ✓")}
      />
    </View>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && { backgroundColor: colors.brand }]}>
      <Body style={{ fontWeight: "800", fontSize: t.xl, color: highlight ? colors.onBrandPrimary : colors.onSurface }}>{value}</Body>
      <Muted style={{ color: highlight ? colors.onBrandPrimary : colors.onSurfaceSecondary, fontWeight: "700" }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { height: 260, backgroundColor: colors.surfaceInverse },
  backBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center", justifyContent: "center",
  },
  statusPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  urgentBadge: {
    alignSelf: "flex-start", backgroundColor: colors.brand,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  stat: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, alignItems: "center",
  },
  posterAvatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  appBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  hireBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: radius.md,
  },
  stickyCTA: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: spacing.md, paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  payrollLink: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: 8 },
});

