import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

export default function Payroll() {
  const router = useRouter();
  const [data, setData] = useState<any>({ month: "", rows: [], grand_total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setData(await api.payroll()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="payroll-back" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="payroll-title">Payroll · {data.month}</H2>
        <View style={{ width: 40 }} />
      </View>

      <Card style={styles.totalCard}>
        <Muted style={{ color: "#FFF", fontWeight: "700" }}>GRAND TOTAL</Muted>
        <Body style={{ fontSize: 36, fontWeight: "800", color: "#FFF" }} testID="grand-total">
          ₹{(data.grand_total || 0).toLocaleString("en-IN")}
        </Body>
        <Muted style={{ color: "#FFF", opacity: 0.85 }}>
          {data.rows.length} worker{data.rows.length !== 1 ? "s" : ""} this month
        </Muted>
      </Card>

      <FlatList
        data={data.rows}
        keyExtractor={(r) => r.worker_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="cash-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No payroll data yet</Body>
            <Muted style={{ marginTop: 4, textAlign: "center" }}>Verified attendance records (within geofence) feed into payroll automatically.</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Card testID={`pay-${item.worker_id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.worker_name}</Body>
                <Muted style={{ marginTop: 2 }}>{item.mobile} · {item.jobs_count} job(s)</Muted>
                <Muted>{item.days_present} days × ₹{item.daily_wage}/day</Muted>
              </View>
              <Body style={{ fontWeight: "800", fontSize: t.xl, color: colors.brand }}>
                ₹{item.total_wage.toLocaleString("en-IN")}
              </Body>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  totalCard: { margin: spacing.md, backgroundColor: colors.brand, borderColor: colors.brand },
});
