// Reusable UX components for BuildMitra
// - <EmptyState>: illustrated empty view with optional CTA
// - <LoadingScreen>: full-screen centered loader
// - <ErrorScreen>: user-friendly error view with retry
// - <SkeletonCard>: shimmer placeholder for list rows
// - <FadeIn>: simple fade + slide-in animation wrapper

import React, { useEffect, useRef } from "react";
import { View, StyleSheet, ActivityIndicator, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius } from "@/src/theme";
import { H1, H2, Body, Muted, PrimaryButton } from "@/src/ui";

// ---------- EmptyState ----------
type EmptyProps = {
  icon?: any;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
};
export function EmptyState({ icon = "file-tray-outline", title, subtitle, actionLabel, onAction, testID }: EmptyProps) {
  return (
    <View style={styles.emptyWrap} testID={testID || "empty-state"}>
      <View style={styles.emptyIconBg}>
        <Ionicons name={icon} size={44} color={colors.brand} />
      </View>
      <H2 style={{ marginTop: spacing.md, textAlign: "center" }}>{title}</H2>
      {subtitle ? <Muted style={{ marginTop: 6, textAlign: "center", maxWidth: 280 }}>{subtitle}</Muted> : null}
      {actionLabel && onAction ? (
        <View style={{ marginTop: spacing.md, width: "80%", maxWidth: 300 }}>
          <PrimaryButton label={actionLabel} onPress={onAction} icon="add" />
        </View>
      ) : null}
    </View>
  );
}

// ---------- LoadingScreen ----------
export function LoadingScreen({ label }: { label?: string }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="loading-screen">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 10 }}>
        <ActivityIndicator size="large" color={colors.brand} />
        {label ? <Muted>{label}</Muted> : null}
      </View>
    </SafeAreaView>
  );
}

// ---------- ErrorScreen ----------
export function ErrorScreen({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]} testID="error-screen">
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: 12 }}>
        <View style={[styles.emptyIconBg, { backgroundColor: "#FEE2E2" }]}>
          <Ionicons name="warning" size={44} color={colors.error} />
        </View>
        <H1 style={{ textAlign: "center", fontSize: 20, marginTop: spacing.md }}>Something went wrong</H1>
        <Body style={{ textAlign: "center", color: colors.onSurfaceSecondary }}>
          {message || "Please check your connection and try again."}
        </Body>
        {onRetry ? (
          <View style={{ marginTop: 12, width: "80%", maxWidth: 300 }}>
            <PrimaryButton label="Retry" icon="refresh" onPress={onRetry} />
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

// ---------- SkeletonCard ----------
export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const shimmer = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 800, useNativeDriver: true, easing: Easing.linear }),
        Animated.timing(shimmer, { toValue: 0, duration: 800, useNativeDriver: true, easing: Easing.linear }),
      ])
    ).start();
  }, [shimmer]);
  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <View style={styles.skel} testID="skeleton-card">
      {Array.from({ length: lines }).map((_, i) => (
        <Animated.View
          key={i}
          style={[
            styles.skelBar,
            { opacity, width: i === lines - 1 ? "45%" : i === 0 ? "80%" : "100%" },
          ]}
        />
      ))}
    </View>
  );
}

export function SkeletonList({ rows = 4 }: { rows?: number }) {
  return (
    <View style={{ padding: spacing.md, gap: spacing.sm }}>
      {Array.from({ length: rows }).map((_, i) => <SkeletonCard key={i} />)}
    </View>
  );
}

// ---------- FadeIn animation wrapper ----------
export function FadeIn({ children, delay = 0, style }: { children: any; delay?: number; style?: any }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 350,
      delay,
      useNativeDriver: true,
      easing: Easing.out(Easing.cubic),
    }).start();
  }, [anim, delay]);
  const opacity = anim;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] });
  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  emptyWrap: {
    flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: 8,
  },
  emptyIconBg: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  skel: {
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, gap: 8,
  },
  skelBar: {
    height: 12, borderRadius: 6, backgroundColor: colors.surfaceSecondary,
  },
});
