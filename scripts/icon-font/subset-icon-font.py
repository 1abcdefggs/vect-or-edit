"""Builds the bundled Material Symbols Outlined font: only the icon names listed in icon-names.txt.

Usage (from the repository root, with fonttools and brotli installed):
    python scripts/icon-font/subset-icon-font.py <material-symbols-outlined.woff2> src/renderer/assets/fonts/material-symbols-outlined.subset.woff2

The source is the upstream variable font (Apache-2.0, https://github.com/google/material-design-icons).
Steps:
  1. Fails if any name in icon-names.txt is missing from the source font (so a missing icon never ships silently).
  2. Pins the axes the renderer never changes: FILL = 0 and GRAD = 0. wght (400-700) and opsz (20-48) keep their range.
  3. Keeps only those ligature glyphs, the letters and digits that spell them, and the ligature rules that use them.
"""
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools.subset import Subsetter, Options
from fontTools.varLib import instancer

HERE = Path(__file__).resolve().parent
NAMES_FILE = HERE / "icon-names.txt"


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__)
        return 2
    source, output = Path(sys.argv[1]), Path(sys.argv[2])
    names = [line.strip() for line in NAMES_FILE.read_text(encoding="utf-8").splitlines() if line.strip()]

    font = TTFont(source)
    glyphs = set(font.getGlyphOrder())
    missing = [name for name in names if name not in glyphs]
    if missing:
        print("Missing from the source font: " + ", ".join(missing))
        return 1

    # The upstream font has ~4300 ligature rules (every word spellable from its letters). Keep only the rules
    # that produce a listed icon; otherwise the subset keeps all of them and grows to about 1 MB.
    keep = set(names)
    for lookup in font["GSUB"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            target = getattr(sub, "ExtSubTable", sub)
            if not hasattr(target, "ligatures"):
                continue
            for first in list(target.ligatures):
                target.ligatures[first] = [lig for lig in target.ligatures[first] if lig.LigGlyph in keep]
                if not target.ligatures[first]:
                    del target.ligatures[first]

    options = Options()
    # The upstream font stores its icon ligatures under "rlig"; keep "liga" too, since the CSS asks for it.
    options.layout_features = ["rlig", "liga"]
    options.flavor = "woff2"
    options.name_IDs = ["*"]
    options.notdef_outline = True
    options.hinting = False
    options.glyph_names = True  # keep glyph names, so a later check can find each icon by name

    subsetter = Subsetter(options)
    subsetter.populate(glyphs=names, unicodes=[ord(c) for c in "abcdefghijklmnopqrstuvwxyz0123456789_"])
    subsetter.subset(font)

    font = instancer.instantiateVariableFont(
        font,
        {"FILL": 0, "GRAD": 0, "wght": (400, 700), "opsz": (20, 48)},
    )

    output.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(output)
    print(f"wrote {output} ({output.stat().st_size} bytes, {len(names)} icon names)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
