import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileImage
} from 'lucide-react';
import { getSpriteUrl } from '../data/pokemonThemes.ts';
import type { PublicShareInfo, QrStyleConfig, QrVerificationResult, SelectedPokemon } from '../types.ts';
import {
  exportCanvasAsSvg,
  getEffectiveContrastColors,
  renderPokemonQrToCanvas,
  renderVectorQrSvg
} from '../utils/qrRenderer.ts';
import { verifyCanvasQr } from '../utils/qrVerifier.ts';

interface QrPreviewCardProps {
  payload: string;
  style: QrStyleConfig;
  pokemon: SelectedPokemon;
  activeShare: PublicShareInfo | null;
}

export function QrPreviewCard({ payload, style, pokemon, activeShare }: QrPreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [loadedDataUrl, setLoadedDataUrl] = useState<string | null>(null);
  const [verification, setVerification] = useState<QrVerificationResult | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedImg, setCopiedImg] = useState(false);

  const effectiveArtStyle =
    style.mode === 'pixelart' && pokemon.artworkStyle !== 'custom'
      ? 'pixel'
      : pokemon.artworkStyle;

  const spriteSrc =
    pokemon.artworkStyle === 'custom' && pokemon.customImageDataUrl
      ? pokemon.customImageDataUrl
      : getSpriteUrl(pokemon.id, effectiveArtStyle, pokemon.shiny, pokemon.types[0]);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (cancelled) return;
      setLoadedImage(img);
      try {
        const tmp = document.createElement('canvas');
        tmp.width = img.naturalWidth || 256;
        tmp.height = img.naturalHeight || 256;
        const ctx = tmp.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setLoadedDataUrl(tmp.toDataURL('image/png'));
        }
      } catch {
        setLoadedDataUrl(null);
      }
    };
    img.onerror = () => {
      if (!cancelled) {
        setLoadedImage(null);
        setLoadedDataUrl(null);
      }
    };
    img.src = spriteSrc;

    return () => {
      cancelled = true;
    };
  }, [spriteSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const effectivePayload = payload.trim() || 'https://pokeapi.co';
    const { moduleCount, qrRegion } = renderPokemonQrToCanvas(
      canvas,
      effectivePayload,
      style,
      pokemon,
      loadedImage,
      1024
    );

    const timer = setTimeout(() => {
      const { fg, bg } = getEffectiveContrastColors(style, pokemon);
      const result = verifyCanvasQr(
        canvas,
        effectivePayload,
        fg,
        bg,
        moduleCount,
        qrRegion,
        style.mode === 'neonscene'
      );
      setVerification(result);
    }, 60);

    return () => clearTimeout(timer);
  }, [payload, style, pokemon, loadedImage]);

  function downloadPng(size: number) {
    const effectivePayload = payload.trim() || 'https://pokeapi.co';
    const offscreen = document.createElement('canvas');
    renderPokemonQrToCanvas(offscreen, effectivePayload, style, pokemon, loadedImage, size);
    const link = document.createElement('a');
    link.download = `pokeqr-${pokemon.name}-${size}px.png`;
    link.href = offscreen.toDataURL('image/png');
    link.click();
  }

  function downloadSvg() {
    const effectivePayload = payload.trim() || 'https://pokeapi.co';
    let svgContent: string;
    if (!style.includeCardFrame && (style.mode === 'classic' || style.mode === 'badge')) {
      svgContent = renderVectorQrSvg(effectivePayload, style, pokemon, loadedDataUrl, 900);
    } else if (canvasRef.current) {
      svgContent = exportCanvasAsSvg(canvasRef.current, `${pokemon.displayName} QR`);
    } else {
      return;
    }

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `pokeqr-${pokemon.name}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function copyQrImage() {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopiedImg(true);
      setTimeout(() => setCopiedImg(false), 1800);
    } catch {
      // Clipboard write may require HTTPS or user gesture focus
    }
  }

  async function copyPayloadUrl() {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Ignore clipboard errors
    }
  }

  const isHttpUrl = /^https?:\/\//i.test(payload);
  const usesLocalhost = payload.includes('localhost') || payload.includes('127.0.0.1');

  return (
    <aside className="preview-sticky">
      <section className="studio-card preview-card">
        <div className="preview-top-bar">
          <div>
            <span className="step-badge">Live Output</span>
            <h2>{pokemon.displayName} QR</h2>
          </div>
          {verification && (
            <div
              className={`scan-pill ${verification.verified ? 'ok' : 'warn'}`}
              title={verification.warning || 'Decoded live via jsQR'}
            >
              {verification.verified ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>
                {verification.verified
                  ? `Scannable${verification.inverted ? ' (Neon)' : ''} · ${verification.contrastRatio}:1`
                  : `Check Contrast · ${verification.contrastRatio}:1`}
              </span>
            </div>
          )}
        </div>

        <div className="canvas-stage">
          <canvas ref={canvasRef} className="qr-canvas" />
        </div>

        {verification?.warning && (
          <div className="scan-warning-banner">
            <AlertTriangle size={15} />
            <span>{verification.warning}</span>
          </div>
        )}

        <div className="payload-box">
          <div className="payload-box-header">
            <span>Encoded QR Payload</span>
            {verification && <span>{verification.moduleCount}×{verification.moduleCount} grid</span>}
          </div>
          <div className="payload-url-row">
            <code title={payload}>{payload || 'https://pokeapi.co'}</code>
            <button type="button" className="icon-btn" onClick={copyPayloadUrl} title="Copy encoded payload">
              {copiedUrl ? <Check size={15} /> : <Copy size={15} />}
            </button>
            {isHttpUrl && (
              <a
                href={payload}
                target="_blank"
                rel="noopener noreferrer"
                className="icon-btn"
                title="Open encoded URL"
              >
                <ExternalLink size={15} />
              </a>
            )}
          </div>
          {activeShare && usesLocalhost && (
            <p className="localhost-hint">
              Tip: This share uses <code>localhost</code>. Switch the Wi-Fi IP in the top-right header so phones on your Wi-Fi can scan it!
            </p>
          )}
        </div>

        <div className="export-grid">
          <button type="button" className="btn btn-primary" onClick={() => downloadPng(1024)}>
            <Download size={16} />
            <span>PNG (1024px)</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => downloadPng(2048)}>
            <FileImage size={16} />
            <span>Print (2048px)</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={downloadSvg}>
            <Download size={16} />
            <span>SVG Vector</span>
          </button>
          <button type="button" className="btn btn-ghost" onClick={copyQrImage}>
            {copiedImg ? <Check size={16} /> : <Copy size={16} />}
            <span>{copiedImg ? 'Copied!' : 'Copy Image'}</span>
          </button>
        </div>
      </section>
    </aside>
  );
}
