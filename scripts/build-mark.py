"""Build the canonical System Formation S-mark as two clean SVG paths.

Geometry was measured off brand/source/logo-full-transparent.png by scanline
analysis (see scripts/trace-mark.py) and then regularised: every arm now runs
on the same +/-0.465 slope (~25deg) and every band is 44 units thick, which the
raster original only approximates. Coordinates below are in source pixels with
the mark's bounding box at x 13..197, y 18..252; the emitted viewBox is
"0 0 184 234" after subtracting that origin.
"""
import math, json

OX, OY = 13.0, 18.0

BLUE = [(154.5, 18.7), (154.5, 62.7), (61.3, 106.0), (197.0, 169.1),
        (197.0, 213.1), (14.0, 128.0), (14.0, 84.0)]

NAVY = [(14.0, 165.0), (106.6, 208.1), (197.0, 166.0), (106.0, 123.7),
        (147.0, 98.75), (197.0, 122.0), (197.0, 210.0), (106.6, 252.1),
        (14.0, 209.0)]

def rounded_path(poly, tangent=10.0, decimals=1):
    """Polygon -> SVG path with corners rounded by a fixed tangent length.
    The tangent is clamped to 40% of each adjoining edge so short edges and
    acute corners (the inner apex, the bottom tip) stay crisp."""
    n = len(poly)
    def lerp(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
    def f(v):
        return f"{round(v, decimals):g}"
    out = []
    for i in range(n):
        prev, cur, nxt = poly[(i - 1) % n], poly[i], poly[(i + 1) % n]
        d1 = math.dist(cur, prev)
        d2 = math.dist(cur, nxt)
        t1 = min(tangent, d1 * 0.4) / d1
        t2 = min(tangent, d2 * 0.4) / d2
        a, b = lerp(cur, prev, t1), lerp(cur, nxt, t2)
        out.append(("M" if i == 0 else "L") + f"{f(a[0])} {f(a[1])}")
        out.append(f"Q{f(cur[0])} {f(cur[1])} {f(b[0])} {f(b[1])}")
    out.append("Z")
    return "".join(out)

def shift(poly):
    return [(x - OX, y - OY) for x, y in poly]

paths = {"blue": rounded_path(shift(BLUE)), "navy": rounded_path(shift(NAVY))}
w = max(x for x, _ in shift(BLUE) + shift(NAVY))
h = max(y for _, y in shift(BLUE) + shift(NAVY))
print(f'viewBox="0 0 {w:.0f} {h:.0f}"')
for k, v in paths.items():
    print(f"\n{k}:\n{v}")
json.dump({"viewBox": f"0 0 {w:.0f} {h:.0f}", **paths}, open("scripts/mark-paths.json", "w"), indent=1)
