import React from "react";
import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted } from "@/src/ui";

export default function PrivacyPolicy() {
  const router = useRouter();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="back-button" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <H1 style={{ fontSize: t.lg, marginLeft: spacing.sm }}>Privacy Policy</H1>
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 80, gap: spacing.md }}>
        <Muted>Last updated: June 2026</Muted>
        <H2 style={{ fontSize: t.md }}>1. Data We Collect</H2>
        <Body>BuildMitra collects your name, mobile number, city, skills, and location during check-in to enable job matching, attendance verification, and payments. We never sell your data to third parties.</Body>

        <H2 style={{ fontSize: t.md }}>2. How We Use Your Data</H2>
        <Body>• Match you with relevant jobs based on skills and location{"\n"}• Verify attendance via GPS + selfie{"\n"}• Process wallet credits and UPI withdrawals{"\n"}• Notify you about job updates and payments</Body>

        <H2 style={{ fontSize: t.md }}>3. Data Storage</H2>
        <Body>Your data is stored on secure servers in India. Passwords are hashed. Selfies are stored only for the duration required for verification.</Body>

        <H2 style={{ fontSize: t.md }}>4. Your Rights</H2>
        <Body>You can view, edit, or delete your profile data anytime. Contact us at support@buildmitra.com to request full data deletion or export.</Body>

        <H2 style={{ fontSize: t.md }}>5. Contact</H2>
        <Body>For privacy-related concerns, email support@buildmitra.com or use the in-app Help & Support option.</Body>
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
