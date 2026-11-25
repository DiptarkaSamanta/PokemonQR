import jsQR from 'jsqr';
import QRCode from 'qrcode';
import type { QrEcLevel, QrVerificationResult } from '../types.ts';

export interface QrMatrixData {
  size: number;
  data: Uint8Array;
}

export type QrMaskPattern = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export function buildQrMatrix(
  payload: string,
  ecLevel: QrEcLevel,
  maskPattern?: QrMaskPattern
): QrMatrixData {
  const qr = QRCode.create(payload || 'https://pokeapi.co', {
    errorCorrectionLevel: ecLevel,
    ...(maskPattern !== undefined ? { maskPattern } : {})
  });
  return {
    size: qr.modules.size,
    data: qr.modules.data
  };
}

export function estimateInlineByteCapacity(ecLevel: QrEcLevel): number {
  switch (ecLevel) {
    case 'L':
      return 2953;
    case 'M':
      return 2331;
    case 'Q':
      return 1663;
    case 'H':
      return 1273;
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean.padEnd(6, '0').slice(0, 6);
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return [0, 0, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

export function computeContrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexToRgb(hexA));
  const lumB = relativeLuminance(hexToRgb(hexB));
  const bright = Math.max(lumA, lumB);
  const dark = Math.min(lumA, lumB);
  return Number(((bright + 0.05) / (dark + 0.05)).toFixed(2));
}

export interface ScanRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function verifyCanvasQr(
  canvas: HTMLCanvasElement,
  expectedText: string,
  fgColor: string,
  bgColor: string,
  moduleCount: number,
  region?: ScanRegion,
  allowInverted = true
): QrVerificationResult {
  const contrastRatio = computeContrastRatio(fgColor, bgColor);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      verified: false,
      decodedText: null,
      matchesTarget: false,
      contrastRatio,
      moduleCount,
      warning: 'Canvas context unavailable'
    };
  }

  const rx = region ? Math.max(0, Math.floor(region.x)) : 0;
  const ry = region ? Math.max(0, Math.floor(region.y)) : 0;
  const rw = region ? Math.min(canvas.width - rx, Math.ceil(region.width)) : canvas.width;
  const rh = region ? Math.min(canvas.height - ry, Math.ceil(region.height)) : canvas.height;

  const imgData = ctx.getImageData(rx, ry, rw, rh);

  // Try standard polarity first so we know whether decoding required inversion
  const standardDecoded = jsQR(imgData.data, rw, rh, { inversionAttempts: 'dontInvert' });
  let decoded = standardDecoded;
  let usedInverted = false;

  if (!decoded && allowInverted) {
    const invertedDecoded = jsQR(imgData.data, rw, rh, { inversionAttempts: 'onlyInvert' });
    if (invertedDecoded) {
      decoded = invertedDecoded;
      usedInverted = true;
    }
  }

  const decodedText = decoded?.data ?? null;
  const matchesTarget = decodedText !== null && decodedText === expectedText;

  let warning: string | null = null;
  if (contrastRatio < 3.0) {
    warning = `Low contrast (${contrastRatio}:1). Increase dark/light separation for reliable scanning.`;
  } else if (!decodedText) {
    warning = 'Scanner check could not decode this styling yet — try slightly smaller sprite/center art.';
  } else if (!matchesTarget) {
    warning = 'Decoded payload differs from target URL.';
  }

  return {
    verified: Boolean(matchesTarget && contrastRatio >= 2.5),
    decodedText,
    matchesTarget,
    contrastRatio,
    moduleCount,
    inverted: usedInverted,
    warning
  };
}
