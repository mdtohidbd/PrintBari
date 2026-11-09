import fs from 'fs';
import path from 'path';
import PDFKit from 'pdfkit';
import { logger } from '../config/logger';

export class FontManager {
  private static registeredFonts = new Set<string>();

  /**
   * Potential font search locations for Bengali TrueType / OpenType fonts
   */
  private static candidateFontPaths = [
    // Project local fonts
    path.join(process.cwd(), 'assets', 'fonts', 'Kalpurush.ttf'),
    path.join(process.cwd(), 'backend', 'assets', 'fonts', 'Kalpurush.ttf'),
    path.join(process.cwd(), 'assets', 'fonts', 'vrinda.ttf'),
    path.join(process.cwd(), 'backend', 'assets', 'fonts', 'vrinda.ttf'),
    // Windows system fonts
    'C:\\Windows\\Fonts\\vrinda.ttf',
    'C:\\Windows\\Fonts\\Kalpurush.ttf',
    'C:\\Windows\\Fonts\\Siyamrupali.ttf',
    // Linux standard paths
    '/usr/share/fonts/truetype/kalpurush/kalpurush.ttf',
    '/usr/share/fonts/truetype/lohit-bengali/Lohit-Bengali.ttf',
  ];

  /**
   * Resolve an available Bengali font file on disk
   */
  public static getBengaliFontPath(): string | null {
    for (const fontPath of this.candidateFontPaths) {
      try {
        if (fs.existsSync(fontPath)) {
          return fontPath;
        }
      } catch {
        // Skip inaccessible paths
      }
    }
    return null;
  }

  /**
   * Register available Unicode fonts in a PDFKit document
   */
  public static setupDocumentFonts(doc: typeof PDFKit): { hasBengaliSupport: boolean } {
    const fontPath = this.getBengaliFontPath();

    if (fontPath) {
      try {
        doc.registerFont('Bengali', fontPath);
        return { hasBengaliSupport: true };
      } catch (err: any) {
        logger.warn(`[FontManager] Failed to register font ${fontPath}: ${err.message}`);
      }
    }

    return { hasBengaliSupport: false };
  }

  /**
   * Determine if a string contains Bengali Unicode characters (U+0980 to U+09FF)
   */
  public static isBengaliText(text: string): boolean {
    return /[\u0980-\u09FF]/.test(text);
  }

  /**
   * Sanitize text for standard PDF fonts if no Unicode font is available
   */
  public static sanitizeForPdf(text: string): string {
    if (!text) return '';
    // Replace unprintable control characters
    return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
}

