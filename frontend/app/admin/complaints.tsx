import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Chip } from "@/src/ui";

const FILTERS = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Resolved" },
  { id: "rejected", label: "Rejected" },
  { id: "", label: "All" },
];

export default function AdminComplaints() {
  const [items, setItems] = useState<any[]>([]);
  const [status, setStatus] = useState("open");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.adminComplaints(status || undefined)); } catch {}
    setLoading(false);
  }, [status]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const action = async (id: string, kind: "resolve" | "reject") => {
    setBusyId(id); setToast("");
    try {
      if (kind === "resolve") await api.adminResolveComplaint(id);
      else await api.adminRejectComplaint(id);
      setToast(`Complaint ${kind}d ✓`);
      await load();
    } catch (e: any) { setToast(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <H2 testID="admin-complaints-title">Complaints</H2>
        <Muted style={{ marginTop: 4 }}>Review and act on user reports</Muted>
      </View>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, height: 56, alignItems: "center" }}
      >
        {FILTERS.map((f) => (
          <Chip key={f.id || "all"} testID={`complaint-filter-${f.id || "all"}`} label={f.label} selected={status === f.id} onPress={() => setStatus(f.id)} />
        ))}
      </ScrollView>
      {toast ? <Body style={{ paddingHorizontal: spacing.md, color: toast.includes("✓") ? colors.success : colors.error }}>{toast}</Body> : null}

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <Muted style={{ textAlign: "center", marginTop: 40 }}>No complaints here. ✓</Muted>
        }
        renderItem={({ item }) => (
          <Card testID={`complaint-${item.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.subject}</Body>
                <Muted style={{ marginTop: 4 }}>
                  By {item.by_user_name} ({item.by_user_role})
                </Muted>
              </View>
              <View style={[styles.tag, item.status === "open" ? { backgroundColor: colors.error } : { backgroundColor: colors.success }]}>
                <Body style={{ color: colors.onError, fontSize: 10, fontWeight: "800" }}>
                  {String(item.status).toUpperCase()}
                </Body>
              </View>
            </View>
            <Body style={{ marginTop: 10, lineHeight: 20 }}>{item.description}</Body>
            <Muted style={{ marginTop: 6, fontSize: 11 }}>{new Date(item.created_at).toLocaleString()}</Muted>

            {item.status === "open" && (
              <View style={styles.actions}>
                <Pressable
                  testID={`resolve-${item.id}`}
                  disabled={busyId === item.id}
                  onPress={() => action(item.id, "resolve")}
                  style={[styles.actionBtn, { backgroundColor: colors.success }]}
                >
                  <Ionicons name="checkmark-circle" size={16} color={colors.onSuccess} />
                  <Body style={{ color: colors.onSuccess, fontWeight: "700", fontSize: t.sm }}>Resolve</Body>
                </Pressable>
                <Pressable
                  testID={`reject-${item.id}`}
                  disabled={busyId === item.id}
                  onPress={() => action(item.id, "reject")}
                  style={[styles.actionBtn, { backgroundColor: colors.surfaceTertiary }]}
                >
                  <Ionicons name="close-circle" size={16} color={colors.onSurfaceTertiary} />
                  <Body style={{ color: colors.onSurfaceTertiary, fontWeight: "700", fontSize: t.sm }}>Reject</Body>
                </Pressable>
              </View>
            )}
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md,
  },
});
