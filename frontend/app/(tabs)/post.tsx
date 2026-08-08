import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import {
  colors,
  radius,
  spacing,
  SKILLS,
  EXPERIENCE_LEVELS,
  type as t,
} from "@/src/theme";
import { H2, Body, Muted, PrimaryButton, Field, Chip } from "@/src/ui";
import Dropdown from "@/src/components/dropdown";

const SITE_TYPES = ["Residential", "Commercial"] as const;

export default function PostJob() {
  const router = useRouter();

  const [siteType, setSiteType] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [workerCategory, setWorkerCategory] = useState<string>("");
  const [skillLevel, setSkillLevel] = useState<string>("");
  const [workers, setWorkers] = useState("2");
  const [wage, setWage] = useState("900");
  const [location, setLocation] = useState("");
  const [duration, setDuration] = useState("10");
  const [urgent, setUrgent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async () => {
    setErr("");
    setOk("");
    if (!title.trim() || !description.trim() || !location.trim()) {
      setErr("Fill title, description, and location");
      return;
    }
    if (!siteType) {
      setErr("Please select Site / Project Type");
      return;
    }
    if (!workerCategory) {
      setErr("Please select Worker Category");
      return;
    }
    setBusy(true);
    try {
      await api.postJob({
        title: title.trim(),
        description: description.trim(),
        skill: workerCategory,
        site_project_type: siteType,
        worker_skill_level: skillLevel || null,
        workers_needed: parseInt(workers) || 1,
        daily_wage: parseInt(wage) || 0,
        location: location.trim(),
        site_address: location.trim(),
        duration_days: parseInt(duration) || 1,
        urgency: urgent ? "Urgent" : "Normal",
      });
      setOk("Job posted ✓");
      // Reset form
      setTitle("");
      setDescription("");
      setLocation("");
      setSiteType("");
      setSkillLevel("");
      setTimeout(() => router.replace("/(tabs)/activity"), 700);
    } catch (e: any) {
      setErr(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

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

          {/* 1. Site / Project Type — at very top */}
          <View style={styles.section} testID="section-site-type">
            <Body style={styles.sectionLabel}>Site / Project Type *</Body>
            <View style={styles.segmentRow}>
              {SITE_TYPES.map((st) => (
                <SegmentBtn
                  key={st}
                  testID={`site-type-${st.toLowerCase()}`}
                  icon={st === "Residential" ? "home" : "business"}
                  label={st}
                  selected={siteType === st}
                  onPress={() => setSiteType(st)}
                />
              ))}
            </View>
          </View>

          {/* 2. Job Title */}
          <Field
            testID="job-title-input"
            label="Job Title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Mason needed for 2BHK"
          />

          {/* 3. Description */}
          <Field
            testID="job-desc-input"
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="Scope of work, expectations..."
            multiline
          />

          {/* 4. Worker Category (single-select searchable dropdown — same list as Worker Profile) */}
          <Dropdown
            testID="worker-category"
            label="Worker Category *"
            value={workerCategory}
            options={SKILLS}
            onSelect={setWorkerCategory}
            placeholder="Select worker category"
            searchable
          />

          {/* 5. My Skills — worker skill level (same list as Worker Profile experience levels) */}
          <Dropdown
            testID="worker-skill-level"
            label="My Skills / Required Skill Level"
            value={skillLevel}
            options={[...EXPERIENCE_LEVELS]}
            onSelect={setSkillLevel}
            placeholder="Choose required skill level"
          />

          {/* 6. Workers Needed + Daily Wage (two-column) */}
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Field
                testID="workers-input"
                label="Workers Needed"
                value={workers}
                onChangeText={setWorkers}
                keyboardType="number-pad"
              />
            </View>
            <View style={styles.col}>
              <Field
                testID="wage-input"
                label="Daily Wage (₹)"
                value={wage}
                onChangeText={setWage}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* 7. Location */}
          <Field
            testID="location-input"
            label="Location"
            value={location}
            onChangeText={setLocation}
            placeholder="City, Area"
          />

          {/* 8. Duration */}
          <Field
            testID="duration-input"
            label="Duration (days)"
            value={duration}
            onChangeText={setDuration}
            keyboardType="number-pad"
          />

          {/* 9. Urgency */}
          <Body style={styles.sectionLabel}>Urgency</Body>
          <View style={{ flexDirection: "row", gap: 8, marginBottom: spacing.md }}>
            <Chip
              testID="urgency-normal"
              label="Normal"
              selected={!urgent}
              onPress={() => setUrgent(false)}
            />
            <Chip
              testID="urgency-urgent"
              label="Urgent"
              selected={urgent}
              onPress={() => setUrgent(true)}
            />
          </View>

          {err ? (
            <Body style={{ color: colors.error, marginTop: 4 }}>{err}</Body>
          ) : null}
          {ok ? (
            <Body style={{ color: colors.success, marginTop: 4 }}>{ok}</Body>
          ) : null}
        </ScrollView>
        <View style={styles.cta}>
          <PrimaryButton
            testID="post-job-submit"
            label="Post Job"
            loading={busy}
            onPress={submit}
            icon="paper-plane-outline"
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* --------------------------- Sub-components --------------------------- */

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
      <Body
        style={[
          styles.segmentBtnText,
          selected && styles.segmentBtnTextOn,
        ]}
      >
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
  section: { marginBottom: spacing.md },
  sectionLabel: {
    fontSize: t.sm,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 10,
  },
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
  segmentBtnOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  segmentBtnText: {
    fontSize: t.base,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  segmentBtnTextOn: {
    color: colors.onBrandPrimary,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: { flex: 1, minWidth: 0 },
});
