export type SceneKind = "orbit" | "spectrum" | "wave" | "tunnel";
export interface Palette {
  colors: [string, string, string];
  background: string;
}
export interface Scene {
  id: string;
  name: string;
  kind: SceneKind;
  theme: string;
  /** Palette saved for this scene when it does not use a preset. */
  custom?: Palette;
  intensity: number;
  speed: number;
}
export interface Analysis {
  bins: number[];
  wave: number[];
  rms: number;
  bass: number;
  beat: boolean;
  time: number;
}
export interface StageDocument {
  scenes: Scene[];
  activeId: string;
  gain: number;
  sensitivity: number;
  smoothing: number;
  transition: number;
  /** Duration of a palette colour morph, in seconds. */
  paletteTransition: number;
  blackout: boolean;
  frozen: boolean;
  strobe: boolean;
  master: number;
}
export interface Take {
  id: string;
  url: string;
  size: number;
  duration: number;
  name: string;
  mime: string;
}
export interface Theme {
  id: string;
  name: string;
  colors: [string, string, string];
  background: string;
}
