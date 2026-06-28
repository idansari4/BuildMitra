import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton, Field } from "@/src/ui";

export default function OtpLogin() {
  const router = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const { loginWithToken } = useAuth();
  const [step, setStep] = useState<"mobile" | "otp" | "signup">("mobile");
  const [mobile, setMobile] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [needsSignup, setNeedsSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const sendOtp = async () => {
    setErr("");
    if (mobile.length !== 10) { setErr("Enter a valid 10-digit mobile"); return; }
    setBusy(true);
    try {
      const r = await api.otpSend(mobile);
      if (r.dev_mode && r.dev_code) setDevCode(r.dev_code);
      setStep("otp");
    } catch (e: any) { setErr(e?.message || "Failed to send OTP"); }
    finally { setBusy(false); }
  };

  const verifyOtp = async (overrideName?: string) => {
    setErr("");
    if (code.length !== 6) { setErr("Enter 6-digit OTP"); return; }
    setBusy(true);
    try {
      const r = await api.otpVerify({
        mobile,
        code,
        name: overrideName ?? (name.trim() || undefined),
        role: roleParam || "worker",
      });
      await loginWithToken(r.token, r.user);
      if (r.user.role === "admin") router.replace("/admin/dashboard" as any);
      else router.replace("/(tabs)/home");
    } catch (e: any) {
      const msg = e?.message || "Verification failed";
      if (msg.includes("name and role required")) {
        setNeedsSignup(true);
        setStep("signup");
      } else {
        setErr(msg);
      }
    } finally { setBusy(false); }
  };

  const back = () => {
    setErr("");
    if (step === "signup") setStep("otp");
    else if (step === "otp") { setStep("mobile"); setCode(""); setDevCode(null); }
    else router.back();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={back} style={{ width: 40, height: 40, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>

          {step === "mobile" && (
            <>
              <H1 style={{ marginTop: spacing.md }}>Login with OTP</H1>
              <Muted style={{ marginTop: 6 }}>We'll send a 6-digit code to your mobile</Muted>
              <View style={{ marginTop: spacing.xl }}>
                <Field
                  testID="otp-mobile"
                  label="Mobile Number"
                  value={mobile}
                  onChangeText={(v) => setMobile(v.replace(/\D/g, "").slice(0, 10))}
                  keyboardType="phone-pad"
                  placeholder="10-digit mobile"
                />
                {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
              </View>
            </>
          )}

          {step === "otp" && (
            <>
              <H1 style={{ marginTop: spacing.md }}>Enter OTP</H1>
              <Muted style={{ marginTop: 6 }}>Sent to +91 {mobile}</Muted>
              {devCode && (
                <View style={styles.devBanner} testID="dev-otp-banner">
                  <Ionicons name="information-circle" size={18} color={colors.brand} />
                  <Body style={{ flex: 1, marginLeft: 8, fontWeight: "700" }}>
                    DEV MODE — Your code: {devCode}
                  </Body>
                </View>
              )}
              <View style={{ marginTop: spacing.xl }}>
                <Field
                  testID="otp-code"
                  label="6-digit OTP"
                  value={code}
                  onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  placeholder="123456"
                />
                {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
                <Pressable testID="resend-otp" onPress={sendOtp}>
                  <Body style={{ color: colors.brand, fontWeight: "700", marginTop: 4 }}>Resend OTP</Body>
                </Pressable>
              </View>
            </>
          )}

          {step === "signup" && (
            <>
              <H1 style={{ marginTop: spacing.md }}>One last step</H1>
              <Muted style={{ marginTop: 6 }}>Tell us your name to create your account</Muted>
              <View style={{ marginTop: spacing.xl }}>
                <Field testID="signup-name" label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" />
                <Muted>Joining as: {String(roleParam || "worker").toUpperCase()}</Muted>
                {err ? <Body style={{ color: colors.error, marginTop: 8 }}>{err}</Body> : null}
              </View>
            </>
          )}
        </ScrollView>
        <View style={styles.cta}>
          {step === "mobile" && <PrimaryButton testID="send-otp-btn" label="Send OTP" icon="send" loading={busy} onPress={sendOtp} />}
          {step === "otp" && <PrimaryButton testID="verify-otp-btn" label="Verify & Continue" icon="checkmark-circle" loading={busy} onPress={() => verifyOtp()} />}
          {step === "signup" && (
            <PrimaryButton
              testID="signup-finish-btn"
              label="Create Account"
              icon="person-add"
              loading={busy}
              onPress={() => {
                if (!name.trim()) { setErr("Enter your name"); return; }
                verifyOtp(name.trim());
              }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  devBanner: {
    flexDirection: "row", alignItems: "center", marginTop: spacing.md,
    padding: 12, borderRadius: radius.md, backgroundColor: colors.brandTertiary,
    borderWidth: 1, borderColor: colors.brand,
  },
  cta: {
    padding: spacing.md, paddingBottom: spacing.xl,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
});
