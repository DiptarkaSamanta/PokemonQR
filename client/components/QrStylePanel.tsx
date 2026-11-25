import { Palette, Sparkles } from 'lucide-react';
import { POKEMON_TYPE_PALETTES } from '../data/pokemonThemes.ts';
import type {
  NeonSceneTheme,
  QrEyeShape,
  QrMode,
  QrModuleShape,
  QrStyleConfig
} from '../types.ts';

interface QrStylePanelProps {
  style: QrStyleConfig;
  onChange: (next: QrStyleConfig) => void;
}

const MODE_OPTIONS: Array<{ id: QrMode; title: string; desc: string }> = [
  { id: 'pixelart', title: '8-Bit Pixel Sprite', desc: 'Grid-snapped pixel Pokémon inside retro QR' },
  { id: 'neonscene', title: 'Neon Scene Glow', desc: 'Synthwave/elemental scene with glowing QR tiles' },
  { id: 'badge', title: 'Center Badge', desc: 'Crisp QR with framed Pokémon center emblem' },
  { id: 'halftone', title: 'Halftone Art Blend', desc: 'Pokémon art woven across QR modules' },
  { id: 'backdrop', title: 'Art Backdrop', desc: 'Soft Pokémon art behind high-contrast dots' },
  { id: 'classic', title: 'Clean Theme', desc: 'Pure styled QR with Pokéball corners' }
];

const NEON_THEME_OPTIONS: Array<{ id: NeonSceneTheme; label: string; swatch: string }> = [
  { id: 'synthwave', label: 'Synthwave', swatch: 'linear-gradient(135deg, #260846, #f472b6)' },
  { id: 'cyber', label: 'Cyber', swatch: 'linear-gradient(135deg, #0f172a, #22d3ee)' },
  { id: 'inferno', label: 'Inferno', swatch: 'linear-gradient(135deg, #3b0712, #fb923c)' },
  { id: 'aurora', label: 'Aurora', swatch: 'linear-gradient(135deg, #171544, #a78bfa)' },
  { id: 'ocean', label: 'Ocean', swatch: 'linear-gradient(135deg, #0c2444, #38bdf8)' },
  { id: 'type', label: 'Pokémon Type', swatch: 'linear-gradient(135deg, #1e293b, #facc15)' }
];

const MODULE_OPTIONS: Array<{ id: QrModuleShape; label: string }> = [
  { id: 'rounded', label: 'Rounded' },
  { id: 'dots', label: 'Dots' },
  { id: 'liquid', label: 'Liquid' },
  { id: 'pixel', label: 'Pixel' },
  { id: 'square', label: 'Square' }
];

const EYE_OPTIONS: Array<{ id: QrEyeShape; label: string }> = [
  { id: 'pokeball', label: 'Poké Ball' },
  { id: 'greatball', label: 'Great Ball' },
  { id: 'ultraball', label: 'Ultra Ball' },
  { id: 'masterball', label: 'Master Ball' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'square', label: 'Square' }
];

export function QrStylePanel({ style, onChange }: QrStylePanelProps) {
  const update = <K extends keyof QrStyleConfig>(key: K, value: QrStyleConfig[K]) => {
    onChange({ ...style, [key]: value });
  };

  return (
    <section className="studio-card">
      <div className="card-header">
        <div>
          <span className="step-badge">Step 3</span>
          <h2>Customize QR Style</h2>
        </div>
      </div>

      <div className="field-group">
        <label className="field-label">Pokémon Visual Mode</label>
        <div className="mode-grid">
          {MODE_OPTIONS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-card ${style.mode === m.id ? 'active' : ''}`}
              onClick={() => update('mode', m.id)}
            >
              <strong>{m.title}</strong>
              <span>{m.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {style.mode === 'pixelart' && (
        <div className="mode-subpanel">
          <div className="two-col-controls">
            <div className="field-group">
              <label className="field-label">
                Pixel Sprite Size ({Math.round(style.pixelSpriteScale * 100)}%)
              </label>
              <input
                type="range"
                min={0.28}
                max={0.5}
                step={0.02}
                value={style.pixelSpriteScale}
                onChange={(e) => update('pixelSpriteScale', Number(e.target.value))}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Retro Contrast Preset</label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  onChange({
                    ...style,
                    fgColor: '#0f172a',
                    fgSecondaryColor: '#0f172a',
                    eyeColor: '#0f172a',
                    bgColor: '#ffffff'
                  })
                }
              >
                Classic B&amp;W Pixel Matrix
              </button>
            </div>
          </div>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={style.pixelSafeDots}
              onChange={(e) => update('pixelSafeDots', e.target.checked)}
            />
            <span>Auto-add subtle edge anchors only if large sprite affects scannability</span>
          </label>
        </div>
      )}

      {style.mode === 'neonscene' && (
        <div className="mode-subpanel">
          <div className="field-group">
            <label className="field-label">Neon Scene Atmosphere</label>
            <div className="chip-row">
              {NEON_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip-btn neon-chip ${style.neonTheme === opt.id ? 'active' : ''}`}
                  onClick={() => update('neonTheme', opt.id)}
                >
                  <span className="neon-chip-dot" style={{ background: opt.swatch }} />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="two-col-controls">
            <div className="field-group">
              <label className="field-label">
                Neon Glow Intensity ({Math.round(style.neonGlowStrength * 100)}%)
              </label>
              <input
                type="range"
                min={0.2}
                max={1.0}
                step={0.05}
                value={style.neonGlowStrength}
                onChange={(e) => update('neonGlowStrength', Number(e.target.value))}
              />
            </div>
            <div className="field-group">
              <label className="field-label">Tile Polarity</label>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={style.neonInverted}
                  onChange={(e) => update('neonInverted', e.target.checked)}
                />
                <span>Glowing Neon on Dark Scene</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {style.mode === 'badge' && (
        <div className="two-col-controls">
          <div className="field-group">
            <label className="field-label">
              Badge Size ({Math.round(style.badgeSizeRatio * 100)}%)
            </label>
            <input
              type="range"
              min={0.16}
              max={0.28}
              step={0.01}
              value={style.badgeSizeRatio}
              onChange={(e) => update('badgeSizeRatio', Number(e.target.value))}
            />
          </div>
          <div className="field-group">
            <label className="field-label">Badge Frame</label>
            <div className="segmented">
              {(['pokeball', 'circle', 'squircle'] as const).map((shape) => (
                <button
                  key={shape}
                  type="button"
                  className={`seg-btn ${style.badgeShape === shape ? 'active' : ''}`}
                  onClick={() => update('badgeShape', shape)}
                >
                  {shape === 'pokeball' ? 'Pokéball' : shape === 'circle' ? 'Circle' : 'Squircle'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {style.mode === 'halftone' && (
        <div className="field-group">
          <label className="field-label">
            Artwork Blend Intensity ({Math.round(style.halftoneIntensity * 100)}%)
          </label>
          <input
            type="range"
            min={0.2}
            max={0.95}
            step={0.05}
            value={style.halftoneIntensity}
            onChange={(e) => update('halftoneIntensity', Number(e.target.value))}
          />
        </div>
      )}

      {style.mode === 'backdrop' && (
        <div className="field-group">
          <label className="field-label">
            Backdrop Opacity ({Math.round(style.backdropOpacity * 100)}%)
          </label>
          <input
            type="range"
            min={0.12}
            max={0.55}
            step={0.03}
            value={style.backdropOpacity}
            onChange={(e) => update('backdropOpacity', Number(e.target.value))}
          />
        </div>
      )}

      {style.mode !== 'pixelart' && style.mode !== 'neonscene' && (
        <>
          <div className="field-group">
            <label className="field-label">Module Shape</label>
            <div className="chip-row">
              {MODULE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip-btn ${style.moduleShape === opt.id ? 'active' : ''}`}
                  onClick={() => update('moduleShape', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <label className="field-label">Finder Corners (Eyes)</label>
            <div className="chip-row">
              {EYE_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`chip-btn ${style.eyeShape === opt.id ? 'active' : ''}`}
                  onClick={() => update('eyeShape', opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {style.mode !== 'neonscene' && (
        <div className="field-group">
          <div className="label-row">
            <label className="field-label">
              <Palette size={14} /> Colors &amp; Type Presets
            </label>
            {style.mode !== 'pixelart' && (
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={style.useGradient}
                  onChange={(e) => update('useGradient', e.target.checked)}
                />
                <span>Gradient</span>
              </label>
            )}
          </div>

          <div className="color-pickers-grid">
            <label className="color-swatch">
              <span>Dots</span>
              <input
                type="color"
                value={style.fgColor}
                onChange={(e) => update('fgColor', e.target.value)}
              />
            </label>
            {style.useGradient && style.mode !== 'pixelart' && (
              <label className="color-swatch">
                <span>Gradient 2</span>
                <input
                  type="color"
                  value={style.fgSecondaryColor}
                  onChange={(e) => update('fgSecondaryColor', e.target.value)}
                />
              </label>
            )}
            <label className="color-swatch">
              <span>Corners</span>
              <input
                type="color"
                value={style.eyeColor}
                onChange={(e) => update('eyeColor', e.target.value)}
              />
            </label>
            <label className="color-swatch">
              <span>Background</span>
              <input
                type="color"
                value={style.bgColor}
                onChange={(e) => update('bgColor', e.target.value)}
              />
            </label>
          </div>

          <div className="palette-dots-row">
            {Object.values(POKEMON_TYPE_PALETTES).slice(0, 12).map((pal) => (
              <button
                key={pal.name}
                type="button"
                className="palette-dot"
                title={`${pal.label} Type Theme`}
                style={{
                  background: `linear-gradient(135deg, ${pal.fg} 50%, ${pal.accent} 50%)`
                }}
                onClick={() =>
                  onChange({
                    ...style,
                    fgColor: pal.fg,
                    fgSecondaryColor: pal.fgSecondary,
                    eyeColor: pal.eye,
                    bgColor: pal.bg
                  })
                }
              />
            ))}
          </div>
        </div>
      )}

      <div className="card-frame-section">
        <label className="checkbox-inline strong-check">
          <input
            type="checkbox"
            checked={style.includeCardFrame}
            onChange={(e) => update('includeCardFrame', e.target.checked)}
          />
          <Sparkles size={15} />
          <span>Export as Collectible PokéQR Share Card</span>
        </label>

        {style.includeCardFrame && (
          <div className="two-col-controls">
            <input
              type="text"
              value={style.cardHeadline}
              onChange={(e) => update('cardHeadline', e.target.value)}
              placeholder="Card Headline (e.g. Scan for Files)"
              maxLength={42}
            />
            <input
              type="text"
              value={style.cardSubtitle}
              onChange={(e) => update('cardSubtitle', e.target.value)}
              placeholder="Subtitle (e.g. PokéDrop Transfer)"
              maxLength={62}
            />
          </div>
        )}
      </div>
    </section>
  );
}
