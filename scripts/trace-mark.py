"""Trace the two bands of the System Formation S-mark from the source PNG
into simplified, corner-rounded SVG paths. Run: python3 scripts/trace-mark.py"""
from PIL import Image
import math, json

SRC = "brand/source/logo-full-transparent.png"
im = Image.open(SRC).convert("RGBA").crop((0, 0, 220, 292))  # mark only, drop the wordmark
W, H = im.size
px = im.load()

def classify(p):
    r, g, b, a = p
    if a < 140:
        return None
    # blue band: strongly blue-dominant
    if b > r + 55 and b > 110:
        return "blue"
    # navy band: dark, low luminance
    if max(r, g, b) < 130 and b >= r:
        return "navy"
    return None

masks = {k: [[False] * W for _ in range(H)] for k in ("blue", "navy")}
for y in range(H):
    for x in range(W):
        c = classify(px[x, y])
        if c:
            masks[c][y][x] = True

def neighbours4(x, y):
    return ((x+1, y), (x-1, y), (x, y+1), (x, y-1))

def components(m, min_size=400):
    seen = [[False]*W for _ in range(H)]
    comps = []
    for sy in range(H):
        for sx in range(W):
            if not m[sy][sx] or seen[sy][sx]:
                continue
            stack, comp = [(sx, sy)], []
            seen[sy][sx] = True
            while stack:
                x, y = stack.pop()
                comp.append((x, y))
                for nx, ny in neighbours4(x, y):
                    if 0 <= nx < W and 0 <= ny < H and m[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            if len(comp) >= min_size:
                comps.append(comp)
    comps.sort(key=len, reverse=True)
    out = []
    for comp in comps:
        g = [[False]*W for _ in range(H)]
        for x, y in comp:
            g[y][x] = True
        out.append(g)
    return out

def morph(m, op, r=1):
    """binary open/close with a square structuring element"""
    def dilate(src):
        d = [[False]*W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                if src[y][x]:
                    for dy in range(-r, r+1):
                        for dx in range(-r, r+1):
                            yy, xx = y+dy, x+dx
                            if 0 <= xx < W and 0 <= yy < H:
                                d[yy][xx] = True
        return d
    def erode(src):
        e = [[False]*W for _ in range(H)]
        for y in range(H):
            for x in range(W):
                ok = True
                for dy in range(-r, r+1):
                    for dx in range(-r, r+1):
                        yy, xx = y+dy, x+dx
                        if not (0 <= xx < W and 0 <= yy < H and src[yy][xx]):
                            ok = False
                            break
                    if not ok:
                        break
                e[y][x] = ok
        return e
    return erode(dilate(m)) if op == "close" else dilate(erode(m))

def trace(m):
    """Moore-neighbour boundary trace of the outer contour."""
    start = None
    for y in range(H):
        for x in range(W):
            if m[y][x]:
                start = (x, y)
                break
        if start:
            break
    dirs = [(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1),(0,-1),(1,-1)]
    contour = [start]
    cur, bdir = start, 6
    for _ in range(200000):
        found = False
        for k in range(8):
            d = (bdir + k) % 8
            nx, ny = cur[0] + dirs[d][0], cur[1] + dirs[d][1]
            if 0 <= nx < W and 0 <= ny < H and m[ny][nx]:
                bdir = (d + 5) % 8
                cur = (nx, ny)
                contour.append(cur)
                found = True
                break
        if not found:
            break
        if cur == start and len(contour) > 3:
            break
    return contour[:-1]

def rdp(points, eps):
    if len(points) < 3:
        return points
    def perp(p, a, b):
        (x, y), (x1, y1), (x2, y2) = p, a, b
        dx, dy = x2-x1, y2-y1
        if dx == 0 and dy == 0:
            return math.hypot(x-x1, y-y1)
        return abs(dy*x - dx*y + x2*y1 - y2*x1) / math.hypot(dx, dy)
    dmax, idx = 0, 0
    for i in range(1, len(points)-1):
        d = perp(points[i], points[0], points[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        return rdp(points[:idx+1], eps)[:-1] + rdp(points[idx:], eps)
    return [points[0], points[-1]]

def round_corners(poly, radius):
    """Emit an SVG path with arc-like rounded corners (quadratic curves)."""
    n = len(poly)
    cmds = []
    def lerp(a, b, t):
        return (a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t)
    for i in range(n):
        prev, cur, nxt = poly[(i-1) % n], poly[i], poly[(i+1) % n]
        d1 = math.hypot(cur[0]-prev[0], cur[1]-prev[1])
        d2 = math.hypot(nxt[0]-cur[0], nxt[1]-cur[1])
        r1 = min(radius, d1/2) / d1 if d1 else 0
        r2 = min(radius, d2/2) / d2 if d2 else 0
        a = lerp(cur, prev, r1)
        b = lerp(cur, nxt, r2)
        if i == 0:
            cmds.append(f"M{a[0]:.2f} {a[1]:.2f}")
        else:
            cmds.append(f"L{a[0]:.2f} {a[1]:.2f}")
        cmds.append(f"Q{cur[0]:.2f} {cur[1]:.2f} {b[0]:.2f} {b[1]:.2f}")
    cmds.append("Z")
    return "".join(cmds)

out = {}
for name in ("blue", "navy"):
    polys = []
    for comp in components(morph(morph(masks[name], "close", 2), "open", 1)):
        c = trace(comp)
        simp = rdp(c + [c[0]], 1.8)[:-1]
        clean = []
        for p in simp:
            if not clean or math.hypot(p[0]-clean[-1][0], p[1]-clean[-1][1]) > 5:
                clean.append(p)
        if len(clean) >= 3:
            polys.append(clean)
    out[name] = polys
    print(f"{name}: {len(polys)} subpath(s), vertices {[len(p) for p in polys]}")
    for p in polys:
        print("   ", p)

xs = [p[0] for v in out.values() for poly in v for p in poly]
ys = [p[1] for v in out.values() for poly in v for p in poly]
minx, maxx, miny, maxy = min(xs), max(xs), min(ys), max(ys)
span = max(maxx-minx, maxy-miny)
scale = 100.0 / span
offx = (100 - (maxx-minx)*scale) / 2
offy = (100 - (maxy-miny)*scale) / 2
def nrm(poly):
    return [(((x-minx)*scale + offx), ((y-miny)*scale + offy)) for x, y in poly]
norm = {k: [nrm(p) for p in v] for k, v in out.items()}
paths = {k: " ".join(round_corners(p, 1.4) for p in v) for k, v in norm.items()}
json.dump({"paths": paths,
           "points": {k: [[[round(x,2), round(y,2)] for x,y in poly] for poly in v] for k, v in norm.items()}},
          open("scripts/mark-trace.json", "w"), indent=1)
print("\nBLUE:\n" + paths["blue"])
print("\nNAVY:\n" + paths["navy"])
