import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card } from "@/src/ui";
import { PaymentSheet } from "@/src/payment-sheet";

const BADGES = [
  { id: "bronze", title: "Bronze", min: 0, color: "#CD7F32", icon: "medal-outline" },
  { id: "silver", title: "Silver", min: 200, color: "#A1A1AA", icon: "medal" },
  { id: "gold", title: "Gold", min: 500, color: "#F59E0B", icon: "trophy" },
] as const;

export default function Wallet() {
  const [data, setData] = useState<any>({ balance: 0, referral_code: "", transactions: [] });
  const [payAmount, setPayAmount] = useState<number | null>(null);
  const { refresh } = useAuth();

  const reload = async () => { try { setData(await api.wallet()); } catch {} };
  useEffect(() => { reload(); }, []);

  const share = async () => {
    try {
      await Share.share({
        message: `Join BuildMitra with my referral code ${data.referral_code} — India's #1 construction work marketplace. Get ₹50 on signup!`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80, gap: spacing.md }}>
        <H2 testID="wallet-title">Wallet & Referrals</H2>

        <LinearGradient colors={[colors.brand, "#D97706"]} style={styles.hero}>
          <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85, fontWeight: "700" }}>TOTAL EARNINGS</Muted>
          <H1 style={{ color: colors.onBrandPrimary, fontSize: 44, marginTop: 4 }} testID="wallet-balance">
            ₹{data.balance ?? 0}
          </H1>
          <View style={{ marginTop: spacing.md, backgroundColor: "rgba(0,0,0,0.15)", padding: 12, borderRadius: radius.md }}>
            <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85, fontWeight: "700" }}>YOUR REFERRAL CODE</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <Body style={{ fontSize: 22, fontWeight: "800", color: colors.onBrandPrimary, letterSpacing: 2 }} testID="referral-code">
                {data.referral_code || "—"}
              </Body>
              <Pressable testID="share-referral" onPress={share} style={styles.shareBtn}>
                <Ionicons name="share-social" size={18} color={colors.brand} />
                <Body style={{ color: colors.brand, fontWeight: "700" }}>Share</Body>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <H2 style={{ marginTop: spacing.md }}>Add Money</H2>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[100, 500, 1000].map((amt) => (
            <Pressable
              key={amt}
              testID={`topup-${amt}`}
              onPress={() => setPayAmount(amt)}
              style={({ pressed }) => [styles.topupBtn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="add-circle" size={22} color={colors.brand} />
              <Body style={{ fontWeight: "800", fontSize: t.lg, marginTop: 4 }}>₹{amt}</Body>
              <Muted style={{ fontSize: 11 }}>via UPI</Muted>
            </Pressable>
          ))}
        </View>

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

        <H2 style={{ marginTop: spacing.md }}>Recent Transactions</H2>
        {data.transactions?.length ? data.transactions.map((tx: any) => (
          <Card key={tx.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Body style={{ fontWeight: "700" }}>{tx.note || tx.type}</Body>
                <Muted style={{ marginTop: 2 }}>{new Date(tx.created_at).toLocaleDateString()}</Muted>
              </View>
              <Body style={{ color: colors.success, fontWeight: "800", fontSize: t.lg }}>+₹{tx.amount}</Body>
            </View>
          </Card>
        )) : (
          <Muted>No transactions yet. Share your code to start earning!</Muted>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.lg },
  shareBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.onBrandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill,
  },
  badge: {
    flex: 1, alignItems: "center", padding: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg,
  },
  badgeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  topupBtn: {
    flex: 1, alignItems: "center", padding: spacing.md,
    backgroundColor: colors.brandTertiary, borderRadius: radius.lg,
    borderWidth: 2, borderColor: colors.brand,
  },
});
