import {
  IconChevronDown,
  IconDownload,
  IconFileImport,
  IconLayoutSidebar,
  IconMountain,
  IconMinus,
  IconPlus,
  IconRulerMeasure,
  IconStack2,
  IconSun,
  IconTargetArrow,
  IconX,
  IconZoomScan,
} from '@tabler/icons-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PlaybackDock from './components/PlaybackDock.jsx';
import TrackProfile from './components/TrackProfile.jsx';
import TrackSidebar from './components/TrackSidebar.jsx';
import { demoTracks } from './data/demoTracks.js';
import {
  attachDistanceMeasurement,
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
import { formatLocalSolarTime, formatUtcTime } from './lib/solar-time.js';
import {
  interpolateTrackPoint,
  makeTrackDocument,
  parseFile,
  parseText,
  toCsv,
  toGpx,
  toKml,
} from './lib/track.js';

const colors = ['#1c7f48', '#f97316', '#1f8edb', '#d33b5f', '#7c3aed'];
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
  const pasteInputRef = useRef(null);
  const [tracks, setTracks] = useState(buildDemoTracks);
  const [activeId, setActiveId] = useState('trans-eurasia');
  const [basemapId, setBasemapId] = useState('satellite');
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  const [trackSearch, setTrackSearch] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileMetric, setProfileMetric] = useState('elevation');
  const [exportOpen, setExportOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrub, setScrub] = useState(0);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurement, setMeasurement] = useState({ points: 0, distanceKm: 0 });
  const [status, setStatus] = useState('日志仅在本地处理');
  const [cursor, setCursor] = useState({ lat: 39.7749, lon: 19.7002, ele: 242 });
  const [cameraHeight, setCameraHeight] = useState(12_500_000);
  const [sceneTime, setSceneTime] = useState(() => new Date());
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
    return activeTrack.points.filter((_, index) => index % stride === 0 || index === activeTrack.points.length - 1).map((point) => ({
      km: point.distanceKm,
      elevation: point.ele,
      speed: point.speedKmh,
      slope: point.slope,
    }));
  }, [activeTrack]);

  const currentPoint = interpolateTrackPoint(activeTrack?.points ?? [], scrub);

  const setScrubValue = useCallback((value) => {
    const numericValue = Number(value);
    const nextValue = Math.min(100, Math.max(0, Number.isFinite(numericValue) ? numericValue : 0));
    scrubRef.current = nextValue;
    if (rangeInputRef.current) {
      rangeInputRef.current.value = String(nextValue);
      rangeInputRef.current.style.setProperty('--progress', `${nextValue}%`);
    }
    setScrub(nextValue);
  }, []);

  useEffect(() => {
    const viewer = mapRef.current;
    if (!viewer || !mapReady || !measureMode) return;
    return attachDistanceMeasurement(viewer, setMeasurement);
  }, [mapReady, measureMode]);

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
      onSceneTime: setSceneTime,
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
        ? '已启用备用底图'
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
          setStatus('已启用标准地表');
          return;
        }
        viewer.terrainProvider = provider;
        viewer.scene.requestRender();
        setStatus('三维地形已启用');
      })
      .catch(() => {
        if (cancelled || viewer.isDestroyed()) return;
        useEllipsoidTerrain(viewer);
        setStatus('地形暂不可用，已启用标准地表');
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

        if (rangeInputRef.current) {
          rangeInputRef.current.value = String(nextScrub);
          rangeInputRef.current.style.setProperty('--progress', `${nextScrub}%`);
        }

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

  useEffect(() => {
    function dismissPanels(event) {
      if (!event.target.closest('.export-menu')) setExportOpen(false);
      if (!event.target.closest('.layer-controls')) setBasemapOpen(false);
    }
    function handleEscape(event) {
      if (event.key !== 'Escape') return;
      setExportOpen(false);
      setBasemapOpen(false);
      setPasteOpen(false);
      if (window.matchMedia('(max-width: 899px)').matches) setSidebarOpen(false);
    }
    document.addEventListener('pointerdown', dismissPanels);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', dismissPanels);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!pasteOpen) return;
    const previousFocus = document.activeElement;
    pasteInputRef.current?.focus();
    return () => previousFocus?.focus();
  }, [pasteOpen]);

  async function importFiles(fileList) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    setStatus(`正在解析 ${files.length} 个本地文件`);
    const parsedTracks = [];
    for (const [index, file] of files.entries()) {
      try {
        const parsed = await parseFile(file);
        if (!parsed.points.length) throw new Error('未找到有效坐标');
        parsed.color = colors[(tracks.length + index) % colors.length];
        parsedTracks.push(parsed);
      } catch (error) {
        setStatus(`无法解析 ${file.name}: ${error.message}`);
      }
    }
    if (parsedTracks.length) {
      setTracks((current) => [...parsedTracks, ...current]);
      setActiveId(parsedTracks[0].id);
      setIsPlaying(false);
      setScrubValue(0);
      setTrackSearch('');
      setSidebarOpen(true);
      setStatus(`已本地导入 ${parsedTracks.length} 个文件`);
    }
  }

  function handlePasteImport() {
    if (!pasteText.trim()) return;
    try {
      const parsed = parseText(pasteText, '粘贴日志.txt', new Blob([pasteText]).size);
      if (!parsed.points.length) {
        setStatus('未找到有效坐标，请检查日志内容');
        return;
      }
      parsed.color = colors[tracks.length % colors.length];
      setTracks((current) => [parsed, ...current]);
      setActiveId(parsed.id);
      setIsPlaying(false);
      setScrubValue(0);
      setTrackSearch('');
      setSidebarOpen(true);
      setPasteText('');
      setPasteOpen(false);
      setStatus('粘贴日志已本地导入');
    } catch (error) {
      setStatus(`无法解析日志: ${error.message}`);
    }
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
    setIsPlaying(false);
    setProfileOpen(false);
    setScrubValue(0);
    setTrackSearch('');
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

  function selectTrack(track) {
    setActiveId(track.id);
    setIsPlaying(false);
    setScrubValue(0);
  }

  function seekFromProfile(value) {
    const distance = Number(value);
    const points = activeTrack?.points;
    if (value == null || !Number.isFinite(distance) || !points?.length) return;
    const nextIndex = points.findIndex((point) => point.distanceKm >= distance);
    if (nextIndex <= 0) {
      setScrubValue(nextIndex === 0 ? 0 : 100);
      return;
    }
    const start = points[nextIndex - 1].distanceKm;
    const segment = points[nextIndex].distanceKm - start;
    const fraction = segment > 0 ? (distance - start) / segment : 0;
    setScrubValue(((nextIndex - 1 + fraction) / (points.length - 1)) * 100);
  }

  return (
    <main className="app-shell" onDragOver={(event) => {
      if (event.dataTransfer.types.includes('Files')) event.preventDefault();
    }} onDrop={(event) => {
      event.preventDefault();
      importFiles(event.dataTransfer.files);
    }}>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><IconMountain size={22} stroke={1.6} /></span>
          <span>Atlas<span className="brand-secondary"> Canvas</span></span>
        </div>
        <button
          className={`icon-button sidebar-toggle ${sidebarOpen ? 'is-active' : ''}`}
          aria-label={sidebarOpen ? '收起轨迹栏' : '展开轨迹栏'}
          aria-expanded={sidebarOpen}
          aria-controls="track-sidebar"
          title={sidebarOpen ? '收起轨迹栏' : '展开轨迹栏'}
          onClick={() => setSidebarOpen((value) => !value)}
        >
          <IconLayoutSidebar size={19} />
        </button>
        <span className="workspace-label">轨迹工作台</span>
        <div className="topbar-spacer" />
        <span className="local-indicator"><span />本地处理</span>
        <button className="command primary-command" onClick={() => fileInputRef.current?.click()}>
          <IconPlus size={17} />
          <span>导入日志</span>
        </button>
        <div className="export-menu">
          <button
            className="command"
            aria-expanded={exportOpen}
            aria-controls="export-options"
            disabled={!activeTrack?.points.length}
            onClick={() => setExportOpen((value) => !value)}
          >
            <IconDownload size={17} />
            <span>导出</span>
            <IconChevronDown className="export-chevron" size={14} />
          </button>
          <div
            id="export-options"
            className={`menu-popover ${exportOpen ? 'is-open' : ''}`}
            aria-hidden={!exportOpen}
            inert={!exportOpen}
          >
            <span className="popover-label">导出当前轨迹</span>
            {['gpx', 'kml', 'csv', 'png'].map((format) => (
              <button key={format} onClick={() => downloadTrack(format)}>
                <span>{format.toUpperCase()}</span>
                <small>{format === 'png' ? '地图图像' : '轨迹文件'}</small>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={`workspace ${sidebarOpen ? '' : 'is-sidebar-closed'}`}>
        <button
          className={`sidebar-backdrop ${sidebarOpen ? 'is-open' : ''}`}
          aria-label="关闭轨迹栏"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
        />
        <TrackSidebar
          isOpen={sidebarOpen}
          tracks={tracks}
          activeTrack={activeTrack}
          search={trackSearch}
          onSearch={setTrackSearch}
          onSelect={selectTrack}
          onImport={() => fileInputRef.current?.click()}
          onFiles={importFiles}
          onPaste={() => setPasteOpen(true)}
          onClear={clearDemoTracks}
          onClose={() => setSidebarOpen(false)}
          onProfile={() => {
            setProfileOpen(true);
            if (window.matchMedia('(max-width: 899px)').matches) setSidebarOpen(false);
          }}
          status={status}
        />

        <section className={`map-stage ${profileOpen && activeTrack ? 'has-profile' : ''}`} aria-label="地图工作区">
          <div
            ref={mapNode}
            className={`map-root ${measureMode ? 'is-measuring' : ''}`}
            aria-label="Cesium 三维轨迹地图"
          />

          <nav className="map-tools surface" aria-label="地图工具">
            <button className={`icon-button ${!measureMode ? 'is-active' : ''}`} aria-label="浏览地图" aria-pressed={!measureMode} title="浏览地图" onClick={selectBrowseMode}>
              <IconTargetArrow size={18} />
            </button>
            <button className={`icon-button ${measureMode ? 'is-active' : ''}`} aria-label="测距模式" aria-pressed={measureMode} title="测距模式" onClick={toggleMeasureMode}>
              <IconRulerMeasure size={18} />
            </button>
          </nav>

          {measureMode && (
            <div className="measurement-hint surface" role="status">
              <IconRulerMeasure size={16} />
              <span>{measurement.points < 2 ? (measurement.points ? '继续点击地图设置终点' : '点击地图设置起点') : `${measurement.distanceKm.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} km`}<small>{measurement.points > 1 ? `${measurement.points} 个测量点 · 地表距离` : '可连续添加测量点'}</small></span>
              <button className="icon-button" aria-label="结束测距" title="结束测距" onClick={selectBrowseMode}><IconX size={15} /></button>
            </div>
          )}

          <div className="scene-clock"><IconSun size={14} />实时晨昏<span>{formatUtcTime(sceneTime)}</span></div>

          <div className="layer-controls">
            <div className="map-actions surface">
              <button
                className={`basemap-trigger ${basemapOpen ? 'is-active' : ''}`}
                aria-expanded={basemapOpen}
                aria-controls="basemap-panel"
                onClick={() => setBasemapOpen((value) => !value)}
              >
                <IconStack2 size={17} />
                <span className="basemap-current">{basemap.name}</span>
                <span className="mobile-basemap-label">底图</span>
                <IconChevronDown size={13} />
              </button>
              <span className="tool-divider" />
              <button className="icon-button" aria-label="适配轨迹" title="适配轨迹" onClick={fitRoute} disabled={!activeTrack?.points.length}>
                <IconZoomScan size={18} />
              </button>
            </div>
            <aside
              id="basemap-panel"
              className={`basemap-panel surface ${basemapOpen ? 'is-open' : ''}`}
              aria-label="底图与地形"
              aria-hidden={!basemapOpen}
              inert={!basemapOpen}
            >
              <div className="panel-title">
                <span>底图与地形</span>
                <button className="icon-button" aria-label="关闭底图面板" onClick={() => setBasemapOpen(false)}><IconX size={17} /></button>
              </div>
              <div className="basemap-list">
                {basemaps.map((item) => (
                  <button key={item.id} className={item.id === basemapId ? 'selected' : ''} aria-pressed={item.id === basemapId} onClick={() => setBasemapId(item.id)}>
                    <span className="tile-chip" style={{ background: item.color }} />
                    <span><strong>{item.name}</strong><small>{item.scope}</small></span>
                    <span className="radio" />
                  </button>
                ))}
              </div>
              <label className="switch-line">
                <span>三维地形<small>{hasCesiumIonToken ? '真实山地与地表起伏' : '当前使用标准地表'}</small></span>
                <input type="checkbox" checked={terrainEnabled} onChange={(event) => setTerrainEnabled(event.target.checked)} />
              </label>
            </aside>
          </div>

          <div className="zoom-stack surface">
            <button aria-label="放大" onClick={() => zoomMap('in')}><IconPlus size={18} /></button>
            <button aria-label="缩小" onClick={() => zoomMap('out')}><IconMinus size={18} /></button>
          </div>

          {activeTrack?.points.length ? (
            <PlaybackDock
              track={activeTrack}
              scrub={scrub}
              isPlaying={isPlaying}
              onPlay={() => setIsPlaying((value) => !value)}
              onSeek={setScrubValue}
              rangeRef={rangeInputRef}
              profileOpen={profileOpen}
              onToggleProfile={() => setProfileOpen((value) => !value)}
            >
              {profileOpen && (
                <TrackProfile
                  data={chartData}
                  metric={profileMetric}
                  onMetricChange={setProfileMetric}
                  distance={currentPoint?.distanceKm ?? 0}
                  onSeek={seekFromProfile}
                  onClose={() => setProfileOpen(false)}
                />
              )}
            </PlaybackDock>
          ) : (
            <div className="map-empty-hint surface">
              <IconFileImport size={21} />
              <span>导入轨迹，开始探索<small>支持拖放文件和粘贴日志文本</small></span>
              <button className="command primary-command" onClick={() => fileInputRef.current?.click()}>导入日志</button>
            </div>
          )}

          <div className="map-readout" aria-label="光标坐标与太阳时">
            <span>{Math.abs(cursor.lat).toFixed(4)}° {cursor.lat < 0 ? 'S' : 'N'}&nbsp; {Math.abs(cursor.lon).toFixed(4)}° {cursor.lon < 0 ? 'W' : 'E'}</span>
            <span className="readout-elevation">{Math.round(cursor.ele ?? 0)} m</span>
            <span className="readout-solar">太阳时 {formatLocalSolarTime(sceneTime, cursor.lon)}</span>
            <span className="readout-height">视高 {formatCameraHeight(cameraHeight)}</span>
          </div>
        </section>
      </div>

      <div
        className={`modal-backdrop ${pasteOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-labelledby="paste-title"
        aria-modal={pasteOpen ? 'true' : undefined}
        aria-hidden={!pasteOpen}
        inert={!pasteOpen}
        onClick={(event) => { if (event.target === event.currentTarget) setPasteOpen(false); }}
        onKeyDown={(event) => {
          if (event.key !== 'Tab') return;
          const controls = event.currentTarget.querySelectorAll('button:not(:disabled), textarea');
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
      >
        <div className="paste-modal">
          <div className="panel-title">
            <span id="paste-title">粘贴日志文本</span>
            <button className="icon-button" onClick={() => setPasteOpen(false)} aria-label="关闭粘贴弹窗"><IconX size={18} /></button>
          </div>
          <p>支持 CSV、GPX、KML、GeoJSON 和 NMEA，内容仅在本地解析。</p>
          <textarea ref={pasteInputRef} aria-label="日志文本" value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="在这里粘贴轨迹日志…" />
          <span className="paste-status" role="status">{status}</span>
          <div className="modal-actions">
            <button className="command" onClick={() => setPasteOpen(false)}>取消</button>
            <button className="command primary-command" disabled={!pasteText.trim()} onClick={handlePasteImport}>导入轨迹</button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".gpx,.kml,.geojson,.json,.csv,.txt,.nmea,.log"
        className="hidden-file"
        onChange={(event) => {
          importFiles(event.target.files);
          event.target.value = '';
        }}
      />
    </main>
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
