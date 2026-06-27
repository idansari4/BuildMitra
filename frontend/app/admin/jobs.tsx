import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

export default function AdminJobs() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try { setJobs(await api.adminJobs()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const close = async (id: string) => {
    setBusyId(id); setToast("");
    try { await api.adminCloseJob(id); setToast("Job closed ✓"); await load(); }
    catch (e: any) { setToast(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <H2 testID="admin-jobs-title">Job Monitoring</H2>
        <Muted style={{ marginTop: 4 }}>All postings across the platform</Muted>
      </View>
      {toast ? <Body style={{ paddingHorizontal: spacing.md, marginTop: 8, color: toast.includes("✓") ? colors.success : colors.error }}>{toast}</Body> : null}

      <FlatList
        data={jobs}
        keyExtractor={(j) => j.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <Muted style={{ textAlign: "center", marginTop: 40 }}>No jobs yet.</Muted>
        }
        renderItem={({ item }) => (
          <Card testID={`admin-job-${item.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.title}</Body>
                <Muted style={{ marginTop: 4 }}>
                  By {item.posted_by_name} ({item.posted_by_role})
                </Muted>
                <Muted>{item.location}</Muted>
              </View>
              <View style={[styles.statusTag, item.status === "open" ? { backgroundColor: colors.success } : { backgroundColor: colors.borderStrong }]}>
                <Body style={{ color: colors.onSuccess, fontSize: 10, fontWeight: "800" }}>
                  {String(item.status).toUpperCase()}
                </Body>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <View style={styles.tag}><Body style={{ fontSize: t.sm }}>{item.skill}</Body></View>
              <View style={styles.tag}><Body style={{ fontSize: t.sm, fontWeight: "700" }}>₹{item.daily_wage}/day</Body></View>
              <View style={styles.tag}><Body style={{ fontSize: t.sm }}>{item.workers_needed} workers</Body></View>
              <View style={styles.tag}><Body style={{ fontSize: t.sm }}>{item.applicants_count} applied</Body></View>
            </View>
            {item.status === "open" && (
              <Pressable
                testID={`close-job-${item.id}`}
                disabled={busyId === item.id}
                onPress={() => close(item.id)}
                style={styles.closeBtn}
              >
                <Ionicons name="close-circle-outline" size={16} color={colors.onError} />
                <Body style={{ color: colors.onError, fontWeight: "700", fontSize: t.sm }}>Close Job</Body>
              </Pressable>
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  tag: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  closeBtn: {
    marginTop: 12, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.error, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md,
  },
});
