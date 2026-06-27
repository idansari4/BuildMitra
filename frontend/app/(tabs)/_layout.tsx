import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors } from "@/src/theme";
import { Redirect } from "expo-router";

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const { t } = useT();
  if (loading) return null;
  if (!user) return <Redirect href="/role-select" />;
  if (user.role === "admin") return <Redirect href={"/admin/dashboard" as any} />;

  const isWorker = user.role === "worker";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontWeight: "700", fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isWorker ? t("tab.jobs") : t("tab.home"),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          title: isWorker ? t("tab.applied") : t("tab.myJobs"),
          tabBarIcon: ({ color, size }) => <Ionicons name="briefcase" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="attendance"
        options={{
          title: t("tab.attendance"),
          tabBarIcon: ({ color, size }) => <Ionicons name="finger-print" size={size} color={color} />,
          href: isWorker ? "/(tabs)/attendance" : null,
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: t("tab.post"),
          tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size + 4} color={colors.brand} />,
          href: !isWorker ? "/(tabs)/post" : null,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: t("tab.wallet"),
          tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tab.profile"),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
