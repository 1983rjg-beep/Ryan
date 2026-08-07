#!/usr/bin/env python3
"""
Generate a CUPS PPD for the HP DesignJet T1200ps.

The T1200ps has an Adobe PostScript 3 interpreter on board, so the print
server never needs an HP raster driver -- it hands the plotter PostScript
and lets the plotter's own RIP do the work. This PPD just describes the
media, margins and job-control envelope around that.

Usage:
    make-ppd.py --width-in 24 --output HP-DesignJet-T1200ps-24in.ppd
    make-ppd.py --width-in 44 --output HP-DesignJet-T1200ps-44in.ppd
"""

import argparse
import sys

MM = 72.0 / 25.4  # millimetres -> PostScript points
IN = 72.0         # inches -> PostScript points

# Unprintable border the plotter reserves, in millimetres.
# 5 mm all round matches the DesignJet "Small margins" front-panel setting,
# which is what you want for roll work. See docs/troubleshooting.md if your
# prints clip -- the front panel setting and this value have to agree.
MARGIN_MM = 5.0

# (ppd_name, human_label, width_mm, height_mm, min_plotter_width_in)
MEDIA = [
    # ISO A series
    ("A4",        "A4 (210 x 297 mm)",            210.0,  297.0,  24),
    ("A3",        "A3 (297 x 420 mm)",            297.0,  420.0,  24),
    ("A2",        "A2 (420 x 594 mm)",            420.0,  594.0,  24),
    ("A1",        "A1 (594 x 841 mm)",            594.0,  841.0,  24),
    ("A0",        "A0 (841 x 1189 mm)",           841.0, 1189.0,  44),
    # ISO B series (common for posters)
    ("ISOB2",     "B2 (500 x 707 mm)",            500.0,  707.0,  24),
    ("ISOB1",     "B1 (707 x 1000 mm)",           707.0, 1000.0,  44),
    # ANSI
    ("Letter",    "US Letter (8.5 x 11 in)",      215.9,  279.4,  24),
    ("Legal",     "US Legal (8.5 x 14 in)",       215.9,  355.6,  24),
    ("Tabloid",   "ANSI B / Tabloid (11 x 17 in)", 279.4, 431.8,  24),
    ("AnsiC",     "ANSI C (17 x 22 in)",          431.8,  558.8,  24),
    ("AnsiD",     "ANSI D (22 x 34 in)",          558.8,  863.6,  24),
    ("AnsiE",     "ANSI E (34 x 44 in)",          863.6, 1117.6,  44),
    # ARCH
    ("ARCHA",     "ARCH A (9 x 12 in)",           228.6,  304.8,  24),
    ("ARCHB",     "ARCH B (12 x 18 in)",          304.8,  457.2,  24),
    ("ARCHC",     "ARCH C (18 x 24 in)",          457.2,  609.6,  24),
    ("ARCHD",     "ARCH D (24 x 36 in)",          609.6,  914.4,  24),
    ("ARCHE1",    "ARCH E1 (30 x 42 in)",         762.0, 1066.8,  44),
    ("ARCHE",     "ARCH E (36 x 48 in)",          914.4, 1219.2,  44),
    # Full roll widths -- height is nominal; use a Custom size for true
    # roll-fed work where the length follows the drawing.
    ("Roll24",    "Roll 24 in (610 mm) wide",     609.6,  914.4,  24),
    ("Roll36",    "Roll 36 in (914 mm) wide",     914.4, 1219.2,  44),
    ("Roll42",    "Roll 42 in (1067 mm) wide",   1066.8, 1524.0,  44),
    ("Roll44",    "Roll 44 in (1118 mm) wide",   1117.6, 1524.0,  44),
]

# The plotter will happily draw a print many metres long off a roll. Cap the
# PPD at ~15 m so CUPS' custom-page-size maths stays in sane territory.
MAX_MEDIA_HEIGHT_PT = 45000.0


def fmt(value):
    """PPD numbers: trim pointless trailing zeros, keep 2dp precision."""
    return f"{value:.2f}".rstrip("0").rstrip(".")


def emit(width_in, model_suffix):
    m = MARGIN_MM * MM
    sizes = [s for s in MEDIA if s[4] <= width_in]
    max_width_pt = width_in * IN
    nickname = f"HP DesignJet T1200ps {width_in}in (PostScript)"

    out = []
    w = out.append

    w('*PPD-Adobe: "4.3"')
    w('*FormatVersion: "4.3"')
    w('*FileVersion: "1.0"')
    w("*LanguageEncoding: ISOLatin1")
    w("*LanguageVersion: English")
    w(f'*PCFileName: "HPT12{model_suffix}.PPD"')
    w('*Manufacturer: "HP"')
    w('*Product: "(HP Designjet T1200ps)"')
    w('*Product: "(HP Designjet T1200 PS)"')
    w(f'*ModelName: "HP DesignJet T1200ps {width_in}in"')
    w(f'*ShortNickName: "HP DesignJet T1200ps {width_in}in"')
    w(f'*NickName: "{nickname}"')
    w('*PSVersion: "(3011.104) 0"')
    w('*LanguageLevel: "3"')
    w("*ColorDevice: True")
    w("*DefaultColorSpace: CMYK")
    w("*FileSystem: False")
    w('*Throughput: "1"')
    w("*LandscapeOrientation: Plus90")
    w("*TTRasterizer: Type42")
    w("*cupsVersion: 2.0")
    w("*cupsModelNumber: 0")
    w("*cupsManualCopies: False")
    # Hint to cups-filters: use poppler for PDF->PS so CAD vectors stay
    # vectors instead of being flattened to a giant raster. Harmless on
    # builds that don't recognise it -- CUPS ignores unknown attributes.
    w('*cupsPdftopsRenderer: "hybrid"')
    w("")

    # --- PJL job envelope --------------------------------------------------
    # JetDirect (port 9100) is a dumb byte pipe. Wrapping each job in a PJL
    # UEL + JOB/EOJ pair is what keeps consecutive jobs from bleeding into
    # each other and gives the plotter's front panel a real job name.
    w("*JCLBegin: \"<1B>%-12345X@PJL JOB<0A>\"")
    w("*JCLToPSInterpreter: \"@PJL ENTER LANGUAGE = POSTSCRIPT<0A>\"")
    w("*JCLEnd: \"<1B>%-12345X@PJL EOJ<0A><1B>%-12345X\"")
    w("")

    # --- Page sizes --------------------------------------------------------
    default_size = "A1" if width_in >= 24 else "A4"

    w("*OpenUI *PageSize/Media Size: PickOne")
    w("*OrderDependency: 10 AnySetup *PageSize")
    w(f"*DefaultPageSize: {default_size}")
    for name, label, wmm, hmm, _ in sizes:
        pw, ph = wmm * MM, hmm * MM
        w(f'*PageSize {name}/{label}: '
          f'"<</PageSize[{fmt(pw)} {fmt(ph)}]/ImagingBBox null>>setpagedevice"')
    w("*CloseUI: *PageSize")
    w("")

    w("*OpenUI *PageRegion/Media Size: PickOne")
    w("*OrderDependency: 10 AnySetup *PageRegion")
    w(f"*DefaultPageRegion: {default_size}")
    for name, label, wmm, hmm, _ in sizes:
        pw, ph = wmm * MM, hmm * MM
        w(f'*PageRegion {name}/{label}: '
          f'"<</PageSize[{fmt(pw)} {fmt(ph)}]/ImagingBBox null>>setpagedevice"')
    w("*CloseUI: *PageRegion")
    w("")

    w(f"*DefaultImageableArea: {default_size}")
    for name, _, wmm, hmm, _ in sizes:
        pw, ph = wmm * MM, hmm * MM
        w(f'*ImageableArea {name}: '
          f'"{fmt(m)} {fmt(m)} {fmt(pw - m)} {fmt(ph - m)}"')
    w("")

    w(f"*DefaultPaperDimension: {default_size}")
    for name, _, wmm, hmm, _ in sizes:
        w(f'*PaperDimension {name}: "{fmt(wmm * MM)} {fmt(hmm * MM)}"')
    w("")

    # --- Custom / roll-fed sizes ------------------------------------------
    w(f"*MaxMediaWidth: \"{fmt(max_width_pt)}\"")
    w(f"*MaxMediaHeight: \"{fmt(MAX_MEDIA_HEIGHT_PT)}\"")
    w(f"*HWMargins: {fmt(m)} {fmt(m)} {fmt(m)} {fmt(m)}")
    w('*ParamCustomPageSize Width: 1 points 36 ' + fmt(max_width_pt))
    w('*ParamCustomPageSize Height: 2 points 36 ' + fmt(MAX_MEDIA_HEIGHT_PT))
    w('*ParamCustomPageSize WidthOffset: 3 points 0 0')
    w('*ParamCustomPageSize HeightOffset: 4 points 0 0')
    w('*ParamCustomPageSize Orientation: 5 int 0 0')
    w('*CustomPageSize True: "pop pop pop '
      '<</PageSize[5 -2 roll]/ImagingBBox null>>setpagedevice"')
    w("*RequiresPageRegion All: True")
    w("")

    # --- Media source ------------------------------------------------------
    w("*OpenUI *InputSlot/Paper Source: PickOne")
    w("*OrderDependency: 20 AnySetup *InputSlot")
    w("*DefaultInputSlot: Roll")
    w('*InputSlot Roll/Roll: "<</MediaPosition 1>>setpagedevice"')
    w('*InputSlot Sheet/Single Sheet: "<</MediaPosition 0>>setpagedevice"')
    w('*InputSlot Auto/Use Printer Setting: "<</MediaPosition null>>setpagedevice"')
    w("*CloseUI: *InputSlot")
    w("")

    # --- Quality -----------------------------------------------------------
    w("*OpenUI *Resolution/Print Quality: PickOne")
    w("*OrderDependency: 30 AnySetup *Resolution")
    w("*DefaultResolution: 600dpi")
    w('*Resolution 300dpi/Fast (300 dpi): "<</HWResolution[300 300]>>setpagedevice"')
    w('*Resolution 600dpi/Normal (600 dpi): "<</HWResolution[600 600]>>setpagedevice"')
    w('*Resolution 1200dpi/Best (1200 dpi): "<</HWResolution[1200 1200]>>setpagedevice"')
    w("*CloseUI: *Resolution")
    w("")

    # --- Colour ------------------------------------------------------------
    w("*OpenUI *ColorModel/Colour Mode: PickOne")
    w("*OrderDependency: 40 AnySetup *ColorModel")
    w("*DefaultColorModel: CMYK")
    w('*ColorModel CMYK/Colour: "<</ProcessColorModel /DeviceCMYK>>setpagedevice"')
    w('*ColorModel Gray/Greyscale: "<</ProcessColorModel /DeviceGray>>setpagedevice"')
    w("*CloseUI: *ColorModel")
    w("")

    # --- Fonts resident in the PostScript 3 interpreter --------------------
    w("*DefaultFont: Courier")
    for font in [
        "AvantGarde-Book", "AvantGarde-BookOblique", "AvantGarde-Demi",
        "AvantGarde-DemiOblique", "Bookman-Demi", "Bookman-DemiItalic",
        "Bookman-Light", "Bookman-LightItalic", "Courier", "Courier-Bold",
        "Courier-BoldOblique", "Courier-Oblique", "Helvetica",
        "Helvetica-Bold", "Helvetica-BoldOblique", "Helvetica-Narrow",
        "Helvetica-Narrow-Bold", "Helvetica-Narrow-BoldOblique",
        "Helvetica-Narrow-Oblique", "Helvetica-Oblique",
        "NewCenturySchlbk-Bold", "NewCenturySchlbk-BoldItalic",
        "NewCenturySchlbk-Italic", "NewCenturySchlbk-Roman",
        "Palatino-Bold", "Palatino-BoldItalic", "Palatino-Italic",
        "Palatino-Roman", "Symbol", "Times-Bold", "Times-BoldItalic",
        "Times-Italic", "Times-Roman", "ZapfChancery-MediumItalic",
        "ZapfDingbats",
    ]:
        w(f"*Font {font}: Standard \"(001.005)\" Standard ROM")
    w("")

    return "\n".join(out) + "\n"


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--width-in", type=int, choices=(24, 44), default=24,
                   help="Carriage width of your T1200 (24 or 44 inch)")
    p.add_argument("--output", "-o", default="-",
                   help="Output PPD path, or - for stdout")
    args = p.parse_args()

    ppd = emit(args.width_in, str(args.width_in))

    if args.output == "-":
        sys.stdout.write(ppd)
    else:
        with open(args.output, "w", encoding="latin-1") as fh:
            fh.write(ppd)
        print(f"Wrote {args.output} ({len(ppd)} bytes)", file=sys.stderr)


if __name__ == "__main__":
    main()
