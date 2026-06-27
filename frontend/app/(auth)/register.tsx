import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { colors, spacing } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton, Field } from "@/src/ui";

export default function Register() {
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role?: string }>();
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!name.trim() || mobile.length < 10 || password.length < 4) {
      setErr("Fill all fields. Mobile 10 digits, password 4+ chars.");
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), mobile, password, role: role || "worker" });
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>
          <H1 style={{ marginTop: spacing.md }}>Create Account</H1>
          <Muted style={{ marginTop: 6 }}>Joining as: {String(role || "worker").toUpperCase()}</Muted>

          <View style={{ marginTop: spacing.xl }}>
            <Field testID="reg-name" label="Full Name" value={name} onChangeText={setName} placeholder="e.g. Ramesh Kumar" />
            <Field testID="reg-mobile" label="Mobile Number" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" placeholder="10-digit mobile" />
            <Field testID="reg-password" label="Password" value={password} onChangeText={setPassword} secureTextEntry placeholder="min 4 chars" />
            {err ? <Body style={{ color: colors.error, marginBottom: 8 }}>{err}</Body> : null}
          </View>
        </ScrollView>
        <View style={styles.cta}>
          <PrimaryButton testID="register-submit" label="Create Account" loading={loading} onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
