import React, { useState } from "react";
import { View, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, type } from "@/src/theme";
import { H1, Body, Muted, PrimaryButton } from "@/src/ui";

export default function RoleSelect() {
  const router = useRouter();
  const { t } = useT();
  const [selected, setSelected] = useState<string>("worker");

  const ROLES = [
    { id: "worker", icon: "hammer-outline", title: t("role.worker"), desc: t("role.worker.desc") },
    { id: "contractor", icon: "people-outline", title: t("role.contractor"), desc: t("role.contractor.desc") },
    { id: "client", icon: "business-outline", title: t("role.client"), desc: t("role.client.desc") },
  ] as const;

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + 80 }}>
        <H1>{t("role.title")}</H1>
        <Muted style={{ marginTop: 6, fontSize: type.base }}>{t("role.subtitle")}</Muted>

        <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
          {ROLES.map((r) => {
            const on = selected === r.id;
            return (
              <Pressable
                key={r.id}
                testID={`role-${r.id}`}
                onPress={() => setSelected(r.id)}
                style={[styles.card, on && styles.cardOn]}
              >
                <View style={[styles.iconCircle, on && { backgroundColor: colors.brand }]}>
                  <Ionicons name={r.icon as any} size={26} color={on ? colors.onBrandPrimary : colors.onBrandTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700", fontSize: type.lg }}>{r.title}</Body>
                  <Muted style={{ marginTop: 4 }}>{r.desc}</Muted>
                </View>
                <Ionicons
                  name={on ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={on ? colors.brand : colors.borderStrong}
                />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <View style={styles.stickyCTA}>
        <PrimaryButton
          testID="continue-button"
          label={t("common.continue")}
          icon="arrow-forward"
          onPress={() => router.push({ pathname: "/(auth)/login", params: { role: selected } } as any)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  card: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 2, borderColor: "transparent",
  },
  cardOn: { borderColor: colors.brand, backgroundColor: colors.brandTertiary },
  iconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  stickyCTA: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    padding: spacing.md, paddingBottom: spacing.xl,
    backgroundColor: colors.surface,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
});
