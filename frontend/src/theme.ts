export const colors = {
  surface: "#FFFFFF",
  onSurface: "#18181B",
  surfaceSecondary: "#F4F4F5",
  onSurfaceSecondary: "#52525B",
  surfaceTertiary: "#E4E4E7",
  onSurfaceTertiary: "#3F3F46",
  surfaceInverse: "#18181B",
  onSurfaceInverse: "#FFFFFF",
  brand: "#F59E0B",
  brandPrimary: "#F59E0B",
  onBrandPrimary: "#18181B",
  brandSecondary: "#FDE68A",
  onBrandSecondary: "#92400E",
  brandTertiary: "#FEF3C7",
  onBrandTertiary: "#B45309",
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  onError: "#FFFFFF",
  border: "#E4E4E7",
  borderStrong: "#A1A1AA",
  divider: "#F4F4F5",
  pressed: "rgba(24, 24, 27, 0.05)",
  disabled: "rgba(24, 24, 27, 0.3)",
};

export const spacing = {
  xs: 6, sm: 10, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64,
};

export const radius = { sm: 8, md: 14, lg: 20, pill: 999 };

export const type = {
  sm: 13, base: 16, lg: 18, xl: 22, xxl: 28,
  family: "Plus Jakarta Sans",
};

export const SKILLS = [
  "AC Technician",
  "Aluminium Window Installer",
  "CCTV Installer",
  "Carpenter",
  "Concrete Worker",
  "Duct Installer",
  "Electrician",
  "Fabrication Worker",
  "Glass Installer",
  "Gypsum Worker",
  "Marbal Mason",
  "Marble Polisher",
  "Mason",
  "POP Worker",
  "Painter",
  "Plumber",
  "Scaffolding Worker",
  "Shuttering Carpenter",
  "Steel Fixer",
  "Texture Painter",
  "Tile Worker",
  "UPVC Installer",
  "Waterproofing Worker",
  "Wood Polisher",
  "Wooden Flooring Installer",
];

export const EXPERIENCE_LEVELS = [
  "Full Trained",
  "Semi Trained",
  "Helper",
  "Site Supervisor",
];

// Legacy → new normalisation. Keeps historical DB values (e.g. "Supervisor",
// "Full trained") displayable inside the new dropdown UI without a migration.
export function normalizeExperienceLevel(v?: string | null): string {
  if (!v) return "";
  const s = String(v).trim();
  if (!s) return "";
  const lower = s.toLowerCase();
  if (lower === "supervisor" || lower === "site supervisor") return "Site Supervisor";
  if (lower === "full trained" || lower === "fully trained") return "Full Trained";
  if (lower === "semi trained" || lower === "semi-trained") return "Semi Trained";
  if (lower === "helper") return "Helper";
  return s; // fallback: return as-is
}

export const SKILL_IMAGES: Record<string, string> = {
  Mason: "https://images.pexels.com/photos/11429199/pexels-photo-11429199.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  Plumber: "https://images.pexels.com/photos/6419128/pexels-photo-6419128.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
  Electrician: "https://images.unsplash.com/photo-1758101755915-462eddc23f57?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDV8MHwxfHNlYXJjaHwzfHxlbGVjdHJpY2lhbiUyMHdvcmtpbmclMjB3aXJlcyUyMGNhYmxlc3xlbnwwfHx8fDE3ODE4OTI4NzR8MA&ixlib=rb-4.1.0&q=85",
  default: "https://images.pexels.com/photos/4170184/pexels-photo-4170184.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

export const HERO_IMAGE = "https://images.pexels.com/photos/4170184/pexels-photo-4170184.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
