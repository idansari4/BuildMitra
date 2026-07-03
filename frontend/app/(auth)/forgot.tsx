import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { H1, H2, Body, Muted, PrimaryButton, Field } from "@/src/ui";

export default function Forgot() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);

  const sendOtp = async () => {
    setErr(""); setMsg("");
    if (!/^\d{10}$/.test(mobile)) { setErr("Enter valid 10-digit mobile"); return; }
    setBusy(true);
    try {
      const r: any = await api.forgotPassword(mobile);
      setDevCode(r?.dev_code || null);
      setStep(2);
      setMsg("OTP sent \u2713");
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const reset = async () => {
    setErr(""); setMsg("");
    if (!/^\d{6}$/.test(otp)) { setErr("Enter 6-digit OTP"); return; }
    if (pw.length < 4) { setErr("Password must be at least 4 chars"); return; }
    if (pw !== pw2) { setErr("Passwords don't match"); return; }
    setBusy(true);
    try {
      await api.resetPassword(mobile, otp, pw);
      setMsg("Password reset \u2713 Redirecting to login...");
      setTimeout(() => router.replace("/(auth)/login" as any), 1100);
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="forgot-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Forgot Password</H2>
        <View style={{ width: 40 }} />
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Ionicons name={step === 1 ? "lock-closed" : "key"} size={44} color={colors.brand} />
            <H1 style={{ marginTop: 8, textAlign: "center", fontSize: 22 }}>
              {step === 1 ? "Verify your mobile" : "Set new password"}
            </H1>
            <Muted style={{ marginTop: 6, textAlign: "center" }}>
              {step === 1 ? "We'll send a 6-digit OTP" : "Enter the OTP you received and choose a new password"}
            </Muted>
          </View>

          {step === 1 ? (
            <>
              <Field
                testID="forgot-mobile"
                label="Mobile Number"
                value={mobile}
                onChangeText={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))}
                keyboardType="number-pad"
                placeholder="9XXXXXXXXX"
              />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
              {msg ? <Body style={{ color: colors.success, fontWeight: "700" }}>{msg}</Body> : null}
              <PrimaryButton testID="send-otp" label="Send OTP" icon="send" loading={busy} onPress={sendOtp} />
            </>
          ) : (
            <>
              <Field
                testID="forgot-otp"
                label="OTP"
                value={otp}
                onChangeText={(v) => setOtp(v.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                placeholder="6-digit code"
              />
              {devCode ? (
                <View style={styles.devHint}>
                  <Ionicons name="information-circle" size={16} color={colors.brand} />
                  <Muted style={{ marginLeft: 6 }}>Dev OTP: <Body style={{ fontWeight: "800", color: colors.brand }}>{devCode}</Body></Muted>
                </View>
              ) : null}
              <Field testID="forgot-new-pw" label="New Password" value={pw} onChangeText={setPw} secureTextEntry />
              <Field testID="forgot-confirm-pw" label="Confirm Password" value={pw2} onChangeText={setPw2} secureTextEntry />
              {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
              {msg ? <Body style={{ color: colors.success, fontWeight: "700" }}>{msg}</Body> : null}
              <PrimaryButton testID="reset-submit" label="Reset Password" icon="checkmark-circle" loading={busy} onPress={reset} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  hero: { alignItems: "center", padding: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.lg },
  devHint: { flexDirection: "row", alignItems: "center", padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary, marginTop: -6 },
});
