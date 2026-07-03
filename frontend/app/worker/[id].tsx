import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as tt } from "@/src/theme";
import { H1, H2, Body, Muted, Card } from "@/src/ui";

export default function WorkerProfile() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [w, setW] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try { setW(await api.workerProfile(id)); }
      catch (e: any) { setErr(e?.message || "Failed"); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const startChat = () => {
    if (!w || !user || user.id === w.id) return;
    router.push({ pathname: "/chat/[peerId]", params: { peerId: w.id, peerName: w.name } } as any);
  };
  const callWorker = () => w?.mobile && Linking.openURL(`tel:+91${w.mobile}`).catch(() => {});
  const whatsappWorker = () => w?.mobile && Linking.openURL(`https://wa.me/91${w.mobile}`).catch(() => {});

  if (loading) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} />
    </SafeAreaView>
  );
  if (!w) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center" }}>
      <Body>{err || "Worker not found"}</Body>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="worker-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Worker Profile</H2>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}>
        <View style={styles.top}>
          {w.photo ? (
            <Image source={{ uri: w.photo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }]}>
              <Body style={{ color: colors.onBrandPrimary, fontSize: 36, fontWeight: "800" }}>{w.name?.[0]?.toUpperCase()}</Body>
            </View>
          )}
          <H1 style={{ marginTop: spacing.sm, textAlign: "center" }} testID="worker-name">{w.name}</H1>
          <View style={{ flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 }}>
            <Ionicons name="star" size={16} color={colors.brand} />
            <Body style={{ fontWeight: "700" }}>{(w.rating_avg || 0).toFixed(1)}</Body>
            <Muted>· {w.rating_count || 0} reviews</Muted>
          </View>
          {w.aadhaar_verified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="shield-checkmark" size={14} color={colors.success} />
              <Body style={{ color: colors.success, fontSize: 12, fontWeight: "800", marginLeft: 4 }}>Aadhaar Verified</Body>
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <StatCard label="Experience" value={`${w.experience_years || 0} yrs`} icon="briefcase" />
          <StatCard label="Wage/day" value={`₹${w.daily_wage || 0}`} icon="cash" />
          <StatCard label="Days worked" value={String(w.attendance_days || 0)} icon="calendar" />
        </View>

        <Card>
          <Body style={{ fontWeight: "700", marginBottom: 8 }}>Skills</Body>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {(w.skills || []).length === 0 ? <Muted>No skills listed</Muted> :
              (w.skills || []).map((s: string) => (
                <View key={s} style={styles.skillPill}><Body style={{ color: colors.brand, fontWeight: "700", fontSize: 12 }}>{s}</Body></View>
              ))
            }
          </View>
        </Card>

        <Card>
          <Body style={{ fontWeight: "700", marginBottom: 6 }}>Location</Body>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="location" size={14} color={colors.brand} />
            <Body>{w.city || "Not set"}</Body>
          </View>
        </Card>

        {w.recent_ratings?.length > 0 && (
          <View>
            <Body style={{ fontWeight: "700", marginBottom: 8 }}>Recent Ratings</Body>
            {w.recent_ratings.slice(0, 5).map((r: any, i: number) => (
              <Card key={i} style={{ marginBottom: 6 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {[1,2,3,4,5].map((n) => (
                    <Ionicons key={n} name={n <= r.stars ? "star" : "star-outline"} size={12} color={colors.brand} />
                  ))}
                </View>
                {r.comment ? <Muted style={{ marginTop: 4 }}>{r.comment}</Muted> : null}
              </Card>
            ))}
          </View>
        )}

        {user && user.id !== w.id && (
          <View style={{ flexDirection: "row", gap: 8, marginTop: spacing.sm }}>
            <Pressable testID="chat-worker" onPress={startChat} style={[styles.actionBtn, { backgroundColor: colors.brand }]}>
              <Ionicons name="chatbubble" size={18} color="#FFF" />
              <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Chat</Body>
            </Pressable>
            <Pressable testID="call-worker" onPress={callWorker} style={[styles.actionBtn, { backgroundColor: colors.success }]}>
              <Ionicons name="call" size={18} color="#FFF" />
              <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Call</Body>
            </Pressable>
            <Pressable testID="wa-worker" onPress={whatsappWorker} style={[styles.actionBtn, { backgroundColor: "#25D366" }]}>
              <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
              <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>WhatsApp</Body>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: any }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.brand} />
      <Body style={{ fontWeight: "800", fontSize: tt.lg, marginTop: 4 }}>{value}</Body>
      <Muted style={{ fontSize: 11 }}>{label}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  top: { alignItems: "center", padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.lg },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", marginTop: 8, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "#DCFCE7", borderRadius: radius.pill },
  stat: { flex: 1, alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  skillPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: radius.md },
});
