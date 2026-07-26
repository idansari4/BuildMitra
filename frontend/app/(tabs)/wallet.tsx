import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  Modal,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, PrimaryButton, SecondaryButton, Field, Chip } from "@/src/ui";
import { PaymentSheet } from "@/src/payment-sheet";

const BADGES = [
  { id: "bronze", title: "Bronze", min: 0, color: "#CD7F32", icon: "medal-outline" },
  { id: "silver", title: "Silver", min: 200, color: "#A1A1AA", icon: "medal" },
  { id: "gold", title: "Gold", min: 500, color: "#F59E0B", icon: "trophy" },
] as const;

const QUICK_TOPUP = [100, 500, 1000, 2000];

type Txn = {
  id: string;
  type: string;
  amount: number;
  note?: string;
  status?: string;
  upi_id?: string;
  created_at: string;
};

/** Map txn type to icon + colour for the timeline */
function txnMeta(type: string, isCredit: boolean) {
  const t = (type || "").toLowerCase();
  if (t.includes("referral")) return { icon: "gift" as const, color: "#8B5CF6" };
  if (t.includes("salary") || t.includes("wage") || t.includes("earnings"))
    return { icon: "cash" as const, color: colors.success };
  if (t.includes("withdraw")) return { icon: "arrow-up-circle" as const, color: colors.error };
  if (t.includes("topup") || t.includes("top_up") || t.includes("wallet_topup") || t.includes("wallet"))
    return { icon: "arrow-down-circle" as const, color: colors.success };
  if (t.includes("erp")) return { icon: "briefcase" as const, color: "#3B82F6" };
  return { icon: isCredit ? "add-circle" as const : "remove-circle" as const, color: isCredit ? colors.success : colors.error };
}

export default function Wallet() {
  const [data, setData] = useState<{ balance: number; referral_code: string; transactions: Txn[] }>({
    balance: 0,
    referral_code: "",
    transactions: [],
  });
  const [refStats, setRefStats] = useState<{ invited: number; earned: number } | null>(null);
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const [customAmt, setCustomAmt] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [filter, setFilter] = useState<"all" | "in" | "out">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState("");
  const { refresh } = useAuth();

  const reload = useCallback(async () => {
    try {
      const [w, rs] = await Promise.all([api.wallet(), api.walletReferralStats().catch(() => null)]);
      setData(w);
      if (rs) setRefStats(rs);
    } catch {}
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    await refresh?.();
    setRefreshing(false);
  };

  const share = async () => {
    try {
      await Share.share({
        message: `Join BuildMitra with my referral code ${data.referral_code} — India's #1 construction work marketplace. Get ₹50 on signup!`,
      });
    } catch {}
  };

  const copyCode = () => {
    // React Native Web has navigator.clipboard; native has Clipboard API but we skip to keep deps minimal
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(data.referral_code || "").catch(() => {});
    }
    setCopiedMsg("Copied!");
    setTimeout(() => setCopiedMsg(""), 1500);
  };

  const handleTopupSuccess = async () => {
    setPayAmount(null);
    setShowCustom(false);
    setCustomAmt("");
    await reload();
    await refresh?.();
  };

  const filtered = useMemo(() => {
    if (filter === "all") return data.transactions;
    return data.transactions.filter((tx) => {
      const a = Number(tx.amount) || 0;
      return filter === "in" ? a >= 0 : a < 0;
    });
  }, [filter, data.transactions]);

  const stats = useMemo(() => {
    let credited = 0,
      debited = 0;
    data.transactions.forEach((tx) => {
      const a = Number(tx.amount) || 0;
      if (a >= 0) credited += a;
      else debited += Math.abs(a);
    });
    return { credited, debited, count: data.transactions.length };
  }, [data.transactions]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 80, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      >
        <H2 testID="wallet-title">Wallet & Referrals</H2>

        {/* Hero balance card */}
        <LinearGradient colors={[colors.brand, "#D97706"]} style={styles.hero}>
          <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85, fontWeight: "700", fontSize: 11 }}>
            AVAILABLE BALANCE
          </Muted>
          <H1 style={{ color: colors.onBrandPrimary, fontSize: 44, marginTop: 4 }} testID="wallet-balance">
            ₹{(data.balance ?? 0).toLocaleString()}
          </H1>

          {/* Money-flow mini stats */}
          <View style={styles.flowRow}>
            <View style={styles.flowCell}>
              <Ionicons name="arrow-down-circle" size={14} color={colors.onBrandPrimary} />
              <Body style={styles.flowText}>+₹{stats.credited.toLocaleString()}</Body>
            </View>
            <View style={styles.flowDivider} />
            <View style={styles.flowCell}>
              <Ionicons name="arrow-up-circle" size={14} color={colors.onBrandPrimary} />
              <Body style={styles.flowText}>−₹{stats.debited.toLocaleString()}</Body>
            </View>
          </View>

          {/* Referral row */}
          <View
            style={{
              marginTop: spacing.md,
              backgroundColor: "rgba(0,0,0,0.15)",
              padding: 12,
              borderRadius: radius.md,
            }}
          >
            <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85, fontWeight: "700", fontSize: 11 }}>
              YOUR REFERRAL CODE
            </Muted>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 6,
              }}
            >
              <Pressable onPress={copyCode} style={{ flex: 1 }}>
                <Body
                  style={{
                    fontSize: 22,
                    fontWeight: "800",
                    color: colors.onBrandPrimary,
                    letterSpacing: 2,
                  }}
                  testID="referral-code"
                >
                  {data.referral_code || "—"}
                </Body>
                {copiedMsg ? (
                  <Muted style={{ color: colors.onBrandPrimary, fontSize: 10, marginTop: 2 }}>{copiedMsg}</Muted>
                ) : (
                  <Muted style={{ color: colors.onBrandPrimary, opacity: 0.7, fontSize: 10, marginTop: 2 }}>
                    Tap to copy
                  </Muted>
                )}
              </Pressable>
              <Pressable testID="share-referral" onPress={share} style={styles.shareBtn}>
                <Ionicons name="share-social" size={18} color={colors.brand} />
                <Body style={{ color: colors.brand, fontWeight: "700" }}>Share</Body>
              </Pressable>
            </View>
            {refStats ? (
              <View style={styles.refStatsRow}>
                <View style={styles.refStatCell}>
                  <Body style={styles.refStatValue}>{refStats.invited}</Body>
                  <Muted style={styles.refStatLabel}>Invited</Muted>
                </View>
                <View style={styles.refStatCell}>
                  <Body style={styles.refStatValue}>₹{refStats.earned.toFixed(0)}</Body>
                  <Muted style={styles.refStatLabel}>Earned</Muted>
                </View>
              </View>
            ) : null}
          </View>
        </LinearGradient>

        {/* Add Money / Withdraw actions */}
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            testID="action-addmoney"
            onPress={() => setShowCustom(true)}
            style={[styles.actionBtn, { backgroundColor: colors.brand }]}
          >
            <Ionicons name="add-circle" size={22} color={colors.onBrandPrimary} />
            <Body style={{ color: colors.onBrandPrimary, fontWeight: "800", marginTop: 4 }}>Add Money</Body>
          </Pressable>
          <Pressable
            testID="action-withdraw"
            onPress={() => setShowWithdraw(true)}
            style={[styles.actionBtn, { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong }]}
            disabled={(data.balance ?? 0) <= 0}
          >
            <Ionicons name="arrow-up-circle" size={22} color={(data.balance ?? 0) <= 0 ? colors.borderStrong : colors.onSurface} />
            <Body style={{ fontWeight: "800", marginTop: 4, color: (data.balance ?? 0) <= 0 ? colors.borderStrong : colors.onSurface }}>
              Withdraw
            </Body>
          </Pressable>
        </View>

        {/* Quick top-up amounts */}
        <H2 style={{ marginTop: spacing.md }}>Quick Top-up</H2>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {QUICK_TOPUP.map((amt) => (
            <Pressable
              key={amt}
              testID={`topup-${amt}`}
              onPress={() => setPayAmount(amt)}
              style={({ pressed }) => [styles.topupBtn, pressed && { opacity: 0.85 }]}
            >
              <Body style={{ fontWeight: "800", fontSize: t.lg }}>₹{amt}</Body>
              <Muted style={{ fontSize: 10, marginTop: 2 }}>UPI</Muted>
            </Pressable>
          ))}
        </View>

        {/* Badges */}
        <H2 style={{ marginTop: spacing.md }}>Your Badges</H2>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {BADGES.map((b) => {
            const earned = (data.balance ?? 0) >= b.min;
            return (
              <View key={b.id} style={[styles.badge, !earned && { opacity: 0.35 }]} testID={`badge-${b.id}`}>
                <View style={[styles.badgeIcon, { backgroundColor: b.color + "33" }]}>
                  <Ionicons name={b.icon as any} size={26} color={b.color} />
                </View>
                <Body style={{ fontWeight: "800", marginTop: 6 }}>{b.title}</Body>
                <Muted style={{ fontSize: 11 }}>₹{b.min}+ earned</Muted>
              </View>
            );
          })}
        </View>

        {/* Transactions with filter */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
          <H2>Transactions</H2>
          <Muted style={{ fontSize: 12 }}>{stats.count} entries</Muted>
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Chip testID="filter-all" label="All" selected={filter === "all"} onPress={() => setFilter("all")} />
          <Chip testID="filter-in" label="Money In" selected={filter === "in"} onPress={() => setFilter("in")} />
          <Chip testID="filter-out" label="Money Out" selected={filter === "out"} onPress={() => setFilter("out")} />
        </View>

        {filtered.length ? (
          filtered.map((tx) => {
            const amt = Number(tx.amount) || 0;
            const isCredit = amt >= 0;
            const meta = txnMeta(tx.type, isCredit);
            return (
              <Card key={tx.id} testID={`txn-${tx.id}`}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={[styles.txnIcon, { backgroundColor: meta.color + "22" }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1, marginHorizontal: 10 }}>
                    <Body style={{ fontWeight: "700" }} numberOfLines={2}>
                      {tx.note || tx.type}
                    </Body>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 3, gap: 6 }}>
                      <Muted style={{ fontSize: 11 }}>
                        {new Date(tx.created_at).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })}
                        {" · "}
                        {new Date(tx.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Muted>
                      {tx.status && tx.status !== "success" ? (
                        <View style={styles.statusPill}>
                          <Body style={{ fontSize: 10, color: colors.warning, fontWeight: "700" }}>{tx.status}</Body>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Body
                    style={{
                      color: isCredit ? colors.success : colors.error,
                      fontWeight: "800",
                      fontSize: t.lg,
                    }}
                  >
                    {isCredit ? "+" : "−"}₹{Math.abs(amt).toLocaleString()}
                  </Body>
                </View>
              </Card>
            );
          })
        ) : (
          <Card>
            <View style={{ alignItems: "center", padding: spacing.md }}>
              <Ionicons name="wallet-outline" size={40} color={colors.borderStrong} />
              <Body style={{ marginTop: 8, fontWeight: "700" }}>No transactions</Body>
              <Muted style={{ marginTop: 4, textAlign: "center" }}>
                {filter === "all"
                  ? "Add money or share your referral code to earn ₹50 per invite!"
                  : "Nothing to show for this filter."}
              </Muted>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Payment sheet for quick amounts */}
      <PaymentSheet
        visible={payAmount != null}
        onClose={() => setPayAmount(null)}
        purpose="wallet_topup"
        amount={payAmount || 0}
        title={`Add ₹${payAmount || 0} to Wallet`}
        subtitle="Instant credit via UPI"
        onSuccess={handleTopupSuccess}
      />

      {/* Custom amount modal */}
      <CustomTopupModal
        visible={showCustom}
        onClose={() => {
          setShowCustom(false);
          setCustomAmt("");
        }}
        amount={customAmt}
        setAmount={setCustomAmt}
        onProceed={(amt) => {
          setShowCustom(false);
          setPayAmount(amt);
        }}
      />

      {/* Withdraw modal */}
      <WithdrawModal
        visible={showWithdraw}
        onClose={() => setShowWithdraw(false)}
        balance={data.balance || 0}
        onSuccess={async () => {
          setShowWithdraw(false);
          await reload();
          await refresh?.();
        }}
      />
    </SafeAreaView>
  );
}

/* --------------------- Custom Top-up Modal --------------------- */

function CustomTopupModal({
  visible,
  onClose,
  amount,
  setAmount,
  onProceed,
}: {
  visible: boolean;
  onClose: () => void;
  amount: string;
  setAmount: (s: string) => void;
  onProceed: (n: number) => void;
}) {
  const num = Number(amount) || 0;
  const valid = num >= 10 && num <= 100000;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <H2>Add Money</H2>
            <Muted style={{ marginTop: 4 }}>Enter amount you want to add to your wallet</Muted>

            <View style={styles.amountBox}>
              <Body style={{ fontSize: 26, fontWeight: "800", color: colors.brand }}>₹</Body>
              <TextInput
                testID="custom-amount-input"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.borderStrong}
                style={styles.amountInput}
                autoFocus
              />
            </View>
            <Muted style={{ marginTop: 4, fontSize: 11 }}>Min ₹10 · Max ₹1,00,000</Muted>

            <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.md, flexWrap: "wrap" }}>
              {[100, 500, 1000, 2000, 5000].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setAmount(String(v))}
                  style={styles.presetChip}
                  testID={`preset-${v}`}
                >
                  <Body style={{ fontWeight: "700", color: colors.brand }}>+₹{v}</Body>
                </Pressable>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
              <View style={{ flex: 1 }}>
                <SecondaryButton label="Cancel" onPress={onClose} />
              </View>
              <View style={{ flex: 1 }}>
                <PrimaryButton
                  testID="custom-proceed"
                  label={`Add ₹${num || 0}`}
                  disabled={!valid}
                  onPress={() => onProceed(num)}
                />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* --------------------- Withdraw Modal --------------------- */

function WithdrawModal({
  visible,
  onClose,
  balance,
  onSuccess,
}: {
  visible: boolean;
  onClose: () => void;
  balance: number;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [upi, setUpi] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAmount("");
      setUpi("");
      setErr("");
      setBusy(false);
      setSuccess(false);
    }
  }, [visible]);

  const num = Number(amount) || 0;
  const validAmt = num > 0 && num <= balance;
  const validUpi = /^[\w.-]+@[\w.-]+$/.test(upi.trim());
  const canSubmit = validAmt && validUpi && !busy;

  const submit = async () => {
    setErr("");
    setBusy(true);
    try {
      await api.walletWithdraw(num, upi.trim());
      setSuccess(true);
      setTimeout(() => onSuccess(), 1000);
    } catch (e: any) {
      setErr(e?.message || "Withdrawal failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />

            {success ? (
              <View style={{ alignItems: "center", paddingVertical: spacing.lg }}>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark" size={40} color={colors.onBrandPrimary} />
                </View>
                <H2 style={{ marginTop: spacing.md }}>Withdrawal Requested</H2>
                <Muted style={{ marginTop: 6, textAlign: "center" }}>
                  ₹{num} to {upi}
                  {"\n"}Money will be credited within 24 hours.
                </Muted>
              </View>
            ) : (
              <>
                <H2>Withdraw to UPI</H2>
                <Muted style={{ marginTop: 4 }}>
                  Available balance: <Body style={{ color: colors.success, fontWeight: "800" }}>₹{balance.toLocaleString()}</Body>
                </Muted>

                <View style={{ marginTop: spacing.md }}>
                  <Field
                    testID="withdraw-amount"
                    label="Amount (₹)"
                    keyboardType="number-pad"
                    value={amount}
                    onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                  />
                  <Field
                    testID="withdraw-upi"
                    label="UPI ID"
                    value={upi}
                    onChangeText={setUpi}
                    placeholder="yourname@paytm / @okhdfcbank / @ybl"
                    autoCapitalize="none"
                  />
                  {num > balance ? (
                    <Body style={{ color: colors.error, fontSize: 12 }}>Amount exceeds available balance</Body>
                  ) : null}
                  {upi.length > 0 && !validUpi ? (
                    <Body style={{ color: colors.error, fontSize: 12 }}>Invalid UPI ID format</Body>
                  ) : null}
                  {err ? <Body style={{ color: colors.error, marginTop: 6 }}>{err}</Body> : null}
                </View>

                {/* Preset % */}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                  {[25, 50, 100].map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setAmount(String(Math.floor((balance * p) / 100)))}
                      style={styles.presetChip}
                      testID={`withdraw-pct-${p}`}
                    >
                      <Body style={{ fontWeight: "700", color: colors.brand }}>{p}%</Body>
                    </Pressable>
                  ))}
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: spacing.lg }}>
                  <View style={{ flex: 1 }}>
                    <SecondaryButton label="Cancel" onPress={onClose} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <PrimaryButton
                      testID="withdraw-submit"
                      label={busy ? "Processing…" : `Withdraw ₹${num || 0}`}
                      disabled={!canSubmit}
                      loading={busy}
                      onPress={submit}
                    />
                  </View>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.lg },
  flowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  flowCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" },
  flowDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.35)" },
  flowText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 13 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.onBrandPrimary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  refStatsRow: {
    flexDirection: "row",
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.2)",
    paddingTop: 8,
  },
  refStatCell: { flex: 1, alignItems: "center" },
  refStatValue: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 16 },
  refStatLabel: { color: colors.onBrandPrimary, opacity: 0.75, fontSize: 10, fontWeight: "700" },
  actionBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 8,
  },
  badge: {
    flex: 1,
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.lg,
  },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  topupBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.brand,
  },
  txnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    gap: 4,
  },
  modalHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  amountBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.brand,
    borderRadius: radius.md,
    padding: 12,
    marginTop: spacing.md,
    backgroundColor: colors.brandTertiary,
  },
  amountInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "800",
    color: colors.onSurface,
    marginLeft: 6,
    padding: 0,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.success,
    alignItems: "center",
    justifyContent: "center",
  },
});
