'use client';

import { useCallback } from 'react';
import { cameraApi } from '@/lib/camera';
import { entityPosition } from '@/lib/focus';
import { getWT, useWT, type Selection, type SiteState, type Truck } from '@/lib/store';

/** Select an entity and glide the camera to it when it's on the map. */
export function useSelectAndFocus() {
  const select = useWT((s) => s.select);
  return useCallback(
    (sel: Selection, focus = true) => {
      select(sel);
      if (!focus) return;
      const st = getWT();
      const p = entityPosition(st.sites[st.activeSiteId], sel);
      if (p && sel.kind !== 'site') cameraApi.focus(p.x, p.z);
    },
    [select],
  );
}

export function Sparkline({ data, color = '#2f6bff', height = 34, width = 120 }: { data: number[]; color?: string; height?: number; width?: number }) {
  if (data.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * width, height - 3 - ((v - min) / span) * (height - 6)]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `${d} L${width},${height} L0,${height} Z`;
  const id = `g${color.replace('#', '')}`;
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="spark" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="2.8" fill={color} />
    </svg>
  );
}

export function Progress({ value, tone = 'blue', thin = false }: { value: number; tone?: 'blue' | 'green' | 'amber' | 'red' | 'grey'; thin?: boolean }) {
  return (
    <div className={`progress ${thin ? 'thin' : ''}`}>
      <div className={`progress-fill tone-${tone}`} style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export type DockStatus = 'Free' | 'Docking' | 'Unloading' | 'Departing' | 'Maintenance';

export function dockStatus(site: SiteState, idx: number): { status: DockStatus; truck?: Truck } {
  const d = site.docks[idx];
  if (d.maintenance) return { status: 'Maintenance' };
  const truck = site.trucks.find((t) => t.id === d.truckId);
  if (!truck) return { status: 'Free' };
  if (truck.phase === 'unloading') return { status: 'Unloading', truck };
  if (truck.phase === 'departing') return { status: 'Departing', truck };
  return { status: 'Docking', truck };
}

export const dockTone: Record<DockStatus, string> = {
  Free: 'green',
  Docking: 'amber',
  Unloading: 'blue',
  Departing: 'grey',
  Maintenance: 'red',
};

export function siteHealth(site: SiteState): { label: string; tone: 'green' | 'amber' | 'red' | 'blue' } {
  const busy = site.docks.filter((d) => d.truckId).length;
  const avail = site.docks.filter((d) => !d.maintenance).length;
  if (site.docks.some((d) => d.maintenance)) return { label: 'Attention', tone: 'red' };
  if (site.trucks.some((t) => t.phase === 'queued')) return { label: 'Congested', tone: 'amber' };
  if (busy / avail >= 0.8) return { label: 'Busy', tone: 'blue' };
  return { label: 'Operational', tone: 'green' };
}

export function relTime(ms: number) {
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${Math.floor(s)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
