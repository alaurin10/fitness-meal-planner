import { useTheme, type Palette, type ResolvedTheme } from "./theme";

/**
 * Maps the app's design tokens onto Clerk's appearance variables so the
 * embedded <UserProfile /> matches the active palette and theme.
 *
 * Clerk derives hover/active shades from these values at runtime, so they
 * must be concrete colors — CSS var() strings won't work. Keep in sync with
 * the palette blocks in styles/tokens.css (same trade-off as THEME_COLOR in
 * lib/theme.ts).
 */
interface ClerkColors {
  paper: string;
  ink: string;
  sumi: string;
  muted: string;
  hair: string;
  accent: string;
  onAccent: string;
  rose: string;
  field: string;
}

const PALETTE_HEX: Record<Palette, Record<ResolvedTheme, ClerkColors>> = {
  earthy: {
    light: {
      paper: "#FAF3E6",
      ink: "#3A2E24",
      sumi: "#5D4A3A",
      muted: "#72624E",
      hair: "#DCCBB0",
      accent: "#C77D4F",
      onAccent: "#FAF3E6",
      rose: "#B5615E",
      field: "#FCF7EE",
    },
    dark: {
      paper: "#241C16",
      ink: "#F2E8D9",
      sumi: "#CDBBA4",
      muted: "#9C8A74",
      hair: "#3B2F26",
      accent: "#D98C5C",
      onAccent: "#1A1410",
      rose: "#D98C88",
      field: "#1E1712",
    },
  },
  carbon: {
    light: {
      paper: "#FFFFFF",
      ink: "#16181B",
      sumi: "#3F444B",
      muted: "#646B75",
      hair: "#E2E5E9",
      accent: "#4F7DF9",
      onAccent: "#FFFFFF",
      rose: "#DC4C4C",
      field: "#FFFFFF",
    },
    dark: {
      paper: "#1A1C1F",
      ink: "#F5F6F7",
      sumi: "#C9CDD2",
      muted: "#8A9099",
      hair: "#2E3237",
      accent: "#D4FF4F",
      onAccent: "#0E0F11",
      rose: "#F87171",
      field: "#141619",
    },
  },
};

/**
 * Appearance object for embedded Clerk components. Reads the live theme
 * store, so palette/theme switches re-render Clerk UI immediately.
 */
export function useClerkAppearance() {
  const { palette, resolved } = useTheme();
  const c = PALETTE_HEX[palette][resolved];

  return {
    variables: {
      colorPrimary: c.accent,
      colorTextOnPrimaryBackground: c.onAccent,
      colorBackground: c.paper,
      colorText: c.ink,
      colorTextSecondary: c.sumi,
      colorInputBackground: c.field,
      colorInputText: c.ink,
      colorNeutral: c.ink,
      colorDanger: c.rose,
      borderRadius: "14px",
      fontFamily: "var(--font-body)",
    },
    elements: {
      rootBox: { width: "100%" },
      cardBox: {
        width: "100%",
        maxWidth: "100%",
        boxShadow: "var(--shadow-md)",
        border: "1px solid " + c.hair,
      },
    },
  };
}
