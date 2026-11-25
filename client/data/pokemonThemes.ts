import type { PokemonSummary } from '../types.ts';

export interface TypePalette {
  name: string;
  label: string;
  fg: string;
  fgSecondary: string;
  eye: string;
  bg: string;
  badgeBg: string;
  accent: string;
}

export const POKEMON_TYPE_PALETTES: Record<string, TypePalette> = {
  electric: {
    name: 'electric',
    label: 'Electric',
    fg: '#1e1b4b',
    fgSecondary: '#b45309',
    eye: '#d97706',
    bg: '#fefce8',
    badgeBg: '#fef08a',
    accent: '#eab308'
  },
  fire: {
    name: 'fire',
    label: 'Fire',
    fg: '#431407',
    fgSecondary: '#dc2626',
    eye: '#ea580c',
    bg: '#fff7ed',
    badgeBg: '#fed7aa',
    accent: '#f97316'
  },
  water: {
    name: 'water',
    label: 'Water',
    fg: '#082f49',
    fgSecondary: '#0284c7',
    eye: '#0369a1',
    bg: '#f0f9ff',
    badgeBg: '#bae6fd',
    accent: '#0ea5e9'
  },
  grass: {
    name: 'grass',
    label: 'Grass',
    fg: '#052e16',
    fgSecondary: '#16a34a',
    eye: '#15803d',
    bg: '#f0fdf4',
    badgeBg: '#bbf7d0',
    accent: '#22c55e'
  },
  psychic: {
    name: 'psychic',
    label: 'Psychic',
    fg: '#500724',
    fgSecondary: '#db2777',
    eye: '#be185d',
    bg: '#fdf2f8',
    badgeBg: '#fbcfe8',
    accent: '#ec4899'
  },
  ghost: {
    name: 'ghost',
    label: 'Ghost',
    fg: '#1e103c',
    fgSecondary: '#6d28d9',
    eye: '#5b21b6',
    bg: '#f5f3ff',
    badgeBg: '#ddd6fe',
    accent: '#8b5cf6'
  },
  dragon: {
    name: 'dragon',
    label: 'Dragon',
    fg: '#1e1b4b',
    fgSecondary: '#4338ca',
    eye: '#3730a3',
    bg: '#eef2ff',
    badgeBg: '#c7d2fe',
    accent: '#6366f1'
  },
  dark: {
    name: 'dark',
    label: 'Dark',
    fg: '#09090b',
    fgSecondary: '#3f3f46',
    eye: '#18181b',
    bg: '#fafafa',
    badgeBg: '#e4e4e7',
    accent: '#52525b'
  },
  fairy: {
    name: 'fairy',
    label: 'Fairy',
    fg: '#4c0519',
    fgSecondary: '#e11d48',
    eye: '#be123c',
    bg: '#fff1f2',
    badgeBg: '#fecdd3',
    accent: '#f43f5e'
  },
  ice: {
    name: 'ice',
    label: 'Ice',
    fg: '#083344',
    fgSecondary: '#0891b2',
    eye: '#0e7490',
    bg: '#ecfeff',
    badgeBg: '#a5f3fc',
    accent: '#06b6d4'
  },
  fighting: {
    name: 'fighting',
    label: 'Fighting',
    fg: '#450a0a',
    fgSecondary: '#b91c1c',
    eye: '#991b1b',
    bg: '#fef2f2',
    badgeBg: '#fecaca',
    accent: '#ef4444'
  },
  poison: {
    name: 'poison',
    label: 'Poison',
    fg: '#3b0764',
    fgSecondary: '#9333ea',
    eye: '#7e22ce',
    bg: '#faf5ff',
    badgeBg: '#e9d5ff',
    accent: '#a855f7'
  },
  ground: {
    name: 'ground',
    label: 'Ground',
    fg: '#451a03',
    fgSecondary: '#b45309',
    eye: '#92400e',
    bg: '#fffbeb',
    badgeBg: '#fde68a',
    accent: '#d97706'
  },
  rock: {
    name: 'rock',
    label: 'Rock',
    fg: '#1c1917',
    fgSecondary: '#57534e',
    eye: '#44403c',
    bg: '#fafaf9',
    badgeBg: '#e7e5e4',
    accent: '#78716c'
  },
  bug: {
    name: 'bug',
    label: 'Bug',
    fg: '#1a2e05',
    fgSecondary: '#4d7c0f',
    eye: '#3f6212',
    bg: '#f7fee7',
    badgeBg: '#d9f99d',
    accent: '#84cc16'
  },
  steel: {
    name: 'steel',
    label: 'Steel',
    fg: '#0f172a',
    fgSecondary: '#475569',
    eye: '#334155',
    bg: '#f8fafc',
    badgeBg: '#cbd5e1',
    accent: '#64748b'
  },
  flying: {
    name: 'flying',
    label: 'Flying',
    fg: '#172554',
    fgSecondary: '#2563eb',
    eye: '#1d4ed8',
    bg: '#eff6ff',
    badgeBg: '#bfdbfe',
    accent: '#3b82f6'
  },
  normal: {
    name: 'normal',
    label: 'Normal',
    fg: '#0f172a',
    fgSecondary: '#334155',
    eye: '#dc2626',
    bg: '#ffffff',
    badgeBg: '#f1f5f9',
    accent: '#ef4444'
  }
};

export const QUICK_STARTER_POKEMON: PokemonSummary[] = [
  { id: 25, name: 'pikachu', displayName: 'Pikachu', types: ['electric'] },
  { id: 6, name: 'charizard', displayName: 'Charizard', types: ['fire', 'flying'] },
  { id: 9, name: 'blastoise', displayName: 'Blastoise', types: ['water'] },
  { id: 1, name: 'bulbasaur', displayName: 'Bulbasaur', types: ['grass', 'poison'] },
  { id: 94, name: 'gengar', displayName: 'Gengar', types: ['ghost', 'poison'] },
  { id: 133, name: 'eevee', displayName: 'Eevee', types: ['normal'] },
  { id: 150, name: 'mewtwo', displayName: 'Mewtwo', types: ['psychic'] },
  { id: 448, name: 'lucario', displayName: 'Lucario', types: ['fighting', 'steel'] },
  { id: 658, name: 'greninja', displayName: 'Greninja', types: ['water', 'dark'] },
  { id: 384, name: 'rayquaza', displayName: 'Rayquaza', types: ['dragon', 'flying'] },
  { id: 700, name: 'sylveon', displayName: 'Sylveon', types: ['fairy'] },
  { id: 197, name: 'umbreon', displayName: 'Umbreon', types: ['dark'] }
];

export function getPaletteForTypes(types: string[]): TypePalette {
  const primary = types[0]?.toLowerCase() || 'normal';
  return POKEMON_TYPE_PALETTES[primary] ?? POKEMON_TYPE_PALETTES.normal;
}

export function getSpriteUrl(
  id: number,
  style: 'official' | 'home' | 'pixel' | 'custom',
  shiny: boolean,
  primaryType?: string
): string {
  const params = new URLSearchParams({
    style: style === 'custom' ? 'official' : style,
    shiny: shiny ? '1' : '0'
  });
  if (primaryType) params.set('type', primaryType);
  return `/api/pokemon/${id}/sprite?${params.toString()}`;
}
