import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import archiver from 'archiver';
import express, { type NextFunction, type Request, type Response, Router } from 'express';
import multer from 'multer';
import type { ServerConfig } from '../config.js';
import {
  generateShareId,
  hashPin,
  isValidSlug,
  type ShareKind,
  type SharePokemonMeta,
  type ShareRecord,
  ShareStore,
  type SharedFileItem,
  type SharedLinkItem
} from '../store/shareStore.js';

const EXPIRY_MS: Record<string, number | null> = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
  never: null
};

// Safe inline preview types (excludes HTML/SVG/JS/XML to prevent stored XSS on same origin)
const SAFE_PREVIEW_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'video/mp4',
  'video/webm',
  'text/plain',
  'application/json'
]);

function normalizeLinkUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeOriginalFilename(name: string): string {
  const base = path.basename(name || 'file').replace(/[\r\n\0]/g, '');
  return base.slice(0, 180) || 'file';
}

function extractAuthCredentials(req: Request): { pin: string | null; token: string | null } {
  const pinHeader = req.get('x-share-pin');
  const tokenHeader = req.get('x-share-token');
  const pinQuery = typeof req.query.pin === 'string' ? req.query.pin : null;
  const tokenQuery = typeof req.query.token === 'string' ? req.query.token : null;
  return {
    pin: pinHeader || pinQuery || null,
    token: tokenHeader || tokenQuery || null
  };
}

function parseJsonField<T>(val: unknown, fallback: T): T {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return fallback;
    }
  }
  return val as T;
}

export function createSharesRouter(store: ShareStore, config: ServerConfig): Router {
  const router = Router();

  const storage = multer.diskStorage({
    destination: async (_req, _file, cb) => {
      try {
        await fsp.mkdir(config.uploadsDir, { recursive: true });
        cb(null, config.uploadsDir);
      } catch (err) {
        cb(err as Error, config.uploadsDir);
      }
    },
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 16);
      cb(null, `${crypto.randomUUID()}${safeExt}`);
    }
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: config.maxFileSizeBytes,
      files: config.maxFilesPerShare
    }
  });

  function maybeMultipart(req: Request, res: Response, next: NextFunction): void {
    if (req.is('multipart/form-data')) {
      upload.array('files', config.maxFilesPerShare)(req, res, (err) => {
        if (err) {
          if (err instanceof multer.MulterError) {
            const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
            res.status(status).json({ error: err.message });
            return;
          }
          res.status(400).json({ error: 'File upload failed' });
          return;
        }
        next();
      });
    } else {
      next();
    }
  }

  async function cleanupUploadedFiles(files: Express.Multer.File[] | undefined): Promise<void> {
    if (!files?.length) return;
    await Promise.all(files.map((f) => fsp.unlink(f.path).catch(() => {})));
  }

  // List active shares (metadata sanitized)
  router.get('/', async (_req, res) => {
    const shares = await store.list();
    res.json({
      shares: shares.map((s) => store.toPublicInfo(s, false))
    });
  });

  // Create a link, file, or bundle share
  router.post('/', maybeMultipart, express.json({ limit: '1mb' }), async (req, res) => {
    const uploaded = (req.files as Express.Multer.File[] | undefined) || [];

    try {
      const body = (req.body || {}) as Record<string, unknown>;
      const rawTitle = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
      const rawNote = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : '';
      const rawCustomSlug = typeof body.customSlug === 'string' ? body.customSlug.trim() : '';
      const rawPin = typeof body.pin === 'string' ? body.pin.trim() : '';
      const rawExpiresIn = typeof body.expiresIn === 'string' ? body.expiresIn.trim() : '7d';
      const directRedirect = body.directRedirect === true || body.directRedirect === 'true';

      let maxDownloads: number | null = null;
      if (body.maxDownloads !== undefined && body.maxDownloads !== null && body.maxDownloads !== '') {
        const parsed = Number(body.maxDownloads);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100000) {
          await cleanupUploadedFiles(uploaded);
          res.status(400).json({ error: 'maxDownloads must be an integer between 1 and 100000' });
          return;
        }
        maxDownloads = parsed;
      }

      if (rawPin && (rawPin.length < 3 || rawPin.length > 32)) {
        await cleanupUploadedFiles(uploaded);
        res.status(400).json({ error: 'Passcode must be between 3 and 32 characters' });
        return;
      }

      let shareId: string;
      if (rawCustomSlug) {
        if (!isValidSlug(rawCustomSlug)) {
          await cleanupUploadedFiles(uploaded);
          res.status(400).json({
            error: 'Custom slug must be 3-48 characters using letters, numbers, "-" or "_"'
          });
          return;
        }
        const existing = await store.get(rawCustomSlug);
        if (existing) {
          await cleanupUploadedFiles(uploaded);
          res.status(409).json({ error: `Slug "${rawCustomSlug}" is already in use` });
          return;
        }
        shareId = rawCustomSlug;
      } else {
        let candidate = generateShareId();
        while (await store.get(candidate)) {
          candidate = generateShareId();
        }
        shareId = candidate;
      }

      const rawLinks = parseJsonField<Array<{ label?: string; url?: string }>>(body.links, []);
      const links: SharedLinkItem[] = [];
      for (const item of Array.isArray(rawLinks) ? rawLinks : []) {
        if (!item || typeof item.url !== 'string' || !item.url.trim()) continue;
        const normalized = normalizeLinkUrl(item.url);
        if (!normalized) {
          await cleanupUploadedFiles(uploaded);
          res.status(400).json({ error: `Invalid link URL: "${item.url}". Only http/https URLs are supported.` });
          return;
        }
        links.push({
          id: crypto.randomUUID(),
          label: (item.label || '').trim().slice(0, 80) || new URL(normalized).hostname,
          url: normalized
        });
      }

      const files: SharedFileItem[] = uploaded.map((file) => ({
        id: crypto.randomUUID(),
        originalName: sanitizeOriginalFilename(file.originalname),
        storedName: path.basename(file.filename),
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size
      }));

      if (links.length === 0 && files.length === 0) {
        await cleanupUploadedFiles(uploaded);
        res.status(400).json({ error: 'Provide at least one link or file to share' });
        return;
      }

      const pokemonRaw = parseJsonField<SharePokemonMeta | null>(body.pokemon, null);
      let pokemon: SharePokemonMeta | null = null;
      if (pokemonRaw && typeof pokemonRaw.id === 'number' && typeof pokemonRaw.displayName === 'string') {
        pokemon = {
          id: pokemonRaw.id,
          name: String(pokemonRaw.name || '').slice(0, 60),
          displayName: pokemonRaw.displayName.slice(0, 60),
          types: Array.isArray(pokemonRaw.types) ? pokemonRaw.types.slice(0, 2).map(String) : [],
          shiny: Boolean(pokemonRaw.shiny),
          artworkStyle: pokemonRaw.artworkStyle
        };
      }

      let kind: ShareKind = 'bundle';
      if (files.length === 0 && links.length > 0) kind = 'link';
      else if (links.length === 0 && files.length > 0) kind = 'file';

      const expiryDuration = rawExpiresIn in EXPIRY_MS ? EXPIRY_MS[rawExpiresIn] : EXPIRY_MS['7d'];
      const expiresAt = expiryDuration ? new Date(Date.now() + expiryDuration).toISOString() : null;

      const defaultTitle =
        rawTitle ||
        (files.length === 1 && links.length === 0
          ? files[0].originalName
          : links.length === 1 && files.length === 0
            ? links[0].label
            : pokemon
              ? `${pokemon.displayName}'s PokéDrop`
              : 'PokéDrop Share');

      const record: ShareRecord = {
        id: shareId,
        kind,
        title: defaultTitle,
        note: rawNote,
        links,
        files,
        pokemon,
        pinHash: rawPin ? hashPin(rawPin) : null,
        directRedirect: Boolean(directRedirect && kind === 'link' && links.length === 1 && !rawPin),
        createdAt: new Date().toISOString(),
        expiresAt,
        maxDownloads,
        views: 0,
        downloads: 0
      };

      await store.create(record);

      res.status(201).json({
        share: store.toPublicInfo(record, true),
        sharePath: `/s/${record.id}`
      });
    } catch (err) {
      await cleanupUploadedFiles(uploaded);
      res.status(500).json({ error: (err as Error).message || 'Failed to create share' });
    }
  });

  // Public share view metadata (requires PIN or unlock token if protected)
  router.get('/:id/public', async (req, res) => {
    const share = await store.get(req.params.id);
    if (!share) {
      res.status(404).json({ error: 'Share not found or expired' });
      return;
    }

    if (store.isDownloadLimitReached(share)) {
      res.status(410).json({ error: 'Download limit reached for this share' });
      return;
    }

    const { pin, token } = extractAuthCredentials(req);
    const unlocked = store.isAuthorized(share, pin, token);

    if (req.query.trackView === '1') {
      await store.incrementViews(share.id);
    }

    res.json({
      share: store.toPublicInfo(share, unlocked)
    });
  });

  // Verify PIN and receive signed unlock token
  router.post('/:id/verify', express.json(), async (req, res) => {
    const share = await store.get(req.params.id);
    if (!share) {
      res.status(404).json({ error: 'Share not found or expired' });
      return;
    }

    if (store.isDownloadLimitReached(share)) {
      res.status(410).json({ error: 'Download limit reached for this share' });
      return;
    }

    const pin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!store.isAuthorized(share, pin, null)) {
      res.status(401).json({ error: 'Incorrect passcode' });
      return;
    }

    const token = store.signUnlockToken(share.id);
    res.json({
      token,
      share: store.toPublicInfo(share, true)
    });
  });

  // Download or safely preview a single file in a share
  router.get('/:id/files/:fileId', async (req, res) => {
    const share = await store.get(req.params.id);
    if (!share) {
      res.status(404).json({ error: 'Share not found or expired' });
      return;
    }

    if (store.isDownloadLimitReached(share)) {
      res.status(410).json({ error: 'Download limit reached for this share' });
      return;
    }

    const { pin, token } = extractAuthCredentials(req);
    if (!store.isAuthorized(share, pin, token)) {
      res.status(401).json({ error: 'Passcode required' });
      return;
    }

    const fileMeta = share.files.find((f) => f.id === req.params.fileId);
    if (!fileMeta) {
      res.status(404).json({ error: 'File not found in share' });
      return;
    }

    const diskPath = store.resolveStoredFilePath(fileMeta.storedName);
    if (!diskPath || !fs.existsSync(diskPath)) {
      res.status(404).json({ error: 'File missing on disk' });
      return;
    }

    const wantsPreview = req.query.preview === '1';
    const isSafePreviewMime = SAFE_PREVIEW_MIMES.has(fileMeta.mimeType.toLowerCase());

    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (wantsPreview && isSafePreviewMime) {
      res.setHeader('Content-Type', fileMeta.mimeType);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(fileMeta.originalName)}`);
      res.sendFile(diskPath);
      return;
    }

    await store.incrementDownloads(share.id);
    res.download(diskPath, fileMeta.originalName);
  });

  // Download all files in a share as a single ZIP bundle
  router.get('/:id/zip', async (req, res) => {
    const share = await store.get(req.params.id);
    if (!share) {
      res.status(404).json({ error: 'Share not found or expired' });
      return;
    }

    if (store.isDownloadLimitReached(share)) {
      res.status(410).json({ error: 'Download limit reached for this share' });
      return;
    }

    const { pin, token } = extractAuthCredentials(req);
    if (!store.isAuthorized(share, pin, token)) {
      res.status(401).json({ error: 'Passcode required' });
      return;
    }

    if (share.files.length === 0) {
      res.status(400).json({ error: 'This share has no files' });
      return;
    }

    await store.incrementDownloads(share.id);

    const safeZipName = `${share.title.replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 48) || share.id}.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeZipName)}`);

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', () => {
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to create ZIP archive' });
      } else {
        res.end();
      }
    });
    archive.pipe(res);

    const usedNames = new Map<string, number>();
    for (const file of share.files) {
      const diskPath = store.resolveStoredFilePath(file.storedName);
      if (!diskPath || !fs.existsSync(diskPath)) continue;
      const count = usedNames.get(file.originalName) || 0;
      usedNames.set(file.originalName, count + 1);
      const entryName =
        count === 0
          ? file.originalName
          : `${path.basename(file.originalName, path.extname(file.originalName))}-${count}${path.extname(file.originalName)}`;
      archive.file(diskPath, { name: entryName });
    }

    await archive.finalize();
  });

  // Delete a share and remove uploaded files
  router.delete('/:id', async (req, res) => {
    const deleted = await store.delete(req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }
    res.json({ deleted: true, id: req.params.id });
  });

  return router;
}
