# PokéQR Studio

Custom Pokémon QR Code Generator for sharing links, uploaded files, link+file bundles, and small offline payloads.

## Features
- **Share Links & Files**: Direct URLs, hosted PokéDrop short links, multi-file drag-and-drop uploads, combined link+file boxes, `.zip` archive downloads, PIN protection, expiry controls, and LAN Wi-Fi IP detection for phone scanning.
- **Pokémon Picker**: Search 1,025+ Pokémon (via PokéAPI with local caching & offline fallback), toggle Shiny variants, pick Official HD / 3D Home / Retro Pixel sprites, or upload a custom image.
- **6 Custom QR Styles**:
  - **8-Bit Pixel Sprite**: Grid-snapped pixel Pokémon inside retro QR modules with mask optimization (`0–7`).
  - **Neon Scene Glow**: Synthwave/elemental glowing scene with neon corner eyes, alignment patterns, and glowing QR tiles.
  - **Center Badge**: Framed Pokéball / circle / squircle centerpiece.
  - **Halftone Art Blend**: Pokémon artwork woven across QR module borders.
  - **Art Backdrop** & **Clean Theme**: Custom module shapes (`square`, `rounded`, `dots`, `pixel`, `liquid`), Pokéball/Great/Ultra/Master Ball finder eyes, 18 type palettes, and Collectible Share Card export.
- **Live Scannability Check**: Verifies the rendered canvas in real time with `jsqr`.

## Quick Start (Windows)
Double-click `Start-PokeQR.bat` or run:
```bash
npm install
npm run build
npm start
```
For development with Vite HMR:
```bash
npm run dev
```
