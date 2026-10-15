import { useEffect, useMemo, useState, type ReactNode } from "react";
import CssBaseline from "@mui/material/CssBaseline";
import { createTheme, ThemeProvider } from "@mui/material/styles";

type ThemeMode = "light" | "dark";
function currentMode(): ThemeMode {
  return document.documentElement.dataset.theme === "night" ? "dark" : "light";
}
export function MaterialUiProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(currentMode);
  useEffect(() => {
    const observer = new MutationObserver(() => setMode(currentMode()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  const theme = useMemo(() => createTheme({
    palette: {
      mode, primary: { main: "#e42278", contrastText: "#ffffff" }, secondary: { main: "#ed7bab" },
      background: { default: "var(--ink)", paper: mode === "dark" ? "#07100d" : "#ffffff" },
      text: { primary: "var(--white)", secondary: "var(--muted)" }, divider: "var(--line)",
    },
    typography: {
      fontFamily: "Inter, system-ui, sans-serif",
      h1: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 800 },
      h2: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 800 },
      h3: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
      h4: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
      h5: { fontFamily: '"Barlow Condensed", sans-serif', fontWeight: 700 },
      button: { fontFamily: "Inter, system-ui, sans-serif", fontWeight: 700, textTransform: "none" },
    },
    shape: { borderRadius: 5 },
    components: {
      MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { borderRadius: 5, minHeight: 40, fontWeight: 700 } } },
      MuiCard: { styleOverrides: { root: { backgroundImage: "none", borderRadius: 6 } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    },
  }), [mode]);
  return <ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider>;
}

