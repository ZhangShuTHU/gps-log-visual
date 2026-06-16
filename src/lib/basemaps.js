const tiandituToken = import.meta.env.VITE_TIANDITU_TOKEN || '';

export const basemaps = [
  {
    id: 'standard',
    name: 'Standard',
    scope: 'Global',
    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap contributors',
    color: '#a9d5ef',
  },
  {
    id: 'terrain',
    name: 'Terrain',
    scope: 'Global',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Tiles © Esri © OpenStreetMap contributors',
    color: '#d8d0b8',
  },
  {
    id: 'satellite',
    name: 'Satellite',
    scope: 'Global',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Tiles © Esri',
    color: '#29433f',
  },
  {
    id: 'tianditu-terrain',
    name: 'Tianditu Terrain',
    scope: tiandituToken ? 'China-ready' : 'Key required',
    tiles: tiandituToken
      ? [`https://t0.tianditu.gov.cn/DataServer?T=ter_w&x={x}&y={y}&l={z}&tk=${tiandituToken}`]
      : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: tiandituToken ? '© 天地图' : 'Tianditu token required',
    color: '#d2d9c2',
    needsKey: !tiandituToken,
  },
  {
    id: 'custom',
    name: 'Custom XYZ',
    scope: 'Configurable',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: 'Custom tile URL',
    color: '#eef0ef',
    custom: true,
  },
];

export function makeRasterStyle(provider) {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      base: {
        type: 'raster',
        tiles: provider.tiles,
        tileSize: 256,
        attribution: provider.attribution,
      },
    },
    layers: [
      {
        id: 'base',
        type: 'raster',
        source: 'base',
      },
    ],
  };
}
