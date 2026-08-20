import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";
import { MonitorAttendance } from "@/app/(tabs)/attendance";
import NotificationBell from "@/src/components/notification-bell";

export default function AdminAttendance() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={{ position: "absolute", top: spacing.sm, right: spacing.md, zIndex: 10 }}>
        <NotificationBell />
      </View>
      <MonitorAttendance role="admin" />
    </SafeAreaView>
  );
}
