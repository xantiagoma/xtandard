"""Shape text with HarfBuzz at a given weight and convert it to SVG path data (no font needed at render time)."""

import io
import uharfbuzz as hb
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

_cache = {}


def _instance(path, wght):
    key = (path, wght)
    if key not in _cache:
        font = TTFont(path)
        inst = instancer.instantiateVariableFont(font, {"wght": wght})
        buf = io.BytesIO()
        inst.save(buf)
        data = buf.getvalue()
        _cache[key] = (TTFont(io.BytesIO(data)), data)
    return _cache[key]


def x_height(path, wght):
    font, _ = _instance(path, wght)
    return font["OS/2"].sxHeight / font["head"].unitsPerEm


def cap_height(path, wght):
    font, _ = _instance(path, wght)
    return font["OS/2"].sCapHeight / font["head"].unitsPerEm


def text_path(path, wght, text, size, tracking=0.0, x=0.0, y=0.0):
    """Returns (d, advance) for text at font size `size` with baseline at (x, y); tracking in em."""
    font, data = _instance(path, wght)
    upem = font["head"].unitsPerEm
    face = hb.Face(data)
    hbfont = hb.Font(face)
    buf = hb.Buffer()
    buf.add_str(text)
    buf.guess_segment_properties()
    hb.shape(hbfont, buf, {"kern": True, "liga": True})
    gs = font.getGlyphSet()
    order = font.getGlyphOrder()
    k = size / upem
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    cx = 0.0
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        tp = TransformPen(pen, (k, 0, 0, -k, x + (cx + pos.x_offset) * k, y - pos.y_offset * k))
        gs[name].draw(tp)
        cx += pos.x_advance
        if i < n - 1:
            cx += tracking * upem
    return pen.getCommands(), cx * k


def descent(path, wght, text, size):
    """How far the text's glyphs reach below the baseline at font size `size` (0 when none do)."""
    from fontTools.pens.boundsPen import BoundsPen

    font, _ = _instance(path, wght)
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    low = 0.0
    for ch in set(text):
        pen = BoundsPen(gs)
        gs[cmap[ord(ch)]].draw(pen)
        if pen.bounds:
            low = min(low, pen.bounds[1])
    return -low * size / font["head"].unitsPerEm
