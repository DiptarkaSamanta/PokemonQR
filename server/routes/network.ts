import { Router } from 'express';
import { getLanAddresses, type ServerConfig } from '../config.js';

export function createNetworkRouter(config: ServerConfig): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const port = Number(req.socket.localPort || config.port);
    const lanOptions = getLanAddresses(port);
    const protocol = req.protocol || 'http';
    const hostHeader = req.get('host') || `localhost:${port}`;
    const requestOrigin = `${protocol}://${hostHeader}`;
    const recommendedLan = lanOptions.find((item) => item.isPrimary)?.url || lanOptions[0]?.url || requestOrigin;

    res.json({
      requestOrigin,
      recommendedShareBase: recommendedLan,
      lanAddresses: lanOptions,
      port
    });
  });

  return router;
}
