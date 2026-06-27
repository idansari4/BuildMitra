import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, SecondaryButton } from "@/src/ui";

export default function AdminProfile() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const onLogout = async () => { await logout(); router.replace("/role-select"); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Ionicons name="shield-checkmark" size={32} color={colors.onBrandPrimary} />
          </View>
          <View style={{ flex: 1 }}>
            <H1 style={{ fontSize: t.xl }} testID="admin-name">{user?.name}</H1>
            <Muted>ADMIN · {user?.mobile}</Muted>
          </View>
        </View>

        <H2>About</H2>
        <Card>
          <Row icon="person-circle-outline" label="Role" value="Platform Admin" />
          <Row icon="business-outline" label="Company" value={user?.company_name || "BuildMitra"} />
          <Row icon="location-outline" label="HQ" value={user?.city || "—"} />
        </Card>

        <H2>Admin Powers</H2>
        <Card>
          <Bullet text="Verify worker and contractor profiles (Aadhaar gate)" />
          <Bullet text="Suspend / unsuspend any user account" />
          <Bullet text="Close any job posting" />
          <Bullet text="Resolve or reject user complaints" />
          <Bullet text="View platform-wide attendance & analytics" />
        </Card>

        <SecondaryButton testID="admin-logout" label="Logout" onPress={onLogout} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <View style={{ flex: 1, marginLeft: 12 }}><Body>{label}</Body></View>
      <Muted>{value}</Muted>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: "row", paddingVertical: 6, alignItems: "flex-start" }}>
      <Ionicons name="checkmark-circle" size={18} color={colors.success} style={{ marginTop: 2 }} />
      <Body style={{ marginLeft: 8, flex: 1 }}>{text}</Body>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceInverse,
    alignItems: "center", justifyContent: "center",
  },
  row: {
    flexDirection: "row", alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
});
