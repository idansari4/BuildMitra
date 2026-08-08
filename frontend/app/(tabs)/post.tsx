import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Location from "expo-location";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import {
  colors,
  radius,
  spacing,
  SKILLS,
  type as t,
} from "@/src/theme";
import { H2, Body, Muted, PrimaryButton, Field } from "@/src/ui";
import Dropdown from "@/src/components/dropdown";
import DatePickerField from "@/src/components/date-picker-field";

const SITE_TYPES: { key: "residential" | "commercial"; label: string; icon: any }[] = [
  { key: "residential", label: "Residential", icon: "home" },
  { key: "commercial", label: "Commercial", icon: "business" },
];

const WORKER_TYPES: { key: "daily_worker" | "contractor"; label: string; icon: any; sub: string }[] = [
  { key: "daily_worker", label: "Daily Wages Worker", icon: "people", sub: "Hire workers per day" },
  { key: "contractor", label: "Contractor", icon: "briefcase", sub: "Contract-based work" },
];

const SKILL_CATEGORIES = ["Full Trained", "Semi Trained", "Helper", "Site Supervisor"] as const;
type SkillCategory = (typeof SKILL_CATEGORIES)[number];

type SkillRow = { skill: SkillCategory; count: number };

type Drawing = {
  data: string; // base64 data URL
  type: "image" | "pdf";
  name: string;
} | null;

export default function PostJob() {
  const router = useRouter();
  const { user } = useAuth();

  // Common
  const [siteType, setSiteType] = useState<"residential" | "commercial" | "">("");
  const [workerType, setWorkerType] = useState<"daily_worker" | "contractor" | "">("");
  const [jobTitle, setJobTitle] = useState<string>("");
  const [description, setDescription] = useState("");
  const [workingStartDate, setWorkingStartDate] = useState("");
  const [drawing, setDrawing] = useState<Drawing>(null);

  // Daily-wages-worker only
  const [skillRows, setSkillRows] = useState<SkillRow[]>([]);
  const [siteStay, setSiteStay] = useState<boolean | null>(null);

  // Location
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pin, setPin] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const isDailyWorker = workerType === "daily_worker";

  const toggleSkill = (sk: SkillCategory) => {
    setSkillRows((rows) => {
      const idx = rows.findIndex((r) => r.skill === sk);
      if (idx >= 0) return rows.filter((r) => r.skill !== sk);
      return [...rows, { skill: sk, count: 1 }];
    });
  };

  const setSkillCount = (sk: SkillCategory, count: number) => {
    setSkillRows((rows) =>
      rows.map((r) => (r.skill === sk ? { ...r, count: Math.max(1, count) } : r))
    );
  };

  const captureGps = async () => {
    setGpsBusy(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setErr("Location permission denied");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({});
      setLat(pos.coords.latitude);
      setLng(pos.coords.longitude);
      setErr("");
    } catch (e: any) {
      setErr(e?.message || "Could not capture location");
    } finally {
      setGpsBusy(false);
    }
  };

  const pickDrawing = async (source: "image" | "pdf") => {
    setErr("");
    try {
      if (source === "image") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          setErr("Gallery permission denied");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.6,
        });
        if (res.canceled || !res.assets?.[0]?.base64) return;
        const a = res.assets[0];
        setDrawing({
          data: `data:image/jpeg;base64,${a.base64}`,
          type: "image",
          name: a.fileName || "drawing.jpg",
        });
      } else {
        const res = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];
        // Read as base64
        try {
          const FileSystem = await import("expo-file-system");
          const b64 = await (FileSystem as any).readAsStringAsync(a.uri, {
            encoding: "base64",
          });
          setDrawing({
            data: `data:application/pdf;base64,${b64}`,
            type: "pdf",
            name: a.name || "drawing.pdf",
          });
        } catch {
          // Fallback: use uri directly (may not survive backend, but harmless)
          setDrawing({ data: a.uri, type: "pdf", name: a.name || "drawing.pdf" });
        }
      }
    } catch (e: any) {
      setErr(e?.message || "Could not attach drawing");
    }
  };

  const removeDrawing = () => setDrawing(null);

  const promptDrawing = () => {
    if (Platform.OS === "web") {
      // On web, gallery picker handles images; use document picker for pdf
      // We ask via a simple mini choice.
      const useImage = typeof window !== "undefined"
        ? window.confirm("Attach an image drawing? Click Cancel to attach a PDF.")
        : true;
      if (useImage) pickDrawing("image");
      else pickDrawing("pdf");
    } else {
      Alert.alert(
        "Upload Drawing",
        "Choose a source",
        [
          { text: "Image (Gallery)", onPress: () => pickDrawing("image") },
          { text: "PDF Document", onPress: () => pickDrawing("pdf") },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  const submit = async () => {
    setErr("");
    setOk("");

    if (!siteType) {
      setErr("Please select Site / Project Type");
      return;
    }
    if (!workerType) {
      setErr("Please select Worker Type");
      return;
    }
    if (!jobTitle) {
      setErr("Please select a Job Title");
      return;
    }
    if (!description.trim()) {
      setErr("Please enter Work Description");
      return;
    }
    if (!workingStartDate) {
      setErr("Please pick a Working Start Date");
      return;
    }
    if (!address.trim() || !city.trim() || !state.trim() || !pin.trim()) {
      setErr("Please fill complete site location (address, city, state, PIN)");
      return;
    }
    if (isDailyWorker) {
      if (skillRows.length === 0) {
        setErr("Select at least one skill category");
        return;
      }
      if (skillRows.some((r) => !r.count || r.count < 1)) {
        setErr("Enter workers needed for each selected skill");
        return;
      }
      if (siteStay === null) {
        setErr("Please select if Site Stay is allowed");
        return;
      }
    }

    const totalWorkers = isDailyWorker
      ? skillRows.reduce((a, b) => a + (b.count || 0), 0)
      : 1;

    setBusy(true);
    try {
      const composedLocation = [address, city, state].filter(Boolean).join(", ");
      const payload: any = {
        title: jobTitle,
        description: description.trim(),
        skill: jobTitle, // primary skill = job title
        workers_needed: totalWorkers,
        daily_wage: 0, // removed from UI
        location: composedLocation || city,
        site_address: address,
        duration_days: 1,
        urgency: "Normal",
        // New categorisation
        site_project_type: siteType,
        worker_type: workerType,
        working_start_date: workingStartDate,
        address,
        city,
        state,
        pin_code: pin,
      };
      if (lat != null && lng != null) {
        payload.lat = lat;
        payload.lng = lng;
      }
      if (isDailyWorker) {
        payload.skills_required = skillRows.map((r) => ({
          skill: r.skill,
          count: r.count,
        }));
        payload.site_stay_allowed = !!siteStay;
      }
      if (drawing) {
        payload.drawing_url = drawing.data;
        payload.drawing_type = drawing.type;
        payload.drawing_name = drawing.name;
      }

      await api.postJob(payload);
      setOk("Job posted ✓");
      // Reset
      setJobTitle("");
      setDescription("");
      setWorkingStartDate("");
      setDrawing(null);
      setSkillRows([]);
      setSiteStay(null);
      setAddress("");
      setCity("");
      setState("");
      setPin("");
      setLat(null);
      setLng(null);
      setTimeout(() => router.replace("/(tabs)/activity"), 700);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  // Access control — only client & contractor
  if (user && user.role !== "client" && user.role !== "contractor") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
        <View style={{ padding: spacing.lg, alignItems: "center", marginTop: 40 }}>
          <Ionicons name="lock-closed" size={48} color={colors.borderStrong} />
          <H2 style={{ marginTop: 12 }}>Not available</H2>
          <Muted>Only Client & Contractor accounts can post jobs.</Muted>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <H2 testID="post-job-title">Post a Job</H2>
          <Muted style={{ marginTop: 4, marginBottom: spacing.md }}>
            Reach 1000+ workers nearby
          </Muted>

          {/* 1. Site / Project Type */}
          <SectionCard title="Site / Project Type" icon="location" required testID="section-site-type">
            <View style={styles.segmentRow}>
              {SITE_TYPES.map((st) => (
                <SegmentBtn
                  key={st.key}
                  testID={`site-type-${st.key}`}
                  icon={st.icon}
                  label={st.label}
                  selected={siteType === st.key}
                  onPress={() => setSiteType(st.key)}
                />
              ))}
            </View>
          </SectionCard>

          {/* 2. Worker Type */}
          <SectionCard title="Worker Type" icon="people-circle" required testID="section-worker-type">
            <View style={styles.workerTypeRow}>
              {WORKER_TYPES.map((wt) => (
                <Pressable
                  key={wt.key}
                  testID={`worker-type-${wt.key}`}
                  onPress={() => setWorkerType(wt.key)}
                  style={({ pressed }) => [
                    styles.workerTypeCard,
                    workerType === wt.key && styles.workerTypeCardOn,
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <View
                    style={[
                      styles.workerTypeIconWrap,
                      workerType === wt.key && { backgroundColor: colors.brand },
                    ]}
                  >
                    <Ionicons
                      name={wt.icon}
                      size={22}
                      color={
                        workerType === wt.key
                          ? colors.onBrandPrimary
                          : colors.brand
                      }
                    />
                  </View>
                  <Body
                    style={[
                      styles.workerTypeLabel,
                      workerType === wt.key && { color: colors.brand },
                    ]}
                  >
                    {wt.label}
                  </Body>
                  <Muted style={styles.workerTypeSub}>{wt.sub}</Muted>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          {/* Conditional forms */}
          {workerType ? (
            <>
              {/* Job Title */}
              <Dropdown
                testID="job-title-dd"
                label={`Job Title${" *"}`}
                value={jobTitle}
                options={SKILLS}
                onSelect={setJobTitle}
                placeholder="Select job title"
                searchable
              />

              {/* Skills Required — only Daily Wages Worker */}
              {isDailyWorker ? (
                <SectionCard title="Skills Required" icon="ribbon" testID="section-skills-required">
                  <Muted style={{ marginBottom: 8 }}>
                    Select one or more skill categories and workers needed for each.
                  </Muted>
                  <View style={{ gap: 8 }}>
                    {SKILL_CATEGORIES.map((sk) => {
                      const row = skillRows.find((r) => r.skill === sk);
                      const selected = !!row;
                      return (
                        <View key={sk}>
                          <Pressable
                            testID={`skill-cat-${sk.toLowerCase().replace(/\s+/g, "-")}`}
                            onPress={() => toggleSkill(sk)}
                            style={({ pressed }) => [
                              styles.skillCard,
                              selected && styles.skillCardOn,
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <Ionicons
                              name={selected ? "checkmark-circle" : "ellipse-outline"}
                              size={22}
                              color={selected ? colors.brand : colors.onSurfaceSecondary}
                            />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <Body
                                style={{
                                  fontWeight: "700",
                                  color: selected ? colors.brand : colors.onSurface,
                                }}
                              >
                                {sk}
                              </Body>
                            </View>
                          </Pressable>
                          {selected ? (
                            <View style={styles.workerCountRow}>
                              <Muted style={{ flex: 1 }}>Workers Needed</Muted>
                              <Pressable
                                testID={`sk-dec-${sk.toLowerCase().replace(/\s+/g, "-")}`}
                                onPress={() =>
                                  setSkillCount(sk, Math.max(1, (row?.count || 1) - 1))
                                }
                                style={styles.stepperBtn}
                              >
                                <Ionicons name="remove" size={20} color={colors.brand} />
                              </Pressable>
                              <Body style={styles.stepperValue}>{row?.count}</Body>
                              <Pressable
                                testID={`sk-inc-${sk.toLowerCase().replace(/\s+/g, "-")}`}
                                onPress={() => setSkillCount(sk, (row?.count || 1) + 1)}
                                style={styles.stepperBtn}
                              >
                                <Ionicons name="add" size={20} color={colors.brand} />
                              </Pressable>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </SectionCard>
              ) : null}

              {/* Work Description */}
              <Field
                testID="desc-input"
                label="Work Description *"
                value={description}
                onChangeText={setDescription}
                placeholder="Scope of work, expectations..."
                multiline
              />

              {/* Working Start Date */}
              <DatePickerField
                testID="working-start-date"
                label="Working Start Date"
                value={workingStartDate}
                onChange={setWorkingStartDate}
                required
                minDate={new Date()}
              />

              {/* Upload Drawing */}
              <SectionCard title="Upload Drawing (Optional)" icon="document-attach" testID="section-drawing">
                {drawing ? (
                  <View style={styles.drawingPreview}>
                    {drawing.type === "image" ? (
                      <Image source={{ uri: drawing.data }} style={styles.drawingImg} />
                    ) : (
                      <View style={styles.pdfPreview}>
                        <Ionicons name="document-text" size={36} color={colors.brand} />
                        <Body style={{ marginTop: 6, fontWeight: "700" }} numberOfLines={1}>
                          {drawing.name}
                        </Body>
                        <Muted>PDF attached</Muted>
                      </View>
                    )}
                    <Pressable
                      testID="drawing-remove"
                      onPress={removeDrawing}
                      style={styles.drawingRemoveBtn}
                    >
                      <Ionicons name="trash" size={16} color={colors.error} />
                      <Body style={{ color: colors.error, fontWeight: "700", marginLeft: 6 }}>
                        Remove
                      </Body>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    testID="drawing-upload"
                    onPress={promptDrawing}
                    style={styles.uploadBtn}
                  >
                    <Ionicons name="cloud-upload" size={22} color={colors.brand} />
                    <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 8 }}>
                      Attach Image or PDF
                    </Body>
                  </Pressable>
                )}
              </SectionCard>

              {/* Site Stay — Daily Wages Worker only */}
              {isDailyWorker ? (
                <SectionCard title="Site Stay Allowed?" icon="bed" testID="section-site-stay">
                  <View style={styles.segmentRow}>
                    <SegmentBtn
                      testID="site-stay-yes"
                      icon="checkmark-circle"
                      label="Yes"
                      selected={siteStay === true}
                      onPress={() => setSiteStay(true)}
                    />
                    <SegmentBtn
                      testID="site-stay-no"
                      icon="close-circle"
                      label="No"
                      selected={siteStay === false}
                      onPress={() => setSiteStay(false)}
                    />
                  </View>
                </SectionCard>
              ) : null}

              {/* Working Site Location */}
              <SectionCard title="Working Site Location" icon="map" testID="section-location">
                <Field
                  testID="address-input"
                  label="Complete Address"
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Building, street, area"
                  multiline
                />
                <View style={styles.twoCol}>
                  <View style={styles.col}>
                    <Field
                      testID="city-input"
                      label="City"
                      value={city}
                      onChangeText={setCity}
                      placeholder="e.g., Mumbai"
                    />
                  </View>
                  <View style={styles.col}>
                    <Field
                      testID="state-input"
                      label="State"
                      value={state}
                      onChangeText={setState}
                      placeholder="e.g., Maharashtra"
                    />
                  </View>
                </View>
                <View style={{ maxWidth: 180 }}>
                  <Field
                    testID="pin-input"
                    label="PIN Code"
                    value={pin}
                    onChangeText={setPin}
                    keyboardType="number-pad"
                    placeholder="400001"
                  />
                </View>

                <Pressable
                  testID="capture-gps"
                  onPress={captureGps}
                  style={styles.gpsBtn}
                >
                  <Ionicons
                    name={gpsBusy ? "hourglass" : "navigate-circle"}
                    size={20}
                    color={colors.brand}
                  />
                  <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 8 }}>
                    {lat != null && lng != null
                      ? `GPS saved (${lat.toFixed(4)}, ${lng.toFixed(4)})`
                      : "Save Current GPS Location"}
                  </Body>
                </Pressable>
              </SectionCard>
            </>
          ) : (
            <View style={styles.helperBox}>
              <Ionicons name="information-circle" size={22} color={colors.brand} />
              <Body style={{ flex: 1, marginLeft: 10 }}>
                Select a Worker Type to continue.
              </Body>
            </View>
          )}

          {err ? <Body style={{ color: colors.error, marginTop: 4 }}>{err}</Body> : null}
          {ok ? <Body style={{ color: colors.success, marginTop: 4 }}>{ok}</Body> : null}
        </ScrollView>

        {workerType ? (
          <View style={styles.cta}>
            <PrimaryButton
              testID="post-job-submit"
              label="Post Job"
              loading={busy}
              onPress={submit}
              icon="paper-plane-outline"
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* --------------------------- Sub-components --------------------------- */

function SectionCard({
  icon,
  title,
  required,
  children,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  required?: boolean;
  children: React.ReactNode;
  testID?: string;
}) {
  return (
    <View testID={testID} style={styles.card}>
      <View style={styles.cardHead}>
        <View style={styles.cardIconWrap}>
          <Ionicons name={icon} size={16} color={colors.brand} />
        </View>
        <Body style={styles.cardTitle}>
          {title}
          {required ? " *" : ""}
        </Body>
      </View>
      <View style={{ marginTop: spacing.sm }}>{children}</View>
    </View>
  );
}

function SegmentBtn({
  icon,
  label,
  selected,
  onPress,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segmentBtn,
        selected && styles.segmentBtnOn,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Ionicons
        name={icon}
        size={18}
        color={selected ? colors.onBrandPrimary : colors.onSurfaceSecondary}
      />
      <Body style={[styles.segmentBtnText, selected && styles.segmentBtnTextOn]}>
        {label}
      </Body>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cta: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontWeight: "800", fontSize: t.md },
  segmentRow: { flexDirection: "row", gap: 10 },
  segmentBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  segmentBtnOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  segmentBtnText: {
    fontSize: t.base,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  segmentBtnTextOn: { color: colors.onBrandPrimary },
  workerTypeRow: { flexDirection: "row", gap: 10 },
  workerTypeCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "flex-start",
    gap: 6,
  },
  workerTypeCardOn: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  workerTypeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandTertiary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  workerTypeLabel: { fontWeight: "800", fontSize: 14 },
  workerTypeSub: { fontSize: 11 },
  skillCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  skillCardOn: {
    backgroundColor: colors.brandTertiary,
    borderColor: colors.brand,
  },
  workerCountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: -4,
    marginBottom: 4,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.brand + "44",
    backgroundColor: colors.surface,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.brand + "88",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  stepperValue: {
    minWidth: 30,
    textAlign: "center",
    fontWeight: "800",
    fontSize: 16,
    color: colors.onSurface,
  },
  twoCol: { flexDirection: "row", gap: 12 },
  col: { flex: 1, minWidth: 0 },
  drawingPreview: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  drawingImg: {
    width: "100%",
    height: 180,
    backgroundColor: colors.surfaceSecondary,
  },
  pdfPreview: {
    padding: spacing.lg,
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
  },
  drawingRemoveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brand + "88",
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary + "44",
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brand + "44",
    marginTop: 4,
  },
  helperBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brand + "44",
  },
});
