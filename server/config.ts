import os from 'node:os';
import path from 'node:path';

export interface ServerConfig {
  port: number;
  dataDir: string;
  uploadsDir: string;
  cacheDir: string;
  spritesCacheDir: string;
  sharesFile: string;
  maxFileSizeBytes: number;
  maxFilesPerShare: number;
}

export function createConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  const port = Number(process.env.PORT) || 3000;
  const dataDir = overrides.dataDir || process.env.POKEQR_DATA_DIR || path.resolve(process.cwd(), 'data');
  const uploadsDir = overrides.uploadsDir || path.join(dataDir, 'uploads');
  const cacheDir = overrides.cacheDir || path.join(dataDir, 'cache');
  const spritesCacheDir = overrides.spritesCacheDir || path.join(cacheDir, 'sprites');
  const sharesFile = overrides.sharesFile || path.join(dataDir, 'shares.json');

  return {
    port,
    dataDir,
    uploadsDir,
    cacheDir,
    spritesCacheDir,
    sharesFile,
    maxFileSizeBytes: overrides.maxFileSizeBytes ?? 100 * 1024 * 1024, // 100 MB per file
    maxFilesPerShare: overrides.maxFilesPerShare ?? 25
  };
}

export interface NetworkOption {
  label: string;
  address: string;
  url: string;
  isPrimary: boolean;
}

function isPrivateLanIp(ip: string): boolean {
  return (
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
  );
}

export function getLanAddresses(port: number): NetworkOption[] {
  const interfaces = os.networkInterfaces();
  const scored: Array<{ option: NetworkOption; score: number }> = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (addr.address.startsWith('169.254.')) continue;

      const lowerName = name.toLowerCase();
      const looksVirtual =
        lowerName.includes('vethernet') ||
        lowerName.includes('docker') ||
        lowerName.includes('wsl') ||
        lowerName.includes('virtual') ||
        lowerName.includes('vmware') ||
        lowerName.includes('vbox') ||
        addr.address.startsWith('192.168.56.');

      const looksWifi =
        lowerName.includes('wi-fi') ||
        lowerName.includes('wifi') ||
        lowerName.includes('wlan') ||
        lowerName.includes('wireless');

      let score = 0;
      if (isPrivateLanIp(addr.address)) score += 5;
      if (looksWifi) score += 10;
      if (looksVirtual) score -= 10;

      scored.push({
        score,
        option: {
          label: `${name} (${addr.address})`,
          address: addr.address,
          url: `http://${addr.address}:${port}`,
          isPrimary: isPrivateLanIp(addr.address) && !looksVirtual
        }
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.map((entry) => entry.option);
}
