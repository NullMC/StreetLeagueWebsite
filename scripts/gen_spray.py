"""Generates spray-paint splat SVGs (soft irregular core, fine overspray, drips)."""
import math, random, sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

W, H = 600, 720
CX, CY, R = 300, 290, 165


def blob_path(rng, cx, cy, r, wobble, points=72):
    phases = [rng.uniform(0, 2 * math.pi) for _ in range(4)]
    amps = [wobble * a for a in (0.55, 0.3, 0.18, 0.1)]
    freqs = (2, 3, 5, 9)
    pts = []
    for i in range(points):
        t = 2 * math.pi * i / points
        k = 1 + sum(a * math.sin(f * t + p) for a, f, p in zip(amps, freqs, phases))
        pts.append((cx + r * k * math.cos(t), cy + r * 0.86 * k * math.sin(t)))
    d = "M%.1f %.1f " % pts[0]
    for i in range(1, len(pts) + 1):
        p0 = pts[i - 1]
        p1 = pts[i % len(pts)]
        mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
        d += "Q%.1f %.1f %.1f %.1f " % (p0[0], p0[1], mx, my)
    return d + "Z", phases, amps, freqs


def edge_radius(t, phases, amps, freqs, r):
    return r * (1 + sum(a * math.sin(f * t + p) for a, f, p in zip(amps, freqs, phases)))


def drip(rng, x, y, length, w):
    # Slightly wavy run that thins out, ending in a round drop.
    sway = rng.uniform(-6, 6)
    end_y = y + length
    w2 = w * rng.uniform(0.55, 0.75)
    root = w * 1.9
    d = (f"M{x - root / 2:.1f} {y - 34:.1f} "
         f"C{x - w / 2:.1f} {y + 4:.1f} {x - w / 2:.1f} {y + length * 0.3:.1f} {x - w2 / 2 + sway:.1f} {y + length * 0.62:.1f} "
         f"L{x - w2 / 2 + sway:.1f} {end_y:.1f} "
         f"L{x + w2 / 2 + sway:.1f} {end_y:.1f} "
         f"L{x + w2 / 2 + sway:.1f} {y + length * 0.62:.1f} "
         f"C{x + w / 2:.1f} {y + length * 0.3:.1f} {x + w / 2:.1f} {y + 4:.1f} {x + root / 2:.1f} {y - 34:.1f} Z")
    drop_r = w2 * rng.uniform(0.85, 1.15)
    return d, (x + sway, end_y + drop_r * 0.6, drop_r)


def splat(seed, color, opacity, drips=3):
    rng = random.Random(seed)
    core, phases, amps, freqs = blob_path(rng, CX, CY, R, 0.19)
    mist, *_ = blob_path(rng, CX, CY, R * 1.28, 0.1)
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">',
        "<defs>",
        # Soft edge + uneven paint density (mottled), like a real spray pass.
        '<filter id="soft" x="-20%" y="-20%" width="140%" height="140%">'
        '<feGaussianBlur stdDeviation="9" result="b"/>'
        f'<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="{seed}" result="n"/>'
        '<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0.62" result="m"/>'
        '<feComposite in="b" in2="m" operator="in"/>'
        "</filter>",
        '<filter id="haze"><feGaussianBlur stdDeviation="22"/></filter>',
        '<filter id="wet" x="-50%" y="-10%" width="200%" height="120%">'
        '<feGaussianBlur stdDeviation="1.4" result="b"/>'
        f'<feTurbulence type="fractalNoise" baseFrequency="0.018" numOctaves="3" seed="{seed}" result="n"/>'
        '<feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.55 0.62" result="m"/>'
        '<feComposite in="b" in2="m" operator="in"/>'
        "</filter>",
        "</defs>",
        f'<g fill="{color}" opacity="{opacity}">',
        f'<path d="{mist}" opacity="0.32" filter="url(#haze)"/>',
        f'<path d="{core}" opacity="0.9" filter="url(#soft)"/>',
    ]
    # Overspray: fine dots, denser right outside the edge, thinning further out.
    dots = []
    for _ in range(900):
        t = rng.uniform(0, 2 * math.pi)
        edge = edge_radius(t, phases, amps, freqs, R)
        dist = edge * (0.92 + abs(rng.gauss(0, 0.22)))
        if dist > R * 1.75:
            continue
        far = (dist - edge * 0.92) / (R * 0.8)
        x = CX + dist * math.cos(t)
        y = CY + dist * 0.92 * math.sin(t)
        r = max(0.45, rng.uniform(0.5, 2.1) * (1 - 0.55 * far))
        o = max(0.18, rng.uniform(0.45, 0.95) * (1 - 0.6 * far))
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.2f}" opacity="{o:.2f}"/>')
    parts.append("<g>" + "".join(dots) + "</g>")
    # Drips from the lower edge of the core, painted as part of the same layer.
    used = []
    drip_shapes = []
    for _ in range(drips):
        for _attempt in range(20):
            t = rng.uniform(math.radians(55), math.radians(125))
            if all(abs(t - u) > 0.22 for u in used):
                break
        used.append(t)
        edge = edge_radius(t, phases, amps, freqs, R) * 0.82
        x = CX + edge * math.cos(t)
        y = CY + edge * 0.92 * math.sin(t)
        length = rng.uniform(70, 230)
        w = rng.uniform(12, 21)
        d, (dx, dy, dr) = drip(rng, x, y, length, w)
        drip_shapes.append(f'<path d="{d}"/><circle cx="{dx:.1f}" cy="{dy:.1f}" r="{dr:.1f}"/>')
    if drip_shapes:
        parts.append('<g filter="url(#wet)" opacity="0.9">' + "".join(drip_shapes) + "</g>")
    parts.append("</g></svg>")
    return "".join(parts)


PINK = "#e42278"
BLUSH = "#ed7bab"
files = {
    "spray-1.svg": splat(11, PINK, 1, 3),
    "spray-2.svg": splat(27, PINK, 1, 2),
    "spray-3.svg": splat(43, PINK, 1, 4),
    "spray-blush-1.svg": splat(58, BLUSH, 1, 2),
    "spray-blush-2.svg": splat(71, BLUSH, 1, 3),
    # Lighter passes for backgrounds behind content
    "spray-1-soft.svg": splat(11, PINK, 0.5, 3),
    # Senza colature: dietro al logo dell'hero
    "spray-halo.svg": splat(11, PINK, 0.5, 0),
    "spray-halo-night.svg": splat(11, PINK, 1, 0),
    "spray-3-soft.svg": splat(43, PINK, 0.45, 4),
}
for name, svg in files.items():
    with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(svg)
    print(name, len(svg))
