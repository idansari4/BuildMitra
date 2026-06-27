import React, { useState } from "react";
import { View, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { colors, spacing, SKILLS } from "@/src/theme";
import { H2, Body, Muted, PrimaryButton, Field, Chip } from "@/src/ui";

export default function PostJob() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skill, setSkill] = useState(SKILLS[0]);
  const [workers, setWorkers] = useState("2");
  const [wage, setWage] = useState("900");
  const [location, setLocation] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [duration, setDuration] = useState("10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const submit = async () => {
    setErr(""); setOk("");
    if (!title.trim() || !description.trim() || !location.trim()) {
      setErr("Fill title, description, and location"); return;
    }
    setBusy(true);
    try {
      await api.postJob({
        title: title.trim(),
        description: description.trim(),
        skill,
        workers_needed: parseInt(workers) || 1,
        daily_wage: parseInt(wage) || 0,
        location: location.trim(),
        site_address: location.trim(),
        duration_days: parseInt(duration) || 1,
        urgency: urgent ? "Urgent" : "Normal",
      });
      setOk("Job posted ✓");
      setTitle(""); setDescription(""); setLocation("");
      setTimeout(() => router.replace("/(tabs)/activity"), 700);
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <H2 testID="post-job-title">Post a Job</H2>
          <Muted style={{ marginTop: 4, marginBottom: spacing.md }}>Reach 1000+ workers nearby</Muted>

          <Field testID="job-title-input" label="Job Title" value={title} onChangeText={setTitle} placeholder="e.g. Mason needed for 2BHK" />
          <Field testID="job-desc-input" label="Description" value={description} onChangeText={setDescription} placeholder="Scope of work, expectations..." multiline />

          <Body style={{ fontWeight: "700", marginBottom: 8 }}>Skill Required</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.md }} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            {SKILLS.map((s) => (
              <Chip key={s} testID={`skill-pick-${s}`} label={s} selected={skill === s} onPress={() => setSkill(s)} />
            ))}
          </ScrollView>

          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Field testID="workers-input" label="Workers Needed" value={workers} onChangeText={setWorkers} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field testID="wage-input" label="Daily Wage (₹)" value={wage} onChangeText={setWage} keyboardType="number-pad" />
            </View>
          </View>
          <Field testID="location-input" label="Location" value={location} onChangeText={setLocation} placeholder="City, Area" />
          <Field testID="duration-input" label="Duration (days)" value={duration} onChangeText={setDuration} keyboardType="number-pad" />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <Chip testID="urgency-normal" label="Normal" selected={!urgent} onPress={() => setUrgent(false)} />
            <Chip testID="urgency-urgent" label="Urgent" selected={urgent} onPress={() => setUrgent(true)} />
          </View>

          {err ? <Body style={{ color: colors.error, marginTop: 12 }}>{err}</Body> : null}
          {ok ? <Body style={{ color: colors.success, marginTop: 12 }}>{ok}</Body> : null}
        </ScrollView>
        <View style={styles.cta}>
          <PrimaryButton testID="post-job-submit" label="Post Job" loading={busy} onPress={submit} icon="paper-plane-outline" />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  cta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
});
