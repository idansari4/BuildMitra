import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { downloadExport } from "@/src/utils/download";
import { formatDate, formatDateTime, formatTime } from "@/src/utils/date";
import { colors, radius, spacing, type as t } from "@/src/theme";
import { H2, Body, Muted, Card, PrimaryButton, SecondaryButton, Chip } from "@/src/ui";

type AttRec = {
  id: string;
  worker_id?: string;
  worker_name?: string;
  job_id?: string;
  job_title?: string | null;
  type: "check_in" | "check_out";
  lat?: number;
  lng?: number;
  face_verified?: boolean;
  within_geofence?: boolean;
  distance_from_site_m?: number | null;
  created_at: string;
};

type SalaryRow = {
  month: string;
  days_present: number;
  jobs_count: number;
  daily_wage: number;
  earned: number;
};

/* ---------------------------- EXPORT BAR ---------------------------- */

function ExportBar({
  scope,
  days,
  disabled,
}: {
  scope: "mine" | "workers";
  days: number;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);
  const [err, setErr] = useState("");

  const doExport = async (fmt: "csv" | "pdf") => {
    if (disabled || busy) return;
    setErr("");
    setBusy(fmt);
    try {
      const path =
        fmt === "csv"
          ? api.exportAttendanceCsvPath(days, scope)
          : api.exportAttendancePdfPath(days, scope);
      const fallback = `attendance_${scope}_${new Date().toISOString().slice(0, 10)}.${fmt}`;
      await downloadExport(path, fallback);
    } catch (e: any) {
      setErr(e?.message || "Export failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <Pressable
        testID="export-csv"
        onPress={() => doExport("csv")}
        disabled={disabled || !!busy}
        style={[exportBarStyles.btn, (disabled || !!busy) && { opacity: 0.5 }]}
      >
        {busy === "csv" ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Ionicons name="document-outline" size={14} color={colors.brand} />
        )}
        <Body style={exportBarStyles.btnText}>CSV</Body>
      </Pressable>
      <Pressable
        testID="export-pdf"
        onPress={() => doExport("pdf")}
        disabled={disabled || !!busy}
        style={[exportBarStyles.btn, (disabled || !!busy) && { opacity: 0.5 }]}
      >
        {busy === "pdf" ? (
          <ActivityIndicator size="small" color={colors.brand} />
        ) : (
          <Ionicons name="download-outline" size={14} color={colors.brand} />
        )}
        <Body style={exportBarStyles.btnText}>PDF</Body>
      </Pressable>
      {err ? <Body style={{ color: colors.error, fontSize: 11, marginLeft: 4 }}>{err}</Body> : null}
    </View>
  );
}

const exportBarStyles = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.brandTertiary,
  },
  btnText: {
    color: colors.brand,
    fontWeight: "800",
    fontSize: 12,
  },
});

/* ---------------------------- WORKER VIEW ---------------------------- */

function WorkerAttendance() {
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AttRec[]>([]);
  const [msg, setMsg] = useState("");
  const [msgOk, setMsgOk] = useState(false);
  const [permErr, setPermErr] = useState("");
  const [hiredJobs, setHiredJobs] = useState<any[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>("self");
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [salary, setSalary] = useState<{ rows: SalaryRow[]; current_wage: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [h, jobs, s] = await Promise.all([
        api.myAttendance().catch(() => []),
        api.hiredJobs().catch(() => []),
        api.salarySummary(3).catch(() => null),
      ]);
      setHistory(h || []);
      setHiredJobs(jobs || []);
      if (jobs && jobs.length > 0 && selectedJobId === "self") setSelectedJobId(jobs[0].id);
      setSalary(s);
    } catch {}
    setLoadingJobs(false);
  }, [selectedJobId]);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** Today's status derived from history */
  const today = useMemo(() => {
    const today_iso = new Date().toISOString().slice(0, 10);
    const todaysEntries = history.filter((h) => (h.created_at || "").startsWith(today_iso));
    const lastCheckIn = todaysEntries.find((h) => h.type === "check_in");
    const lastCheckOut = todaysEntries.find((h) => h.type === "check_out");
    let hours = 0;
    if (lastCheckIn) {
      const start = new Date(lastCheckIn.created_at).getTime();
      const end = lastCheckOut ? new Date(lastCheckOut.created_at).getTime() : Date.now();
      hours = Math.max(0, (end - start) / 3600000);
    }
    return { lastCheckIn, lastCheckOut, hours, hasCheckedIn: !!lastCheckIn, hasCheckedOut: !!lastCheckOut };
  }, [history]);

  const grabLocation = async () => {
    setPermErr("");
    let existing = await Location.getForegroundPermissionsAsync();
    if (existing.status !== "granted" && existing.canAskAgain) {
      existing = await Location.requestForegroundPermissionsAsync();
    }
    if (existing.status !== "granted") {
      setPermErr("Location permission needed for attendance verification.");
      return;
    }
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    } catch {
      setPermErr("Unable to fetch location. Please retry.");
    }
  };

  const takeSelfie = async () => {
    setPermErr("");
    let existing = await ImagePicker.getCameraPermissionsAsync();
    if (existing.status !== "granted" && existing.canAskAgain) {
      existing = await ImagePicker.requestCameraPermissionsAsync();
    }
    if (existing.status !== "granted") {
      setPermErr("Camera permission needed for selfie verification.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      base64: true,
      quality: 0.4,
      allowsEditing: false,
    });
    if (!res.canceled && res.assets[0]?.base64) {
      setSelfie("data:image/jpeg;base64," + res.assets[0].base64);
    }
  };

  const submit = async (kind: "check_in" | "check_out") => {
    if (!coords) {
      setMsgOk(false);
      setMsg("Capture GPS first");
      return;
    }
    if (!selfie) {
      setMsgOk(false);
      setMsg("Capture selfie first");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const res: AttRec = await api.attendance({
        job_id: selectedJobId,
        type: kind,
        lat: coords.lat,
        lng: coords.lng,
        selfie,
      });
      setMsgOk(true);
      const label = kind === "check_in" ? "Checked in" : "Checked out";
      if (res && res.within_geofence === false && res.job_id && res.job_id !== "self") {
        setMsg(`${label}, but you're ${res.distance_from_site_m}m from site (flagged off-site)`);
        setMsgOk(false);
      } else {
        setMsg(`${label} successfully ✓`);
      }
      setSelfie(null);
      await load();
    } catch (e: any) {
      setMsgOk(false);
      setMsg(e?.message || "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 100, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <H2 testID="attendance-title">Attendance</H2>
      <Muted>GPS + Selfie verification keeps every check-in secure.</Muted>

      {/* Leave quick link */}
      <Pressable
        testID="request-leave-link"
        onPress={() => router.push("/leave")}
        style={styles.leaveLink}
      >
        <View style={styles.leaveLinkIcon}>
          <Ionicons name="calendar" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: "800" }}>Leave Requests</Body>
          <Muted style={{ fontSize: 12, marginTop: 2 }}>
            Apply for leave · Track approval status
          </Muted>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
      </Pressable>

      {/* Today's status */}
      <Card testID="today-status">
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Body style={{ fontWeight: "800", fontSize: t.lg }}>Today</Body>
            <Muted style={{ marginTop: 2 }}>{formatDate(new Date())}</Muted>
          </View>
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: today.hasCheckedIn
                  ? today.hasCheckedOut
                    ? colors.surfaceSecondary
                    : colors.brandTertiary
                  : colors.surfaceSecondary,
              },
            ]}
          >
            <Ionicons
              name={today.hasCheckedIn ? "checkmark-circle" : "time-outline"}
              size={16}
              color={today.hasCheckedIn ? colors.success : colors.onSurfaceSecondary}
            />
            <Body style={{ fontWeight: "700", marginLeft: 6, fontSize: t.sm }}>
              {today.hasCheckedIn ? (today.hasCheckedOut ? "Day closed" : "On duty") : "Not checked in"}
            </Body>
          </View>
        </View>
        <View style={styles.todayGrid}>
          <View style={styles.todayCell}>
            <Muted style={{ fontSize: 11 }}>Check-in</Muted>
            <Body style={{ fontWeight: "700", marginTop: 2 }}>
              {today.lastCheckIn ? formatTime(today.lastCheckIn.created_at) : "—"}
            </Body>
          </View>
          <View style={styles.todayCell}>
            <Muted style={{ fontSize: 11 }}>Check-out</Muted>
            <Body style={{ fontWeight: "700", marginTop: 2 }}>
              {today.lastCheckOut ? formatTime(today.lastCheckOut.created_at) : "—"}
            </Body>
          </View>
          <View style={styles.todayCell}>
            <Muted style={{ fontSize: 11 }}>Hours</Muted>
            <Body style={{ fontWeight: "700", marginTop: 2, color: colors.brand }}>
              {today.hasCheckedIn ? today.hours.toFixed(1) : "0.0"}h
            </Body>
          </View>
        </View>
      </Card>

      {/* Job selector */}
      {loadingJobs ? (
        <Card>
          <ActivityIndicator color={colors.brand} />
        </Card>
      ) : hiredJobs.length === 0 ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Ionicons name="information-circle" size={22} color={colors.warning} />
            <View style={{ flex: 1 }}>
              <Body style={{ fontWeight: "700" }}>No hired jobs yet</Body>
              <Muted style={{ fontSize: 12, marginTop: 2 }}>
                Apply and get hired to log site-linked attendance. You can still check-in generically.
              </Muted>
            </View>
          </View>
        </Card>
      ) : (
        <Card>
          <Body style={{ fontWeight: "700", marginBottom: 8 }}>Which job are you at?</Body>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <Chip
              testID="job-self"
              label="General (No job)"
              selected={selectedJobId === "self"}
              onPress={() => setSelectedJobId("self")}
            />
            {hiredJobs.map((j) => (
              <Chip
                key={j.id}
                testID={`job-${j.id}`}
                label={j.title}
                selected={selectedJobId === j.id}
                onPress={() => setSelectedJobId(j.id)}
              />
            ))}
          </ScrollView>
        </Card>
      )}

      {/* GPS */}
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

      {/* Selfie */}
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

      {permErr ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Body style={{ color: colors.error, flex: 1 }}>{permErr}</Body>
          <Pressable onPress={() => Linking.openSettings?.()} testID="open-settings">
            <Body style={{ color: colors.brand, fontWeight: "700" }}>Open Settings</Body>
          </Pressable>
        </View>
      ) : null}
      {msg ? <Body style={{ color: msgOk ? colors.success : colors.error }}>{msg}</Body> : null}

      {/* Action buttons */}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <PrimaryButton
            testID="checkin-button"
            label={today.hasCheckedIn && !today.hasCheckedOut ? "Re-Check In" : "Check In"}
            icon="log-in-outline"
            loading={busy}
            onPress={() => submit("check_in")}
          />
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

      {/* Monthly Summary */}
      {salary && salary.rows && salary.rows.length > 0 && (
        <View style={{ marginTop: spacing.md }}>
          <H2>Monthly Summary</H2>
          <Muted style={{ marginBottom: 8 }}>Verified check-ins × daily wage (₹{salary.current_wage || 0}/day)</Muted>
          {salary.rows.slice(0, 3).map((r) => (
            <Card key={r.month} style={{ marginBottom: 8 }}>
              <View style={styles.row}>
                <View>
                  <Body style={{ fontWeight: "800" }}>
                    {new Date(r.month + "-01").toLocaleDateString("en", { month: "long", year: "numeric" })}
                  </Body>
                  <Muted style={{ marginTop: 2, fontSize: 12 }}>
                    {r.days_present} day{r.days_present !== 1 ? "s" : ""} · {r.jobs_count} job{r.jobs_count !== 1 ? "s" : ""}
                  </Muted>
                </View>
                <Body style={{ color: colors.success, fontWeight: "800", fontSize: t.lg }}>
                  ₹{r.earned.toFixed(0)}
                </Body>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* History */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.md }}>
        <H2>Recent</H2>
        <ExportBar scope="mine" days={90} disabled={history.length === 0} />
      </View>
      {history.length === 0 ? (
        <Muted>No attendance records yet.</Muted>
      ) : (
        history.slice(0, 25).map((h) => (
          <Card key={h.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons
                    name={h.type === "check_in" ? "log-in-outline" : "log-out-outline"}
                    size={16}
                    color={colors.brand}
                  />
                  <Body style={{ fontWeight: "700" }}>{h.type === "check_in" ? "Check In" : "Check Out"}</Body>
                </View>
                {h.job_title ? (
                  <Muted style={{ marginTop: 4, fontSize: 12 }} numberOfLines={1}>📍 {h.job_title}</Muted>
                ) : null}
                <Muted style={{ marginTop: 2, fontSize: 11 }}>{formatDateTime(h.created_at)}</Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor:
                      h.within_geofence === false ? "#FEE2E2" : "#DCFCE7",
                  }}
                >
                  <Ionicons
                    name={h.within_geofence === false ? "warning" : "shield-checkmark"}
                    size={12}
                    color={h.within_geofence === false ? colors.error : colors.success}
                  />
                  <Body
                    style={{
                      fontSize: 11,
                      color: h.within_geofence === false ? colors.error : colors.success,
                      fontWeight: "700",
                    }}
                  >
                    {h.within_geofence === false ? "Off-site" : "Verified"}
                  </Body>
                </View>
                {h.distance_from_site_m != null ? (
                  <Muted style={{ marginTop: 3, fontSize: 10 }}>{h.distance_from_site_m}m away</Muted>
                ) : (
                  <Muted style={{ marginTop: 3, fontSize: 10 }}>
                    {h.lat?.toFixed(3)}, {h.lng?.toFixed(3)}
                  </Muted>
                )}
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/* ---------------------- CLIENT/CONTRACTOR/ADMIN VIEW ---------------------- */

export function MonitorAttendance({ role }: { role: string }) {
  const router = useRouter();
  const [days, setDays] = useState(1);
  const [rows, setRows] = useState<AttRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const data: AttRec[] = role === "admin" ? await api.adminAttendance() : await api.attendanceMyWorkers(days);
      // Client-side filter by days for admin as well
      if (role === "admin") {
        const cutoff = Date.now() - days * 86400 * 1000;
        setRows((data || []).filter((r) => new Date(r.created_at).getTime() >= cutoff));
      } else {
        setRows(data || []);
      }
    } catch (e: any) {
      setErr(e?.message || "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [days, role]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const stats = useMemo(() => {
    const uniqueWorkers = new Set(rows.map((r) => r.worker_id)).size;
    const verified = rows.filter((r) => r.within_geofence !== false).length;
    const total = rows.length;
    const flagged = total - verified;
    return { uniqueWorkers, verified, total, flagged };
  }, [rows]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, paddingBottom: 80, gap: spacing.md }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
    >
      <H2 testID="attendance-title">Workforce Attendance</H2>
      <Muted>Track workers checking in on your jobs in real time.</Muted>

      {/* Leave inbox link for approvers */}
      <Pressable
        testID="leave-inbox-link"
        onPress={() => router.push("/leave")}
        style={styles.leaveLink}
      >
        <View style={styles.leaveLinkIcon}>
          <Ionicons name="mail-unread" size={20} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Body style={{ fontWeight: "800" }}>Leave Inbox</Body>
          <Muted style={{ fontSize: 12, marginTop: 2 }}>
            Approve or reject worker leave requests
          </Muted>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
      </Pressable>

      {/* Day filter + Export */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {[
            { l: "Today", v: 1 },
            { l: "7 days", v: 7 },
            { l: "30 days", v: 30 },
          ].map((o) => (
            <Chip
              key={o.v}
              testID={`filter-${o.v}`}
              label={o.l}
              selected={days === o.v}
              onPress={() => setDays(o.v)}
            />
          ))}
        </View>
        <ExportBar scope="workers" days={days} disabled={rows.length === 0} />
      </View>

      {/* Stats */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Card style={styles.statCard}>
          <Muted style={{ fontSize: 11 }}>Workers</Muted>
          <Body style={{ fontWeight: "800", fontSize: 20, marginTop: 2 }}>{stats.uniqueWorkers}</Body>
        </Card>
        <Card style={styles.statCard}>
          <Muted style={{ fontSize: 11 }}>Check-ins</Muted>
          <Body style={{ fontWeight: "800", fontSize: 20, marginTop: 2 }}>{stats.total}</Body>
        </Card>
        <Card style={styles.statCard}>
          <Muted style={{ fontSize: 11 }}>Verified</Muted>
          <Body style={{ fontWeight: "800", fontSize: 20, marginTop: 2, color: colors.success }}>{stats.verified}</Body>
        </Card>
        <Card style={styles.statCard}>
          <Muted style={{ fontSize: 11 }}>Flagged</Muted>
          <Body style={{ fontWeight: "800", fontSize: 20, marginTop: 2, color: stats.flagged > 0 ? colors.error : colors.onSurface }}>
            {stats.flagged}
          </Body>
        </Card>
      </View>

      {err ? <Body style={{ color: colors.error }}>{err}</Body> : null}

      {loading ? (
        <Card><ActivityIndicator color={colors.brand} /></Card>
      ) : rows.length === 0 ? (
        <Card>
          <View style={{ alignItems: "center", padding: spacing.md }}>
            <Ionicons name="calendar-outline" size={40} color={colors.borderStrong} />
            <Body style={{ marginTop: 8, fontWeight: "700" }}>No attendance yet</Body>
            <Muted style={{ marginTop: 4, textAlign: "center" }}>
              {role === "admin"
                ? "No worker check-ins in this range."
                : "When your hired workers check in, you'll see them here."}
            </Muted>
          </View>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Ionicons name="person-circle" size={20} color={colors.brand} />
                  <Body style={{ fontWeight: "800" }}>{r.worker_name || "Worker"}</Body>
                </View>
                <Muted style={{ marginTop: 3, fontSize: 12 }} numberOfLines={1}>
                  {r.type === "check_in" ? "🟢 Checked in" : "🔴 Checked out"}
                  {r.job_title ? ` · ${r.job_title}` : ""}
                </Muted>
                <Muted style={{ marginTop: 2, fontSize: 11 }}>
                  {formatDateTime(r.created_at)}
                </Muted>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 999,
                    backgroundColor: r.within_geofence === false ? "#FEE2E2" : "#DCFCE7",
                  }}
                >
                  <Ionicons
                    name={r.within_geofence === false ? "warning" : "shield-checkmark"}
                    size={12}
                    color={r.within_geofence === false ? colors.error : colors.success}
                  />
                  <Body
                    style={{
                      fontSize: 11,
                      color: r.within_geofence === false ? colors.error : colors.success,
                      fontWeight: "700",
                    }}
                  >
                    {r.within_geofence === false ? "Off-site" : "Verified"}
                  </Body>
                </View>
                {r.distance_from_site_m != null ? (
                  <Muted style={{ marginTop: 3, fontSize: 10 }}>{r.distance_from_site_m}m</Muted>
                ) : null}
              </View>
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  );
}

/* ---------------------- SCREEN ROUTER ---------------------- */

export default function Attendance() {
  const { user } = useAuth();

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} edges={["top"]}>
      {user.role === "worker" ? (
        <WorkerAttendance />
      ) : ["client", "contractor", "admin"].includes(user.role) ? (
        <MonitorAttendance role={user.role} />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg }}>
          <Ionicons name="lock-closed-outline" size={48} color={colors.borderStrong} />
          <Body style={{ marginTop: 12 }}>Attendance not available for your role</Body>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  selfie: { width: "100%", height: 220, borderRadius: radius.md, marginTop: 10, backgroundColor: colors.surfaceSecondary },
  selfiePlaceholder: {
    height: 180,
    marginTop: 10,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  checkout: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    paddingHorizontal: 16,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  todayGrid: {
    flexDirection: "row",
    marginTop: spacing.md,
    gap: 10,
  },
  todayCell: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 10,
    alignItems: "center",
  },
  statCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  leaveLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  leaveLinkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandTertiary,
  },
});
