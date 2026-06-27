import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, Modal, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, RefreshControl, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton, SecondaryButton } from "@/src/ui";

export default function Bills() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modal, setModal] = useState(false);
  const [billTo, setBillTo] = useState("");
  const [project, setProject] = useState("");
  const [taxPct, setTaxPct] = useState("18");
  const [lines, setLines] = useState<{ desc: string; qty: string; rate: string }[]>([{ desc: "", qty: "1", rate: "0" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.billsList()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const subtotal = lines.reduce((s, l) => s + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0);
  const tax = Math.round(subtotal * (parseFloat(taxPct) || 0) / 100 * 100) / 100;
  const total = subtotal + tax;

  const updateLine = (i: number, k: "desc" | "qty" | "rate", v: string) => {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  };
  const addLine = () => setLines((ls) => [...ls, { desc: "", qty: "1", rate: "0" }]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const submit = async () => {
    setErr("");
    if (!billTo.trim()) { setErr("Bill To required"); return; }
    const items = lines
      .filter((l) => l.desc.trim() && parseFloat(l.qty) > 0)
      .map((l) => ({ description: l.desc.trim(), qty: parseFloat(l.qty) || 0, rate: parseFloat(l.rate) || 0 }));
    if (!items.length) { setErr("Add at least one line item"); return; }
    setBusy(true);
    try {
      await api.billAdd({ bill_to: billTo.trim(), project: project.trim(), tax_pct: parseFloat(taxPct) || 0, items });
      setModal(false);
      setBillTo(""); setProject(""); setTaxPct("18"); setLines([{ desc: "", qty: "1", rate: "0" }]);
      await load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const markPaid = async (id: string) => {
    try { await api.billPaid(id); await load(); } catch {}
  };

  const share = async (b: any) => {
    const lineStr = b.items.map((it: any) => `• ${it.description} — ${it.qty} × ₹${it.rate} = ₹${(it.qty * it.rate).toLocaleString("en-IN")}`).join("\n");
    const msg = `*BuildMitra Invoice ${b.bill_no}*\n\nBill To: ${b.bill_to}\nProject: ${b.project || "—"}\n\n${lineStr}\n\nSubtotal: ₹${b.subtotal.toLocaleString("en-IN")}\nGST ${b.tax_pct}%: ₹${b.tax_amount.toLocaleString("en-IN")}\n*Total: ₹${b.total.toLocaleString("en-IN")}*\n\nStatus: ${b.status.toUpperCase()}`;
    try { await Share.share({ message: msg }); } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-btn" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="bills-title">Bills & Invoices</H2>
        <Pressable testID="add-bill" onPress={() => setModal(true)} style={styles.addBtn}>
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
            <Ionicons name="receipt-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No bills yet</Body>
            <Muted>Tap + to create an invoice</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Card testID={`bill-${item.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flex: 1 }}>
                <Body style={{ fontWeight: "800", fontSize: t.lg }}>{item.bill_no}</Body>
                <Muted style={{ marginTop: 2 }}>To: {item.bill_to}</Muted>
                {item.project ? <Muted>{item.project}</Muted> : null}
              </View>
              <View style={[styles.statusTag, item.status === "paid" ? { backgroundColor: colors.success } : { backgroundColor: colors.warning }]}>
                <Body style={{ color: "#FFF", fontSize: 10, fontWeight: "800" }}>
                  {String(item.status).toUpperCase()}
                </Body>
              </View>
            </View>
            <View style={styles.amountBox}>
              <View>
                <Muted style={{ fontWeight: "700" }}>TOTAL</Muted>
                <Body style={{ fontSize: t.xxl, fontWeight: "800", color: colors.brand }} testID={`total-${item.id}`}>
                  ₹{item.total.toLocaleString("en-IN")}
                </Body>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Muted style={{ fontSize: 11 }}>Subtotal ₹{item.subtotal.toLocaleString("en-IN")}</Muted>
                <Muted style={{ fontSize: 11 }}>GST {item.tax_pct}%: ₹{item.tax_amount.toLocaleString("en-IN")}</Muted>
                <Muted style={{ fontSize: 11 }}>{item.items.length} items</Muted>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {item.status !== "paid" && (
                <Pressable testID={`paid-${item.id}`} onPress={() => markPaid(item.id)} style={[styles.actionBtn, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark-circle" size={16} color="#FFF" />
                  <Body style={{ color: "#FFF", fontWeight: "700", fontSize: t.sm }}>Mark Paid</Body>
                </Pressable>
              )}
              <Pressable testID={`share-${item.id}`} onPress={() => share(item)} style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
                <Ionicons name="share-social" size={16} color={colors.onBrandPrimary} />
                <Body style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: t.sm }}>Share</Body>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable onPress={() => setModal(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
              <H2>Create Bill</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 200 }} keyboardShouldPersistTaps="handled">
              <Field testID="bill-to" label="Bill To" value={billTo} onChangeText={setBillTo} placeholder="Client name / company" />
              <Field testID="bill-project" label="Project (optional)" value={project} onChangeText={setProject} />
              <Field testID="bill-tax" label="GST %" value={taxPct} onChangeText={setTaxPct} keyboardType="decimal-pad" />

              <H2 style={{ marginTop: 8, marginBottom: 8 }}>Line Items</H2>
              {lines.map((l, i) => (
                <Card key={i} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                    <Body style={{ fontWeight: "700", flex: 1 }}>Item {i + 1}</Body>
                    {lines.length > 1 && (
                      <Pressable onPress={() => removeLine(i)}>
                        <Ionicons name="trash-outline" size={18} color={colors.error} />
                      </Pressable>
                    )}
                  </View>
                  <Field testID={`item-desc-${i}`} label="Description" value={l.desc} onChangeText={(v) => updateLine(i, "desc", v)} placeholder="e.g. Masonry work 5 days" />
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}><Field testID={`item-qty-${i}`} label="Qty" value={l.qty} onChangeText={(v) => updateLine(i, "qty", v)} keyboardType="decimal-pad" /></View>
                    <View style={{ flex: 1 }}><Field testID={`item-rate-${i}`} label="Rate (₹)" value={l.rate} onChangeText={(v) => updateLine(i, "rate", v)} keyboardType="decimal-pad" /></View>
                  </View>
                  <Muted style={{ textAlign: "right", fontWeight: "700" }}>
                    = ₹{((parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0)).toLocaleString("en-IN")}
                  </Muted>
                </Card>
              ))}
              <SecondaryButton testID="add-line" label="+ Add Line Item" onPress={addLine} />

              <Card style={{ marginTop: spacing.md, backgroundColor: colors.brandTertiary, borderColor: colors.brand }}>
                <Row label="Subtotal" value={`₹${subtotal.toLocaleString("en-IN")}`} />
                <Row label={`GST ${taxPct || 0}%`} value={`₹${tax.toLocaleString("en-IN")}`} />
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />
                <Row label="TOTAL" value={`₹${total.toLocaleString("en-IN")}`} bold />
              </Card>

              {err ? <Body style={{ color: colors.error, marginTop: 10 }}>{err}</Body> : null}
            </ScrollView>
            <View style={styles.cta}>
              <PrimaryButton testID="save-bill" label="Create Bill" icon="receipt" loading={busy} onPress={submit} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
      <Body style={{ fontWeight: bold ? "800" : "600", fontSize: bold ? t.lg : t.base }}>{label}</Body>
      <Body style={{ fontWeight: bold ? "800" : "600", fontSize: bold ? t.lg : t.base, color: bold ? colors.brand : colors.onSurface }}>{value}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
  statusTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  amountBox: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 12, padding: 12, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
