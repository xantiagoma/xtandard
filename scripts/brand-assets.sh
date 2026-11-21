#!/bin/sh
# Rebuilds every brand raster in assets/ from the SVG masters next to them,
# and copies the docs site's favicon set and social card into site/public/
# (docs/BRAND.md).
#
#   sh scripts/brand-assets.sh           rebuild (bun run brand:assets)
#   sh scripts/brand-assets.sh --check   fail when a raster or master is
#                                        missing, or the site/public copies
#                                        differ from assets/
#
# Needs rsvg-convert (librsvg) and magick (ImageMagick 7); oxipng is used
# when present (brew install librsvg imagemagick oxipng). The SVGs have no
# font dependency (text is outlined), so the output does not depend on the
# fonts installed on the machine; it can differ by a few bytes between
# librsvg versions, and checkouts do not keep mtimes, so --check compares
# neither pixels nor timestamps: rerun the script after editing a master.
set -eu
cd "$(dirname "$0")/.."

a=assets
ui=site/public

# target master [rsvg-convert args...]: every raster and the master it comes from.
rasters='
logo.png logo.svg -w 1024 -h 1024
logo-256.png logo.svg -w 256 -h 256
logo-128.png logo.svg -w 128 -h 128
apple-touch-icon.png logo.svg
symbol.png symbol.svg -h 256
lockup-horizontal-dark.png lockup-horizontal-dark.svg -z 2
lockup-horizontal-light.png lockup-horizontal-light.svg -z 2
lockup-stacked-dark.png lockup-stacked-dark.svg -z 2
lockup-stacked-light.png lockup-stacked-light.svg -z 2
social.png social.svg -w 1280 -h 640
favicon.png favicon.svg -w 32 -h 32
favicon.ico favicon.svg
'
# The docs site serves these from its own origin (site/astro.config.ts).
uifiles='favicon.svg favicon.ico favicon.png apple-touch-icon.png social.png'

if [ "${1:-}" = "--check" ]; then
  status=0
  printf '%s\n' "$rasters" | while read -r out src _; do
    [ -n "$out" ] || continue
    if [ ! -f "$a/$out" ] || [ ! -f "$a/$src" ]; then
      echo "brand-assets: $a/$out or its master $a/$src is missing (run bun run brand:assets)" >&2
      exit 1
    fi
  done || status=1
  for f in $uifiles; do
    if ! cmp -s "$a/$f" "$ui/$f"; then
      echo "brand-assets: $ui/$f differs from $a/$f (run bun run brand:assets)" >&2
      status=1
    fi
  done
  exit "$status"
fi

command -v rsvg-convert >/dev/null || { echo "brand-assets: rsvg-convert not found (brew install librsvg)" >&2; exit 1; }
command -v magick >/dev/null || { echo "brand-assets: magick not found (brew install imagemagick)" >&2; exit 1; }

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

printf '%s\n' "$rasters" | while read -r out src args; do
  [ -n "$out" ] || continue
  case "$out" in
    favicon.ico)
      for s in 16 32 48; do rsvg-convert -w "$s" -h "$s" "$a/$src" -o "$tmp/fav-$s.png"; done
      magick "$tmp/fav-16.png" "$tmp/fav-32.png" "$tmp/fav-48.png" "$a/$out"
      ;;
    apple-touch-icon.png)
      # iOS masks the icon itself and shows transparency as black: render it
      # full-bleed on the icon's background colour, no alpha.
      rsvg-convert -w 180 -h 180 "$a/$src" -o "$tmp/touch.png"
      magick "$tmp/touch.png" -background '#101113' -flatten -alpha off "$a/$out"
      ;;
    *)
      # shellcheck disable=SC2086 # args is a word list on purpose
      rsvg-convert $args "$a/$src" -o "$a/$out"
      ;;
  esac
done

if command -v oxipng >/dev/null; then
  # -o 4 rather than max: near-identical sizes at a fraction of the CPU.
  oxipng -q -o 4 --strip safe "$a"/*.png
else
  echo "brand-assets: oxipng not found, PNGs left unoptimised" >&2
fi

mkdir -p "$ui"
for f in $uifiles; do cp "$a/$f" "$ui/$f"; done
ls -l "$a" "$ui"
