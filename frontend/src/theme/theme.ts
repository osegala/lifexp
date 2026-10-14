// Existing screens keep these defaults until their own visual migration.
export const colors = {
  background: "#111713",
  card: "#1A211C",
  cardLight: "#242E26",
  primary: "#9B8352",
  primaryDark: "#6F5E3E",
  accent: "#8DAA78",
  text: "#F2EFE6",
  mutedText: "#B8B3A6",
  danger: "#D46F63",
  border: "#364036",
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 8,
  pill: 999,
};

export const shadow = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.14,
  shadowRadius: 4,
  elevation: 2,
};

// Phase 1: opt-in parchment surfaces; no global recoloring of game scenes/modals.
export const uiTheme = {
  colors: {
    background: "#F3EBDC",
    surface: "#FBF6EC",
    elevated: "#FFFCF5",
    stone: "#E8DFD0",
    primary: "#2E503D",
    primaryPressed: "#243E30",
    secondary: "#3B5F7D",
    gold: "#C59A55",
    border: "#D6C6AC",
    controlBorder: "#8B7B65",
    divider: "#E5D8C3",
    text: "#292C27",
    secondaryText: "#585C50",
    subduedText: "#6A685D",
    onPrimary: "#FFF8E8",
    success: "#315C40",
    successSurface: "#E4ECDE",
    warning: "#76511D",
    warningSurface: "#F4E6C8",
    danger: "#963E35",
    locked: "#655F54",
    disabled: "#E4DED2",
    disabledText: "#625E54",
    coin: "#7C5419",
    coinSurface: "#F4E5BF",
    gem: "#305C79",
    gemSurface: "#E1EBEF",
    xp: "#4B7895",
    xpTrack: "#E0E4DE",
    focus: "#3B5F7D",
    navigation: "#1D2923",
    navigationSelected: "#344F3D",
    navigationText: "#CFC7B8",
    navigationActive: "#F2D394",
    navigationBorder: "#706343",
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 },
  radius: { sm: 4, md: 8, lg: 12, pill: 999 },
  font: {
    display: { ios: "Georgia", android: "serif", default: "Georgia, serif" },
    body: { ios: "System", android: "sans-serif", default: "system-ui, sans-serif" },
  },
  type: {
    display: { fontSize: 30, lineHeight: 38, fontWeight: "400" },
    section: { fontSize: 21, lineHeight: 28, fontWeight: "400" },
    body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
    label: { fontSize: 15, lineHeight: 22, fontWeight: "600" },
    caption: { fontSize: 13, lineHeight: 19, fontWeight: "400" },
    tab: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  },
  size: { target: 48, cardPadding: 16, icon: 22, smallIcon: 18, pill: 32, tabBar: 64, tabIcon: 24, contentMax: 720 },
  shadow: {
    shadowColor: "#4C422F", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 4, elevation: 1,
  },
} as const;
