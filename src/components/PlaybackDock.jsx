import { IconChartAreaLine, IconChevronDown, IconChevronUp, IconPlayerPauseFilled, IconPlayerPlayFilled, IconPlayerSkipBack, IconPlayerSkipForward } from '@tabler/icons-react';

export default function PlaybackDock({ track, scrub, isPlaying, onPlay, onSeek, rangeRef, profileOpen, onToggleProfile, children }) {
  return (
    <section className="playback-dock surface" aria-label="轨迹回放">
      {children}
      <div className="playback-row">
        <div className="playback-track"><strong>轨迹回放</strong><span title={track.name}>{track.name.replace(/\.[^.]+$/, '').replaceAll('_', ' ')}</span></div>
        <div className="playback-buttons">
          <button className="icon-button" aria-label="跳到起点" title="跳到起点" onClick={() => onSeek(0)}><IconPlayerSkipBack size={16} /></button>
          <button className="play-button" aria-label={isPlaying ? '暂停回放' : '播放轨迹'} title={isPlaying ? '暂停回放' : '播放轨迹'} onClick={onPlay}>{isPlaying ? <IconPlayerPauseFilled size={16} /> : <IconPlayerPlayFilled size={17} />}</button>
          <button className="icon-button" aria-label="跳到终点" title="跳到终点" onClick={() => onSeek(100)}><IconPlayerSkipForward size={16} /></button>
        </div>
        <div className="timeline">
          <input ref={rangeRef} aria-label="轨迹时间轴" aria-valuetext={`${Math.round(scrub)}%`} type="range" min="0" max="100" step="0.01" value={scrub} style={{ '--progress': `${scrub}%` }} onChange={(event) => onSeek(event.target.value)} />
          <div className="timeline-labels"><span>起点</span><span>{Math.round(track.stats.distanceKm).toLocaleString()} km</span></div>
        </div>
        <span className="playback-progress">{Math.round(scrub)}<small>%</small></span>
        <button id="profile-toggle" className={`profile-toggle ${profileOpen ? 'is-active' : ''}`} aria-label={profileOpen ? '收起轨迹剖面' : '展开轨迹剖面'} aria-expanded={profileOpen} aria-controls={profileOpen ? 'track-profile' : undefined} onClick={onToggleProfile} title={profileOpen ? '收起轨迹剖面' : '展开轨迹剖面'}>
          <IconChartAreaLine size={17} /><span>剖面</span>{profileOpen ? <IconChevronDown size={14} /> : <IconChevronUp size={14} />}
        </button>
      </div>
    </section>
  );
}
