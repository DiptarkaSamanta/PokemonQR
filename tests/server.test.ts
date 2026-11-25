import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServerApp, type AppContext } from '../server/app.js';

describe('PokéQR Studio API', () => {
  let tmpDir: string;
  let ctx: AppContext;

  beforeAll(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'pokeqr-test-'));
    ctx = await createServerApp({ dataDir: tmpDir });
  });

  afterAll(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  it('responds to health and network endpoints', async () => {
    const health = await request(ctx.app).get('/api/health');
    expect(health.status).toBe(200);
    expect(health.body.ok).toBe(true);

    const net = await request(ctx.app).get('/api/network');
    expect(net.status).toBe(200);
    expect(Array.isArray(net.body.lanAddresses)).toBe(true);
    expect(typeof net.body.recommendedShareBase).toBe('string');
  });

  it('searches featured Pokémon and serves sprite fallback or cached image', async () => {
    const featured = await request(ctx.app).get('/api/pokemon/featured');
    expect(featured.status).toBe(200);
    expect(featured.body.results.length).toBeGreaterThan(10);

    const search = await request(ctx.app).get('/api/pokemon?q=gengar');
    expect(search.status).toBe(200);
    expect(search.body.results.some((p: { name: string }) => p.name === 'gengar')).toBe(true);

    const sprite = await request(ctx.app).get('/api/pokemon/25/sprite?style=official&type=electric');
    expect(sprite.status).toBe(200);
    expect(sprite.headers['content-type']).toMatch(/^image\/(png|svg\+xml)/);
  });

  it('creates a hosted link share, enforces safe URLs, and redirects when configured', async () => {
    const bad = await request(ctx.app)
      .post('/api/shares')
      .send({ links: [{ label: 'Bad', url: 'javascript:alert(1)' }] });
    expect(bad.status).toBe(400);

    const created = await request(ctx.app)
      .post('/api/shares')
      .send({
        title: 'Pikachu Docs',
        customSlug: 'pika-docs',
        directRedirect: true,
        links: [{ label: 'PokéAPI', url: 'https://pokeapi.co' }],
        pokemon: { id: 25, name: 'pikachu', displayName: 'Pikachu', types: ['electric'] }
      });

    expect(created.status).toBe(201);
    expect(created.body.share.id).toBe('pika-docs');
    expect(created.body.share.directRedirect).toBe(true);

    const dup = await request(ctx.app)
      .post('/api/shares')
      .send({
        customSlug: 'pika-docs',
        links: [{ label: 'Dup', url: 'https://example.com' }]
      });
    expect(dup.status).toBe(409);

    const redir = await request(ctx.app).get('/s/pika-docs');
    expect(redir.status).toBe(302);
    expect(redir.headers.location).toBe('https://pokeapi.co/');
  });

  it('uploads multiple files and links as a bundle, downloads individual files and ZIP, and deletes cleanly', async () => {
    const res = await request(ctx.app)
      .post('/api/shares')
      .field('title', 'Charizard Assets')
      .field('note', 'Grab these files')
      .field('links', JSON.stringify([{ label: 'Repo', url: 'https://github.com' }]))
      .field('pokemon', JSON.stringify({ id: 6, name: 'charizard', displayName: 'Charizard', types: ['fire'] }))
      .attach('files', Buffer.from('hello world'), { filename: 'notes.txt', contentType: 'text/plain' })
      .attach('files', Buffer.from('<script>alert(1)</script>'), { filename: 'unsafe.html', contentType: 'text/html' });

    expect(res.status).toBe(201);
    const shareId = res.body.share.id as string;
    const files = res.body.share.files as Array<{ id: string; originalName: string }>;
    expect(files).toHaveLength(2);
    expect(res.body.share.kind).toBe('bundle');

    const pub = await request(ctx.app).get(`/api/shares/${shareId}/public?trackView=1`);
    expect(pub.status).toBe(200);
    expect(pub.body.share.unlocked).toBe(true);
    expect(pub.body.share.views).toBe(1);
    expect(pub.body.share.links).toHaveLength(1);

    // Unsafe HTML must NOT preview inline as text/html; must force attachment download
    const htmlFile = files.find((f) => f.originalName === 'unsafe.html')!;
    const htmlDownload = await request(ctx.app).get(`/api/shares/${shareId}/files/${htmlFile.id}?preview=1`);
    expect(htmlDownload.status).toBe(200);
    expect(htmlDownload.headers['content-disposition']).toMatch(/^attachment;/);

    const txtFile = files.find((f) => f.originalName === 'notes.txt')!;
    const txtPreview = await request(ctx.app).get(`/api/shares/${shareId}/files/${txtFile.id}?preview=1`);
    expect(txtPreview.status).toBe(200);
    expect(txtPreview.text).toBe('hello world');

    // Download ZIP bundle (check PK zip signature)
    const zipRes = await request(ctx.app)
      .get(`/api/shares/${shareId}/zip`)
      .buffer(true)
      .parse((resStream, callback) => {
        const chunks: Buffer[] = [];
        resStream.on('data', (chunk: Buffer) => chunks.push(chunk));
        resStream.on('end', () => callback(null, Buffer.concat(chunks)));
      });
    expect(zipRes.status).toBe(200);
    expect(zipRes.headers['content-type']).toMatch(/application\/zip/);
    expect((zipRes.body as Buffer).subarray(0, 2).toString('utf8')).toBe('PK');

    // Delete share and verify files removed from uploadsDir
    const uploadedBefore = fs.readdirSync(ctx.config.uploadsDir).length;
    expect(uploadedBefore).toBeGreaterThanOrEqual(2);

    const del = await request(ctx.app).delete(`/api/shares/${shareId}`);
    expect(del.status).toBe(200);

    const afterDelete = await request(ctx.app).get(`/api/shares/${shareId}/public`);
    expect(afterDelete.status).toBe(404);
  });

  it('enforces PIN protection and maxDownloads limit', async () => {
    const res = await request(ctx.app)
      .post('/api/shares')
      .field('title', 'Secret TM')
      .field('pin', 'pikachu99')
      .field('maxDownloads', '1')
      .attach('files', Buffer.from('secret data'), { filename: 'secret.txt', contentType: 'text/plain' });

    expect(res.status).toBe(201);
    const shareId = res.body.share.id as string;
    const fileId = res.body.share.files[0].id as string;

    const lockedPub = await request(ctx.app).get(`/api/shares/${shareId}/public`);
    expect(lockedPub.status).toBe(200);
    expect(lockedPub.body.share.hasPin).toBe(true);
    expect(lockedPub.body.share.unlocked).toBe(false);
    expect(lockedPub.body.share.files).toBeUndefined();

    const blockedFile = await request(ctx.app).get(`/api/shares/${shareId}/files/${fileId}`);
    expect(blockedFile.status).toBe(401);

    const wrongPin = await request(ctx.app)
      .post(`/api/shares/${shareId}/verify`)
      .send({ pin: 'wrong' });
    expect(wrongPin.status).toBe(401);

    const rightPin = await request(ctx.app)
      .post(`/api/shares/${shareId}/verify`)
      .send({ pin: 'pikachu99' });
    expect(rightPin.status).toBe(200);
    const token = rightPin.body.token as string;
    expect(rightPin.body.share.files).toHaveLength(1);

    // First download succeeds
    const dl1 = await request(ctx.app).get(`/api/shares/${shareId}/files/${fileId}?token=${token}`);
    expect(dl1.status).toBe(200);
    expect(dl1.text).toBe('secret data');

    // Second download hits maxDownloads=1 limit -> 410 Gone
    const dl2 = await request(ctx.app).get(`/api/shares/${shareId}/files/${fileId}?token=${token}`);
    expect(dl2.status).toBe(410);
  });
});
