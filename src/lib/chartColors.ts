// Recharts colors are literal SVG fill/stroke props, not Tailwind classes, so
// they can't pick up the brand tokens from globals.css automatically — kept
// in sync with those tokens by hand here instead.
export const CHART_COLORS = {
  primary: "#1D5FBF",
  primaryDark: "#164A97",
  navy: "#0B2A4A",
  sky: "#4A8FE0",
  grid: "#E1E9F2",
  axis: "#5B6B7F",
};

// Mirrors STATUS_COLOR_CLASSES in statusColors.ts so the member-status pie
// chart's slices match the status badges shown everywhere else in the app.
export const STATUS_CHART_COLORS = {
  green: "#1E8E5A",
  amber: "#B45309",
  red: "#DC2626",
  grey: "#64748B",
};
