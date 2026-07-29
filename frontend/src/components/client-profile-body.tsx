import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Pressable, Linking, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/src/api";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { Body, Muted, Card, H2, Field, PrimaryButton, Chip } from "@/src/ui";

/* ------------------------------------------------------------
   Client Profile Body — used in profile.tsx for role=client (and contractor).
   Renders: hero, company info, location, stats, verification, payments,
   ratings, documents, quick actions.
   Keeps existing worker code untouched.
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
  const [stats, setStats] = useState<ClientStats | null>(null);
  const [companyName, setCompanyName] = useState(user?.company_name || user?.name || "");
  const [businessType, setBusinessType] = useState(user?.business_type || "");
  const [contactPerson, setContactPerson] = useState(user?.contact_person || "");
  const [email, setEmail] = useState(user?.email || "");
  const [gst, setGst] = useState(user?.gst_number || "");
  const [pan, setPan] = useState(user?.pan_number || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [desc, setDesc] = useState(user?.company_description || "");
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
        email,
        gst_number: gst,
        pan_number: pan,
        website,
        company_description: desc,
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
      {/* Profile Completion */}
      {stats && stats.completion_pct < 100 ? (
        <Card testID="client-completion-card" style={{ borderWidth: 1, borderColor: colors.brand + "44" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Ionicons name="rocket" size={18} color={colors.brand} />
              <Body style={{ fontWeight: "800" }}>Profile Completion</Body>
            </View>
            <Body style={{ fontWeight: "800", color: colors.brand }}>{stats.completion_pct}%</Body>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${stats.completion_pct}%` }]} />
          </View>
          {stats.missing_fields.length > 0 ? (
            <Muted style={{ fontSize: 11, marginTop: 8 }}>
              Complete: {stats.missing_fields.slice(0, 4).join(", ")}
              {stats.missing_fields.length > 4 ? `, +${stats.missing_fields.length - 4} more` : ""}
            </Muted>
          ) : null}
        </Card>
      ) : null}

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

      {/* Company Information */}
      <SectionCard icon="business" title="Company Information" testID="section-company-info">
        <Field label="Company Name" value={companyName} onChangeText={setCompanyName} placeholder="e.g., ABC Construction" testID="field-company-name" />
        <Body style={{ fontWeight: "700", marginTop: 4, fontSize: 13 }}>Business Type</Body>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8, marginBottom: 12 }}>
          {BUSINESS_TYPES.map((b) => (
            <Chip
              key={b}
              testID={`bt-${b}`}
              label={b}
              selected={businessType === b}
              onPress={() => setBusinessType(businessType === b ? "" : b)}
            />
          ))}
        </View>
        <Field label="Contact Person" value={contactPerson} onChangeText={setContactPerson} placeholder="Name" testID="field-contact-person" />
        <Field label="Mobile" value={user?.mobile || ""} editable={false} testID="field-mobile" />
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@company.com" autoCapitalize="none" keyboardType="email-address" testID="field-email" />
        <Field label="GST Number (Optional)" value={gst} onChangeText={setGst} placeholder="e.g., 27ABCDE1234F1Z5" autoCapitalize="characters" testID="field-gst" />
        <Field label="PAN (Optional)" value={pan} onChangeText={setPan} placeholder="AAAAA9999A" autoCapitalize="characters" testID="field-pan" />
        <Field label="Website (Optional)" value={website} onChangeText={setWebsite} placeholder="https://…" autoCapitalize="none" keyboardType="url" testID="field-website" />
        <Body style={{ fontWeight: "700", fontSize: 13, marginTop: 4 }}>About Company</Body>
        <TextInput
          testID="field-description"
          value={desc}
          onChangeText={setDesc}
          multiline
          numberOfLines={4}
          placeholder="Tell workers about your company culture, project types, and expectations"
          placeholderTextColor={colors.borderStrong}
          style={styles.textarea}
        />
      </SectionCard>

      {/* Location */}
      <SectionCard icon="location" title="Location" testID="section-location">
        <Field label="State" value={stateVal} onChangeText={setStateVal} placeholder="Maharashtra" testID="field-state" />
        <Field label="City" value={city} onChangeText={setCity} placeholder="Mumbai" testID="field-city" />
        <Field label="Complete Address" value={address} onChangeText={setAddress} placeholder="Office / Site address" testID="field-address" />
        <Field label="PIN Code" value={pin} onChangeText={setPin} keyboardType="number-pad" placeholder="400001" testID="field-pin" />
        <Pressable testID="open-map" onPress={openMap} style={styles.mapBtn}>
          <Ionicons name="map" size={16} color={colors.brand} />
          <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 6 }}>View on Google Maps</Body>
        </Pressable>
      </SectionCard>

      {/* Sticky Save */}
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

      {/* Company Stats */}
      {stats ? (
        <SectionCard icon="stats-chart" title="Company Stats" testID="section-stats">
          <View style={styles.statGrid}>
            <StatCell icon="briefcase" label="Jobs Posted" value={stats.jobs_posted} tint="#F59E0B" />
            <StatCell icon="flash" label="Active Jobs" value={stats.active_jobs} tint={colors.brand} />
            <StatCell icon="people" label="Workers Hired" value={stats.workers_hired} tint="#3B82F6" />
            <StatCell icon="construct" label="Contractors Hired" value={stats.contractors_hired} tint="#8B5CF6" />
            <StatCell icon="checkmark-done" label="Completed Projects" value={stats.completed_projects} tint={colors.success} />
            <StatCell icon="calendar" label="Joined" value={stats.joined_at ? new Date(stats.joined_at).toLocaleDateString("en", { month: "short", year: "numeric" }) : "—"} tint="#EC4899" />
          </View>
        </SectionCard>
      ) : null}

      {/* Trust & Verification */}
      {stats ? (
        <SectionCard icon="shield-checkmark" title="Trust & Verification" testID="section-trust">
          <View style={styles.trustHeader}>
            <View style={styles.trustCircle}>
              <Body style={{ fontSize: 22, fontWeight: "800", color: colors.brand }}>{stats.trust_score}</Body>
              <Muted style={{ fontSize: 10 }}>/ 100</Muted>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Body style={{ fontWeight: "800" }}>Trust Score</Body>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>
                {stats.trust_score >= 80
                  ? "Excellent — you're a trusted employer"
                  : stats.trust_score >= 50
                  ? "Good — complete more verifications to improve"
                  : "Low — verify GST, email & PAN to build trust"}
              </Muted>
            </View>
          </View>
          <View style={{ marginTop: spacing.md, gap: 8 }}>
            <VerifyRow label="Mobile Verified" done={stats.verifications.mobile_verified} />
            <VerifyRow label="Email Verified" done={stats.verifications.email_verified} />
            <VerifyRow label="GST Verified" done={stats.verifications.gst_verified} />
            <VerifyRow label="Aadhaar Verified" done={stats.verifications.aadhaar_verified} />
            <VerifyRow label="Company Verified" done={stats.verifications.company_verified} />
          </View>
        </SectionCard>
      ) : null}

      {/* Payment Performance */}
      {stats ? (
        <SectionCard icon="wallet" title="Payment Performance" testID="section-payments">
          <View style={styles.statGrid}>
            <StatCell icon="wallet" label="Wallet Balance" value={`₹${stats.wallet_balance.toLocaleString()}`} tint={colors.brand} />
            <StatCell icon="lock-closed" label="Escrow Balance" value={`₹${stats.escrow_balance.toLocaleString()}`} tint="#3B82F6" />
            <StatCell icon="cash" label="Total Payments" value={`₹${stats.total_payments.toLocaleString()}`} tint={colors.success} />
            <StatCell icon="time" label="On-Time %" value={`${stats.ontime_payment_pct}%`} tint="#8B5CF6" />
          </View>
        </SectionCard>
      ) : null}

      {/* Ratings */}
      {stats ? (
        <SectionCard icon="star" title="Ratings & Performance" testID="section-ratings">
          <LinearGradient colors={[colors.brand + "22", colors.brand + "08"]} style={styles.ratingBanner}>
            <View>
              <Body style={{ fontSize: 32, fontWeight: "800", color: colors.brand }}>
                {stats.rating_avg.toFixed(1)}
              </Body>
              <View style={{ flexDirection: "row", marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Ionicons
                    key={i}
                    name={i <= Math.round(stats.rating_avg) ? "star" : "star-outline"}
                    size={16}
                    color={colors.brand}
                  />
                ))}
              </View>
              <Muted style={{ marginTop: 4, fontSize: 12 }}>{stats.rating_count} reviews</Muted>
            </View>
            <View style={{ flex: 1, marginLeft: spacing.md, gap: 8 }}>
              <StatMini icon="trending-up" label="Hiring Success" value={`${stats.hiring_success_rate}%`} />
              <StatMini icon="hourglass" label="Avg Response" value={`~${stats.avg_response_hours}h`} />
            </View>
          </LinearGradient>
        </SectionCard>
      ) : null}

      {/* Documents */}
      <SectionCard icon="document-attach" title="Documents" testID="section-documents">
        <DocRow label="GST Certificate" uploaded={!!user?.gst_certificate} />
        <DocRow label="PAN Card" uploaded={!!user?.pan_card_doc} />
        <DocRow label="Company Registration Certificate" uploaded={!!user?.company_registration_doc} />
        <DocRow label="Trade License (Optional)" uploaded={!!user?.trade_license_doc} optional />
        <Muted style={{ fontSize: 11, marginTop: 6 }}>
          Upload flow coming soon — you can enter GST/PAN numbers above for now.
        </Muted>
      </SectionCard>

      {/* Quick Actions */}
      <H2 style={{ marginTop: spacing.sm }}>Quick Actions</H2>
      <QuickCard icon="create" label="Edit Profile" hint="Tap fields above to edit" onPress={() => {}} />
      <QuickCard icon="star" label="My Reviews" hint="See what workers say" onPress={() => onNavigate?.("/rating")} />
      <QuickCard icon="bookmark" label="Saved Workers" hint="Workers you've bookmarked" onPress={() => onNavigate?.("/(tabs)/my-jobs")} />
      <QuickCard icon="briefcase" label="Payment History" hint="View wallet & escrow txns" onPress={() => onNavigate?.("/(tabs)/wallet")} />
      <QuickCard icon="notifications" label="Notification Settings" hint="Push, email preferences" onPress={() => onNavigate?.("/help")} />
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

function StatCell({
  icon,
  label,
  value,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  tint: string;
}) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIcon, { backgroundColor: tint + "22" }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Body style={styles.statValue}>{value}</Body>
      <Muted style={styles.statLabel} numberOfLines={2}>{label}</Muted>
    </View>
  );
}

function StatMini({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={14} color={colors.brand} />
      <Muted style={{ fontSize: 12, flex: 1 }}>{label}</Muted>
      <Body style={{ fontWeight: "800", fontSize: 13 }}>{value}</Body>
    </View>
  );
}

function VerifyRow({ label, done }: { label: string; done: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <Ionicons
        name={done ? "shield-checkmark" : "shield-outline"}
        size={18}
        color={done ? colors.success : colors.borderStrong}
      />
      <Body style={{ flex: 1, marginLeft: 10, fontWeight: done ? "700" : "500", color: done ? colors.onSurface : colors.onSurfaceSecondary }}>
        {label}
      </Body>
      <View style={[styles.verifyPill, { backgroundColor: done ? "#DCFCE7" : colors.surfaceSecondary }]}>
        <Body style={{ fontSize: 10, fontWeight: "700", color: done ? colors.success : colors.onSurfaceSecondary }}>
          {done ? "Verified" : "Pending"}
        </Body>
      </View>
    </View>
  );
}

function DocRow({ label, uploaded, optional }: { label: string; uploaded: boolean; optional?: boolean }) {
  return (
    <View style={styles.docRow}>
      <Ionicons name={uploaded ? "document-text" : "document-outline"} size={20} color={uploaded ? colors.success : colors.onSurfaceSecondary} />
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Body style={{ fontWeight: "700" }}>{label}</Body>
        <Muted style={{ fontSize: 11 }}>{uploaded ? "Uploaded" : optional ? "Not uploaded (optional)" : "Not uploaded"}</Muted>
      </View>
      <View style={[styles.docStatus, { backgroundColor: uploaded ? "#DCFCE7" : colors.surfaceSecondary }]}>
        <Body style={{ fontSize: 10, fontWeight: "700", color: uploaded ? colors.success : colors.onSurfaceSecondary }}>
          {uploaded ? "Done" : "Upload"}
        </Body>
      </View>
    </View>
  );
}

function QuickCard({
  icon,
  label,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.quickCard}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={colors.brand} />
      </View>
      <View style={{ flex: 1, marginHorizontal: 10 }}>
        <Body style={{ fontWeight: "800" }}>{label}</Body>
        <Muted style={{ fontSize: 11, marginTop: 2 }}>{hint}</Muted>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
    </Pressable>
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
