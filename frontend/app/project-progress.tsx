import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

const STATUS_META: any = {
  open: { color: colors.success, bg: "#DCFCE7", label: "OPEN" },
  in_progress: { color: colors.warning, bg: "#FEF3C7", label: "IN PROGRESS" },
  completed: { color: "#2563EB", bg: "#DBEAFE", label: "COMPLETED" },
  cancelled: { color: colors.error, bg: "#FEE2E2", label: "CANCELLED" },
};

export default function ProjectProgress() {
  const router = useRouter();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setRows(await api.projectProgress()); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="pp-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Project Progress</H2>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {rows.length === 0 ? (
            <Card>
              <View style={{ alignItems: "center", padding: spacing.md }}>
                <Ionicons name="clipboard-outline" size={48} color={colors.borderStrong} />
                <Muted style={{ marginTop: 8, textAlign: "center" }}>No jobs posted yet.\nPost your first job from the Post tab.</Muted>
              </View>
            </Card>
          ) : (
            rows.map((r) => {
              const meta = STATUS_META[r.status] || STATUS_META.open;
              const hiredPct = r.workers_needed ? Math.round((r.workers_hired / r.workers_needed) * 100) : 0;
              const durationPct = r.duration_days ? Math.round((r.days_worked / r.duration_days) * 100) : 0;
              return (
                <Pressable key={r.job_id} testID={`pp-${r.job_id}`} onPress={() => router.push(`/job/${r.job_id}` as any)}>
                  <Card style={{ marginBottom: 6 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <Body style={{ fontWeight: "800", flex: 1, marginRight: 8 }} numberOfLines={1}>{r.title}</Body>
                      <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                        <Body style={{ color: meta.color, fontSize: 10, fontWeight: "800" }}>{meta.label}</Body>
                      </View>
                    </View>
                    <View style={{ marginTop: 8, gap: 6 }}>
                      <ProgressRow label="Workers hired" now={r.workers_hired} total={r.workers_needed} pct={hiredPct} />
                      <ProgressRow label="Days worked" now={r.days_worked} total={r.duration_days} pct={durationPct} />
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                      <StatChip icon="camera" label={`${r.photos_count} photos`} />
                      <StatChip icon="cash" label={`₹${r.escrow_amount} escrow`} />
                      {r.escrow_released > 0 && <StatChip icon="checkmark-circle" label={`₹${r.escrow_released} paid`} color={colors.success} />}
                    </View>
                  </Card>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function ProgressRow({ label, now, total, pct }: any) {
  return (
    <View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Muted style={{ fontSize: 11 }}>{label}</Muted>
        <Muted style={{ fontSize: 11, fontWeight: "700" }}>{now}/{total || "?"} · {pct}%</Muted>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.min(100, pct)}%` }]} />
      </View>
    </View>
  );
}

function StatChip({ icon, label, color }: any) {
  return (
    <View style={styles.chip}>
      <Ionicons name={icon} size={12} color={color || colors.brand} />
      <Body style={{ fontSize: 11, marginLeft: 4, fontWeight: "700", color: color || colors.onSurface }}>{label}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  barTrack: { height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, overflow: "hidden", marginTop: 3 },
  barFill: { height: 6, backgroundColor: colors.brand, borderRadius: 3 },
  chip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill },
});
