/**
 * @deprecated Use Tailwind tokens via className instead.
 * Semantic colours: bg-background, text-foreground, bg-primary, border-border, etc.
 * Brand palette: bg-forest-dark, text-forest-muted, text-gold, bg-secondary, etc.
 * This file will be removed once all screens are migrated off inline styles.
 */
export const C = {
  bg:           "#080d09",
  surface:      "#0f1a12",
  surface2:     "#162019",
  border:       "#1e3024",
  borderBright: "#2d4a36",

  green:        "#22c55e",
  greenDim:     "#166534",
  greenFaint:   "#052e16",
  gold:         "#f59e0b",

  textPrimary:   "#ecfdf5",
  textSecondary: "#86a98e",
  textMuted:     "#3d5c44",

  tabBg:      "#0a110c",
  tabBorder:  "#1e3024",
  tabActive:  "#22c55e",
  tabInactive:"#3d5c44",
} as const;
