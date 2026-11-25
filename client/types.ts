export type QrMode =
  | 'pixelart'
  | 'neonscene'
  | 'badge'
  | 'halftone'
  | 'backdrop'
  | 'classic';

export type QrModuleShape = 'square' | 'rounded' | 'dots' | 'pixel' | 'liquid';
export type QrEyeShape = 'square' | 'rounded' | 'pokeball' | 'greatball' | 'ultraball' | 'masterball';
export type QrEcLevel = 'L' | 'M' | 'Q' | 'H';
export type ArtworkStyle = 'official' | 'home' | 'pixel' | 'custom';
export type NeonSceneTheme = 'synthwave' | 'cyber' | 'inferno' | 'aurora' | 'ocean' | 'type';

export interface PokemonSummary {
  id: number;
  name: string;
  displayName: string;
  types: string[];
}

export interface SelectedPokemon {
  id: number;
  name: string;
  displayName: string;
  types: string[];
  shiny: boolean;
  artworkStyle: ArtworkStyle;
  customImageDataUrl?: string;
}

export interface QrStyleConfig {
  mode: QrMode;
  moduleShape: QrModuleShape;
  eyeShape: QrEyeShape;
  ecLevel: QrEcLevel;
  fgColor: string;
  fgSecondaryColor: string;
  useGradient: boolean;
  bgColor: string;
  eyeColor: string;
  badgeSizeRatio: number; // 0.16 to 0.28
  badgeShape: 'circle' | 'squircle' | 'pokeball';
  halftoneIntensity: number; // 0.2 to 0.95
  backdropOpacity: number; // 0.1 to 0.6
  pixelSpriteScale: number; // 0.28 to 0.50
  pixelSafeDots: boolean;
  neonTheme: NeonSceneTheme;
  neonGlowStrength: number; // 0.2 to 1.0
  neonInverted: boolean;
  quietZoneModules: number; // 2 to 5
  includeCardFrame: boolean;
  cardHeadline: string;
  cardSubtitle: string;
}

export interface QrVerificationResult {
  verified: boolean;
  decodedText: string | null;
  matchesTarget: boolean;
  contrastRatio: number;
  moduleCount: number;
  inverted?: boolean;
  warning: string | null;
}

export type PayloadMode = 'link' | 'file' | 'bundle' | 'inline';

export interface DraftLinkItem {
  id: string;
  label: string;
  url: string;
}

export interface PublicFileInfo {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface PublicShareInfo {
  id: string;
  kind: 'link' | 'file' | 'bundle';
  title: string;
  note: string;
  pokemon: {
    id: number;
    name: string;
    displayName: string;
    types: string[];
    shiny?: boolean;
    artworkStyle?: ArtworkStyle;
  } | null;
  hasPin: boolean;
  unlocked: boolean;
  directRedirect: boolean;
  createdAt: string;
  expiresAt: string | null;
  maxDownloads: number | null;
  views: number;
  downloads: number;
  linksCount: number;
  filesCount: number;
  links?: DraftLinkItem[];
  files?: PublicFileInfo[];
}

export interface NetworkInfo {
  requestOrigin: string;
  recommendedShareBase: string;
  lanAddresses: Array<{
    label: string;
    address: string;
    url: string;
    isPrimary: boolean;
  }>;
  port: number;
}
