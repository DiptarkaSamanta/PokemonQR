export interface PokemonCatalogEntry {
  id: number;
  name: string;
  displayName: string;
  types: string[];
}

export const FALLBACK_POKEMON: PokemonCatalogEntry[] = [
  { id: 1, name: 'bulbasaur', displayName: 'Bulbasaur', types: ['grass', 'poison'] },
  { id: 4, name: 'charmander', displayName: 'Charmander', types: ['fire'] },
  { id: 6, name: 'charizard', displayName: 'Charizard', types: ['fire', 'flying'] },
  { id: 7, name: 'squirtle', displayName: 'Squirtle', types: ['water'] },
  { id: 9, name: 'blastoise', displayName: 'Blastoise', types: ['water'] },
  { id: 25, name: 'pikachu', displayName: 'Pikachu', types: ['electric'] },
  { id: 26, name: 'raichu', displayName: 'Raichu', types: ['electric'] },
  { id: 39, name: 'jigglypuff', displayName: 'Jigglypuff', types: ['normal', 'fairy'] },
  { id: 52, name: 'meowth', displayName: 'Meowth', types: ['normal'] },
  { id: 54, name: 'psyduck', displayName: 'Psyduck', types: ['water'] },
  { id: 59, name: 'arcanine', displayName: 'Arcanine', types: ['fire'] },
  { id: 65, name: 'alakazam', displayName: 'Alakazam', types: ['psychic'] },
  { id: 68, name: 'machamp', displayName: 'Machamp', types: ['fighting'] },
  { id: 94, name: 'gengar', displayName: 'Gengar', types: ['ghost', 'poison'] },
  { id: 130, name: 'gyarados', displayName: 'Gyarados', types: ['water', 'flying'] },
  { id: 131, name: 'lapras', displayName: 'Lapras', types: ['water', 'ice'] },
  { id: 133, name: 'eevee', displayName: 'Eevee', types: ['normal'] },
  { id: 134, name: 'vaporeon', displayName: 'Vaporeon', types: ['water'] },
  { id: 135, name: 'jolteon', displayName: 'Jolteon', types: ['electric'] },
  { id: 136, name: 'flareon', displayName: 'Flareon', types: ['fire'] },
  { id: 143, name: 'snorlax', displayName: 'Snorlax', types: ['normal'] },
  { id: 149, name: 'dragonite', displayName: 'Dragonite', types: ['dragon', 'flying'] },
  { id: 150, name: 'mewtwo', displayName: 'Mewtwo', types: ['psychic'] },
  { id: 151, name: 'mew', displayName: 'Mew', types: ['psychic'] },
  { id: 175, name: 'togepi', displayName: 'Togepi', types: ['fairy'] },
  { id: 196, name: 'espeon', displayName: 'Espeon', types: ['psychic'] },
  { id: 197, name: 'umbreon', displayName: 'Umbreon', types: ['dark'] },
  { id: 212, name: 'scizor', displayName: 'Scizor', types: ['bug', 'steel'] },
  { id: 248, name: 'tyranitar', displayName: 'Tyranitar', types: ['rock', 'dark'] },
  { id: 282, name: 'gardevoir', displayName: 'Gardevoir', types: ['psychic', 'fairy'] },
  { id: 384, name: 'rayquaza', displayName: 'Rayquaza', types: ['dragon', 'flying'] },
  { id: 445, name: 'garchomp', displayName: 'Garchomp', types: ['dragon', 'ground'] },
  { id: 448, name: 'lucario', displayName: 'Lucario', types: ['fighting', 'steel'] },
  { id: 658, name: 'greninja', displayName: 'Greninja', types: ['water', 'dark'] },
  { id: 700, name: 'sylveon', displayName: 'Sylveon', types: ['fairy'] },
  { id: 778, name: 'mimikyu', displayName: 'Mimikyu', types: ['ghost', 'fairy'] }
];

export const TYPE_HEX_COLORS: Record<string, { primary: string; secondary: string }> = {
  normal: { primary: '#64748b', secondary: '#cbd5e1' },
  fire: { primary: '#ea580c', secondary: '#fb923c' },
  water: { primary: '#0284c7', secondary: '#38bdf8' },
  electric: { primary: '#ca8a04', secondary: '#facc15' },
  grass: { primary: '#16a34a', secondary: '#4ade80' },
  ice: { primary: '#0891b2', secondary: '#67e8f9' },
  fighting: { primary: '#b91c1c', secondary: '#f87171' },
  poison: { primary: '#9333ea', secondary: '#c084fc' },
  ground: { primary: '#b45309', secondary: '#f59e0b' },
  flying: { primary: '#4f46e5', secondary: '#818cf8' },
  psychic: { primary: '#db2777', secondary: '#f472b6' },
  bug: { primary: '#65a30d', secondary: '#a3e635' },
  rock: { primary: '#78716c', secondary: '#a8a29e' },
  ghost: { primary: '#5b21b6', secondary: '#8b5cf6' },
  dragon: { primary: '#4338ca', secondary: '#6366f1' },
  dark: { primary: '#1e293b', secondary: '#475569' },
  steel: { primary: '#475569', secondary: '#94a3b8' },
  fairy: { primary: '#e11d48', secondary: '#fda4af' }
};

export function generateFallbackPokemonSvg(id: number, label?: string, type = 'electric'): string {
  const palette = TYPE_HEX_COLORS[type] ?? TYPE_HEX_COLORS.electric;
  const known = FALLBACK_POKEMON.find((p) => p.id === id);
  const name = label || known?.displayName || `PKMN #${id}`;
  const initials = name
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .slice(0, 3)
    .toUpperCase() || `#${id}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.secondary}"/>
      <stop offset="100%" stop-color="${palette.primary}"/>
    </linearGradient>
  </defs>
  <circle cx="128" cy="128" r="118" fill="#ffffff" stroke="#0f172a" stroke-width="10"/>
  <path d="M 10 128 A 118 118 0 0 1 246 128 Z" fill="url(#bg)" stroke="#0f172a" stroke-width="10"/>
  <rect x="10" y="118" width="236" height="20" fill="#0f172a"/>
  <circle cx="128" cy="128" r="46" fill="#ffffff" stroke="#0f172a" stroke-width="10"/>
  <text x="128" y="137" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="800" font-size="28" fill="#0f172a">${initials}</text>
  <text x="128" y="210" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="22" fill="#334155">#${String(id).padStart(3, '0')}</text>
</svg>`;
}
