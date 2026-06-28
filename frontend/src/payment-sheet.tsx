import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, PrimaryButton, SecondaryButton } from "@/src/ui";

type Props = {
  visible: boolean;
  onClose: () => void;
  purpose: "wallet_topup" | "erp_pro" | "erp_enterprise";
  amount?: number;
  title: string;
  subtitle?: string;
  onSuccess?: (resp: any) => void;
};

export function PaymentSheet({ visible, onClose, purpose, amount, title, subtitle, onSuccess }: Props) {
  const [step, setStep] = useState<"confirm" | "processing" | "success" | "error">("confirm");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [err, setErr] = useState("");

  const reset = () => { setStep("confirm"); setOrder(null); setErr(""); setBusy(false); };
  const handleClose = () => { reset(); onClose(); };

  const startPayment = async () => {
    setBusy(true); setErr("");
    try {
      const o = await api.createOrder({ purpose, amount_inr: amount || 0 });
      setOrder(o);
      setStep("processing");
      // In dev_mode, auto-verify after a short delay to simulate UPI app flow
      if (o.dev_mode) {
        setTimeout(async () => {
          try {
            const r = await api.verifyPayment({ order_id: o.order_id });
            setStep("success");
            onSuccess?.(r);
          } catch (e: any) {
            setErr(e?.message || "Verification failed");
            setStep("error");
          }
        }, 1800);
      } else {
        // PROD: open Razorpay Checkout — this would launch WebView with HTML payment form
        // For now, surface a clear message that prod flow needs WebView component
        setErr("Production Razorpay checkout requires WebView integration. Switch to dev mode for testing.");
        setStep("error");
      }
    } catch (e: any) {
      setErr(e?.message || "Could not start payment");
      setStep("error");
    } finally { setBusy(false); }
  };

  const finalAmount = amount || (purpose === "erp_pro" ? 299 : purpose === "erp_enterprise" ? 999 : 0);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable testID="pay-close" onPress={handleClose}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
          <H2>Payment</H2>
          <View style={{ width: 26 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
          {step === "confirm" && (
            <>
              <LinearGradient colors={[colors.brand, "#D97706"]} style={styles.hero}>
                <Ionicons name="card" size={36} color={colors.onBrandPrimary} />
                <H1 style={{ color: colors.onBrandPrimary, marginTop: spacing.md }}>{title}</H1>
                {subtitle ? <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85, marginTop: 4 }}>{subtitle}</Muted> : null}
                <Body style={{ color: colors.onBrandPrimary, fontSize: 44, fontWeight: "800", marginTop: spacing.lg }} testID="pay-amount">
                  ₹{finalAmount}
                </Body>
              </LinearGradient>

              <Card style={{ marginTop: spacing.md }}>
                <Row icon="phone-portrait" label="UPI" hint="GPay / PhonePe / Paytm" />
                <Row icon="card" label="Cards" hint="Visa / Mastercard / RuPay" />
                <Row icon="wallet" label="Net Banking" hint="All major banks" />
                <Row icon="shield-checkmark" label="Secure" hint="256-bit SSL via Razorpay" />
              </Card>

              <View style={styles.devNote}>
                <Ionicons name="information-circle" size={18} color={colors.brand} />
                <Muted style={{ flex: 1, marginLeft: 8 }}>
                  Dev mode — payment will be simulated successfully. Plug real Razorpay keys into backend env to enable live checkout.
                </Muted>
              </View>
            </>
          )}

          {step === "processing" && (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.brand} />
              <H2 style={{ marginTop: spacing.lg }}>Processing...</H2>
              <Muted style={{ marginTop: 6 }}>Opening UPI app · simulating payment</Muted>
              {order && <Muted style={{ marginTop: spacing.md, fontSize: 11 }}>Order {order.razorpay_order_id}</Muted>}
            </View>
          )}

          {step === "success" && (
            <View style={styles.centered}>
              <View style={styles.successCircle}>
                <Ionicons name="checkmark" size={56} color="#FFF" />
              </View>
              <H1 style={{ marginTop: spacing.lg, color: colors.success }}>Payment Successful</H1>
              <Muted style={{ marginTop: 6, textAlign: "center" }}>
                {purpose === "wallet_topup" ? `₹${finalAmount} added to your wallet` :
                 purpose === "erp_pro" ? "ERP Pro activated for 30 days" :
                 "ERP Enterprise activated for 30 days"}
              </Muted>
            </View>
          )}

          {step === "error" && (
            <View style={styles.centered}>
              <View style={[styles.successCircle, { backgroundColor: colors.error }]}>
                <Ionicons name="close" size={56} color="#FFF" />
              </View>
              <H1 style={{ marginTop: spacing.lg, color: colors.error }}>Payment Failed</H1>
              <Muted style={{ marginTop: 6, textAlign: "center" }}>{err}</Muted>
            </View>
          )}
        </ScrollView>

        <View style={styles.cta}>
          {step === "confirm" && (
            <PrimaryButton testID="pay-now" label={`Pay ₹${finalAmount} via UPI`} icon="phone-portrait" loading={busy} onPress={startPayment} />
          )}
          {step === "success" && (
            <PrimaryButton testID="pay-done" label="Done" icon="checkmark-done" onPress={handleClose} />
          )}
          {step === "error" && (
            <View style={{ gap: 10 }}>
              <PrimaryButton testID="pay-retry" label="Try Again" icon="refresh" onPress={reset} />
              <SecondaryButton testID="pay-cancel" label="Cancel" onPress={handleClose} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function Row({ icon, label, hint }: { icon: any; label: string; hint: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Body style={{ fontWeight: "700" }}>{label}</Body>
        <Muted style={{ fontSize: 11 }}>{hint}</Muted>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  hero: { padding: spacing.lg, borderRadius: radius.lg, alignItems: "flex-start" },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  devNote: { flexDirection: "row", alignItems: "flex-start", marginTop: spacing.md, padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTertiary },
  centered: { alignItems: "center", marginTop: spacing.xxl },
  successCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
