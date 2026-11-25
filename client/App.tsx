import { useCallback, useEffect, useMemo, useState } from 'react';
import { PayloadPanel } from './components/PayloadPanel.tsx';
import { PokemonPicker } from './components/PokemonPicker.tsx';
import { QrPreviewCard } from './components/QrPreviewCard.tsx';
import { QrStylePanel } from './components/QrStylePanel.tsx';
import { ShareLandingPage } from './components/ShareLandingPage.tsx';
import { SharesManager } from './components/SharesManager.tsx';
import { StudioHeader } from './components/StudioHeader.tsx';
import { getPaletteForTypes } from './data/pokemonThemes.ts';
import type {
  NetworkInfo,
  PayloadMode,
  PublicShareInfo,
  QrStyleConfig,
  SelectedPokemon
} from './types.ts';

const INITIAL_POKEMON: SelectedPokemon = {
  id: 25,
  name: 'pikachu',
  displayName: 'Pikachu',
  types: ['electric'],
  shiny: false,
  artworkStyle: 'official'
};

const INITIAL_PALETTE = getPaletteForTypes(INITIAL_POKEMON.types);

const INITIAL_STYLE: QrStyleConfig = {
  mode: 'badge',
  moduleShape: 'rounded',
  eyeShape: 'pokeball',
  ecLevel: 'H',
  fgColor: INITIAL_PALETTE.fg,
  fgSecondaryColor: INITIAL_PALETTE.fgSecondary,
  useGradient: true,
  bgColor: INITIAL_PALETTE.bg,
  eyeColor: INITIAL_PALETTE.eye,
  badgeSizeRatio: 0.22,
  badgeShape: 'pokeball',
  halftoneIntensity: 0.65,
  backdropOpacity: 0.3,
  pixelSpriteScale: 0.38,
  pixelSafeDots: true,
  neonTheme: 'synthwave',
  neonGlowStrength: 0.75,
  neonInverted: true,
  quietZoneModules: 3,
  includeCardFrame: false,
  cardHeadline: 'Scan to Open PokéDrop',
  cardSubtitle: 'Shared via PokéQR Studio'
};

export function App() {
  const shareRouteMatch = useMemo(
    () => window.location.pathname.match(/^\/s\/([a-zA-Z0-9_-]+)\/?$/),
    []
  );

  if (shareRouteMatch) {
    return <ShareLandingPage shareId={shareRouteMatch[1]} />;
  }

  return <StudioWorkspace />;
}

function StudioWorkspace() {
  const [activeTab, setActiveTab] = useState<'studio' | 'shares'>('studio');
  const [payloadMode, setPayloadMode] = useState<PayloadMode>('file');
  const [directUrl, setDirectUrl] = useState('https://pokeapi.co');
  const [useHostedShortLink, setUseHostedShortLink] = useState(false);
  const [directRedirect, setDirectRedirect] = useState(false);
  const [inlineText, setInlineText] = useState('Pikachu says hi!');

  const [pokemon, setPokemon] = useState<SelectedPokemon>(INITIAL_POKEMON);
  const [autoApplyPalette, setAutoApplyPalette] = useState(true);
  const [qrStyle, setQrStyle] = useState<QrStyleConfig>(INITIAL_STYLE);

  const [networkInfo, setNetworkInfo] = useState<NetworkInfo | null>(null);
  const [shareBaseUrl, setShareBaseUrl] = useState<string>(() => {
    return localStorage.getItem('pokeqr_share_base_url') || window.location.origin;
  });

  const [shares, setShares] = useState<PublicShareInfo[]>([]);
  const [sharesLoading, setSharesLoading] = useState(false);
  const [activeShare, setActiveShare] = useState<PublicShareInfo | null>(null);

  const refreshShares = useCallback(async () => {
    setSharesLoading(true);
    try {
      const res = await fetch('/api/shares');
      if (res.ok) {
        const data = (await res.json()) as { shares: PublicShareInfo[] };
        setShares(data.shares || []);
      }
    } finally {
      setSharesLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShares();
    fetch('/api/network')
      .then((r) => (r.ok ? r.json() : null))
      .then((info: NetworkInfo | null) => {
        if (!info) return;
        setNetworkInfo(info);
        if (!localStorage.getItem('pokeqr_share_base_url') && info.recommendedShareBase) {
          setShareBaseUrl(info.recommendedShareBase);
        }
      })
      .catch(() => {});
  }, [refreshShares]);

  function handleShareBaseUrlChange(nextUrl: string) {
    const cleaned = nextUrl.replace(/\/+$/, '');
    setShareBaseUrl(cleaned);
    localStorage.setItem('pokeqr_share_base_url', cleaned);
  }

  function handleSelectPokemon(next: SelectedPokemon, applyPalette?: boolean) {
    setPokemon(next);
    if (applyPalette) {
      const pal = getPaletteForTypes(next.types);
      setQrStyle((prev) => ({
        ...prev,
        fgColor: pal.fg,
        fgSecondaryColor: pal.fgSecondary,
        eyeColor: pal.eye,
        bgColor: pal.bg
      }));
    }
  }

  function handleShareCreated(share: PublicShareInfo) {
    setActiveShare(share);
    setQrStyle((prev) => ({
      ...prev,
      cardHeadline: share.title.slice(0, 42) || 'Scan to Open PokéDrop'
    }));
    refreshShares();
  }

  function handleLoadShareInStudio(share: PublicShareInfo) {
    setActiveShare(share);
    if (share.pokemon) {
      const loadedPoke: SelectedPokemon = {
        id: share.pokemon.id,
        name: share.pokemon.name,
        displayName: share.pokemon.displayName,
        types: share.pokemon.types || ['normal'],
        shiny: Boolean(share.pokemon.shiny),
        artworkStyle: share.pokemon.artworkStyle || 'official'
      };
      handleSelectPokemon(loadedPoke, autoApplyPalette);
    }
    setPayloadMode(share.kind === 'link' ? 'link' : share.kind === 'bundle' ? 'bundle' : 'file');
    if (share.kind === 'link') setUseHostedShortLink(true);
    setQrStyle((prev) => ({
      ...prev,
      cardHeadline: share.title.slice(0, 42)
    }));
    setActiveTab('studio');
  }

  async function handleDeleteShare(id: string) {
    const res = await fetch(`/api/shares/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (res.ok) {
      if (activeShare?.id === id) setActiveShare(null);
      await refreshShares();
    }
  }

  const effectivePayload = useMemo(() => {
    const cleanBase = shareBaseUrl.replace(/\/+$/, '');
    if (payloadMode === 'inline') {
      return inlineText.trim() || 'PokéQR Studio';
    }
    if (payloadMode === 'link' && !useHostedShortLink) {
      return directUrl.trim() || 'https://pokeapi.co';
    }
    if (activeShare) {
      return `${cleanBase}/s/${activeShare.id}`;
    }
    return `${cleanBase}/s/demo-pokedrop`;
  }, [payloadMode, useHostedShortLink, directUrl, inlineText, activeShare, shareBaseUrl]);

  return (
    <div className="app-shell">
      <StudioHeader
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sharesCount={shares.length}
        networkInfo={networkInfo}
        shareBaseUrl={shareBaseUrl}
        onShareBaseUrlChange={handleShareBaseUrlChange}
      />

      {activeTab === 'studio' ? (
        <main className="studio-layout">
          <div className="studio-controls-col">
            {activeShare && (payloadMode !== 'link' || useHostedShortLink) && (
              <div className="active-share-banner">
                <div>
                  <strong>Active PokéDrop: {activeShare.title}</strong>
                  <span>
                    QR is encoding <code>{shareBaseUrl}/s/{activeShare.id}</code>
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs"
                  onClick={() => setActiveShare(null)}
                >
                  Clear Active
                </button>
              </div>
            )}

            <PayloadPanel
              mode={payloadMode}
              onModeChange={(m) => {
                setPayloadMode(m);
                if (m === 'inline') setActiveShare(null);
              }}
              directUrl={directUrl}
              onDirectUrlChange={(val) => {
                setDirectUrl(val);
                if (!useHostedShortLink) setActiveShare(null);
              }}
              useHostedShortLink={useHostedShortLink}
              onUseHostedShortLinkChange={(val) => {
                setUseHostedShortLink(val);
                if (!val) setActiveShare(null);
              }}
              directRedirect={directRedirect}
              onDirectRedirectChange={setDirectRedirect}
              inlineText={inlineText}
              onInlineTextChange={setInlineText}
              shareBaseUrl={shareBaseUrl}
              pokemon={pokemon}
              activeShare={activeShare}
              onShareCreated={handleShareCreated}
            />

            <PokemonPicker
              selected={pokemon}
              onSelect={handleSelectPokemon}
              autoApplyPalette={autoApplyPalette}
              onToggleAutoApplyPalette={setAutoApplyPalette}
            />

            <QrStylePanel style={qrStyle} onChange={setQrStyle} />
          </div>

          <div className="studio-preview-col">
            <QrPreviewCard
              payload={effectivePayload}
              style={qrStyle}
              pokemon={pokemon}
              activeShare={
                payloadMode === 'file' || payloadMode === 'bundle' || (payloadMode === 'link' && useHostedShortLink)
                  ? activeShare
                  : null
              }
            />
          </div>
        </main>
      ) : (
        <main className="shares-layout">
          <SharesManager
            shares={shares}
            loading={sharesLoading}
            shareBaseUrl={shareBaseUrl}
            onRefresh={refreshShares}
            onLoadInStudio={handleLoadShareInStudio}
            onDeleteShare={handleDeleteShare}
          />
        </main>
      )}
    </div>
  );
}
export default App;
