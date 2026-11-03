import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ArcGisMapServerImageryProvider,
  DynamicAtmosphereLightingType,
  OpenStreetMapImageryProvider,
  TileMapServiceImageryProvider,
  Viewer,
  createWorldImageryAsync,
} from 'cesium';
import { createBasemapProvider, createCesiumViewer, setDayNightLighting } from './cesium-map.js';

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
