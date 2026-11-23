import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArcGisMapServerImageryProvider,
  Cartographic,
  DynamicAtmosphereLightingType,
  EntityCollection,
  OpenStreetMapImageryProvider,
  PolylineOutlineMaterialProperty,
  TileMapServiceImageryProvider,
  Viewer,
  createWorldImageryAsync,
} from 'cesium';
import { createBasemapProvider, createCesiumViewer, flyToTrack, removeTrack, renderTrack, setDayNightLighting } from './cesium-map.js';

vi.mock('cesium', async (importOriginal) => ({
  ...await importOriginal(),
  ArcGisMapServerImageryProvider: { fromUrl: vi.fn() },
  TileMapServiceImageryProvider: { fromUrl: vi.fn() },
  Viewer: vi.fn(),
  createWorldImageryAsync: vi.fn(),
}));

vi.hoisted(() => vi.stubEnv('VITE_CESIUM_ION_TOKEN', ''));

beforeEach(() => vi.resetAllMocks());

describe('basemap sources without a Cesium ion token', () => {
  it('loads actual satellite imagery instead of substituting a road map', async () => {
    const imagery = { id: 'satellite-imagery' };
    ArcGisMapServerImageryProvider.fromUrl.mockResolvedValueOnce(imagery);

    expect(await createBasemapProvider('satellite')).toEqual({ provider: imagery, fallback: false });
    expect(ArcGisMapServerImageryProvider.fromUrl).toHaveBeenCalledWith(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer',
      { enablePickFeatures: false },
    );
    expect(createWorldImageryAsync).not.toHaveBeenCalled();
  });

  it('treats OpenStreetMap as the normal road map when no token is configured', async () => {
    const result = await createBasemapProvider('road');

    expect(result.provider).toBeInstanceOf(OpenStreetMapImageryProvider);
    expect(result.fallback).toBe(false);
  });

  it('keeps a local globe available if the satellite service cannot load', async () => {
    const localImagery = { id: 'local-natural-earth' };
    ArcGisMapServerImageryProvider.fromUrl.mockRejectedValueOnce(new Error('offline'));
    TileMapServiceImageryProvider.fromUrl.mockResolvedValueOnce(localImagery);

    expect(await createBasemapProvider('satellite')).toEqual({
      provider: localImagery,
      fallback: true,
      fallbackName: '自然地球',
    });
    expect(TileMapServiceImageryProvider.fromUrl).toHaveBeenCalledWith(
      expect.stringContaining('Assets/Textures/NaturalEarthII'),
    );
  });
});

function makeViewer(msaaSupported = true) {
  return {
    clock: {},
    camera: { setView: vi.fn() },
    scene: {
      globe: {},
      atmosphere: {},
      skyAtmosphere: {},
      screenSpaceCameraController: {},
      postProcessStages: { fxaa: { enabled: true } },
      requestRender: vi.fn(),
      msaaSupported,
    },
  };
}

describe('map clarity', () => {
  it('renders at device resolution and refines map tiles without FXAA blur when MSAA is available', () => {
    const viewer = makeViewer();
    Viewer.mockImplementationOnce(function () { return viewer; });

    expect(createCesiumViewer({})).toBe(viewer);
    expect(Viewer.mock.calls[0][1].useBrowserRecommendedResolution).toBe(false);
    expect(viewer.resolutionScale).toBe(1);
    expect(viewer.scene.globe.maximumScreenSpaceError).toBe(1);
    expect(viewer.scene.postProcessStages.fxaa.enabled).toBe(false);
  });

  it('retains FXAA when the device cannot use MSAA', () => {
    const viewer = makeViewer(false);
    Viewer.mockImplementationOnce(function () { return viewer; });

    createCesiumViewer({});
    expect(viewer.scene.postProcessStages.fxaa.enabled).toBe(true);
  });
});

describe('track visibility', () => {
  const points = [
    { lon: 121.49566, lat: 31.23972 },
    { lon: 121.4968, lat: 31.24054 },
    { lon: 121.4981, lat: 31.2417 },
  ];

  it('draws the full track as one outlined ground line and removes it with the cursor', () => {
    const viewer = makeViewer();
    viewer.entities = new EntityCollection();

    const rendered = renderTrack(viewer, { points });
    const { polyline } = rendered.routeEntity;
    expect(viewer.entities.values).toEqual([rendered.routeEntity, rendered.cursorEntity]);
    expect(polyline.positions.getValue()).toHaveLength(points.length);
    expect(polyline.clampToGround.getValue()).toBe(true);
    expect(polyline.width.getValue()).toBeGreaterThan(6);
    expect(polyline.material).toBeInstanceOf(PolylineOutlineMaterialProperty);

    removeTrack(viewer, rendered);
    expect(viewer.entities.values).toHaveLength(0);
  });

  it('draws only a cursor for a single point and no entities for an empty workspace', () => {
    const viewer = makeViewer();
    viewer.entities = new EntityCollection();

    renderTrack(viewer, undefined);
    expect(viewer.entities.values).toHaveLength(0);

    const rendered = renderTrack(viewer, { points: points.slice(0, 1) });
    expect(rendered.routeEntity).toBeNull();
    expect(viewer.entities.values).toEqual([rendered.cursorEntity]);
  });

  it.each([
    { groundHeight: 2300, centerHeight: 2300 },
    { groundHeight: -3700, centerHeight: 0 },
  ])('fits a short track above a terrain sample of $groundHeight m', ({ groundHeight, centerHeight }) => {
    const viewer = makeViewer();
    viewer.resize = vi.fn();
    viewer.camera.frustum = { fovy: Math.PI / 3, aspectRatio: 1.5 };
    viewer.camera.flyToBoundingSphere = vi.fn();
    viewer.scene.globe.getHeight = vi.fn(() => groundHeight);

    flyToTrack(viewer, { points });

    const [[sphere, { offset }]] = viewer.camera.flyToBoundingSphere.mock.calls;
    expect(offset.range).toBeLessThan(1_000);
    expect(Cartographic.fromCartesian(sphere.center).height).toBeCloseTo(centerHeight, 0);
  });
});

describe('day/night lighting', () => {
  it('switches both the globe and atmosphere off, then restores solar lighting', () => {
    const viewer = makeViewer();

    setDayNightLighting(viewer, false);
    expect(viewer.scene.globe.enableLighting).toBe(false);
    expect(viewer.scene.globe.dynamicAtmosphereLighting).toBe(false);
    expect(viewer.scene.globe.dynamicAtmosphereLightingFromSun).toBe(false);
    expect(viewer.scene.atmosphere.dynamicLighting).toBe(DynamicAtmosphereLightingType.NONE);

    setDayNightLighting(viewer, true);
    expect(viewer.scene.globe.enableLighting).toBe(true);
    expect(viewer.scene.globe.dynamicAtmosphereLighting).toBe(true);
    expect(viewer.scene.globe.dynamicAtmosphereLightingFromSun).toBe(true);
    expect(viewer.scene.atmosphere.dynamicLighting).toBe(DynamicAtmosphereLightingType.SUNLIGHT);
    expect(viewer.scene.requestRender).toHaveBeenCalledTimes(2);
  });
});
