import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useT } from "@/src/i18n";
import { colors, radius, spacing } from "@/src/theme";
import { H2, Body, Muted, Card, Chip, PrimaryButton, Field } from "@/src/ui";
import { EmptyState, SkeletonList } from "@/src/ux";

type ComplaintRec = {
  id: string;
  subject: string;
  description: string;
  status: "open" | "resolved" | "rejected";
  admin_note?: string;
  created_at: string;
  category?: string;
};

const CATEGORIES: { key: string; en: string; hi: string; icon: any }[] = [
  { key: "payment",  en: "Payment Issue",   hi: "भुगतान समस्या", icon: "cash-outline" },
  { key: "behavior", en: "Bad Behavior",    hi: "बुरा व्यवहार",  icon: "alert-circle-outline" },
  { key: "safety",   en: "Safety Concern",  hi: "सुरक्षा चिंता",   icon: "shield-outline" },
  { key: "fraud",    en: "Fraud / Cheating",hi: "धोखाधड़ी",         icon: "warning-outline" },
  { key: "quality",  en: "Work Quality",    hi: "कार्य गुणवत्ता",   icon: "construct-outline" },
  { key: "other",    en: "Other",           hi: "अन्य",            icon: "ellipsis-horizontal-circle-outline" },
];

const STATUS_META: Record<string, { color: string; bg: string; icon: any; en: string; hi: string }> = {
  open:     { color: colors.warning, bg: "#FEF3C7", icon: "time-outline",            en: "Open",     hi: "लंबित" },
  resolved: { color: colors.success, bg: "#DCFCE7", icon: "checkmark-circle",        en: "Resolved", hi: "हल हो गया" },
  rejected: { color: colors.error,   bg: "#FEE2E2", icon: "close-circle",            en: "Rejected", hi: "अस्वीकृत" },
};

export default function Complaints() {
  const router = useRouter();
  const { t: tr, lang } = useT();
  const [items, setItems] = useState<ComplaintRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // File modal
  const [modal, setModal] = useState(false);
  const [category, setCategory] = useState<string>("payment");
  const [against, setAgainst] = useState("");
  const [subject, setSubject] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const load = useCallback(async () => {
    try { setItems(await api.myComplaints()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openModal = () => {
    setModal(true);
    setCategory("payment"); setAgainst(""); setSubject(""); setDesc("");
    setErr(""); setOk("");
  };

  const submit = async () => {
    setErr(""); setOk("");
    if (!subject.trim()) { setErr(tr("complaints.errSubject")); return; }
    if (desc.trim().length < 10) { setErr(tr("complaints.errDesc")); return; }
    setBusy(true);
    try {
      const cat = CATEGORIES.find(c => c.key === category);
      const catLabel = cat ? cat[lang] : category;
      const fullDesc =
        `[${tr("complaints.category")}: ${catLabel}]` +
        (against.trim() ? `\n[${tr("complaints.against")}: ${against.trim()}]` : "") +
        `\n\n${desc.trim()}`;
      await api.fileComplaint({
        subject: subject.trim(),
        description: fullDesc,
      });
      setOk(tr("complaints.filed"));
      await load();
      setTimeout(() => { setModal(false); }, 1100);
    } catch (e: any) {
      setErr(e?.message || tr("common.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="complaints-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="complaints-title">{tr("complaints.title")}</H2>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(c) => c.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 140, gap: spacing.md }}
        ListHeaderComponent={
          <View style={styles.hero}>
            <Ionicons name="shield-checkmark" size={36} color={colors.brand} />
            <H2 style={{ marginTop: 6, textAlign: "center" }}>{tr("complaints.heroTitle")}</H2>
            <Muted style={{ marginTop: 4, textAlign: "center", paddingHorizontal: spacing.sm }}>
              {tr("complaints.heroSub")}
            </Muted>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <SkeletonList rows={4} />
          ) : (
            <EmptyState
              testID="complaints-empty"
              icon="file-tray-outline"
              title={tr("complaints.empty")}
              subtitle={tr("complaints.heroSub")}
              actionLabel={tr("complaints.fileNew")}
              onAction={openModal}
            />
          )
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || STATUS_META.open;
          return (
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <Body style={{ fontWeight: "800", flex: 1, marginRight: 8 }} numberOfLines={2}>
                  {item.subject}
                </Body>
                <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                  <Ionicons name={meta.icon} size={12} color={meta.color} />
                  <Body style={{ color: meta.color, fontSize: 11, fontWeight: "800", marginLeft: 4 }}>
                    {meta[lang]}
                  </Body>
                </View>
              </View>
              <Muted style={{ fontSize: 12 }}>{new Date(item.created_at).toLocaleString()}</Muted>
              <Body style={{ marginTop: 8, color: colors.onSurfaceSecondary }} numberOfLines={4}>
                {item.description}
              </Body>
              {item.admin_note ? (
                <View style={styles.adminNote}>
                  <Ionicons name="chatbox-ellipses" size={14} color={colors.brand} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Body style={{ fontWeight: "700", fontSize: 12 }}>{tr("complaints.adminNote")}</Body>
                    <Muted style={{ fontSize: 12, marginTop: 2 }}>{item.admin_note}</Muted>
                  </View>
                </View>
              ) : null}
            </Card>
          );
        }}
      />

      {/* Floating Action Button */}
      <Pressable testID="open-complaint" onPress={openModal} style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}>
        <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        <Body style={{ color: colors.onBrandPrimary, fontWeight: "800", marginLeft: 4 }}>
          {tr("complaints.fileNew")}
        </Body>
      </Pressable>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable testID="close-complaint" onPress={() => setModal(false)} hitSlop={12}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
              <H2>{tr("complaints.fileNew")}</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
              <Body style={{ fontWeight: "700", marginBottom: 8 }}>{tr("complaints.category")}</Body>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md }}>
                {CATEGORIES.map((c) => (
                  <Chip
                    key={c.key}
                    testID={`cat-${c.key}`}
                    label={c[lang]}
                    selected={category === c.key}
                    onPress={() => setCategory(c.key)}
                  />
                ))}
              </View>

              <Field
                testID="complaint-against"
                label={tr("complaints.againstOptional")}
                value={against}
                onChangeText={setAgainst}
                placeholder={tr("complaints.againstPh")}
              />
              <Field
                testID="complaint-subject"
                label={tr("complaints.subject")}
                value={subject}
                onChangeText={setSubject}
                placeholder={tr("complaints.subjectPh")}
              />
              <Field
                testID="complaint-desc"
                label={tr("complaints.description")}
                value={desc}
                onChangeText={setDesc}
                placeholder={tr("complaints.descPh")}
                multiline
              />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
              {ok ? <Body style={{ color: colors.success, fontWeight: "700" }}>{ok}</Body> : null}

              <View style={styles.tip}>
                <Ionicons name="information-circle" size={16} color={colors.brand} />
                <Muted style={{ marginLeft: 6, flex: 1, fontSize: 12 }}>{tr("complaints.tip")}</Muted>
              </View>
            </ScrollView>
            <View style={styles.modalCta}>
              <PrimaryButton
                testID="submit-complaint"
                label={tr("complaints.submit")}
                icon="send"
                loading={busy}
                onPress={submit}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hero: {
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.lg,
  },
  badge: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm,
  },
  adminNote: {
    flexDirection: "row", alignItems: "flex-start",
    marginTop: 10, padding: 10, borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
  },
  fab: {
    position: "absolute", bottom: 24, right: 16,
    flexDirection: "row", alignItems: "center",
    backgroundColor: colors.brand,
    paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 999,
    shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalCta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  tip: { flexDirection: "row", alignItems: "center", marginTop: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
});
