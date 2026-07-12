import React, { useState } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, spacing, radius, type } from "@/src/theme";
import { H1, H2, Body, Muted, PrimaryButton, Field } from "@/src/ui";

type Role = "worker" | "contractor" | "client";

const ROLE_META: {
  key: Role;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  descKey: string;
}[] = [
  { key: "worker", icon: "hammer", labelKey: "role.worker", descKey: "role.worker.desc" },
  { key: "contractor", icon: "people", labelKey: "role.contractor", descKey: "role.contractor.desc" },
  { key: "client", icon: "business", labelKey: "role.client", descKey: "role.client.desc" },
];

export default function Register() {
  const router = useRouter();
  const { role: roleParam } = useLocalSearchParams<{ role?: string }>();
  const { register } = useAuth();
  const { t } = useT();

  const initialRole = (["worker", "contractor", "client"] as const).includes(roleParam as Role)
    ? (roleParam as Role)
    : "worker";

  const [role, setRole] = useState<Role>(initialRole);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!role) {
      setErr(t("auth.roleRequired"));
      return;
    }
    if (!name.trim() || mobile.length < 10 || password.length < 4) {
      setErr(t("auth.fillAll"));
      return;
    }
    setLoading(true);
    try {
      await register({ name: name.trim(), mobile, password, role });
      router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
          <Pressable testID="back-button" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>

          <H1 style={{ marginTop: spacing.md }}>{t("auth.createTitle")}</H1>
          <Muted style={{ marginTop: 6 }}>{t("auth.selectRoleSub")}</Muted>

          {/* Role selector cards */}
          <View style={{ marginTop: spacing.lg }}>
            <H2 style={{ marginBottom: spacing.sm, fontSize: type.lg }}>{t("auth.selectRole")}</H2>
            <View style={{ gap: 10 }}>
              {ROLE_META.map((r) => {
                const selected = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    testID={`role-${r.key}`}
                    onPress={() => setRole(r.key)}
                    style={[styles.roleCard, selected && styles.roleCardSelected]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={[styles.roleIcon, selected && styles.roleIconSelected]}>
                      <Ionicons
                        name={r.icon}
                        size={24}
                        color={selected ? colors.onBrandPrimary : colors.brand}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: "800", color: colors.onSurface }}>
                        {t(r.labelKey)}
                      </Body>
                      <Muted style={{ marginTop: 2, fontSize: type.sm }}>
                        {t(r.descKey)}
                      </Muted>
                    </View>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? (
                        <Ionicons name="checkmark" size={16} color={colors.onBrandPrimary} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Form fields */}
          <View style={{ marginTop: spacing.xl }}>
            <Field
              testID="reg-name"
              label={t("auth.fullName")}
              value={name}
              onChangeText={setName}
              placeholder={t("auth.namePlaceholder")}
            />
            <Field
              testID="reg-mobile"
              label={t("auth.mobile")}
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              placeholder={t("auth.mobilePlaceholder")}
            />
            <Field
              testID="reg-password"
              label={t("auth.password")}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder={t("auth.minPw")}
            />
            {err ? <Body style={{ color: colors.error, marginBottom: 8 }}>{err}</Body> : null}
          </View>
        </ScrollView>
        <View style={styles.cta}>
          <PrimaryButton
            testID="register-submit"
            label={t("auth.createAccount")}
            loading={loading}
            onPress={submit}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  roleCardSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
  roleIconSelected: {
    backgroundColor: colors.brand,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  radioSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brand,
  },
  cta: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
