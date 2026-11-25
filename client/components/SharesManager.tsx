import { useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  FileArchive,
  Link2,
  Lock,
  QrCode,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { getSpriteUrl } from '../data/pokemonThemes.ts';
import type { PublicShareInfo } from '../types.ts';

interface SharesManagerProps {
  shares: PublicShareInfo[];
  loading: boolean;
  shareBaseUrl: string;
  onRefresh: () => void;
  onLoadInStudio: (share: PublicShareInfo) => void;
  onDeleteShare: (id: string) => Promise<void>;
}

export function SharesManager({
  shares,
  loading,
  shareBaseUrl,
  onRefresh,
  onLoadInStudio,
  onDeleteShare
}: SharesManagerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const base = shareBaseUrl.replace(/\/+$/, '');

  async function copyUrl(id: string) {
    try {
      await navigator.clipboard.writeText(`${base}/s/${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1600);
    } catch {
      // Ignore clipboard failures
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteShare(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="shares-manager">
      <div className="shares-header">
        <div>
          <h2>Trainer PC Box — Active Shares</h2>
          <p>Manage hosted file drops, link bundles, view counts, or load any share back into the Pokémon QR Studio.</p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={onRefresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {shares.length === 0 ? (
        <div className="empty-box">
          <FileArchive size={36} />
          <h3>Your PC Box is empty</h3>
          <p>Upload a file or create a hosted PokéDrop link in the QR Studio to see it listed here.</p>
        </div>
      ) : (
        <div className="shares-list">
          {shares.map((share) => {
            const url = `${base}/s/${share.id}`;
            const pokeImg = share.pokemon
              ? getSpriteUrl(
                  share.pokemon.id,
                  share.pokemon.artworkStyle || 'official',
                  Boolean(share.pokemon.shiny),
                  share.pokemon.types?.[0]
                )
              : getSpriteUrl(25, 'official', false, 'electric');

            return (
              <article key={share.id} className="share-row-card">
                <img src={pokeImg} alt={share.pokemon?.displayName || 'Pokémon'} className="share-row-sprite" />

                <div className="share-row-body">
                  <div className="share-row-title">
                    <h3>{share.title}</h3>
                    <span className={`kind-badge kind-${share.kind}`}>{share.kind}</span>
                    {share.hasPin && (
                      <span className="pin-badge" title="Passcode protected">
                        <Lock size={12} /> PIN
                      </span>
                    )}
                  </div>
                  <div className="share-row-url">
                    <code>{url}</code>
                  </div>
                  <div className="share-row-stats">
                    <span>
                      <FileArchive size={13} /> {share.filesCount} file{share.filesCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      <Link2 size={13} /> {share.linksCount} link{share.linksCount === 1 ? '' : 's'}
                    </span>
                    <span>
                      <Eye size={13} /> {share.views} views · {share.downloads} downloads
                    </span>
                    <span>
                      {share.expiresAt
                        ? `Expires ${new Date(share.expiresAt).toLocaleString()}`
                        : 'No expiry'}
                    </span>
                  </div>
                </div>

                <div className="share-row-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onLoadInStudio(share)}
                  >
                    <QrCode size={15} />
                    <span>Make QR</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => copyUrl(share.id)}
                  >
                    {copiedId === share.id ? <Check size={15} /> : <Copy size={15} />}
                    <span>{copiedId === share.id ? 'Copied' : 'Copy'}</span>
                  </button>
                  <a
                    href={`/s/${share.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <ExternalLink size={15} />
                    <span>Open</span>
                  </a>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    disabled={deletingId === share.id}
                    onClick={() => handleDelete(share.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
