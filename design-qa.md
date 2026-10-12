# Interface verification — 2026-10-12

The interface was rebuilt around the map. The file list and selected-track statistics now share a collapsible sidebar. The default playback row is 64 px on desktop and 60 px on mobile; the profile chart and basemap panel open on demand. A mobile drawer provides the same track controls as desktop.

## References

- [Felt](https://felt.com/blog/ui-upgrades): compact top toolbar and side panels.
- [gpx.studio](https://gpx.studio/help/menu/view): optional elevation profile.
- [Komoot](https://support.komoot.com/hc/en-us/articles/10194270667034-Plan-routes-on-the-website): map workspace, route overview, and profile interaction.

## Browser verification

22 interaction checks passed in Playwright: default layout, search, track selection, all three profile metrics, keyboard tabs, chart-to-map seeking, playback/pause, both timeline endpoints, GPX download, basemap selection and dismissal, cumulative map measurement and cleanup, paste focus/validation, CSV paste, local file import, repeated import, and the empty workspace.

Responsive layouts passed at 1440×900, 1024×768, 899×720, 768×1024, 390×844, and 320×568. There was no horizontal overflow. The expanded desktop dock stays within 236 px; mobile stays within 216 px. The sidebar starts closed below 900 px and remains accessible. Reduced motion disables panel translation.

Visual inspection covered desktop, expanded profile, mobile, and the mobile drawer. Credits and coordinates have separate positions. Camera fitting accounts for the viewport aspect ratio. Local rendering used fallback imagery and the standard ellipsoid surface; live Cesium ion services depend on the existing build token.

The rebuild retains IBM Plex typography, jade controls, subtle panel transitions, and client-side parsing. The old bottom file tray, fixed metrics strip, and overlapping multi-axis chart were removed.
