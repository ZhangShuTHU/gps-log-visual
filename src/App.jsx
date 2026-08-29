import {
  IconChevronDown,
  IconDownload,
  IconFileImport,
  IconLayoutSidebar,
  IconMap,
  IconMountain,
  IconMinus,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlayerSkipBack,
  IconPlayerSkipForward,
  IconPlus,
  IconRulerMeasure,
  IconTargetArrow,
  IconCheck,
  IconX,
  IconZoomScan,
} from '@tabler/icons-react';
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
import { demoTracks } from './data/demoTracks.js';
import {
  attachMapTelemetry,
  basemaps,
  createBasemapProvider,
  createCesiumViewer,
  flyToTrack,
  getWorldTerrainProvider,
  hasCesiumIonToken,
  removeTrack,
  renderTrack,
  updateTrackCursor,
  useEllipsoidTerrain,
} from './lib/cesium-map.js';
import {
  formatDuration,
  interpolateTrackPoint,
  makeTrackDocument,
  parseFile,
  parseText,
  toCsv,
  toGpx,
  toKml,
} from './lib/track.js';

const colors = ['#1c7f48', '#f97316', '#1f8edb', '#d33b5f', '#7c3aed'];
const colorModes = [
  { value: 'Time', label: '时间' },
  { value: 'Speed', label: '速度' },
  { value: 'Elevation', label: '海拔' },
  { value: 'Slope', label: '坡度' },
];

const PLAYBACK_STEP_MS = 260;
const PLAYBACK_STATE_INTERVAL_MS = 100;

function buildDemoTracks() {
  return demoTracks.map((track) => makeTrackDocument(track));
}

export default function App() {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const renderedTrackRef = useRef({ routeEntities: [], cursorEntity: null });
  const lastFittedTrackIdRef = useRef(null);
  const fileInputRef = useRef(null);
  const [tracks, setTracks] = useState(buildDemoTracks);
  const [activeId, setActiveId] = useState('trans-eurasia');
  const [basemapId, setBasemapId] = useState('satellite');
  const [basemapOpen, setBasemapOpen] = useState(true);
  const [logTrayOpen, setLogTrayOpen] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [colorMode, setColorMode] = useState('Time');
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrub, setScrub] = useState(52);
  const [measureMode, setMeasureMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState('本地解析器就绪');
  const [cursor, setCursor] = useState({ lat: 39.7749, lon: 19.7002, ele: 242 });
  const [cameraHeight, setCameraHeight] = useState(12_500_000);
  const [mapReady, setMapReady] = useState(false);
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const scrubRef = useRef(scrub);
  const rangeInputRef = useRef(null);
  const playbackFrameRef = useRef(null);

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

  const currentPoint = interpolateTrackPoint(activeTrack?.points ?? [], scrub);

  const setScrubValue = useCallback((value) => {
    const numericValue = Number(value);
    const nextValue = Math.min(100, Math.max(0, Number.isFinite(numericValue) ? numericValue : 0));
    scrubRef.current = nextValue;
    if (rangeInputRef.current) rangeInputRef.current.value = String(nextValue);
    setScrub(nextValue);
  }, []);

  const fitRoute = useCallback(() => {
    const viewer = mapRef.current;
    if (!viewer || !activeTrack?.points.length) return;
    flyToTrack(viewer, activeTrack);
  }, [activeTrack]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const viewer = createCesiumViewer(mapNode.current);
    const detachTelemetry = attachMapTelemetry(viewer, {
      onCursor: setCursor,
      onCameraHeight: setCameraHeight,
    });
    mapRef.current = viewer;
    setMapReady(true);

    return () => {
      detachTelemetry();
      if (!viewer.isDestroyed()) viewer.destroy();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const viewer = mapRef.current;
    if (!viewer || !mapReady) return;
    let cancelled = false;

    createBasemapProvider(basemapId).then(({ provider, fallback }) => {
      if (cancelled || viewer.isDestroyed()) return;
      viewer.imageryLayers.removeAll(true);
      viewer.imageryLayers.addImageryProvider(provider);
      viewer.scene.requestRender();
      setStatus(fallback
        ? '未读取到可用的 Cesium ion Token，已切换 OpenStreetMap 预览'
        : `已启用${basemap.name}`);
    });

    return () => {
      cancelled = true;
    };
  }, [basemap, basemapId, mapReady]);

  useEffect(() => {
    const viewer = mapRef.current;
    if (!viewer || !mapReady) return;
    let cancelled = false;

    if (!terrainEnabled) {
      useEllipsoidTerrain(viewer);
      setStatus('三维地形已关闭');
      return;
    }

    getWorldTerrainProvider()
      .then((provider) => {
        if (cancelled || viewer.isDestroyed()) return;
        if (!provider) {
          useEllipsoidTerrain(viewer);
          setStatus('缺少 VITE_CESIUM_ION_TOKEN，当前使用椭球地表');
          return;
        }
        viewer.terrainProvider = provider;
        viewer.scene.requestRender();
        setStatus('Cesium World Terrain 已启用');
      })
      .catch(() => {
        if (cancelled || viewer.isDestroyed()) return;
        useEllipsoidTerrain(viewer);
        setStatus('三维地形加载失败，已切换椭球地表');
      });

    return () => {
      cancelled = true;
    };
  }, [mapReady, terrainEnabled]);

  useEffect(() => {
    const viewer = mapRef.current;
    if (!viewer || !mapReady) return;

    removeTrack(viewer, renderedTrackRef.current);
    renderedTrackRef.current = renderTrack(viewer, activeTrack);
    updateTrackCursor(viewer, renderedTrackRef.current.cursorEntity, currentPoint);

    if (activeTrack?.id && lastFittedTrackIdRef.current !== activeTrack.id) {
      lastFittedTrackIdRef.current = activeTrack.id;
      flyToTrack(viewer, activeTrack);
    }
  }, [activeTrack, mapReady]);

  useEffect(() => {
    const viewer = mapRef.current;
    if (!viewer || !mapReady) return;
    updateTrackCursor(viewer, renderedTrackRef.current.cursorEntity, currentPoint);
  }, [currentPoint, mapReady]);

  useEffect(() => {
    if (!isPlaying || !activeTrack?.points.length) return;

    let lastFrameTime = null;
    let lastStateCommitTime = null;

    function advancePlayback(timestamp) {
      if (lastFrameTime == null) {
        lastFrameTime = timestamp;
        lastStateCommitTime = timestamp;
      } else {
        const elapsedMs = timestamp - lastFrameTime;
        lastFrameTime = timestamp;
        const nextScrub = (scrubRef.current + elapsedMs / PLAYBACK_STEP_MS) % 100;
        scrubRef.current = nextScrub;

        if (rangeInputRef.current) rangeInputRef.current.value = String(nextScrub);

        const point = interpolateTrackPoint(activeTrack.points, nextScrub);
        if (mapRef.current) {
          updateTrackCursor(mapRef.current, renderedTrackRef.current.cursorEntity, point);
        }

        if (timestamp - lastStateCommitTime >= PLAYBACK_STATE_INTERVAL_MS) {
          lastStateCommitTime = timestamp;
          setScrub(nextScrub);
        }
      }

      playbackFrameRef.current = window.requestAnimationFrame(advancePlayback);
    }

    playbackFrameRef.current = window.requestAnimationFrame(advancePlayback);
    return () => {
      if (playbackFrameRef.current != null) {
        window.cancelAnimationFrame(playbackFrameRef.current);
        playbackFrameRef.current = null;
      }
      setScrub(scrubRef.current);
    };
  }, [isPlaying, activeTrack]);

  async function importFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setStatus(`正在解析 ${files.length} 个本地文件`);
    const parsedTracks = [];
    for (const [index, file] of files.entries()) {
      try {
        const parsed = await parseFile(file);
        parsed.color = colors[(tracks.length + index) % colors.length];
        parsedTracks.push(parsed);
      } catch (error) {
        setStatus(`无法解析 ${file.name}: ${error.message}`);
      }
    }
    if (parsedTracks.length) {
      setTracks((current) => [...parsedTracks, ...current]);
      setActiveId(parsedTracks[0].id);
      setStatus(`已本地导入 ${parsedTracks.length} 个文件`);
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return;
    const parsed = parseText(pasteText, '粘贴日志.txt', new Blob([pasteText]).size);
    parsed.color = colors[tracks.length % colors.length];
    setTracks((current) => [parsed, ...current]);
    setActiveId(parsed.id);
    setPasteText('');
    setPasteOpen(false);
    setStatus('粘贴日志已本地导入');
  }

  function downloadTrack(format) {
    if (!activeTrack) return;
    const writers = {
      gpx: { body: toGpx(activeTrack), type: 'application/gpx+xml' },
      kml: { body: toKml(activeTrack), type: 'application/vnd.google-earth.kml+xml' },
      csv: { body: toCsv(activeTrack), type: 'text/csv' },
    };
    if (format === 'png') {
      const viewer = mapRef.current;
      viewer?.scene.render();
      viewer?.scene.canvas.toBlob((blob) => {
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
    lastFittedTrackIdRef.current = null;
    setStatus('新地图已就绪');
  }

  function zoomMap(direction) {
    const viewer = mapRef.current;
    if (!viewer) return;
    const height = Math.max(100, viewer.camera.positionCartographic.height);
    const amount = direction === 'in' ? height * 0.35 : height * 0.5;
    if (direction === 'in') viewer.camera.zoomIn(amount);
    else viewer.camera.zoomOut(amount);
    viewer.scene.requestRender();
  }

  function selectBrowseMode() {
    setMeasureMode(false);
    setStatus('已切换为选择浏览模式');
  }

  function toggleMeasureMode() {
    setMeasureMode((value) => {
      const next = !value;
      setStatus(next ? '测距模式已开启' : '测距模式已关闭');
      return next;
    });
  }

  function toggleLogTray() {
    const update = () => setLogTrayOpen((value) => !value);
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduceMotion && document.startViewTransition) {
      document.startViewTransition(update);
      return;
    }

    update();
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <IconMountain size={28} stroke={1.8} />
          <span>Atlas Canvas</span>
        </div>
        <button
          className={`icon-button ${logTrayOpen ? 'is-active' : ''}`}
          aria-label="切换文件栏"
          onClick={toggleLogTray}
        >
          <IconLayoutSidebar size={20} />
        </button>
        <button className="command" onClick={() => fileInputRef.current?.click()}>
          <IconFileImport size={18} />
          导入日志
        </button>
        <button className="command" onClick={clearDemoTracks}>
          <IconMap size={18} />
          新地图
        </button>
        <div className="topbar-spacer" />
        <button className={`command ${measureMode ? 'is-active' : ''}`} onClick={toggleMeasureMode}>
          <IconRulerMeasure size={18} />
          测距
        </button>
        <button className="command" onClick={fitRoute}>
          <IconZoomScan size={18} />
          适配轨迹
        </button>
        <div className="export-menu">
          <button
            className="command"
            aria-expanded={exportOpen}
            onClick={() => setExportOpen((value) => !value)}
          >
            <IconDownload size={18} />
            导出
            <IconChevronDown size={16} />
          </button>
          <div
            className={`menu-popover ${exportOpen ? 'is-open' : ''}`}
            aria-hidden={!exportOpen}
            inert={!exportOpen}
          >
            {['gpx', 'kml', 'csv', 'png'].map((format) => (
              <button key={format} onClick={() => downloadTrack(format)}>
                {format.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="map-stage">
        <div
          ref={mapNode}
          className={`map-root ${measureMode ? 'is-measuring' : ''}`}
          aria-label="Cesium 三维轨迹地图"
        />

        <nav className="tool-rail" aria-label="地图工具">
          <button className={!measureMode ? 'active' : ''} title="选择" onClick={selectBrowseMode}>
            <IconTargetArrow size={20} />
            <span>选择</span>
          </button>
          <button className={measureMode ? 'active' : ''} title="测距" onClick={toggleMeasureMode}>
            <IconRulerMeasure size={20} />
            <span>测距</span>
          </button>
          <button className={basemapOpen ? 'active' : ''} title="图层" onClick={() => setBasemapOpen((value) => !value)}>
            <IconLayoutSidebar size={20} />
            <span>图层</span>
          </button>
        </nav>

        <aside className={`basemap-panel ${basemapOpen ? 'open' : ''}`}>
          <div className="panel-title">
            <span className="panel-heading">
              <span>底图与地形</span>
              <small className={hasCesiumIonToken ? 'ion-online' : ''}>
                {hasCesiumIonToken ? 'ION ONLINE' : 'ION FALLBACK'}
              </small>
            </span>
            <button aria-label="关闭底图面板" onClick={() => setBasemapOpen(false)}>
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
            <span>
              三维地形
              <small>Cesium World Terrain</small>
            </span>
            <input
              type="checkbox"
              checked={terrainEnabled}
              onChange={(event) => setTerrainEnabled(event.target.checked)}
            />
          </label>
        </aside>

        {!basemapOpen && (
          <button className="floating-basemap" onClick={() => setBasemapOpen(true)}>
            <IconLayoutSidebar size={18} />
            底图
          </button>
        )}

        <div className="coord-card">
          <span>纬度&nbsp; {cursor.lat.toFixed(4)}°</span>
          <span>经度&nbsp; {cursor.lon.toFixed(4)}°</span>
          <span>海拔&nbsp; {Math.round(cursor.ele ?? 0)} m</span>
        </div>

        <div className="zoom-stack">
          <button onClick={() => zoomMap('in')} aria-label="放大"><IconPlus size={18} /></button>
          <button onClick={() => zoomMap('out')} aria-label="缩小"><IconMinus size={18} /></button>
        </div>

        <section className={`log-tray ${logTrayOpen ? '' : 'is-hidden'}`}>
          <div className="tray-header">
            <strong>日志文件</strong>
            <span>{tracks.length} 个启用</span>
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
            <span>拖放文件到这里</span>
            <button onClick={() => fileInputRef.current?.click()}>
              <IconFileImport size={16} />
              导入日志
            </button>
            <small>GPX, KML, CSV, TXT, NMEA</small>
            <button className="text-button" onClick={() => setPasteOpen(true)}>
              粘贴日志文本
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
                    {track.stats.points.toLocaleString()} 点 · {track.size}
                  </small>
                </span>
              </button>
            ))}
          </div>
          <button className="clear-button" onClick={clearDemoTracks}>全部清除</button>
        </section>

        <section className={`analytics ${logTrayOpen ? '' : 'full-width'}`}>
          <div className="metric-strip">
            <Metric label="距离" value={`${Math.round(activeTrack?.stats.distanceKm ?? 0).toLocaleString()} km`} />
            <Metric label="时长" value={formatDuration(activeTrack?.stats.durationHours ?? 0)} />
            <Metric label="移动速度" value={`${(activeTrack?.stats.movingSpeedKmh ?? 0).toFixed(1)} km/h`} />
            <Metric label="累计爬升" value={`${Math.round(activeTrack?.stats.ascentM ?? 0).toLocaleString()} m`} />
            <Metric label="累计下降" value={`${Math.round(activeTrack?.stats.descentM ?? 0).toLocaleString()} m`} />
            <Metric label="轨迹点" value={(activeTrack?.stats.points ?? 0).toLocaleString()} />
          </div>
          <div className="playback">
            <button onClick={() => setIsPlaying((value) => !value)}>{isPlaying ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}</button>
            <button onClick={() => setScrubValue(0)}><IconPlayerSkipBack size={18} /></button>
            <button onClick={() => setScrubValue(100)}><IconPlayerSkipForward size={18} /></button>
            <select value={colorMode} onChange={(event) => setColorMode(event.target.value)}>
              {colorModes.map((mode) => <option key={mode.value} value={mode.value}>{mode.label}</option>)}
            </select>
            <input ref={rangeInputRef} aria-label="轨迹时间轴" type="range" min="0" max="100" step="0.01" value={scrub} onChange={(event) => setScrubValue(event.target.value)} />
            <span>{Math.round(scrub)}% · 按{colorModes.find((mode) => mode.value === colorMode)?.label ?? colorMode}着色</span>
          </div>
          <div className="profile-chart">
            <div className="chart-legend">
              <span className="elevation">海拔 (m)</span>
              <span className="speed">速度 (km/h)</span>
              <span className="slope">坡度 (%)</span>
            </div>
            <ResponsiveContainer
              width="100%"
              height="100%"
              minWidth={0}
              minHeight={0}
              initialDimension={{ width: 800, height: 120 }}
            >
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
          <span>WGS 84 / Cesium 3D</span>
          <span>{status}</span>
          <span>视高: {formatCameraHeight(cameraHeight)}</span>
        </footer>
      </section>

      <div
        className={`modal-backdrop ${pasteOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal={pasteOpen ? 'true' : undefined}
        aria-hidden={!pasteOpen}
        inert={!pasteOpen}
      >
        <div className="paste-modal">
          <div className="panel-title">
            <span>粘贴日志文本</span>
            <button onClick={() => setPasteOpen(false)} aria-label="关闭粘贴弹窗"><IconX size={18} /></button>
          </div>
          <textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="在这里粘贴 CSV、GPX、KML 或 NMEA 文本..." />
          <div className="modal-actions">
            <button className="secondary" onClick={() => setPasteOpen(false)}>取消</button>
            <button onClick={handlePasteImport}>本地导入</button>
          </div>
        </div>
      </div>

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

function formatCameraHeight(height) {
  if (!Number.isFinite(height)) return '—';
  if (height >= 1_000_000) return `${(height / 1_000_000).toFixed(1)} Mm`;
  if (height >= 1_000) return `${(height / 1_000).toFixed(height >= 100_000 ? 0 : 1)} km`;
  return `${Math.round(height)} m`;
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
