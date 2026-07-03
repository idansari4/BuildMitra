import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, radius, type as tt } from "@/src/theme";
import { H1, H2, Body, Muted, Card } from "@/src/ui";

export default function SalarySummary() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setData(await api.salarySummary(6)); } catch {}
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="sal-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Salary Summary</H2>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.heroGrid}>
            <View style={[styles.heroCard, { backgroundColor: colors.brand }]}>
              <Muted style={{ color: colors.onBrandPrimary, fontSize: 12 }}>Total Earned</Muted>
              <H1 style={{ color: colors.onBrandPrimary, fontSize: 24 }} testID="total-earned">₹{(data?.total_earned || 0).toLocaleString()}</H1>
            </View>
            <View style={[styles.heroCard, { backgroundColor: colors.success }]}>
              <Muted style={{ color: colors.onBrandPrimary, fontSize: 12 }}>Wallet Balance</Muted>
              <H1 style={{ color: colors.onBrandPrimary, fontSize: 24 }}>₹{(data?.wallet_balance || 0).toLocaleString()}</H1>
            </View>
          </View>

          <Card>
            <Body style={{ fontWeight: "700", marginBottom: 6 }}>Current daily wage</Body>
            <H2 style={{ color: colors.brand }}>₹{data?.current_wage || 0}/day</H2>
            <Muted style={{ fontSize: 12, marginTop: 4 }}>Update in Profile → Expected Wage</Muted>
          </Card>

          <Body style={{ fontWeight: "700", marginTop: spacing.sm }}>Last 6 months</Body>
          {(data?.rows || []).length === 0 ? (
            <Card>
              <View style={{ alignItems: "center", padding: spacing.md }}>
                <Ionicons name="cash-outline" size={48} color={colors.borderStrong} />
                <Muted style={{ marginTop: 8, textAlign: "center" }}>No attendance recorded yet.\nStart marking attendance to see earnings here.</Muted>
              </View>
            </Card>
          ) : (
            (data.rows || []).map((r: any) => (
              <Card key={r.month} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <View>
                    <Body style={{ fontWeight: "800" }}>{r.month}</Body>
                    <Muted style={{ fontSize: 12 }}>{r.days_present} days · {r.jobs_count} jobs</Muted>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Body style={{ fontWeight: "800", fontSize: tt.lg, color: colors.brand }}>₹{r.earned.toLocaleString()}</Body>
                    <Muted style={{ fontSize: 11 }}>@₹{r.daily_wage}/day</Muted>
                  </View>
                </View>
              </Card>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  heroGrid: { flexDirection: "row", gap: 10 },
  heroCard: { flex: 1, padding: spacing.md, borderRadius: radius.md, alignItems: "flex-start" },
});
