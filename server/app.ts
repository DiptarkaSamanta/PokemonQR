import express, { type Express } from 'express';
import { createConfig, type ServerConfig } from './config.js';
import { createNetworkRouter } from './routes/network.js';
import { createPokemonRouter } from './routes/pokemon.js';
import { createSharesRouter } from './routes/shares.js';
import { ShareStore } from './store/shareStore.js';

export interface AppContext {
  app: Express;
  store: ShareStore;
  config: ServerConfig;
}

export async function createServerApp(configOverrides: Partial<ServerConfig> = {}): Promise<AppContext> {
  const config = createConfig(configOverrides);
  const store = new ShareStore(config);
  await store.init();

  const app = express();

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'pokemon-qr-studio' });
  });

  app.use('/api/network', createNetworkRouter(config));
  app.use('/api/pokemon', createPokemonRouter(config));
  app.use('/api/shares', createSharesRouter(store, config));

  // Direct redirect shortcut for single-link unpinned shares configured for instant redirect
  app.get('/s/:id', async (req, res, next) => {
    const share = await store.get(req.params.id);
    if (
      share &&
      share.directRedirect &&
      !share.pinHash &&
      share.kind === 'link' &&
      share.links.length === 1 &&
      !store.isDownloadLimitReached(share)
    ) {
      await store.incrementViews(share.id);
      res.redirect(302, share.links[0].url);
      return;
    }
    next();
  });

  return { app, store, config };
}
