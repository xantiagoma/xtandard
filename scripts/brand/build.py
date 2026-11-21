# /// script
# requires-python = ">=3.10"
# dependencies = ["fonttools>=4.50", "uharfbuzz>=0.39"]
# ///
"""Writes every SVG master of the @xtandard/lib brand kit into assets/ (docs/BRAND.md).

    uv run scripts/brand/build.py    # bun run brand:masters
    bun run brand:assets             # then rebuild the rasters

The wordmark, tagline and command are HarfBuzz-shaped glyph outlines, so the
masters need no font at render time. The fonts are only needed here: the
variable Urbanist and JetBrains Mono from google/fonts (OFL-1.1, see NOTICE),
downloaded on first run into scripts/brand/fonts/ (gitignored, never committed).
"""

import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from mark import mark, H  # noqa: E402
from text import cap_height, descent, text_path, x_height  # noqa: E402
from geom import f  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(ROOT, "assets")
FONTS = os.path.join(HERE, "fonts")
URB = os.path.join(FONTS, "Urbanist.ttf")
MONO = os.path.join(FONTS, "JetBrainsMono.ttf")
FONT_URLS = {
    URB: "https://github.com/google/fonts/raw/main/ofl/urbanist/Urbanist%5Bwght%5D.ttf",
    MONO: "https://github.com/google/fonts/raw/main/ofl/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
}


def ensure_fonts():
    os.makedirs(FONTS, exist_ok=True)
    for path, url in FONT_URLS.items():
        if not os.path.exists(path):
            print(f"brand: downloading {os.path.basename(path)}", file=sys.stderr)
            urllib.request.urlretrieve(url, path + ".part")
            os.replace(path + ".part", path)


ensure_fonts()  # before anything below measures a font

NAME = "@xtandard/lib"
# The wordmark: the scope in paper/ink, the package in lime (the siblings: `xtandard-` + `audit`).
WORD_1, WORD_2 = "@xtandard/", "lib"
TAGLINE = "Lightweight, type-safe TypeScript utilities, zero dependencies for the core"
COMMAND = "bun add @xtandard/lib"

# Palette (see docs/BRAND.md)
INK = "#101113"
PAPER = "#FAFAFA"
ORBIT = "#4E5459"
BRACKET = "#4A4C51"
SLATE = "#8B9198"
LIME = "#B4E43A"
LIME_SYMBOL_DARK = ("#C8F150", "#97CC1B")  # symbol on dark surfaces, top left -> bottom right
LIME_SYMBOL_LIGHT = ("#9FD12A", "#5E900C")  # symbol on light surfaces
LIME_WORD_DARK = ("#C8F150", "#A2D424")  # `lib` on dark, top -> bottom
LIME_WORD_LIGHT = ("#6FA514", "#4A7A0B")  # `lib` on light

PATHS, (BX0, BY0, BX1, BY1) = mark()
BW, BH = BX1 - BX0, BY1 - BY0  # symbol bbox in mark units


def write(name, svg):
    with open(os.path.join(OUT, name), "w") as fh:
        fh.write(svg)


def header(w, h, title=NAME, size=True):
    dims = f' width="{f(w)}" height="{f(h)}"' if size else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {f(w)} {f(h)}"{dims} role="img" aria-label="{NAME}">\n'
        f"<title>{title}</title>\n"
    )


def lime_grad(gid, stops):
    return (
        f'<linearGradient id="{gid}" x1="{f(BX0)}" y1="{f(BY0)}" x2="{f(BX1)}" y2="{f(BY1)}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{stops[0]}"/><stop offset="1" stop-color="{stops[1]}"/></linearGradient>'
    )


def word_grad(gid, stops, y1, y2):
    return (
        f'<linearGradient id="{gid}" x1="0" y1="{f(y1)}" x2="0" y2="{f(y2)}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{stops[0]}"/><stop offset="1" stop-color="{stops[1]}"/></linearGradient>'
    )


def symbol(tx, ty, s, fill="url(#lime)", extra=""):
    """The mark with its bbox's top-left at (tx, ty), scaled by s."""
    body = "\n".join(f'<path fill-rule="evenodd" d="{d}"/>' for d in PATHS)
    return (
        f'<g transform="translate({f(tx)} {f(ty)}) scale({s:.5f}) translate({f(-BX0)} {f(-BY0)})" fill="{fill}"{extra}>\n'
        f"{body}\n</g>\n"
    )


# ---------------------------------------------------------------- app icon

ICON_BG = (
    '<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#1C1D20"/><stop offset="1" stop-color="#08090A"/></linearGradient>'
    '<linearGradient id="rim" x1="0" y1="0" x2="0" y2="1024" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity=".03"/></linearGradient>'
    '<filter id="shadow" x="-20%" y="-20%" width="140%" height="150%" color-interpolation-filters="sRGB"><feDropShadow dx="0" dy="6" stdDeviation="9" flood-color="#000" flood-opacity=".55"/></filter>'
)
# The family's orbit lines (xtandard-image's circle and radius), with the arcs turned so
# their end dots clear the brackets, as in the webhooks and flags icons.
ORBITS = (
    f'<g fill="none" stroke="{ORBIT}" stroke-linecap="round">\n'
    '<circle cx="512" cy="512" r="350" stroke-width="3" opacity=".22"/>\n'
    '<path d="M585.3 96.4A422 422 0 0 1 877.5 301.0" stroke-width="4.5" opacity=".7"/>\n'
    '<path d="M146.5 723.0A422 422 0 0 0 438.7 927.6" stroke-width="4.5" opacity=".7"/>\n'
    "</g>\n"
    f'<g fill="{ORBIT}"><circle cx="585.3" cy="96.4" r="13"/><circle cx="877.5" cy="301.0" r="13"/><circle cx="146.5" cy="723.0" r="13"/><circle cx="438.7" cy="927.6" r="13"/></g>\n'
)

ICON_S = 520 / BW  # symbol width in the icon (the X alone is wider than tall)
ICON_TX = 512 - BW * ICON_S / 2
ICON_TY = 512 - BH * ICON_S / 2
X_MID = ICON_TY + (0 + H / 2 - BY0) * ICON_S  # y of the X's centre in the icon


def brackets():
    hgt, dep, sw = 196, 92, 30
    lt = 130  # x of the left bracket's point
    rt = 1024 - lt
    y0, y1 = X_MID - hgt / 2, X_MID + hgt / 2
    return (
        f'<g fill="none" stroke="{BRACKET}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round">'
        f'<path d="M{f(lt + dep)} {f(y0)}L{f(lt)} {f(X_MID)}L{f(lt + dep)} {f(y1)}"/>'
        f'<path d="M{f(rt - dep)} {f(y0)}L{f(rt)} {f(X_MID)}L{f(rt - dep)} {f(y1)}"/></g>\n'
    )


def icon_body():
    return (
        '<rect width="1024" height="1024" rx="224" fill="url(#bg)"/>\n'
        '<rect x="2" y="2" width="1020" height="1020" rx="222" fill="none" stroke="url(#rim)" stroke-width="4"/>\n'
        + ORBITS
        + f'<g filter="url(#shadow)">\n{brackets()}{symbol(ICON_TX, ICON_TY, ICON_S)}</g>\n'
    )


def build_logo():
    write(
        "logo.svg",
        header(1024, 1024)
        + f"<defs>{ICON_BG}{lime_grad('lime', LIME_SYMBOL_DARK)}</defs>\n"
        + icon_body()
        + "</svg>\n",
    )


def build_favicon():
    # No orbits, brackets or shadow: they do not survive 16 px. The mark fills more of the square.
    s = 840 / max(BW, BH)
    tx = 512 - BW * s / 2
    ty = 512 - BH * s / 2 + 6
    write(
        "favicon.svg",
        header(1024, 1024, size=False)
        + f"<defs>{lime_grad('lime', LIME_SYMBOL_DARK)}</defs>\n"
        + f'<rect width="1024" height="1024" rx="224" fill="{INK}"/>\n'
        + symbol(tx, ty, s)
        + "</svg>\n",
    )


def build_symbol():
    # The mark alone, no tile: symbol.svg for dark surfaces, symbol-light.svg (deeper lime) for
    # light ones. These are what pages show as a standalone logo (the docs site's home hero).
    for name, stops in (("symbol.svg", LIME_SYMBOL_DARK), ("symbol-light.svg", LIME_SYMBOL_LIGHT)):
        write(
            name,
            header(BW, BH) + f"<defs>{lime_grad('lime', stops)}</defs>\n" + symbol(0, 0, 1) + "</svg>\n",
        )


# ---------------------------------------------------------------- wordmark + lockups

WORD_WGHT = 900
WORD_TRACK = -0.012
XH = x_height(URB, WORD_WGHT)
OPTICAL = 0.5  # the wordmark's optical centre: halfway up its cap height (descenders ignored)
CH = cap_height(URB, WORD_WGHT)


def wordmark(x, baseline, xh, first_fill, second_fill, stacked_pitch=None):
    """`@xtandard/` + `lib`; returns (svg, right edge)."""
    size = xh / XH
    d1, a1 = text_path(URB, WORD_WGHT, WORD_1, size, WORD_TRACK, x, baseline)
    if stacked_pitch is None:
        d2, a2 = text_path(URB, WORD_WGHT, WORD_2, size, WORD_TRACK, x + a1 + WORD_TRACK * size, baseline)
        right = x + a1 + WORD_TRACK * size + a2
    else:
        d2, a2 = text_path(URB, WORD_WGHT, WORD_2, size, WORD_TRACK, x, baseline + stacked_pitch)
        right = x + max(a1, a2)
    return f'<path fill="{first_fill}" d="{d1}"/>\n<path fill="{second_fill}" d="{d2}"/>\n', right, size


def lockup_horizontal(theme):
    """Symbol left, wordmark right. The symbol's vertical centre sits on the wordmark's optical
    centre (OPTICAL of the way from the baseline up to the cap height, descenders ignored); the
    canvas is the union of both, so neither is clipped. Returns the symbol's top as `sy`."""
    sh = 96.0  # symbol height
    s = sh / BH
    xh = 0.5 * H * s
    gap = 0.22 * sh
    x = BW * s + gap
    dark = theme == "dark"
    size = xh / XH
    centre = OPTICAL * CH * size  # height of the wordmark's optical centre above its baseline
    top = min(0.0, sh / 2 + centre - CH * size)  # canvas top: the cap height may rise above the symbol
    sy = -top  # the symbol's top on the canvas
    base = sy + sh / 2 + centre  # wordmark baseline
    words, right, size = wordmark(x, base, xh, PAPER if dark else INK, "url(#word)")
    w = right + 1
    hgt = max(sy + sh, base + descent(URB, WORD_WGHT, WORD_1 + WORD_2, size) + 1)
    defs = lime_grad("lime", LIME_SYMBOL_DARK if dark else LIME_SYMBOL_LIGHT) + word_grad(
        "word", LIME_WORD_DARK if dark else LIME_WORD_LIGHT, base - 1.45 * xh, base
    )
    return w, hgt, defs, symbol(0, sy, s), words, base, xh


def build_lockups():
    for theme in ("dark", "light"):
        w, hgt, defs, sym, words, _, _ = lockup_horizontal(theme)
        write(
            f"lockup-horizontal-{theme}.svg",
            header(w, hgt) + f"<defs>{defs}</defs>\n" + sym + words + "</svg>\n",
        )
        # stacked: symbol left, `@xtandard/` over `lib`, second baseline on the X's bottom
        sh = 205.0
        s = sh / BH
        base2 = (H - BY0) * s
        xh = 0.27 * sh
        # the line pitch clears the first line's descenders (`@`, `/`) above `lib`'s ascenders
        pitch = max(1.6 * xh, descent(URB, WORD_WGHT, WORD_1, xh / XH) + 1.63 * xh)
        x = BW * s + 0.17 * sh
        dark = theme == "dark"
        wds, right, size = wordmark(x, base2 - pitch, xh, PAPER if dark else INK, "url(#word)", stacked_pitch=pitch)
        defs = lime_grad("lime", LIME_SYMBOL_DARK if dark else LIME_SYMBOL_LIGHT) + word_grad(
            "word", LIME_WORD_DARK if dark else LIME_WORD_LIGHT, base2 - 1.45 * xh, base2
        )
        write(
            f"lockup-stacked-{theme}.svg",
            header(right + 1, sh + descent(URB, WORD_WGHT, WORD_2, xh / XH) + 1)
            + f"<defs>{defs}</defs>\n"
            + symbol(0, 0, s)
            + wds
            + "</svg>\n",
        )
    for name, col in (("white", "#FFFFFF"), ("black", "#000000")):
        # The same geometry as the horizontal lockups, in one colour.
        w, hgt, _, _, _, base, xh = lockup_horizontal("dark")
        s = 96.0 / BH
        sy = base - 48.0 - OPTICAL * CH * (xh / XH)  # the symbol's top, as in lockup_horizontal
        words, right, _ = wordmark(BW * s + 0.22 * 96.0, base, xh, col, col)
        write(
            f"monochrome-{name}.svg",
            header(right + 1, hgt) + symbol(0, sy, s, fill=col) + words + "</svg>\n",
        )


# ---------------------------------------------------------------- social card


def build_social():
    W_, H_ = 1280, 640
    icon = 272
    ix, iy = 104, (H_ - icon) / 2
    k = icon / 1024
    tx = ix + icon + 64
    maxw = W_ - tx - 72
    # wordmark: as large as fits, capped at the family's x-height
    xh = 62
    words, right, size = wordmark(tx, 0, xh, PAPER, "url(#word)")
    if right - tx > maxw:
        xh *= maxw / (right - tx)
    tag_size = 31
    _, tw = text_path(URB, 600, TAGLINE, tag_size, 0, 0, 0)
    if tw > maxw:
        tag_size *= maxw / tw
    cmd_size = 24
    # vertical rhythm, centred on the icon
    asc = 1.45 * xh
    block = asc + 34 + tag_size + 34 + cmd_size
    top = H_ / 2 - block / 2 - 4
    base = top + asc
    words, right, _ = wordmark(tx, base, xh, PAPER, "url(#word)")
    tag_base = base + 34 + tag_size * 0.95
    td, _ = text_path(URB, 600, TAGLINE, tag_size, 0, tx + 2, tag_base)
    cmd_base = tag_base + 34 + cmd_size
    cd, _ = text_path(MONO, 400, COMMAND, cmd_size, 0, tx + 2, cmd_base)
    defs = ICON_BG + lime_grad("lime", LIME_SYMBOL_DARK) + word_grad("word", LIME_WORD_DARK, base - asc, base)
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W_} {H_}" width="{W_}" height="{H_}">\n'
        f"<title>{NAME}: {TAGLINE.lower()[0] + TAGLINE[1:]}</title>\n"
        f"<defs>{defs}</defs>\n"
        f'<rect width="{W_}" height="{H_}" fill="#0E0F11"/>\n'
        f'<g transform="translate({f(ix)} {f(iy)}) scale({k:.5f})">\n{icon_body()}</g>\n'
        + words
        + f'<path fill="{LIME}" d="{td}"/>\n'
        + f'<path fill="{SLATE}" d="{cd}"/>\n'
        + "</svg>\n"
    )
    write("social.svg", svg)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    build_logo()
    build_favicon()
    build_symbol()
    build_lockups()
    build_social()
    print(f"brand: wrote the SVG masters to {os.path.relpath(OUT, ROOT)}", file=sys.stderr)
