import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { formatIsoDate } from "@/src/utils/date";

/**
 * Cross-platform mobile-friendly date picker field (no native deps).
 * - On Web: renders an HTML `<input type="date">` via react-native-web's TextInput
 *   escape hatch, so users get the browser's native date picker.
 * - On iOS/Android: renders a TextInput with placeholder `YYYY-MM-DD`, plus
 *   quick chips (Today / Tomorrow / +3 days / +1 week) for one-tap selection.
 *
 * Value is always stored as ISO date "YYYY-MM-DD" string.
 */

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  testID?: string;
  minDate?: Date;
};

function fmt(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const QUICK = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "+3 days", offset: 3 },
  { label: "+1 week", offset: 7 },
];

export default function DatePickerField({
  label,
  value,
  onChange,
  placeholder = "YYYY-MM-DD",
  required,
  testID,
  minDate,
}: Props) {
  const isWeb = Platform.OS === "web";

  const applyOffset = (offset: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + offset);
    onChange(fmt(d));
  };

  const renderInput = () => {
    if (isWeb) {
      // Casting so react-native-web forwards `type="date"` to the underlying <input>.
      const webProps: any = {
        type: "date",
        value: value || "",
        onChange: (e: any) => onChange(e.target.value),
        min: minDate ? fmt(minDate) : undefined,
      };
      return (
        <TextInput
          testID={testID}
          {...webProps}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
      );
    }
    // Native: TextInput with pattern hint + calendar icon.
    return (
      <View style={styles.inputWrap}>
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceSecondary}
          style={styles.inputText}
          maxLength={10}
          autoCorrect={false}
          keyboardType="numbers-and-punctuation"
        />
        <Ionicons name="calendar" size={18} color={colors.brand} />
      </View>
    );
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.reqStar}> *</Text> : null}
      </Text>
      {renderInput()}
      {value ? (
        <Text style={styles.previewText} testID={testID ? `${testID}-preview` : undefined}>
          Selected: {formatIsoDate(value)}
        </Text>
      ) : null}
      <View style={styles.quickRow}>
        {QUICK.map((q) => (
          <Pressable
            key={q.label}
            testID={testID ? `${testID}-quick-${q.offset}` : undefined}
            onPress={() => applyOffset(q.offset)}
            style={({ pressed }) => [
              styles.quickChip,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.quickChipText}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: t.sm,
    color: colors.onSurfaceSecondary,
    marginBottom: 6,
    fontWeight: "600",
  },
  reqStar: { color: "#DC2626", fontWeight: "800" },
  previewText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: "700",
    marginTop: 6,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    color: colors.onSurface,
    fontSize: t.base,
  },
  inputWrap: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputText: {
    flex: 1,
    color: colors.onSurface,
    fontSize: t.base,
    paddingVertical: 12,
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    flexWrap: "wrap",
  },
  quickChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.brandTertiary,
    borderWidth: 1,
    borderColor: colors.brand + "44",
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brand,
  },
});
