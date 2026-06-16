import Papa from 'papaparse';
import { gpx, kml } from '@tmcw/togeojson';

const earthRadiusKm = 6371.0088;

export function haversineKm(a, b) {
  const toRad = (value) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function normalizePoints(points) {
  return points
    .map((point) => ({
      lon: Number(point.lon ?? point[0]),
      lat: Number(point.lat ?? point[1]),
      ele: Number.isFinite(Number(point.ele ?? point[2])) ? Number(point.ele ?? point[2]) : null,
      time: normalizeTime(point.time ?? point[3] ?? null),
    }))
    .filter((point) => Number.isFinite(point.lon) && Number.isFinite(point.lat) && Math.abs(point.lon) <= 180 && Math.abs(point.lat) <= 90);
}

export function enrichTrack(rawPoints) {
  const points = normalizePoints(rawPoints);
  let distanceKm = 0;
  let ascentM = 0;
  let descentM = 0;
  const enriched = points.map((point, index) => {
    if (index > 0) {
      const prev = points[index - 1];
      const segmentKm = haversineKm(prev, point);
      distanceKm += segmentKm;
      if (point.ele != null && prev.ele != null) {
        const delta = point.ele - prev.ele;
        if (delta > 3) ascentM += delta;
        if (delta < -3) descentM += Math.abs(delta);
      }
    }
    const previous = index > 0 ? points[index - 1] : null;
    const timeDeltaHours =
      previous?.time && point.time
        ? Math.max(0, (Date.parse(point.time) - Date.parse(previous.time)) / 3600000)
        : 0;
    const segmentKm = previous ? haversineKm(previous, point) : 0;
    const speedKmh = timeDeltaHours > 0 ? segmentKm / timeDeltaHours : null;
    const slope = previous?.ele != null && point.ele != null && segmentKm > 0 ? ((point.ele - previous.ele) / (segmentKm * 1000)) * 100 : null;
    return {
      ...point,
      distanceKm,
      speedKmh,
      slope,
    };
  });

  return {
    points: enriched,
    stats: computeStats(enriched, ascentM, descentM),
  };
}

export function computeStats(points, ascentM = 0, descentM = 0) {
  const first = points[0];
  const last = points.at(-1);
  const distanceKm = last?.distanceKm ?? 0;
  const elevations = points.map((p) => p.ele).filter((value) => value != null);
  const speeds = points.map((p) => p.speedKmh).filter((value) => value != null && Number.isFinite(value));
  const elapsedMs = first?.time && last?.time ? Math.max(0, Date.parse(last.time) - Date.parse(first.time)) : 0;
  const durationHours = elapsedMs / 3600000;

  return {
    distanceKm,
    durationHours,
    movingSpeedKmh: durationHours > 0 ? distanceKm / durationHours : average(speeds),
    maxSpeedKmh: speeds.length ? Math.max(...speeds) : 0,
    ascentM,
    descentM,
    minElevationM: elevations.length ? Math.min(...elevations) : null,
    maxElevationM: elevations.length ? Math.max(...elevations) : null,
    points: points.length,
    quality: qualityFlags(points, speeds),
  };
}

export function makeTrackDocument({ id, name, color, points, size = '' }) {
  const enriched = enrichTrack(points);
  return {
    id,
    name,
    color,
    size,
    ...enriched,
  };
}

export async function parseFile(file) {
  const text = await file.text();
  return parseText(text, file.name, file.size);
}

export function parseText(text, name = 'Pasted log', byteSize = 0) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.gpx') || text.trim().startsWith('<gpx')) {
    return fromGeoJson(gpx(new DOMParser().parseFromString(text, 'application/xml')), name, byteSize);
  }
  if (lower.endsWith('.kml') || text.trim().startsWith('<kml')) {
    return fromGeoJson(kml(new DOMParser().parseFromString(text, 'application/xml')), name, byteSize);
  }
  if (lower.endsWith('.json') || lower.endsWith('.geojson') || text.trim().startsWith('{')) {
    return fromGeoJson(JSON.parse(text), name, byteSize);
  }
  if (text.includes('$GPRMC') || text.includes('$GNRMC') || text.includes('$GPGGA') || text.includes('$GNGGA')) {
    const points = parseNmea(text);
    return makeTrackDocument({ id: crypto.randomUUID(), name, color: '#1f8edb', points, size: formatBytes(byteSize) });
  }
  const points = parseDelimited(text);
  return makeTrackDocument({ id: crypto.randomUUID(), name, color: '#1f8edb', points, size: formatBytes(byteSize) });
}

export function parseDelimited(text) {
  const parsed = Papa.parse(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  });
  if (!parsed.data.length || parsed.errors.length) {
    const rows = Papa.parse(text, { dynamicTyping: true, skipEmptyLines: true }).data;
    return rows.map((row) => ({ lat: row[0], lon: row[1], ele: row[2], time: normalizeTime(row[3]) }));
  }
  return parsed.data.map((row) => {
    const lat = pick(row, ['lat', 'latitude', 'y']);
    const lon = pick(row, ['lon', 'lng', 'longitude', 'x']);
    const ele = pick(row, ['ele', 'elevation', 'alt', 'altitude']);
    const time = normalizeTime(pick(row, ['time', 'timestamp', 'date', 'datetime']));
    return { lat, lon, ele, time };
  });
}

export function parseNmea(text) {
  const points = [];
  let pendingElevation = null;
  for (const line of text.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean.startsWith('$')) continue;
    const sentence = clean.split('*')[0].slice(1).split(',');
    const type = sentence[0];
    if (type.endsWith('GGA')) {
      pendingElevation = Number(sentence[9]);
      continue;
    }
    if (type.endsWith('RMC') && sentence[2] === 'A') {
      const lat = nmeaCoordinate(sentence[3], sentence[4]);
      const lon = nmeaCoordinate(sentence[5], sentence[6]);
      const time = nmeaTime(sentence[1], sentence[9]);
      points.push({ lat, lon, ele: pendingElevation, time });
    }
  }
  return points;
}

export function toGeoJson(track) {
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { id: track.id, name: track.name },
        geometry: {
          type: 'LineString',
          coordinates: track.points.map((point) => [point.lon, point.lat, point.ele ?? 0]),
        },
      },
    ],
  };
}

export function toGpx(track) {
  const trkpts = track.points
    .map((point) => {
      const ele = point.ele != null ? `<ele>${point.ele.toFixed(1)}</ele>` : '';
      const time = point.time ? `<time>${new Date(point.time).toISOString()}</time>` : '';
      return `<trkpt lat="${point.lat}" lon="${point.lon}">${ele}${time}</trkpt>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Atlas Canvas"><trk><name>${escapeXml(track.name)}</name><trkseg>${trkpts}</trkseg></trk></gpx>`;
}

export function toKml(track) {
  const coordinates = track.points.map((point) => `${point.lon},${point.lat},${point.ele ?? 0}`).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>${escapeXml(track.name)}</name><LineString><tessellate>1</tessellate><coordinates>${coordinates}</coordinates></LineString></Placemark></Document></kml>`;
}

export function toCsv(track) {
  const rows = ['lat,lon,elevation_m,time,distance_km,speed_kmh,slope_percent'];
  for (const point of track.points) {
    rows.push([
      point.lat,
      point.lon,
      point.ele ?? '',
      point.time ?? '',
      point.distanceKm.toFixed(4),
      point.speedKmh?.toFixed(2) ?? '',
      point.slope?.toFixed(2) ?? '',
    ].join(','));
  }
  return rows.join('\n');
}

export function formatDuration(hours) {
  if (!hours) return '0h';
  const days = Math.floor(hours / 24);
  const rest = hours - days * 24;
  const wholeHours = Math.floor(rest);
  const minutes = Math.round((rest - wholeHours) * 60);
  return days ? `${days}d ${wholeHours}h ${minutes}m` : `${wholeHours}h ${minutes}m`;
}

export function formatBytes(bytes) {
  if (!bytes) return 'local';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fromGeoJson(geojson, name, byteSize) {
  const coordinates = [];
  for (const feature of geojson.features ?? []) {
    const geometry = feature.geometry;
    if (!geometry) continue;
    if (geometry.type === 'LineString') coordinates.push(...geometry.coordinates);
    if (geometry.type === 'MultiLineString') coordinates.push(...geometry.coordinates.flat());
    if (geometry.type === 'Point') coordinates.push(geometry.coordinates);
  }
  return makeTrackDocument({ id: crypto.randomUUID(), name, color: '#1f8edb', points: coordinates, size: formatBytes(byteSize) });
}

function pick(row, candidates) {
  const keys = Object.keys(row);
  const match = keys.find((key) => candidates.includes(key.trim().toLowerCase()));
  return match ? row[match] : null;
}

function normalizeTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function nmeaCoordinate(raw, direction) {
  if (!raw) return null;
  const degreeDigits = direction === 'N' || direction === 'S' ? 2 : 3;
  const degrees = Number(raw.slice(0, degreeDigits));
  const minutes = Number(raw.slice(degreeDigits));
  const sign = direction === 'S' || direction === 'W' ? -1 : 1;
  return sign * (degrees + minutes / 60);
}

function nmeaTime(time, date) {
  if (!time || !date) return null;
  const day = date.slice(0, 2);
  const month = date.slice(2, 4);
  const year = `20${date.slice(4, 6)}`;
  const hours = time.slice(0, 2);
  const minutes = time.slice(2, 4);
  const seconds = time.slice(4, 6);
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}Z`;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function qualityFlags(points, speeds) {
  const flags = [];
  if (!points.some((point) => point.time)) flags.push('Missing time');
  if (!points.some((point) => point.ele != null)) flags.push('No elevation');
  if (speeds.some((speed) => speed > 220)) flags.push('Speed spike');
  if (points.length < 2) flags.push('Too few points');
  return flags.length ? flags : ['Clean track'];
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;',
  })[char]);
}
