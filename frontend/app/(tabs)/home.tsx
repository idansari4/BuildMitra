import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, FlatList, Pressable, RefreshControl, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, SKILLS, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Chip, Card } from "@/src/ui";

export default function Home() {
  const router = useRouter();
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [aiMatch, setAiMatch] = useState<{ summary: string; top_job_ids: string[] } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = user?.role === "worker" || !user ? await api.jobs(skill || undefined) : await api.myJobs();
      setJobs(data);
    } catch {}
    setLoading(false);
  }, [skill, user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const runAiMatch = async () => {
    setAiLoading(true);
    try {
      const r = await api.aiMatch();
      setAiMatch(r);
    } catch (e: any) {
      setAiMatch({ summary: "AI match unavailable right now.", top_job_ids: [] });
    } finally { setAiLoading(false); }
  };

  const isWorker = user?.role === "worker";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Muted>Welcome back</Muted>
          <H2 testID="home-greeting">Hi, {user?.name?.split(" ")[0]}</H2>
        </View>
        <View style={styles.badge}>
          <Ionicons name="location" size={14} color={colors.brand} />
          <Body style={{ fontWeight: "700", fontSize: t.sm }}>{user?.city || "India"}</Body>
        </View>
      </View>

      {isWorker && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip testID="skill-all" label="All" selected={!skill} onPress={() => setSkill(null)} />
          {SKILLS.map((s) => (
            <Chip key={s} testID={`skill-${s}`} label={s} selected={skill === s} onPress={() => setSkill(s)} />
          ))}
        </ScrollView>
      )}

      <FlatList
        data={jobs}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          isWorker ? (
            <Pressable testID="ai-match-card" onPress={runAiMatch} style={{ marginBottom: spacing.sm }}>
              <LinearGradient colors={[colors.brand, "#D97706"]} style={styles.aiCard}>
                <Ionicons name="sparkles" size={24} color={colors.onBrandPrimary} />
                <View style={{ flex: 1 }}>
                  <Body style={{ color: colors.onBrandPrimary, fontWeight: "800" }}>AI Job Match</Body>
                  <Muted style={{ color: colors.onBrandPrimary, opacity: 0.85 }}>
                    {aiLoading ? "Finding best jobs..." : aiMatch ? aiMatch.summary : "Tap to find your best-fit jobs"}
                  </Muted>
                </View>
                {aiLoading ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="arrow-forward-circle" size={28} color={colors.onBrandPrimary} />}
              </LinearGradient>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} />
          ) : (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Ionicons name="briefcase-outline" size={56} color={colors.borderStrong} />
              <Body style={{ marginTop: 12 }}>{isWorker ? "No jobs found." : "No jobs posted yet."}</Body>
              <Muted style={{ marginTop: 4 }}>{isWorker ? "Try a different skill." : "Tap + Post Job to begin."}</Muted>
            </View>
          )
        }
        renderItem={({ item }) => {
          const highlight = aiMatch?.top_job_ids?.includes(item.id);
          return (
            <Pressable testID={`job-${item.id}`} onPress={() => router.push(`/job/${item.id}` as any)}>
              <Card style={highlight ? { borderColor: colors.brand, borderWidth: 2 } : undefined}>
                {highlight && (
                  <View style={styles.aiTag}>
                    <Ionicons name="sparkles" size={12} color={colors.onBrandPrimary} />
                    <Body style={{ fontSize: 11, color: colors.onBrandPrimary, fontWeight: "800" }}>AI MATCH</Body>
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Body style={{ fontWeight: "700", fontSize: t.lg }}>{item.title}</Body>
                    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 }}>
                      <Ionicons name="location-outline" size={14} color={colors.onSurfaceSecondary} />
                      <Muted>{item.location}</Muted>
                    </View>
                  </View>
                  <View style={styles.wage}>
                    <Body style={{ fontWeight: "800", color: colors.onBrandPrimary }}>₹{item.daily_wage}</Body>
                    <Body style={{ fontSize: 10, color: colors.onBrandPrimary }}>per day</Body>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <View style={styles.tagSkill}><Body style={{ fontSize: t.sm, fontWeight: "700" }}>{item.skill}</Body></View>
                  <View style={styles.tagInfo}><Body style={{ fontSize: t.sm }}>{item.workers_needed} workers</Body></View>
                  {item.urgency === "Urgent" && (
                    <View style={styles.tagUrgent}><Body style={{ fontSize: t.sm, fontWeight: "700", color: colors.onError }}>Urgent</Body></View>
                  )}
                  {!isWorker && (
                    <View style={styles.tagInfo}><Body style={{ fontSize: t.sm }}>{item.applicants_count} applied</Body></View>
                  )}
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm,
  },
  badge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.brandTertiary,
  },
  chipRow: { paddingHorizontal: spacing.md, gap: 8, height: 56, alignItems: "center" },
  aiCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: spacing.md, borderRadius: radius.lg,
  },
  aiTag: {
    position: "absolute", top: -10, right: 12, paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: colors.brand, borderRadius: radius.sm, flexDirection: "row", gap: 4, alignItems: "center",
  },
  wage: {
    backgroundColor: colors.brand, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: radius.md, alignItems: "center",
  },
  tagSkill: { backgroundColor: colors.brandTertiary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  tagInfo: { backgroundColor: colors.surfaceSecondary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  tagUrgent: { backgroundColor: colors.error, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
});
