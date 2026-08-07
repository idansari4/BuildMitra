import React from "react";
import { View, StyleSheet, Modal, Pressable, ScrollView, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, type as t } from "@/src/theme";
import { Body, Muted } from "@/src/ui";

type Role = "worker" | "contractor" | "client" | "admin";

type MenuItem = {
  key: string;
  label: string;
  hint?: string;
  icon: keyof typeof Ionicons.glyphMap;
  action: () => void;
  danger?: boolean;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  role: Role;
  onEditProfile: () => void;
  onMyReviews: () => void;
  onNotificationSettings: () => void;
  onChangePassword: () => void;
  onLeaveManagement: () => void;
  onProjectProgress: () => void;
  onPayroll: () => void;
  onAttendance: () => void;
  onHelpSupport: () => void;
  onPrivacyPolicy: () => void;
  onTerms: () => void;
  onLogout: () => void;
};

export default function SettingsMenu(props: Props) {
  const {
    visible,
    onClose,
    role,
    onEditProfile,
    onMyReviews,
    onNotificationSettings,
    onChangePassword,
    onLeaveManagement,
    onProjectProgress,
    onPayroll,
    onAttendance,
    onHelpSupport,
    onPrivacyPolicy,
    onTerms,
    onLogout,
  } = props;

  const isWorker = role === "worker";
  const isClientOrContractor = role === "client" || role === "contractor";

  const account: MenuItem[] = [
    { key: "edit", label: "Edit Profile", hint: "Update your personal info", icon: "create-outline", action: onEditProfile },
    ...(isClientOrContractor || isWorker
      ? [{ key: "reviews", label: "My Reviews", hint: "See what others say", icon: "star-outline" as const, action: onMyReviews }]
      : []),
    ...(isClientOrContractor
      ? [{ key: "notif", label: "Notification Settings", hint: "Push & email alerts", icon: "notifications-outline" as const, action: onNotificationSettings }]
      : []),
    { key: "pw", label: "Change Password", hint: "Update your login password", icon: "lock-closed-outline", action: onChangePassword },
  ];

  const workMgmt: MenuItem[] = [
    { key: "leave", label: "Leave Management", hint: isWorker ? "Apply for leave" : "Approve leave requests", icon: "calendar-outline", action: onLeaveManagement },
    ...(isClientOrContractor
      ? [{ key: "progress", label: "Project Progress", hint: "Track ongoing projects", icon: "bar-chart-outline" as const, action: onProjectProgress }]
      : []),
    ...(isWorker
      ? [{ key: "payroll", label: "Payroll", hint: "Earnings & payment history", icon: "cash-outline" as const, action: onPayroll }]
      : []),
    { key: "attendance", label: "Attendance", hint: isWorker ? "Check-in / Check-out" : "Monitor workforce", icon: "finger-print-outline", action: onAttendance },
  ];

  const support: MenuItem[] = [
    { key: "help", label: "Help & Support", hint: "Get in touch with our team", icon: "help-circle-outline", action: onHelpSupport },
    { key: "privacy", label: "Privacy Policy", hint: "How we handle your data", icon: "shield-checkmark-outline", action: onPrivacyPolicy },
    { key: "terms", label: "Terms & Conditions", hint: "Rules of using BuildMitra", icon: "document-text-outline", action: onTerms },
  ];

  const actions: MenuItem[] = [
    { key: "logout", label: "Logout", hint: "Sign out of your account", icon: "log-out-outline", action: onLogout, danger: true },
  ];

  const renderItem = (item: MenuItem) => (
    <Pressable
      key={item.key}
      testID={`menu-${item.key}`}
      onPress={() => {
        onClose();
        // small timeout to let modal close animation start before route change
        setTimeout(() => item.action(), Platform.OS === "web" ? 0 : 180);
      }}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surfaceSecondary }]}
    >
      <View style={[styles.itemIcon, { backgroundColor: item.danger ? "#FEE2E2" : colors.brandTertiary }]}>
        <Ionicons name={item.icon} size={18} color={item.danger ? colors.error : colors.brand} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Body style={{ fontWeight: "700", color: item.danger ? colors.error : colors.onSurface }}>
          {item.label}
        </Body>
        {item.hint ? <Muted style={{ fontSize: 11, marginTop: 2 }}>{item.hint}</Muted> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
    </Pressable>
  );

  const renderSection = (title: string, items: MenuItem[], testID: string) => (
    <View style={styles.section} testID={testID}>
      <Body style={styles.sectionTitle}>{title}</Body>
      <View style={styles.itemsWrap}>{items.map(renderItem)}</View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} testID="menu-backdrop">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <View style={styles.header}>
            <Body style={{ fontSize: t.lg, fontWeight: "800" }}>Menu</Body>
            <Pressable testID="menu-close" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.onSurface} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {renderSection("Account", account, "menu-section-account")}
            {renderSection("Work Management", workMgmt, "menu-section-work")}
            {renderSection("Support & Legal", support, "menu-section-support")}
            {renderSection("Account Action", actions, "menu-section-actions")}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: spacing.md,
    maxHeight: "88%",
    minHeight: "60%",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  grabber: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.brand,
    letterSpacing: 1.1,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
  },
  itemsWrap: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
