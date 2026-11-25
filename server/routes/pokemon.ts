import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import type { ServerConfig } from '../config.js';
import {
  FALLBACK_POKEMON,
  generateFallbackPokemonSvg,
  type PokemonCatalogEntry
} from '../data/fallbackPokemon.js';

interface IndexEntry {
  id: number;
  name: string;
  displayName: string;
}

function formatDisplayName(slug: string): string {
  return slug
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function parseIdFromPokeApiUrl(url: string): number | null {
  const match = url.match(/\/pokemon\/(\d+)\/?$/);
  return match ? Number(match[1]) : null;
}

export function createPokemonRouter(config: ServerConfig): Router {
  const router = Router();
  const detailCache = new Map<string, PokemonCatalogEntry>();
  let indexCache: IndexEntry[] | null = null;
  let indexLoadPromise: Promise<IndexEntry[]> | null = null;

  for (const item of FALLBACK_POKEMON) {
    detailCache.set(String(item.id), item);
    detailCache.set(item.name.toLowerCase(), item);
  }

  async function loadPokemonIndex(): Promise<IndexEntry[]> {
    if (indexCache) return indexCache;
    if (indexLoadPromise) return indexLoadPromise;

    indexLoadPromise = (async () => {
      const cacheFile = path.join(config.cacheDir, 'pokemon-index.json');
      try {
        if (fs.existsSync(cacheFile)) {
          const stat = await fsp.stat(cacheFile);
          // Refresh cache if older than 7 days
          if (Date.now() - stat.mtimeMs < 7 * 24 * 60 * 60 * 1000) {
            const raw = await fsp.readFile(cacheFile, 'utf8');
            const parsed = JSON.parse(raw) as IndexEntry[];
            if (Array.isArray(parsed) && parsed.length > 0) {
              indexCache = parsed;
              return parsed;
            }
          }
        }
      } catch {
        // Ignore stale cache read issues
      }

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const resp = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1025', {
          signal: controller.signal
        });
        clearTimeout(timer);

        if (resp.ok) {
          const json = (await resp.json()) as { results?: Array<{ name: string; url: string }> };
          const entries: IndexEntry[] = [];
          for (const row of json.results || []) {
            const id = parseIdFromPokeApiUrl(row.url);
            if (!id) continue;
            entries.push({
              id,
              name: row.name,
              displayName: formatDisplayName(row.name)
            });
          }
          if (entries.length > 0) {
            indexCache = entries;
            await fsp.mkdir(config.cacheDir, { recursive: true });
            await fsp.writeFile(cacheFile, JSON.stringify(entries), 'utf8').catch(() => {});
            return entries;
          }
        }
      } catch {
        // Offline or network blocked; fall back gracefully
      }

      const fallback = FALLBACK_POKEMON.map(({ id, name, displayName }) => ({
        id,
        name,
        displayName
      }));
      indexCache = fallback;
      return fallback;
    })();

    try {
      return await indexLoadPromise;
    } finally {
      indexLoadPromise = null;
    }
  }

  async function fetchPokemonDetail(idOrName: string): Promise<PokemonCatalogEntry | null> {
    const key = idOrName.trim().toLowerCase();
    if (!key || !/^[a-z0-9-]+$/.test(key)) return null;

    const cached = detailCache.get(key);
    if (cached) return cached;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const resp = await fetch(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(key)}`, {
        signal: controller.signal
      });
      clearTimeout(timer);

      if (resp.ok) {
        const json = (await resp.json()) as {
          id: number;
          name: string;
          types?: Array<{ type: { name: string } }>;
        };
        const entry: PokemonCatalogEntry = {
          id: json.id,
          name: json.name,
          displayName: formatDisplayName(json.name),
          types: (json.types || []).map((t) => t.type.name)
        };
        detailCache.set(String(entry.id), entry);
        detailCache.set(entry.name.toLowerCase(), entry);
        return entry;
      }
    } catch {
      // Fallback below
    }

    const numericId = Number(key);
    if (Number.isInteger(numericId) && numericId > 0 && numericId <= 2000) {
      return {
        id: numericId,
        name: `pokemon-${numericId}`,
        displayName: `Pokémon #${numericId}`,
        types: ['normal']
      };
    }
    return null;
  }

  router.get('/', async (req, res) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    const offset = Math.max(0, Number(req.query.offset) || 0);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 48));

    const all = await loadPokemonIndex();
    const fallbackById = new Map(FALLBACK_POKEMON.map((p) => [p.id, p]));

    let filtered = all;
    if (q) {
      const qNum = q.replace(/^#/, '');
      filtered = all.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.displayName.toLowerCase().includes(q) ||
          String(p.id) === qNum ||
          String(p.id).padStart(3, '0').includes(qNum)
      );
    }

    const slice = filtered.slice(offset, offset + limit).map((item) => {
      const known = detailCache.get(String(item.id)) || fallbackById.get(item.id);
      return {
        id: item.id,
        name: item.name,
        displayName: item.displayName,
        types: known?.types ?? []
      };
    });

    res.json({
      total: filtered.length,
      offset,
      limit,
      results: slice
    });
  });

  router.get('/featured', (_req, res) => {
    res.json({ results: FALLBACK_POKEMON });
  });

  router.get('/:id/sprite', async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0 || id > 5000) {
      res.status(400).json({ error: 'Invalid Pokémon ID' });
      return;
    }

    const style = req.query.style === 'pixel' || req.query.style === 'home' ? req.query.style : 'official';
    const shiny = req.query.shiny === '1' || req.query.shiny === 'true';
    const typeHint = typeof req.query.type === 'string' ? req.query.type : undefined;

    await fsp.mkdir(config.spritesCacheDir, { recursive: true });
    const cacheFile = path.join(config.spritesCacheDir, `${id}-${style}-${shiny ? 'shiny' : 'std'}.png`);

    if (fs.existsSync(cacheFile)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      res.sendFile(path.resolve(cacheFile));
      return;
    }

    const shinySeg = shiny ? 'shiny/' : '';
    let remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${shinySeg}${id}.png`;
    if (style === 'home') {
      remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/${shinySeg}${id}.png`;
    } else if (style === 'pixel') {
      remoteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${shinySeg}${id}.png`;
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const resp = await fetch(remoteUrl, { signal: controller.signal });
      clearTimeout(timer);

      if (resp.ok) {
        const arrayBuf = await resp.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        if (buf.length > 0) {
          await fsp.writeFile(cacheFile, buf).catch(() => {});
          res.setHeader('Content-Type', resp.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800');
          res.send(buf);
          return;
        }
      }
    } catch {
      // Fall through to SVG fallback
    }

    const known = detailCache.get(String(id)) || FALLBACK_POKEMON.find((p) => p.id === id);
    const svg = generateFallbackPokemonSvg(id, known?.displayName, typeHint || known?.types[0]);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(svg);
  });

  router.get('/:idOrName', async (req, res) => {
    const detail = await fetchPokemonDetail(req.params.idOrName);
    if (!detail) {
      res.status(404).json({ error: 'Pokémon not found' });
      return;
    }
    res.json(detail);
  });

  return router;
}
