import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, SKILLS, type as t } from "@/src/theme";
import { H2, Body, Muted, Chip, Card, PrimaryButton } from "@/src/ui";
import { formatIsoDate } from "@/src/utils/date";

/**
 * v34 Worker Home — Vacancy System
 * - Workers see one card per available vacancy (a 7-worker job → 7 cards).
 * - The underlying Job is not duplicated; slots are computed server-side.
 * - Applying to a vacancy blocks the worker from other slots of the same job.
 */

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const { t: tr } = useT();
  const [items, setItems] = useState<any[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [applyingKey, setApplyingKey] = useState<string | null>(null);
  const [aiMatch, setAiMatch] = useState<{ summary: string; top_job_ids: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const [, setLocStatus] = useState<"idle" | "requesting" | "granted" | "denied">("idle");

  const isWorker = user?.role === "worker";

  // Ask (silently) for the worker's location once — used to render an
  // approximate "X km away" line on each vacancy card. If denied we
  // simply hide the distance row instead of showing bogus data.
  useEffect(() => {
    if (!isWorker) return;
    let cancelled = false;
    (async () => {
      setLocStatus("requesting");
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        let granted = perm.status === "granted";
        if (!granted && perm.canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === "granted";
        }
        if (!granted) {
          if (!cancelled) setLocStatus("denied");
          return;
        }
        const pos = await Location.getLastKnownPositionAsync({});
        const p = pos || (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && p) {
          setMyPos({ lat: p.coords.latitude, lng: p.coords.longitude });
          setLocStatus("granted");
        }
      } catch {
        if (!cancelled) setLocStatus("denied");
      }
    })();
    return () => { cancelled = true; };
  }, [isWorker]);

  const load = useCallback(async () => {
    try {
      const data = isWorker
        ? await api.workerVacancies(skill || undefined)
        : await api.myJobs();
      setItems(Array.isArray(data) ? data : []);
    } catch {
      setItems([]);
    }
    setLoading(false);
  }, [skill, isWorker]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const runAiMatch = async () => {
    setAiLoading(true);
    try {
      const r = await api.aiMatch();
      setAiMatch(r);
    } catch {
      setAiMatch({ summary: "AI match unavailable right now.", top_job_ids: [] });
    } finally {
      setAiLoading(false);
    }
  };

  const applyNow = async (job: any) => {
    const key = job.vacancy_key || job.id;
    setApplyingKey(key);
    try {
      await api.apply({ job_id: job.id, message: "" });
      // Remove all remaining slots of this job for this worker from the list
      setItems((prev) => prev.filter((it) => it.id !== job.id));
    } catch {
      // Silent fail — user can retry; a proper toast could be added later.
    } finally {
      setApplyingKey(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Muted>{tr("home.welcomeBack")}</Muted>
          <H2 testID="home-greeting">{tr("home.hi")}, {user?.name?.split(" ")[0]}</H2>
        </View>
        <View style={styles.badge}>
          <Ionicons name="location" size={14} color={colors.brand} />
          <Body style={{ fontWeight: "700", fontSize: t.sm }}>{user?.city || "India"}</Body>
        </View>
      </View>

      {isWorker && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip testID="skill-all" label={tr("common.all")} selected={!skill} onPress={() => setSkill(null)} />
          {SKILLS.filter((s) => s !== "Other").map((s) => (
            <Chip key={s} testID={`skill-${s}`} label={s} selected={skill === s} onPress={() => setSkill(s)} />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={items}
        keyExtractor={(it) => it.vacancy_key || it.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          isWorker ? (
            <Pressable testID="ai-match-card" onPress={runAiMatch} style={{ marginBottom: spacing.sm }}>
              <LinearGradient colors={[colors.brand, "#D97706"]} style={styles.aiCard}>
                <Ionicons name="sparkles" size={24} color={colors.onBrandPrimary} />
                <View style={{ flex: 1 }}>
                  <Body style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>{tr("home.ai.title")}</Body>
                  <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85 }}>
                    {aiLoading ? tr("home.ai.loading") : aiMatch ? aiMatch.summary : tr("home.ai.cta")}
                  </Muted>
                </View>
                {aiLoading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="arrow-forward-circle" size={28} color={colors.onBrandPrimary} />}
              </LinearGradient>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
          ) : (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="briefcase-outline" size={56} color={colors.borderStrong} />
              <Body style={{ marginTop: 12 }}>{isWorker ? tr("home.empty.worker") : tr("home.empty.client")}</Body>
              <Muted style={{ marginTop: 4 }}>{isWorker ? tr("home.empty.worker.sub") : tr("home.empty.client.sub")}</Muted>
            </View>
          )
        }
        renderItem={({ item }) => (
          isWorker ? (
            <WorkerVacancyCard
              item={item}
              highlight={aiMatch?.top_job_ids?.includes(item.id)}
              onOpen={() => router.push(`/job/${item.id}` as any)}
              onApply={() => applyNow(item)}
              applying={applyingKey === (item.vacancy_key || item.id)}
              myPos={myPos}
            />
          ) : (
            <ClientJobCard item={item} onOpen={() => router.push(`/job/${item.id}` as any)} />
          )
        )}
      />
    </SafeAreaView>
  );
}

/* ---------------- Worker Vacancy Card ---------------- */
function WorkerVacancyCard({
  item,
  highlight,
  onOpen,
  onApply,
  applying,
  myPos,
}: {
  item: any;
  highlight?: boolean;
  onOpen: () => void;
  onApply: () => void;
  applying: boolean;
  myPos: { lat: number; lng: number } | null;
}) {
  const { t: tr } = useT();
  // Resolve wage — prefer per-skill wage from skills_required if present.
  const wageInfo = resolveWage(item);
  const distanceKm =
    myPos && typeof item.lat === "number" && typeof item.lng === "number"
      ? haversineKm(myPos.lat, myPos.lng, item.lat, item.lng)
      : null;

  return (
    <Pressable testID={`vacancy-${item.vacancy_key || item.id}`} onPress={onOpen}>
      <Card style={highlight ? { borderColor: colors.brand, borderWidth: 2 } : undefined}>
        {highlight && (
          <View style={styles.aiTag}>
            <Ionicons name="sparkles" size={12} color={colors.onBrandPrimary} />
            <Body style={{ fontSize: 11, color: colors.onBrandPrimary, fontWeight: "800" }}>{tr("home.ai.tag")}</Body>
          </View>
        )}

        {/* Title + urgency */}
        <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
          <Body style={{ fontWeight: "800", fontSize: t.lg, flex: 1, paddingRight: 8 }}>
            {item.title}
          </Body>
          {item.urgency === "Urgent" ? (
            <View style={styles.tagUrgent}>
              <Body style={{ fontSize: 10, fontWeight: "800", color: colors.onError }}>URGENT</Body>
            </View>
          ) : null}
        </View>

        {/* Info rows */}
        <View style={{ marginTop: 10, gap: 6 }}>
          <InfoRow icon="location" label="Location" value={item.location || "-"} />
          {distanceKm != null ? (
            <InfoRow
              icon="navigate"
              label="Distance"
              value={`${distanceKm.toFixed(1)} km away`}
            />
          ) : null}
          <InfoRow icon="build" label="Skill Required" value={item.skill || "-"} />
          {item.slot_skill ? (
            <InfoRow icon="ribbon" label="Skill Level" value={item.slot_skill} />
          ) : null}
          {item.working_start_date ? (
            <InfoRow icon="calendar" label="Work Starting" value={formatIsoDate(item.working_start_date)} />
          ) : null}
          <InfoRow
            icon="time"
            label="Work Duration"
            value={
              item.working_duration
                ? String(item.working_duration).replace(/^Custom:\s*/, "")
                : (item.duration_days ? `${item.duration_days} Days` : "-")
            }
          />
          <InfoRow
            icon="cash"
            label="Wage"
            value={wageInfo.display}
            highlight
          />
        </View>

        {/* Apply CTA */}
        <View style={{ marginTop: 12 }}>
          <PrimaryButton
            testID={`vacancy-apply-${item.vacancy_key || item.id}`}
            label={applying ? "Applying..." : "Apply Now"}
            icon="paper-plane-outline"
            loading={applying}
            onPress={onApply}
          />
        </View>
      </Card>
    </Pressable>
  );
}

function InfoRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: any;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={14} color={colors.brand} />
      <Body style={{ flex: 1, fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" }}>
        {label}
      </Body>
      <Body
        style={{
          fontSize: 13,
          fontWeight: highlight ? "800" : "700",
          color: highlight ? colors.brand : colors.onSurface,
          maxWidth: 210,
          textAlign: "right",
        }}
        numberOfLines={2}
      >
        {value}
      </Body>
    </View>
  );
}

/* ---------------- Client / Contractor Job Card ---------------- */
function ClientJobCard({ item, onOpen }: { item: any; onOpen: () => void }) {
  const { t: tr } = useT();
  const needed = Number(item.workers_needed || 0);
  const filled = Number(item.accepted_count || 0);
  const remaining = Math.max(0, needed - filled);
  return (
    <Pressable testID={`job-${item.id}`} onPress={onOpen}>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Body style={{ fontWeight: "800", fontSize: t.lg }}>{item.title}</Body>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 }}>
              <Ionicons name="location-outline" size={14} color={colors.onSurfaceSecondary} />
              <Muted>{item.location}</Muted>
            </View>
          </View>
          {item.daily_wage ? (
            <View style={styles.wage}>
              <Body style={{ fontWeight: "800", color: colors.onBrandPrimary }}>₹{item.daily_wage}</Body>
              <Body style={{ fontSize: 10, color: colors.onBrandPrimary }}>{tr("common.perDay")}</Body>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <View style={styles.tagSkill}>
            <Body style={{ fontSize: t.sm, fontWeight: "700" }}>{item.skill}</Body>
          </View>
          <View style={styles.tagInfo}>
            <Body style={{ fontSize: t.sm }}>{needed} Workers Required</Body>
          </View>
          <View style={styles.tagInfo}>
            <Body style={{ fontSize: t.sm }}>{remaining} Remaining</Body>
          </View>
          <View style={styles.tagInfo}>
            <Body style={{ fontSize: t.sm }}>{filled} Selected</Body>
          </View>
          {item.urgency === "Urgent" && (
            <View style={styles.tagUrgent}>
              <Body style={{ fontSize: t.sm, fontWeight: "700", color: colors.onError }}>{tr("common.urgent")}</Body>
            </View>
          )}
        </View>
      </Card>
    </Pressable>
  );
}

/* ---------------- Wage helper ---------------- */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // km
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function resolveWage(job: any): { display: string; type: "day" | "hour" | "unknown" } {
  // Prefer per-slot wage attached by the backend vacancies expander.
  if (job.slot_wage_type === "day" && job.slot_daily_wage) {
    return {
      display: `₹${Number(job.slot_daily_wage).toLocaleString("en-IN")} / day`,
      type: "day",
    };
  }
  if (job.slot_wage_type === "hour" && job.slot_total_wage) {
    return {
      display: `₹${Number(job.slot_total_wage).toLocaleString("en-IN")} (${job.slot_hours}h supervision)`,
      type: "hour",
    };
  }
  const sr = job.skills_required as any[] | undefined;
  if (Array.isArray(sr) && sr.length > 0) {
    const nonSup = sr.find(
      (r) => r?.skill !== "Site Supervisor" && (r?.daily_wage || 0) > 0
    );
    if (nonSup) return { display: `₹${Number(nonSup.daily_wage).toLocaleString("en-IN")} / day`, type: "day" };
    const sup = sr.find((r) => r?.skill === "Site Supervisor" && r?.hours);
    if (sup) return { display: `₹${(sup.total_wage || 500).toLocaleString("en-IN")} (${sup.hours}h supervision)`, type: "hour" };
  }
  if (job.daily_wage && job.daily_wage > 0) {
    return { display: `₹${Number(job.daily_wage).toLocaleString("en-IN")} / day`, type: "day" };
  }
  return { display: "Wage not specified", type: "unknown" };
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  chipRow: { paddingHorizontal: spacing.md, gap: 8, height: 56, alignItems: "center" },
  aiCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  aiTag: {
    position: "absolute",
    top: -10,
    right: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  wage: {
    backgroundColor: colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    alignItems: "center",
  },
  tagSkill: {
    backgroundColor: colors.brandTertiary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tagInfo: {
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  tagUrgent: {
    backgroundColor: colors.error,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
});
