import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton, Chip } from "@/src/ui";

const CATEGORIES = ["Cement", "Sand", "Aggregate", "Bricks", "Steel", "Tiles", "Paint", "Electrical", "Plumbing", "Hardware", "Other"];

export default function Materials() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [cat, setCat] = useState("Cement");
  const [unit, setUnit] = useState("bag");
  const [qty, setQty] = useState("0");
  const [minQty, setMinQty] = useState("0");
  const [cost, setCost] = useState("0");
  const [site, setSite] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.materialsList()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const submit = async () => {
    setErr("");
    if (!name.trim()) { setErr("Name required"); return; }
    setBusy(true);
    try {
      await api.materialAdd({
        name: name.trim(), category: cat, unit,
        qty: parseFloat(qty) || 0, min_qty: parseFloat(minQty) || 0,
        cost_per_unit: parseFloat(cost) || 0, site: site.trim(),
      });
      setModal(false);
      setName(""); setQty("0"); setMinQty("0"); setCost("0"); setSite("");
      await load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const del = async (id: string) => {
    try { await api.materialDel(id); await load(); } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="materials-title">Materials</H2>
        <Pressable testID="add-material" onPress={() => setModal(true)} style={styles.addBtn}>
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
            <Ionicons name="cube-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No materials yet</Body>
            <Muted>Tap + to add inventory</Muted>
          </View>
        }
        renderItem={({ item }) => {
          const low = item.qty <= item.min_qty;
          return (
            <Card testID={`mat-${item.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.name}</Body>
                    {low && (
                      <View style={styles.lowTag}>
                        <Body style={{ color: colors.onError, fontSize: 10, fontWeight: "800" }}>LOW STOCK</Body>
                      </View>
                    )}
                  </View>
                  <Muted style={{ marginTop: 2 }}>{item.category}{item.site ? ` · ${item.site}` : ""}</Muted>
                </View>
                <Pressable testID={`del-${item.id}`} onPress={() => del(item.id)} style={styles.delBtn}>
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                <Stat label="Stock" value={`${item.qty} ${item.unit}`} />
                <Stat label="Min" value={`${item.min_qty} ${item.unit}`} />
                <Stat label="Cost" value={`₹${item.cost_per_unit}`} highlight />
              </View>
            </Card>
          );
        }}
      />

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable onPress={() => setModal(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
              <H2>Add Material</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              <Field testID="mat-name" label="Name" value={name} onChangeText={setName} placeholder="e.g. Cement" />
              <Body style={{ fontWeight: "700", marginBottom: 8 }}>Category</Body>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} style={{ marginBottom: spacing.md }}>
                {CATEGORIES.map((c) => <Chip key={c} label={c} selected={cat === c} onPress={() => setCat(c)} />)}
              </ScrollView>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field testID="mat-unit" label="Unit" value={unit} onChangeText={setUnit} placeholder="bag, kg, ton" /></View>
                <View style={{ flex: 1 }}><Field testID="mat-qty" label="Quantity" value={qty} onChangeText={setQty} keyboardType="decimal-pad" /></View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field testID="mat-min" label="Min Stock" value={minQty} onChangeText={setMinQty} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field testID="mat-cost" label="Cost / unit (₹)" value={cost} onChangeText={setCost} keyboardType="decimal-pad" /></View>
              </View>
              <Field testID="mat-site" label="Site (optional)" value={site} onChangeText={setSite} placeholder="e.g. Andheri site" />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
            </ScrollView>
            <View style={styles.cta}>
              <PrimaryButton testID="save-mat" label="Save Material" icon="checkmark-circle" loading={busy} onPress={submit} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={[styles.stat, highlight && { backgroundColor: colors.brandTertiary }]}>
      <Body style={{ fontWeight: "800", color: highlight ? colors.onBrandTertiary : colors.onSurface }}>{value}</Body>
      <Muted style={{ fontSize: 11, fontWeight: "700" }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  delBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center" },
  lowTag: { backgroundColor: colors.error, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  stat: { flex: 1, padding: 10, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, alignItems: "center", marginHorizontal: 4 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
