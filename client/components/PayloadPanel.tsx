import { useRef, useState, type DragEvent } from 'react';
import {
  FileUp,
  FolderArchive,
  Link2,
  Lock,
  Plus,
  Send,
  Trash2,
  Zap
} from 'lucide-react';
import type { DraftLinkItem, PayloadMode, PublicShareInfo, SelectedPokemon } from '../types.ts';
import { estimateInlineByteCapacity } from '../utils/qrVerifier.ts';

interface PayloadPanelProps {
  mode: PayloadMode;
  onModeChange: (mode: PayloadMode) => void;
  directUrl: string;
  onDirectUrlChange: (val: string) => void;
  useHostedShortLink: boolean;
  onUseHostedShortLinkChange: (val: boolean) => void;
  directRedirect: boolean;
  onDirectRedirectChange: (val: boolean) => void;
  inlineText: string;
  onInlineTextChange: (val: string) => void;
  shareBaseUrl: string;
  pokemon: SelectedPokemon;
  activeShare: PublicShareInfo | null;
  onShareCreated: (share: PublicShareInfo, fullUrl: string) => void;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PayloadPanel({
  mode,
  onModeChange,
  directUrl,
  onDirectUrlChange,
  useHostedShortLink,
  onUseHostedShortLinkChange,
  directRedirect,
  onDirectRedirectChange,
  inlineText,
  onInlineTextChange,
  shareBaseUrl,
  pokemon,
  activeShare,
  onShareCreated
}: PayloadPanelProps) {
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [pin, setPin] = useState('');
  const [expiresIn, setExpiresIn] = useState('7d');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [bundleLinks, setBundleLinks] = useState<DraftLinkItem[]>([
    { id: crypto.randomUUID(), label: '', url: '' }
  ]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inlineFileInputRef = useRef<HTMLInputElement | null>(null);

  const inlineCapacity = estimateInlineByteCapacity('H');
  const inlineBytes = new TextEncoder().encode(inlineText).length;

  function addFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    const incoming = Array.from(fileList);
    setFiles((prev) => {
      const seen = new Set(prev.map((f) => `${f.name}:${f.size}`));
      const merged = [...prev];
      for (const f of incoming) {
        if (!seen.has(`${f.name}:${f.size}`)) {
          merged.push(f);
        }
      }
      return merged.slice(0, 25);
    });
    setErrorMsg(null);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function handleInlineTinyFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 900) {
      setErrorMsg(
        `File "${file.name}" is ${formatBytes(file.size)}, which is too large to embed directly inside QR pixels. Switch to the "Files" tab to host & share any size!`
      );
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onInlineTextChange(reader.result);
        setErrorMsg(null);
      }
    };
    reader.readAsDataURL(file);
  }

  async function submitHostedShare() {
    setErrorMsg(null);
    setSubmitting(true);
    setUploadProgress(files.length > 0 ? 0 : null);

    try {
      const linksPayload: Array<{ label: string; url: string }> = [];
      if (mode === 'link') {
        if (!directUrl.trim()) {
          throw new Error('Enter a link URL first.');
        }
        linksPayload.push({ label: title.trim() || '', url: directUrl.trim() });
      } else if (mode === 'bundle') {
        for (const item of bundleLinks) {
          if (item.url.trim()) {
            linksPayload.push({ label: item.label.trim(), url: item.url.trim() });
          }
        }
      }

      if (mode === 'file' && files.length === 0) {
        throw new Error('Select or drop at least one file to share.');
      }
      if (mode === 'bundle' && files.length === 0 && linksPayload.length === 0) {
        throw new Error('Add at least one link or file to create a bundle.');
      }

      const form = new FormData();
      if (title.trim()) form.append('title', title.trim());
      if (note.trim()) form.append('note', note.trim());
      if (customSlug.trim()) form.append('customSlug', customSlug.trim());
      if (pin.trim()) form.append('pin', pin.trim());
      form.append('expiresIn', expiresIn);
      if (maxDownloads.trim()) form.append('maxDownloads', maxDownloads.trim());
      form.append('directRedirect', String(mode === 'link' && directRedirect));
      form.append(
        'pokemon',
        JSON.stringify({
          id: pokemon.id,
          name: pokemon.name,
          displayName: pokemon.displayName,
          types: pokemon.types,
          shiny: pokemon.shiny,
          artworkStyle: pokemon.artworkStyle
        })
      );
      if (linksPayload.length > 0) {
        form.append('links', JSON.stringify(linksPayload));
      }
      for (const file of files) {
        form.append('files', file);
      }

      const result = await new Promise<{ share: PublicShareInfo; sharePath: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/shares');
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            setUploadProgress(Math.round((evt.loaded / evt.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(data);
            } else {
              reject(new Error(data.error || `Upload failed (${xhr.status})`));
            }
          } catch {
            reject(new Error(`Server error (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Network error while uploading share'));
        xhr.send(form);
      });

      const base = shareBaseUrl.replace(/\/+$/, '');
      onShareCreated(result.share, `${base}${result.sharePath}`);
      setFiles([]);
      setCustomSlug('');
      setPin('');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  return (
    <section className="studio-card">
      <div className="card-header">
        <div>
          <span className="step-badge">Step 1</span>
          <h2>Links &amp; Files Payload</h2>
        </div>
      </div>

      <div className="payload-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'link'}
          className={`payload-tab ${mode === 'link' ? 'active' : ''}`}
          onClick={() => {
            setErrorMsg(null);
            onModeChange('link');
          }}
        >
          <Link2 size={16} />
          <span>Share Link</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'file'}
          className={`payload-tab ${mode === 'file' ? 'active' : ''}`}
          onClick={() => {
            setErrorMsg(null);
            onModeChange('file');
          }}
        >
          <FileUp size={16} />
          <span>Share Files</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'bundle'}
          className={`payload-tab ${mode === 'bundle' ? 'active' : ''}`}
          onClick={() => {
            setErrorMsg(null);
            onModeChange('bundle');
          }}
        >
          <FolderArchive size={16} />
          <span>Link + File Box</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'inline'}
          className={`payload-tab ${mode === 'inline' ? 'active' : ''}`}
          onClick={() => {
            setErrorMsg(null);
            onModeChange('inline');
          }}
        >
          <Zap size={16} />
          <span>Tiny Offline</span>
        </button>
      </div>

      {mode === 'link' && (
        <div className="tab-body">
          <div className="field-group">
            <label className="field-label">Destination URL</label>
            <input
              type="url"
              value={directUrl}
              onChange={(e) => onDirectUrlChange(e.target.value)}
              placeholder="https://example.com/your-link"
            />
          </div>

          <label className="checkbox-inline strong-check">
            <input
              type="checkbox"
              checked={useHostedShortLink}
              onChange={(e) => onUseHostedShortLinkChange(e.target.checked)}
            />
            <span>Host as PokéDrop Short Link (enables scan counter, passcode, custom slug &amp; note)</span>
          </label>

          {useHostedShortLink && (
            <>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={directRedirect}
                  onChange={(e) => onDirectRedirectChange(e.target.checked)}
                />
                <span>Instant 302 redirect when scanned (skip landing card unless PIN-locked)</span>
              </label>
              <HostedOptionsFields
                title={title}
                onTitleChange={setTitle}
                note={note}
                onNoteChange={setNote}
                customSlug={customSlug}
                onCustomSlugChange={setCustomSlug}
                pin={pin}
                onPinChange={setPin}
                expiresIn={expiresIn}
                onExpiresInChange={setExpiresIn}
                maxDownloads={maxDownloads}
                onMaxDownloadsChange={setMaxDownloads}
              />
            </>
          )}
        </div>
      )}

      {(mode === 'file' || mode === 'bundle') && (
        <div className="tab-body">
          {mode === 'bundle' && (
            <div className="field-group">
              <div className="label-row">
                <label className="field-label">Links in this PokéDrop</label>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() =>
                    setBundleLinks((prev) => [...prev, { id: crypto.randomUUID(), label: '', url: '' }])
                  }
                >
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <div className="bundle-links-list">
                {bundleLinks.map((row, idx) => (
                  <div key={row.id} className="bundle-link-row">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) =>
                        setBundleLinks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, label: e.target.value } : item))
                        )
                      }
                      placeholder="Label (e.g. Slides)"
                    />
                    <input
                      type="url"
                      value={row.url}
                      onChange={(e) =>
                        setBundleLinks((prev) =>
                          prev.map((item, i) => (i === idx ? { ...item, url: e.target.value } : item))
                        )
                      }
                      placeholder="https://..."
                    />
                    {bundleLinks.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label="Remove link"
                        onClick={() => setBundleLinks((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
            <FileUp size={26} />
            <strong>Drop files here or click to browse</strong>
            <span>PDFs, images, ZIPs, docs, audio, video — up to 100 MB per file</span>
          </div>

          {files.length > 0 && (
            <ul className="queued-files-list">
              {files.map((file, idx) => (
                <li key={`${file.name}-${idx}`}>
                  <div className="queued-file-info">
                    <strong>{file.name}</strong>
                    <span>{formatBytes(file.size)}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <HostedOptionsFields
            title={title}
            onTitleChange={setTitle}
            note={note}
            onNoteChange={setNote}
            customSlug={customSlug}
            onCustomSlugChange={setCustomSlug}
            pin={pin}
            onPinChange={setPin}
            expiresIn={expiresIn}
            onExpiresInChange={setExpiresIn}
            maxDownloads={maxDownloads}
            onMaxDownloadsChange={setMaxDownloads}
          />
        </div>
      )}

      {mode === 'inline' && (
        <div className="tab-body">
          <div className="field-group">
            <div className="label-row">
              <label className="field-label">Direct Text or Tiny Data URI (No Server)</label>
              <span className={`byte-counter ${inlineBytes > inlineCapacity ? 'over' : ''}`}>
                {inlineBytes} / {inlineCapacity} bytes (EC-H)
              </span>
            </div>
            <textarea
              rows={4}
              value={inlineText}
              onChange={(e) => onInlineTextChange(e.target.value)}
              placeholder="Paste text, Wi-Fi config, snippet, or load a tiny <900B file below..."
            />
          </div>
          <div className="inline-actions-row">
            <input
              ref={inlineFileInputRef}
              type="file"
              hidden
              onChange={(e) => handleInlineTinyFile(e.target.files?.[0])}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => inlineFileInputRef.current?.click()}
            >
              <FileUp size={14} />
              <span>Embed Tiny File (&lt;900 B)</span>
            </button>
          </div>
        </div>
      )}

      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      {(mode === 'file' || mode === 'bundle' || (mode === 'link' && useHostedShortLink)) && (
        <div className="submit-share-bar">
          {uploadProgress !== null && (
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={submitting}
            onClick={submitHostedShare}
          >
            <Send size={16} />
            <span>
              {submitting
                ? uploadProgress !== null
                  ? `Uploading (${uploadProgress}%)...`
                  : 'Creating PokéDrop...'
                : activeShare
                  ? 'Create New PokéDrop Share & QR'
                  : 'Upload & Generate PokéDrop QR'}
            </span>
          </button>
        </div>
      )}
    </section>
  );
}

interface HostedOptionsProps {
  title: string;
  onTitleChange: (v: string) => void;
  note: string;
  onNoteChange: (v: string) => void;
  customSlug: string;
  onCustomSlugChange: (v: string) => void;
  pin: string;
  onPinChange: (v: string) => void;
  expiresIn: string;
  onExpiresInChange: (v: string) => void;
  maxDownloads: string;
  onMaxDownloadsChange: (v: string) => void;
}

function HostedOptionsFields({
  title,
  onTitleChange,
  note,
  onNoteChange,
  customSlug,
  onCustomSlugChange,
  pin,
  onPinChange,
  expiresIn,
  onExpiresInChange,
  maxDownloads,
  onMaxDownloadsChange
}: HostedOptionsProps) {
  return (
    <details className="hosted-options-details" open>
      <summary>Share Options (Title, Passcode, Expiry, Slug)</summary>
      <div className="hosted-options-grid">
        <div className="field-group">
          <label className="field-label">Share Title (optional)</label>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Team Project Assets"
            maxLength={120}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Custom Slug (optional)</label>
          <input
            type="text"
            value={customSlug}
            onChange={(e) => onCustomSlugChange(e.target.value)}
            placeholder="e.g. pika-notes"
            maxLength={48}
          />
        </div>
        <div className="field-group">
          <label className="field-label">
            <Lock size={13} /> Passcode / PIN (optional)
          </label>
          <input
            type="password"
            value={pin}
            onChange={(e) => onPinChange(e.target.value)}
            placeholder="3-32 chars to lock"
            maxLength={32}
          />
        </div>
        <div className="field-group">
          <label className="field-label">Expires After</label>
          <select value={expiresIn} onChange={(e) => onExpiresInChange(e.target.value)}>
            <option value="1h">1 Hour</option>
            <option value="24h">24 Hours</option>
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="never">Never</option>
          </select>
        </div>
        <div className="field-group">
          <label className="field-label">Max Downloads (optional)</label>
          <input
            type="number"
            min={1}
            max={100000}
            value={maxDownloads}
            onChange={(e) => onMaxDownloadsChange(e.target.value)}
            placeholder="Unlimited"
          />
        </div>
        <div className="field-group full-span">
          <label className="field-label">Trainer Note (optional)</label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Message shown on the PokéDrop download page..."
            maxLength={2000}
          />
        </div>
      </div>
    </details>
  );
}
