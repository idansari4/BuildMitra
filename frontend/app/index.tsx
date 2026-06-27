import React, { useEffect } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors, spacing, type } from "@/src/theme";
import { H1, Body } from "@/src/ui";

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    const t = setTimeout(() => {
      if (user?.role === "admin") router.replace("/admin/dashboard" as any);
      else if (user) router.replace("/(tabs)/home");
      else router.replace("/role-select");
    }, 800);
    return () => clearTimeout(t);
  }, [loading, user, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Image
        source="https://images.pexels.com/photos/4170184/pexels-photo-4170184.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(24,24,27,0.6)", "rgba(24,24,27,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.bottom}>
        <View style={styles.logo} testID="brand-logo">
          <H1 style={{ color: colors.onBrandPrimary, fontSize: 36 }}>BM</H1>
        </View>
        <H1 style={{ color: colors.onSurfaceInverse, marginTop: spacing.lg }}>BuildMitra</H1>
        <Body style={{ color: colors.surfaceTertiary, marginTop: 6 }}>
          India's Construction Network
        </Body>
        <ActivityIndicator color={colors.brand} style={{ marginTop: spacing.lg }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceInverse },
  bottom: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg, paddingBottom: 64, alignItems: "flex-start",
  },
  logo: {
    width: 64, height: 64, borderRadius: 18, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
});
