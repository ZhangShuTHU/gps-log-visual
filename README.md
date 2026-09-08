# Atlas Canvas

Local-first GPS log visualization app inspired by GPS Visualizer.

## Features

- Import local GPX, KML, GeoJSON, CSV, TXT, and NMEA files.
- Paste log text directly in the browser.
- Render tracks on a CesiumJS 3D globe with Cesium World Terrain.
- Follow the real UTC sun position for automatic day/night and dawn/dusk shading at every longitude.
- Switch between Cesium ion satellite/road imagery, Esri topographic tiles, and the built-in Natural Earth basemap.
- Inspect distance, duration, speed, ascent, descent, points, and elevation/speed/slope profiles.
- Export the active track as GPX, KML, CSV, or PNG.

## Local Development

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173`.

For live Cesium ion imagery and terrain, add a local `.env.local` file:

```bash
VITE_CESIUM_ION_TOKEN=your_scoped_cesium_ion_token
```

Without a token, the app falls back to OpenStreetMap imagery and an ellipsoid surface.

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

Environment variables:

- `VITE_CESIUM_ION_TOKEN`: enables Cesium ion imagery and Cesium World Terrain. Configure it as a Cloudflare Pages build variable and scope the token to the deployed origins.

All GPS parsing runs client-side in the browser; uploaded logs are not sent to an app backend.
