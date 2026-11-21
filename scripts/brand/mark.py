"""The @xtandard/lib mark: the family X (a `>` chevron, a lower stroke and a full-height upper arm), unadorned.

The siblings shorten the upper arm and stand their emblem on it (audit's shield, links' chain link,
flags' flag); the base library keeps the arm whole. All geometry is in mark units (docs/BRAND.md,
Geometry). Tune the constants below, then rerun build.py.
"""

from geom import rounded_polygon, intersect

# Body grid: the X is H high, top at y=0.
H = 260.0
S = 0.9  # dx per dy of every diagonal (a bit steeper than 45 degrees, like the siblings)
W = 92.0  # horizontal width of every stroke
GAP = 26.0  # horizontal gap between the chevron and the two right strokes
ARM_TOP = 0.0  # y of the upper arm's flat top: the X's top, no emblem


def vline(x0, slope):
    """Line x = x0 + slope*y as (point, direction)."""
    return ((x0, 0.0), (slope, 1.0))


def hline(y):
    return ((0.0, y), (1.0, 0.0))


def body():
    C = H / 2
    chevron = [(0, 0), (W, 0), (W + S * C, C), (W, H), (0, H), (S * C, C)]
    # "\" band (continues the chevron's upper arm) and "/" band (its lower arm).
    bs_in, bs_out = vline(0, S), vline(W, S)
    fs_in, fs_out = vline(S * H, -S), vline(W + S * H, -S)
    cut_low = vline(W + GAP + S * H, -S)  # parallel to the chevron's lower outer edge
    cut_up = vline(W + GAP, S)  # parallel to the chevron's upper outer edge
    lower = [
        intersect(bs_in, cut_low),
        intersect(bs_out, cut_low),
        intersect(bs_out, hline(H)),
        intersect(bs_in, hline(H)),
    ]
    upper = [
        intersect(fs_in, cut_up),
        intersect(fs_in, hline(ARM_TOP)),
        intersect(fs_out, hline(ARM_TOP)),
        intersect(fs_out, cut_up),
    ]
    return chevron, lower, upper


def mark():
    """Returns the path d strings (all filled with one gradient) and the bbox."""
    chevron, lower, upper = body()
    paths = [
        rounded_polygon(chevron, [14, 10, 18, 10, 14, 6]),
        rounded_polygon(lower, [8, 8, 10, 10]),
        rounded_polygon(upper, [8, 10, 10, 8]),
    ]
    pts = chevron + lower + upper
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    return paths, (min(xs), min(ys), max(xs), max(ys))
