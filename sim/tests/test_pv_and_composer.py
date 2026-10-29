import numpy as np
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.pv import (
    BYPASS_VF_V,
    build_curve,
    current_at,
    fit_panel,
    operating_point,
    with_dead_substring,
)

client = TestClient(app)
RATED = {"pmax_w": 320.0, "voc_v": 40.6, "isc_a": 9.9}


def test_single_diode_curve_matches_nameplate():
    panel = fit_panel(**RATED)
    op = operating_point(*build_curve(panel, points=400))
    assert op["pmax_w"] == pytest.approx(320.0, rel=0.01)
    assert op["voc_v"] == pytest.approx(40.6, rel=0.01)
    assert op["isc_a"] == pytest.approx(9.9, rel=0.02)
    assert 0.70 < op["fill_factor"] < 0.86
    assert op["vmpp_v"] < op["voc_v"] and op["impp_a"] < op["isc_a"]


def test_bypass_diode_limits_loss_when_a_substring_is_dead():
    healthy = fit_panel(**RATED)
    dead = with_dead_substring(healthy, 1)
    p_healthy = operating_point(*build_curve(healthy, points=300))["pmax_w"]
    i, v = build_curve(dead, points=300)
    op = operating_point(i, v)
    # Roughly a third of the power is lost, not all of it: the bypass diode carries the current.
    assert 0.55 * p_healthy < op["pmax_w"] < 0.75 * p_healthy
    # At full current the dead substring is clamped at -Vf instead of going deeply negative.
    assert float(np.min(v[(i > 0) & (i < 9.0)])) > -3 * BYPASS_VF_V - 10


def test_parallel_mismatch_bank_below_sum_and_weak_panel_reverses():
    strong = fit_panel(**RATED)
    weak = with_dead_substring(with_dead_substring(fit_panel(**RATED), 0), 1)
    si, sv = build_curve(strong, points=300)
    wi, wv = build_curve(weak, points=300)
    own = operating_point(si, sv)["pmax_w"] + operating_point(wi, wv)["pmax_w"]

    r = client.post(
        "/composer/evaluate",
        json={
            "panels": [{"id": "A", **RATED}, {"id": "B", **RATED, "dead_substrings": [0, 1]}],
            "grouping": [[["A"], ["B"]]],
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["pmax_w"] < own  # mismatch: the bank cannot reach the sum of individual maxima
    assert body["mismatch_loss_percent"] > 1.0
    # The weak panel's own curve gives negative current once the bank voltage exceeds its Voc.
    voc_weak = operating_point(wi, wv)["voc_v"]
    assert float(current_at(wi, wv, np.array([voc_weak + 3.0]))[0]) < 0
    assert body["reverse_current_events"] >= 1


def test_series_string_of_identical_panels_adds_voltage_and_keeps_current():
    one = client.post("/composer/evaluate", json={"panels": [{"id": "A", **RATED}], "grouping": [[["A"]]]}).json()
    three = client.post(
        "/composer/evaluate",
        json={"panels": [{"id": k, **RATED} for k in "ABC"], "grouping": [[["A", "B", "C"]]]},
    ).json()
    assert three["pmax_w"] == pytest.approx(3 * one["pmax_w"], rel=0.02)
    assert three["vmpp_v"] == pytest.approx(3 * one["vmpp_v"], rel=0.02)
    assert three["mismatch_loss_percent"] < 1.0


def test_evaluate_rejects_unknown_panel_ids():
    r = client.post("/composer/evaluate", json={"panels": [{"id": "A", **RATED}], "grouping": [[["Z"]]]})
    assert r.status_code == 422
