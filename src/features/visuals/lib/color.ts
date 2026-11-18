import type { Palette } from "../../../shared/types";

type Rgb = [number, number, number];
type Oklch = { l: number; c: number; h: number };

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function parseHex(hex: string): Rgb {
  let value = hex.trim().replace(/^#/, "");
  if (value.length === 3)
    value = value
      .split("")
      .map((c) => c + c)
      .join("");
  if (!/^[0-9a-f]{6}$/i.test(value)) return [0, 0, 0];
  return [
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  ];
}

function toHex(rgb: Rgb): string {
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(clamp01(v) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

const toLinear = (v: number) => {
  const x = v / 255;
  return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};

const toGamma = (v: number) =>
  v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;

function toOklch(hex: string): Oklch {
  const [r8, g8, b8] = parseHex(hex);
  const r = toLinear(r8),
    g = toLinear(g8),
    b = toLinear(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return {
    l: L,
    c: Math.hypot(A, B),
    h: (Math.atan2(B, A) * 180) / Math.PI,
  };
}

function oklchToLinear({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad),
    b = c * Math.sin(rad);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const inGamut = (rgb: Rgb) => rgb.every((v) => v >= -1e-6 && v <= 1 + 1e-6);

/**
 * Convert an OKLCH colour to sRGB while preserving its lightness. When a
 * colour falls outside the sRGB gamut we reduce chroma instead of clipping
 * every channel — clipping a highly saturated intermediate colour is what
 * creates the washed-out grey / white flash this visualiser must avoid.
 */
function oklchToHex(colour: Oklch): string {
  let { c } = colour;
  if (!inGamut(oklchToLinear(colour))) {
    let lo = 0,
      hi = c;
    for (let i = 0; i < 20; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ ...colour, c: mid }))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  const linear = oklchToLinear({ ...colour, c });
  return toHex(linear.map((v) => toGamma(clamp01(v))) as Rgb);
}

/** Mix two hex colours in OKLCH, taking the shortest hue path. */
export function mixColor(a: string, b: string, t: number): string {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const ca = toOklch(a),
    cb = toOklch(b);
  // Achromatic colours (near-black backgrounds, whites) have no meaningful
  // hue. Borrow the other endpoint's hue instead of sweeping through an
  // arbitrary, possibly saturated colour on the way.
  const ha = ca.c < 0.002 ? cb.h : ca.h;
  const hb = cb.c < 0.002 ? ha : cb.h;
  const dh = ((hb - ha + 540) % 360) - 180;
  return oklchToHex({
    l: ca.l + (cb.l - ca.l) * t,
    c: ca.c + (cb.c - ca.c) * t,
    h: ha + dh * t,
  });
}

export function cloneTheme(theme: Palette): Palette {
  return {
    ...theme,
    colors: [...theme.colors] as [string, string, string],
  };
}

export function mixTheme(a: Palette, b: Palette, t: number): Palette {
  if (t <= 0) return cloneTheme(a);
  if (t >= 1) return cloneTheme(b);
  return {
    background: mixColor(a.background, b.background, t),
    colors: [
      mixColor(a.colors[0], b.colors[0], t),
      mixColor(a.colors[1], b.colors[1], t),
      mixColor(a.colors[2], b.colors[2], t),
    ],
  };
}

/** Stable identity for a palette, used to detect target changes. */
export function themeKey(theme: Palette): string {
  return [
    theme.background,
    ...theme.colors,
  ]
    .map((c) => c.toLowerCase())
    .join("|");
}
