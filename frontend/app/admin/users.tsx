import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, FlatList, Pressable, ActivityIndicator, TextInput, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Chip } from "@/src/ui";

const ROLES = [
  { id: "", label: "All" },
  { id: "worker", label: "Workers" },
  { id: "contractor", label: "Contractors" },
  { id: "client", label: "Clients" },
];

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    try { setUsers(await api.adminUsers(role || undefined, q || undefined)); } catch {}
    setLoading(false);
  }, [role, q]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const doAction = async (id: string, action: "verify" | "suspend" | "unsuspend") => {
    setBusyId(id); setToast("");
    try {
      if (action === "verify") await api.adminVerify(id);
      else if (action === "suspend") await api.adminSuspend(id);
      else await api.adminUnsuspend(id);
      setToast(`User ${action}d ✓`);
      await load();
    } catch (e: any) { setToast(e?.message || "Failed"); }
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.sm }}>
        <H2 testID="admin-users-title">User Management</H2>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color={colors.onSurfaceSecondary} />
          <TextInput
            testID="admin-users-search"
            value={q}
            onChangeText={setQ}
            placeholder="Search by name or mobile..."
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.searchInput}
          />
        </View>
      </View>
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8, height: 56, alignItems: "center" }}
      >
        {ROLES.map((r) => (
          <Chip key={r.id || "all"} testID={`admin-role-${r.id || "all"}`} label={r.label} selected={role === r.id} onPress={() => setRole(r.id)} />
        ))}
      </ScrollView>

      {toast ? <Body style={{ paddingHorizontal: spacing.md, color: toast.includes("✓") ? colors.success : colors.error }}>{toast}</Body> : null}

      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <Muted style={{ textAlign: "center", marginTop: 40 }}>No users found.</Muted>
        }
        renderItem={({ item }) => (
          <Card testID={`admin-user-${item.id}`}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={[styles.avatar, item.suspended && { backgroundColor: colors.error }]}>
                <Body style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>{item.name?.[0]?.toUpperCase()}</Body>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Body style={{ fontWeight: "700" }}>{item.name}</Body>
                  {item.aadhaar_verified && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                  {item.suspended && (
                    <View style={styles.suspendedTag}>
                      <Body style={{ color: colors.onError, fontSize: 10, fontWeight: "800" }}>SUSPENDED</Body>
                    </View>
                  )}
                </View>
                <Muted>{item.mobile} · {String(item.role).toUpperCase()}{item.city ? ` · ${item.city}` : ""}</Muted>
                {item.role === "worker" && item.skills?.length > 0 && (
                  <Muted style={{ marginTop: 2, fontSize: 11 }}>{item.skills.join(", ")}</Muted>
                )}
              </View>
            </View>
            <View style={styles.actions}>
              {!item.aadhaar_verified && (
                <Pressable
                  testID={`verify-${item.id}`}
                  disabled={busyId === item.id}
                  onPress={() => doAction(item.id, "verify")}
                  style={[styles.actionBtn, { backgroundColor: colors.success }]}
                >
                  <Ionicons name="shield-checkmark" size={16} color={colors.onSuccess} />
                  <Body style={{ color: colors.onSuccess, fontWeight: "700", fontSize: t.sm }}>Verify</Body>
                </Pressable>
              )}
              {item.suspended ? (
                <Pressable
                  testID={`unsuspend-${item.id}`}
                  disabled={busyId === item.id}
                  onPress={() => doAction(item.id, "unsuspend")}
                  style={[styles.actionBtn, { backgroundColor: colors.brand }]}
                >
                  <Ionicons name="lock-open" size={16} color={colors.onBrandPrimary} />
                  <Body style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: t.sm }}>Unsuspend</Body>
                </Pressable>
              ) : (
                <Pressable
                  testID={`suspend-${item.id}`}
                  disabled={busyId === item.id}
                  onPress={() => doAction(item.id, "suspend")}
                  style={[styles.actionBtn, { backgroundColor: colors.error }]}
                >
                  <Ionicons name="ban" size={16} color={colors.onError} />
                  <Body style={{ color: colors.onError, fontWeight: "700", fontSize: t.sm }}>Suspend</Body>
                </Pressable>
              )}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginTop: spacing.sm, backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, height: 44, fontSize: t.base, color: colors.onSurface },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  suspendedTag: { backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md,
  },
});
