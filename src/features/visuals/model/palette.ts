import { shallowRef } from "vue";
import type { Palette, Scene } from "../../../shared/types";
import { getTheme, themes } from "./themes";
import { mixTheme, themeKey } from "../lib/color";

const clonePalette = (p: Palette): Palette => ({
  colors: [...p.colors] as [string, string, string],
  background: p.background,
});

export const presetPalette = (id: string): Palette => {
  const theme = getTheme(id);
  return { colors: [...theme.colors], background: theme.background };
};

/** Palette resolved from the scene's saved theme, without trial previews. */
export function savedPalette(scene: Scene): Palette {
  if (scene.theme === "custom" && scene.custom)
    return clonePalette(scene.custom);
  return presetPalette(scene.theme);
}

export function createPalette() {
  const trial = shallowRef<{ sceneId: string; palette: Palette } | null>(null);
  /** Palette currently being auditioned in the editor, for one scene only. */
  function target(scene: Scene): Palette {
    const t = trial.value;
    if (t && t.sceneId === scene.id) return t.palette;
    return savedPalette(scene);
  }
  /** Preview a palette without committing it; other scenes are untouched. */
  function audition(sceneId: string, palette: Palette) {
    trial.value = { sceneId, palette: clonePalette(palette) };
  }
  function cancel() {
    trial.value = null;
  }
  /** Commit a palette to one scene only; presets stay untouched. */
  function save(scene: Scene, palette: Palette) {
    scene.custom = clonePalette(palette);
    scene.theme = "custom";
    trial.value = null;
  }
  return {
    trial,
    target,
    audition,
    cancel,
    save,
    presets: themes,
  };
}
export type PaletteStore = ReturnType<typeof createPalette>;

interface Morph {
  from: Palette;
  to: Palette;
  key: string;
  start: number;
  duration: number;
}

const ease = (t: number) => t * t * (3 - 2 * t);

export function createPaletteBlender(store: PaletteStore) {
  const morphs = new Map<string, Morph>();

  function blend(m: Morph, now: number): Palette {
    if (m.duration <= 0) return clonePalette(m.to);
    const raw = Math.min(1, Math.max(0, (now - m.start) / m.duration));
    if (raw >= 1) return clonePalette(m.to);
    // Mix in OKLCH so background, lines and particles all move together and
    // lightness travels evenly between endpoints. Interpolating in sRGB here
    // is what would dip through grey or overshoot into a white flash when the
    // two palettes have very different luminance.
    return mixTheme(m.from, m.to, ease(raw));
  }

  /**
   * Palette for a scene at this instant. When the scene's target changes
   * mid-morph the new morph starts from the exact colours currently visible,
   * so auditioning a third palette never snaps back to a preset.
   */
  function resolve(scene: Scene, now: number, duration: number): Palette {
    const next = store.target(scene);
    const key = themeKey(next);
    const previous = morphs.get(scene.id);
    if (!previous) {
      const m: Morph = {
        from: clonePalette(next),
        to: clonePalette(next),
        key,
        start: now,
        duration: 0,
      };
      morphs.set(scene.id, m);
      return clonePalette(next);
    }
    if (previous.key !== key) {
      const visible = blend(previous, now);
      previous.from = visible;
      previous.to = clonePalette(next);
      previous.key = key;
      previous.start = now;
      previous.duration = Math.max(0, duration);
    }
    return blend(previous, now);
  }

  return { resolve };
}
