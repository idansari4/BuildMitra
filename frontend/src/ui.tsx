import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View, ActivityIndicator, ViewStyle, TextStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, type } from "./theme";

export function PrimaryButton({
  label, onPress, loading, disabled, testID, style, icon,
}: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean; testID?: string; style?: ViewStyle; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        (disabled || loading) && { opacity: 0.5 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {icon && <Ionicons name={icon} size={20} color={colors.onBrandPrimary} />}
          <Text style={styles.btnText}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, testID, style }: { label: string; onPress: () => void; testID?: string; style?: ViewStyle }) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.btnSec, pressed && { opacity: 0.7 }, style]}>
      <Text style={styles.btnSecText}>{label}</Text>
    </Pressable>
  );
}

export function Field({
  label, value, onChangeText, placeholder, secureTextEntry, keyboardType, testID, multiline,
}: { label: string; value: string; onChangeText: (v: string) => void; placeholder?: string; secureTextEntry?: boolean; keyboardType?: any; testID?: string; multiline?: boolean }) {
  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceSecondary}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 96, textAlignVertical: "top" }]}
      />
    </View>
  );
}

export function Chip({ label, selected, onPress, testID }: { label: string; selected?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function H1({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.h2, style]}>{children}</Text>;
}
export function Body({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}
export function Muted({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  return <Text style={[styles.muted, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: colors.brandPrimary, borderRadius: radius.md,
    paddingVertical: 16, alignItems: "center", justifyContent: "center", minHeight: 52,
  },
  btnText: { color: colors.onBrandPrimary, fontSize: type.lg, fontWeight: "700" },
  btnSec: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.border,
  },
  btnSecText: { color: colors.onSurface, fontSize: type.base, fontWeight: "600" },
  label: { fontSize: type.sm, color: colors.onSurfaceSecondary, marginBottom: 6, fontWeight: "600" },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 14, fontSize: type.base,
    color: colors.onSurface, backgroundColor: colors.surface,
  },
  chip: {
    paddingHorizontal: 14, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary, justifyContent: "center", flexShrink: 0,
    borderWidth: 1, borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.brandSecondary, borderColor: colors.brand },
  chipText: { color: colors.onSurfaceTertiary, fontSize: type.sm, fontWeight: "600" },
  chipTextOn: { color: colors.onBrandSecondary, fontWeight: "700" },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  h1: { fontSize: type.xxl, fontWeight: "800", color: colors.onSurface, letterSpacing: -0.5 },
  h2: { fontSize: type.xl, fontWeight: "700", color: colors.onSurface },
  body: { fontSize: type.base, color: colors.onSurface },
  muted: { fontSize: type.sm, color: colors.onSurfaceSecondary },
});
