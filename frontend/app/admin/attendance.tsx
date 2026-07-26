import React from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/src/theme";
import { MonitorAttendance } from "@/app/(tabs)/attendance";

export default function AdminAttendance() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <MonitorAttendance role="admin" />
    </SafeAreaView>
  );
}
