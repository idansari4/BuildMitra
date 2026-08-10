/**
 * Centralized date/time formatting for BuildMitra.
 * User-facing format is DD-MM-YYYY as per the master UX spec.
 * Never mutates ISO storage; only affects UI display/input.
 */

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === "") return null;
  const d = input instanceof Date ? input : new Date(input);
  if (isNaN(d.getTime())) return null;
  return d;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Format a date as `DD-MM-YYYY`. Returns empty string on invalid input. */
export function formatDate(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

/** Format a time as `hh:mm AM/PM`. */
export function formatTime(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${pad(h)}:${pad(m)} ${ampm}`;
}

/** Format as `DD-MM-YYYY hh:mm AM/PM`. */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  return `${formatDate(d)} ${formatTime(d)}`;
}

/** Format month as `Mon YYYY` (short). Useful for group headings. */
export function formatMonthShort(input: string | number | Date | null | undefined): string {
  const d = toDate(input);
  if (!d) return "";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/** Convert ISO date `YYYY-MM-DD` string → display `DD-MM-YYYY` (no timezone shift). */
export function formatIsoDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return formatDate(iso);
}
