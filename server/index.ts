import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { createServerApp } from './app.js';
import { getLanAddresses } from './config.js';

async function start(): Promise<void> {
  const { app, config, store } = await createServerApp();
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');

  // Periodically clean up expired shares every 5 minutes
  const purgeInterval = setInterval(() => {
    store.purgeExpired().catch(() => {});
  }, 5 * 60 * 1000);
  purgeInterval.unref();

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, host: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distClient = path.resolve(process.cwd(), 'dist', 'client');
    if (fs.existsSync(distClient)) {
      app.use(express.static(distClient));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distClient, 'index.html'));
      });
    }
  }

  app.listen(config.port, '0.0.0.0', () => {
    const lans = getLanAddresses(config.port);
    console.log(`\nPokéQR Studio running on:`);
    console.log(`  Local:   http://localhost:${config.port}`);
    for (const lan of lans) {
      console.log(`  Network: ${lan.url} (${lan.label})`);
    }
    console.log('');
  });
}

start().catch((err) => {
  console.error('Failed to start PokéQR Studio server:', err);
  process.exit(1);
});
