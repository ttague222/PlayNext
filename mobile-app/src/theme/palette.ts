/**
 * Seasonal palette guardrail (design spec 6.3), on-device copy.
 *
 * Port of api-service/src/services/palette_check.py. Both implementations read
 * api-service/tests/fixtures/palette_vectors.json, so the thresholds, locked
 * reference colors and arithmetic here must stay in step with the Python module.
 */

export type SeasonPalette = {
  bg_gradient: [string, string, string];
  bg_decor: string;
  accent_season: string;
  on_accent_season: string;
};

const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#a0a0a0';
const BRAND = '#f857a6';

// Insertion order matches the Python module, so violations list in the same order.
const LOCKED_REFERENCE_COLORS: Array<[string, string]> = [
  ['mood.wind_down', '#7c3aed'],
  ['mood.casual', '#06b6d4'],
  ['mood.focused', '#f59e0b'],
  ['mood.intense', '#ef4444'],
  ['semantic.success', '#4ade80'],
  ['semantic.error', '#ef4444'],
  ['semantic.warning', '#f59e0b'],
  ['semantic.rating', '#fbbf24'],
  ['brand', BRAND],
];

const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST = 3.0;
const MIN_DELTA_E = 12.0;
const GRADIENT_STOPS = 3;

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// D65 reference white
const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

type Rgb = [number, number, number];

function parseHex(color: unknown): Rgb {
  if (typeof color !== 'string' || !HEX_RE.test(color)) {
    throw new Error(`not a #rrggbb color: ${JSON.stringify(color)}`);
  }
  return [
    parseInt(color.slice(1, 3), 16),
    parseInt(color.slice(3, 5), 16),
    parseInt(color.slice(5, 7), 16),
  ];
}

function linearize(channel: number, threshold: number): number {
  const c = channel / 255;
  return c <= threshold ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** WCAG 2.x relative luminance (sRGB threshold 0.03928). */
function relativeLuminance(color: string): number {
  const [r, g, b] = parseHex(color).map((ch) => linearize(ch, 0.03928));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio between two #rrggbb colors (1.0 to 21.0). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = la >= lb ? la : lb;
  const lo = la >= lb ? lb : la;
  return (hi + 0.05) / (lo + 0.05);
}

/** sRGB -> linear (threshold 0.04045) -> XYZ (D65) -> CIELAB. */
function toLab(color: string): Rgb {
  const [r, g, b] = parseHex(color).map((ch) => linearize(ch, 0.04045));
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;

  const f = (t: number): number => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);

  const fx = f(x / XN);
  const fy = f(y / YN);
  const fz = f(z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const deg = (radians: number): number => (radians * 180) / Math.PI;
const mod360 = (x: number): number => ((x % 360) + 360) % 360;
const POW25_7 = 25 ** 7;

/** CIEDE2000 color difference (Sharma et al. 2005) between two #rrggbb colors. */
export function deltaE2000(a: string, b: string): number {
  const [l1, a1, b1] = toLab(a);
  const [l2, a2, b2] = toLab(b);

  const c1 = Math.hypot(a1, b1);
  const c2 = Math.hypot(a2, b2);
  const cBar7 = ((c1 + c2) / 2) ** 7;
  const g = 0.5 * (1 - Math.sqrt(cBar7 / (cBar7 + POW25_7)));
  const a1p = (1 + g) * a1;
  const a2p = (1 + g) * a2;
  const c1p = Math.hypot(a1p, b1);
  const c2p = Math.hypot(a2p, b2);
  const h1p = c1p ? mod360(deg(Math.atan2(b1, a1p))) : 0;
  const h2p = c2p ? mod360(deg(Math.atan2(b2, a2p))) : 0;

  const dlp = l2 - l1;
  const dcp = c2p - c1p;
  let dhp = 0;
  if (c1p * c2p !== 0) {
    let dh = h2p - h1p;
    if (dh > 180) dh -= 360;
    else if (dh < -180) dh += 360;
    dhp = dh;
  }
  const dhpTerm = 2 * Math.sqrt(c1p * c2p) * Math.sin(rad(dhp / 2));

  const lpBar = (l1 + l2) / 2;
  const cpBar = (c1p + c2p) / 2;
  let hpBar: number;
  if (c1p * c2p === 0) hpBar = h1p + h2p;
  else if (Math.abs(h1p - h2p) <= 180) hpBar = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hpBar = (h1p + h2p + 360) / 2;
  else hpBar = (h1p + h2p - 360) / 2;

  const t =
    1 -
    0.17 * Math.cos(rad(hpBar - 30)) +
    0.24 * Math.cos(rad(2 * hpBar)) +
    0.32 * Math.cos(rad(3 * hpBar + 6)) -
    0.2 * Math.cos(rad(4 * hpBar - 63));
  const dTheta = 30 * Math.exp(-(((hpBar - 275) / 25) ** 2));
  const rC = 2 * Math.sqrt(cpBar ** 7 / (cpBar ** 7 + POW25_7));
  const sL = 1 + (0.015 * (lpBar - 50) ** 2) / Math.sqrt(20 + (lpBar - 50) ** 2);
  const sC = 1 + 0.045 * cpBar;
  const sH = 1 + 0.015 * cpBar * t;
  const rT = -Math.sin(rad(2 * dTheta)) * rC;

  return Math.sqrt(
    (dlp / sL) ** 2 + (dcp / sC) ** 2 + (dhpTerm / sH) ** 2 + rT * (dcp / sC) * (dhpTerm / sH)
  );
}

/** '#rrggbb' + opacity -> 'rgba(r,g,b,a)'. */
export function alpha(hex: string, a: number): string {
  const [r, g, b] = parseHex(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/**
 * Check a seasonal palette against the guardrail. Returns human-readable
 * violations, each naming the rule, the colors and the measured value. An empty
 * list means the palette is safe. Malformed input is reported as a violation
 * rather than thrown.
 */
export function paletteViolations(palette: SeasonPalette): string[] {
  let stops: string[];
  let accent: string;
  let onAccent: string;
  try {
    const candidate = palette as unknown as Record<string, unknown>;
    if (candidate === null || typeof candidate !== 'object') {
      return [`malformed palette: ${JSON.stringify(palette)}`];
    }
    const rawStops = candidate.bg_gradient;
    if (!Array.isArray(rawStops) || rawStops.length !== GRADIENT_STOPS) {
      return [`bg_gradient must have ${GRADIENT_STOPS} stops, got ${JSON.stringify(rawStops)}`];
    }
    stops = rawStops as string[];
    accent = candidate.accent_season as string;
    onAccent = candidate.on_accent_season as string;
    [...stops, accent, onAccent].forEach(parseHex);
  } catch (exc) {
    return [`malformed palette: ${(exc as Error).message}`];
  }

  const violations: string[] = [];

  for (const stop of stops) {
    const ratio = contrastRatio(TEXT_PRIMARY, stop);
    if (ratio < MIN_TEXT_CONTRAST) {
      violations.push(
        `contrast: ${TEXT_PRIMARY} on bg stop ${stop} is ${ratio.toFixed(2)}:1 (need >= ${MIN_TEXT_CONTRAST})`
      );
    }
  }

  const middle = stops[1];
  let ratio = contrastRatio(TEXT_SECONDARY, middle);
  if (ratio < MIN_TEXT_CONTRAST) {
    violations.push(
      `contrast: text.secondary ${TEXT_SECONDARY} on middle stop ${middle} is ${ratio.toFixed(2)}:1 ` +
        `(need >= ${MIN_TEXT_CONTRAST})`
    );
  }

  // The tab bar takes the bottom stop and labels it in text.secondary.
  const bottom = stops[2];
  ratio = contrastRatio(TEXT_SECONDARY, bottom);
  if (ratio < MIN_TEXT_CONTRAST) {
    violations.push(
      `contrast: text.secondary ${TEXT_SECONDARY} on bottom stop ${bottom} is ${ratio.toFixed(2)}:1 ` +
        `(need >= ${MIN_TEXT_CONTRAST})`
    );
  }

  // First stop wins a luminance tie, as with Python's max().
  const lightest = stops.reduce((best, stop) =>
    relativeLuminance(stop) > relativeLuminance(best) ? stop : best
  );
  ratio = contrastRatio(BRAND, lightest);
  if (ratio < MIN_UI_CONTRAST) {
    violations.push(
      `contrast: brand ${BRAND} on lightest stop ${lightest} is ${ratio.toFixed(2)}:1 (need >= ${MIN_UI_CONTRAST.toFixed(1)})`
    );
  }

  ratio = contrastRatio(onAccent, accent);
  if (ratio < MIN_TEXT_CONTRAST) {
    violations.push(
      `contrast: on_accent_season ${onAccent} on accent_season ${accent} is ${ratio.toFixed(2)}:1 ` +
        `(need >= ${MIN_TEXT_CONTRAST})`
    );
  }

  for (const [name, locked] of LOCKED_REFERENCE_COLORS) {
    const distance = deltaE2000(accent, locked);
    if (distance < MIN_DELTA_E) {
      violations.push(
        `delta E2000: accent_season ${accent} is ${distance.toFixed(1)} from ${name} ${locked} ` +
          `(need >= ${MIN_DELTA_E})`
      );
    }
  }

  return violations;
}
