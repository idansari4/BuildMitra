import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Linking } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { Body, Card, Field, PrimaryButton } from "@/src/ui";
import Dropdown from "@/src/components/dropdown";

/* ------------------------------------------------------------
   Client Profile Body — used in profile.tsx for role=client (and contractor).
   Simplified layout (iter 26):
   Header → Completion → Badges → Client Information → Location
   → Save + Edit action row → Setting section (My Reviews, Notifications)
   Worker code kept untouched in profile.tsx.
------------------------------------------------------------ */

const BUSINESS_TYPES = ["Individual", "Contractor", "Builder", "Developer", "Company"];

export type ClientStats = {
  jobs_posted: number;
  active_jobs: number;
  workers_hired: number;
  contractors_hired: number;
  completed_projects: number;
  joined_at?: string;
  wallet_balance: number;
  escrow_balance: number;
  total_payments: number;
  ontime_payment_pct: number;
  rating_avg: number;
  rating_count: number;
  hiring_success_rate: number;
  avg_response_hours: number;
  verifications: Record<string, boolean>;
  trust_score: number;
  badges: string[];
  missing_fields: string[];
  completion_pct: number;
  is_hiring_now: boolean;
};

type Props = {
  user: any;
  onSaved?: () => void | Promise<void>;
  onNavigate?: (route: string) => void;
};

export default function ClientProfileBody({ user, onSaved, onNavigate }: Props) {
  const isContractor = user?.role === "contractor";
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [companyName, setCompanyName] = useState(user?.company_name || user?.name || "");
  const [businessType, setBusinessType] = useState(user?.business_type || "");
  const [contactPerson, setContactPerson] = useState(user?.contact_person || "");
  const [gst, setGst] = useState(user?.gst_number || "");
  const [stateVal, setStateVal] = useState(user?.state || "");
  const [city, setCity] = useState(user?.city || "");
  const [address, setAddress] = useState(user?.address || "");
  const [pin, setPin] = useState(user?.pin_code || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const loadStats = useCallback(async () => {
    try {
      const s = await api.clientStats();
      setStats(s);
    } catch {}
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const save = async () => {
    setBusy(true);
    setMsg("");
    try {
      await api.updateMe({
        company_name: companyName,
        business_type: businessType || null,
        contact_person: contactPerson,
        gst_number: gst,
        state: stateVal,
        city,
        address,
        pin_code: pin,
      });
      await onSaved?.();
      await loadStats();
      setMsg("Saved ✓");
      setTimeout(() => setMsg(""), 2000);
    } catch (e: any) {
      setMsg(e?.message || "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const openMap = () => {
    const q = encodeURIComponent(
      [address, city, stateVal, pin].filter(Boolean).join(", ") || companyName
    );
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  return (
    <View style={{ gap: spacing.md }}>
      {/* Badges strip */}
      {stats && stats.badges.length > 0 ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }} testID="client-badges">
          {stats.badges.map((b) => (
            <View key={b} style={styles.badge}>
              <Ionicons name="ribbon" size={13} color="#B45309" />
              <Body style={styles.badgeText}>{b}</Body>
            </View>
          ))}
          {stats.is_hiring_now ? (
            <View style={[styles.badge, styles.hiringBadge]}>
              <View style={styles.pulseDot} />
              <Body style={[styles.badgeText, { color: "#065F46" }]}>Hiring Now</Body>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Client / Contractor Information */}
      <SectionCard
        icon="business"
        title={isContractor ? "Contractor Information" : "Client Information"}
        testID="section-company-info"
      >
        <Field label="Business Name" value={companyName} onChangeText={setCompanyName} placeholder="e.g., ABC Construction" testID="field-company-name" />
        {isContractor ? null : (
          <Dropdown
            testID="business-type-dd"
            label="Business Type"
            value={businessType}
            options={BUSINESS_TYPES}
            onSelect={setBusinessType}
            placeholder="Select business type"
          />
        )}
        <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Name" testID="field-contact-person" />
        <Field label="Mobile" value={user?.mobile || ""} onChangeText={() => {}} editable={false} testID="field-mobile" />
        <Field label="GST Number (Optional)" value={gst} onChangeText={setGst} placeholder="e.g., 27ABCDE1234F1Z5" autoCapitalize="characters" testID="field-gst" />
      </SectionCard>

      {/* Location — order: Address → City → State → PIN */}
      <SectionCard icon="location" title="Location" testID="section-location">
        <Field
          label="Complete Address"
          value={address}
          onChangeText={setAddress}
          placeholder="Office / Site address"
          testID="field-address"
          multiline
        />
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Field
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="Mumbai"
              testID="field-city"
            />
          </View>
          <View style={styles.col}>
            <Field
              label="State"
              value={stateVal}
              onChangeText={setStateVal}
              placeholder="Maharashtra"
              testID="field-state"
            />
          </View>
        </View>
        <View style={{ maxWidth: 180 }}>
          <Field
            label="PIN Code"
            value={pin}
            onChangeText={setPin}
            keyboardType="number-pad"
            placeholder="400001"
            testID="field-pin"
          />
        </View>
        <Pressable testID="open-map" onPress={openMap} style={styles.mapBtn}>
          <Ionicons name="map" size={16} color={colors.brand} />
          <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 6 }}>View on Google Maps</Body>
        </Pressable>
      </SectionCard>

      {/* Save action (Edit was previously a no-op that navigated to Home — removed).
          The whole page is already an inline edit form. */}
      <PrimaryButton
        testID="client-save-profile"
        label="Save Profile"
        icon="checkmark-circle-outline"
        loading={busy}
        onPress={save}
      />
      {msg ? (
        <Body style={{ color: msg.includes("✓") ? colors.success : colors.error, textAlign: "center" }}>{msg}</Body>
      ) : null}
    </View>
  );
}

/* ---------------- Reusable sub-components ---------------- */

function SectionCard({
  icon,
  title,
  children,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <Card testID={testID} style={styles.sectionCard}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionIcon}>
          <Ionicons name={icon} size={16} color={colors.brand} />
        </View>
        <Body style={{ fontWeight: "800", fontSize: t.md }}>{title}</Body>
      </View>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  sectionCard: {
    borderRadius: radius.lg,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.brand,
    borderRadius: 4,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FCD34D",
  },
  hiringBadge: {
    backgroundColor: "#DCFCE7",
    borderColor: "#86EFAC",
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#B45309" },
  pulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#16A34A" },
  textarea: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 12,
    marginTop: 6,
    minHeight: 100,
    textAlignVertical: "top",
    color: colors.onSurface,
    fontSize: 14,
  },
  mapBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brand + "44",
    marginTop: 4,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  statGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statCell: {
    width: "48%",
    padding: spacing.md,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    alignItems: "flex-start",
    gap: 4,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 11 },
  trustHeader: { flexDirection: "row", alignItems: "center" },
  trustCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandTertiary,
    borderWidth: 3,
    borderColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  verifyPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  ratingBanner: {
    flexDirection: "row",
    padding: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  docStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  quickCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
});
