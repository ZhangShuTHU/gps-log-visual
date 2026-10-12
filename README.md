# Atlas Canvas

Local-first GPS log visualization app inspired by GPS Visualizer.

## Features

- Import local GPX, KML, GeoJSON, CSV, TXT, and NMEA files.
- Paste log text directly in the browser.
- Render tracks on a CesiumJS 3D globe with Cesium World Terrain.
- Use a collapsible track sidebar and a compact 64 px desktop / 60 px mobile playback bar.
- Follow the real UTC sun position for automatic day/night and dawn/dusk shading at every longitude.
- Switch between Cesium ion satellite/road imagery, Esri topographic tiles, and the built-in Natural Earth basemap.
- Inspect distance, duration, speed, ascent, descent, and points in the sidebar. Expand elevation/speed/slope profiles on demand and click the chart to seek along the track.
- Measure cumulative surface distance by clicking points on the map.
- Export the active track as GPX, KML, CSV, or PNG.

## Interface

The map remains the main workspace. Track files and statistics share the left sidebar, which becomes an overlay drawer on smaller screens. The bottom bar contains playback controls; the profile chart and basemap picker stay closed until opened. Log files can be dropped anywhere on the workspace. The profile tabs support arrow keys, and Escape dismisses open popovers or the paste dialog.

The layout draws on [Felt's compact toolbar and side panels](https://felt.com/blog/ui-upgrades), [gpx.studio's optional elevation profile](https://gpx.studio/help/menu/view), and [Komoot's map and route overview](https://support.komoot.com/hc/en-us/articles/10194270667034-Plan-routes-on-the-website).

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
