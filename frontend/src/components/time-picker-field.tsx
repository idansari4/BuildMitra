import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, type as t } from "@/src/theme";

/**
 * Compact 12-hour time picker (mobile-friendly, no native deps).
 * - Web: renders `<input type="time">` for the browser's native picker.
 * - Native: TextInput with mm:HH quick chips + AM/PM toggle.
 * Value stored as `"09:00 AM"` (12-hour with AM/PM suffix).
 */

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  testID?: string;
};

const HOURS = [
  6, 7, 8, 9, 10, 11, 12,
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
];
const MINUTES = ["00", "15", "30", "45"];

function parse(v: string): { h: number; m: string; ap: "AM" | "PM" } {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(v || "");
  if (!match) return { h: 9, m: "00", ap: "AM" };
  return {
    h: parseInt(match[1], 10) || 9,
    m: match[2] || "00",
    ap: (match[3].toUpperCase() as "AM" | "PM") || "AM",
  };
}

function build(h: number, m: string, ap: "AM" | "PM"): string {
  return `${h.toString().padStart(2, "0")}:${m} ${ap}`;
}

function toHtmlTime(v: string): string {
  const p = parse(v);
  let h24 = p.h;
  if (p.ap === "AM" && h24 === 12) h24 = 0;
  if (p.ap === "PM" && h24 !== 12) h24 += 12;
  return `${h24.toString().padStart(2, "0")}:${p.m}`;
}
function fromHtmlTime(v: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(v || "");
  if (!match) return "";
  const h24 = parseInt(match[1], 10);
  const m = match[2];
  const ap: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  let h = h24 % 12;
  if (h === 0) h = 12;
  return build(h, m, ap);
}

export default function TimePickerField({
  label,
  value,
  onChange,
  placeholder = "Select time",
  required,
  testID,
}: Props) {
  const isWeb = Platform.OS === "web";
  const [open, setOpen] = useState(false);
  const p = parse(value);

  if (isWeb) {
    const webProps: any = {
      type: "time",
      value: toHtmlTime(value),
      onChange: (e: any) => onChange(fromHtmlTime(e.target.value)),
    };
    return (
      <View style={{ marginBottom: spacing.md }}>
        <Text style={styles.label}>
          {label}
          {required ? <Text style={styles.reqStar}> *</Text> : null}
        </Text>
        <TextInput
          testID={testID}
          {...webProps}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceSecondary}
        />
        {value ? (
          <Text style={styles.previewText}>Selected: {value}</Text>
        ) : null}
      </View>
    );
  }

  const applyPart = (part: "h" | "m" | "ap", v: any) => {
    const next = parse(value);
    (next as any)[part] = v;
    onChange(build(next.h, next.m, next.ap));
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.reqStar}> *</Text> : null}
      </Text>
      <Pressable
        testID={testID}
        onPress={() => setOpen(true)}
        style={styles.input}
      >
        <Text style={{ color: value ? colors.onSurface : colors.onSurfaceSecondary, flex: 1, fontSize: t.base }}>
          {value || placeholder}
        </Text>
        <Ionicons name="time" size={18} color={colors.brand} />
      </Pressable>

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable onPress={() => {}} style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>{label}</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.colHead}>Hour</Text>
                <View style={{ maxHeight: 200 }}>
                  {HOURS.map((h, i) => (
                    <Pressable
                      key={`${h}-${i}`}
                      testID={testID ? `${testID}-h-${h}-${i}` : undefined}
                      onPress={() => applyPart("h", h)}
                      style={[
                        styles.pickerOpt,
                        p.h === h && styles.pickerOptOn,
                      ]}
                    >
                      <Text style={[styles.pickerText, p.h === h && styles.pickerTextOn]}>{h}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.colHead}>Minute</Text>
                {MINUTES.map((m) => (
                  <Pressable
                    key={m}
                    testID={testID ? `${testID}-m-${m}` : undefined}
                    onPress={() => applyPart("m", m)}
                    style={[styles.pickerOpt, p.m === m && styles.pickerOptOn]}
                  >
                    <Text style={[styles.pickerText, p.m === m && styles.pickerTextOn]}>{m}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.colHead}>AM/PM</Text>
                {(["AM", "PM"] as const).map((ap) => (
                  <Pressable
                    key={ap}
                    testID={testID ? `${testID}-ap-${ap}` : undefined}
                    onPress={() => applyPart("ap", ap)}
                    style={[styles.pickerOpt, p.ap === ap && styles.pickerOptOn]}
                  >
                    <Text style={[styles.pickerText, p.ap === ap && styles.pickerTextOn]}>{ap}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <Pressable style={styles.doneBtn} onPress={() => setOpen(false)}>
              <Text style={styles.doneBtnText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: t.sm, color: colors.onSurfaceSecondary, marginBottom: 6, fontWeight: "600" },
  reqStar: { color: "#DC2626", fontWeight: "800" },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  previewText: { fontSize: 12, color: colors.brand, fontWeight: "700", marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  sheetTitle: { fontSize: t.lg, fontWeight: "800", marginBottom: 12, color: colors.onSurface },
  pickerRow: { flexDirection: "row", gap: 8 },
  pickerCol: { flex: 1 },
  colHead: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    textAlign: "center",
    marginBottom: 6,
  },
  pickerOpt: {
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
  },
  pickerOptOn: {
    backgroundColor: colors.brand,
  },
  pickerText: { fontSize: 14, fontWeight: "700", color: colors.onSurface },
  pickerTextOn: { color: colors.onBrandPrimary },
  doneBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
  },
  doneBtnText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: t.base },
});
