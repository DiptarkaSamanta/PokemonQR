import { useEffect, useRef, useState } from 'react';
import { Dice5, Search, Sparkles, Upload } from 'lucide-react';
import { getPaletteForTypes, getSpriteUrl, QUICK_STARTER_POKEMON } from '../data/pokemonThemes.ts';
import type { ArtworkStyle, PokemonSummary, SelectedPokemon } from '../types.ts';

interface PokemonPickerProps {
  selected: SelectedPokemon;
  onSelect: (pokemon: SelectedPokemon, applyPalette?: boolean) => void;
  autoApplyPalette: boolean;
  onToggleAutoApplyPalette: (val: boolean) => void;
}

export function PokemonPicker({
  selected,
  onSelect,
  autoApplyPalette,
  onToggleAutoApplyPalette
}: PokemonPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonSummary[]>(QUICK_STARTER_POKEMON);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults(QUICK_STARTER_POKEMON);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/pokemon?q=${encodeURIComponent(trimmed)}&limit=24`, {
          signal: controller.signal
        });
        if (res.ok) {
          const data = (await res.json()) as { results: PokemonSummary[] };
          setResults(data.results);
        }
      } catch {
        // Ignore aborts
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  async function handleChoosePokemon(summary: PokemonSummary) {
    let types = summary.types;
    if (!types || types.length === 0) {
      try {
        const resp = await fetch(`/api/pokemon/${summary.id}`);
        if (resp.ok) {
          const detail = (await resp.json()) as PokemonSummary;
          types = detail.types;
        }
      } catch {
        types = ['normal'];
      }
    }

    onSelect(
      {
        id: summary.id,
        name: summary.name,
        displayName: summary.displayName,
        types: types.length ? types : ['normal'],
        shiny: selected.shiny,
        artworkStyle: selected.artworkStyle === 'custom' ? 'official' : selected.artworkStyle
      },
      autoApplyPalette
    );
  }

  async function handleRandomPokemon() {
    const randomId = Math.floor(Math.random() * 1025) + 1;
    try {
      const resp = await fetch(`/api/pokemon/${randomId}`);
      if (resp.ok) {
        const detail = (await resp.json()) as PokemonSummary;
        onSelect(
          {
            id: detail.id,
            name: detail.name,
            displayName: detail.displayName,
            types: detail.types.length ? detail.types : ['normal'],
            shiny: selected.shiny,
            artworkStyle: selected.artworkStyle === 'custom' ? 'official' : selected.artworkStyle
          },
          autoApplyPalette
        );
        return;
      }
    } catch {
      // Fallback to starter pool
    }
    const pick = QUICK_STARTER_POKEMON[Math.floor(Math.random() * QUICK_STARTER_POKEMON.length)];
    await handleChoosePokemon(pick);
  }

  function handleCustomImageUpload(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelect(
          {
            ...selected,
            displayName: file.name.replace(/\.[^.]+$/, '').slice(0, 32) || selected.displayName,
            artworkStyle: 'custom',
            customImageDataUrl: reader.result
          },
          false
        );
      }
    };
    reader.readAsDataURL(file);
  }

  const activePalette = getPaletteForTypes(selected.types);
  const activePreviewUrl =
    selected.artworkStyle === 'custom' && selected.customImageDataUrl
      ? selected.customImageDataUrl
      : getSpriteUrl(selected.id, selected.artworkStyle, selected.shiny, selected.types[0]);

  return (
    <section className="studio-card">
      <div className="card-header">
        <div>
          <span className="step-badge">Step 2</span>
          <h2>Choose Pokémon</h2>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleRandomPokemon}>
          <Dice5 size={15} />
          <span>Surprise Me</span>
        </button>
      </div>

      <div className="selected-pokemon-banner" style={{ background: activePalette.badgeBg }}>
        <img
          src={activePreviewUrl}
          alt={selected.displayName}
          className="selected-pokemon-thumb"
        />
        <div className="selected-pokemon-meta">
          <div className="selected-title-row">
            <strong>{selected.displayName}</strong>
            <span className="dex-num">#{String(selected.id).padStart(3, '0')}</span>
          </div>
          <div className="type-pills">
            {selected.types.map((t) => (
              <span key={t} className="type-pill">
                {t}
              </span>
            ))}
          </div>
        </div>
        <div className="selected-actions">
          <button
            type="button"
            className={`toggle-chip ${selected.shiny ? 'active-shiny' : ''}`}
            onClick={() => onSelect({ ...selected, shiny: !selected.shiny }, false)}
            title="Toggle Shiny variant"
          >
            <Sparkles size={14} />
            <span>Shiny</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onSelect(selected, true)}
          >
            Apply Type Colors
          </button>
        </div>
      </div>

      <div className="art-style-row">
        <div className="segmented">
          {(['official', 'home', 'pixel'] as ArtworkStyle[]).map((style) => (
            <button
              key={style}
              type="button"
              className={`seg-btn ${selected.artworkStyle === style ? 'active' : ''}`}
              onClick={() => onSelect({ ...selected, artworkStyle: style }, false)}
            >
              {style === 'official' ? 'Official HD' : style === 'home' ? '3D Home' : 'Pixel Sprite'}
            </button>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          hidden
          onChange={(e) => handleCustomImageUpload(e.target.files?.[0])}
        />
        <button
          type="button"
          className={`btn btn-ghost btn-sm ${selected.artworkStyle === 'custom' ? 'active-outline' : ''}`}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={14} />
          <span>Custom Sprite</span>
        </button>
      </div>

      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={autoApplyPalette}
          onChange={(e) => onToggleAutoApplyPalette(e.target.checked)}
        />
        <span>Auto-match QR colors to Pokémon type</span>
      </label>

      <div className="search-box">
        <Search size={16} className="search-icon" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search any Pokémon (e.g. Pikachu, Gengar, #151, Lucario)..."
        />
      </div>

      <div className="pokemon-grid">
        {loading && <div className="grid-status">Searching Pokédex...</div>}
        {!loading && results.length === 0 && (
          <div className="grid-status">No Pokémon matched "{query}". Try a name or #ID.</div>
        )}
        {results.map((item) => {
          const isSelected = item.id === selected.id && selected.artworkStyle !== 'custom';
          return (
            <button
              key={item.id}
              type="button"
              className={`pokemon-tile ${isSelected ? 'selected' : ''}`}
              onClick={() => handleChoosePokemon(item)}
              title={`${item.displayName} (#${item.id})`}
            >
              <img
                src={getSpriteUrl(
                  item.id,
                  selected.artworkStyle === 'custom' ? 'official' : selected.artworkStyle,
                  selected.shiny,
                  item.types[0]
                )}
                alt={item.displayName}
                loading="lazy"
              />
              <span className="tile-name">{item.displayName}</span>
              <span className="tile-id">#{String(item.id).padStart(3, '0')}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
