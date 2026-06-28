import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, FlatList, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

export default function ChatList() {
  const router = useRouter();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setThreads(await api.chatThreads()); } catch {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="chat-list-back" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Messages</H2>
        <View style={{ width: 40 }} />
      </View>
      <FlatList
        data={threads}
        keyExtractor={(th) => th.thread_id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: 8 }}
        ListEmptyComponent={
          loading ? <ActivityIndicator color={colors.brand} style={{ marginTop: 60 }} /> :
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Ionicons name="chatbubbles-outline" size={56} color={colors.borderStrong} />
            <Body style={{ marginTop: 12 }}>No conversations yet</Body>
            <Muted style={{ marginTop: 4, textAlign: "center" }}>Tap chat icon on any job to start.</Muted>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            testID={`thread-${item.peer_id}`}
            onPress={() => router.push({ pathname: "/chat/[peerId]", params: { peerId: item.peer_id, peerName: item.peer_name } } as any)}
          >
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={styles.avatar}>
                  <Body style={{ fontWeight: "800", color: colors.onBrandPrimary }}>{item.peer_name?.[0]?.toUpperCase()}</Body>
                </View>
                <View style={{ flex: 1 }}>
                  <Body style={{ fontWeight: "700" }}>{item.peer_name}</Body>
                  <Muted numberOfLines={1} style={{ marginTop: 2 }}>{item.last_text}</Muted>
                </View>
                <Muted style={{ fontSize: 11 }}>{new Date(item.last_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Muted>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
