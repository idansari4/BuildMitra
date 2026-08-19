import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Pressable, StyleSheet, AppState } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { colors } from "@/src/theme";
import { Body } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

/**
 * NotificationBell — small header icon with unread count badge.
 * Polls unread count every 45s while screen focused; also refreshes
 * when the app comes back to the foreground.
 */
export default function NotificationBell({ color = colors.onSurface }: { color?: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const r: any = await api.notificationsUnreadCount();
      setCount(Number(r?.count || 0));
    } catch {
      // silent — badge simply stays at previous value
    }
  }, [user]);

  // Poll while focused
  useFocusEffect(
    useCallback(() => {
      load();
      timer.current && clearInterval(timer.current);
      timer.current = setInterval(load, 45000);
      return () => {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
      };
    }, [load])
  );

  // Refresh on foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") load();
    });
    return () => sub.remove();
  }, [load]);

  if (!user) return null;

  const shown = count > 99 ? "99+" : String(count);

  return (
    <Pressable
      testID="notif-bell"
      onPress={() => router.push("/notifications")}
      hitSlop={10}
      style={styles.wrap}
    >
      <Ionicons name="notifications-outline" size={24} color={color} />
      {count > 0 && (
        <View style={styles.badge}>
          <Body style={styles.badgeTxt}>{shown}</Body>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.error,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeTxt: {
    color: colors.onError,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },
});
