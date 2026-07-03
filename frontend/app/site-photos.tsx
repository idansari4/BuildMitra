import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, ActivityIndicator, Pressable, Modal, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, spacing, radius } from "@/src/theme";
import { H2, Body, Muted, Card, Field, PrimaryButton } from "@/src/ui";

export default function SitePhotos() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState<any | null>(null);

  const load = async () => {
    try { setItems(await api.listProgressPhotos(jobId)); } catch {}
    setLoading(false);
  };
  useEffect(() => { if (jobId) load(); }, [jobId]);

  const pick = async () => {
    const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (lib.status !== "granted") { setErr("Gallery permission denied"); return; }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5,
    });
    if (!res.canceled && res.assets?.[0]?.base64) setPhoto("data:image/jpeg;base64," + res.assets[0].base64);
  };
  const capture = async () => {
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    if (cam.status !== "granted") { setErr("Camera permission denied"); return; }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, base64: true, quality: 0.5,
    });
    if (!res.canceled && res.assets?.[0]?.base64) setPhoto("data:image/jpeg;base64," + res.assets[0].base64);
  };

  const submit = async () => {
    if (!photo) { setErr("Pick or capture a photo"); return; }
    setBusy(true); setErr("");
    let lat, lng;
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      if (perm.status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude; lng = loc.coords.longitude;
      }
    } catch {}
    try {
      await api.addProgressPhoto({ job_id: jobId, photo, caption: caption.trim(), lat, lng });
      setPhoto(null); setCaption(""); setModal(false);
      await load();
    } catch (e: any) { setErr(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await api.deleteProgressPhoto(id); await load(); setPreview(null); } catch {}
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <View style={styles.header}>
        <Pressable testID="sp-back" onPress={() => router.back()} hitSlop={12} style={{ width: 40, height: 40, justifyContent: "center" }}>
          <Ionicons name="arrow-back" size={26} color={colors.onSurface} />
        </Pressable>
        <H2>Site Photos</H2>
        <View style={{ width: 40 }} />
      </View>
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator color={colors.brand} /></View>
      ) : items.length === 0 ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: spacing.md }}>
          <Ionicons name="camera-outline" size={64} color={colors.borderStrong} />
          <Muted style={{ marginTop: 8, textAlign: "center" }}>No photos yet. Upload daily progress photos.</Muted>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 140 }}>
          <View style={styles.grid}>
            {items.map((p) => (
              <Pressable key={p.id} testID={`photo-${p.id}`} onPress={() => setPreview(p)} style={styles.cell}>
                <Image source={{ uri: p.photo }} style={styles.thumb} contentFit="cover" />
                <View style={styles.tag}>
                  <Body style={{ color: "#FFF", fontSize: 10, fontWeight: "700" }}>{p.uploader_name}</Body>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}

      <Pressable testID="open-photo" onPress={() => setModal(true)} style={styles.fab}>
        <Ionicons name="add" size={26} color={colors.onBrandPrimary} />
        <Body style={{ color: colors.onBrandPrimary, fontWeight: "800", marginLeft: 4 }}>Add Photo</Body>
      </Pressable>

      <Modal visible={modal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top", "bottom"]}>
          <View style={styles.modalHead}>
            <Pressable onPress={() => setModal(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            <H2>Upload Progress Photo</H2>
            <View style={{ width: 26 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }} keyboardShouldPersistTaps="handled">
            {photo ? (
              <Image source={{ uri: photo }} style={styles.preview} contentFit="cover" />
            ) : (
              <View style={styles.pickBox}>
                <Ionicons name="image-outline" size={48} color={colors.borderStrong} />
                <Muted style={{ marginTop: 8 }}>No photo selected</Muted>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable testID="cam-btn" onPress={capture} style={[styles.pickBtn, { backgroundColor: colors.brand }]}>
                <Ionicons name="camera" size={18} color="#FFF" />
                <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Camera</Body>
              </Pressable>
              <Pressable testID="gal-btn" onPress={pick} style={[styles.pickBtn, { backgroundColor: colors.brandSecondary }]}>
                <Ionicons name="images" size={18} color="#FFF" />
                <Body style={{ color: "#FFF", fontWeight: "800", marginLeft: 4 }}>Gallery</Body>
              </Pressable>
            </View>
            <Field testID="caption" label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="e.g. Ground floor concreting complete" />
            {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}
            <PrimaryButton testID="upload-photo" label="Upload" icon="cloud-upload" loading={busy} onPress={submit} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!preview} animationType="fade" transparent onRequestClose={() => setPreview(null)}>
        <Pressable onPress={() => setPreview(null)} style={styles.previewBg}>
          {preview && <>
            <Image source={{ uri: preview.photo }} style={styles.previewImg} contentFit="contain" />
            <View style={styles.previewInfo}>
              <Body style={{ color: "#FFF", fontWeight: "800" }}>{preview.uploader_name}</Body>
              <Muted style={{ color: "#EEE" }}>{new Date(preview.created_at).toLocaleString()}</Muted>
              {preview.caption ? <Body style={{ color: "#FFF", marginTop: 4 }}>{preview.caption}</Body> : null}
              {(preview.uploader_id === user?.id || user?.role === "admin") && (
                <Pressable testID="del-photo" onPress={() => remove(preview.id)} style={{ marginTop: 8, alignSelf: "flex-start", backgroundColor: colors.error, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.md }}>
                  <Body style={{ color: "#FFF", fontWeight: "700" }}>Delete</Body>
                </Pressable>
              )}
            </View>
          </>}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.md, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cell: { width: "31%", aspectRatio: 1, borderRadius: radius.sm, overflow: "hidden", position: "relative", backgroundColor: colors.surfaceSecondary },
  thumb: { width: "100%", height: "100%" },
  tag: { position: "absolute", bottom: 4, left: 4, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  fab: { position: "absolute", bottom: 24, right: 16, flexDirection: "row", alignItems: "center", backgroundColor: colors.brand, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 999, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  modalHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickBox: { alignItems: "center", padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md },
  preview: { width: "100%", aspectRatio: 1, borderRadius: radius.md },
  pickBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: radius.md },
  previewBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 20 },
  previewImg: { width: "100%", height: "70%" },
  previewInfo: { marginTop: 12, alignSelf: "stretch" },
});
