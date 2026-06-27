import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton, Chip } from "@/src/ui";

const STATUSES = [
  { id: "available", label: "Available", color: "#10B981" },
  { id: "in_use", label: "In Use", color: "#F59E0B" },
  { id: "maintenance", label: "Maintenance", color: "#3B82F6" },
  { id: "damaged", label: "Damaged", color: "#EF4444" },
  { id: "lost", label: "Lost", color: "#6B7280" },
];

export default function Tools() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [assigned, setAssigned] = useState("");
  const [status, setStatus] = useState("available");
  const [cost, setCost] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.toolsList()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    setErr("");
    if (!name.trim()) { setErr("Name required"); return; }
    setBusy(true);
    try {
      await api.toolAdd({
        name: name.trim(), code: code.trim(), assigned_to: assigned.trim(),
        status, purchase_cost: parseFloat(cost) || 0,
      });
      setModal(false);
      setName(""); setCode(""); setAssigned(""); setCost("0"); setStatus("available");
      await load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="tools-title">Tools & Equipment</H2>
        <Pressable testID="add-tool" onPress={() => setModal(true)} style={styles.addBtn}>
          <Ionicons name="add" size={22} color={colors.onBrandPrimary} />
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="construct-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No tools yet</Body>
            <Muted>Tap + to track tools</Muted>
          </View>
        }
        renderItem={({ item }) => {
          const st = STATUSES.find((s) => s.id === item.status) || STATUSES[0];
          return (
            <Card testID={`tool-${item.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.name}</Body>
                  {item.code ? <Muted style={{ marginTop: 2 }}>#{item.code}</Muted> : null}
                  {item.assigned_to ? <Muted>Assigned: {item.assigned_to}</Muted> : null}
                </View>
                <View style={[styles.statusTag, { backgroundColor: st.color }]}>
                  <Body style={{ color: "#FFF", fontSize: t.sm, fontWeight: "700" }}>{st.label}</Body>
                </View>
              </View>
              {item.purchase_cost > 0 && (
                <Muted style={{ marginTop: 8 }}>Purchase cost: ₹{item.purchase_cost.toLocaleString("en-IN")}</Muted>
              )}
              <Pressable testID={`del-${item.id}`} onPress={async () => { try { await api.toolDel(item.id); await load(); } catch {} }} style={[styles.delBtn, { alignSelf: "flex-start", marginTop: 10 }]}>
                <Ionicons name="trash-outline" size={16} color={colors.error} />
                <Body style={{ color: colors.error, fontWeight: "700", fontSize: t.sm, marginLeft: 6 }}>Remove</Body>
              </Pressable>
            </Card>
          );
        }}
      />

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable onPress={() => setModal(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
              <H2>Add Tool</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              <Field testID="tool-name" label="Tool Name" value={name} onChangeText={setName} placeholder="e.g. Concrete Mixer" />
              <Field testID="tool-code" label="Code / QR (optional)" value={code} onChangeText={setCode} placeholder="e.g. CM-001" />
              <Field testID="tool-assigned" label="Assigned To" value={assigned} onChangeText={setAssigned} placeholder="Worker or Site" />
              <Body style={{ fontWeight: "700", marginBottom: 8 }}>Status</Body>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: spacing.md }}>
                {STATUSES.map((s) => (
                  <Chip key={s.id} testID={`status-${s.id}`} label={s.label} selected={status === s.id} onPress={() => setStatus(s.id)} />
                ))}
              </ScrollView>
              <Field testID="tool-cost" label="Purchase Cost (₹)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
            </ScrollView>
            <View style={styles.cta}>
              <PrimaryButton testID="save-tool" label="Save Tool" icon="checkmark-circle" loading={busy} onPress={submit} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  delBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, backgroundColor: "#FEE2E2" },
  statusTag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
