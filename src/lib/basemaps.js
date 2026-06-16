const tiandituToken = import.meta.env.VITE_TIANDITU_TOKEN || '';

export const basemaps = [
  {
    id: 'standard',
    name: '标准',
    scope: '全球',
    tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: 'OpenStreetMap contributors',
    color: '#a9d5ef',
  },
  {
    id: 'terrain',
    name: '地形',
    scope: '全球',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Tiles by Esri, OpenStreetMap contributors',
    color: '#d8d0b8',
  },
  {
    id: 'satellite',
    name: '卫星',
    scope: '全球',
    tiles: [
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    ],
    attribution: 'Tiles by Esri',
    color: '#29433f',
  },
  {
    id: 'tianditu-terrain',
    name: '天地图地形',
    scope: tiandituToken ? '中国可用' : '需要密钥',
    tiles: tiandituToken
      ? [`https://t0.tianditu.gov.cn/DataServer?T=ter_w&x={x}&y={y}&l={z}&tk=${tiandituToken}`]
      : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: tiandituToken ? '天地图' : '需要天地图 Token',
    color: '#d2d9c2',
    needsKey: !tiandituToken,
  },
  {
    id: 'custom',
    name: '自定义 XYZ',
    scope: '可配置',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '自定义瓦片 URL',
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
