import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton } from "@/src/ui";

export default function Estimates() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [site, setSite] = useState("");
  const [labour, setLabour] = useState("0");
  const [material, setMaterial] = useState("0");
  const [equip, setEquip] = useState("0");
  const [transport, setTransport] = useState("0");
  const [misc, setMisc] = useState("0");
  const [revenue, setRevenue] = useState("0");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.estimatesList()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const totalCost = (parseFloat(labour) || 0) + (parseFloat(material) || 0) + (parseFloat(equip) || 0) + (parseFloat(transport) || 0) + (parseFloat(misc) || 0);
  const rev = parseFloat(revenue) || 0;
  const profit = rev - totalCost;
  const margin = rev ? ((profit / rev) * 100).toFixed(1) : "0.0";

  const submit = async () => {
    setErr("");
    if (!name.trim()) { setErr("Project name required"); return; }
    setBusy(true);
    try {
      await api.estimateAdd({
        project_name: name.trim(), client_name: client.trim(), site: site.trim(),
        labour_cost: parseFloat(labour) || 0,
        material_cost: parseFloat(material) || 0,
        equipment_cost: parseFloat(equip) || 0,
        transport_cost: parseFloat(transport) || 0,
        misc_cost: parseFloat(misc) || 0,
        revenue: rev,
      });
      setModal(false);
      setName(""); setClient(""); setSite(""); setLabour("0"); setMaterial("0"); setEquip("0"); setTransport("0"); setMisc("0"); setRevenue("0");
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
        <H2 testID="estimates-title">Cost Estimates</H2>
        <Pressable testID="add-estimate" onPress={() => setModal(true)} style={styles.addBtn}>
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
            <Ionicons name="calculator-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No estimates yet</Body>
            <Muted>Tap + to create an estimate</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Card testID={`est-${item.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.project_name}</Body>
                <Muted style={{ marginTop: 2 }}>
                  {item.client_name || "—"}{item.site ? ` · ${item.site}` : ""}
                </Muted>
              </View>
              <View style={[styles.marginTag, { backgroundColor: item.profit > 0 ? colors.success : colors.error }]}>
                <Body style={{ color: "#FFF", fontWeight: "800", fontSize: t.sm }}>
                  {item.margin_pct}%
                </Body>
              </View>
            </View>
            <View style={styles.row3}>
              <Mini label="Cost" value={`₹${item.total_cost.toLocaleString("en-IN")}`} />
              <Mini label="Revenue" value={`₹${item.revenue.toLocaleString("en-IN")}`} />
              <Mini label="Profit" value={`₹${item.profit.toLocaleString("en-IN")}`} highlight={item.profit > 0} />
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
              <Cost label="Labour" v={item.labour_cost} />
              <Cost label="Material" v={item.material_cost} />
              <Cost label="Equip" v={item.equipment_cost} />
              <Cost label="Transport" v={item.transport_cost} />
              <Cost label="Misc" v={item.misc_cost} />
            </View>
            <Pressable testID={`del-${item.id}`} onPress={async () => { try { await api.estimateDel(item.id); await load(); } catch {} }} style={styles.delBtn}>
              <Ionicons name="trash-outline" size={14} color={colors.error} />
              <Body style={{ color: colors.error, fontWeight: "700", fontSize: t.sm, marginLeft: 4 }}>Delete</Body>
            </Pressable>
          </Card>
        )}
      />

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable onPress={() => setModal(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
              <H2>New Estimate</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
              <Field testID="est-name" label="Project Name" value={name} onChangeText={setName} placeholder="e.g. Andheri 2BHK" />
              <Field testID="est-client" label="Client" value={client} onChangeText={setClient} placeholder="Sharma Builders" />
              <Field testID="est-site" label="Site" value={site} onChangeText={setSite} placeholder="Andheri, Mumbai" />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field testID="est-labour" label="Labour (₹)" value={labour} onChangeText={setLabour} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field testID="est-material" label="Material (₹)" value={material} onChangeText={setMaterial} keyboardType="decimal-pad" /></View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field testID="est-equip" label="Equipment (₹)" value={equip} onChangeText={setEquip} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field testID="est-transport" label="Transport (₹)" value={transport} onChangeText={setTransport} keyboardType="decimal-pad" /></View>
              </View>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}><Field testID="est-misc" label="Misc (₹)" value={misc} onChangeText={setMisc} keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}><Field testID="est-revenue" label="Revenue (₹)" value={revenue} onChangeText={setRevenue} keyboardType="decimal-pad" /></View>
              </View>

              <Card style={{ marginTop: 8, backgroundColor: colors.brandTertiary, borderColor: colors.brand }}>
                <View style={styles.row3}>
                  <Mini label="Total Cost" value={`₹${totalCost.toLocaleString("en-IN")}`} />
                  <Mini label="Profit" value={`₹${profit.toLocaleString("en-IN")}`} />
                  <Mini label="Margin" value={`${margin}%`} highlight />
                </View>
              </Card>
              {err ? <Body style={{ color: colors.error, marginTop: 10 }}>{err}</Body> : null}
            </ScrollView>
            <View style={styles.cta}>
              <PrimaryButton testID="save-est" label="Save Estimate" icon="checkmark-circle" loading={busy} onPress={submit} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Mini({ label, value, highlight }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Body style={{ fontWeight: "800", color: highlight ? colors.brand : colors.onSurface }}>{value}</Body>
      <Muted style={{ fontSize: 11, fontWeight: "700" }}>{label}</Muted>
    </View>
  );
}
function Cost({ label, v }: { label: string; v: number }) {
  if (!v) return null;
  return (
    <View style={styles.costTag}>
      <Body style={{ fontSize: 11, fontWeight: "700", color: colors.onSurfaceTertiary }}>{label}: ₹{v.toLocaleString("en-IN")}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  delBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: "#FEE2E2", alignSelf: "flex-start", marginTop: 10 },
  marginTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill },
  row3: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingHorizontal: 8 },
  costTag: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
