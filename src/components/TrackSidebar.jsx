import { IconArrowUpRight, IconCheck, IconClipboardText, IconPlus, IconRoute, IconSearch, IconTrash, IconX } from '@tabler/icons-react';
import { useState } from 'react';
import { formatDuration } from '../lib/track.js';

export default function TrackSidebar({ isOpen, tracks, activeTrack, search, onSearch, onSelect, onImport, onFiles, onPaste, onClear, onClose, onProfile, status }) {
  const [dragging, setDragging] = useState(false);
  const filteredTracks = tracks.filter((track) => track.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <aside id="track-sidebar" className={`track-sidebar ${isOpen ? 'is-open' : ''}`} aria-label="轨迹资料" aria-hidden={!isOpen} inert={!isOpen}>
      <div className="sidebar-header">
        <h1>轨迹<span className="track-count">{tracks.length}</span></h1>
        <button className="icon-button" aria-label="收起轨迹资料" title="收起轨迹资料" onClick={onClose}><IconX size={17} /></button>
      </div>

      <div className="sidebar-scroll">
        <label className="track-search">
          <IconSearch size={16} />
          <input type="search" value={search} aria-label="搜索轨迹" onChange={(event) => onSearch(event.target.value)} placeholder="搜索轨迹…" />
        </label>

        <div className="track-list" aria-label="轨迹列表">
          {filteredTracks.map((track) => (
            <button key={track.id} className={`track-item ${track.id === activeTrack?.id ? 'selected' : ''}`} aria-pressed={track.id === activeTrack?.id} onClick={() => onSelect(track)} title={track.name}>
              <span className="track-icon" style={{ '--track-color': track.color }}><IconRoute size={19} stroke={1.7} /></span>
              <span className="track-item-copy">
                <strong>{track.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ')}</strong>
                <small>{formatDistance(track.stats.distanceKm)} km<span>·</span>{track.stats.points.toLocaleString()} 点</small>
              </span>
              {track.id === activeTrack?.id && <IconCheck className="track-selected" size={15} stroke={2} />}
            </button>
          ))}
          {!filteredTracks.length && <p className="list-empty">{search ? '没有找到匹配的轨迹' : '还没有轨迹，导入一段旅程吧。'}</p>}
        </div>

        <div
          className={`import-zone ${dragging ? 'is-dragging' : ''}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
          onDrop={(event) => { event.preventDefault(); event.stopPropagation(); setDragging(false); onFiles(event.dataTransfer.files); }}
        >
          <button className="import-button" onClick={onImport}><IconPlus size={16} />添加日志<span>或拖放文件</span></button>
          <small>GPX · KML · GeoJSON · CSV · NMEA</small>
        </div>
        <button className="text-button paste-trigger" onClick={onPaste}><IconClipboardText size={15} />粘贴日志文本</button>

        {activeTrack?.points.length > 0 && (
          <section className="track-overview" aria-label="当前轨迹统计">
            <div className="section-caption"><span>当前轨迹</span><span>{activeTrack.name.split('.').at(-1).toUpperCase()}</span></div>
            <h2 title={activeTrack.name}>{activeTrack.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ')}</h2>
            <div className="distance-hero"><strong>{formatDistance(activeTrack.stats.distanceKm)}</strong><span>km<small>总距离</small></span></div>
            <div className="overview-metrics">
              <Metric label="行程时长" value={formatDuration(activeTrack.stats.durationHours)} />
              <Metric label="移动速度" value={`${activeTrack.stats.movingSpeedKmh.toFixed(1)} km/h`} />
              <Metric label="累计爬升" value={`↗ ${Math.round(activeTrack.stats.ascentM).toLocaleString()} m`} />
              <Metric label="累计下降" value={`↘ ${Math.round(activeTrack.stats.descentM).toLocaleString()} m`} />
            </div>
            <div className="track-metadata">
              <span>轨迹点<strong>{activeTrack.stats.points.toLocaleString()} 点</strong></span>
              <span>海拔范围<strong>{activeTrack.stats.minElevationM == null ? '—' : `${Math.round(activeTrack.stats.minElevationM).toLocaleString()} – ${Math.round(activeTrack.stats.maxElevationM).toLocaleString()} m`}</strong></span>
              {activeTrack.points[0].time && <span>开始日期<strong>{activeTrack.points[0].time.slice(0, 10).replaceAll('-', '.')}</strong></span>}
            </div>
            <button className="overview-profile-link" onClick={onProfile}>查看轨迹剖面<IconArrowUpRight size={16} /></button>
          </section>
        )}

        {tracks.length > 0 && <button className="clear-button" onClick={onClear}><IconTrash size={14} />清空工作台</button>}
      </div>

      <div className="sidebar-status" role="status" title={status}><span className="status-dot" /><span>{status}</span></div>
    </aside>
  );
}

function Metric({ label, value }) {
  return <div className="overview-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatDistance(value) {
  return value.toLocaleString('zh-CN', { minimumFractionDigits: value < 100 ? 1 : 0, maximumFractionDigits: value < 100 ? 1 : 0 });
}
