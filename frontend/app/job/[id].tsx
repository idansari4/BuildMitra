import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, SKILL_IMAGES, type as t } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton, Card, SecondaryButton } from "@/src/ui";

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

  useEffect(() => {
    (async () => {
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
    })();
  }, [id, user]);

  const apply = async () => {
    setApplying(true); setMsg("");
    try { await api.apply({ job_id: id, message: "" }); setApplied(true); setMsg("Applied ✓"); }
    catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setApplying(false); }
  };

  const callPoster = () => job?.posted_by_name && Linking.openURL("tel:+919000000000").catch(() => {});
  const whatsapp = () => Linking.openURL(`https://wa.me/919000000000?text=${encodeURIComponent("Hi, regarding " + (job?.title || "your job posting"))}`).catch(() => {});
  const openChat = () => {
    if (!job || !user || user.id === job.posted_by) return;
    router.push({ pathname: "/chat/[peerId]", params: { peerId: job.posted_by, peerName: job.posted_by_name } } as any);
  };

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

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={styles.hero}>
        <Image source={heroImg} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.7)"]} style={StyleSheet.absoluteFill} />
        <SafeAreaView edges={["top"]} style={{ flex: 1, padding: spacing.md, justifyContent: "space-between" }}>
          <Pressable testID="job-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.surface} />
          </Pressable>
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

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140, gap: spacing.md }}>
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
            {applicants.map((a) => (
              <Card key={a.id} style={{ marginBottom: 8 }} testID={`applicant-${a.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Body style={{ fontWeight: "700" }}>{a.worker_name}</Body>
                    <Muted>{(a.worker_skills || []).join(", ") || "—"}</Muted>
                  </View>
                  <Body style={{ fontWeight: "700", color: colors.brand }}>₹{a.worker_wage}/day</Body>
                </View>
              </Card>
            ))}
          </View>
        )}

        {msg ? <Body style={{ color: msg.includes("✓") ? colors.success : colors.error }}>{msg}</Body> : null}
      </ScrollView>

      {isWorker && (
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
  stickyCTA: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: spacing.md, paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
