import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { getPaletteForTypes } from '../client/data/pokemonThemes.js';
import { getNeonPalette } from '../client/utils/qrRenderer.js';
import {
  buildQrMatrix,
  computeContrastRatio,
  estimateInlineByteCapacity,
  type QrMaskPattern
} from '../client/utils/qrVerifier.js';

describe('Pokémon QR Engine & Scannability', () => {
  it('computes contrast ratios and inline capacities accurately', () => {
    expect(computeContrastRatio('#000000', '#ffffff')).toBe(21);
    expect(computeContrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(estimateInlineByteCapacity('H')).toBe(1273);
    expect(estimateInlineByteCapacity('L')).toBe(2953);
  });

  it('maps Pokémon types to high-contrast QR palettes and neon scene palettes', () => {
    const electric = getPaletteForTypes(['electric']);
    const ghost = getPaletteForTypes(['ghost', 'poison']);
    expect(computeContrastRatio(electric.fg, electric.bg)).toBeGreaterThan(7);
    expect(computeContrastRatio(ghost.fg, ghost.bg)).toBeGreaterThan(7);

    const synth = getNeonPalette('synthwave', null);
    const typeNeon = getNeonPalette('type', {
      id: 25,
      name: 'pikachu',
      displayName: 'Pikachu',
      types: ['electric'],
      shiny: false,
      artworkStyle: 'official'
    });
    expect(computeContrastRatio(synth.tileColor, synth.eyeDark)).toBeGreaterThan(7);
    expect(computeContrastRatio(typeNeon.tileColor, typeNeon.eyeDark)).toBeGreaterThan(7);
  });

  it('decodes QR matrix with Pokéball-colored corner eyes and a 22% centered badge cutout via jsQR', () => {
    const targetUrl = 'http://192.168.1.42:3000/s/pika-drop';
    const matrix = buildQrMatrix(targetUrl, 'H');
    const N = matrix.size;
    const quiet = 4;
    const modPx = 12;
    const totalPx = (N + quiet * 2) * modPx;
    const rgba = new Uint8ClampedArray(totalPx * totalPx * 4);

    rgba.fill(255);

    const paintRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number) => {
      for (let py = Math.max(0, Math.floor(ry)); py < Math.min(totalPx, Math.ceil(ry + rh)); py++) {
        for (let px = Math.max(0, Math.floor(rx)); px < Math.min(totalPx, Math.ceil(rx + rw)); px++) {
          const idx = (py * totalPx + px) * 4;
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = 255;
        }
      }
    };

    const badgeRadiusMods = N * 0.22 * 0.52;
    const center = (N - 1) / 2;

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const isFinder =
          (row < 7 && col < 7) ||
          (row < 7 && col >= N - 7) ||
          (row >= N - 7 && col < 7);

        if (!isFinder && Math.max(Math.abs(col - center), Math.abs(row - center)) <= badgeRadiusMods) {
          continue;
        }

        if (matrix.data[row * N + col] === 1) {
          const x = (quiet + col) * modPx;
          const y = (quiet + row) * modPx;
          if (isFinder && row % (N - 7) < 3) {
            paintRect(x, y, modPx, modPx, 220, 38, 38);
          } else {
            paintRect(x, y, modPx, modPx, 30, 27, 75);
          }
        }
      }
    }

    const decoded = jsQR(rgba, totalPx, totalPx, { inversionAttempts: 'dontInvert' });
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(targetUrl);
  });

  it('decodes grid-snapped 8-bit Pixel Art Pokémon QR using mask optimization via jsQR', () => {
    const targetUrl = 'http://10.90.47.124:3000/s/pixel-pika';
    const base = buildQrMatrix(targetUrl, 'H');
    const N = base.size;
    const spriteSize = Math.round(N * 0.36);
    const start = Math.floor((N - spriteSize) / 2);

    // Choose best mask pattern among 0..7 for a bright yellow + black-outlined pixel sprite
    let bestMatrix = base;
    let bestScore = -1;
    for (let m = 0; m < 8; m++) {
      const candidate = buildQrMatrix(targetUrl, 'H', m as QrMaskPattern);
      let score = 0;
      for (let sr = 0; sr < spriteSize; sr++) {
        for (let sc = 0; sc < spriteSize; sc++) {
          const isOutline = sr === 0 || sc === 0 || sr === spriteSize - 1 || sc === spriteSize - 1;
          const bit = candidate.data[(start + sr) * N + (start + sc)];
          if ((isOutline && bit === 1) || (!isOutline && bit === 0)) score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestMatrix = candidate;
      }
    }

    const quiet = 3;
    const modPx = 12;
    const totalPx = (N + quiet * 2) * modPx;
    const rgba = new Uint8ClampedArray(totalPx * totalPx * 4);
    rgba.fill(255);

    const paintRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number) => {
      for (let py = Math.max(0, Math.floor(ry)); py < Math.min(totalPx, Math.ceil(ry + rh)); py++) {
        for (let px = Math.max(0, Math.floor(rx)); px < Math.min(totalPx, Math.ceil(rx + rw)); px++) {
          const idx = (py * totalPx + px) * 4;
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = 255;
        }
      }
    };

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const x = (quiet + col) * modPx;
        const y = (quiet + row) * modPx;
        const inSprite =
          row >= start &&
          row < start + spriteSize &&
          col >= start &&
          col < start + spriteSize;

        if (inSprite) {
          const sr = row - start;
          const sc = col - start;
          const isOutline = sr === 0 || sc === 0 || sr === spriteSize - 1 || sc === spriteSize - 1;
          if (isOutline) {
            paintRect(x, y, modPx, modPx, 20, 20, 25);
          } else {
            paintRect(x, y, modPx, modPx, 250, 204, 21); // Pikachu yellow pixel block
          }
        } else if (bestMatrix.data[row * N + col] === 1) {
          paintRect(x, y, modPx, modPx, 15, 23, 42);
        }
      }
    }

    const decoded = jsQR(rgba, totalPx, totalPx, { inversionAttempts: 'dontInvert' });
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(targetUrl);
  });

  it('decodes inverted Neon Scene Glow QR with bright neon tiles on dark synthwave sky via jsQR', () => {
    const targetUrl = 'http://10.90.47.124:3000/s/neon-mew';
    const matrix = buildQrMatrix(targetUrl, 'H');
    const N = matrix.size;
    const quiet = 3;
    const modPx = 12;
    const totalPx = (N + quiet * 2) * modPx;
    const rgba = new Uint8ClampedArray(totalPx * totalPx * 4);

    // Fill deep dark twilight background (#080316)
    for (let i = 0; i < rgba.length; i += 4) {
      rgba[i] = 8;
      rgba[i + 1] = 3;
      rgba[i + 2] = 22;
      rgba[i + 3] = 255;
    }

    const paintRect = (rx: number, ry: number, rw: number, rh: number, r: number, g: number, b: number) => {
      for (let py = Math.max(0, Math.floor(ry)); py < Math.min(totalPx, Math.ceil(ry + rh)); py++) {
        for (let px = Math.max(0, Math.floor(rx)); px < Math.min(totalPx, Math.ceil(rx + rw)); px++) {
          const idx = (py * totalPx + px) * 4;
          rgba[idx] = r;
          rgba[idx + 1] = g;
          rgba[idx + 2] = b;
          rgba[idx + 3] = 255;
        }
      }
    };

    const center = (N - 1) / 2;
    const sunRadiusMods = N * 0.165;

    for (let row = 0; row < N; row++) {
      for (let col = 0; col < N; col++) {
        const isFinder =
          (row < 7 && col < 7) ||
          (row < 7 && col >= N - 7) ||
          (row >= N - 7 && col < 7);

        if (!isFinder && Math.hypot(row - center, col - center) <= sunRadiusMods) {
          // Bright glowing sunset sun in center
          paintRect(
            (quiet + col) * modPx,
            (quiet + row) * modPx,
            modPx,
            modPx,
            251,
            113,
            133
          );
          continue;
        }

        if (matrix.data[row * N + col] === 1) {
          // Finder eyes use solid glowing neon bars (no internal gaps); data modules use spaced neon tiles
          const pad = isFinder ? 0 : 1;
          paintRect(
            (quiet + col) * modPx + pad,
            (quiet + row) * modPx + pad,
            modPx - pad * 2,
            modPx - pad * 2,
            245,
            163,
            224
          );
        }
      }
    }

    const decoded = jsQR(rgba, totalPx, totalPx, { inversionAttempts: 'attemptBoth' });
    expect(decoded).not.toBeNull();
    expect(decoded?.data).toBe(targetUrl);
  });
});
