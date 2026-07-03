import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

export default function AdminMonitor() {
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setStats(await api.adminMonitor()); } catch {}
    try { setActivity(await api.adminActivity(50)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="am-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Admin Monitor</H2>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.row}>
            <StatCard label="Total Users" value={stats?.users?.total ?? 0} icon="people" />
            <StatCard label="Aadhaar Verified" value={stats?.users?.aadhaar_verified ?? 0} icon="shield-checkmark" color={colors.success} />
          </View>
          <View style={styles.row}>
            <StatCard label="Workers" value={stats?.users?.workers ?? 0} icon="construct" />
            <StatCard label="Contractors" value={stats?.users?.contractors ?? 0} icon="business" />
            <StatCard label="Clients" value={stats?.users?.clients ?? 0} icon="person" />
          </View>
          <Card>
            <Body style={{ fontWeight: "800", marginBottom: 8 }}>Jobs breakdown</Body>
            <BarRow label="Open" value={stats?.jobs?.open ?? 0} total={stats?.jobs?.total ?? 1} color={colors.success} />
            <BarRow label="In Progress" value={stats?.jobs?.in_progress ?? 0} total={stats?.jobs?.total ?? 1} color={colors.warning} />
            <BarRow label="Completed" value={stats?.jobs?.completed ?? 0} total={stats?.jobs?.total ?? 1} color="#2563EB" />
          </Card>
          <View style={styles.row}>
            <StatCard label="Complaints Open" value={stats?.complaints_open ?? 0} icon="flag" color={colors.error} />
            <StatCard label="Escrow Held" value={stats?.escrow_held ?? 0} icon="lock-closed" />
            <StatCard label="Leaves Pending" value={stats?.leaves_pending ?? 0} icon="calendar" />
          </View>
          <Card>
            <Body style={{ fontWeight: "800" }}>Total wallet balance in system</Body>
            <H2 style={{ color: colors.brand, marginTop: 6 }} testID="total-wallet">₹{Number(stats?.total_wallet_balance || 0).toLocaleString()}</H2>
            <Muted style={{ fontSize: 12, marginTop: 4 }}>Sum of all user wallet balances</Muted>
          </Card>

          <Body style={{ fontWeight: "800", marginTop: spacing.sm }}>Recent Activity</Body>
          {activity.length === 0 ? (
            <Card><Muted style={{ textAlign: "center" }}>No activity yet</Muted></Card>
          ) : activity.slice(0, 30).map((a) => (
            <Card key={a.id} style={{ marginBottom: 4, padding: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={styles.dot} />
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700", fontSize: 13 }}>{a.action}</Body>
                  <Muted style={{ fontSize: 11 }}>{a.actor_role} · {new Date(a.created_at).toLocaleString()}</Muted>
                </View>
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon, color }: any) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={20} color={color || colors.brand} />
      <Body style={{ fontWeight: "800", fontSize: 22, marginTop: 4 }}>{value}</Body>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}

function BarRow({ label, value, total, color }: any) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Muted>{label}</Muted>
        <Muted style={{ fontWeight: "800" }}>{value} ({pct}%)</Muted>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  row: { flexDirection: "row", gap: 8 },
  stat: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  track: { height: 6, backgroundColor: colors.surfaceSecondary, borderRadius: 3, overflow: "hidden", marginTop: 3 },
  fill: { height: 6, borderRadius: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
