import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted } from "@/src/ui";

export default function ChatThread() {
  const router = useRouter();
  const { peerId, peerName } = useLocalSearchParams<{ peerId: string; peerName?: string }>();
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!peerId) return;
    try {
      const m = await api.chatMessages(peerId);
      setMsgs(m);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {}
  }, [peerId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const i = setInterval(load, 4000); return () => clearInterval(i); }, [load]);

  const send = async () => {
    if (!text.trim() || !peerId) return;
    setSending(true);
    try { await api.chatSend(peerId, text.trim()); setText(""); await load(); }
    catch {} finally { setSending(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <Pressable testID="chat-back" onPress={() => router.back()} style={{ width: 40, height: 40, justifyContent: "center" }}>
            <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <H2 testID="chat-peer-name">{peerName || "Chat"}</H2>
          </View>
        </View>

        <FlatList
          ref={listRef}
          data={msgs}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.md, gap: 8 }}
          renderItem={({ item }) => {
            const mine = item.from_id === user?.id;
            return (
              <View style={[styles.bubble, mine ? styles.mine : styles.theirs]} testID={`msg-${item.id}`}>
                <Body style={{ color: mine ? colors.onBrandPrimary : colors.onSurface }}>{item.text}</Body>
                <Muted style={{ fontSize: 10, marginTop: 4, color: mine ? colors.onBrandPrimary : colors.onSurfaceSecondary, opacity: 0.7 }}>
                  {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Muted>
              </View>
            );
          }}
        />

        <View style={styles.inputBar}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.onSurfaceSecondary}
            style={styles.input}
            multiline
          />
          <Pressable testID="chat-send" onPress={send} disabled={sending || !text.trim()} style={[styles.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]}>
            {sending ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Ionicons name="send" size={20} color={colors.onBrandPrimary} />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  bubble: { maxWidth: "80%", padding: 10, borderRadius: radius.md },
  mine: { alignSelf: "flex-end", backgroundColor: colors.brand },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surfaceSecondary },
  inputBar: { flexDirection: "row", alignItems: "flex-end", padding: spacing.sm, gap: 8, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  input: { flex: 1, maxHeight: 100, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: t.base, color: colors.onSurface, backgroundColor: colors.surface },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" },
});
