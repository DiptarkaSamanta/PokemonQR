import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { ServerConfig } from '../config.js';

export type ShareKind = 'link' | 'file' | 'bundle';

export interface SharedLinkItem {
  id: string;
  label: string;
  url: string;
}

export interface SharedFileItem {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
}

export interface SharePokemonMeta {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  shiny?: boolean;
  artworkStyle?: 'official' | 'pixel' | 'home' | 'custom';
}

export interface ShareRecord {
  id: string;
  kind: ShareKind;
  title: string;
  note: string;
  links: SharedLinkItem[];
  files: SharedFileItem[];
  pokemon: SharePokemonMeta | null;
  pinHash: string | null;
  directRedirect: boolean;
  createdAt: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  views: number;
  downloads: number;
}

export interface PublicFileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface PublicShareInfo {
  id: string;
  kind: ShareKind;
  title: string;
  note: string;
  pokemon: SharePokemonMeta | null;
  hasPin: boolean;
  unlocked: boolean;
  directRedirect: boolean;
  createdAt: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  views: number;
  downloads: number;
  linksCount: number;
  filesCount: number;
  links?: SharedLinkItem[];
  files?: PublicFileInfo[];
}

export function hashPin(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPinHash(pin: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(pin, salt, 32);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function isValidSlug(id: string): boolean {
  return /^[a-zA-Z0-9_-]{3,48}$/.test(id);
}

export function generateShareId(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(7);
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

export class ShareStore {
  private readonly config: ServerConfig;
  private readonly tokenSecret: string;
  private shares: Map<string, ShareRecord> = new Map();
  private writeQueue: Promise<void> = Promise.resolve();
  private loaded = false;

  constructor(config: ServerConfig) {
    this.config = config;
    this.tokenSecret = process.env.POKEQR_TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
  }

  async init(): Promise<void> {
    if (this.loaded) return;
    await fsp.mkdir(this.config.dataDir, { recursive: true });
    await fsp.mkdir(this.config.uploadsDir, { recursive: true });
    await fsp.mkdir(this.config.spritesCacheDir, { recursive: true });

    if (fs.existsSync(this.config.sharesFile)) {
      try {
        const raw = await fsp.readFile(this.config.sharesFile, 'utf8');
        const parsed = JSON.parse(raw) as ShareRecord[];
        if (Array.isArray(parsed)) {
          for (const rec of parsed) {
            if (rec && typeof rec.id === 'string') {
              this.shares.set(rec.id, rec);
            }
          }
        }
      } catch {
        // Backup corrupt index instead of crashing startup
        const backupPath = `${this.config.sharesFile}.corrupt-${Date.now()}`;
        await fsp.rename(this.config.sharesFile, backupPath).catch(() => {});
      }
    }

    this.loaded = true;
    await this.purgeExpired();
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(Array.from(this.shares.values()), null, 2);
    this.writeQueue = this.writeQueue.then(async () => {
      await fsp.mkdir(this.config.dataDir, { recursive: true });
      const tmpPath = `${this.config.sharesFile}.${crypto.randomUUID()}.tmp`;
      await fsp.writeFile(tmpPath, snapshot, 'utf8');
      await fsp.rename(tmpPath, this.config.sharesFile);
    });
    return this.writeQueue;
  }

  private async removeFilesFromDisk(files: SharedFileItem[]): Promise<void> {
    for (const file of files) {
      const target = this.resolveStoredFilePath(file.storedName);
      if (target) {
        await fsp.unlink(target).catch(() => {});
      }
    }
  }

  resolveStoredFilePath(storedName: string): string | null {
    if (!storedName || storedName.includes('..') || storedName.includes('/') || storedName.includes('\\')) {
      return null;
    }
    const base = path.resolve(this.config.uploadsDir);
    const resolved = path.resolve(base, storedName);
    if (!resolved.startsWith(base + path.sep)) {
      return null;
    }
    return resolved;
  }

  async purgeExpired(): Promise<number> {
    await this.init();
    const now = Date.now();
    let removed = 0;
    for (const [id, share] of this.shares.entries()) {
      if (share.expiresAt && new Date(share.expiresAt).getTime() <= now) {
        this.shares.delete(id);
        await this.removeFilesFromDisk(share.files);
        removed++;
      }
    }
    if (removed > 0) {
      await this.persist();
    }
    return removed;
  }

  isExpired(share: ShareRecord): boolean {
    return Boolean(share.expiresAt && new Date(share.expiresAt).getTime() <= Date.now());
  }

  isDownloadLimitReached(share: ShareRecord): boolean {
    return share.maxDownloads !== null && share.downloads >= share.maxDownloads;
  }

  async create(record: ShareRecord): Promise<ShareRecord> {
    await this.init();
    this.shares.set(record.id, record);
    await this.persist();
    return record;
  }

  async get(id: string): Promise<ShareRecord | null> {
    await this.init();
    const record = this.shares.get(id);
    if (!record) return null;
    if (this.isExpired(record)) {
      this.shares.delete(id);
      await this.removeFilesFromDisk(record.files);
      await this.persist();
      return null;
    }
    return record;
  }

  async list(): Promise<ShareRecord[]> {
    await this.purgeExpired();
    return Array.from(this.shares.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async incrementViews(id: string): Promise<void> {
    const share = await this.get(id);
    if (!share) return;
    share.views += 1;
    await this.persist();
  }

  async incrementDownloads(id: string): Promise<void> {
    const share = await this.get(id);
    if (!share) return;
    share.downloads += 1;
    await this.persist();
  }

  async delete(id: string): Promise<boolean> {
    await this.init();
    const record = this.shares.get(id);
    if (!record) return false;
    this.shares.delete(id);
    await this.removeFilesFromDisk(record.files);
    await this.persist();
    return true;
  }

  signUnlockToken(shareId: string): string {
    const exp = Date.now() + 1000 * 60 * 60 * 12; // 12h unlock token
    const payload = `${shareId}.${exp}`;
    const sig = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
    return `${exp}.${sig}`;
  }

  verifyUnlockToken(shareId: string, token: string): boolean {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [expStr, sigHex] = parts;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Date.now()) return false;
    const payload = `${shareId}.${exp}`;
    const expectedHex = crypto.createHmac('sha256', this.tokenSecret).update(payload).digest('hex');
    const a = Buffer.from(sigHex, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }

  isAuthorized(share: ShareRecord, pin?: string | null, token?: string | null): boolean {
    if (!share.pinHash) return true;
    if (token && this.verifyUnlockToken(share.id, token)) return true;
    if (pin && verifyPinHash(pin, share.pinHash)) return true;
    return false;
  }

  toPublicInfo(share: ShareRecord, unlocked: boolean): PublicShareInfo {
    const base: PublicShareInfo = {
      id: share.id,
      kind: share.kind,
      title: share.title,
      note: unlocked ? share.note : '',
      pokemon: share.pokemon,
      hasPin: Boolean(share.pinHash),
      unlocked,
      directRedirect: share.directRedirect,
      createdAt: share.createdAt,
      expiresAt: share.expiresAt,
      maxDownloads: share.maxDownloads,
      views: share.views,
      downloads: share.downloads,
      linksCount: share.links.length,
      filesCount: share.files.length
    };

    if (unlocked) {
      base.links = share.links;
      base.files = share.files.map((f) => ({
        id: f.id,
        originalName: f.originalName,
        mimeType: f.mimeType,
        size: f.size
      }));
    }

    return base;
  }
}
