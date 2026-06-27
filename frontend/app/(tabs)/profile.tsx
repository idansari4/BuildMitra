import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, SKILLS, type as t } from "@/src/theme";
import { H1, H2, Body, Muted, Card, Chip, PrimaryButton, Field, SecondaryButton } from "@/src/ui";

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const { t: tr, lang, setLang } = useT();
  const isWorker = user?.role === "worker";
  const [skills, setSkills] = useState<string[]>(user?.skills || []);
  const [wage, setWage] = useState(String(user?.daily_wage || ""));
  const [city, setCity] = useState(user?.city || "");
  const [company, setCompany] = useState(user?.company_name || "");
  const [exp, setExp] = useState(String(user?.experience_years || ""));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const toggleSkill = (s: string) => setSkills((cur) => cur.includes(s) ? cur.filter(x => x !== s) : [...cur, s]);

  const save = async () => {
    setBusy(true); setMsg("");
    try {
      await api.updateMe({
        skills,
        daily_wage: parseInt(wage) || 0,
        experience_years: parseInt(exp) || 0,
        city,
        company_name: company,
      });
      await refresh();
      setMsg("Saved ✓");
    } catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const onLogout = async () => { await logout(); router.replace("/role-select"); };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}>
        <View style={styles.head}>
          <View style={styles.avatar}>
            <Body style={{ fontSize: 32, fontWeight: "800", color: colors.onBrandPrimary }}>
              {user?.name?.[0]?.toUpperCase() || "U"}
            </Body>
          </View>
          <View style={{ flex: 1 }}>
            <H1 style={{ fontSize: t.xl }} testID="profile-name">{user?.name}</H1>
            <Muted>{String(user?.role).toUpperCase()} · {user?.mobile}</Muted>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
              <Ionicons name="star" size={14} color={colors.brand} />
              <Body style={{ fontWeight: "700" }}>{user?.rating_avg?.toFixed(1) || "0.0"}</Body>
              <Muted>({user?.rating_count || 0} reviews)</Muted>
            </View>
          </View>
        </View>

        {isWorker ? (
          <>
            <Card>
              <Body style={{ fontWeight: "700", marginBottom: 10 }}>{tr("profile.mySkills")}</Body>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {SKILLS.map((s) => (
                  <Chip key={s} testID={`profile-skill-${s}`} label={s} selected={skills.includes(s)} onPress={() => toggleSkill(s)} />
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
          <Row icon="shield-checkmark" label={tr("profile.aadhaar")} value={user?.["aadhaar_verified" as any] ? tr("common.verified") : tr("common.notVerified")} />
          <Row icon="call" label={tr("profile.whatsapp")} value="+91 90000 00000" />
        </Card>
        <SecondaryButton testID="logout-button" label={tr("common.logout")} onPress={onLogout} />
      </ScrollView>
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
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center",
  },
  row: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
});
