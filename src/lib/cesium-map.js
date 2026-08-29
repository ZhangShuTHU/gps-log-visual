import {
  BoundingSphere,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidTerrainProvider,
  HeadingPitchRange,
  HeightReference,
  Ion,
  IonWorldImageryStyle,
  Math as CesiumMath,
  OpenStreetMapImageryProvider,
  PolylineGlowMaterialProperty,
  SceneMode,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  TileMapServiceImageryProvider,
  UrlTemplateImageryProvider,
  Viewer,
  buildModuleUrl,
  createWorldImageryAsync,
  createWorldTerrainAsync,
} from 'cesium';

const ionToken = import.meta.env.VITE_CESIUM_ION_TOKEN?.trim() ?? '';
const routeColors = ['#2673d9', '#1c9ed8', '#20a566', '#d4a011', '#e24a2e'];

export const hasCesiumIonToken = Boolean(ionToken);

export const basemaps = [
  {
    id: 'satellite',
    name: '卫星影像',
    scope: 'Cesium ion · 全球',
    color: 'linear-gradient(135deg, #132b2a, #53705c 52%, #a9865b)',
  },
  {
    id: 'road',
    name: '道路地图',
    scope: 'Cesium ion · 全球',
    color: 'linear-gradient(135deg, #dfe9df, #d2d7c5 52%, #8eb4cd)',
  },
  {
    id: 'topographic',
    name: '地形图',
    scope: 'Esri · 全球',
    color: 'linear-gradient(135deg, #c8d2af, #e9d9b5 56%, #8fb6ba)',
  },
  {
    id: 'natural-earth',
    name: '自然地球',
    scope: 'Cesium 内置',
    color: 'linear-gradient(135deg, #9dc5d4, #c8d59c 56%, #b68c62)',
  },
];

if (hasCesiumIonToken) {
  Ion.defaultAccessToken = ionToken;
}

export function createCesiumViewer(container) {
  const viewer = new Viewer(container, {
    animation: false,
    baseLayer: false,
    baseLayerPicker: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    navigationHelpButton: false,
    scene3DOnly: true,
    sceneMode: SceneMode.SCENE3D,
    sceneModePicker: false,
    selectionIndicator: false,
    timeline: false,
    terrainProvider: new EllipsoidTerrainProvider(),
    vrButton: false,
    contextOptions: {
      webgl: {
        alpha: false,
        preserveDrawingBuffer: true,
      },
    },
  });

  viewer.scene.globe.baseColor = Color.fromCssColorString('#dbe7df');
  viewer.scene.globe.depthTestAgainstTerrain = true;
  viewer.scene.highDynamicRange = true;
  viewer.scene.postProcessStages.fxaa.enabled = true;
  viewer.scene.skyAtmosphere.atmosphereLightIntensity = 10;
  viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
  viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 1.5);
  viewer.camera.setView({
    destination: Cartesian3.fromDegrees(18, 36, 12_500_000),
    orientation: {
      heading: 0,
      pitch: CesiumMath.toRadians(-68),
      roll: 0,
    },
  });

  return viewer;
}

export async function createBasemapProvider(id) {
  try {
    if (id === 'natural-earth') {
      return {
        provider: await TileMapServiceImageryProvider.fromUrl(
          buildModuleUrl('Assets/Textures/NaturalEarthII'),
        ),
        fallback: false,
      };
    }

    if (id === 'topographic') {
      return {
        provider: new UrlTemplateImageryProvider({
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
          credit: 'Tiles © Esri — Esri, HERE, Garmin, OpenStreetMap contributors',
          maximumLevel: 19,
        }),
        fallback: false,
      };
    }

    if (hasCesiumIonToken) {
      const style = id === 'road'
        ? IonWorldImageryStyle.ROAD
        : IonWorldImageryStyle.AERIAL_WITH_LABELS;
      return {
        provider: await createWorldImageryAsync({ style }),
        fallback: false,
      };
    }
  } catch {
    // A scoped or expired ion token should not leave the globe blank.
  }

  return { provider: createOpenStreetMapProvider(), fallback: true };
}

let worldTerrainPromise;

export function getWorldTerrainProvider() {
  if (!hasCesiumIonToken) return Promise.resolve(null);
  worldTerrainPromise ??= createWorldTerrainAsync({
    requestVertexNormals: true,
    requestWaterMask: true,
  });
  return worldTerrainPromise;
}

export function useEllipsoidTerrain(viewer) {
  viewer.terrainProvider = new EllipsoidTerrainProvider();
  viewer.scene.requestRender();
}

export function renderTrack(viewer, track) {
  if (!track?.points.length) return { routeEntities: [], cursorEntity: null };

  const segments = splitTrack(track.points, routeColors.length);
  const routeEntities = segments.map((points, index) => {
    const color = Color.fromCssColorString(routeColors[index]);
    return viewer.entities.add({
      id: `active-route-${index}`,
      polyline: {
        positions: points.map((point) => Cartesian3.fromDegrees(point.lon, point.lat)),
        width: 6,
        clampToGround: true,
        material: new PolylineGlowMaterialProperty({
          color,
          glowPower: 0.16,
          taperPower: 0.35,
        }),
        depthFailMaterial: color.withAlpha(0.72),
      },
    });
  });

  const firstPoint = track.points[0];
  const cursorEntity = viewer.entities.add({
    id: 'active-route-cursor',
    position: Cartesian3.fromDegrees(firstPoint.lon, firstPoint.lat),
    point: {
      pixelSize: 11,
      color: Color.WHITE,
      outlineColor: Color.fromCssColorString('#0f5132'),
      outlineWidth: 4,
      heightReference: HeightReference.CLAMP_TO_GROUND,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  viewer.scene.requestRender();
  return { routeEntities, cursorEntity };
}

export function removeTrack(viewer, renderedTrack) {
  for (const entity of renderedTrack?.routeEntities ?? []) {
    viewer.entities.remove(entity);
  }
  if (renderedTrack?.cursorEntity) {
    viewer.entities.remove(renderedTrack.cursorEntity);
  }
  viewer.scene.requestRender();
}

export function updateTrackCursor(viewer, entity, point) {
  if (!entity || !point) return;
  entity.position = Cartesian3.fromDegrees(point.lon, point.lat);
  viewer.scene.requestRender();
}

export function flyToTrack(viewer, track, duration = 0.9) {
  if (!track?.points.length) return;
  const positions = track.points.map((point) => Cartesian3.fromDegrees(point.lon, point.lat));
  const sphere = BoundingSphere.fromPoints(positions);
  const range = Math.max(24_000, sphere.radius * 2.65);

  viewer.camera.flyToBoundingSphere(sphere, {
    duration,
    offset: new HeadingPitchRange(0, CesiumMath.toRadians(-58), range),
  });
}

export function pickGlobePosition(viewer, screenPosition) {
  const ray = viewer.camera.getPickRay(screenPosition);
  const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
  if (!cartesian) return null;

  const cartographic = Cartographic.fromCartesian(cartesian);
  return {
    lat: CesiumMath.toDegrees(cartographic.latitude),
    lon: CesiumMath.toDegrees(cartographic.longitude),
    ele: Math.max(0, cartographic.height),
  };
}

export function attachMapTelemetry(viewer, { onCursor, onCameraHeight }) {
  const handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
  let pendingPosition = null;
  let frameId = null;

  handler.setInputAction((movement) => {
    pendingPosition = movement.endPosition;
    if (frameId != null) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = null;
      const point = pickGlobePosition(viewer, pendingPosition);
      if (point) onCursor(point);
    });
  }, ScreenSpaceEventType.MOUSE_MOVE);

  const publishCameraHeight = () => {
    onCameraHeight(viewer.camera.positionCartographic.height);
  };
  const removeCameraListener = viewer.camera.changed.addEventListener(publishCameraHeight);
  publishCameraHeight();

  return () => {
    if (frameId != null) window.cancelAnimationFrame(frameId);
    removeCameraListener();
    handler.destroy();
  };
}

function createOpenStreetMapProvider() {
  return new OpenStreetMapImageryProvider({
    url: 'https://tile.openstreetmap.org/',
    credit: '© OpenStreetMap contributors',
  });
}

function splitTrack(points, segmentCount) {
  if (points.length < 2) return points.length ? [points] : [];

  const segments = [];
  const lastIndex = points.length - 1;
  const resolvedSegmentCount = Math.min(segmentCount, lastIndex);

  for (let index = 0; index < resolvedSegmentCount; index += 1) {
    const start = Math.floor((index / resolvedSegmentCount) * lastIndex);
    const end = index === resolvedSegmentCount - 1
      ? lastIndex
      : Math.max(start + 1, Math.ceil(((index + 1) / resolvedSegmentCount) * lastIndex));
    const segment = points.slice(start, end + 1);
    if (segment.length >= 2) segments.push(segment);
  }

  return segments;
}
