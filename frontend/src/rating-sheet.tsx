// Reusable Rating Bottom-Sheet Modal for BuildMitra
// Usage: <RatingSheet visible target_user_id="..." onClose={...} job_id="..." />
import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";
import { H2, Body, Muted, Field, PrimaryButton } from "@/src/ui";

type Props = {
  visible: boolean;
  target_user_id: string;
  target_name?: string;
  job_id?: string;
  onClose: () => void;
  onSubmit?: () => void;
};

export function RatingSheet({ visible, target_user_id, target_name, job_id, onClose, onSubmit }: Props) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const reset = () => { setStars(5); setComment(""); setErr(""); setOk(""); };

  const submit = async () => {
    setErr(""); setOk("");
    setBusy(true);
    try {
      await api.submitRating(target_user_id, stars, comment.trim(), job_id);
      setOk("Rating submitted \u2713");
      setTimeout(() => { onSubmit?.(); reset(); onClose(); }, 1000);
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.head}>
            <Pressable testID="rating-close" onPress={() => { onClose(); reset(); }} hitSlop={12}>
              <Ionicons name="close" size={26} color={colors.onSurface} />
            </Pressable>
            <H2>Rate {target_name || "User"}</H2>
            <View style={{ width: 26 }} />
          </View>
          <View style={{ padding: spacing.lg, gap: spacing.md }}>
            <View style={styles.hero}>
              <Ionicons name="star" size={44} color={colors.brand} />
              <Muted style={{ marginTop: 6, textAlign: "center" }}>
                Your feedback helps build a trusted community.
              </Muted>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} testID={`star-${n}`} onPress={() => setStars(n)}>
                  <Ionicons name={n <= stars ? "star" : "star-outline"} size={44} color={colors.brand} />
                </Pressable>
              ))}
            </View>
            <Field testID="rating-comment" label="Comment (optional)" value={comment} onChangeText={setComment} multiline placeholder="e.g. Great work, on time, professional..." />
            {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
            {ok ? <Body style={{ color: colors.success, fontWeight: "700" }}>{ok}</Body> : null}
            <PrimaryButton testID="rating-submit" label="Submit Rating" icon="send" loading={busy} onPress={submit} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  hero: { alignItems: "center", padding: spacing.md, backgroundColor: colors.brandTertiary, borderRadius: radius.md },
});
