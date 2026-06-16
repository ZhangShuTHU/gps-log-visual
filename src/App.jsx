import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconChevronDown,
  IconDownload,
  IconFileImport,
  IconHelpCircle,
  IconLayoutSidebar,
  IconMap,
  IconMap2,
  IconMountain,
  IconMinus,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlus,
  IconRulerMeasure,
  IconSettings,
  IconTargetArrow,
  IconCheck,
  IconX,
  IconZoomScan,
} from '@tabler/icons-react';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { basemaps, makeRasterStyle } from './lib/basemaps.js';
import { demoTracks } from './data/demoTracks.js';
import {
  formatDuration,
  makeTrackDocument,
  parseFile,
  parseText,
  toCsv,
  toGeoJson,
  toGpx,
  toKml,
} from './lib/track.js';

const colors = ['#1c7f48', '#f97316', '#1f8edb', '#d33b5f', '#7c3aed'];

function buildDemoTracks() {
  return demoTracks.map((track) => makeTrackDocument(track));
}

export default function App() {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tracks, setTracks] = useState(buildDemoTracks);
  const [activeId, setActiveId] = useState('trans-eurasia');
  const [basemapId, setBasemapId] = useState('terrain');
  const [basemapOpen, setBasemapOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorMode, setColorMode] = useState('Time');
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrub, setScrub] = useState(52);
  const [measureMode, setMeasureMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('Local parser ready');
  const [cursor, setCursor] = useState({ lat: 39.7749, lon: 19.7002, ele: 242 });
  const [offlineReady, setOfflineReady] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const activeTrack = tracks.find((track) => track.id === activeId) ?? tracks[0];
  const basemap = basemaps.find((item) => item.id === basemapId) ?? basemaps[0];

  const chartData = useMemo(() => {
    if (!activeTrack) return [];
    const stride = Math.max(1, Math.ceil(activeTrack.points.length / 180));
    return activeTrack.points.filter((_, index) => index % stride === 0).map((point) => ({
      km: Number(point.distanceKm.toFixed(1)),
      elevation: point.ele ?? 0,
      speed: point.speedKmh ?? 0,
      slope: point.slope ?? 0,
    }));
  }, [activeTrack]);

  const currentPoint = activeTrack?.points[Math.min(activeTrack.points.length - 1, Math.floor((scrub / 100) * activeTrack.points.length))];

  const addRouteToMap = useCallback(() => {
    const map = mapRef.current;
    if (!map || !activeTrack || !map.isStyleLoaded()) return;
    const sourceId = 'route-source';
    const cursorSourceId = 'cursor-source';
    const route = toGeoJson(activeTrack);
    const marker = {
      type: 'FeatureCollection',
      features: currentPoint
        ? [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [currentPoint.lon, currentPoint.lat] },
              properties: {},
            },
          ]
        : [],
    };

    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(route);
      map.getSource(cursorSourceId)?.setData(marker);
      return;
    }

    map.addSource(sourceId, {
      type: 'geojson',
      data: route,
      lineMetrics: true,
    });
    map.addLayer({
      id: 'route-shadow',
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': 'rgba(12, 26, 35, 0.22)',
        'line-width': 8,
        'line-blur': 3,
      },
    });
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: sourceId,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-width': 5,
        'line-gradient': [
          'interpolate',
          ['linear'],
          ['line-progress'],
          0,
          '#2673d9',
          0.28,
          '#1c9ed8',
          0.52,
          '#20a566',
          0.72,
          '#d4a011',
          1,
          '#e24a2e',
        ],
      },
    });
    map.addSource(cursorSourceId, {
      type: 'geojson',
      data: marker,
    });
    map.addLayer({
      id: 'route-cursor',
      type: 'circle',
      source: cursorSourceId,
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#0f5132',
        'circle-stroke-width': 3,
      },
    });
  }, [activeTrack, currentPoint]);

  const fitRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map || !activeTrack?.points.length) return;
    const bounds = activeTrack.points.reduce(
      (bbox, point) => bbox.extend([point.lon, point.lat]),
      new maplibregl.LngLatBounds([activeTrack.points[0].lon, activeTrack.points[0].lat], [activeTrack.points[0].lon, activeTrack.points[0].lat]),
    );
    map.fitBounds(bounds, { padding: { top: 120, right: 380, bottom: 330, left: 300 }, duration: 900, maxZoom: 6 });
  }, [activeTrack]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapNode.current,
      style: makeRasterStyle(basemap),
      center: [20, 38],
      zoom: 1.95,
      attributionControl: false,
      preserveDrawingBuffer: true,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    map.on('load', () => {
      addRouteToMap();
      fitRoute();
    });
    map.on('mousemove', (event) => {
      setCursor({
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
        ele: currentPoint?.ele ?? 242,
      });
    });
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(makeRasterStyle(basemap));
    map.once('style.load', () => {
      addRouteToMap();
      setStatus(basemap.needsKey ? 'Tianditu token missing; previewing global fallback' : `${basemap.name} basemap active`);
    });
  }, [basemapId]);

  useEffect(() => {
    addRouteToMap();
  }, [addRouteToMap, scrub]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setScrub((value) => (value >= 100 ? 0 : value + 1));
    }, 260);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  async function importFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setStatus(`Parsing ${files.length} local file${files.length > 1 ? 's' : ''}`);
    const parsedTracks = [];
    for (const [index, file] of files.entries()) {
      try {
        const parsed = await parseFile(file);
        parsed.color = colors[(tracks.length + index) % colors.length];
        parsedTracks.push(parsed);
      } catch (error) {
        setStatus(`Could not parse ${file.name}: ${error.message}`);
      }
    }
    if (parsedTracks.length) {
      setTracks((current) => [...parsedTracks, ...current]);
      setActiveId(parsedTracks[0].id);
      setStatus(`${parsedTracks.length} file${parsedTracks.length > 1 ? 's' : ''} imported locally`);
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return;
    const parsed = parseText(pasteText, 'Pasted log.txt', new Blob([pasteText]).size);
    parsed.color = colors[tracks.length % colors.length];
    setTracks((current) => [parsed, ...current]);
    setActiveId(parsed.id);
    setPasteText('');
    setPasteOpen(false);
    setStatus('Pasted log imported locally');
  }

  function downloadTrack(format) {
    if (!activeTrack) return;
    const writers = {
      gpx: { body: toGpx(activeTrack), type: 'application/gpx+xml' },
      kml: { body: toKml(activeTrack), type: 'application/vnd.google-earth.kml+xml' },
      csv: { body: toCsv(activeTrack), type: 'text/csv' },
    };
    if (format === 'png') {
      const map = mapRef.current;
      map?.getCanvas().toBlob((blob) => {
        if (blob) saveBlob(blob, 'atlas-canvas-map.png');
      });
      setExportOpen(false);
      return;
    }
    const payload = writers[format];
    saveBlob(new Blob([payload.body], { type: payload.type }), `${activeTrack.name.replace(/\.[^.]+$/, '')}.${format}`);
    setExportOpen(false);
  }

  function clearDemoTracks() {
    setTracks([]);
    setActiveId(null);
    setStatus('New map ready');
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <IconMountain size={28} stroke={1.8} />
          <span>Atlas Canvas</span>
        </div>
        <button className="icon-button" aria-label="Toggle file rail">
          <IconLayoutSidebar size={20} />
        </button>
        <button className="command" onClick={() => fileInputRef.current?.click()}>
          <IconFileImport size={18} />
          Import Log
        </button>
        <button className="command" onClick={clearDemoTracks}>
          <IconMap size={18} />
          New Map
        </button>
        <div className="topbar-spacer" />
        <button className="icon-button" aria-label="Undo">
          <IconArrowBackUp size={19} />
        </button>
        <button className="icon-button" aria-label="Redo">
          <IconArrowForwardUp size={19} />
        </button>
        <button className={`command ${measureMode ? 'is-active' : ''}`} onClick={() => setMeasureMode((value) => !value)}>
          <IconRulerMeasure size={18} />
          Measure
        </button>
        <button className="command" onClick={fitRoute}>
          <IconZoomScan size={18} />
          Fit to Route
        </button>
        <div className="export-menu">
          <button className="command" onClick={() => setExportOpen((value) => !value)}>
            <IconDownload size={18} />
            Export
            <IconChevronDown size={16} />
          </button>
          {exportOpen && (
            <div className="menu-popover">
              {['gpx', 'kml', 'csv', 'png'].map((format) => (
                <button key={format} onClick={() => downloadTrack(format)}>
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="icon-button" aria-label="Help">
          <IconHelpCircle size={20} />
        </button>
      </header>

      <section className="map-stage">
        <div ref={mapNode} className={`map-root ${measureMode ? 'is-measuring' : ''}`} />

        <nav className="tool-rail" aria-label="Map tools">
          {[
            ['Select', IconTargetArrow, true],
            ['Draw', IconMap2],
            ['Measure', IconRulerMeasure, measureMode],
            ['Waypoints', IconMap],
            ['Layers', IconLayoutSidebar],
            ['Settings', IconSettings],
          ].map(([label, Icon, active]) => (
            <button key={label} className={active ? 'active' : ''} title={label}>
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <aside className={`basemap-panel ${basemapOpen ? 'open' : ''}`}>
          <div className="panel-title">
            <span>Basemap</span>
            <button aria-label="Close basemap panel" onClick={() => setBasemapOpen(false)}>
              <IconX size={18} />
            </button>
          </div>
          <div className="basemap-list">
            {basemaps.map((item) => (
              <button key={item.id} className={item.id === basemapId ? 'selected' : ''} onClick={() => setBasemapId(item.id)}>
                <span className="radio" />
                <span className="tile-chip" style={{ background: item.color }} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.scope}</small>
                </span>
              </button>
            ))}
          </div>
          <label className="switch-line">
            <span>Offline-ready</span>
            <input type="checkbox" checked={offlineReady} onChange={(event) => setOfflineReady(event.target.checked)} />
          </label>
        </aside>

        {!basemapOpen && (
          <button className="floating-basemap" onClick={() => setBasemapOpen(true)}>
            <IconMap2 size={18} />
            Basemap
          </button>
        )}

        <div className="coord-card">
          <span>Lat&nbsp; {cursor.lat.toFixed(4)}°</span>
          <span>Lon&nbsp; {cursor.lon.toFixed(4)}°</span>
          <span>Elev&nbsp; {Math.round(cursor.ele ?? 0)} m</span>
        </div>

        <div className="zoom-stack">
          <button onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in"><IconPlus size={18} /></button>
          <button onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out"><IconMinus size={18} /></button>
        </div>

        <section className="log-tray">
          <div className="tray-header">
            <strong>Log Files</strong>
            <span>{tracks.length} active</span>
          </div>
          <div
            className={`drop-zone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              importFiles(event.dataTransfer.files);
            }}
          >
            <span>Drop files here</span>
            <button onClick={() => fileInputRef.current?.click()}>
              <IconFileImport size={16} />
              Import Log
            </button>
            <small>GPX, KML, CSV, TXT, NMEA</small>
            <button className="text-button" onClick={() => setPasteOpen(true)}>
              Paste log text
            </button>
          </div>
          <div className="track-list">
            {tracks.map((track) => (
              <button key={track.id} className={track.id === activeId ? 'selected' : ''} onClick={() => setActiveId(track.id)}>
                <span className="check">{track.id === activeId ? <IconCheck size={11} stroke={2.4} /> : null}</span>
                <span className="track-swatch" style={{ background: track.color }} />
                <span>
                  <strong>{track.name}</strong>
                  <small>
                    {track.stats.points.toLocaleString()} points · {track.size}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button className="clear-button" onClick={clearDemoTracks}>Clear All</button>
        </section>

        <section className="analytics">
          <div className="metric-strip">
            <Metric label="Distance" value={`${Math.round(activeTrack?.stats.distanceKm ?? 0).toLocaleString()} km`} />
            <Metric label="Duration" value={formatDuration(activeTrack?.stats.durationHours ?? 0)} />
            <Metric label="Moving Speed" value={`${(activeTrack?.stats.movingSpeedKmh ?? 0).toFixed(1)} km/h`} />
            <Metric label="Ascent" value={`${Math.round(activeTrack?.stats.ascentM ?? 0).toLocaleString()} m`} />
            <Metric label="Descent" value={`${Math.round(activeTrack?.stats.descentM ?? 0).toLocaleString()} m`} />
            <Metric label="Points" value={(activeTrack?.stats.points ?? 0).toLocaleString()} />
          </div>
          <div className="playback">
            <button onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}</button>
            <button onClick={() => setScrub(0)}><IconPlayerSkipBack size={18} /></button>
            <button onClick={() => setScrub(100)}><IconPlayerSkipForward size={18} /></button>
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value)}>
              {['Time', 'Speed', 'Elevation', 'Slope'].map((mode) => <option key={mode}>{mode}</option>)}
            </select>
            <input aria-label="Route timeline" type="range" min="0" max="100" value={scrub} onChange={(event) => setScrub(Number(event.target.value))} />
            <span>{Math.round(scrub)}% · color by {colorMode}</span>
          </div>
          <div className="profile-chart">
            <div className="chart-legend">
              <span className="elevation">Elevation (m)</span>
              <span className="speed">Speed (km/h)</span>
              <span className="slope">Slope (%)</span>
            </div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 18, bottom: 8 }}>
                <CartesianGrid stroke="#e8ece8" vertical={false} />
                <XAxis dataKey="km" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} unit=" km" />
                <YAxis yAxisId="left" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={42} />
                <YAxis yAxisId="right" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={34} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dce3df', fontSize: 12 }} />
                <ReferenceLine x={currentPoint?.distanceKm ? Number(currentPoint.distanceKm.toFixed(1)) : 0} stroke="#1f2937" yAxisId="left" />
                <Line yAxisId="left" type="monotone" dataKey="elevation" stroke="#2f9c5c" strokeWidth={2.2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="speed" stroke="#3387df" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="right" type="monotone" dataKey="slope" stroke="#f97316" strokeWidth={1.8} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <footer className="statusbar">
          <span>WGS 84 / Pseudo-Mercator</span>
          <span>{status}</span>
          <span>Zoom: {mapRef.current?.getZoom?.().toFixed(1) ?? '2.2'}</span>
        </footer>
      </section>

      {pasteOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="paste-modal">
            <div className="panel-title">
              <span>Paste Log Text</span>
              <button onClick={() => setPasteOpen(false)} aria-label="Close paste modal"><IconX size={18} /></button>
            </div>
            <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Paste CSV, GPX, KML, or NMEA text here..." />
            <div className="modal-actions">
              <button className="secondary" onClick={() => setPasteOpen(false)}>Cancel</button>
              <button onClick={handlePasteImport}>Import locally</button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".gpx,.kml,.geojson,.json,.csv,.txt,.nmea,.log"
        className="hidden-file"
        onChange={(event) => importFiles(event.target.files)}
      />
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
