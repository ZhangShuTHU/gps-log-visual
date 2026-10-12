import { IconChevronDown } from '@tabler/icons-react';
import { Area, CartesianGrid, ComposedChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis, ZIndexLayer, usePlotArea, useXAxisInverseScale } from 'recharts';

const metrics = {
  elevation: { label: '海拔', unit: 'm', color: '#217653' },
  speed: { label: '速度', unit: 'km/h', color: '#357fb8' },
  slope: { label: '坡度', unit: '%', color: '#bc763c' },
};

export default function TrackProfile({ data, metric, onMetricChange, distance, onSeek, onClose }) {
  const selected = metrics[metric];
  const hasData = data.some((point) => Number.isFinite(point[metric]));

  return (
    <section id="track-profile" className="track-profile" aria-label="轨迹剖面">
      <div className="profile-header">
        <div className="profile-tabs" role="tablist" aria-label="剖面指标">
          {Object.entries(metrics).map(([key, value]) => (
            <button key={key} id={`profile-tab-${key}`} role="tab" aria-selected={key === metric} aria-controls="track-profile-plot" tabIndex={key === metric ? 0 : -1} className={key === metric ? 'is-active' : ''} onClick={() => onMetricChange(key)} onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
              event.preventDefault();
              const keys = Object.keys(metrics);
              const index = keys.indexOf(key);
              const next = event.key === 'Home' ? 0 : event.key === 'End' ? keys.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + keys.length) % keys.length;
              onMetricChange(keys[next]);
              document.getElementById(`profile-tab-${keys[next]}`)?.focus();
            }}>{value.label}<small>{value.unit}</small></button>
          ))}
        </div>
        <span className="profile-hint">点击剖面，定位旅程</span>
        <button className="icon-button" onClick={onClose} aria-label="收起轨迹剖面" title="收起轨迹剖面"><IconChevronDown size={17} /></button>
      </div>
      <div id="track-profile-plot" className="profile-chart" role="tabpanel" aria-labelledby={`profile-tab-${metric}`}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 800, height: 128 }}>
            <ComposedChart data={data} margin={{ top: 8, right: 18, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#e4e9e5" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="km" type="number" domain={['dataMin', 'dataMax']} tickLine={false} axisLine={false} minTickGap={52} tick={{ fontSize: 10, fill: '#748078' }} tickFormatter={(value) => `${Math.round(value).toLocaleString()} km`} height={22} />
              <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 10, fill: '#748078' }} tickFormatter={(value) => Math.round(value).toLocaleString()} tickCount={4} />
              <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #dce3df', background: '#fffefb', fontSize: 12 }} labelFormatter={(value) => `${Number(value).toFixed(1)} km`} formatter={(value) => [`${Number(value).toFixed(1)} ${selected.unit}`, selected.label]} />
              <Area type="monotone" dataKey={metric} stroke={selected.color} fill={selected.color} fillOpacity={0.1} strokeWidth={1.8} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }} isAnimationActive={false} />
              <ReferenceLine x={distance} stroke="#273f35" strokeDasharray="3 3" />
              <ProfileSeekArea onSeek={onSeek} />
            </ComposedChart>
          </ResponsiveContainer>
        ) : <p className="profile-empty">这段轨迹没有{selected.label}数据</p>}
      </div>
    </section>
  );
}

function ProfileSeekArea({ onSeek }) {
  const plot = usePlotArea();
  const inverseScale = useXAxisInverseScale();
  if (!plot || !inverseScale) return null;

  return <ZIndexLayer zIndex={1000}><rect className="profile-seek-area" x={plot.x} y={plot.y} width={plot.width} height={plot.height} fill="transparent" onClick={(event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    if (!bounds.width) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
    const distance = inverseScale(plot.x + fraction * plot.width);
    if (Number.isFinite(distance)) onSeek(distance);
  }} /></ZIndexLayer>;
}
