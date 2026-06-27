import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card } from "@/src/ui";

const MODULES = [
  { id: "materials", title: "Materials", icon: "cube", color: "#F59E0B", path: "/erp/materials" },
  { id: "tools", title: "Tools & Equipment", icon: "construct", color: "#3B82F6", path: "/erp/tools" },
  { id: "estimates", title: "Cost Estimates", icon: "calculator", color: "#10B981", path: "/erp/estimates" },
  { id: "bills", title: "Bills & Invoices", icon: "receipt", color: "#8B5CF6", path: "/erp/bills" },
] as const;

export default function ErpHub() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setStats(await api.erpDashboard()); } catch {}
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
            <Ionicons name="business" size={18} color={colors.brand} />
            <Muted style={{ color: colors.surfaceTertiary, fontWeight: "700" }}>CONTRACTOR ERP</Muted>
          </View>
          <H1 style={{ color: colors.onSurfaceInverse, marginTop: 6 }} testID="erp-hero">
            {user?.company_name || user?.name}
          </H1>
          <Muted style={{ color: colors.surfaceTertiary, marginTop: 4 }}>
            Manage materials, tools, estimates & bills from one place
          </Muted>
        </LinearGradient>

        {loading || !stats ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : (
          <>
            <View style={styles.grid}>
              <KPI testID="kpi-materials" label="Materials" value={stats.materials_total} sub={`${stats.materials_low_stock} low stock`} icon="cube" color="#F59E0B" />
              <KPI testID="kpi-tools" label="Tools" value={stats.tools_total} sub={`${stats.tools_in_use} in use`} icon="construct" color="#3B82F6" />
              <KPI testID="kpi-estimates" label="Estimates" value={stats.estimates_total} sub="projects" icon="calculator" color="#10B981" />
              <KPI testID="kpi-bills" label="Bills" value={stats.bills_total} sub={`${stats.bills_paid} paid`} icon="receipt" color="#8B5CF6" />
            </View>

            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View>
                  <Muted style={{ fontWeight: "700" }}>Revenue Pending</Muted>
                  <Body style={{ fontSize: t.xxl, fontWeight: "800", color: colors.brand, marginTop: 4 }} testID="rev-pending">
                    ₹{(stats.revenue_pending || 0).toLocaleString("en-IN")}
                  </Body>
                </View>
                <View>
                  <Muted style={{ fontWeight: "700" }}>Revenue Paid</Muted>
                  <Body style={{ fontSize: t.xxl, fontWeight: "800", color: colors.success, marginTop: 4 }} testID="rev-paid">
                    ₹{(stats.revenue_paid || 0).toLocaleString("en-IN")}
                  </Body>
                </View>
              </View>
            </Card>
          </>
        )}

        <H2 style={{ marginTop: spacing.md }}>Modules</H2>
        {MODULES.map((m) => (
          <Pressable
            key={m.id}
            testID={`module-${m.id}`}
            onPress={() => router.push(m.path as any)}
            style={({ pressed }) => [styles.modCard, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.modIcon, { backgroundColor: m.color + "22" }]}>
              <Ionicons name={m.icon as any} size={26} color={m.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "700", fontSize: t.lg }}>{m.title}</Body>
              <Muted style={{ marginTop: 2 }}>Tap to manage</Muted>
            </View>
            <Ionicons name="chevron-forward" size={22} color={colors.borderStrong} />
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ label, value, sub, icon, color, testID }: any) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "22" }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Body style={{ fontSize: t.xxl, fontWeight: "800", marginTop: 8 }}>{value}</Body>
      <Muted style={{ fontWeight: "700" }}>{label}</Muted>
      <Muted style={{ fontSize: 11, marginTop: 2 }}>{sub}</Muted>
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
  kpiIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  modIcon: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
