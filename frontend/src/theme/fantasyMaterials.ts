// Static requires are shared by every instance, including native SVG images.
export const fantasyImages = {
  screen: require("../../assets/ui/fantasy/screen-parchment.png"),
  vignette: require("../../assets/ui/fantasy/parchment-vignette.png"),
  paper: require("../../assets/ui/fantasy/paper-inset.png"),
};

export const fantasyMaterials = {
  panel: { source: require("../../assets/ui/fantasy/parchment-panel.png"), width: 800, height: 464, density: 4, caps: [64, 64, 64, 64] },
  nav: { source: require("../../assets/ui/fantasy/bottom-nav-shell.png"), width: 1086, height: 120, density: 3, caps: [48, 12, 48, 32] },
  primary: { source: require("../../assets/ui/fantasy/primary-button.png"), width: 800, height: 186, density: 3, caps: [72, 40, 72, 40] },
  disabled: { source: require("../../assets/ui/fantasy/primary-button-disabled.png"), width: 800, height: 186, density: 3, caps: [72, 40, 72, 40] },
  selected: { source: require("../../assets/ui/fantasy/selected-tab.png"), width: 600, height: 157, density: 5, caps: [70, 56, 70, 56] },
  resource: { source: require("../../assets/ui/fantasy/resource-pill.png"), width: 500, height: 131, density: 5, caps: [80, 48, 80, 48] },
  input: { source: require("../../assets/ui/fantasy/input-field.png"), width: 800, height: 146, density: 4, caps: [64, 40, 64, 40] },
} as const;
