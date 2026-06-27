import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { colors, spacing, type } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton, Field } from "@/src/ui";

export default function Login() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { login } = useAuth();
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const submit = async () => {
    setErr("");
    if (mobile.length < 10 || password.length < 4) {
      setErr("Enter a valid mobile and password (min 4 chars)");
      return;
    }
    setLoading(true);
    try {
      const u = await login(mobile, password);
      if (u.role === "admin") router.replace("/admin/dashboard" as any);
      else router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (m: string) => { setMobile(m); setPassword("demo1234"); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>
          <H1 style={{ marginTop: spacing.md }}>Login</H1>
          <Muted style={{ marginTop: 6 }}>Use your registered mobile number</Muted>

          <View style={{ marginTop: spacing.xl }}>
            <Field testID="login-mobile" label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Field testID="login-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="••••••••" />
            {err ? <Body style={{ color: colors.error, marginBottom: 8 }}>{err}</Body> : null}
          </View>

          <View style={styles.demoBox}>
            <Muted style={{ fontWeight: "700", color: colors.onSurface }}>Demo accounts (password: demo1234)</Muted>
            <Pressable testID="demo-worker" onPress={() => fillDemo("9000000002")} style={styles.demoRow}>
              <Ionicons name="hammer-outline" size={18} color={colors.brand} />
              <Body>Worker — 9000000002</Body>
            </Pressable>
            <Pressable testID="demo-client" onPress={() => fillDemo("9000000001")} style={styles.demoRow}>
              <Ionicons name="business-outline" size={18} color={colors.brand} />
              <Body>Client — 9000000001</Body>
            </Pressable>
            <Pressable testID="demo-contractor" onPress={() => fillDemo("9000000003")} style={styles.demoRow}>
              <Ionicons name="people-outline" size={18} color={colors.brand} />
              <Body>Contractor — 9000000003</Body>
            </Pressable>
            <Pressable
              testID="demo-admin"
              onPress={() => { setMobile("9000000000"); setPassword("admin1234"); }}
              style={styles.demoRow}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.brand} />
              <Body>Admin — 9000000000 (pw: admin1234)</Body>
            </Pressable>
          </View>

          <Pressable testID="goto-register" onPress={() => router.push({ pathname: "/(auth)/register", params: { role: role || "worker" } } as any)}>
            <Body style={{ marginTop: spacing.lg, textAlign: "center", color: colors.onSurfaceSecondary }}>
              New here? <Body style={{ color: colors.brand, fontWeight: "700" }}>Create account</Body>
            </Body>
          </Pressable>
        </ScrollView>
        <View style={styles.cta}>
          <PrimaryButton testID="login-submit" label="Login" loading={loading} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  demoBox: {
    marginTop: spacing.lg, padding: spacing.md, borderRadius: 14,
    backgroundColor: colors.brandTertiary, gap: 8,
  },
  demoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  cta: {
    padding: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
});
