"""Array solver: series strings at a common current, parallel groups at a common voltage
(reverse current included), groups in series. Powers POST /composer/evaluate."""

from __future__ import annotations

from typing import Annotated

import numpy as np
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.pv import (
    I_REVERSE_MIN_A,
    Panel,
    build_curve,
    current_at,
    fit_panel,
    operating_point,
    with_dead_substring,
)

router = APIRouter(prefix="/composer", tags=["composer"])

REVERSE_THRESHOLD_A = 0.1


class PanelIn(BaseModel):
    id: str
    pmax_w: Annotated[float, Field(gt=10, le=800)]
    voc_v: Annotated[float, Field(gt=10, le=60)]
    isc_a: Annotated[float, Field(gt=0.5, le=20)]
    # Irradiance on each of the three substrings, W/m2 (shade lowers individual substrings).
    substring_irradiance_wm2: tuple[float, float, float] = (1000.0, 1000.0, 1000.0)
    cell_temp_c: float = 25.0
    dead_substrings: list[Annotated[int, Field(ge=0, le=2)]] = []
    # Multiplies photocurrent of every substring: ageing or measured degradation.
    health_factor: Annotated[float, Field(gt=0, le=1.2)] = 1.0


class InverterWindow(BaseModel):
    v_min_v: float = 30.0
    v_max_v: float = 600.0


class EvaluateRequest(BaseModel):
    panels: list[PanelIn]
    # Groups in series; each group is parallel strings; each string is panel ids in series.
    grouping: list[list[list[str]]]
    relay_rds_on_ohm: Annotated[float, Field(ge=0, le=5)] = 0.0
    inverter: InverterWindow = InverterWindow()


class CurvePointOut(BaseModel):
    v_v: float
    i_a: float
    p_w: float


class PanelResult(BaseModel):
    id: str
    own_pmax_w: float
    operating_current_a: float
    operating_voltage_v: float
    dissipation_w: float


class EvaluateResponse(BaseModel):
    curve: list[CurvePointOut]
    pmax_w: float
    vmpp_v: float
    impp_a: float
    local_maxima: int
    sum_of_individual_pmax_w: float
    mismatch_loss_percent: float
    reverse_current_events: int
    panels: list[PanelResult]
    violations: list[str]


def _series(curves: list[tuple[np.ndarray, np.ndarray]], rds: float) -> tuple[np.ndarray, np.ndarray]:
    i_max = max(float(c[0][-1]) for c in curves)
    i_a = np.linspace(I_REVERSE_MIN_A, i_max, 200)
    v = np.zeros_like(i_a)
    for ci, cv in curves:
        v += np.interp(i_a, ci, cv) - i_a * rds
    return i_a, v


def _parallel(curves: list[tuple[np.ndarray, np.ndarray]]) -> tuple[np.ndarray, np.ndarray]:
    if len(curves) == 1:
        return curves[0]
    v_high = max(float(c[1][0]) for c in curves)
    v_low = min(float(c[1][-1]) for c in curves)
    v = np.linspace(v_high, v_low, 260)  # descending, so the summed current ascends
    i = np.zeros_like(v)
    for ci, cv in curves:
        i += current_at(ci, cv, v)
    return i, v


def _count_peaks(v: np.ndarray, p: np.ndarray, pmax: float) -> int:
    order = np.argsort(v)
    ps = p[order]
    threshold = 0.03 * pmax
    peaks, rising, top, valley = 0, True, ps[0], ps[0]
    for x in ps:
        if rising:
            if x > top:
                top = x
            elif top - x > threshold:
                if top - valley > threshold or peaks == 0:
                    peaks += 1
                rising, valley = False, x
        elif x < valley:
            valley = x
        elif x - valley > threshold:
            rising, top = True, x
    if rising and top > threshold:
        peaks += 1
    return max(1, peaks)


def evaluate(req: EvaluateRequest) -> EvaluateResponse:
    by_id = {p.id: p for p in req.panels}
    if len(by_id) != len(req.panels):
        raise HTTPException(422, "Panel ids must be unique.")
    used = [pid for g in req.grouping for s in g for pid in s]
    unknown = sorted(set(used) - set(by_id))
    if unknown:
        raise HTTPException(422, f"Grouping uses unknown panel ids: {', '.join(unknown)}")
    if not used:
        raise HTTPException(422, "Grouping is empty.")

    models: dict[str, Panel] = {}
    curves: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    for pid in set(used):
        p = by_id[pid]
        model = fit_panel(p.pmax_w, p.voc_v, p.isc_a)
        model = tuple(  # type: ignore[assignment]
            type(s)(s.il_a * p.health_factor, s.i0_a, s.a_v, s.rs_ohm, s.rsh_ohm) for s in model
        )
        for k in p.dead_substrings:
            model = with_dead_substring(model, k)
        models[pid] = model
        curves[pid] = build_curve(model, p.substring_irradiance_wm2, p.cell_temp_c, 160)

    group_curves, string_curves = [], []
    for group in req.grouping:
        strings = [_series([curves[pid] for pid in s], req.relay_rds_on_ohm) for s in group]
        string_curves.append(strings)
        group_curves.append(_parallel(strings))
    i_arr, v_arr = group_curves[0] if len(group_curves) == 1 else _series(group_curves, 0.0)

    p_arr = i_arr * v_arr
    ok = (i_arr >= 0) & (v_arr >= 0)
    k = int(np.argmax(np.where(ok, p_arr, -np.inf)))
    pmax, vmpp, impp = float(p_arr[k]), float(v_arr[k]), float(i_arr[k])

    reverse_events = 0
    for g, group in enumerate(req.grouping):
        if len(group) < 2:
            continue
        v_group = float(np.interp(impp, group_curves[g][0], group_curves[g][1]))
        for sc in string_curves[g]:
            if float(current_at(sc[0], sc[1], np.array([v_group]))[0]) < -REVERSE_THRESHOLD_A:
                reverse_events += 1

    # Per-panel operating point and dissipation at the array MPP.
    results: list[PanelResult] = []
    for g, group in enumerate(req.grouping):
        v_group = float(np.interp(impp, group_curves[g][0], group_curves[g][1]))
        for s_idx, string in enumerate(group):
            i_string = float(current_at(string_curves[g][s_idx][0], string_curves[g][s_idx][1], np.array([v_group]))[0])
            for pid in string:
                ci, cv = curves[pid]
                v_panel = float(np.interp(i_string, ci, cv))
                own = operating_point(ci, cv)["pmax_w"]
                dissipation = max(0.0, -(v_panel * i_string))  # power absorbed when it is a load
                results.append(PanelResult(id=pid, own_pmax_w=own, operating_current_a=i_string, operating_voltage_v=v_panel, dissipation_w=dissipation))

    own_sum = sum(r.own_pmax_w for r in results)
    violations = []
    if pmax > 0 and vmpp < req.inverter.v_min_v:
        violations.append("below_inverter_window")
    if vmpp > req.inverter.v_max_v:
        violations.append("above_inverter_window")

    order = np.argsort(v_arr[ok])
    pts = [
        CurvePointOut(v_v=float(v), i_a=float(i), p_w=float(v * i))
        for v, i in zip(v_arr[ok][order][:: max(1, int(ok.sum()) // 120)], i_arr[ok][order][:: max(1, int(ok.sum()) // 120)])
    ]
    return EvaluateResponse(
        curve=pts,
        pmax_w=pmax,
        vmpp_v=vmpp,
        impp_a=impp,
        local_maxima=_count_peaks(v_arr[ok], p_arr[ok], pmax) if pmax > 0 else 1,
        sum_of_individual_pmax_w=own_sum,
        mismatch_loss_percent=max(0.0, (1 - pmax / own_sum) * 100) if own_sum > 0 else 0.0,
        reverse_current_events=reverse_events,
        panels=results,
        violations=violations,
    )


@router.post("/evaluate", response_model=EvaluateResponse)
def evaluate_endpoint(req: EvaluateRequest) -> EvaluateResponse:
    return evaluate(req)
