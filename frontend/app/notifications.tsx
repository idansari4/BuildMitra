import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H1, Body, Muted, Card } from "@/src/ui";
import { useNotifications } from "@/src/notifications-context";

/**
 * In-app Notifications Inbox
 * - Lists all notifications for current user (newest first).
 * - Tap → marks read + deep-links to relevant screen when possible.
 * - Long-press → delete individual notification.
 * - Header "Mark all read" + "Clear all" actions.
 */

type Notif = {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: any;
  read: boolean;
  created_at: string;
};

// ------- helpers -------
function iconForType(type: string): { name: any; color: string } {
  if (type.startsWith("application_")) {
    if (type === "application_accepted") return { name: "checkmark-circle", color: colors.success };
    if (type === "application_rejected") return { name: "close-circle", color: colors.error };
    return { name: "person-add", color: colors.brand };
  }
  if (type.startsWith("attendance_")) return { name: "time", color: colors.brand };
  if (type === "wallet_credit") return { name: "wallet", color: colors.success };
  if (type.startsWith("complaint_")) {
    if (type === "complaint_resolved") return { name: "checkmark-done", color: colors.success };
    if (type === "complaint_rejected") return { name: "close-circle", color: colors.onSurfaceSecondary };
    return { name: "alert-circle", color: colors.warning };
  }
  if (type === "leave_request") return { name: "calendar", color: colors.brand };
  if (type === "leave_approved") return { name: "checkmark-circle", color: colors.success };
  if (type === "leave_rejected") return { name: "close-circle", color: colors.error };
  if (type === "profile_verified") return { name: "shield-checkmark", color: colors.success };
  if (type === "account_suspended") return { name: "ban", color: colors.error };
  if (type === "account_unsuspended") return { name: "refresh-circle", color: colors.success };
  return { name: "notifications", color: colors.brand };
}

function relTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Math.max(0, Date.now() - d.getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return "just now";
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString("en-GB");
  } catch {
    return "";
  }
}

function routeFor(n: Notif): { pathname: string; params?: any } | null {
  const d = n.data || {};
  if (n.type.startsWith("application_") && d.job_id) return { pathname: `/job/${d.job_id}` };
  if (n.type.startsWith("attendance_")) return { pathname: "/(tabs)/attendance" };
  if (n.type === "wallet_credit") return { pathname: "/(tabs)/wallet" };
  if (n.type.startsWith("complaint_")) return { pathname: "/complaints" };
  if (n.type.startsWith("leave_")) return { pathname: "/leave" };
  if (n.type === "profile_verified" || n.type.startsWith("account_")) return { pathname: "/(tabs)/profile" };
  return null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { setUnread, refresh: refreshCtx } = useNotifications();
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = (await api.notifications({ limit: 100 })) as Notif[];
      setItems(Array.isArray(r) ? r : []);
      // Keep global badge in sync with the freshly loaded list
      const u = (Array.isArray(r) ? r : []).filter((x) => !x.read).length;
      setUnread(u);
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message || "Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUnread]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const openNotif = async (n: Notif) => {
    // Optimistic mark-read
    if (!n.read) {
      setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => u - 1);
      try {
        await api.notificationsMarkRead([n.id]);
      } catch {
        // Rollback on failure
        refreshCtx();
      }
    }
    const r = routeFor(n);
    if (r) router.push(r as any);
  };

  const deleteOne = (n: Notif) => {
    Alert.alert("Delete this notification?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const wasUnread = !n.read;
          setItems((arr) => arr.filter((x) => x.id !== n.id));
          if (wasUnread) setUnread((u) => u - 1);
          try {
            await api.notificationDelete(n.id);
          } catch (e: any) {
            Alert.alert("Failed to delete", e?.message || "");
            load();
          }
        },
      },
    ]);
  };

  const markAllRead = async () => {
    if (!items.some((x) => !x.read)) return;
    setItems((arr) => arr.map((x) => ({ ...x, read: true })));
    setUnread(0);
    try {
      await api.notificationsMarkRead(undefined, true);
    } catch (e: any) {
      Alert.alert("Failed", e?.message || "");
      refreshCtx();
      load();
    }
  };

  const clearAll = () => {
    if (!items.length) return;
    Alert.alert("Clear all notifications?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear all",
        style: "destructive",
        onPress: async () => {
          setItems([]);
          setUnread(0);
          try {
            await api.notificationsClearAll();
          } catch (e: any) {
            Alert.alert("Failed", e?.message || "");
            refreshCtx();
            load();
          }
        },
      },
    ]);
  };

  const unreadCount = items.filter((x) => !x.read).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable
          testID="notif-back"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1, marginLeft: spacing.sm }}>
          <H1 style={{ fontSize: t.lg }}>Notifications</H1>
          {unreadCount > 0 ? (
            <Muted style={{ fontSize: 12 }}>{unreadCount} unread</Muted>
          ) : (
            <Muted style={{ fontSize: 12 }}>All caught up</Muted>
          )}
        </View>
        {items.length > 0 && (
          <>
            <Pressable
              testID="notif-mark-all"
              onPress={markAllRead}
              hitSlop={8}
              style={styles.iconBtn}
              disabled={unreadCount === 0}
            >
              <Ionicons
                name="checkmark-done"
                size={22}
                color={unreadCount === 0 ? colors.borderStrong : colors.brand}
              />
            </Pressable>
            <Pressable
              testID="notif-clear-all"
              onPress={clearAll}
              hitSlop={8}
              style={styles.iconBtn}
            >
              <Ionicons name="trash-outline" size={22} color={colors.error} />
            </Pressable>
          </>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: 60, gap: spacing.sm }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.brand} style={{ marginTop: 80 }} />
          ) : (
            <View style={{ alignItems: "center", marginTop: 80, padding: spacing.lg }}>
              <Ionicons name="notifications-off-outline" size={64} color={colors.borderStrong} />
              <Body style={{ marginTop: 12, fontWeight: "700" }}>No notifications yet</Body>
              <Muted style={{ marginTop: 4, textAlign: "center" }}>
                We&apos;ll notify you when you get job responses, payments, and other updates.
              </Muted>
            </View>
          )
        }
        renderItem={({ item }) => {
          const ic = iconForType(item.type);
          return (
            <Pressable
              testID={`notif-${item.id}`}
              onPress={() => openNotif(item)}
              onLongPress={() => deleteOne(item)}
              style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
            >
              <Card style={[styles.card, !item.read && styles.cardUnread]}>
                <View style={[styles.iconWrap, { backgroundColor: ic.color + "22" }]}>
                  <Ionicons name={ic.name} size={22} color={ic.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Body
                      style={{
                        fontWeight: item.read ? "600" : "800",
                        flex: 1,
                        marginRight: 6,
                      }}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Body>
                    {!item.read && <View style={styles.dot} />}
                  </View>
                  {!!item.body && (
                    <Muted style={{ marginTop: 2 }} numberOfLines={3}>
                      {item.body}
                    </Muted>
                  )}
                  <Muted style={{ marginTop: 6, fontSize: 11 }}>{relTime(item.created_at)}</Muted>
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: spacing.md,
  },
  cardUnread: {
    borderLeftWidth: 3,
    borderLeftColor: colors.brand,
    backgroundColor: colors.brandTertiary + "55",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.brand,
  },
});
