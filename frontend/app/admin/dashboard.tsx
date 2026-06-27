import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card } from "@/src/ui";

type Stats = {
  total_workers: number; total_contractors: number; total_clients: number;
  total_jobs: number; active_jobs: number; completed_jobs: number;
  total_applications: number; daily_attendance: number;
  open_complaints: number; pending_verifications: number; wallet_payouts: number;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { t: tr } = useT();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await api.adminStats()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <LinearGradient colors={[colors.surfaceInverse, "#27272A"]} style={styles.hero}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="shield-checkmark" size={18} color={colors.brand} />
            <Muted style={{ color: colors.surfaceTertiary, fontWeight: "700" }}>{tr("admin.console")}</Muted>
          </View>
          <H1 style={{ color: colors.onSurfaceInverse, marginTop: 6 }} testID="admin-greeting">
            {tr("home.hi")} {user?.name?.split(" ")[0]}
          </H1>
          <Muted style={{ color: colors.surfaceTertiary, marginTop: 4 }}>
            {tr("admin.healthSub")}
          </Muted>
        </LinearGradient>

        {loading || !stats ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
        ) : (
          <>
            <H2>{tr("admin.section.people")}</H2>
            <View style={styles.grid}>
              <KPI testID="kpi-workers" label={tr("admin.kpi.workers")} value={stats.total_workers} icon="hammer" color="#F59E0B" />
              <KPI testID="kpi-contractors" label={tr("admin.kpi.contractors")} value={stats.total_contractors} icon="people" color="#3B82F6" />
              <KPI testID="kpi-clients" label={tr("admin.kpi.clients")} value={stats.total_clients} icon="business" color="#10B981" />
              <KPI testID="kpi-pending" label={tr("admin.kpi.pending")} value={stats.pending_verifications} icon="time" color="#EF4444" />
            </View>

            <H2>{tr("admin.section.jobs")}</H2>
            <View style={styles.grid}>
              <KPI testID="kpi-active-jobs" label={tr("admin.kpi.activeJobs")} value={stats.active_jobs} icon="briefcase" color="#F59E0B" />
              <KPI testID="kpi-completed-jobs" label={tr("admin.kpi.completed")} value={stats.completed_jobs} icon="checkmark-done" color="#10B981" />
              <KPI testID="kpi-applications" label={tr("admin.kpi.applications")} value={stats.total_applications} icon="document-text" color="#8B5CF6" />
              <KPI testID="kpi-attendance" label={tr("admin.kpi.todayAtt")} value={stats.daily_attendance} icon="finger-print" color="#0EA5E9" />
            </View>

            <H2>{tr("admin.section.ops")}</H2>
            <Card>
              <View style={styles.row}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: "#FEE2E2" }]}>
                    <Ionicons name="alert-circle" size={20} color="#DC2626" />
                  </View>
                  <View>
                    <Body style={{ fontWeight: "700" }}>{tr("admin.kpi.complaints")}</Body>
                    <Muted>{tr("admin.kpi.complaintsSub")}</Muted>
                  </View>
                </View>
                <Body style={{ fontSize: t.xxl, fontWeight: "800", color: colors.error }} testID="kpi-complaints">
                  {stats.open_complaints}
                </Body>
              </View>
            </Card>
            <Card>
              <View style={styles.row}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.iconCircle, { backgroundColor: colors.brandTertiary }]}>
                    <Ionicons name="wallet" size={20} color={colors.brand} />
                  </View>
                  <View>
                    <Body style={{ fontWeight: "700" }}>{tr("admin.kpi.payouts")}</Body>
                    <Muted>{tr("admin.kpi.payoutsSub")}</Muted>
                  </View>
                </View>
                <Body style={{ fontSize: t.xl, fontWeight: "800", color: colors.brand }} testID="kpi-payouts">
                  ₹{stats.wallet_payouts}
                </Body>
              </View>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ label, value, icon, color, testID }: { label: string; value: number; icon: any; color: string; testID?: string }) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={[styles.iconCircle, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Body style={{ fontSize: t.xxl, fontWeight: "800", marginTop: 8 }}>{value}</Body>
      <Muted style={{ fontWeight: "700", marginTop: 2 }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.lg },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  kpi: {
    width: "47.5%", padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
