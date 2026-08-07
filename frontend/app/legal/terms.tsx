import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted } from "@/src/ui";

export default function Terms() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <H1 style={{ fontSize: t.lg, marginLeft: spacing.sm }}>Terms & Conditions</H1>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80, gap: spacing.md }}>
        <Muted>Effective from June 2026</Muted>
        <H2 style={{ fontSize: t.md }}>1. Acceptance</H2>
        <Body>By using BuildMitra, you agree to these terms. If you do not agree, please stop using the app.</Body>

        <H2 style={{ fontSize: t.md }}>2. Roles</H2>
        <Body>• Workers: honestly represent skills, complete accepted jobs.{"\n"}• Clients/Contractors: post genuine jobs, pay agreed wages on time.{"\n"}• BuildMitra facilitates but does not employ any user.</Body>

        <H2 style={{ fontSize: t.md }}>3. Payments & Escrow</H2>
        <Body>Job payments may be held in escrow and released after work completion. Withdrawal via UPI typically completes within 24 hours. BuildMitra charges a small platform fee on transactions.</Body>

        <H2 style={{ fontSize: t.md }}>4. Attendance</H2>
        <Body>Attendance is verified by GPS + selfie. False attendance can lead to job termination and account suspension.</Body>

        <H2 style={{ fontSize: t.md }}>5. Disputes</H2>
        <Body>Complaints filed via the app are reviewed by our support team. We may mediate but final resolution rests with the parties involved.</Body>

        <H2 style={{ fontSize: t.md }}>6. Termination</H2>
        <Body>We may suspend accounts violating these terms, involved in fraud, or reported repeatedly.</Body>

        <H2 style={{ fontSize: t.md }}>7. Contact</H2>
        <Body>Questions? Email support@buildmitra.com.</Body>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
});
