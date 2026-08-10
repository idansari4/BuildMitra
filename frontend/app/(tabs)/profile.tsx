import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform, Image, Alert, ActionSheetIOS, Switch, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, SKILLS, EXPERIENCE_LEVELS, normalizeExperienceLevel, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, Chip, PrimaryButton, Field } from "@/src/ui";
import ClientProfileBody from "@/src/components/client-profile-body";
import SettingsMenu from "@/src/components/settings-menu";
import Dropdown from "@/src/components/dropdown";
import TimePickerField from "@/src/components/time-picker-field";
import { formatMonthShort } from "@/src/utils/date";

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t: tr, lang, setLang } = useT();
  const isWorker = user?.role === "worker";
  const initialSkill = user?.skills?.[0] || "";
  const initialSkillIsCustom = !!initialSkill && !SKILLS.includes(initialSkill);
  const [skills, setSkills] = useState<string[]>(
    initialSkillIsCustom ? ["Other"] : (user?.skills || [])
  );
  const [customSkill, setCustomSkill] = useState<string>(
    initialSkillIsCustom ? initialSkill : ""
  );
  const [experienceLevel, setExperienceLevel] = useState<string>(
    normalizeExperienceLevel((user as any)?.experience_level) || ""
  );
  const [available, setAvailable] = useState<boolean>(
    (user as any)?.available !== false // default true if undefined
  );
  const [wage, setWage] = useState(String(user?.daily_wage || ""));
  const [city, setCity] = useState(user?.city || "");
  const [company, setCompany] = useState(user?.company_name || "");
  const [exp, setExp] = useState(String(user?.experience_years || ""));
  // New worker-specific fields
  const [age, setAge] = useState(
    (user as any)?.age != null ? String((user as any).age) : ""
  );
  const [gender, setGender] = useState<string>((user as any)?.gender || "");
  const [overtimeAccepted, setOvertimeAccepted] = useState<boolean | null>(
    typeof (user as any)?.overtime_accepted === "boolean"
      ? (user as any).overtime_accepted
      : null
  );
  const [minorToolsAvailable, setMinorToolsAvailable] = useState<boolean | null>(
    typeof (user as any)?.minor_tools_available === "boolean"
      ? (user as any).minor_tools_available
      : null
  );
  // v33+ Working hours & conveyance allowance
  const [workingHoursStart, setWorkingHoursStart] = useState<string>(
    (user as any)?.working_hours_start || ""
  );
  const [workingHoursEnd, setWorkingHoursEnd] = useState<string>(
    (user as any)?.working_hours_end || ""
  );
  const [conveyanceAllowance, setConveyanceAllowance] = useState<boolean | null>(
    typeof (user as any)?.conveyance_allowance === "boolean"
      ? (user as any).conveyance_allowance
      : null
  );
  // v33+ Permanent address
  const [permAddress, setPermAddress] = useState<string>((user as any)?.permanent_address || "");
  const [permCity, setPermCity] = useState<string>((user as any)?.permanent_city || "");
  const [permState, setPermState] = useState<string>((user as any)?.permanent_state || "");
  const [permPin, setPermPin] = useState<string>((user as any)?.permanent_pin_code || "");
  const [permCountry, setPermCountry] = useState<string>((user as any)?.permanent_country || "India");
  // v33+ Aadhaar upload
  const [aadhaarDocBusy, setAadhaarDocBusy] = useState(false);
  const [aadhaarPickerOpen, setAadhaarPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [aadhaarModal, setAadhaarModal] = useState(false);
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarErr, setAadhaarErr] = useState("");

  // Password change modal state
  const [pwModal, setPwModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [pwMsg, setPwMsg] = useState("");

  // Photo upload state
  const [photoBusy, setPhotoBusy] = useState(false);

  const photo: string | undefined = (user as any)?.photo;

  const verifyAadhaar = async () => {
    setAadhaarErr("");
    const clean = aadhaar.replace(/\s/g, "");
    if (clean.length !== 12 || !/^\d{12}$/.test(clean)) {
      setAadhaarErr("Enter a valid 12-digit Aadhaar number");
      return;
    }
    setAadhaarBusy(true);
    try {
      await api.aadhaarVerify(clean);
      await refresh();
      setAadhaarModal(false);
      setAadhaar("");
      setMsg("Aadhaar verified ✓");
    } catch (e: any) {
      setAadhaarErr(e?.message || "Verification failed");
    } finally { setAadhaarBusy(false); }
  };

  const [availStatus, setAvailStatus] = useState<{
    can_enable: boolean;
    profile_complete: boolean;
    missing_fields: string[];
    is_currently_hired: boolean;
    reasons: string[];
    active_jobs_count?: number;
  } | null>(null);

  const fetchAvailStatus = useCallback(async () => {
    if (!isWorker) return;
    try {
      const s = await api.availabilityStatus();
      setAvailStatus(s);
      // Sync local toggle with actual backend-enforced value
      if (typeof s?.current_available === "boolean") {
        setAvailable(s.current_available);
      }
    } catch {}
  }, [isWorker]);

  useEffect(() => {
    fetchAvailStatus();
  }, [fetchAvailStatus]);

  // Re-hydrate Job Title state whenever the current user's skills change
  // (e.g., after refresh() or navigating back into the tab). Ensures a
  // non-canonical value like a custom skill is displayed as "Other" + input.
  useEffect(() => {
    const s = user?.skills?.[0] || "";
    if (!s) {
      setSkills([]);
      setCustomSkill("");
      return;
    }
    if (SKILLS.includes(s)) {
      setSkills([s]);
      setCustomSkill("");
    } else {
      setSkills(["Other"]);
      setCustomSkill(s);
    }
  }, [user?.skills]);

  // Single-select for Job title (worker) — via Dropdown component below
  // (legacy chip-based helper removed)

  const toggleAvailability = async (val: boolean) => {
    // If turning ON, respect rules — block with clear message
    if (val && availStatus && !availStatus.can_enable) {
      const msg =
        availStatus.reasons?.join("\n\n") ||
        "You cannot turn availability on right now.";
      if (Platform.OS === "web") {
        // Web: alert()
        if (typeof window !== "undefined" && (window as any).alert) {
          (window as any).alert(msg);
        }
      } else {
        Alert.alert("Availability locked", msg);
      }
      return;
    }
    const prev = available;
    setAvailable(val);
    try {
      await api.updateMe({ available: val });
      await refresh();
      await fetchAvailStatus();
    } catch (e: any) {
      // revert on error
      setAvailable(prev);
      setMsg(e?.message || tr("common.failed"));
    }
  };

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      // Resolve final job title — if user picked "Other", persist the custom text
      const finalSkill =
        skills[0] === "Other" && customSkill.trim()
          ? customSkill.trim()
          : (skills[0] || null);
      const payload: any = {
        skills: finalSkill ? [finalSkill] : [],
        experience_level: experienceLevel || null,
        available,
        daily_wage: parseInt(wage) || 0,
        experience_years: parseInt(exp) || 0,
        city,
        company_name: company,
      };
      if (isWorker) {
        payload.age = age ? parseInt(age) || 0 : 0;
        payload.gender = gender || null;
        if (overtimeAccepted !== null) payload.overtime_accepted = overtimeAccepted;
        if (minorToolsAvailable !== null) payload.minor_tools_available = minorToolsAvailable;
        if (conveyanceAllowance !== null) payload.conveyance_allowance = conveyanceAllowance;
        if (workingHoursStart) payload.working_hours_start = workingHoursStart;
        if (workingHoursEnd) payload.working_hours_end = workingHoursEnd;
      }
      if (isWorker || user?.role === "contractor") {
        // Permanent address (shared between worker + contractor for KYC).
        // Empty string clears a field intentionally.
        payload.permanent_address = permAddress;
        payload.permanent_city = permCity;
        payload.permanent_state = permState;
        payload.permanent_pin_code = permPin;
        payload.permanent_country = permCountry;
      }
      await api.updateMe(payload);
      await refresh();
      await fetchAvailStatus();
      setMsg(tr("common.saved"));
    } catch (e: any) { setMsg(e?.message || tr("common.failed")); }
    finally { setBusy(false); }
  };

  const pickPhoto = async (source: "library" | "camera") => {
    setMsg("");
    try {
      if (source === "camera") {
        const cam = await ImagePicker.requestCameraPermissionsAsync();
        if (cam.status !== "granted") { setMsg("Camera permission denied"); return; }
      } else {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (lib.status !== "granted") { setMsg("Gallery permission denied"); return; }
      }
      const opts: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true, quality: 0.5, allowsEditing: true, aspect: [1, 1],
      };
      const res = source === "camera"
        ? await ImagePicker.launchCameraAsync({ ...opts, cameraType: ImagePicker.CameraType.front })
        : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets?.[0]?.base64) return;
      setPhotoBusy(true);
      const dataUrl = "data:image/jpeg;base64," + res.assets[0].base64;
      await api.updateMe({ photo: dataUrl });
      await refresh();
      setMsg(tr("profile.photoUpdated"));
    } catch (e: any) {
      setMsg(e?.message || tr("common.failed"));
    } finally { setPhotoBusy(false); }
  };

  const removePhoto = async () => {
    setPhotoBusy(true); setMsg("");
    try {
      await api.updateMe({ photo: "" });
      await refresh();
      setMsg(tr("common.saved"));
    } catch (e: any) {
      setMsg(e?.message || tr("common.failed"));
    } finally { setPhotoBusy(false); }
  };

  const uploadAadhaarDoc = async (source: "image" | "pdf") => {
    setAadhaarPickerOpen(false);
    setAadhaarDocBusy(true);
    setMsg("");
    try {
      if (source === "image") {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== "granted") {
          setMsg("Gallery permission denied");
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          base64: true,
          quality: 0.6,
        });
        if (res.canceled || !res.assets?.[0]?.base64) return;
        const a = res.assets[0];
        await api.updateMe({
          aadhaar_document_url: `data:image/jpeg;base64,${a.base64}`,
          aadhaar_document_type: "image",
          aadhaar_document_name: a.fileName || "aadhaar.jpg",
        });
      } else {
        const DocumentPicker = await import("expo-document-picker");
        const res = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf"],
          copyToCacheDirectory: true,
          multiple: false,
        });
        if (res.canceled || !res.assets?.[0]) return;
        const a = res.assets[0];
        const nameLower = (a.name || "").toLowerCase();
        const mimeOk = a.mimeType === "application/pdf" || nameLower.endsWith(".pdf");
        if (!mimeOk) {
          setMsg("Selected file is not a PDF");
          return;
        }
        const FileSystem = await import("expo-file-system");
        const b64 = await (FileSystem as any).readAsStringAsync(a.uri, { encoding: "base64" });
        await api.updateMe({
          aadhaar_document_url: `data:application/pdf;base64,${b64}`,
          aadhaar_document_type: "pdf",
          aadhaar_document_name: a.name || "aadhaar.pdf",
        });
      }
      await refresh();
      setMsg("Aadhaar document uploaded ✓ (Pending verification)");
    } catch (e: any) {
      setMsg(e?.message || "Failed to upload Aadhaar");
    } finally {
      setAadhaarDocBusy(false);
    }
  };

  const onAvatarPress = () => {
    const options: string[] = [
      tr("profile.changePhoto") + " (Camera)",
      tr("profile.changePhoto") + " (Gallery)",
    ];
    if (photo) options.push(tr("profile.removePhoto"));
    options.push(tr("common.cancel"));
    const cancelIdx = options.length - 1;
    const destIdx = photo ? options.length - 2 : -1;

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIdx, destructiveButtonIndex: destIdx },
        (idx) => {
          if (idx === 0) pickPhoto("camera");
          else if (idx === 1) pickPhoto("library");
          else if (photo && idx === destIdx) removePhoto();
        }
      );
    } else {
      // Android - use Alert
      const buttons: any[] = [
        { text: tr("profile.changePhoto") + " (Camera)", onPress: () => pickPhoto("camera") },
        { text: tr("profile.changePhoto") + " (Gallery)", onPress: () => pickPhoto("library") },
      ];
      if (photo) buttons.push({ text: tr("profile.removePhoto"), style: "destructive", onPress: removePhoto });
      buttons.push({ text: tr("common.cancel"), style: "cancel" });
      Alert.alert(tr("profile.changePhoto"), undefined, buttons);
    }
  };

  const submitPassword = async () => {
    setPwErr(""); setPwMsg("");
    if (!oldPw || !newPw || !confirmPw) { setPwErr("All fields required"); return; }
    if (newPw.length < 4) { setPwErr(tr("profile.passwordShort")); return; }
    if (newPw !== confirmPw) { setPwErr(tr("profile.passwordMismatch")); return; }
    setPwBusy(true);
    try {
      await api.changePassword(oldPw, newPw);
      setPwMsg(tr("profile.passwordUpdated"));
      setOldPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => { setPwModal(false); setPwMsg(""); }, 1200);
    } catch (e: any) {
      setPwErr(e?.message || tr("common.failed"));
    } finally { setPwBusy(false); }
  };

  const closePwModal = () => {
    setPwModal(false);
    setOldPw(""); setNewPw(""); setConfirmPw(""); setPwErr(""); setPwMsg("");
  };

  const onLogout = async () => { await logout(); router.replace("/role-select"); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}>
        {/* Top-right hamburger menu */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }} />
          <Pressable testID="hamburger-menu" onPress={() => setMenuOpen(true)} style={styles.hamburgerBtn}>
            <Ionicons name="menu" size={26} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.head}>
          <Pressable testID="avatar-edit" onPress={onAvatarPress} style={styles.avatarWrap} disabled={photoBusy}>
            {photo ? (
              <Image source={{ uri: photo }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatar}>
                <Body style={{ fontSize: 32, fontWeight: "800", color: colors.onBrandPrimary }}>
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </Body>
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name={photoBusy ? "hourglass" : "camera"} size={14} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <H1 style={{ fontSize: t.xl }} testID="profile-name" numberOfLines={2}>{user?.name}</H1>
              {user?.aadhaar_verified ? (
                <Ionicons name="checkmark-circle" size={18} color={colors.brand} />
              ) : null}
            </View>
            <Muted>{String(user?.role).toUpperCase()} · {user?.mobile}</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
              <Ionicons name="star" size={14} color={colors.brand} />
              <Body style={{ fontWeight: "700" }}>{user?.rating_avg?.toFixed(1) || "0.0"}</Body>
              <Muted>({user?.rating_count || 0} {tr("common.reviews")})</Muted>
              {(user?.city || user?.state) ? (
                <>
                  <Muted> · </Muted>
                  <Ionicons name="location" size={12} color={colors.onSurfaceSecondary} />
                  <Muted>{[user?.city, user?.state].filter(Boolean).join(", ")}</Muted>
                </>
              ) : null}
            </View>
            {isWorker && user?.created_at ? (
              <Muted style={{ fontSize: 11, marginTop: 2 }}>
                Joined {formatMonthShort(user.created_at)}
              </Muted>
            ) : null}
          </View>
        </View>

        {isWorker ? (
          <>
            {/* Availability toggle */}
            <Card testID="availability-card">
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <View
                  style={[
                    styles.availIcon,
                    {
                      backgroundColor: available
                        ? "#DCFCE7"
                        : availStatus && !availStatus.can_enable
                        ? "#FEE2E2"
                        : colors.surfaceSecondary,
                    },
                  ]}
                >
                  <Ionicons
                    name={
                      available
                        ? "checkmark-circle"
                        : availStatus && !availStatus.can_enable
                        ? "lock-closed"
                        : "power"
                    }
                    size={22}
                    color={
                      available
                        ? colors.success
                        : availStatus && !availStatus.can_enable
                        ? colors.error
                        : colors.onSurfaceSecondary
                    }
                  />
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Body style={{ fontWeight: "800" }}>Availability</Body>
                  <Muted style={{ fontSize: 12, marginTop: 2 }} numberOfLines={3}>
                    {available
                      ? "You are visible to clients for new work"
                      : availStatus?.is_currently_hired
                      ? "Currently hired on a job — availability locked OFF"
                      : availStatus && !availStatus.profile_complete
                      ? "Complete your profile to enable availability"
                      : "You will not receive new job offers"}
                  </Muted>
                </View>
                <Switch
                  testID="availability-toggle"
                  value={available}
                  onValueChange={toggleAvailability}
                  disabled={!available && !!availStatus && !availStatus.can_enable}
                  trackColor={{ false: colors.border, true: colors.brand }}
                  thumbColor={colors.surface}
                  ios_backgroundColor={colors.border}
                />
              </View>
              {/* Lock/incomplete details */}
              {availStatus && !availStatus.can_enable && !available ? (
                <View style={styles.lockBanner} testID="availability-locked-banner">
                  <Ionicons name="alert-circle" size={16} color={colors.error} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    {availStatus.reasons.map((r, i) => (
                      <Body key={i} style={{ fontSize: 12, color: colors.error, marginBottom: 2 }}>
                        {r}
                      </Body>
                    ))}
                  </View>
                </View>
              ) : null}
              {/* Profile completion progress */}
              {availStatus && !availStatus.profile_complete ? (
                <View style={styles.progressWrap}>
                  {(() => {
                    const total = 6; // name, skills, level, wage, exp, city
                    const done = total - availStatus.missing_fields.length;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <>
                        <View style={styles.progressHeader}>
                          <Muted style={{ fontSize: 11, fontWeight: "700" }}>
                            Profile {pct}% complete ({done}/{total})
                          </Muted>
                          <Muted style={{ fontSize: 10 }}>
                            Missing: {availStatus.missing_fields.join(", ")}
                          </Muted>
                        </View>
                        <View style={styles.progressTrack}>
                          <View style={[styles.progressBar, { width: `${pct}%` }]} />
                        </View>
                      </>
                    );
                  })()}
                </View>
              ) : null}
            </Card>

            {/* Job title dropdown (single-select, searchable) */}
            <Card>
              <Dropdown
                testID="worker-job-title"
                label="Job Title"
                required
                value={skills[0] || ""}
                options={SKILLS}
                onSelect={(v) => {
                  setSkills([v]);
                  if (v !== "Other") setCustomSkill("");
                }}
                placeholder="Select your primary trade"
                searchable
              />
              {skills[0] === "Other" ? (
                <Field
                  testID="worker-custom-skill"
                  label="Enter Your Skill"
                  required
                  value={customSkill}
                  onChangeText={setCustomSkill}
                  placeholder="e.g., Aluminium Welder"
                />
              ) : null}
              <Dropdown
                testID="worker-skill-level"
                label="My Skills / Experience Level"
                value={normalizeExperienceLevel(experienceLevel)}
                options={EXPERIENCE_LEVELS}
                onSelect={setExperienceLevel}
                placeholder="Choose experience level"
              />
            </Card>

            {/* Worker Details — compact two-column layout */}
            <Card>
              <Body style={{ fontWeight: "800", marginBottom: 12 }} testID="section-worker-details">
                Worker Details
              </Body>

              {/* Row 1: Wage + Experience */}
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Field
                    testID="wage-field"
                    label="Expected Daily Wages (₹)"
                    value={wage}
                    onChangeText={setWage}
                    keyboardType="number-pad"
                    placeholder="e.g., 800"
                  />
                </View>
                <View style={styles.col}>
                  <Field
                    testID="exp-field"
                    label="Experience (Years)"
                    value={exp}
                    onChangeText={setExp}
                    keyboardType="number-pad"
                    placeholder="e.g., 5"
                  />
                </View>
              </View>

              {/* Row 2: Age + Gender */}
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Field
                    testID="age-field"
                    label="Age"
                    value={age}
                    onChangeText={setAge}
                    keyboardType="number-pad"
                    placeholder="e.g., 28"
                  />
                </View>
                <View style={styles.col}>
                  <Dropdown
                    testID="gender-field"
                    label="Gender"
                    value={gender}
                    options={["Male", "Female"]}
                    onSelect={setGender}
                    placeholder="Select"
                  />
                </View>
              </View>

              {/* Working Hours */}
              <Body style={{ fontWeight: "700", marginBottom: 6, fontSize: 13, color: colors.onSurfaceSecondary }}>
                Working Hours <Text style={{ color: "#DC2626" }}>*</Text>
              </Body>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <TimePickerField
                    testID="working-hours-start"
                    label="Start Time"
                    value={workingHoursStart}
                    onChange={setWorkingHoursStart}
                    placeholder="09:00 AM"
                  />
                </View>
                <View style={styles.col}>
                  <TimePickerField
                    testID="working-hours-end"
                    label="End Time"
                    value={workingHoursEnd}
                    onChange={setWorkingHoursEnd}
                    placeholder="05:00 PM"
                  />
                </View>
              </View>

              {/* Overtime */}
              <YesNoRow
                label="Overtime Accepted"
                value={overtimeAccepted}
                onChange={setOvertimeAccepted}
                testID="overtime-row"
              />

              {/* Minor tools */}
              <YesNoRow
                label="Tools Availability (Minor Tools)"
                value={minorToolsAvailable}
                onChange={setMinorToolsAvailable}
                testID="minor-tools-row"
              />

              {/* Conveyance Allowance */}
              <YesNoRow
                label="Conveyance Allowance"
                value={conveyanceAllowance}
                onChange={setConveyanceAllowance}
                testID="conveyance-row"
              />
            </Card>

            <Field
              testID="city-field"
              label={tr("profile.city")}
              value={city}
              onChangeText={setCity}
              placeholder={tr("profile.cityPh")}
            />

            {/* Permanent Address (KYC only) */}
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Ionicons name="home" size={18} color={colors.brand} />
                <Body style={{ fontWeight: "800" }}>Permanent Address</Body>
              </View>
              <Muted style={{ fontSize: 11, marginBottom: 10 }}>
                Used only for KYC / Aadhaar verification. Not shown publicly.
              </Muted>
              <Field
                testID="perm-address"
                label="Permanent Address"
                value={permAddress}
                onChangeText={setPermAddress}
                placeholder="Village / Building, Street"
                multiline
              />
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Field testID="perm-city" label="City" value={permCity} onChangeText={setPermCity} placeholder="e.g., Patna" />
                </View>
                <View style={styles.col}>
                  <Field testID="perm-state" label="State" value={permState} onChangeText={setPermState} placeholder="e.g., Bihar" />
                </View>
              </View>
              <View style={styles.twoCol}>
                <View style={styles.col}>
                  <Field testID="perm-pin" label="PIN Code" value={permPin} onChangeText={setPermPin} keyboardType="number-pad" placeholder="800001" />
                </View>
                <View style={styles.col}>
                  <Field testID="perm-country" label="Country" value={permCountry} onChangeText={setPermCountry} placeholder="India" />
                </View>
              </View>
            </Card>

            {/* Aadhaar / Identity Verification */}
            <Card>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Ionicons name="shield-checkmark" size={18} color={colors.brand} />
                <Body style={{ fontWeight: "800" }}>Identity Verification</Body>
              </View>
              <Muted style={{ fontSize: 11, marginBottom: 12 }}>
                Upload your Aadhaar (image or PDF). Only visible to admin & verifier.
              </Muted>

              {(user as any)?.aadhaar_document_url ? (
                <View style={styles.aadhaarPreview}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Ionicons
                      name={(user as any)?.aadhaar_document_type === "pdf" ? "document-text" : "image"}
                      size={22}
                      color={colors.brand}
                    />
                    <View style={{ flex: 1 }}>
                      <Body style={{ fontWeight: "700" }} numberOfLines={1}>
                        {(user as any)?.aadhaar_document_name || "Aadhaar document"}
                      </Body>
                      <AadhaarStatusPill status={(user as any)?.aadhaar_status || "pending"} />
                    </View>
                  </View>
                  {(user as any)?.aadhaar_status === "rejected" && (user as any)?.aadhaar_rejection_reason ? (
                    <Muted style={{ marginTop: 8, fontSize: 12, color: colors.error }}>
                      Reason: {(user as any).aadhaar_rejection_reason}
                    </Muted>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                testID="aadhaar-upload-btn"
                onPress={() => setAadhaarPickerOpen(true)}
                disabled={aadhaarDocBusy}
                style={({ pressed }) => [
                  styles.aadhaarUploadBtn,
                  pressed && { opacity: 0.85 },
                  aadhaarDocBusy && { opacity: 0.5 },
                ]}
              >
                <Ionicons name="cloud-upload" size={20} color={colors.brand} />
                <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 8 }}>
                  {(user as any)?.aadhaar_document_url ? "Replace Aadhaar Document" : "Upload Aadhaar Card"}
                </Body>
              </Pressable>
            </Card>
          </>
        ) : user?.role === "client" || user?.role === "contractor" ? (
          <>
            <ClientProfileBody
              user={user}
              onSaved={refresh}
              onNavigate={(route) => router.push(route as any)}
            />
            {user?.role === "contractor" ? (
              <>
                {/* Permanent Address (KYC only) */}
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <Ionicons name="home" size={18} color={colors.brand} />
                    <Body style={{ fontWeight: "800" }}>Permanent Address</Body>
                  </View>
                  <Muted style={{ fontSize: 11, marginBottom: 10 }}>
                    Used only for KYC / Aadhaar verification. Not shown publicly.
                  </Muted>
                  <Field testID="perm-address" label="Permanent Address" value={permAddress} onChangeText={setPermAddress} placeholder="Village / Building, Street" multiline />
                  <View style={styles.twoCol}>
                    <View style={styles.col}>
                      <Field testID="perm-city" label="City" value={permCity} onChangeText={setPermCity} placeholder="e.g., Patna" />
                    </View>
                    <View style={styles.col}>
                      <Field testID="perm-state" label="State" value={permState} onChangeText={setPermState} placeholder="e.g., Bihar" />
                    </View>
                  </View>
                  <View style={styles.twoCol}>
                    <View style={styles.col}>
                      <Field testID="perm-pin" label="PIN Code" value={permPin} onChangeText={setPermPin} keyboardType="number-pad" placeholder="800001" />
                    </View>
                    <View style={styles.col}>
                      <Field testID="perm-country" label="Country" value={permCountry} onChangeText={setPermCountry} placeholder="India" />
                    </View>
                  </View>
                  <PrimaryButton
                    testID="perm-save-btn"
                    label="Save Permanent Address"
                    icon="checkmark-circle-outline"
                    loading={busy}
                    onPress={save}
                  />
                </Card>

                {/* Aadhaar / Identity Verification */}
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <Ionicons name="shield-checkmark" size={18} color={colors.brand} />
                    <Body style={{ fontWeight: "800" }}>Identity Verification</Body>
                  </View>
                  <Muted style={{ fontSize: 11, marginBottom: 12 }}>
                    Upload your Aadhaar (image or PDF). Only visible to admin & verifier.
                  </Muted>
                  {(user as any)?.aadhaar_document_url ? (
                    <View style={styles.aadhaarPreview}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Ionicons
                          name={(user as any)?.aadhaar_document_type === "pdf" ? "document-text" : "image"}
                          size={22}
                          color={colors.brand}
                        />
                        <View style={{ flex: 1 }}>
                          <Body style={{ fontWeight: "700" }} numberOfLines={1}>
                            {(user as any)?.aadhaar_document_name || "Aadhaar document"}
                          </Body>
                          <AadhaarStatusPill status={(user as any)?.aadhaar_status || "pending"} />
                        </View>
                      </View>
                      {(user as any)?.aadhaar_status === "rejected" && (user as any)?.aadhaar_rejection_reason ? (
                        <Muted style={{ marginTop: 8, fontSize: 12, color: colors.error }}>
                          Reason: {(user as any).aadhaar_rejection_reason}
                        </Muted>
                      ) : null}
                    </View>
                  ) : null}
                  <Pressable
                    testID="aadhaar-upload-btn"
                    onPress={() => setAadhaarPickerOpen(true)}
                    disabled={aadhaarDocBusy}
                    style={({ pressed }) => [
                      styles.aadhaarUploadBtn,
                      pressed && { opacity: 0.85 },
                      aadhaarDocBusy && { opacity: 0.5 },
                    ]}
                  >
                    <Ionicons name="cloud-upload" size={20} color={colors.brand} />
                    <Body style={{ color: colors.brand, fontWeight: "700", marginLeft: 8 }}>
                      {(user as any)?.aadhaar_document_url ? "Replace Aadhaar Document" : "Upload Aadhaar Card"}
                    </Body>
                  </Pressable>
                </Card>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Field testID="company-field" label={tr("profile.company")} value={company} onChangeText={setCompany} />
            <Field testID="city-field" label={tr("profile.city")} value={city} onChangeText={setCity} />
          </>
        )}

        {msg ? <Body style={{ color: msg.includes("✓") ? colors.success : colors.error }}>{msg}</Body> : null}
        {(isWorker || (user?.role !== "client" && user?.role !== "contractor")) ? (
          <PrimaryButton testID="save-profile" label={tr("profile.save")} icon="checkmark-circle-outline" loading={busy} onPress={save} />
        ) : null}

        <Pressable testID="chat-link" onPress={() => router.push("/chat-list" as any)} style={styles.payrollLink}>
          <Ionicons name="chatbubbles" size={22} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body style={{ fontWeight: "700" }}>Messages</Body>
            <Muted style={{ fontSize: 11 }}>In-app chat</Muted>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
        </Pressable>
        <Card>
          <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Ionicons name="language" size={20} color={colors.brand} />
              <Body style={{ marginLeft: 12, flex: 1 }}>{tr("profile.language")}</Body>
            </View>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
              <Chip testID="lang-en" label="English" selected={lang === "en"} onPress={() => setLang("en")} />
              <Chip testID="lang-hi" label="हिंदी" selected={lang === "hi"} onPress={() => setLang("hi")} />
            </View>
          </View>
          <Row icon="shield-checkmark" label={tr("profile.aadhaar")} value={user?.["aadhaar_verified" as any] ? `${tr("common.verified")}${user?.["aadhaar_last4" as any] ? ` ····${user["aadhaar_last4" as any]}` : ""}` : tr("common.notVerified")} />
          {!user?.["aadhaar_verified" as any] && (
            <Pressable testID="open-aadhaar-modal" onPress={() => setAadhaarModal(true)} style={styles.verifyBtn}>
              <Ionicons name="finger-print" size={16} color={colors.onBrandPrimary} />
              <Body style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: t.sm, marginLeft: 6 }}>Verify Aadhaar Now</Body>
            </Pressable>
          )}
          <Row icon="call" label={tr("profile.whatsapp")} value="+91 90000 00000" />
        </Card>
      </ScrollView>

      {/* Aadhaar document source chooser */}
      <Modal
        visible={aadhaarPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAadhaarPickerOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" }}
          onPress={() => setAadhaarPickerOpen(false)}
        >
          <Pressable onPress={() => {}} style={styles.aadhaarSheet}>
            <View style={{ alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 8 }} />
            <Body style={{ fontSize: 18, fontWeight: "800", marginBottom: 12 }}>Upload Aadhaar</Body>
            <Pressable
              testID="aadhaar-choose-image"
              onPress={() => uploadAadhaarDoc("image")}
              style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}
            >
              <Ionicons name="image" size={22} color={colors.brand} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Body style={{ fontWeight: "700" }}>Image (Gallery)</Body>
                <Muted style={{ fontSize: 12 }}>JPG, PNG</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
            <Pressable
              testID="aadhaar-choose-pdf"
              onPress={() => uploadAadhaarDoc("pdf")}
              style={{ flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 10 }}
            >
              <Ionicons name="document-text" size={22} color={colors.brand} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Body style={{ fontWeight: "700" }}>PDF Document</Body>
                <Muted style={{ fontSize: 12 }}>From Downloads / Files</Muted>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
            <Pressable
              testID="aadhaar-choose-cancel"
              onPress={() => setAadhaarPickerOpen(false)}
              style={{ padding: 14, borderRadius: 10, backgroundColor: colors.surfaceSecondary, alignItems: "center", marginTop: 4 }}
            >
              <Body style={{ fontWeight: "700", color: colors.onSurfaceSecondary }}>Cancel</Body>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Settings Menu bottom sheet */}
      <SettingsMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        role={(user?.role as any) || "worker"}
        onEditProfile={() => { /* fields are inline editable — closing sheet is enough */ }}
        onMyReviews={() => router.push("/rating" as any)}
        onNotificationSettings={() => router.push("/help" as any)}
        onChangePassword={() => setPwModal(true)}
        onLeaveManagement={() => router.push("/leave" as any)}
        onProjectProgress={() => router.push("/project-progress" as any)}
        onPayroll={() => router.push(user?.role === "worker" ? "/salary-summary" : "/payroll" as any)}
        onAttendance={() => router.push("/(tabs)/attendance" as any)}
        onHelpSupport={() => router.push("/help" as any)}
        onPrivacyPolicy={() => router.push("/legal/privacy" as any)}
        onTerms={() => router.push("/legal/terms" as any)}
        onLogout={onLogout}
      />

      {/* Aadhaar Modal */}
      <Modal visible={aadhaarModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAadhaarModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable testID="close-aadhaar" onPress={() => setAadhaarModal(false)}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
              <H2>Aadhaar Verification</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
              <View style={styles.aadhaarHero}>
                <Ionicons name="shield-checkmark" size={48} color={colors.brand} />
                <H2 style={{ marginTop: spacing.md }}>Get the verified badge</H2>
                <Muted style={{ marginTop: 6, textAlign: "center" }}>
                  Verified profiles get 3x more job offers. Your Aadhaar is checksum-validated locally — we only store the last 4 digits.
                </Muted>
              </View>
              <Field
                testID="aadhaar-input"
                label="12-digit Aadhaar Number"
                value={aadhaar}
                onChangeText={(v) => setAadhaar(v.replace(/\D/g, "").slice(0, 12))}
                keyboardType="number-pad"
                placeholder="XXXX XXXX XXXX"
              />
              {aadhaarErr ? <Body style={{ color: colors.error }}>{aadhaarErr}</Body> : null}
              <View style={styles.testHint}>
                <Ionicons name="information-circle" size={16} color={colors.brand} />
                <Muted style={{ marginLeft: 6, flex: 1 }}>
                  Demo test number: <Body style={{ fontWeight: "800", color: colors.brand }}>234123412346</Body>
                </Muted>
              </View>
            </ScrollView>
            <View style={styles.modalCta}>
              <PrimaryButton testID="verify-aadhaar-submit" label="Verify Aadhaar" icon="checkmark-circle" loading={aadhaarBusy} onPress={verifyAadhaar} />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Password Change Modal */}
      <Modal visible={pwModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePwModal}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <View style={styles.modalHead}>
              <Pressable testID="close-password" onPress={closePwModal}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
              <H2>{tr("profile.changePassword")}</H2>
              <View style={{ width: 26 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }} keyboardShouldPersistTaps="handled">
              <View style={styles.aadhaarHero}>
                <Ionicons name="key" size={48} color={colors.brand} />
                <H2 style={{ marginTop: spacing.md }}>{tr("profile.changePassword")}</H2>
                <Muted style={{ marginTop: 6, textAlign: "center" }}>
                  Choose a strong password with at least 4 characters.
                </Muted>
              </View>
              <Field
                testID="old-password"
                label={tr("profile.oldPassword")}
                value={oldPw}
                onChangeText={setOldPw}
                secureTextEntry
                placeholder="••••••••"
              />
              <Field
                testID="new-password"
                label={tr("profile.newPassword")}
                value={newPw}
                onChangeText={setNewPw}
                secureTextEntry
                placeholder="••••••••"
              />
              <Field
                testID="confirm-password"
                label={tr("profile.confirmPassword")}
                value={confirmPw}
                onChangeText={setConfirmPw}
                secureTextEntry
                placeholder="••••••••"
              />
              {pwErr ? <Body style={{ color: colors.error }}>{pwErr}</Body> : null}
              {pwMsg ? <Body style={{ color: colors.success, fontWeight: "700" }}>{pwMsg}</Body> : null}
            </ScrollView>
            <View style={styles.modalCta}>
              <PrimaryButton
                testID="submit-password"
                label={tr("profile.updatePassword")}
                icon="checkmark-circle"
                loading={pwBusy}
                onPress={submitPassword}
              />
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Row({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Body>{label}</Body>
      </View>
      <Muted>{value}</Muted>
    </View>
  );
}

function AadhaarStatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    verified: { label: "Verified", color: "#065F46", bg: "#D1FAE5", icon: "checkmark-circle" },
    pending: { label: "Pending Verification", color: "#92400E", bg: "#FEF3C7", icon: "hourglass" },
    rejected: { label: "Verification Failed", color: "#991B1B", bg: "#FEE2E2", icon: "close-circle" },
    not_uploaded: { label: "Not Uploaded", color: "#4B5563", bg: "#E5E7EB", icon: "cloud-upload" },
  };
  const s = map[status] || map.pending;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
      <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Ionicons name={s.icon} size={11} color={s.color} />
        <Text style={{ fontSize: 10, fontWeight: "800", color: s.color }}>{s.label}</Text>
      </View>
    </View>
  );
}

function YesNoRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.yesNoWrap} testID={testID}>
      <Body style={styles.yesNoLabel} numberOfLines={2}>
        {label}
      </Body>
      <View style={styles.yesNoBtnGroup}>
        <Pressable
          testID={testID ? `${testID}-yes` : undefined}
          onPress={() => onChange(true)}
          style={[styles.yesNoBtn, value === true && styles.yesNoBtnOn]}
        >
          <Body
            style={[
              styles.yesNoBtnText,
              value === true && styles.yesNoBtnTextOn,
            ]}
          >
            Yes
          </Body>
        </Pressable>
        <Pressable
          testID={testID ? `${testID}-no` : undefined}
          onPress={() => onChange(false)}
          style={[styles.yesNoBtn, value === false && styles.yesNoBtnOn]}
        >
          <Body
            style={[
              styles.yesNoBtnText,
              value === false && styles.yesNoBtnTextOn,
            ]}
          >
            No
          </Body>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.sm },
  avatarWrap: { width: 72, height: 72, position: "relative" },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  avatarImg: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brandTertiary },
  cameraBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.surface,
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  verifyBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: colors.brand, padding: 10, borderRadius: radius.md, marginVertical: 10,
  },
  modalHead: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  aadhaarHero: { alignItems: "center", padding: spacing.lg, marginBottom: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.lg },
  testHint: { flexDirection: "row", alignItems: "center", marginTop: 8, padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceSecondary },
  modalCta: { padding: spacing.md, paddingBottom: spacing.xl, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  payrollLink: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: 8 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: -8,
  },
  hamburgerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  availIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  lockBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  progressWrap: {
    marginTop: 12,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.surfaceSecondary,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: colors.brand,
    borderRadius: 3,
  },
  twoCol: {
    flexDirection: "row",
    gap: 12,
  },
  col: {
    flex: 1,
    minWidth: 0,
  },
  yesNoWrap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: 12,
  },
  yesNoLabel: {
    flex: 1,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
  },
  yesNoBtnGroup: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  yesNoBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    minWidth: 62,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  yesNoBtnOn: {
    backgroundColor: colors.brand,
  },
  yesNoBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  yesNoBtnTextOn: {
    color: colors.onBrandPrimary,
  },
  aadhaarPreview: {
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
    marginBottom: 10,
  },
  aadhaarUploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.brand + "88",
    borderRadius: radius.md,
    backgroundColor: colors.brandTertiary + "44",
  },
  aadhaarSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
});
