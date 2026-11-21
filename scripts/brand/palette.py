"""Prints the OKLCH and WCAG contrast values of the palette table in docs/BRAND.md: python3 scripts/brand/palette.py"""

import math
def lin(c):
    c/=255; return c/12.92 if c<=0.04045 else ((c+0.055)/1.055)**2.4
def rgb(h): h=h.lstrip('#'); return [int(h[i:i+2],16) for i in (0,2,4)]
def lum(h): r,g,b=map(lin,rgb(h)); return 0.2126*r+0.7152*g+0.0722*b
def cr(a,b):
    la,lb=sorted([lum(a),lum(b)],reverse=True); return (la+0.05)/(lb+0.05)
def oklch(h):
    r,g,b=map(lin,rgb(h))
    l=0.4122214708*r+0.5363325363*g+0.0514459929*b
    m=0.2119034982*r+0.6806995451*g+0.1073969566*b
    s=0.0883024619*r+0.2817188376*g+0.6299787005*b
    l,m,s=[x**(1/3) for x in (l,m,s)]
    L=0.2104542553*l+0.7936177850*m-0.0040720468*s
    A=1.9779984951*l-2.4285922050*m+0.4505937099*s
    B=0.0259040371*l+0.7827717662*m-0.8086757660*s
    C=math.hypot(A,B); H=math.degrees(math.atan2(B,A))%360
    return f"oklch({L*100:.1f}% {C:.3f} {H:.1f})" if C>0.002 else f"oklch({L*100:.1f}% 0 0)"
INK="#101113"
for n,h in [("lime-hi","#C8F150"),("lime","#B4E43A"),("lime-word","#A2D424"),("lime-deep","#97CC1B"),("lime-light","#9FD12A"),("lime-text","#6FA514"),("lime-ink","#5E900C"),("lime-dark","#4A7A0B"),("ink","#101113"),("surface","#1C1D20"),("bg","#0E0F11"),("bracket","#4A4C51"),("orbit","#4E5459"),("slate","#8B9198"),("paper","#FAFAFA")]:
    print(f"{n:11} {h} {oklch(h):26} white {cr(h,'#FFFFFF'):.2f}  ink {cr(h,INK):.2f}")
