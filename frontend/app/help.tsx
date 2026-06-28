import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, Linking, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { useT } from "@/src/i18n";
import { colors, radius, spacing, type as tt } from "@/src/theme";
import { H2, Body, Muted, Card } from "@/src/ui";

const APP_VERSION = "1.0.0";
const SUPPORT_PHONE = "+919000000000";
const SUPPORT_WHATSAPP = "+919000000000";
const SUPPORT_EMAIL = "support@buildmitra.in";

type FaqItem = { q_en: string; q_hi: string; a_en: string; a_hi: string };

const FAQS_BY_ROLE: Record<string, FaqItem[]> = {
  worker: [
    {
      q_en: "How do I find jobs near me?",
      q_hi: "मेरे पास नौकरी कैसे ढूंढूं?",
      a_en: "Open the Home tab, allow location access, and you'll see all open jobs sorted by distance. Tap any job to view details and apply.",
      a_hi: "होम टैब खोलें, लोकेशन की अनुमति दें — सभी ओपन जॉब्स दूरी के अनुसार दिखेंगी। किसी भी जॉब पर टैप करके आवेदन करें।",
    },
    {
      q_en: "When will I receive my wages?",
      q_hi: "मुझे मेरी मजदूरी कब मिलेगी?",
      a_en: "Wages are calculated from your attendance and paid by the contractor/client. Wallet payouts (UPI) typically settle within 24 hours of approval.",
      a_hi: "मजदूरी आपकी हाजिरी से निकलती है और ठेकेदार/क्लाइंट द्वारा दी जाती है। वॉलेट पेआउट (UPI) मंजूरी के 24 घंटे में।",
    },
    {
      q_en: "How do I mark attendance?",
      q_hi: "हाजिरी कैसे लगाऊं?",
      a_en: "Open the Attendance tab → allow GPS + camera → take a selfie and tap Check-in. Repeat at end of day for Check-out. You must be within the site geofence.",
      a_hi: "Attendance टैब → GPS + कैमरा की अनुमति दें → सेल्फी लें और Check-in दबाएं। दिन के अंत में Check-out करें। आप साइट जियोफेंस के अंदर होने चाहिए।",
    },
    {
      q_en: "How do I verify my Aadhaar?",
      q_hi: "Aadhaar कैसे वेरीफाई करूं?",
      a_en: "Go to Profile → tap 'Verify Aadhaar Now' → enter your 12-digit Aadhaar. Only the last 4 digits are stored. Verified profiles get 3× more job offers.",
      a_hi: "Profile → 'Verify Aadhaar Now' पर टैप करें → 12 अंकों का Aadhaar डालें। केवल अंतिम 4 अंक सेव होते हैं। वेरिफाइड प्रोफाइल को 3× ज्यादा जॉब्स मिलती हैं।",
    },
    {
      q_en: "My check-in says 'outside geofence' — what to do?",
      q_hi: "Check-in बोल रहा है 'जियोफेंस के बाहर' — क्या करूं?",
      a_en: "Move closer to the actual job site. If the site coordinates are wrong, contact the contractor or file a complaint via Help & Support.",
      a_hi: "असली साइट के पास जाएं। अगर साइट के coordinates गलत हैं तो ठेकेदार से बात करें या Help & Support में शिकायत दर्ज करें।",
    },
  ],
  contractor: [
    {
      q_en: "How do I add workers to my team?",
      q_hi: "अपनी टीम में मजदूर कैसे जोड़ूं?",
      a_en: "Post a job from the 'Post Job' tab. When workers apply, accept them from the Activity tab. They will appear in your Payroll automatically.",
      a_hi: "'Post Job' टैब से जॉब पोस्ट करें। जब मजदूर आवेदन करें तो Activity टैब से स्वीकार करें। वे अपने आप Payroll में दिखेंगे।",
    },
    {
      q_en: "How does the ERP module work?",
      q_hi: "ERP module कैसे काम करता है?",
      a_en: "ERP tab → Manage Materials (cement, steel etc.), Tools, Cost Estimates, and Generate Bills as branded PDF/Excel for WhatsApp sharing.",
      a_hi: "ERP टैब → सामग्री (सीमेंट, स्टील), टूल्स, कॉस्ट एस्टीमेट मैनेज करें, और WhatsApp के लिए ब्रांडेड PDF/Excel बिल जनरेट करें।",
    },
    {
      q_en: "How do I calculate monthly payroll?",
      q_hi: "मासिक payroll कैसे निकालूं?",
      a_en: "Profile → Payroll. The system auto-calculates wages from attendance for the current month. Export as needed for record-keeping.",
      a_hi: "Profile → Payroll। सिस्टम चालू महीने की हाजिरी से अपने आप मजदूरी निकालता है।",
    },
    {
      q_en: "Can I bid on projects from clients?",
      q_hi: "क्या मैं क्लाइंट्स के प्रोजेक्ट पर बोली लगा सकता हूं?",
      a_en: "Yes. Home tab shows open client jobs — tap any and submit your bid with proposed wage and timeline.",
      a_hi: "हां। होम टैब पर क्लाइंट जॉब्स दिखती हैं — किसी पर टैप करके मजदूरी और समय के साथ बोली लगाएं।",
    },
    {
      q_en: "How do I upgrade to Premium ERP?",
      q_hi: "Premium ERP में कैसे upgrade करूं?",
      a_en: "Wallet tab → Subscriptions → choose plan → pay via UPI/card. Premium unlocks unlimited bills, multi-site, and analytics.",
      a_hi: "Wallet टैब → Subscriptions → प्लान चुनें → UPI/कार्ड से भुगतान करें। Premium में unlimited बिल, multi-site, analytics मिलते हैं।",
    },
  ],
  client: [
    {
      q_en: "How do I post a job?",
      q_hi: "जॉब कैसे पोस्ट करूं?",
      a_en: "Post Job tab → enter title, skill required, wage, and location → publish. Workers and contractors will start applying.",
      a_hi: "Post Job टैब → शीर्षक, आवश्यक कौशल, मजदूरी और स्थान भरें → publish करें। मजदूर/ठेकेदार आवेदन करेंगे।",
    },
    {
      q_en: "How do I hire workers?",
      q_hi: "मजदूरों को कैसे hire करूं?",
      a_en: "Activity tab shows all applicants. Tap a worker to view profile, rating, Aadhaar status. Tap 'Hire' to confirm.",
      a_hi: "Activity टैब में सभी आवेदक दिखते हैं। मजदूर पर टैप करके प्रोफाइल, रेटिंग, Aadhaar स्टेटस देखें। 'Hire' दबाएं।",
    },
    {
      q_en: "Can I track attendance of hired workers?",
      q_hi: "क्या मैं hired मजदूरों की हाजिरी देख सकता हूं?",
      a_en: "Yes. Each check-in/check-out with selfie + GPS shows in the worker's profile and your Activity feed.",
      a_hi: "हां। हर check-in/check-out सेल्फी + GPS के साथ मजदूर के प्रोफाइल और आपके Activity में दिखता है।",
    },
    {
      q_en: "What if a worker doesn't show up?",
      q_hi: "अगर मजदूर नहीं आता तो क्या करें?",
      a_en: "File a complaint via Help & Support. Repeat offenders are suspended by our admin team within 48 hours.",
      a_hi: "Help & Support से शिकायत दर्ज करें। बार-बार ऐसा करने वाले 48 घंटे में admin द्वारा निलंबित कर दिए जाते हैं।",
    },
    {
      q_en: "How do I make payment to workers?",
      q_hi: "मजदूरों को भुगतान कैसे करूं?",
      a_en: "Wallet → top-up via UPI → transfer to worker. Or pay directly in cash and confirm in app for record-keeping.",
      a_hi: "Wallet → UPI से top-up → मजदूर को ट्रांसफर। या नकद देकर ऐप में confirm करें।",
    },
  ],
  admin: [
    {
      q_en: "How do I suspend a user?",
      q_hi: "User को कैसे suspend करूं?",
      a_en: "Admin → Users → search → tap user → 'Suspend'. Reversible anytime via 'Unsuspend'.",
      a_hi: "Admin → Users → सर्च करें → user पर टैप → 'Suspend'। 'Unsuspend' से कभी भी वापस।",
    },
    {
      q_en: "How do I close a job?",
      q_hi: "जॉब कैसे बंद करूं?",
      a_en: "Admin → Jobs → tap job → 'Close'. The job will no longer accept applications.",
      a_hi: "Admin → Jobs → जॉब पर टैप → 'Close'। उसके बाद कोई आवेदन नहीं आएगा।",
    },
  ],
};

const COMMON_FAQS: FaqItem[] = [
  {
    q_en: "How do I change the app language?",
    q_hi: "ऐप की भाषा कैसे बदलूं?",
    a_en: "Profile → Settings → Language → tap English or हिंदी. Change is applied instantly across the app.",
    a_hi: "Profile → Settings → Language → English या हिंदी पर टैप करें। तुरंत पूरी ऐप में बदल जाता है।",
  },
  {
    q_en: "How do I change my password?",
    q_hi: "अपना पासवर्ड कैसे बदलूं?",
    a_en: "Profile → Settings → Change Password → enter old + new password.",
    a_hi: "Profile → Settings → Change Password → पुराना + नया पासवर्ड डालें।",
  },
  {
    q_en: "How do I update my profile photo?",
    q_hi: "प्रोफाइल फोटो कैसे बदलूं?",
    a_en: "Profile tab → tap your avatar (camera icon) → choose Camera or Gallery → 1:1 crop and save.",
    a_hi: "Profile टैब → अपने avatar (कैमरा आइकन) पर टैप → Camera या Gallery चुनें → 1:1 crop करके save करें।",
  },
];

export default function HelpSupport() {
  const router = useRouter();
  const { user } = useAuth();
  const { t: tr, lang } = useT();
  const role = user?.role || "worker";
  const roleFaqs = FAQS_BY_ROLE[role] || FAQS_BY_ROLE.worker;
  const allFaqs = [...roleFaqs, ...COMMON_FAQS];
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const openLink = async (url: string, fallback?: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
      } else if (fallback) {
        Alert.alert(tr("help.cannotOpen"), fallback);
      } else {
        Alert.alert(tr("help.cannotOpen"), url);
      }
    } catch {
      Alert.alert(tr("help.cannotOpen"), url);
    }
  };

  const callSupport = () => openLink(`tel:${SUPPORT_PHONE}`, SUPPORT_PHONE);
  const whatsappSupport = () =>
    openLink(
      `whatsapp://send?phone=${SUPPORT_WHATSAPP.replace(/\+/g, "")}&text=${encodeURIComponent("Hi BuildMitra team, I need help with...")}`,
      SUPPORT_WHATSAPP
    );
  const emailSupport = () =>
    openLink(
      `mailto:${SUPPORT_EMAIL}?subject=BuildMitra%20Support%20Request`,
      SUPPORT_EMAIL
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="help-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2 testID="help-title">{tr("help.title")}</H2>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120, gap: spacing.md }}>
        {/* Hero */}
        <View style={styles.hero}>
          <Ionicons name="help-buoy" size={40} color={colors.brand} />
          <H2 style={{ marginTop: 8, textAlign: "center" }}>{tr("help.heroTitle")}</H2>
          <Muted style={{ marginTop: 4, textAlign: "center", paddingHorizontal: spacing.sm }}>
            {tr("help.heroSub")}
          </Muted>
        </View>

        {/* Contact Cards */}
        <Body style={styles.sectionTitle}>{tr("help.contactUs")}</Body>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <ContactBtn
            testID="contact-whatsapp"
            icon="logo-whatsapp"
            bg="#25D366"
            label="WhatsApp"
            onPress={whatsappSupport}
          />
          <ContactBtn
            testID="contact-call"
            icon="call"
            bg={colors.brand}
            label={tr("help.call")}
            onPress={callSupport}
          />
          <ContactBtn
            testID="contact-email"
            icon="mail"
            bg="#2563EB"
            label="Email"
            onPress={emailSupport}
          />
        </View>
        <Muted style={{ fontSize: 12, textAlign: "center", marginTop: -4 }}>
          {tr("help.supportHours")}
        </Muted>

        {/* Quick Actions */}
        <Body style={styles.sectionTitle}>{tr("help.quickActions")}</Body>
        <Pressable testID="goto-complaints" onPress={() => router.push("/complaints" as any)} style={styles.actionRow}>
          <View style={[styles.actionIcon, { backgroundColor: "#FEE2E2" }]}>
            <Ionicons name="flag" size={20} color={colors.error} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body style={{ fontWeight: "700" }}>{tr("help.fileComplaint")}</Body>
            <Muted style={{ fontSize: 11 }}>{tr("help.fileComplaintSub")}</Muted>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
        </Pressable>

        <Pressable testID="goto-bug" onPress={() => router.push({ pathname: "/complaints" as any, params: { type: "bug" } })} style={styles.actionRow}>
          <View style={[styles.actionIcon, { backgroundColor: "#FEF3C7" }]}>
            <Ionicons name="bug" size={20} color={colors.warning} />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Body style={{ fontWeight: "700" }}>{tr("help.reportBug")}</Body>
            <Muted style={{ fontSize: 11 }}>{tr("help.reportBugSub")}</Muted>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
        </Pressable>

        {/* FAQ */}
        <Body style={styles.sectionTitle}>
          {tr("help.faqs")} · <Muted>{role.toUpperCase()}</Muted>
        </Body>
        <Card style={{ padding: 0 }}>
          {allFaqs.map((f, i) => {
            const isOpen = openIdx === i;
            return (
              <View key={i} style={[styles.faqItem, i === allFaqs.length - 1 && { borderBottomWidth: 0 }]}>
                <Pressable
                  testID={`faq-${i}`}
                  onPress={() => setOpenIdx(isOpen ? null : i)}
                  style={styles.faqHead}
                >
                  <Body style={{ flex: 1, fontWeight: "700", marginRight: 8 }}>
                    {lang === "hi" ? f.q_hi : f.q_en}
                  </Body>
                  <Ionicons
                    name={isOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={colors.brand}
                  />
                </Pressable>
                {isOpen && (
                  <View style={styles.faqBody}>
                    <Muted style={{ lineHeight: 20 }}>
                      {lang === "hi" ? f.a_hi : f.a_en}
                    </Muted>
                  </View>
                )}
              </View>
            );
          })}
        </Card>

        {/* How to Use Guide */}
        <Body style={styles.sectionTitle}>{tr("help.howToUse")}</Body>
        <Card>
          {(role === "worker" ? WORKER_STEPS : role === "contractor" ? CONTRACTOR_STEPS : role === "client" ? CLIENT_STEPS : ADMIN_STEPS).map((s, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepNum}>
                <Body style={{ color: colors.onBrandPrimary, fontWeight: "800", fontSize: 12 }}>{i + 1}</Body>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Body style={{ fontWeight: "700" }}>{lang === "hi" ? s.t_hi : s.t_en}</Body>
                <Muted style={{ fontSize: 12, marginTop: 2 }}>{lang === "hi" ? s.d_hi : s.d_en}</Muted>
              </View>
            </View>
          ))}
        </Card>

        {/* About */}
        <Body style={styles.sectionTitle}>{tr("help.about")}</Body>
        <Card>
          <InfoRow icon="information-circle" label={tr("help.version")} value={APP_VERSION} />
          <InfoRow icon="business" label="BuildMitra" value="India's Construction Network" />
          <Pressable testID="terms-link" onPress={() => openLink("https://buildmitra.in/terms")} style={styles.linkRow}>
            <Ionicons name="document-text" size={20} color={colors.brand} />
            <Body style={{ marginLeft: 12, flex: 1 }}>{tr("help.terms")}</Body>
            <Ionicons name="open-outline" size={16} color={colors.borderStrong} />
          </Pressable>
          <Pressable testID="privacy-link" onPress={() => openLink("https://buildmitra.in/privacy")} style={styles.linkRow}>
            <Ionicons name="lock-closed" size={20} color={colors.brand} />
            <Body style={{ marginLeft: 12, flex: 1 }}>{tr("help.privacy")}</Body>
            <Ionicons name="open-outline" size={16} color={colors.borderStrong} />
          </Pressable>
        </Card>

        <Muted style={{ textAlign: "center", marginTop: spacing.sm, fontSize: 11 }}>
          {tr("help.madeWith")}
        </Muted>
      </ScrollView>
    </SafeAreaView>
  );
}

type StepItem = { t_en: string; t_hi: string; d_en: string; d_hi: string };
const WORKER_STEPS: StepItem[] = [
  { t_en: "Complete your profile", t_hi: "अपनी प्रोफाइल पूरी करें", d_en: "Add skills, expected wage, city for better matches", d_hi: "बेहतर मैच के लिए कौशल, मजदूरी, शहर भरें" },
  { t_en: "Verify Aadhaar", t_hi: "Aadhaar वेरीफाई करें", d_en: "Verified profiles get 3× more job offers", d_hi: "वेरिफाइड प्रोफाइल को 3× ज्यादा जॉब्स" },
  { t_en: "Search & apply for jobs", t_hi: "जॉब खोजें और आवेदन करें", d_en: "Use Home tab to find work near you", d_hi: "पास का काम Home टैब से ढूंढें" },
  { t_en: "Mark attendance daily", t_hi: "रोज हाजिरी लगाएं", d_en: "GPS + selfie based check-in/out", d_hi: "GPS + सेल्फी से check-in/out" },
  { t_en: "Get paid via wallet", t_hi: "वॉलेट से भुगतान पाएं", d_en: "UPI withdrawals within 24 hours", d_hi: "UPI से 24 घंटे में निकासी" },
];
const CONTRACTOR_STEPS: StepItem[] = [
  { t_en: "Set up your company profile", t_hi: "कंपनी प्रोफाइल बनाएं", d_en: "Add company name and city", d_hi: "कंपनी का नाम और शहर भरें" },
  { t_en: "Post jobs for workers", t_hi: "मजदूरों के लिए जॉब पोस्ट करें", d_en: "Use Post Job tab — set wage and skill", d_hi: "Post Job टैब से मजदूरी और कौशल सेट करें" },
  { t_en: "Manage ERP modules", t_hi: "ERP modules मैनेज करें", d_en: "Materials, tools, estimates, bills", d_hi: "सामग्री, टूल्स, एस्टीमेट, बिल" },
  { t_en: "Generate branded bills", t_hi: "ब्रांडेड बिल बनाएं", d_en: "Export as PDF/Excel for WhatsApp", d_hi: "WhatsApp के लिए PDF/Excel export" },
  { t_en: "Monthly payroll", t_hi: "मासिक payroll", d_en: "Auto-calculated from attendance", d_hi: "हाजिरी से अपने आप निकलता है" },
];
const CLIENT_STEPS: StepItem[] = [
  { t_en: "Post a job/project", t_hi: "जॉब/प्रोजेक्ट पोस्ट करें", d_en: "Define skill, wage, location", d_hi: "कौशल, मजदूरी, स्थान भरें" },
  { t_en: "Review applicants", t_hi: "आवेदकों की समीक्षा करें", d_en: "Check ratings, Aadhaar, experience", d_hi: "रेटिंग, Aadhaar, अनुभव देखें" },
  { t_en: "Hire & track attendance", t_hi: "Hire करें और हाजिरी देखें", d_en: "Real-time GPS + selfie attendance", d_hi: "Real-time GPS + सेल्फी हाजिरी" },
  { t_en: "Make payments", t_hi: "भुगतान करें", d_en: "Via wallet UPI or cash", d_hi: "वॉलेट UPI या नकद" },
  { t_en: "Rate workers after job", t_hi: "जॉब के बाद रेटिंग दें", d_en: "Help others find good workers", d_hi: "अच्छे मजदूर मिलने में मदद करें" },
];
const ADMIN_STEPS: StepItem[] = [
  { t_en: "Monitor dashboard", t_hi: "डैशबोर्ड देखें", d_en: "Daily stats: users, jobs, complaints", d_hi: "दैनिक आंकड़े: users, जॉब्स, शिकायतें" },
  { t_en: "Verify users", t_hi: "Users वेरीफाई करें", d_en: "Admin → Users → Verify/Suspend", d_hi: "Admin → Users → Verify/Suspend" },
  { t_en: "Resolve complaints", t_hi: "शिकायतें हल करें", d_en: "Within 48 hours", d_hi: "48 घंटे के अंदर" },
];

function ContactBtn({ icon, bg, label, onPress, testID }: { icon: any; bg: string; label: string; onPress: () => void; testID?: string }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.contactBtn, { backgroundColor: bg }, pressed && { opacity: 0.85 }]}>
      <Ionicons name={icon} size={24} color="#FFF" />
      <Body style={{ color: "#FFF", fontWeight: "700", marginTop: 4, fontSize: 13 }}>{label}</Body>
    </Pressable>
  );
}

function InfoRow({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <View style={styles.linkRow}>
      <Ionicons name={icon} size={20} color={colors.brand} />
      <Body style={{ marginLeft: 12, flex: 1 }}>{label}</Body>
      <Muted>{value}</Muted>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  hero: {
    alignItems: "center", padding: spacing.lg, backgroundColor: colors.brandTertiary, borderRadius: radius.lg,
  },
  sectionTitle: {
    fontWeight: "800", fontSize: tt.md, marginTop: spacing.sm,
  },
  contactBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: radius.md,
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  actionRow: {
    flexDirection: "row", alignItems: "center",
    padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary,
  },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
  },
  faqItem: {
    borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
  faqHead: {
    flexDirection: "row", alignItems: "center", padding: spacing.md,
  },
  faqBody: {
    paddingHorizontal: spacing.md, paddingBottom: spacing.md, paddingTop: 0,
  },
  step: {
    flexDirection: "row", alignItems: "flex-start", paddingVertical: 10,
    borderBottomWidth: Platform.OS === "ios" ? 0 : 0,
  },
  stepNum: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: colors.brand,
    alignItems: "center", justifyContent: "center", marginTop: 2,
  },
  linkRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider,
  },
});
