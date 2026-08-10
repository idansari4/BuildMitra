import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, radius, spacing, type as t } from "@/src/theme";

/**
 * Cross-platform Camera / Gallery chooser modal for profile photos.
 * - Handles permissions politely with retry hints when denied.
 * - Returns base64 data URL via `onPicked` callback.
 */

type Props = {
  visible: boolean;
  onClose: () => void;
  onPicked: (base64DataUrl: string) => void;
  testID?: string;
};

export default function PhotoPickerModal({ visible, onClose, onPicked, testID }: Props) {
  const [err, setErr] = useState("");

  const takePhoto = async () => {
    setErr("");
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        setErr(
          perm.canAskAgain
            ? "Camera permission denied. Please allow to continue."
            : "Camera permission is required. Enable it from device Settings."
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        base64: true,
        quality: 0.6,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      onPicked(`data:image/jpeg;base64,${res.assets[0].base64}`);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Could not open camera");
    }
  };

  const pickFromGallery = async () => {
    setErr("");
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setErr(
          perm.canAskAgain
            ? "Gallery permission denied. Please allow to continue."
            : "Gallery permission is required. Enable it from device Settings."
        );
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        base64: true,
        quality: 0.6,
        allowsEditing: true,
        aspect: [1, 1],
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      onPicked(`data:image/jpeg;base64,${res.assets[0].base64}`);
      onClose();
    } catch (e: any) {
      setErr(e?.message || "Could not open gallery");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Update Profile Photo</Text>

          {Platform.OS !== "web" ? (
            <Pressable
              testID={testID ? `${testID}-camera` : "photo-take"}
              onPress={takePhoto}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="camera" size={22} color={colors.brand} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.btnLabel}>Take Photo</Text>
                <Text style={styles.btnSub}>Use device camera</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
            </Pressable>
          ) : null}

          <Pressable
            testID={testID ? `${testID}-gallery` : "photo-gallery"}
            onPress={pickFromGallery}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="images" size={22} color={colors.brand} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.btnLabel}>Choose from Gallery</Text>
              <Text style={styles.btnSub}>JPG, PNG</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceSecondary} />
          </Pressable>

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <Pressable
            testID={testID ? `${testID}-cancel` : "photo-cancel"}
            onPress={onClose}
            style={styles.cancelBtn}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  title: { fontSize: t.lg, fontWeight: "800", marginBottom: 12, color: colors.onSurface },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  btnLabel: { fontWeight: "700", color: colors.onSurface, fontSize: t.base },
  btnSub: { fontSize: 12, color: colors.onSurfaceSecondary, marginTop: 2 },
  cancelBtn: {
    marginTop: 4,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
  },
  cancelText: { fontWeight: "700", color: colors.onSurfaceSecondary, fontSize: t.base },
  err: { color: colors.error, marginTop: 4, marginBottom: 8, fontSize: 13 },
});
