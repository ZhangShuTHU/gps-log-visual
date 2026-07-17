import { describe, expect, it } from 'vitest';
import { enrichTrack, interpolateTrackPoint, parseDelimited, parseNmea } from './track.js';

describe('track utilities', () => {
  it('returns null when interpolating an empty track', () => {
    expect(interpolateTrackPoint([], 50)).toBeNull();
  });

  it('returns exact track endpoints', () => {
    const points = [
      { lat: 10, lon: 20, ele: 100, distanceKm: 0, speedKmh: null, slope: null },
      { lat: 30, lon: 40, ele: 300, distanceKm: 20, speedKmh: 80, slope: 4 },
    ];

    expect(interpolateTrackPoint(points, 0)).toBe(points[0]);
    expect(interpolateTrackPoint(points, 100)).toBe(points[1]);
  });

  it('clamps interpolation progress to the track range', () => {
    const points = [
      { lat: 10, lon: 20 },
      { lat: 30, lon: 40 },
    ];

    expect(interpolateTrackPoint(points, -20)).toBe(points[0]);
    expect(interpolateTrackPoint(points, 120)).toBe(points[1]);
  });

  it('interpolates finite numeric fields at the midpoint', () => {
    const points = [
      { lat: 10, lon: 20, ele: null, distanceKm: 0, speedKmh: 40, slope: -2 },
      { lat: 30, lon: 40, ele: 300, distanceKm: 20, speedKmh: 80, slope: 4 },
    ];

    expect(interpolateTrackPoint(points, 50)).toMatchObject({
      lat: 20,
      lon: 30,
      ele: 300,
      distanceKm: 10,
      speedKmh: 60,
      slope: 1,
    });
  });

  it('computes distance and elevation gain with noise thresholding', () => {
    const track = enrichTrack([
      { lat: 0, lon: 0, ele: 100, time: '2024-01-01T00:00:00Z' },
      { lat: 0, lon: 1, ele: 103, time: '2024-01-01T01:00:00Z' },
      { lat: 0, lon: 2, ele: 120, time: '2024-01-01T02:00:00Z' },
    ]);

    expect(track.stats.distanceKm).toBeGreaterThan(220);
    expect(track.stats.distanceKm).toBeLessThan(224);
    expect(track.stats.ascentM).toBe(17);
    expect(track.stats.points).toBe(3);
  });

  it('detects common CSV coordinate field names', () => {
    const points = parseDelimited('latitude,longitude,altitude,timestamp\n39.9,116.4,44,2024-01-01T00:00:00Z');

    expect(points).toEqual([
      {
        lat: 39.9,
        lon: 116.4,
        ele: 44,
        time: '2024-01-01T00:00:00.000Z',
      },
    ]);
  });

  it('parses RMC and GGA NMEA sentences into WGS84 points', () => {
    const points = parseNmea(
      [
        '$GPGGA,092750.000,5321.6802,N,00630.3372,W,1,8,1.03,61.7,M,55.2,M,,*76',
        '$GPRMC,092751.000,A,5321.6802,N,00630.3372,W,0.06,31.66,280511,,,A*43',
      ].join('\n'),
    );

    expect(points).toHaveLength(1);
    expect(points[0].lat).toBeCloseTo(53.361336, 5);
    expect(points[0].lon).toBeCloseTo(-6.50562, 5);
    expect(points[0].ele).toBe(61.7);
    expect(points[0].time).toBe('2011-05-28T09:27:51Z');
  });
});
