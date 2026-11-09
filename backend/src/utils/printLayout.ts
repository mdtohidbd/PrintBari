export type PaperSize = 'A4' | 'LEGAL' | 'LETTER' | '4R' | '5R' | 'CUSTOM';
export type PageOrientation = 'PORTRAIT' | 'LANDSCAPE';
export type ScalingMode = 'FIT_PAGE' | 'FILL_PAGE' | 'ACTUAL_SIZE' | 'SHRINK_OVERSIZED';
export type PrintColorMode = 'RGB' | 'GRAYSCALE' | 'BW';

export interface PaperDimensionMm {
  widthMm: number;
  heightMm: number;
}

export const PAPER_DIMENSIONS_MM: Record<Exclude<PaperSize, 'CUSTOM'>, PaperDimensionMm> = {
  A4: { widthMm: 210, heightMm: 297 },
  LEGAL: { widthMm: 215.9, heightMm: 355.6 },
  LETTER: { widthMm: 215.9, heightMm: 279.4 },
  '4R': { widthMm: 101.6, heightMm: 152.4 }, // 4x6 inches
  '5R': { widthMm: 127.0, heightMm: 177.8 }, // 5x7 inches
};

export interface PrintProfile {
  paperSize: PaperSize;
  customDimensions?: PaperDimensionMm;
  orientation: PageOrientation;
  marginsMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  dpi: 150 | 300 | 600;
  scaling: ScalingMode;
  colorMode: PrintColorMode;
  copies: number;
  duplex?: boolean;
}

export class PrintLayoutEngine {
  /**
   * Get physical sheet dimensions in millimeters based on paper size and orientation
   */
  public static getDimensionsMm(profile: Partial<PrintProfile>): PaperDimensionMm {
    const paper = profile.paperSize || 'A4';
    const isLandscape = profile.orientation === 'LANDSCAPE';

    let base: PaperDimensionMm;
    if (paper === 'CUSTOM' && profile.customDimensions) {
      base = profile.customDimensions;
    } else if (paper !== 'CUSTOM') {
      base = PAPER_DIMENSIONS_MM[paper];
    } else {
      base = PAPER_DIMENSIONS_MM.A4;
    }

    if (isLandscape) {
      return { widthMm: Math.max(base.widthMm, base.heightMm), heightMm: Math.min(base.widthMm, base.heightMm) };
    }
    return { widthMm: Math.min(base.widthMm, base.heightMm), heightMm: Math.max(base.widthMm, base.heightMm) };
  }

  /**
   * Convert millimeters to exact pixels at target DPI
   */
  public static mmToPx(mm: number, dpi: number = 300): number {
    return Math.round((mm / 25.4) * dpi);
  }

  /**
   * Convert millimeters to PDF points (72 points per inch)
   */
  public static mmToPt(mm: number): number {
    return (mm / 25.4) * 72;
  }

  /**
   * Calculate pixel layout for raster printing sheets
   */
  public static calculatePixelLayout(profile: PrintProfile) {
    const dim = this.getDimensionsMm(profile);
    const dpi = profile.dpi || 300;

    const sheetWidthPx = this.mmToPx(dim.widthMm, dpi);
    const sheetHeightPx = this.mmToPx(dim.heightMm, dpi);

    const marginLeftPx = this.mmToPx(profile.marginsMm.left, dpi);
    const marginRightPx = this.mmToPx(profile.marginsMm.right, dpi);
    const marginTopPx = this.mmToPx(profile.marginsMm.top, dpi);
    const marginBottomPx = this.mmToPx(profile.marginsMm.bottom, dpi);

    const printableWidthPx = Math.max(50, sheetWidthPx - (marginLeftPx + marginRightPx));
    const printableHeightPx = Math.max(50, sheetHeightPx - (marginTopPx + marginBottomPx));

    return {
      sheetWidthPx,
      sheetHeightPx,
      marginLeftPx,
      marginRightPx,
      marginTopPx,
      marginBottomPx,
      printableWidthPx,
      printableHeightPx,
      dpi,
    };
  }

  /**
   * Calculate vector PDF dimensions in points (72 pt/in)
   */
  public static calculatePdfLayout(profile: PrintProfile) {
    const dim = this.getDimensionsMm(profile);

    const widthPt = this.mmToPt(dim.widthMm);
    const heightPt = this.mmToPt(dim.heightMm);

    const marginLeftPt = this.mmToPt(profile.marginsMm.left);
    const marginRightPt = this.mmToPt(profile.marginsMm.right);
    const marginTopPt = this.mmToPt(profile.marginsMm.top);
    const marginBottomPt = this.mmToPt(profile.marginsMm.bottom);

    const printableWidthPt = Math.max(20, widthPt - (marginLeftPt + marginRightPt));
    const printableHeightPt = Math.max(20, heightPt - (marginTopPt + marginBottomPt));

    return {
      widthPt,
      heightPt,
      marginLeftPt,
      marginRightPt,
      marginTopPt,
      marginBottomPt,
      printableWidthPt,
      printableHeightPt,
    };
  }

  /**
   * Generate vector SVG corner and edge cut marks overlay
   */
  public static generateCutMarksSvg(
    sheetWidth: number,
    sheetHeight: number,
    itemBounds: Array<{ left: number; top: number; width: number; height: number }>,
    cutMarkLength: number = 18,
    strokeColor: string = '#94A3B8'
  ): string {
    let svg = `<svg width="${sheetWidth}" height="${sheetHeight}" xmlns="http://www.w3.org/2000/svg">`;

    for (const b of itemBounds) {
      const left = b.left;
      const top = b.top;
      const right = b.left + b.width;
      const bottom = b.top + b.height;

      // Top-Left corner
      svg += `<line x1="${left - cutMarkLength}" y1="${top}" x2="${left}" y2="${top}" stroke="${strokeColor}" stroke-width="1.5" />`;
      svg += `<line x1="${left}" y1="${top - cutMarkLength}" x2="${left}" y2="${top}" stroke="${strokeColor}" stroke-width="1.5" />`;

      // Top-Right corner
      svg += `<line x1="${right}" y1="${top}" x2="${right + cutMarkLength}" y2="${top}" stroke="${strokeColor}" stroke-width="1.5" />`;
      svg += `<line x1="${right}" y1="${top - cutMarkLength}" x2="${right}" y2="${top}" stroke="${strokeColor}" stroke-width="1.5" />`;

      // Bottom-Left corner
      svg += `<line x1="${left - cutMarkLength}" y1="${bottom}" x2="${left}" y2="${bottom}" stroke="${strokeColor}" stroke-width="1.5" />`;
      svg += `<line x1="${left}" y1="${bottom}" x2="${left}" y2="${bottom + cutMarkLength}" stroke="${strokeColor}" stroke-width="1.5" />`;

      // Bottom-Right corner
      svg += `<line x1="${right}" y1="${bottom}" x2="${right + cutMarkLength}" y2="${bottom}" stroke="${strokeColor}" stroke-width="1.5" />`;
      svg += `<line x1="${right}" y1="${bottom}" x2="${right}" y2="${bottom + cutMarkLength}" stroke="${strokeColor}" stroke-width="1.5" />`;
    }

    svg += '</svg>';
    return svg;
  }
}

