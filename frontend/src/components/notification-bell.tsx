import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors } from "@/src/theme";
import { Body } from "@/src/ui";
import { useNotifications } from "@/src/notifications-context";
import { useAuth } from "@/src/auth";

/**
 * NotificationBell — header icon with an absolutely positioned red
 * unread badge (#FF0000) in the top-right corner. All bells across
 * the app share the same context, so any mark-read anywhere updates
 * every rendered bell instantly.
 */
type Props = {
  color?: string;
  /** If true, hides the count and shows only a dot. */
  dotOnly?: boolean;
  size?: number;
};

export default function NotificationBell({
  color = colors.onSurface,
  dotOnly = false,
  size = 24,
}: Props) {
  const router = useRouter();
  const { user } = useAuth();
  const { unread } = useNotifications();

  if (!user) return null;

  const hasUnread = unread > 0;
  const shown = unread > 99 ? "99+" : String(unread);

  return (
    <Pressable
      testID="notif-bell"
      onPress={() => router.push("/notifications")}
      hitSlop={10}
      style={styles.wrap}
      accessibilityLabel={hasUnread ? `${unread} unread notifications` : "Notifications"}
      accessibilityRole="button"
    >
      <Ionicons
        name={hasUnread ? "notifications" : "notifications-outline"}
        size={size}
        color={color}
      />
      {hasUnread && (
        dotOnly ? (
          <View style={styles.dot} />
        ) : (
          <View style={styles.badge}>
            <Body style={styles.badgeTxt}>{shown}</Body>
          </View>
        )
      )}
    </Pressable>
  );
}

const RED = "#FF0000";

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
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: RED,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.surface,
    // Subtle elevation for Android + shadow for iOS so the dot pops
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  badgeTxt: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
  },
  dot: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: RED,
    borderWidth: 2,
    borderColor: colors.surface,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
});
