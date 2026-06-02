import type { Theme } from "@react-navigation/native";

const LIGHT_THEME: Theme = {
  dark: false,
  colors: {
    primary: "hsl(142, 71%, 45%)",
    background: "hsl(0, 0%, 100%)",
    card: "hsl(138, 25%, 98%)",
    text: "hsl(136, 27%, 8%)",
    border: "hsl(138, 12%, 88%)",
    notification: "hsl(0, 84.2%, 60.2%)",
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "900" },
  },
};

const DARK_THEME: Theme = {
  dark: true,
  colors: {
    primary: "hsl(142, 71%, 45%)",
    background: "hsl(132, 24%, 4%)",
    card: "hsl(136, 27%, 8%)",
    text: "hsl(150, 60%, 97%)",
    border: "hsl(140, 23%, 15%)",
    notification: "hsl(0, 62.8%, 30.6%)",
  },
  fonts: {
    regular: { fontFamily: "System", fontWeight: "400" },
    medium: { fontFamily: "System", fontWeight: "500" },
    bold: { fontFamily: "System", fontWeight: "700" },
    heavy: { fontFamily: "System", fontWeight: "900" },
  },
};

export const NAV_THEME = {
  light: LIGHT_THEME,
  dark: DARK_THEME,
};
