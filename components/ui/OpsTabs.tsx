'use client';

import { useState } from 'react';
import { etaSeconds, formatSimMinutes, isOnMap, phaseLabel, useActiveSite, useWT } from '@/lib/store';
import { Progress, dockStatus, dockTone, useSelectAndFocus } from './shared';

type Tab = 'docks' | 'forklifts' | 'trucks';

export function OpsTabs() {
  const [tab, setTab] = useState<Tab>('docks');
  const site = useActiveSite();
  const selection = useWT((s) => s.selection);
  const go = useSelectAndFocus();

  const trucks = [...site.trucks].sort((a, b) => {
    const rank = (p: string) => ['unloading', 'reversing', 'arriving', 'departing', 'queued', 'transit', 'loaded', 'picked', 'confirmed'].indexOf(p);
    return rank(a.phase) - rank(b.phase) || etaSeconds(a) - etaSeconds(b);
  });

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'docks', label: 'Docks', count: site.docks.length },
    { id: 'forklifts', label: 'Forklifts', count: site.forklifts.length },
    { id: 'trucks', label: 'Trucks', count: site.trucks.length },
  ];

  return (
    <div className="card ops">
      <div className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            <span className="tab-count">{t.count}</span>
          </button>
        ))}
        <span className="tabs-live">
          <span className="live-dot" /> live
        </span>
      </div>

      <div className="ops-list">
        {tab === 'docks' &&
          site.docks.map((d) => {
            const { status, truck } = dockStatus(site, d.idx);
            const sel = selection.kind === 'dock' && selection.idx === d.idx;
            return (
              <button key={d.idx} className={`ops-row ${sel ? 'is-selected' : ''}`} onClick={() => go({ kind: 'dock', idx: d.idx })}>
                <span className="ops-key">Bay {d.idx + 1}</span>
                <span className={`pill tone-${dockTone[status]}`}>{status}</span>
                <span className="ops-mid">{truck ? `${truck.id} · ${truck.carrier}` : status === 'Maintenance' ? 'Leveler fault' : 'Available'}</span>
                <span className="ops-end">
                  {truck && status === 'Unloading' ? (
                    <>
                      <Progress value={truck.palletsDone / truck.pallets} thin />
                      <small>
                        {truck.palletsDone}/{truck.pallets}
                      </small>
                    </>
                  ) : (
                    <small className="muted">{truck ? phaseLabel(truck) : ''}</small>
                  )}
                </span>
              </button>
            );
          })}

        {tab === 'forklifts' &&
          site.forklifts.map((f) => {
            const truck = site.trucks.find((t) => t.dock === f.dock && t.phase === 'unloading');
            const sel = selection.kind === 'forklift' && selection.id === f.id;
            const tone = f.status === 'unloading' ? 'blue' : f.status === 'charging' ? 'green' : 'grey';
            return (
              <button key={f.id} className={`ops-row ${sel ? 'is-selected' : ''}`} onClick={() => go({ kind: 'forklift', id: f.id })}>
                <span className="ops-key">{f.id}</span>
                <span className={`pill tone-${tone}`}>{f.status === 'unloading' ? 'Working' : f.status === 'charging' ? 'Charging' : 'Idle'}</span>
                <span className="ops-mid">
                  Bay {f.dock + 1}
                  {truck ? ` · ${truck.id}` : ''} · {f.moved} plt today
                </span>
                <span className="ops-end">
                  <Progress value={f.battery / 100} tone={f.battery < 25 ? 'red' : f.battery < 50 ? 'amber' : 'green'} thin />
                  <small>{Math.round(f.battery)}%</small>
                </span>
              </button>
            );
          })}

        {tab === 'trucks' &&
          trucks.map((t) => {
            const sel = selection.kind === 'truck' && selection.id === t.id;
            const onMap = isOnMap(t);
            const tone = t.phase === 'unloading' ? 'blue' : t.phase === 'queued' || t.delayed ? 'amber' : onMap ? 'indigo' : 'grey';
            return (
              <button key={t.id} className={`ops-row ${sel ? 'is-selected' : ''}`} onClick={() => go({ kind: 'truck', id: t.id })}>
                <span className="ops-key">{t.id}</span>
                <span className={`pill tone-${tone}`}>{phaseLabel(t)}</span>
                <span className="ops-mid">
                  {t.carrier} · {t.pallets} plt
                </span>
                <span className="ops-end">
                  {t.phase === 'unloading' ? (
                    <>
                      <Progress value={t.palletsDone / t.pallets} thin />
                      <small>Bay {(t.dock ?? 0) + 1}</small>
                    </>
                  ) : (
                    <small className="muted">{t.phase === 'departing' ? 'Leaving' : t.dock !== null ? `Bay ${t.dock + 1} · ${formatSimMinutes(etaSeconds(t))}` : t.phase === 'queued' ? 'At gate' : `ETA ${formatSimMinutes(etaSeconds(t))}`}</small>
                  )}
                </span>
              </button>
            );
          })}
      </div>
    </div>
  );
}
