import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, radius, spacing, type as t } from "@/src/theme";

/**
 * Compact single-select dropdown with searchable modal picker.
 * - Shows currently selected value + chevron on the right.
 * - Tapping opens a bottom-sheet-like modal with (optional) search.
 * - Consistent styling with the app's Field component.
 */
type Props = {
  label?: string;
  value: string;
  options: string[];
  onSelect: (val: string) => void;
  placeholder?: string;
  searchable?: boolean;
  testID?: string;
  disabled?: boolean;
};

export default function Dropdown({
  label,
  value,
  options,
  onSelect,
  placeholder = "Select...",
  searchable = false,
  testID,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable || !query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query, searchable]);

  const pick = (v: string) => {
    onSelect(v);
    setOpen(false);
    setQuery("");
  };

  return (
    <View style={{ marginBottom: spacing.md }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        testID={testID}
        onPress={() => !disabled && setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          disabled && { opacity: 0.5 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text
          style={[
            styles.fieldText,
            !value && { color: colors.onSurfaceSecondary },
          ]}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons
          name="chevron-down"
          size={18}
          color={colors.onSurfaceSecondary}
        />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
          testID={testID ? `${testID}-backdrop` : undefined}
        >
          <Pressable onPress={() => {}} style={styles.sheetWrap}>
            <SafeAreaView edges={["bottom"]} style={styles.sheet}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHead}>
                <Text style={styles.sheetTitle}>{label || "Select"}</Text>
                <Pressable
                  onPress={() => setOpen(false)}
                  hitSlop={12}
                  testID={testID ? `${testID}-close` : undefined}
                >
                  <Ionicons name="close" size={22} color={colors.onSurface} />
                </Pressable>
              </View>

              {searchable ? (
                <View style={styles.searchWrap}>
                  <Ionicons
                    name="search"
                    size={16}
                    color={colors.onSurfaceSecondary}
                  />
                  <TextInput
                    testID={testID ? `${testID}-search` : undefined}
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search..."
                    placeholderTextColor={colors.onSurfaceSecondary}
                    style={styles.searchInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {query ? (
                    <Pressable onPress={() => setQuery("")} hitSlop={8}>
                      <Ionicons
                        name="close-circle"
                        size={16}
                        color={colors.onSurfaceSecondary}
                      />
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              <FlatList
                data={filtered}
                keyExtractor={(item) => item}
                keyboardShouldPersistTaps="handled"
                ItemSeparatorComponent={() => <View style={styles.sep} />}
                renderItem={({ item }) => {
                  const selected = item === value;
                  return (
                    <Pressable
                      testID={testID ? `${testID}-opt-${item}` : undefined}
                      onPress={() => pick(item)}
                      style={({ pressed }) => [
                        styles.optionRow,
                        pressed && { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && {
                            color: colors.brand,
                            fontWeight: "800",
                          },
                        ]}
                      >
                        {item}
                      </Text>
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={18}
                          color={colors.brand}
                        />
                      ) : null}
                    </Pressable>
                  );
                }}
                ListEmptyComponent={
                  <View style={{ padding: spacing.lg, alignItems: "center" }}>
                    <Text style={{ color: colors.onSurfaceSecondary }}>
                      No results
                    </Text>
                  </View>
                }
                style={{ maxHeight: 380 }}
              />
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
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
  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  fieldText: {
    fontSize: t.base,
    color: colors.onSurface,
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheetWrap: { width: "100%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 0 : spacing.md,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: t.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    marginBottom: 10,
    backgroundColor: colors.surfaceSecondary,
  },
  searchInput: {
    flex: 1,
    fontSize: t.base,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  sep: { height: 1, backgroundColor: colors.divider },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 6,
  },
  optionText: {
    fontSize: t.base,
    color: colors.onSurface,
  },
});
