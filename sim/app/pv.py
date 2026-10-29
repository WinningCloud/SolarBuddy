"""Single-diode PV panel model, vectorised with NumPy.

A panel is three substrings in series, each with a bypass diode. A substring follows
    I = Il - I0 (exp((V + I Rs) / a) - 1) - (V + I Rs) / Rsh
which is solved for V at a given current by bisection (V is monotone decreasing in I).
All coefficients marked Assumption are listed in docs/METHODOLOGY.md.
"""

from __future__ import annotations

from dataclasses import dataclass, replace

import numpy as np

VT = 0.025852  # thermal voltage at 25 C, volts
CELLS_PER_SUBSTRING = 20
SUBSTRINGS = 3
BYPASS_VF_V = 0.5  # Assumption: Schottky bypass diode forward drop
TEMP_COEFF_VOC_PER_K = -0.0029  # Assumption: typical c-Si
TEMP_COEFF_ISC_PER_K = 0.0005  # Assumption: typical c-Si
RSH_PANEL_OHM = 300.0  # Assumption: shunt resistance of a healthy panel
I_REVERSE_MIN_A = -2.5  # how far the curve is sampled into reverse current


@dataclass(frozen=True)
class Substring:
    il_a: float
    i0_a: float
    a_v: float
    rs_ohm: float
    rsh_ohm: float


Panel = tuple[Substring, Substring, Substring]


def substring_voltage(s: Substring, i_a: np.ndarray, g: float, temp_c: float) -> np.ndarray:
    il = s.il_a * g * (1 + TEMP_COEFF_ISC_PER_K * (temp_c - 25))
    lo = np.full_like(i_a, -2 * BYPASS_VF_V - 5.0, dtype=float)
    hi = np.full_like(i_a, 40.0, dtype=float)
    for _ in range(46):
        mid = (lo + hi) / 2
        x = (mid + i_a * s.rs_ohm) / s.a_v
        f = il - s.i0_a * np.expm1(np.minimum(x, 700.0)) - (mid + i_a * s.rs_ohm) / s.rsh_ohm - i_a
        positive = f > 0
        lo = np.where(positive, mid, lo)
        hi = np.where(positive, hi, mid)
    # The bypass diode clamps a substring that would go below -Vf.
    return np.maximum((lo + hi) / 2, -BYPASS_VF_V)


def panel_voltage(panel: Panel, i_a: np.ndarray, irradiance: tuple[float, float, float], temp_c: float) -> np.ndarray:
    v = np.zeros_like(i_a, dtype=float)
    for s, irr in zip(panel, irradiance):
        v += substring_voltage(s, i_a, irr / 1000.0, temp_c)
    return v * (1 + TEMP_COEFF_VOC_PER_K * (temp_c - 25))


def build_curve(
    panel: Panel,
    irradiance: tuple[float, float, float] = (1000.0, 1000.0, 1000.0),
    temp_c: float = 25.0,
    points: int = 160,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (I, V) sampled on a uniform current grid from reverse injection upward. V falls as I rises."""
    max_il = max(s.il_a * irr / 1000.0 for s, irr in zip(panel, irradiance))
    i_max = max(max_il * 1.15, 0.5)
    i_a = np.linspace(I_REVERSE_MIN_A, i_max, points)
    return i_a, panel_voltage(panel, i_a, irradiance, temp_c)


def operating_point(i_a: np.ndarray, v_v: np.ndarray) -> dict[str, float]:
    p = i_a * v_v
    ok = (i_a >= 0) & (v_v >= 0)
    k = int(np.argmax(np.where(ok, p, -np.inf)))
    voc = float(max(0.0, np.interp(0.0, i_a, v_v)))
    isc = float(max(0.0, np.interp(0.0, v_v[::-1], i_a[::-1])))
    pmax = float(p[k])
    return {
        "pmax_w": pmax,
        "vmpp_v": float(v_v[k]),
        "impp_a": float(i_a[k]),
        "voc_v": voc,
        "isc_a": isc,
        "fill_factor": pmax / (voc * isc) if voc * isc > 0 else 0.0,
    }


def current_at(i_a: np.ndarray, v_v: np.ndarray, v: np.ndarray) -> np.ndarray:
    """I(V) for a curve whose V decreases with I."""
    return np.interp(v, v_v[::-1], i_a[::-1])


def fit_panel(pmax_w: float, voc_v: float, isc_a: float) -> Panel:
    """Fit a healthy panel to its nameplate: diode factor and series resistance reproduce Pmax, Voc, Isc."""
    rsh_s = RSH_PANEL_OHM / SUBSTRINGS
    voc_s = voc_v / SUBSTRINGS

    def build(n: float, rs_panel: float) -> Panel:
        a = n * CELLS_PER_SUBSTRING * VT
        rs_s = rs_panel / SUBSTRINGS
        il, i0 = isc_a, 1e-9
        for _ in range(6):
            i0 = (il - voc_s / rsh_s) / np.expm1(voc_s / a)
            il = isc_a + i0 * np.expm1(isc_a * rs_s / a) + isc_a * rs_s / rsh_s
        s = Substring(float(il), float(i0), float(a), rs_s, rsh_s)
        return (s, replace(s), replace(s))

    def pmax_of(p: Panel) -> float:
        return operating_point(*build_curve(p, points=140))["pmax_w"]

    n = 1.2
    while n > 0.6 and pmax_of(build(n, 0.0)) < pmax_w:
        n -= 0.1
    lo, hi = 0.0, 4.0
    for _ in range(22):
        mid = (lo + hi) / 2
        if pmax_of(build(n, mid)) > pmax_w:
            lo = mid
        else:
            hi = mid
    return build(n, (lo + hi) / 2)


def with_dead_substring(panel: Panel, index: int) -> Panel:
    """Burnt-out substring: no photocurrent and shunted, so it adds almost no open-circuit voltage."""
    subs = list(panel)
    subs[index] = replace(subs[index], il_a=subs[index].il_a * 0.01, rsh_ohm=0.5)
    return (subs[0], subs[1], subs[2])
