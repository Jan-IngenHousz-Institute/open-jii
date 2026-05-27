// "Measure" is a launcher-only tab: its tabPress is intercepted in the tab
// layout to push the root `/measurement-flow` screen, so this scene never
// actually renders.
export default function MeasureLauncher() {
  return null;
}
