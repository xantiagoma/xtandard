"""Geometry helpers for the @xtandard/lib brand masters."""

import math


def f(v):
    s = f"{v:.2f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def _unit(ax, ay):
    l = math.hypot(ax, ay)
    return ax / l, ay / l


def rounded_polygon(pts, radii):
    """Closed path through pts with each corner rounded by its radius (arcs)."""
    if isinstance(radii, (int, float)):
        radii = [radii] * len(pts)
    n = len(pts)
    # signed area -> orientation
    area = sum(pts[i][0] * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * pts[i][1] for i in range(n))
    corners = []
    for i in range(n):
        p = pts[i]
        a = pts[i - 1]
        b = pts[(i + 1) % n]
        r = radii[i]
        ua = _unit(a[0] - p[0], a[1] - p[1])
        ub = _unit(b[0] - p[0], b[1] - p[1])
        cos = max(-1, min(1, ua[0] * ub[0] + ua[1] * ub[1]))
        theta = math.acos(cos)
        if r <= 0 or theta < 1e-6 or abs(theta - math.pi) < 1e-6:
            corners.append((p, p, 0, 0))
            continue
        t = r / math.tan(theta / 2)
        la = math.hypot(a[0] - p[0], a[1] - p[1])
        lb = math.hypot(b[0] - p[0], b[1] - p[1])
        t = min(t, la * 0.5, lb * 0.5)
        r = t * math.tan(theta / 2)
        p1 = (p[0] + ua[0] * t, p[1] + ua[1] * t)
        p2 = (p[0] + ub[0] * t, p[1] + ub[1] * t)
        cross = (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0])
        sweep = 1 if cross > 0 else 0
        corners.append((p1, p2, r, sweep))
    d = []
    for i, (p1, p2, r, sweep) in enumerate(corners):
        d.append(("M" if i == 0 else "L") + f"{f(p1[0])} {f(p1[1])}")
        if r > 0:
            d.append(f"A{f(r)} {f(r)} 0 0 {sweep} {f(p2[0])} {f(p2[1])}")
    return "".join(d) + "Z"


def intersect(l1, l2):
    """Lines as (point, direction)."""
    (x1, y1), (dx1, dy1) = l1
    (x2, y2), (dx2, dy2) = l2
    den = dx1 * dy2 - dy1 * dx2
    t = ((x2 - x1) * dy2 - (y2 - y1) * dx2) / den
    return (x1 + dx1 * t, y1 + dy1 * t)

