import { alpha, type PaletteMode, type ThemeOptions } from "@mui/material";

export const getDesignTokens = (mode: PaletteMode): ThemeOptions => {
  const dark = mode === "dark";
  const accent = dark ? "#8abbff" : "#2463b4";
  const foreground = dark ? "#e6edf7" : "#233247";
  const muted = dark ? "#a5b3c7" : "#607087";
  const surface = dark ? "#182333" : "#ffffff";
  const canvas = dark ? "#101925" : "#f4f7fb";
  const line = dark ? "#304054" : "#dce4ef";
  const soft = dark ? "#1d2b3d" : "#f0f4fa";
  const shadow = dark
    ? "0 4px 20px rgba(0,0,0,0.18)"
    : "0 4px 20px rgba(35,57,87,0.05)";

  return {
    palette: {
      mode,
      primary: {
        main: accent,
        light: dark ? "#bad6ff" : "#5a8ed0",
        dark: dark ? "#609eea" : "#1c4d8d",
        contrastText: dark ? "#102037" : "#ffffff",
      },
      secondary: { main: dark ? "#b6a6f5" : "#7253aa" },
      success: { main: dark ? "#7bd3b0" : "#187655" },
      warning: { main: dark ? "#f2c078" : "#966015" },
      error: { main: dark ? "#ff9caa" : "#bd3c50" },
      info: { main: accent },
      background: { default: canvas, paper: surface },
      text: { primary: foreground, secondary: muted },
      divider: line,
      action: {
        hover: alpha(accent, dark ? 0.08 : 0.04),
        selected: alpha(accent, dark ? 0.14 : 0.08),
        focus: alpha(accent, 0.16),
      },
    },
    typography: {
      fontFamily:
        '"Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica", "Arial", sans-serif',
      h1: { fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.035em" },
      h2: { fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.03em" },
      h3: { fontWeight: 600, lineHeight: 1.3, letterSpacing: "-0.025em" },
      h4: { fontWeight: 600, lineHeight: 1.35, letterSpacing: "-0.025em" },
      h5: { fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.02em" },
      h6: { fontWeight: 600, lineHeight: 1.45, letterSpacing: "-0.015em" },
      body1: { lineHeight: 1.6 },
      body2: { lineHeight: 1.6 },
      button: { textTransform: "none", fontWeight: 600, letterSpacing: "0" },
      caption: { lineHeight: 1.5 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { colorScheme: mode },
          body: {
            backgroundColor: canvas,
            backgroundImage: `radial-gradient(ellipse at top right, ${alpha(accent, dark ? 0.035 : 0.045)}, transparent 60%)`,
          },
          "::selection": {
            backgroundColor: alpha(accent, 0.25),
            color: foreground,
          },
          "*": {
            scrollbarColor: `${dark ? "#53657d" : "#b6c4d5"} transparent`,
          },
          "*::-webkit-scrollbar": { width: 10, height: 10 },
          "*::-webkit-scrollbar-thumb": {
            backgroundColor: dark ? "#53657d" : "#b6c4d5",
            border: "2px solid transparent",
            backgroundClip: "padding-box",
            borderRadius: 10,
          },
          "*::-webkit-scrollbar-track": { backgroundColor: "transparent" },
          ".MuiButtonBase-root.Mui-focusVisible": {
            outline: `2px solid ${accent}`,
            outlineOffset: 3,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            boxShadow: "none",
            transition:
              "background-color 140ms ease, border-color 140ms ease, box-shadow 140ms ease",
            "&:hover": { boxShadow: "none" },
          },
          contained: {
            "&:hover": { boxShadow: `0 3px 10px ${alpha(accent, 0.14)}` },
          },
          outlinedPrimary: { borderColor: alpha(accent, 0.45) },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: "background-color 140ms ease, color 140ms ease",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          elevation1: { border: `1px solid ${line}`, boxShadow: shadow },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: surface,
            color: foreground,
            boxShadow: "none",
            borderBottom: `1px solid ${line}`,
            "@supports ((backdrop-filter: blur(12px)) or (-webkit-backdrop-filter: blur(12px)))":
              {
                backgroundColor: alpha(surface, 0.94),
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              },
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: dark ? "#141f2e" : "#fbfcfe",
            borderColor: line,
            boxShadow: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            transition: "background-color 140ms ease, color 140ms ease",
            ".MuiDrawer-paper &": { margin: "3px 10px" },
            "&.Mui-selected": {
              color: accent,
              backgroundColor: alpha(accent, dark ? 0.14 : 0.08),
              "& .MuiListItemIcon-root": { color: accent },
              "& .MuiListItemText-primary": { fontWeight: 600 },
              "&:hover": { backgroundColor: alpha(accent, dark ? 0.2 : 0.12) },
            },
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { color: muted } } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 9,
            backgroundColor: alpha(dark ? "#0d1521" : "#f7f9fc", 0.5),
            transition: "background-color 140ms ease, box-shadow 140ms ease",
            "& .MuiOutlinedInput-notchedOutline": { borderColor: line },
            "&:hover:not(.Mui-error):not(.Mui-disabled) .MuiOutlinedInput-notchedOutline":
              { borderColor: dark ? "#7386a0" : "#9cacc0" },
            "&.Mui-focused:not(.Mui-error)": {
              backgroundColor: surface,
              boxShadow: `0 0 0 3px ${alpha(accent, 0.12)}`,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: accent },
            },
          },
          input: { "&::placeholder": { opacity: 0.7 } },
        },
      },
      MuiFormHelperText: { styleOverrides: { root: { lineHeight: 1.5 } } },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: line },
          head: {
            backgroundColor: soft,
            color: muted,
            fontWeight: 600,
            lineHeight: 1.5,
          },
          body: { fontSize: "0.875rem" },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            "&:last-child td": { borderBottom: 0 },
            "&.MuiTableRow-hover:hover": {
              backgroundColor: alpha(accent, 0.04),
            },
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 7, fontWeight: 500 } },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 16,
            border: `1px solid ${line}`,
            boxShadow: dark
              ? "0 20px 70px rgba(0,0,0,0.4)"
              : "0 20px 70px rgba(29,46,70,0.18)",
          },
        },
      },
      MuiDialogTitle: {
        styleOverrides: { root: { fontWeight: 600, letterSpacing: "-0.02em" } },
      },
      MuiDialogContent: { styleOverrides: { dividers: { borderColor: line } } },
      MuiDialogActions: {
        styleOverrides: { root: { padding: "16px 24px", gap: 4 } },
      },
      MuiBackdrop: {
        styleOverrides: {
          root: {
            backgroundColor: dark ? "rgba(3,9,18,0.7)" : "rgba(24,39,60,0.4)",
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${line}`,
            borderRadius: 12,
            boxShadow: dark
              ? "0 10px 32px rgba(0,0,0,0.3)"
              : "0 10px 32px rgba(35,57,87,0.12)",
          },
        },
      },
      MuiMenuItem: {
        styleOverrides: { root: { borderRadius: 6, margin: "2px 5px" } },
      },
      MuiAlert: {
        styleOverrides: {
          root: { borderRadius: 10 },
          standardSuccess: { backgroundColor: dark ? "#17392f" : "#ecf7f1" },
          standardError: { backgroundColor: dark ? "#3e2631" : "#fff0f2" },
          standardWarning: { backgroundColor: dark ? "#3a3021" : "#fff7e8" },
          standardInfo: { backgroundColor: dark ? "#1b304a" : "#edf4ff" },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: dark ? "#e6edf7" : "#233247",
            color: dark ? "#172234" : "#ffffff",
            borderRadius: 7,
            fontSize: "0.75rem",
            lineHeight: 1.5,
          },
        },
      },
      MuiStepLabel: {
        styleOverrides: {
          label: {
            color: muted,
            "&.Mui-active": { color: foreground, fontWeight: 600 },
          },
        },
      },
      MuiStepConnector: { styleOverrides: { line: { borderColor: line } } },
      MuiTabs: {
        styleOverrides: {
          indicator: { height: 3, borderRadius: "3px 3px 0 0" },
        },
      },
      MuiTab: {
        styleOverrides: { root: { textTransform: "none", fontWeight: 600 } },
      },
    },
  };
};
