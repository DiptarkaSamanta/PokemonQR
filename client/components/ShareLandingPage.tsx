import { useEffect, useState, type FormEvent } from 'react';
import {
  Archive,
  ArrowLeft,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Link2,
  Lock
} from 'lucide-react';
import { getPaletteForTypes, getSpriteUrl } from '../data/pokemonThemes.ts';
import type { PublicFileInfo, PublicShareInfo } from '../types.ts';
import { formatBytes } from './PayloadPanel.tsx';

interface ShareLandingPageProps {
  shareId: string;
}

const PREVIEWABLE_IMAGE_MIMES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp'
]);

export function ShareLandingPage({ shareId }: ShareLandingPageProps) {
  const [share, setShare] = useState<PublicShareInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PublicFileInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}/public?trackView=1`);
        const data = (await res.json()) as { share?: PublicShareInfo; error?: string };
        if (!res.ok || !data.share) {
          throw new Error(data.error || 'Share not found or expired');
        }
        if (!cancelled) {
          setShare(data.share);
        }
      } catch (err) {
        if (!cancelled) setErrorMsg((err as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  async function handleUnlock(e: FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(shareId)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput })
      });
      const data = (await res.json()) as { token?: string; share?: PublicShareInfo; error?: string };
      if (!res.ok || !data.share || !data.token) {
        throw new Error(data.error || 'Incorrect passcode');
      }
      setToken(data.token);
      setShare(data.share);
    } catch (err) {
      setUnlockError((err as Error).message);
    }
  }

  function buildFileUrl(fileId: string, preview = false): string {
    const params = new URLSearchParams();
    if (preview) params.set('preview', '1');
    if (token) params.set('token', token);
    const qs = params.toString();
    return `/api/shares/${encodeURIComponent(shareId)}/files/${encodeURIComponent(fileId)}${qs ? `?${qs}` : ''}`;
  }

  function buildZipUrl(): string {
    const qs = token ? `?token=${encodeURIComponent(token)}` : '';
    return `/api/shares/${encodeURIComponent(shareId)}/zip${qs}`;
  }

  if (loading) {
    return (
      <main className="landing-shell">
        <div className="landing-card loading-state">
          <div className="pokeball-logo spinning" />
          <p>Opening PokéDrop transfer...</p>
        </div>
      </main>
    );
  }

  if (errorMsg || !share) {
    return (
      <main className="landing-shell">
        <div className="landing-card error-state">
          <h2>PokéDrop Unavailable</h2>
          <p>{errorMsg || 'This share does not exist or has expired.'}</p>
          <a href="/" className="btn btn-primary">
            <ArrowLeft size={16} />
            <span>Open PokéQR Studio</span>
          </a>
        </div>
      </main>
    );
  }

  const palette = getPaletteForTypes(share.pokemon?.types || []);
  const spriteUrl = share.pokemon
    ? getSpriteUrl(
        share.pokemon.id,
        share.pokemon.artworkStyle || 'official',
        Boolean(share.pokemon.shiny),
        share.pokemon.types?.[0]
      )
    : getSpriteUrl(25, 'official', false, 'electric');

  return (
    <main className="landing-shell" style={{ background: `linear-gradient(160deg, ${palette.badgeBg} 0%, #f8fafc 55%)` }}>
      <article className="landing-card">
        <header className="landing-hero" style={{ background: palette.badgeBg }}>
          <img src={spriteUrl} alt={share.pokemon?.displayName || 'Pokémon'} className="landing-sprite" />
          <div>
            <span className="landing-eyebrow">
              {share.pokemon
                ? `${share.pokemon.displayName} #${String(share.pokemon.id).padStart(3, '0')} delivered a PokéDrop`
                : 'PokéDrop Share'}
            </span>
            <h1>{share.title}</h1>
            <div className="landing-meta">
              <span>Created {new Date(share.createdAt).toLocaleDateString()}</span>
              {share.expiresAt && <span>· Expires {new Date(share.expiresAt).toLocaleString()}</span>}
            </div>
          </div>
        </header>

        {!share.unlocked && share.hasPin ? (
          <form className="pin-unlock-form" onSubmit={handleUnlock}>
            <div className="pin-lock-icon">
              <Lock size={26} />
            </div>
            <h2>Passcode Required</h2>
            <p>Enter the trainer passcode to view and download this PokéDrop.</p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="Enter passcode..."
              autoFocus
            />
            {unlockError && <div className="alert-error">{unlockError}</div>}
            <button type="submit" className="btn btn-primary btn-block">
              Unlock Files &amp; Links
            </button>
          </form>
        ) : (
          <div className="landing-content">
            {share.note && <blockquote className="trainer-note">{share.note}</blockquote>}

            {share.links && share.links.length > 0 && (
              <section className="landing-section">
                <h2>
                  <Link2 size={17} /> Shared Links ({share.links.length})
                </h2>
                <div className="shared-links-grid">
                  {share.links.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shared-link-card"
                    >
                      <div>
                        <strong>{link.label}</strong>
                        <span>{link.url}</span>
                      </div>
                      <ExternalLink size={17} />
                    </a>
                  ))}
                </div>
              </section>
            )}

            {share.files && share.files.length > 0 && (
              <section className="landing-section">
                <div className="landing-section-head">
                  <h2>
                    <FileText size={17} /> Shared Files ({share.files.length})
                  </h2>
                  {share.files.length > 1 && (
                    <a href={buildZipUrl()} className="btn btn-primary btn-sm">
                      <Archive size={15} />
                      <span>Download All (.zip)</span>
                    </a>
                  )}
                </div>

                <div className="shared-files-list">
                  {share.files.map((file) => {
                    const canPreviewImage = PREVIEWABLE_IMAGE_MIMES.has(file.mimeType.toLowerCase());
                    const canPreviewMedia =
                      canPreviewImage ||
                      file.mimeType.startsWith('audio/') ||
                      file.mimeType.startsWith('video/') ||
                      file.mimeType === 'application/pdf' ||
                      file.mimeType === 'text/plain';

                    return (
                      <div key={file.id} className="shared-file-row">
                        <div className="shared-file-meta">
                          {canPreviewImage ? (
                            <img
                              src={buildFileUrl(file.id, true)}
                              alt={file.originalName}
                              className="file-thumb"
                            />
                          ) : (
                            <div className="file-icon-box">
                              <FileText size={20} />
                            </div>
                          )}
                          <div>
                            <strong>{file.originalName}</strong>
                            <span>
                              {formatBytes(file.size)} · {file.mimeType}
                            </span>
                          </div>
                        </div>

                        <div className="shared-file-actions">
                          {canPreviewMedia && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => setPreviewFile(previewFile?.id === file.id ? null : file)}
                            >
                              <Eye size={15} />
                              <span>{previewFile?.id === file.id ? 'Hide' : 'Preview'}</span>
                            </button>
                          )}
                          <a href={buildFileUrl(file.id, false)} className="btn btn-primary btn-sm">
                            <Download size={15} />
                            <span>Download</span>
                          </a>
                        </div>

                        {previewFile?.id === file.id && (
                          <div className="inline-preview-box">
                            {canPreviewImage && (
                              <img src={buildFileUrl(file.id, true)} alt={file.originalName} />
                            )}
                            {file.mimeType.startsWith('audio/') && (
                              <audio controls src={buildFileUrl(file.id, true)} />
                            )}
                            {file.mimeType.startsWith('video/') && (
                              <video controls src={buildFileUrl(file.id, true)} />
                            )}
                            {(file.mimeType === 'application/pdf' || file.mimeType === 'text/plain') && (
                              <iframe
                                src={buildFileUrl(file.id, true)}
                                title={file.originalName}
                                className="preview-frame"
                              />
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}

        <footer className="landing-footer">
          <a href="/">Create your own Pokémon QR in PokéQR Studio →</a>
        </footer>
      </article>
    </main>
  );
}
