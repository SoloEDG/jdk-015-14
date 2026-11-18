import type { Analysis, Scene, StageDocument } from "../../../shared/types";
import { drawScene } from "../lib/geometry";
import { createPaletteBlender, type PaletteStore } from "./palette";
export function createRenderer(
  canvas: HTMLCanvasElement,
  doc: StageDocument,
  read: () => Analysis,
  store: PaletteStore,
) {
  const c = canvas.getContext("2d")!;
  let raf = 0,
    last = 0,
    phase = 0,
    current = "",
    previous: Scene | undefined,
    changed = 0;
  const blender = createPaletteBlender(store);
  const scratch = document.createElement("canvas");
  scratch.width = 1280;
  scratch.height = 720;
  const sc = scratch.getContext("2d")!;
  canvas.width = 1280;
  canvas.height = 720;
  function render(ms: number) {
    const dt = Math.min(0.08, (ms - last) / 1000) || 0;
    last = ms;
    const scene =
      doc.scenes.find((s) => s.id === doc.activeId) ?? doc.scenes[0];
    if (current !== scene.id) {
      previous = doc.scenes.find((s) => s.id === current);
      current = scene.id;
      changed = ms;
    }
    if (!doc.frozen) phase += dt * scene.speed;
    const a = read();
    // Palette morph and scene cross-fade are independent timelines. Each is
    // evaluated every frame against the live document, so changing one never
    // restarts or cancels the other.
    const morphMs = Math.max(0, doc.paletteTransition ?? 0) * 1000;
    drawScene(
      c,
      1280,
      720,
      scene,
      a,
      blender.resolve(scene, ms, morphMs),
      phase,
      doc.sensitivity,
    );
    const span = Math.max(0, doc.transition) * 1000;
    const mix = span > 0 ? Math.min(1, (ms - changed) / span) : 1;
    if (previous && mix < 1) {
      drawScene(
        sc,
        1280,
        720,
        previous,
        a,
        blender.resolve(previous, ms, morphMs),
        phase,
        doc.sensitivity,
      );
      c.globalAlpha = 1 - mix;
      c.drawImage(scratch, 0, 0);
      c.globalAlpha = 1;
    }
    if (doc.strobe && a.beat) {
      c.fillStyle = "#ffffff66";
      c.fillRect(0, 0, 1280, 720);
    }
    c.fillStyle = `rgba(0,0,0,${doc.blackout ? 1 : 1 - doc.master})`;
    c.fillRect(0, 0, 1280, 720);
    raf = requestAnimationFrame(render);
  }
  raf = requestAnimationFrame(render);
  return () => cancelAnimationFrame(raf);
}
