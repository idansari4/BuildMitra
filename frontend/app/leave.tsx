import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton, Chip } from "@/src/ui";

const STATUS_META: any = {
  pending: { bg: "#FEF3C7", color: colors.warning, label: "Pending" },
  approved: { bg: "#DCFCE7", color: colors.success, label: "Approved" },
  rejected: { bg: "#FEE2E2", color: colors.error, label: "Rejected" },
};

export default function Leave() {
  const router = useRouter();
  const { user } = useAuth();
  const isWorker = user?.role === "worker";
  const [tab, setTab] = useState<"mine" | "inbox">(isWorker ? "mine" : "inbox");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      if (tab === "mine") setItems(await api.leaveMine());
      else setItems(await api.leaveInbox());
    } catch {}
    setLoading(false);
  }, [tab]);

  useEffect(() => { setLoading(true); load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    setErr(""); setOk("");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) { setErr("Enter dates in YYYY-MM-DD"); return; }
    if (reason.trim().length < 3) { setErr("Reason required"); return; }
    setBusy(true);
    try {
      await api.leaveRequest({ from_date: from, to_date: to, reason: reason.trim() });
      setOk("Leave requested \u2713");
      setFrom(""); setTo(""); setReason("");
      await load();
      setTimeout(() => { setModal(false); setOk(""); }, 1100);
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, decision: "approved" | "rejected") => {
    setBusyId(id);
    try {
      await api.leaveDecision(id, decision);
      await load();
    } catch {}
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="leave-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Leave</H2>
        <View style={{ width: 40 }} />
      </View>

      {(user?.role === "contractor" || user?.role === "client" || user?.role === "admin") && (
        <View style={{ flexDirection: "row", gap: 6, padding: spacing.md }}>
          {isWorker && <Chip testID="tab-mine" label="My Requests" selected={tab === "mine"} onPress={() => setTab("mine")} />}
          <Chip testID="tab-inbox" label="Inbox" selected={tab === "inbox"} onPress={() => setTab("inbox")} />
        </View>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 140, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {items.length === 0 ? (
            <Card>
              <View style={{ alignItems: "center", padding: spacing.md }}>
                <Ionicons name="calendar-outline" size={44} color={colors.borderStrong} />
                <Muted style={{ marginTop: 8 }}>{tab === "mine" ? "No leave requests" : "Inbox empty"}</Muted>
              </View>
            </Card>
          ) : items.map((it) => {
            const m = STATUS_META[it.status] || STATUS_META.pending;
            return (
              <Card key={it.id} testID={`leave-${it.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    {tab === "inbox" && <Body style={{ fontWeight: "700" }}>{it.worker_name}</Body>}
                    <Body style={{ fontWeight: tab === "inbox" ? "400" : "700" }}>{it.from_date} → {it.to_date}</Body>
                    <Muted style={{ marginTop: 4 }}>{it.reason}</Muted>
                    {it.note ? <Muted style={{ marginTop: 6, fontStyle: "italic" }}>Note: {it.note}</Muted> : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: m.bg }]}>
                    <Body style={{ color: m.color, fontSize: 11, fontWeight: "800" }}>{m.label}</Body>
                  </View>
                </View>
                {tab === "inbox" && it.status === "pending" && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    <Pressable testID={`approve-${it.id}`} onPress={() => decide(it.id, "approved")} disabled={busyId === it.id} style={[styles.actBtn, { backgroundColor: colors.success }]}>
                      <Ionicons name="checkmark" size={16} color="#FFF" />
                      <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Approve</Body>
                    </Pressable>
                    <Pressable testID={`reject-${it.id}`} onPress={() => decide(it.id, "rejected")} disabled={busyId === it.id} style={[styles.actBtn, { backgroundColor: colors.error }]}>
                      <Ionicons name="close" size={16} color="#FFF" />
                      <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Reject</Body>
                    </Pressable>
                  </View>
                )}
              </Card>
            );
          })}
        </ScrollView>
      )}

      {isWorker && (
        <Pressable testID="open-leave" onPress={() => setModal(true)} style={styles.fab}>
          <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
          <Body style={{ color: colors.onBrandPrimary, fontWeight: "800", marginLeft: 4 }}>Request Leave</Body>
        </Pressable>
      )}

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable testID="close-leave" onPress={() => setModal(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
              <H2>Request Leave</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <Field testID="leave-from" label="From (YYYY-MM-DD)" value={from} onChangeText={setFrom} placeholder="2026-07-01" />
              <Field testID="leave-to" label="To (YYYY-MM-DD)" value={to} onChangeText={setTo} placeholder="2026-07-05" />
              <Field testID="leave-reason" label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. medical / family" multiline />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
              {ok ? <Body style={{ color: colors.success, fontWeight: "700" }}>{ok}</Body> : null}
              <PrimaryButton testID="submit-leave" label="Submit Request" icon="send" loading={busy} onPress={submit} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  actBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: radius.md },
  fab: { position: "absolute", bottom: 24, right: 16, flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
});
