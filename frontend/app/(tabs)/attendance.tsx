import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, PrimaryButton, SecondaryButton } from "@/src/ui";

export default function Attendance() {
  const { user } = useAuth();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [permErr, setPermErr] = useState("");

  useEffect(() => { (async () => { try { setHistory(await api.myAttendance()); } catch {} })(); }, []);

  const grabLocation = async () => {
    setPermErr("");
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { setPermErr("Location permission denied"); return; }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
  };

  const takeSelfie = async () => {
    setPermErr("");
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { setPermErr("Camera permission denied"); return; }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      base64: true, quality: 0.4, allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setSelfie("data:image/jpeg;base64," + res.assets[0].base64);
    }
  };

  const submit = async (kind: "check_in" | "check_out") => {
    if (!coords) { setMsg("Capture GPS first"); return; }
    if (!selfie) { setMsg("Capture selfie first"); return; }
    setBusy(true); setMsg("");
    try {
      await api.attendance({
        job_id: "self",
        type: kind,
        lat: coords.lat, lng: coords.lng,
        selfie,
      });
      setMsg(`${kind === "check_in" ? "Checked in" : "Checked out"} successfully ✓`);
      setSelfie(null);
      setHistory(await api.myAttendance());
    } catch (e: any) { setMsg(e?.message || "Failed"); }
    finally { setBusy(false); }
  };

  if (user?.role !== "worker") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.borderStrong} />
        <Body style={{ marginTop: 12 }}>Attendance is for workers</Body>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 80, gap: spacing.md }}>
        <H2 testID="attendance-title">Attendance</H2>
        <Muted>GPS + Selfie verification keeps every check-in secure.</Muted>

        <Card>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "700" }}>1. Location</Body>
              <Muted style={{ marginTop: 4 }}>
                {coords ? `Lat ${coords.lat.toFixed(5)}, Lng ${coords.lng.toFixed(5)}` : "Not captured"}
              </Muted>
            </View>
            <SecondaryButton testID="gps-button" label={coords ? "Re-fetch" : "Get GPS"} onPress={grabLocation} />
          </View>
        </Card>

        <Card>
          <Body style={{ fontWeight: "700" }}>2. Selfie</Body>
          {selfie ? (
            <Image source={{ uri: selfie }} style={styles.selfie} contentFit="cover" />
          ) : (
            <Pressable testID="selfie-button" onPress={takeSelfie} style={styles.selfiePlaceholder}>
              <Ionicons name="camera-outline" size={32} color={colors.onSurfaceSecondary} />
              <Muted style={{ marginTop: 6 }}>Tap to capture front-camera selfie</Muted>
            </Pressable>
          )}
          {selfie && (
            <SecondaryButton testID="retake-selfie" label="Retake" onPress={takeSelfie} style={{ marginTop: 10 }} />
          )}
        </Card>

        {permErr ? <Body style={{ color: colors.error }}>{permErr}</Body> : null}
        {msg ? <Body style={{ color: msg.includes("✓") ? colors.success : colors.error }}>{msg}</Body> : null}

        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton testID="checkin-button" label="Check In" icon="log-in-outline" loading={busy} onPress={() => submit("check_in")} />
          </View>
          <View style={{ flex: 1 }}>
            <Pressable
              testID="checkout-button"
              disabled={busy}
              onPress={() => submit("check_out")}
              style={[styles.checkout, busy && { opacity: 0.5 }]}
            >
              <Ionicons name="log-out-outline" size={20} color={colors.onSurface} />
              <Body style={{ fontWeight: "700", marginLeft: 8 }}>Check Out</Body>
            </Pressable>
          </View>
        </View>

        <H2 style={{ marginTop: spacing.md }}>Recent</H2>
        {history.length === 0 ? (
          <Muted>No attendance records yet.</Muted>
        ) : history.map((h) => (
          <Card key={h.id}>
            <View style={styles.row}>
              <View>
                <Body style={{ fontWeight: "700" }}>{h.type === "check_in" ? "Check In" : "Check Out"}</Body>
                <Muted style={{ marginTop: 2 }}>{new Date(h.created_at).toLocaleString()}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                  <Body style={{ fontSize: t.sm, color: colors.success, fontWeight: "700" }}>Verified</Body>
                </View>
                <Muted style={{ marginTop: 2, fontSize: 11 }}>
                  {h.lat?.toFixed(3)}, {h.lng?.toFixed(3)}
                </Muted>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selfie: { width: "100%", height: 220, borderRadius: radius.md, marginTop: 10, backgroundColor: colors.surfaceSecondary },
  selfiePlaceholder: {
    height: 180, marginTop: 10, borderRadius: radius.md,
    borderWidth: 2, borderColor: colors.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
  },
  checkout: {
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderStrong,
    minHeight: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center",
    flexDirection: "row", paddingHorizontal: 16,
  },
});
