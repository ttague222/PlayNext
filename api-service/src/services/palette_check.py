"""
Seasonal palette guardrail (design spec 6.3).

Decides whether a seasonal palette delivered by remote config is safe to
render: WCAG 2.x contrast on the background stops, and CIEDE2000 distance
between the season accent and every locked mood/status/brand color.

The mobile app ports this to JS and both implementations read the same
vectors file (tests/fixtures/palette_vectors.json), so the numbers here are a
cross-language contract.
"""

import logging
import math
import re
from typing import Dict, List, Tuple

logger = logging.getLogger("playnext-api.palette_check")

TEXT_PRIMARY = "#ffffff"
TEXT_SECONDARY = "#a0a0a0"
BRAND = "#f857a6"

LOCKED_REFERENCE_COLORS: Dict[str, str] = {
    "mood.wind_down": "#7c3aed",
    "mood.casual": "#06b6d4",
    "mood.focused": "#f59e0b",
    "mood.intense": "#ef4444",
    "semantic.success": "#4ade80",
    "semantic.error": "#ef4444",
    "semantic.warning": "#f59e0b",
    "semantic.rating": "#fbbf24",
    "brand": BRAND,
}

MIN_TEXT_CONTRAST = 4.5
MIN_UI_CONTRAST = 3.0
MIN_DELTA_E = 12.0
GRADIENT_STOPS = 3

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")

# D65 reference white
_XN, _YN, _ZN = 0.95047, 1.0, 1.08883


def _parse_hex(color: str) -> Tuple[int, int, int]:
    if not isinstance(color, str) or not _HEX_RE.match(color):
        raise ValueError(f"not a #rrggbb color: {color!r}")
    return int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)


def _linearize(channel: int, threshold: float) -> float:
    c = channel / 255.0
    return c / 12.92 if c <= threshold else ((c + 0.055) / 1.055) ** 2.4


def _relative_luminance(color: str) -> float:
    """WCAG 2.x relative luminance (sRGB threshold 0.03928)."""
    r, g, b = (_linearize(ch, 0.03928) for ch in _parse_hex(color))
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def contrast_ratio(a: str, b: str) -> float:
    """WCAG 2.x contrast ratio between two #rrggbb colors (1.0 to 21.0)."""
    la, lb = _relative_luminance(a), _relative_luminance(b)
    hi, lo = (la, lb) if la >= lb else (lb, la)
    return (hi + 0.05) / (lo + 0.05)


def _to_lab(color: str) -> Tuple[float, float, float]:
    """sRGB -> linear (threshold 0.04045) -> XYZ (D65) -> CIELAB."""
    r, g, b = (_linearize(ch, 0.04045) for ch in _parse_hex(color))
    x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b
    y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
    z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b

    def f(t: float) -> float:
        return t ** (1 / 3) if t > 216 / 24389 else (24389 / 27 * t + 16) / 116

    fx, fy, fz = f(x / _XN), f(y / _YN), f(z / _ZN)
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def delta_e2000(a: str, b: str) -> float:
    """CIEDE2000 color difference (Sharma et al. 2005) between two #rrggbb colors."""
    l1, a1, b1 = _to_lab(a)
    l2, a2, b2 = _to_lab(b)

    c1 = math.hypot(a1, b1)
    c2 = math.hypot(a2, b2)
    c_bar7 = ((c1 + c2) / 2) ** 7
    g = 0.5 * (1 - math.sqrt(c_bar7 / (c_bar7 + 25**7)))
    a1p, a2p = (1 + g) * a1, (1 + g) * a2
    c1p, c2p = math.hypot(a1p, b1), math.hypot(a2p, b2)
    h1p = math.degrees(math.atan2(b1, a1p)) % 360 if c1p else 0.0
    h2p = math.degrees(math.atan2(b2, a2p)) % 360 if c2p else 0.0

    dlp = l2 - l1
    dcp = c2p - c1p
    if c1p * c2p == 0:
        dhp = 0.0
    else:
        dh = h2p - h1p
        if dh > 180:
            dh -= 360
        elif dh < -180:
            dh += 360
        dhp = dh
    dhp_term = 2 * math.sqrt(c1p * c2p) * math.sin(math.radians(dhp / 2))

    lp_bar = (l1 + l2) / 2
    cp_bar = (c1p + c2p) / 2
    if c1p * c2p == 0:
        hp_bar = h1p + h2p
    elif abs(h1p - h2p) <= 180:
        hp_bar = (h1p + h2p) / 2
    elif h1p + h2p < 360:
        hp_bar = (h1p + h2p + 360) / 2
    else:
        hp_bar = (h1p + h2p - 360) / 2

    t = (
        1
        - 0.17 * math.cos(math.radians(hp_bar - 30))
        + 0.24 * math.cos(math.radians(2 * hp_bar))
        + 0.32 * math.cos(math.radians(3 * hp_bar + 6))
        - 0.20 * math.cos(math.radians(4 * hp_bar - 63))
    )
    d_theta = 30 * math.exp(-(((hp_bar - 275) / 25) ** 2))
    r_c = 2 * math.sqrt(cp_bar**7 / (cp_bar**7 + 25**7))
    s_l = 1 + 0.015 * (lp_bar - 50) ** 2 / math.sqrt(20 + (lp_bar - 50) ** 2)
    s_c = 1 + 0.045 * cp_bar
    s_h = 1 + 0.015 * cp_bar * t
    r_t = -math.sin(math.radians(2 * d_theta)) * r_c

    return math.sqrt(
        (dlp / s_l) ** 2
        + (dcp / s_c) ** 2
        + (dhp_term / s_h) ** 2
        + r_t * (dcp / s_c) * (dhp_term / s_h)
    )


def palette_violations(palette: dict) -> List[str]:
    """
    Check a seasonal palette against the guardrail. Returns human-readable
    violations, each naming the rule, the colors and the measured value.
    An empty list means the palette is safe. Malformed input is reported as a
    violation rather than raised.

    palette: {"bg_gradient": [s0, s1, s2], "bg_decor": str,
              "accent_season": str, "on_accent_season": str}
    """
    try:
        stops = palette["bg_gradient"]
        accent = palette["accent_season"]
        on_accent = palette["on_accent_season"]
        if not isinstance(stops, (list, tuple)) or len(stops) != GRADIENT_STOPS:
            return [f"bg_gradient must have {GRADIENT_STOPS} stops, got {stops!r}"]
        for color in (*stops, accent, on_accent):
            _parse_hex(color)
    except (KeyError, TypeError, ValueError) as exc:
        return [f"malformed palette: {exc}"]

    violations: List[str] = []

    for stop in stops:
        ratio = contrast_ratio(TEXT_PRIMARY, stop)
        if ratio < MIN_TEXT_CONTRAST:
            violations.append(
                f"contrast: {TEXT_PRIMARY} on bg stop {stop} is {ratio:.2f}:1 "
                f"(need >= {MIN_TEXT_CONTRAST})"
            )

    middle = stops[1]
    ratio = contrast_ratio(TEXT_SECONDARY, middle)
    if ratio < MIN_TEXT_CONTRAST:
        violations.append(
            f"contrast: text.secondary {TEXT_SECONDARY} on middle stop {middle} is "
            f"{ratio:.2f}:1 (need >= {MIN_TEXT_CONTRAST})"
        )

    # The app's tab bar takes the bottom stop and labels it in text.secondary.
    bottom = stops[2]
    ratio = contrast_ratio(TEXT_SECONDARY, bottom)
    if ratio < MIN_TEXT_CONTRAST:
        violations.append(
            f"contrast: text.secondary {TEXT_SECONDARY} on bottom stop {bottom} is "
            f"{ratio:.2f}:1 (need >= {MIN_TEXT_CONTRAST})"
        )

    lightest = max(stops, key=_relative_luminance)
    ratio = contrast_ratio(BRAND, lightest)
    if ratio < MIN_UI_CONTRAST:
        violations.append(
            f"contrast: brand {BRAND} on lightest stop {lightest} is {ratio:.2f}:1 "
            f"(need >= {MIN_UI_CONTRAST})"
        )

    ratio = contrast_ratio(on_accent, accent)
    if ratio < MIN_TEXT_CONTRAST:
        violations.append(
            f"contrast: on_accent_season {on_accent} on accent_season {accent} is "
            f"{ratio:.2f}:1 (need >= {MIN_TEXT_CONTRAST})"
        )

    for name, locked in LOCKED_REFERENCE_COLORS.items():
        distance = delta_e2000(accent, locked)
        if distance < MIN_DELTA_E:
            violations.append(
                f"delta E2000: accent_season {accent} is {distance:.1f} from "
                f"{name} {locked} (need >= {MIN_DELTA_E:g})"
            )

    if violations:
        logger.warning("Seasonal palette rejected: %s", "; ".join(violations))
    return violations
