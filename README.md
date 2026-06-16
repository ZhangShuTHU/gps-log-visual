# Atlas Canvas

Local-first GPS log visualization app inspired by GPS Visualizer.

## Features

- Import local GPX, KML, GeoJSON, CSV, TXT, and NMEA files.
- Paste log text directly in the browser.
- Render tracks on a global MapLibre map.
- Switch basemaps: Standard, Terrain, Satellite, Tianditu-ready, and Custom XYZ placeholder.
- Inspect distance, duration, speed, ascent, descent, points, and elevation/speed/slope profiles.
- Export the active track as GPX, KML, CSV, or PNG.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

## Checks

```bash
npm test
npm run build
npm audit --audit-level=high
```

## Cloudflare Pages

Recommended Pages settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`
- Node.js version: `22`

Optional environment variables:

- `VITE_TIANDITU_TOKEN`: enables live Tianditu terrain tiles.

All GPS parsing runs client-side in the browser; uploaded logs are not sent to an app backend.
