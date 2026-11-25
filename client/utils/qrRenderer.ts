import jsQR from 'jsqr';
import { getPaletteForTypes } from '../data/pokemonThemes.ts';
import type {
  NeonSceneTheme,
  QrEyeShape,
  QrModuleShape,
  QrStyleConfig,
  SelectedPokemon
} from '../types.ts';
import { buildQrMatrix, type QrMaskPattern, type ScanRegion } from './qrVerifier.ts';

export interface RenderResult {
  moduleCount: number;
  qrRegion: ScanRegion;
}

export interface NeonPalette {
  skyStops: [string, string, string];
  sunStops: [string, string, string];
  floorStops: [string, string];
  gridColor: string;
  mountainColor: string;
  tileColor: string;
  tileGlow: string;
  eyeBright: string;
  eyeDark: string;
}

export const NEON_PALETTES: Record<Exclude<NeonSceneTheme, 'type'>, NeonPalette> = {
  synthwave: {
    skyStops: ['#060214', '#260846', '#6b1263'],
    sunStops: ['#fef08a', '#fb7185', '#c026d3'],
    floorStops: ['#2b0848', '#060212'],
    gridColor: '#e879f9',
    mountainColor: '#090318',
    tileColor: '#f5a3e0',
    tileGlow: '#ec4899',
    eyeBright: '#f472b6',
    eyeDark: '#080316'
  },
  cyber: {
    skyStops: ['#020617', '#0f172a', '#164e63'],
    sunStops: ['#cffafe', '#38bdf8', '#6366f1'],
    floorStops: ['#0f2942', '#020617'],
    gridColor: '#22d3ee',
    mountainColor: '#030b1a',
    tileColor: '#a5f3fc',
    tileGlow: '#06b6d4',
    eyeBright: '#38bdf8',
    eyeDark: '#020617'
  },
  inferno: {
    skyStops: ['#090205', '#3b0712', '#7c2d12'],
    sunStops: ['#fef08a', '#fb923c', '#dc2626'],
    floorStops: ['#450a0a', '#090205'],
    gridColor: '#fb923c',
    mountainColor: '#120307',
    tileColor: '#fed7aa',
    tileGlow: '#ea580c',
    eyeBright: '#fb923c',
    eyeDark: '#090205'
  },
  aurora: {
    skyStops: ['#030212', '#171544', '#2e1065'],
    sunStops: ['#a7f3d0', '#38bdf8', '#a855f7'],
    floorStops: ['#1e1b4b', '#030212'],
    gridColor: '#a78bfa',
    mountainColor: '#07051c',
    tileColor: '#ddd6fe',
    tileGlow: '#8b5cf6',
    eyeBright: '#c4b5fd',
    eyeDark: '#040314'
  },
  ocean: {
    skyStops: ['#020817', '#0c2444', '#0e4d64'],
    sunStops: ['#e0f2fe', '#38bdf8', '#0284c7'],
    floorStops: ['#082f49', '#020817'],
    gridColor: '#38bdf8',
    mountainColor: '#031224',
    tileColor: '#bae6fd',
    tileGlow: '#0ea5e9',
    eyeBright: '#7dd3fc',
    eyeDark: '#020817'
  }
};

export function getNeonPalette(
  theme: NeonSceneTheme,
  pokemon: SelectedPokemon | null
): NeonPalette {
  if (theme !== 'type') {
    return NEON_PALETTES[theme];
  }
  const typePal = getPaletteForTypes(pokemon?.types || []);
  return {
    skyStops: ['#060314', typePal.fg, typePal.fgSecondary],
    sunStops: ['#fef9c3', typePal.badgeBg, typePal.accent],
    floorStops: [typePal.fg, '#05020e'],
    gridColor: typePal.accent,
    mountainColor: '#070414',
    tileColor: typePal.badgeBg,
    tileGlow: typePal.accent,
    eyeBright: typePal.badgeBg,
    eyeDark: '#070414'
  };
}

export function getEffectiveContrastColors(
  style: QrStyleConfig,
  pokemon: SelectedPokemon | null
): { fg: string; bg: string } {
  if (style.mode === 'neonscene') {
    const pal = getNeonPalette(style.neonTheme, pokemon);
    return { fg: pal.tileColor, bg: pal.eyeDark };
  }
  return { fg: style.fgColor, bg: style.bgColor };
}

// Standard QR alignment pattern coordinate table (versions 2..15)
const ALIGNMENT_COORDS: Record<number, number[]> = {
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
  11: [6, 30, 54],
  12: [6, 32, 58],
  13: [6, 34, 62],
  14: [6, 26, 46, 66],
  15: [6, 26, 48, 70]
};

function getAlignmentCenters(size: number): Array<{ r: number; c: number }> {
  const version = Math.round((size - 17) / 4);
  const coords = ALIGNMENT_COORDS[version];
  if (!coords) return [];
  const centers: Array<{ r: number; c: number }> = [];
  for (const r of coords) {
    for (const c of coords) {
      const overlapsTopLeft = r < 9 && c < 9;
      const overlapsTopRight = r < 9 && c >= size - 9;
      const overlapsBottomLeft = r >= size - 9 && c < 9;
      if (overlapsTopLeft || overlapsTopRight || overlapsBottomLeft) continue;
      centers.push({ r, c });
    }
  }
  return centers;
}

function isFinderModule(r: number, c: number, size: number): boolean {
  const topLeft = r < 8 && c < 8;
  const topRight = r < 8 && c >= size - 8;
  const bottomLeft = r >= size - 8 && c < 8;
  return topLeft || topRight || bottomLeft;
}

function isTimingModule(r: number, c: number, size: number): boolean {
  return (r === 6 && c >= 8 && c < size - 8) || (c === 6 && r >= 8 && r < size - 8);
}

function isAlignmentModule(
  r: number,
  c: number,
  centers: Array<{ r: number; c: number }>
): boolean {
  for (const center of centers) {
    if (Math.abs(r - center.r) <= 2 && Math.abs(c - center.c) <= 2) {
      return true;
    }
  }
  return false;
}

function isInCenterBadge(
  r: number,
  c: number,
  size: number,
  badgeModulesRadius: number
): boolean {
  const center = (size - 1) / 2;
  const dx = Math.abs(c - center);
  const dy = Math.abs(r - center);
  return Math.max(dx, dy) <= badgeModulesRadius;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawFinderEye(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  modSize: number,
  eyeShape: QrEyeShape,
  eyeColor: string,
  bgColor: string
): void {
  const eyeSize = modSize * 7;

  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, eyeSize, eyeSize);

  if (eyeShape === 'square') {
    ctx.fillStyle = eyeColor;
    ctx.fillRect(x, y, eyeSize, eyeSize);
    ctx.fillStyle = bgColor;
    ctx.fillRect(x + modSize, y + modSize, modSize * 5, modSize * 5);
    ctx.fillStyle = eyeColor;
    ctx.fillRect(x + modSize * 2, y + modSize * 2, modSize * 3, modSize * 3);
    return;
  }

  if (eyeShape === 'rounded') {
    ctx.fillStyle = eyeColor;
    roundRectPath(ctx, x, y, eyeSize, eyeSize, modSize * 2.1);
    ctx.fill();
    ctx.fillStyle = bgColor;
    roundRectPath(ctx, x + modSize, y + modSize, modSize * 5, modSize * 5, modSize * 1.4);
    ctx.fill();
    ctx.fillStyle = eyeColor;
    roundRectPath(ctx, x + modSize * 2, y + modSize * 2, modSize * 3, modSize * 3, modSize * 0.9);
    ctx.fill();
    return;
  }

  const ballColors: Record<string, { top: string; accent: string | null }> = {
    pokeball: { top: '#dc2626', accent: null },
    greatball: { top: '#2563eb', accent: '#ef4444' },
    ultraball: { top: '#18181b', accent: '#eab308' },
    masterball: { top: '#7e22ce', accent: '#ec4899' }
  };
  const palette = ballColors[eyeShape] || { top: eyeColor, accent: null };
  const cx = x + eyeSize / 2;
  const cy = y + eyeSize / 2;

  ctx.save();
  roundRectPath(ctx, x, y, eyeSize, eyeSize, modSize * 2.8);
  ctx.clip();

  ctx.fillStyle = eyeColor;
  ctx.fillRect(x, y, eyeSize, eyeSize);

  ctx.fillStyle = palette.top;
  ctx.fillRect(x, y, eyeSize, eyeSize * 0.5);

  if (palette.accent) {
    ctx.fillStyle = palette.accent;
    ctx.fillRect(x + modSize * 1.4, y, modSize * 1.1, modSize * 1.6);
    ctx.fillRect(x + eyeSize - modSize * 2.5, y, modSize * 1.1, modSize * 1.6);
  }

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x, cy - modSize * 0.38, eyeSize, modSize * 0.76);
  ctx.restore();

  ctx.fillStyle = bgColor;
  roundRectPath(ctx, x + modSize, y + modSize, modSize * 5, modSize * 5, modSize * 2);
  ctx.fill();

  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(cx, cy, modSize * 1.55, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(cx, cy, modSize * 1.0, 0, Math.PI * 2);
  ctx.fill();
}

function drawDataModule(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  modSize: number,
  shape: QrModuleShape,
  hasTop: boolean,
  hasRight: boolean,
  hasBottom: boolean,
  hasLeft: boolean
): void {
  if (shape === 'square') {
    ctx.fillRect(x, y, Math.ceil(modSize), Math.ceil(modSize));
    return;
  }

  if (shape === 'pixel') {
    const pad = modSize * 0.06;
    const s = modSize - pad * 2;
    ctx.fillRect(x + pad, y + pad, s, s);
    return;
  }

  if (shape === 'dots') {
    const r = modSize * 0.43;
    ctx.beginPath();
    ctx.arc(x + modSize / 2, y + modSize / 2, r, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (shape === 'rounded') {
    const pad = modSize * 0.07;
    const s = modSize - pad * 2;
    roundRectPath(ctx, x + pad, y + pad, s, s, modSize * 0.3);
    ctx.fill();
    return;
  }

  const r = modSize * 0.44;
  const tl = !hasTop && !hasLeft ? r : 0;
  const tr = !hasTop && !hasRight ? r : 0;
  const br = !hasBottom && !hasRight ? r : 0;
  const bl = !hasBottom && !hasLeft ? r : 0;
  const w = Math.ceil(modSize + 0.35);
  const h = Math.ceil(modSize + 0.35);

  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.lineTo(x + w - tr, y);
  if (tr) ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
  ctx.lineTo(x + w, y + h - br);
  if (br) ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  ctx.lineTo(x + bl, y + h);
  if (bl) ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
  ctx.lineTo(x, y + tl);
  if (tl) ctx.quadraticCurveTo(x, y, x + tl, y);
  ctx.closePath();
  ctx.fill();
}

function sampleImageToGrid(
  img: HTMLImageElement,
  gridSize: number
): Uint8ClampedArray | null {
  try {
    const off = document.createElement('canvas');
    off.width = gridSize;
    off.height = gridSize;
    const octx = off.getContext('2d');
    if (!octx) return null;

    const iw = img.naturalWidth || img.width || 128;
    const ih = img.naturalHeight || img.height || 128;
    const scale = Math.min(gridSize / iw, gridSize / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (gridSize - dw) / 2;
    const dy = (gridSize - dh) / 2;

    octx.clearRect(0, 0, gridSize, gridSize);
    octx.drawImage(img, dx, dy, dw, dh);
    return octx.getImageData(0, 0, gridSize, gridSize).data;
  } catch {
    return null;
  }
}

function extractTightPixelSpriteGrid(
  img: HTMLImageElement,
  targetW: number,
  targetH: number
): Uint8ClampedArray | null {
  try {
    const srcW = Math.min(192, Math.max(64, img.naturalWidth || img.width || 96));
    const srcH = Math.min(192, Math.max(64, img.naturalHeight || img.height || 96));
    const probe = document.createElement('canvas');
    probe.width = srcW;
    probe.height = srcH;
    const pctx = probe.getContext('2d');
    if (!pctx) return null;

    pctx.imageSmoothingEnabled = false;
    pctx.drawImage(img, 0, 0, srcW, srcH);
    const data = pctx.getImageData(0, 0, srcW, srcH).data;

    let minX = srcW;
    let minY = srcH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < srcH; y++) {
      for (let x = 0; x < srcW; x++) {
        const a = data[(y * srcW + x) * 4 + 3];
        if (a > 40) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (maxX < minX || maxY < minY) {
      minX = 0;
      minY = 0;
      maxX = srcW - 1;
      maxY = srcH - 1;
    }

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const out = document.createElement('canvas');
    out.width = targetW;
    out.height = targetH;
    const octx = out.getContext('2d');
    if (!octx) return null;

    octx.imageSmoothingEnabled = false;
    const scale = Math.min(targetW / cropW, targetH / cropH);
    const dw = Math.max(1, Math.round(cropW * scale));
    const dh = Math.max(1, Math.round(cropH * scale));
    const dx = Math.floor((targetW - dw) / 2);
    const dy = Math.floor((targetH - dh) / 2);

    octx.clearRect(0, 0, targetW, targetH);
    octx.drawImage(probe, minX, minY, cropW, cropH, dx, dy, dw, dh);
    return octx.getImageData(0, 0, targetW, targetH).data;
  } catch {
    return null;
  }
}

function selectBestMaskForSprite(
  payload: string,
  spriteData: Uint8ClampedArray | null,
  boxSize: number,
  startRow: number,
  startCol: number
) {
  if (!spriteData) {
    return buildQrMatrix(payload, 'H');
  }

  let bestMatrix = buildQrMatrix(payload, 'H');
  let bestScore = -1;

  for (let m = 0; m < 8; m++) {
    try {
      const candidate = buildQrMatrix(payload, 'H', m as QrMaskPattern);
      const N = candidate.size;
      let score = 0;

      for (let sr = 0; sr < boxSize; sr++) {
        const mr = startRow + sr;
        if (mr < 0 || mr >= N) continue;
        for (let sc = 0; sc < boxSize; sc++) {
          const mc = startCol + sc;
          if (mc < 0 || mc >= N || isFinderModule(mr, mc, N)) continue;
          const idx = (sr * boxSize + sc) * 4;
          const alpha = spriteData[idx + 3];
          if (alpha <= 64) continue;

          const luma = 0.299 * spriteData[idx] + 0.587 * spriteData[idx + 1] + 0.114 * spriteData[idx + 2];
          const bit = candidate.data[mr * N + mc];
          if ((bit === 1 && luma < 120) || (bit === 0 && luma >= 120)) {
            score += 1;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatrix = candidate;
      }
    } catch {
      // Ignore unsupported mask error
    }
  }

  return bestMatrix;
}

function renderPixelArtQr(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  payload: string,
  style: QrStyleConfig,
  pokemonImage: HTMLImageElement | null,
  qrBoxX: number,
  qrBoxY: number,
  qrBoxSize: number
): number {
  const baseMatrix = buildQrMatrix(payload, 'H');
  const N = baseMatrix.size;
  const spriteBoxMods = Math.max(7, Math.min(N - 12, Math.round(N * style.pixelSpriteScale)));
  const startRow = Math.floor((N - spriteBoxMods) / 2);
  const startCol = Math.floor((N - spriteBoxMods) / 2);

  const spritePixels = pokemonImage
    ? extractTightPixelSpriteGrid(pokemonImage, spriteBoxMods, spriteBoxMods)
    : null;

  const matrix = selectBestMaskForSprite(payload, spritePixels, spriteBoxMods, startRow, startCol);

  const quiet = style.quietZoneModules;
  const totalModules = N + quiet * 2;
  const modSize = qrBoxSize / totalModules;
  const originX = qrBoxX + quiet * modSize;
  const originY = qrBoxY + quiet * modSize;

  const paintBaseQr = (withSafeDots: boolean) => {
    ctx.fillStyle = style.bgColor;
    ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

    // Draw crisp retro pixel QR modules
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isFinderModule(r, c, N)) continue;
        if (matrix.data[r * N + c] !== 1) continue;
        const x = originX + c * modSize;
        const y = originY + r * modSize;
        ctx.fillStyle = style.fgColor;
        ctx.fillRect(x, y, Math.ceil(modSize), Math.ceil(modSize));
      }
    }

    // Crisp classic square corner finders (matching Image 1 retro style)
    drawFinderEye(ctx, originX, originY, modSize, 'square', style.eyeColor, style.bgColor);
    drawFinderEye(
      ctx,
      originX + (N - 7) * modSize,
      originY,
      modSize,
      'square',
      style.eyeColor,
      style.bgColor
    );
    drawFinderEye(
      ctx,
      originX,
      originY + (N - 7) * modSize,
      modSize,
      'square',
      style.eyeColor,
      style.bgColor
    );

    if (!spritePixels) return;

    const center = (N - 1) / 2;
    const coreSafeMods = N * 0.19;

    // Snap quantized pixel-art Pokémon directly onto QR grid cells
    for (let sr = 0; sr < spriteBoxMods; sr++) {
      const mr = startRow + sr;
      if (mr < 0 || mr >= N) continue;
      for (let sc = 0; sc < spriteBoxMods; sc++) {
        const mc = startCol + sc;
        if (mc < 0 || mc >= N || isFinderModule(mr, mc, N)) continue;

        const idx = (sr * spriteBoxMods + sc) * 4;
        const alpha = spritePixels[idx + 3];
        if (alpha <= 70) continue;

        const r = spritePixels[idx];
        const g = spritePixels[idx + 1];
        const b = spritePixels[idx + 2];
        const x = originX + mc * modSize;
        const y = originY + mr * modSize;

        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
        ctx.fillRect(x, y, Math.ceil(modSize), Math.ceil(modSize));

        if (withSafeDots) {
          const distFromCenter = Math.max(Math.abs(mr - center), Math.abs(mc - center));
          if (distFromCenter > coreSafeMods) {
            const bit = matrix.data[mr * N + mc];
            const luma = 0.299 * r + 0.587 * g + 0.114 * b;
            const agrees = (bit === 1 && luma < 115) || (bit === 0 && luma >= 135);
            if (!agrees) {
              const dotSize = modSize * 0.36;
              const offset = (modSize - dotSize) / 2;
              ctx.fillStyle = bit === 1 ? style.fgColor : style.bgColor;
              ctx.fillRect(x + offset, y + offset, dotSize, dotSize);
            }
          }
        }
      }
    }
  };

  // First try pure 100% solid pixel blocks (zero dots, exact Mario Image-1 look)
  paintBaseQr(false);

  if (spritePixels && style.pixelSafeDots) {
    try {
      const rx = Math.max(0, Math.floor(qrBoxX));
      const ry = Math.max(0, Math.floor(qrBoxY));
      const rw = Math.min(canvas.width - rx, Math.ceil(qrBoxSize));
      const rh = Math.min(canvas.height - ry, Math.ceil(qrBoxSize));
      const imgData = ctx.getImageData(rx, ry, rw, rh);
      const check = jsQR(imgData.data, rw, rh, { inversionAttempts: 'dontInvert' });
      if (!check || check.data !== payload) {
        paintBaseQr(true);
      }
    } catch {
      // Ignore readback error
    }
  }

  return N;
}

function drawPalmSilhouette(
  ctx: CanvasRenderingContext2D,
  trunkBaseX: number,
  trunkBaseY: number,
  height: number,
  lean: number,
  color: string
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  const topX = trunkBaseX + lean * height * 0.28;
  const topY = trunkBaseY - height;

  ctx.lineWidth = Math.max(4, height * 0.055);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(trunkBaseX, trunkBaseY);
  ctx.quadraticCurveTo(trunkBaseX + lean * height * 0.08, trunkBaseY - height * 0.5, topX, topY);
  ctx.stroke();

  const frondAngles = [-2.6, -2.0, -1.2, -0.4, 0.35, 1.0];
  for (const ang of frondAngles) {
    const len = height * 0.42;
    const ex = topX + Math.cos(ang) * len;
    const ey = topY + Math.sin(ang) * len * 0.72 + len * 0.2;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(ang) * len * 0.55,
      topY + Math.sin(ang) * len * 0.25 - len * 0.08,
      ex,
      ey
    );
    ctx.quadraticCurveTo(
      topX + Math.cos(ang) * len * 0.45,
      topY + Math.sin(ang) * len * 0.45 + len * 0.06,
      topX,
      topY
    );
    ctx.fill();
  }

  ctx.restore();
}

function renderNeonSceneQr(
  ctx: CanvasRenderingContext2D,
  payload: string,
  style: QrStyleConfig,
  pokemon: SelectedPokemon | null,
  pokemonImage: HTMLImageElement | null,
  qrBoxX: number,
  qrBoxY: number,
  qrBoxSize: number
): number {
  const matrix = buildQrMatrix(payload, 'H');
  const N = matrix.size;
  const palette = getNeonPalette(style.neonTheme, pokemon);
  const alignmentCenters = getAlignmentCenters(N);

  const quiet = style.quietZoneModules;
  const totalModules = N + quiet * 2;
  const modSize = qrBoxSize / totalModules;
  const originX = qrBoxX + quiet * modSize;
  const originY = qrBoxY + quiet * modSize;

  const cx = qrBoxX + qrBoxSize / 2;
  const horizonY = qrBoxY + qrBoxSize * 0.58;
  const sunY = qrBoxY + qrBoxSize * 0.44;
  const sunRadius = qrBoxSize * 0.205;

  // 1. Twilight sky gradient
  const skyGrad = ctx.createLinearGradient(0, qrBoxY, 0, horizonY);
  skyGrad.addColorStop(0, palette.skyStops[0]);
  skyGrad.addColorStop(0.62, palette.skyStops[1]);
  skyGrad.addColorStop(1, palette.skyStops[2]);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, horizonY - qrBoxY + 2);

  // 2. Deterministic starry particles
  ctx.save();
  for (let i = 0; i < 65; i++) {
    const sx = qrBoxX + (((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1) * qrBoxSize;
    const sy = qrBoxY + (((Math.sin(i * 78.233) * 19341.123) % 1 + 1) % 1) * (horizonY - qrBoxY) * 0.85;
    const sr = (i % 3 === 0 ? 2.1 : 1.1) * (qrBoxSize / 1024);
    ctx.globalAlpha = 0.35 + (i % 5) * 0.12;
    ctx.fillStyle = i % 4 === 0 ? palette.tileColor : '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 3. Glowing Sun / Portal Orb with synthwave horizontal cuts
  ctx.save();
  const halo = ctx.createRadialGradient(cx, sunY, sunRadius * 0.4, cx, sunY, sunRadius * 1.9);
  halo.addColorStop(0, palette.tileGlow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.52;
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(cx, sunY, sunRadius * 1.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, sunY, sunRadius, 0, Math.PI * 2);
  ctx.clip();
  const sunGrad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
  sunGrad.addColorStop(0, palette.sunStops[0]);
  sunGrad.addColorStop(0.55, palette.sunStops[1]);
  sunGrad.addColorStop(1, palette.sunStops[2]);
  ctx.fillStyle = sunGrad;
  ctx.fillRect(cx - sunRadius, sunY - sunRadius, sunRadius * 2, sunRadius * 2);

  // Horizontal scanlines across lower half of sun
  ctx.fillStyle = palette.skyStops[1];
  for (let band = 0; band < 6; band++) {
    const by = sunY + sunRadius * (0.08 + band * 0.145);
    const bh = sunRadius * (0.018 + band * 0.011);
    ctx.fillRect(cx - sunRadius, by, sunRadius * 2, bh);
  }
  ctx.restore();

  // 4. Layered horizon mountain silhouettes
  ctx.fillStyle = palette.mountainColor;
  ctx.beginPath();
  ctx.moveTo(qrBoxX, horizonY);
  const mountainPts = [
    [0.0, 0.0],
    [0.09, -0.055],
    [0.18, -0.025],
    [0.29, -0.07],
    [0.41, -0.015],
    [0.5, -0.032],
    [0.62, -0.015],
    [0.73, -0.068],
    [0.84, -0.024],
    [0.93, -0.052],
    [1.0, 0.0]
  ];
  for (const [px, py] of mountainPts) {
    ctx.lineTo(qrBoxX + px * qrBoxSize, horizonY + py * qrBoxSize);
  }
  ctx.lineTo(qrBoxX + qrBoxSize, horizonY + 2);
  ctx.closePath();
  ctx.fill();

  // 5. Perspective neon floor grid
  const floorGrad = ctx.createLinearGradient(0, horizonY, 0, qrBoxY + qrBoxSize);
  floorGrad.addColorStop(0, palette.floorStops[0]);
  floorGrad.addColorStop(1, palette.floorStops[1]);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(qrBoxX, horizonY, qrBoxSize, qrBoxY + qrBoxSize - horizonY);

  ctx.save();
  ctx.beginPath();
  ctx.rect(qrBoxX, horizonY, qrBoxSize, qrBoxY + qrBoxSize - horizonY);
  ctx.clip();

  ctx.strokeStyle = palette.gridColor;
  ctx.lineWidth = Math.max(1.2, qrBoxSize * 0.0022);
  ctx.shadowColor = palette.tileGlow;
  ctx.shadowBlur = 10 * style.neonGlowStrength;

  // Horizon bright beam
  ctx.beginPath();
  ctx.moveTo(qrBoxX, horizonY + 1);
  ctx.lineTo(qrBoxX + qrBoxSize, horizonY + 1);
  ctx.stroke();

  // Horizontal perspective depth lines
  const floorH = qrBoxY + qrBoxSize - horizonY;
  for (let i = 1; i <= 10; i++) {
    const t = Math.pow(i / 10, 1.85);
    const ly = horizonY + t * floorH;
    ctx.globalAlpha = 0.25 + 0.55 * t;
    ctx.beginPath();
    ctx.moveTo(qrBoxX, ly);
    ctx.lineTo(qrBoxX + qrBoxSize, ly);
    ctx.stroke();
  }

  // Radiating vanishing lines
  ctx.globalAlpha = 0.55;
  for (let i = -10; i <= 10; i++) {
    const bx = cx + i * (qrBoxSize * 0.14);
    ctx.beginPath();
    ctx.moveTo(cx + i * (qrBoxSize * 0.015), horizonY);
    ctx.lineTo(bx, qrBoxY + qrBoxSize);
    ctx.stroke();
  }
  ctx.restore();

  // 6. Framing palm silhouettes at left & right edges (like Image 2)
  drawPalmSilhouette(ctx, qrBoxX + qrBoxSize * 0.055, horizonY + qrBoxSize * 0.02, qrBoxSize * 0.24, 0.55, palette.mountainColor);
  drawPalmSilhouette(ctx, qrBoxX + qrBoxSize * 0.945, horizonY + qrBoxSize * 0.02, qrBoxSize * 0.24, -0.55, palette.mountainColor);

  // 7. Heroic Pokémon centerpiece inside sun orb
  if (pokemonImage) {
    ctx.save();
    const pokeBox = sunRadius * 1.65;
    const iw = pokemonImage.naturalWidth || pokemonImage.width || pokeBox;
    const ih = pokemonImage.naturalHeight || pokemonImage.height || pokeBox;
    const scale = Math.min(pokeBox / iw, pokeBox / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.shadowColor = palette.eyeBright;
    ctx.shadowBlur = 22 * style.neonGlowStrength;
    ctx.drawImage(pokemonImage, cx - dw / 2, sunY - dh / 2, dw, dh);
    ctx.restore();
  }

  // Helper to paint glowing neon corner/alignment eyes
  const drawNeonEye = (ex: number, ey: number, mods: number) => {
    const s = modSize * mods;
    const innerPad = modSize;
    const corePad = modSize * 2;
    const darkMargin = modSize * 0.55;

    // Soft dark frame around eye so finder contrast never washes out
    ctx.save();
    ctx.fillStyle = palette.eyeDark;
    ctx.globalAlpha = 0.78;
    ctx.fillRect(ex - darkMargin, ey - darkMargin, s + darkMargin * 2, s + darkMargin * 2);
    ctx.restore();

    if (style.neonInverted) {
      ctx.save();
      ctx.shadowColor = palette.tileGlow;
      ctx.shadowBlur = modSize * 0.85 * style.neonGlowStrength;
      ctx.fillStyle = palette.eyeBright;
      ctx.fillRect(ex, ey, s, s);
      ctx.restore();

      ctx.fillStyle = palette.eyeDark;
      ctx.fillRect(ex + innerPad, ey + innerPad, modSize * (mods - 2), modSize * (mods - 2));

      ctx.save();
      ctx.shadowColor = palette.tileGlow;
      ctx.shadowBlur = modSize * 0.85 * style.neonGlowStrength;
      ctx.fillStyle = palette.eyeBright;
      ctx.fillRect(ex + corePad, ey + corePad, modSize * (mods - 4), modSize * (mods - 4));
      ctx.restore();
    } else {
      ctx.fillStyle = palette.eyeDark;
      ctx.fillRect(ex, ey, s, s);
      ctx.fillStyle = palette.eyeBright;
      ctx.fillRect(ex + innerPad, ey + innerPad, modSize * (mods - 2), modSize * (mods - 2));
      ctx.fillStyle = palette.eyeDark;
      ctx.fillRect(ex + corePad, ey + corePad, modSize * (mods - 4), modSize * (mods - 4));
    }
  };

  // 8. Draw Data Modules
  const centerIdx = (N - 1) / 2;
  const sunCenterRow = (sunY - originY) / modSize - 0.5;
  const sunSafeMods = Math.min(N * 0.165, (sunRadius * 0.74) / modSize);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isFinderModule(r, c, N)) continue;
      if (isAlignmentModule(r, c, alignmentCenters)) continue;

      // Leave central sun + Pokémon showcase unobstructed within EC-H tolerance
      const dr = r - sunCenterRow;
      const dc = c - centerIdx;
      if (Math.hypot(dr, dc) <= sunSafeMods) continue;

      const x = originX + c * modSize;
      const y = originY + r * modSize;
      const bit = matrix.data[r * N + c] === 1;

      if (style.neonInverted) {
        if (bit) {
          const pad = modSize * 0.08;
          ctx.save();
          ctx.globalAlpha = 0.92;
          ctx.shadowColor = palette.tileGlow;
          ctx.shadowBlur = modSize * 0.55 * style.neonGlowStrength;
          ctx.fillStyle = palette.tileColor;
          ctx.fillRect(x + pad, y + pad, modSize - pad * 2, modSize - pad * 2);
          ctx.restore();
        } else {
          // Darken 0-modules near bright horizon/sun glow so scanner contrast stays strong
          const nearBrightSun = Math.hypot(dr, dc) <= sunSafeMods + 3.2;
          const nearHorizonLine = Math.abs(y + modSize / 2 - horizonY) < modSize * 2.2;
          if (nearBrightSun || nearHorizonLine) {
            ctx.save();
            ctx.globalAlpha = 0.72;
            ctx.fillStyle = palette.eyeDark;
            ctx.fillRect(x + modSize * 0.08, y + modSize * 0.08, modSize * 0.84, modSize * 0.84);
            ctx.restore();
          }
        }
      } else {
        if (bit) {
          const pad = modSize * 0.08;
          ctx.save();
          ctx.globalAlpha = 0.92;
          ctx.fillStyle = palette.eyeDark;
          ctx.fillRect(x + pad, y + pad, modSize - pad * 2, modSize - pad * 2);
          ctx.restore();
        } else {
          ctx.save();
          ctx.globalAlpha = 0.78;
          ctx.fillStyle = palette.tileColor;
          ctx.fillRect(x + modSize * 0.14, y + modSize * 0.14, modSize * 0.72, modSize * 0.72);
          ctx.restore();
        }
      }
    }
  }

  // 9. Draw 3 Corner Finder Patterns + Alignment Eyes
  drawNeonEye(originX, originY, 7);
  drawNeonEye(originX + (N - 7) * modSize, originY, 7);
  drawNeonEye(originX, originY + (N - 7) * modSize, 7);

  for (const center of alignmentCenters) {
    drawNeonEye(originX + (center.c - 2) * modSize, originY + (center.r - 2) * modSize, 5);
  }

  return N;
}

function drawBadgeFrameAndImage(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  badgePx: number,
  style: QrStyleConfig,
  pokemonImage: HTMLImageElement | null,
  badgeTint: string
): void {
  const half = badgePx / 2;
  ctx.save();

  ctx.fillStyle = style.bgColor;
  if (style.badgeShape === 'squircle') {
    roundRectPath(ctx, centerX - half, centerY - half, badgePx, badgePx, badgePx * 0.24);
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(centerX, centerY, half, 0, Math.PI * 2);
    ctx.fill();
  }

  const innerPad = badgePx * 0.08;
  const innerSize = badgePx - innerPad * 2;
  const innerHalf = innerSize / 2;

  if (style.badgeShape === 'pokeball') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerHalf, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = badgeTint;
    ctx.fillRect(centerX - innerHalf, centerY - innerHalf, innerSize, innerHalf);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(centerX - innerHalf, centerY, innerSize, innerHalf);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(centerX - innerHalf, centerY - innerSize * 0.04, innerSize, innerSize * 0.08);
    ctx.restore();

    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = Math.max(2, badgePx * 0.03);
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerHalf, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = badgeTint;
    if (style.badgeShape === 'squircle') {
      roundRectPath(ctx, centerX - innerHalf, centerY - innerHalf, innerSize, innerSize, innerSize * 0.22);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(centerX, centerY, innerHalf, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = style.eyeColor;
    ctx.lineWidth = Math.max(2, badgePx * 0.025);
    ctx.stroke();
  }

  if (pokemonImage) {
    const imgBox = innerSize * 0.88;
    const iw = pokemonImage.naturalWidth || pokemonImage.width || imgBox;
    const ih = pokemonImage.naturalHeight || pokemonImage.height || imgBox;
    const scale = Math.min(imgBox / iw, imgBox / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(pokemonImage, centerX - dw / 2, centerY - dh / 2, dw, dh);
  }

  ctx.restore();
}

export function renderPokemonQrToCanvas(
  canvas: HTMLCanvasElement,
  payload: string,
  style: QrStyleConfig,
  pokemon: SelectedPokemon | null,
  pokemonImage: HTMLImageElement | null,
  outputSize = 1024
): RenderResult {
  const palette = getPaletteForTypes(pokemon?.types || []);
  const cardWidth = outputSize;
  const cardHeight = style.includeCardFrame ? Math.round(outputSize * 1.24) : outputSize;

  canvas.width = cardWidth;
  canvas.height = cardHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, cardWidth, cardHeight);

  let qrBoxX = 0;
  let qrBoxY = 0;
  let qrBoxSize = outputSize;

  if (style.includeCardFrame) {
    const grad = ctx.createLinearGradient(0, 0, cardWidth, cardHeight);
    grad.addColorStop(0, palette.accent);
    grad.addColorStop(1, palette.fgSecondary);
    roundRectPath(ctx, 0, 0, cardWidth, cardHeight, cardWidth * 0.045);
    ctx.fillStyle = grad;
    ctx.fill();

    const frameMargin = Math.round(cardWidth * 0.032);
    roundRectPath(
      ctx,
      frameMargin,
      frameMargin,
      cardWidth - frameMargin * 2,
      cardHeight - frameMargin * 2,
      cardWidth * 0.03
    );
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    const headerH = Math.round(cardWidth * 0.13);
    ctx.save();
    roundRectPath(
      ctx,
      frameMargin,
      frameMargin,
      cardWidth - frameMargin * 2,
      headerH,
      cardWidth * 0.03
    );
    ctx.clip();
    ctx.fillStyle = palette.badgeBg;
    ctx.fillRect(frameMargin, frameMargin, cardWidth - frameMargin * 2, headerH);
    ctx.restore();

    const textLeft = frameMargin + Math.round(cardWidth * 0.04);
    const dexLabel = pokemon ? `#${String(pokemon.id).padStart(3, '0')}` : 'POKÉQR';
    const pokeName = pokemon ? pokemon.displayName : 'Custom QR';

    ctx.fillStyle = palette.fg;
    ctx.font = `800 ${Math.round(cardWidth * 0.044)}px system-ui, -apple-system, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(pokeName, textLeft, frameMargin + headerH * 0.5);

    ctx.textAlign = 'right';
    ctx.fillStyle = palette.eye;
    ctx.font = `700 ${Math.round(cardWidth * 0.028)}px system-ui, -apple-system, sans-serif`;
    const typeText = pokemon?.types.length ? `${dexLabel} · ${pokemon.types.join(' / ').toUpperCase()}` : dexLabel;
    ctx.fillText(typeText, cardWidth - frameMargin - Math.round(cardWidth * 0.04), frameMargin + headerH * 0.5);
    ctx.textAlign = 'left';

    qrBoxSize = Math.round(cardWidth * 0.82);
    qrBoxX = Math.round((cardWidth - qrBoxSize) / 2);
    qrBoxY = frameMargin + headerH + Math.round(cardWidth * 0.035);
  }

  ctx.save();
  if (style.includeCardFrame) {
    roundRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrBoxSize * 0.03);
    ctx.clip();
  }

  let moduleCount = 0;

  if (style.mode === 'pixelart') {
    moduleCount = renderPixelArtQr(
      ctx,
      canvas,
      payload,
      style,
      pokemonImage,
      qrBoxX,
      qrBoxY,
      qrBoxSize
    );
  } else if (style.mode === 'neonscene') {
    moduleCount = renderNeonSceneQr(
      ctx,
      payload,
      style,
      pokemon,
      pokemonImage,
      qrBoxX,
      qrBoxY,
      qrBoxSize
    );
  } else {
    const effectiveEc = style.mode === 'classic' ? style.ecLevel : 'H';
    const matrix = buildQrMatrix(payload, effectiveEc);
    const N = matrix.size;
    moduleCount = N;

    ctx.fillStyle = style.bgColor;
    ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize);

    const quiet = style.quietZoneModules;
    const totalModules = N + quiet * 2;
    const modSize = qrBoxSize / totalModules;
    const matrixOriginX = qrBoxX + quiet * modSize;
    const matrixOriginY = qrBoxY + quiet * modSize;
    const matrixPx = N * modSize;

    if (style.mode === 'backdrop' && pokemonImage) {
      ctx.save();
      ctx.globalAlpha = style.backdropOpacity;
      const iw = pokemonImage.naturalWidth || pokemonImage.width || matrixPx;
      const ih = pokemonImage.naturalHeight || pokemonImage.height || matrixPx;
      const scale = Math.min((matrixPx * 0.9) / iw, (matrixPx * 0.9) / ih);
      const dw = iw * scale;
      const dh = ih * scale;
      ctx.drawImage(
        pokemonImage,
        matrixOriginX + (matrixPx - dw) / 2,
        matrixOriginY + (matrixPx - dh) / 2,
        dw,
        dh
      );
      ctx.restore();
    }

    const sampledGrid =
      style.mode === 'halftone' && pokemonImage ? sampleImageToGrid(pokemonImage, N) : null;

    let fgFill: string | CanvasGradient = style.fgColor;
    if (style.useGradient) {
      const grad = ctx.createLinearGradient(
        matrixOriginX,
        matrixOriginY,
        matrixOriginX + matrixPx,
        matrixOriginY + matrixPx
      );
      grad.addColorStop(0, style.fgColor);
      grad.addColorStop(1, style.fgSecondaryColor);
      fgFill = grad;
    }

    const badgePx = qrBoxSize * style.badgeSizeRatio;
    const badgeModulesRadius = style.mode === 'badge' ? (badgePx / modSize) * 0.52 : -1;

    const isBitSet = (r: number, c: number): boolean => {
      if (r < 0 || c < 0 || r >= N || c >= N) return false;
      return matrix.data[r * N + c] === 1;
    };

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (isFinderModule(r, c, N)) continue;
        if (badgeModulesRadius > 0 && isInCenterBadge(r, c, N, badgeModulesRadius)) continue;

        const x = matrixOriginX + c * modSize;
        const y = matrixOriginY + r * modSize;
        const bit = isBitSet(r, c);

        if (style.mode === 'halftone' && sampledGrid && !isTimingModule(r, c, N)) {
          const idx = (r * N + c) * 4;
          const sr = sampledGrid[idx];
          const sg = sampledGrid[idx + 1];
          const sb = sampledGrid[idx + 2];
          const sa = sampledGrid[idx + 3];

          if (sa > 36) {
            ctx.save();
            ctx.globalAlpha = style.halftoneIntensity * (sa / 255);
            ctx.fillStyle = `rgb(${sr}, ${sg}, ${sb})`;
            ctx.fillRect(x, y, Math.ceil(modSize), Math.ceil(modSize));
            ctx.restore();

            const coreScale = 0.5;
            const coreSize = modSize * coreScale;
            const offset = (modSize - coreSize) / 2;
            ctx.fillStyle = bit ? fgFill : style.bgColor;
            if (style.moduleShape === 'dots') {
              ctx.beginPath();
              ctx.arc(x + modSize / 2, y + modSize / 2, coreSize * 0.56, 0, Math.PI * 2);
              ctx.fill();
            } else {
              ctx.fillRect(x + offset, y + offset, coreSize, coreSize);
            }
            continue;
          }
        }

        if (style.mode === 'backdrop' && pokemonImage) {
          if (bit) {
            ctx.fillStyle = fgFill;
            drawDataModule(
              ctx,
              x,
              y,
              modSize,
              style.moduleShape,
              isBitSet(r - 1, c) && !isFinderModule(r - 1, c, N),
              isBitSet(r, c + 1) && !isFinderModule(r, c + 1, N),
              isBitSet(r + 1, c) && !isFinderModule(r + 1, c, N),
              isBitSet(r, c - 1) && !isFinderModule(r, c - 1, N)
            );
          } else {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = style.bgColor;
            ctx.fillRect(x + modSize * 0.18, y + modSize * 0.18, modSize * 0.64, modSize * 0.64);
            ctx.restore();
          }
          continue;
        }

        if (!bit) continue;

        ctx.fillStyle = fgFill;
        drawDataModule(
          ctx,
          x,
          y,
          modSize,
          style.moduleShape,
          isBitSet(r - 1, c) && !isFinderModule(r - 1, c, N),
          isBitSet(r, c + 1) && !isFinderModule(r, c + 1, N),
          isBitSet(r + 1, c) && !isFinderModule(r + 1, c, N),
          isBitSet(r, c - 1) && !isFinderModule(r, c - 1, N)
        );
      }
    }

    drawFinderEye(ctx, matrixOriginX, matrixOriginY, modSize, style.eyeShape, style.eyeColor, style.bgColor);
    drawFinderEye(
      ctx,
      matrixOriginX + (N - 7) * modSize,
      matrixOriginY,
      modSize,
      style.eyeShape,
      style.eyeColor,
      style.bgColor
    );
    drawFinderEye(
      ctx,
      matrixOriginX,
      matrixOriginY + (N - 7) * modSize,
      modSize,
      style.eyeShape,
      style.eyeColor,
      style.bgColor
    );

    if (style.mode === 'badge') {
      drawBadgeFrameAndImage(
        ctx,
        qrBoxX + qrBoxSize / 2,
        qrBoxY + qrBoxSize / 2,
        badgePx,
        style,
        pokemonImage,
        palette.badgeBg
      );
    }
  }

  ctx.restore();

  if (style.includeCardFrame) {
    const footerTop = qrBoxY + qrBoxSize + Math.round(cardWidth * 0.028);
    const headline = style.cardHeadline.trim() || 'Scan to Open PokéDrop';
    const subtitle = style.cardSubtitle.trim() || 'Shared link & files via PokéQR Studio';

    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${Math.round(cardWidth * 0.036)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(headline.slice(0, 42), cardWidth / 2, footerTop);

    ctx.fillStyle = '#475569';
    ctx.font = `500 ${Math.round(cardWidth * 0.024)}px system-ui, -apple-system, sans-serif`;
    ctx.fillText(subtitle.slice(0, 62), cardWidth / 2, footerTop + Math.round(cardWidth * 0.048));

    ctx.strokeStyle = palette.badgeBg;
    ctx.lineWidth = Math.max(2, cardWidth * 0.004);
    roundRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, qrBoxSize * 0.03);
    ctx.stroke();
  }

  return {
    moduleCount,
    qrRegion: {
      x: qrBoxX,
      y: qrBoxY,
      width: qrBoxSize,
      height: qrBoxSize
    }
  };
}

export function exportCanvasAsSvg(canvas: HTMLCanvasElement, payloadLabel: string): string {
  const dataUrl = canvas.toDataURL('image/png');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}" width="${canvas.width}" height="${canvas.height}" role="img" aria-label="Pokémon QR Code">
  <title>${payloadLabel.replace(/[<>&"']/g, '')}</title>
  <image href="${dataUrl}" width="${canvas.width}" height="${canvas.height}"/>
</svg>`;
}

export function renderVectorQrSvg(
  payload: string,
  style: QrStyleConfig,
  pokemon: SelectedPokemon | null,
  pokemonImageDataUrl: string | null,
  size = 800
): string {
  const effectiveEc = style.mode === 'classic' ? style.ecLevel : 'H';
  const matrix = buildQrMatrix(payload, effectiveEc);
  const N = matrix.size;
  const quiet = style.quietZoneModules;
  const total = N + quiet * 2;
  const mod = size / total;
  const origin = quiet * mod;
  const palette = getPaletteForTypes(pokemon?.types || []);
  const badgePx = size * style.badgeSizeRatio;
  const badgeRadiusMods = style.mode === 'badge' ? (badgePx / mod) * 0.52 : -1;

  const esc = (s: string) =>
    s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] || c));
  const shapes: string[] = [];

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (isFinderModule(r, c, N)) continue;
      if (badgeRadiusMods > 0 && isInCenterBadge(r, c, N, badgeRadiusMods)) continue;
      if (matrix.data[r * N + c] !== 1) continue;
      const x = (origin + c * mod).toFixed(2);
      const y = (origin + r * mod).toFixed(2);
      if (style.moduleShape === 'dots') {
        const cx = (origin + (c + 0.5) * mod).toFixed(2);
        const cy = (origin + (r + 0.5) * mod).toFixed(2);
        shapes.push(`<circle cx="${cx}" cy="${cy}" r="${(mod * 0.43).toFixed(2)}"/>`);
      } else if (style.moduleShape === 'rounded' || style.moduleShape === 'liquid') {
        const pad = mod * 0.06;
        const w = (mod - pad * 2).toFixed(2);
        const rx = (mod * 0.28).toFixed(2);
        shapes.push(
          `<rect x="${(origin + c * mod + pad).toFixed(2)}" y="${(origin + r * mod + pad).toFixed(2)}" width="${w}" height="${w}" rx="${rx}"/>`
        );
      } else {
        shapes.push(`<rect x="${x}" y="${y}" width="${(mod + 0.15).toFixed(2)}" height="${(mod + 0.15).toFixed(2)}"/>`);
      }
    }
  }

  const eyeSvg = (ex: number, ey: number) => {
    const s = mod * 7;
    const rxOuter = style.eyeShape === 'square' ? 0 : mod * 1.8;
    const rxInner = style.eyeShape === 'square' ? 0 : mod * 1.2;
    const rxCore = style.eyeShape === 'square' ? 0 : mod * 0.8;
    return `
    <rect x="${ex.toFixed(2)}" y="${ey.toFixed(2)}" width="${s.toFixed(2)}" height="${s.toFixed(2)}" rx="${rxOuter.toFixed(2)}" fill="${esc(style.eyeColor)}"/>
    <rect x="${(ex + mod).toFixed(2)}" y="${(ey + mod).toFixed(2)}" width="${(mod * 5).toFixed(2)}" height="${(mod * 5).toFixed(2)}" rx="${rxInner.toFixed(2)}" fill="${esc(style.bgColor)}"/>
    <rect x="${(ex + mod * 2).toFixed(2)}" y="${(ey + mod * 2).toFixed(2)}" width="${(mod * 3).toFixed(2)}" height="${(mod * 3).toFixed(2)}" rx="${rxCore.toFixed(2)}" fill="${esc(style.eyeColor)}"/>`;
  };

  let centerSvg = '';
  if (style.mode === 'badge') {
    const cx = size / 2;
    const half = badgePx / 2;
    const innerR = half * 0.84;
    centerSvg = `
    <circle cx="${cx}" cy="${cx}" r="${half.toFixed(2)}" fill="${esc(style.bgColor)}"/>
    <circle cx="${cx}" cy="${cx}" r="${innerR.toFixed(2)}" fill="${esc(palette.badgeBg)}" stroke="${esc(style.eyeColor)}" stroke-width="${Math.max(2, badgePx * 0.025).toFixed(2)}"/>
    ${
      pokemonImageDataUrl
        ? `<image href="${pokemonImageDataUrl}" x="${(cx - innerR * 0.88).toFixed(2)}" y="${(cx - innerR * 0.88).toFixed(2)}" width="${(innerR * 1.76).toFixed(2)}" height="${(innerR * 1.76).toFixed(2)}"/>`
        : ''
    }`;
  }

  const fillRef = style.useGradient ? 'url(#pokeQrGrad)' : esc(style.fgColor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="pokeQrGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${esc(style.fgColor)}"/>
      <stop offset="100%" stop-color="${esc(style.fgSecondaryColor)}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="${esc(style.bgColor)}"/>
  <g fill="${fillRef}">${shapes.join('')}</g>
  ${eyeSvg(origin, origin)}
  ${eyeSvg(origin + (N - 7) * mod, origin)}
  ${eyeSvg(origin, origin + (N - 7) * mod)}
  ${centerSvg}
</svg>`;
}
