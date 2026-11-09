import crypto from 'crypto';
import sharp from 'sharp';
import { BadRequestError } from '../errors';

export type SupportedMimeType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/tiff'
  | 'application/pdf';

export interface FileValidationResult {
  isValid: boolean;
  mimeType: SupportedMimeType;
  extension: string;
  bytes: number;
  width?: number;
  height?: number;
  dpi?: number;
  hash: string;
}

/**
 * Magic bytes signature checks for tamper-proof file type validation
 */
export function detectMimeType(buffer: Buffer): { mimeType: SupportedMimeType; extension: string } {
  if (!buffer || buffer.length < 4) {
    throw new BadRequestError('Empty or invalid file payload');
  }

  // 1. JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // 3. PDF: 25 50 44 46 (%PDF)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }

  // 4. WebP: RIFF ... WEBP
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  // 5. TIFF: Little endian (II*\0) or Big endian (MM\0*)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    return { mimeType: 'image/tiff', extension: 'tiff' };
  }

  throw new BadRequestError(
    'Unsupported file format. Please upload a valid JPEG, PNG, WebP, TIFF image or PDF document.'
  );
}

/**
 * Compute SHA-256 hash of a buffer and optional parameters for idempotency
 */
export function computeBufferHash(buffer: Buffer, extraParams?: any): string {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  if (extraParams) {
    hash.update(typeof extraParams === 'string' ? extraParams : JSON.stringify(extraParams));
  }
  return hash.digest('hex');
}

/**
 * Validate image buffer against dimensions, decompression limits, and corruptions
 */
export async function validateImageBuffer(
  buffer: Buffer,
  options: {
    maxBytes?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  } = {}
): Promise<FileValidationResult> {
  const maxBytes = options.maxBytes || 25 * 1024 * 1024; // 25 MB default limit
  const minWidth = options.minWidth || 32;
  const maxWidth = options.maxWidth || 12000;
  const minHeight = options.minHeight || 32;
  const maxHeight = options.maxHeight || 12000;

  if (buffer.length > maxBytes) {
    throw new BadRequestError(
      `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds allowed limit of ${(
        maxBytes /
        (1024 * 1024)
      ).toFixed(0)} MB`
    );
  }

  const { mimeType, extension } = detectMimeType(buffer);

  // If PDF, return early (Sharp metadata doesn't parse multi-page PDFs without poppler)
  if (mimeType === 'application/pdf') {
    return {
      isValid: true,
      mimeType,
      extension,
      bytes: buffer.length,
      hash: computeBufferHash(buffer),
    };
  }

  try {
    const metadata = await sharp(buffer, { failOn: 'error' }).metadata();

    if (!metadata.width || !metadata.height) {
      throw new BadRequestError('Corrupted or unreadable image dimensions');
    }

    if (metadata.width < minWidth || metadata.height < minHeight) {
      throw new BadRequestError(
        `Image resolution (${metadata.width}x${metadata.height}) is too small. Minimum required is ${minWidth}x${minHeight} px.`
      );
    }

    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      throw new BadRequestError(
        `Image resolution (${metadata.width}x${metadata.height}) exceeds maximum limit of ${maxWidth}x${maxHeight} px.`
      );
    }

    return {
      isValid: true,
      mimeType,
      extension,
      bytes: buffer.length,
      width: metadata.width,
      height: metadata.height,
      dpi: metadata.density || 72,
      hash: computeBufferHash(buffer),
    };
  } catch (err: any) {
    if (err instanceof BadRequestError) throw err;
    throw new BadRequestError(`Image decoding failed: ${err.message || 'Corrupted file'}`);
  }
}

