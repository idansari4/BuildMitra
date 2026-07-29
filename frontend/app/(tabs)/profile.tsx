import React, { useEffect, useState, useCallback } from "react";
import { View, StyleSheet, ScrollView, Pressable, Modal, KeyboardAvoidingView, Platform, Image, Alert, ActionSheetIOS, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, SKILLS, EXPERIENCE_LEVELS, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, Chip, PrimaryButton, Field, SecondaryButton } from "@/src/ui";

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t: tr, lang, setLang } = useT();
  const isWorker = user?.role === "worker";
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [experienceLevel, setExperienceLevel] = useState<string>(
    (user as any)?.experience_level || ""
  );
  const [available, setAvailable] = useState<boolean>(
    (user as any)?.available !== false // default true if undefined
  );
  const [wage, setWage] = useState(String(user?.daily_wage || ""));
  const [city, setCity] = useState(user?.city || "");
  const [company, setCompany] = useState(user?.company_name || "");
  const [exp, setExp] = useState(String(user?.experience_years || ""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [aadhaarModal, setAadhaarModal] = useState(false);
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarBusy, setAadhaarBusy] = useState(false);
  const [aadhaarErr, setAadhaarErr] = useState("");

  // Password change modal state
  const [pwModal, setPwModal] = useState(false);
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

  // Single-select for Job title (worker)
  const toggleSkill = (s: string) =>
    setSkills((cur) => (cur[0] === s ? [] : [s]));

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
      await api.updateMe({
        skills,
        experience_level: experienceLevel || null,
        available,
        daily_wage: parseInt(wage) || 0,
        experience_years: parseInt(exp) || 0,
        city,
        company_name: company,
      });
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
            <H1 style={{ fontSize: t.xl }} testID="profile-name">{user?.name}</H1>
            <Muted>{String(user?.role).toUpperCase()} · {user?.mobile}</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="star" size={14} color={colors.brand} />
              <Body style={{ fontWeight: "700" }}>{user?.rating_avg?.toFixed(1) || "0.0"}</Body>
              <Muted>({user?.rating_count || 0} {tr("common.reviews")})</Muted>
            </View>
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

            {/* Job title */}
            <Card>
              <Body style={{ fontWeight: "700", marginBottom: 4 }} testID="section-job-title">Job title</Body>
              <Muted style={{ fontSize: 12, marginBottom: 10 }}>
                Select your primary trade (choose one)
              </Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SKILLS.map((s) => (
                  <Chip
                    key={s}
                    testID={`profile-jobtitle-${s}`}
                    label={s}
                    selected={skills[0] === s}
                    onPress={() => toggleSkill(s)}
                  />
                ))}
              </View>
            </Card>

            {/* My skills (experience level) */}
            <Card>
              <Body style={{ fontWeight: "700", marginBottom: 4 }} testID="section-my-skills">My skills</Body>
              <Muted style={{ fontSize: 12, marginBottom: 10 }}>Choose your experience level</Muted>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {EXPERIENCE_LEVELS.map((lvl) => (
                  <Chip
                    key={lvl}
                    testID={`profile-skill-level-${lvl}`}
                    label={lvl}
                    selected={experienceLevel === lvl}
                    onPress={() => setExperienceLevel(experienceLevel === lvl ? "" : lvl)}
                  />
                ))}
              </View>
            </Card>

            <Field testID="wage-field" label={tr("profile.expectedWage")} value={wage} onChangeText={setWage} keyboardType="number-pad" />
            <Field testID="exp-field" label={tr("profile.experience")} value={exp} onChangeText={setExp} keyboardType="number-pad" />
            <Field testID="city-field" label={tr("profile.city")} value={city} onChangeText={setCity} placeholder={tr("profile.cityPh")} />
          </>
        ) : (
          <>
            <Field testID="company-field" label={tr("profile.company")} value={company} onChangeText={setCompany} />
            <Field testID="city-field" label={tr("profile.city")} value={city} onChangeText={setCity} />
          </>
        )}

        {msg ? <Body style={{ color: msg.includes("✓") ? colors.success : colors.error }}>{msg}</Body> : null}
        <PrimaryButton testID="save-profile" label={tr("profile.save")} icon="checkmark-circle-outline" loading={busy} onPress={save} />

        <H2 style={{ marginTop: spacing.md }}>{tr("profile.settings")}</H2>

        <Pressable testID="help-support-link" onPress={() => router.push("/help" as any)} style={styles.payrollLink}>
          <Ionicons name="help-buoy" size={22} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body style={{ fontWeight: "700" }}>{tr("complaints.helpSupport")}</Body>
            <Muted style={{ fontSize: 11 }}>{tr("complaints.helpSub")}</Muted>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
        </Pressable>

        <Pressable testID="change-password-link" onPress={() => setPwModal(true)} style={styles.payrollLink}>
          <Ionicons name="key" size={22} color={colors.brand} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body style={{ fontWeight: "700" }}>{tr("profile.changePassword")}</Body>
            <Muted style={{ fontSize: 11 }}>Update your account password</Muted>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
        </Pressable>

        {user?.role === "worker" && (
          <Pressable testID="salary-summary-link" onPress={() => router.push("/salary-summary" as any)} style={styles.payrollLink}>
            <Ionicons name="cash" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Salary Summary</Body>
              <Muted style={{ fontSize: 11 }}>Monthly earnings & attendance</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}

        {(user?.role === "worker" || user?.role === "contractor" || user?.role === "client" || user?.role === "admin") && (
          <Pressable testID="leave-link" onPress={() => router.push("/leave" as any)} style={styles.payrollLink}>
            <Ionicons name="calendar" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Leave Management</Body>
              <Muted style={{ fontSize: 11 }}>{user?.role === "worker" ? "Request leave" : "Approve worker leave"}</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}

        {(user?.role === "contractor" || user?.role === "client") && (
          <Pressable testID="project-progress-link" onPress={() => router.push("/project-progress" as any)} style={styles.payrollLink}>
            <Ionicons name="bar-chart" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Project Progress</Body>
              <Muted style={{ fontSize: 11 }}>Track hiring, days, escrow across jobs</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}

        {(user?.role === "contractor" || user?.role === "client") && (
          <Pressable testID="payroll-link" onPress={() => router.push("/payroll" as any)} style={styles.payrollLink}>
            <Ionicons name="cash" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Body style={{ fontWeight: "700" }}>Payroll</Body>
              <Muted style={{ fontSize: 11 }}>Monthly wages by attendance</Muted>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
          </Pressable>
        )}
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
        <SecondaryButton testID="logout-button" label={tr("common.logout")} onPress={onLogout} />
      </ScrollView>

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
});
