import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

export default function Activity() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isWorker = user?.role === "worker";

  const load = useCallback(async () => {
    try {
      const data = isWorker ? await api.myApplications() : await api.myJobs();
      setItems(data);
    } catch {}
    setLoading(false);
  }, [isWorker]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <H2 testID="activity-title">{isWorker ? "My Applications" : "My Posted Jobs"}</H2>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 80 }} /> : (
            <View style={{ alignItems: "center", marginTop: 80 }}>
              <Ionicons name="document-text-outline" size={56} color={colors.borderStrong} />
              <Body style={{ marginTop: 12 }}>Nothing yet</Body>
              <Muted style={{ marginTop: 4 }}>{isWorker ? "Apply to jobs to see them here" : "Post a job to get started"}</Muted>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`activity-item-${item.id}`}
            onPress={() => router.push(`/job/${isWorker ? item.job_id : item.id}` as any)}
          >
            <Card>
              <Body style={{ fontWeight: "700", fontSize: t.lg }}>{isWorker ? item.job_title : item.title}</Body>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {isWorker ? (
                  <View style={[
                    styles.statusTag,
                    item.status === "accepted" && { backgroundColor: "#DCFCE7" },
                    item.status === "rejected" && { backgroundColor: "#FEE2E2" },
                    item.status === "pending" && { backgroundColor: "#FEF3C7" },
                  ]}>
                    <Body style={{
                      fontSize: t.sm, fontWeight: "700",
                      color: item.status === "accepted" ? "#16A34A"
                           : item.status === "rejected" ? "#DC2626"
                           : item.status === "pending" ? "#D97706"
                           : colors.onBrandSecondary,
                    }}>
                      {item.status === "accepted" ? "HIRED ✓" :
                       item.status === "rejected" ? "REJECTED" :
                       String(item.status).toUpperCase()}
                    </Body>
                  </View>
                ) : (
                  <>
                    <View style={styles.tagInfo}><Body style={{ fontSize: t.sm }}>{item.skill}</Body></View>
                    <View style={styles.tagInfo}><Body style={{ fontSize: t.sm }}>{item.applicants_count} applied</Body></View>
                    <View style={styles.tagInfo}><Body style={{ fontSize: t.sm, fontWeight: "700" }}>₹{item.daily_wage}/day</Body></View>
                    <View style={[styles.tagInfo, item.status === "in_progress" && { backgroundColor: "#FEF3C7" }, item.status === "completed" && { backgroundColor: "#DBEAFE" }]}>
                      <Body style={{ fontSize: t.sm, fontWeight: "700", color: item.status === "in_progress" ? "#D97706" : item.status === "completed" ? "#2563EB" : colors.onBrand }}>
                        {String(item.status || "open").replace("_", " ").toUpperCase()}
                      </Body>
                    </View>
                  </>
                )}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm },
  statusTag: { backgroundColor: colors.brandSecondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  tagInfo: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
