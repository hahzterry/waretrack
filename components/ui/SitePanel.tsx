'use client';

import { useEffect, useRef } from 'react';
import { BatteryCharging, BatteryFull, BatteryLow, BatteryMedium, Crosshair, MapPin, Snowflake, Thermometer, X } from 'lucide-react';
import { cameraApi } from '@/lib/camera';
import { entityPosition } from '@/lib/focus';
import { etaSeconds, formatSimMinutes, isOnMap, phaseLabel, stockTotal, useActiveSite, useWT, type Forklift, type SiteState, type Truck } from '@/lib/store';
import { Progress, dockStatus, dockTone, fmt, siteHealth, useSelectAndFocus } from './shared';

function BatteryIcon({ f }: { f: Forklift }) {
  if (f.status === 'charging') return <BatteryCharging size={15} className="txt-green" />;
  if (f.battery < 25) return <BatteryLow size={15} className="txt-red" />;
  if (f.battery < 60) return <BatteryMedium size={15} className="txt-amber" />;
  return <BatteryFull size={15} className="txt-muted" />;
}

function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="sec-title">
      <span>{children}</span>
      {aside && <span className="sec-aside">{aside}</span>}
    </div>
  );
}

function TruckCard({ site, t }: { site: SiteState; t: Truck }) {
  const select = useWT((s) => s.select);
  const eta = etaSeconds(t);
  return (
    <div className="sel-card">
      <div className="sel-head">
        <span className="sel-kicker">Selected truck</span>
        <button className="ghost-btn" onClick={() => select({ kind: 'site' })} aria-label="Clear selection">
          <X size={14} />
        </button>
      </div>
      <div className="sel-title">
        <b>{t.id}</b>
        <span className={`pill tone-${t.phase === 'unloading' ? 'blue' : t.phase === 'queued' ? 'amber' : isOnMap(t) ? 'amber' : 'grey'}`}>{phaseLabel(t)}</span>
      </div>
      <div className="sel-grid">
        <div>
          <small>Carrier</small>
          <span>{t.carrier}</span>
        </div>
        <div>
          <small>Plate</small>
          <span>{t.plate}</span>
        </div>
        <div>
          <small>Load</small>
          <span>
            {t.pallets} plt · {t.skuName}
          </span>
        </div>
        <div>
          <small>Reefer</small>
          <span>{t.reeferTemp.toFixed(1)}°C</span>
        </div>
        <div>
          <small>Bay</small>
          <span>{t.dock !== null ? `Bay ${t.dock + 1}` : 'Unassigned'}</span>
        </div>
        <div>
          <small>{t.phase === 'unloading' || t.phase === 'departing' ? 'Status' : 'ETA'}</small>
          <span>{t.phase === 'unloading' ? `${t.palletsDone}/${t.pallets} pallets` : t.phase === 'departing' ? 'Completed' : formatSimMinutes(eta)}</span>
        </div>
      </div>
      {t.phase === 'unloading' && <Progress value={t.palletsDone / t.pallets} />}
      {isOnMap(t) && (
        <button
          className="link-btn"
          onClick={() => {
            const p = entityPosition(site, { kind: 'truck', id: t.id });
            if (p) cameraApi.focus(p.x, p.z);
          }}
        >
          <Crosshair size={14} /> Focus on map
        </button>
      )}
    </div>
  );
}

function ForkliftCard({ site, f }: { site: SiteState; f: Forklift }) {
  const select = useWT((s) => s.select);
  const truck = site.trucks.find((t) => t.dock === f.dock && t.phase === 'unloading');
  return (
    <div className="sel-card">
      <div className="sel-head">
        <span className="sel-kicker">Selected forklift</span>
        <button className="ghost-btn" onClick={() => select({ kind: 'site' })} aria-label="Clear selection">
          <X size={14} />
        </button>
      </div>
      <div className="sel-title">
        <b>{f.id}</b>
        <span className={`pill tone-${f.status === 'unloading' ? 'blue' : f.status === 'charging' ? 'green' : 'grey'}`}>{f.status === 'unloading' ? 'Moving pallets' : f.status === 'charging' ? 'Charging' : 'Idle'}</span>
      </div>
      <div className="sel-grid">
        <div>
          <small>Assigned</small>
          <span>Bay {f.dock + 1}</span>
        </div>
        <div>
          <small>Battery</small>
          <span>{Math.round(f.battery)}%</span>
        </div>
        <div>
          <small>Task</small>
          <span>{truck ? `${truck.id} · ${truck.palletsDone}/${truck.pallets}` : '—'}</span>
        </div>
        <div>
          <small>Moved today</small>
          <span>{f.moved} plt</span>
        </div>
      </div>
      <Progress value={f.battery / 100} tone={f.battery < 25 ? 'red' : f.status === 'charging' ? 'green' : 'blue'} />
    </div>
  );
}

function DockCard({ site, idx }: { site: SiteState; idx: number }) {
  const select = useWT((s) => s.select);
  const go = useSelectAndFocus();
  const { status, truck } = dockStatus(site, idx);
  return (
    <div className="sel-card">
      <div className="sel-head">
        <span className="sel-kicker">Selected bay</span>
        <button className="ghost-btn" onClick={() => select({ kind: 'site' })} aria-label="Clear selection">
          <X size={14} />
        </button>
      </div>
      <div className="sel-title">
        <b>Bay {idx + 1}</b>
        <span className={`pill tone-${dockTone[status]}`}>{status}</span>
      </div>
      {truck ? (
        <button className="row-btn" onClick={() => go({ kind: 'truck', id: truck.id })}>
          <span>
            {truck.id} · {truck.carrier}
          </span>
          <small>{truck.phase === 'unloading' ? `${truck.palletsDone}/${truck.pallets} plt` : phaseLabel(truck)}</small>
        </button>
      ) : (
        <p className="muted small">{status === 'Maintenance' ? 'Leveler fault — technician dispatched.' : 'Ready for the next inbound truck.'}</p>
      )}
    </div>
  );
}

export function SitePanel() {
  const site = useActiveSite();
  const selection = useWT((s) => s.selection);
  const flashSku = useWT((s) => s.flashSku);
  const go = useSelectAndFocus();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!flashSku) return;
    listRef.current?.querySelector(`[data-sku="${flashSku}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [flashSku]);

  const selKey = selection.kind === 'truck' || selection.kind === 'forklift' ? selection.id : selection.kind === 'dock' ? `d${selection.idx}` : 'site';
  useEffect(() => {
    if (selKey !== 'site') listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selKey]);

  const health = siteHealth(site);
  const stock = stockTotal(site);
  const frozen = site.inventory.filter((i) => i.zone === 'Frozen').reduce((a, i) => a + i.qty, 0);
  const chilled = stock - frozen;
  const low = site.inventory.filter((i) => i.qty < i.min).length;

  const selTruck = selection.kind === 'truck' ? site.trucks.find((t) => t.id === selection.id) : undefined;
  const selFork = selection.kind === 'forklift' ? site.forklifts.find((f) => f.id === selection.id) : undefined;

  return (
    <aside className="card side" ref={listRef}>
      {selTruck && <TruckCard site={site} t={selTruck} />}
      {selFork && <ForkliftCard site={site} f={selFork} />}
      {selection.kind === 'dock' && <DockCard site={site} idx={selection.idx} />}

      <div className={`site-head ${selection.kind === 'site' ? 'is-selected' : ''}`}>
        <div className="site-head-top">
          <span className="sel-kicker">Selected site</span>
          <span className={`pill tone-${health.tone}`}>
            <span className="pill-dot" />
            {health.label}
          </span>
        </div>
        <h2>{site.name}</h2>
        <div className="site-meta">
          <span>
            <MapPin size={13} /> {site.code} · {site.city}
          </span>
        </div>
        <div className="temps">
          <span className="temp">
            <Snowflake size={14} />
            <span>
              <small>Frozen</small>
              <b>{site.temps.frozen.toFixed(1)}°C</b>
            </span>
          </span>
          <span className="temp">
            <Thermometer size={14} />
            <span>
              <small>Chilled</small>
              <b>{site.temps.chilled.toFixed(1)}°C</b>
            </span>
          </span>
        </div>
      </div>

      <section>
        <SectionTitle aside={`${fmt(stock)} / ${fmt(site.capacity)} plt`}>Stock vs capacity</SectionTitle>
        <div className="cap-bar" title={`${Math.round((stock / site.capacity) * 100)}% used`}>
          <div className="cap-frozen" style={{ width: `${(frozen / site.capacity) * 100}%` }} />
          <div className="cap-chilled" style={{ width: `${(chilled / site.capacity) * 100}%` }} />
        </div>
        <div className="cap-legend">
          <span>
            <i className="lg-frozen" /> Frozen {fmt(frozen)}
          </span>
          <span>
            <i className="lg-chilled" /> Chilled {fmt(chilled)}
          </span>
          <span className="cap-pct">{Math.round((stock / site.capacity) * 100)}%</span>
        </div>
      </section>

      <section>
        <SectionTitle aside={`${site.docks.filter((d) => d.truckId).length}/${site.docks.length} in use`}>Dock bays</SectionTitle>
        <div className="bays">
          {site.docks.map((d) => {
            const { status, truck } = dockStatus(site, d.idx);
            const sel = selection.kind === 'dock' && selection.idx === d.idx;
            return (
              <button key={d.idx} className={`bay tone-${dockTone[status]} ${sel ? 'is-selected' : ''}`} onClick={() => go({ kind: 'dock', idx: d.idx })}>
                <span className="bay-num">B{d.idx + 1}</span>
                <span className="bay-status">{status}</span>
                {truck && status === 'Unloading' ? <Progress value={truck.palletsDone / truck.pallets} thin /> : <span className="bay-truck">{truck ? truck.id : status === 'Maintenance' ? 'Out of service' : '—'}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle aside={low ? <span className="txt-amber">{low} low</span> : 'All healthy'}>Inventory</SectionTitle>
        <div className="inv">
          {[...site.inventory]
            .sort((a, b) => a.qty / a.min - b.qty / b.min)
            .map((i) => {
              const isLow = i.qty < i.min;
              return (
                <div key={i.sku} data-sku={i.sku} className={`inv-row ${flashSku === i.sku ? 'is-flash' : ''}`}>
                  <span className={`inv-zone ${i.zone === 'Frozen' ? 'z-frozen' : 'z-chilled'}`}>{i.zone === 'Frozen' ? <Snowflake size={12} /> : <Thermometer size={12} />}</span>
                  <span className="inv-main">
                    <b>{i.name}</b>
                    <small>
                      {i.sku} · {fmt(i.qty)} plt
                    </small>
                  </span>
                  <span className={`badge ${isLow ? 'badge-low' : 'badge-ok'}`}>{isLow ? 'Low Stock' : 'In Stock'}</span>
                </div>
              );
            })}
        </div>
      </section>

      <section>
        <SectionTitle aside={`${site.forklifts.filter((f) => f.status === 'unloading').length} active`}>Forklift fleet</SectionTitle>
        <div className="fleet">
          {site.forklifts.map((f) => {
            const truck = site.trucks.find((t) => t.dock === f.dock && t.phase === 'unloading');
            const progress = truck ? truck.palletsDone / truck.pallets : 0;
            const sel = selection.kind === 'forklift' && selection.id === f.id;
            return (
              <button key={f.id} className={`fleet-row ${sel ? 'is-selected' : ''}`} onClick={() => go({ kind: 'forklift', id: f.id })}>
                <span className="fleet-id">
                  <b>{f.id}</b>
                  <small>Bay {f.dock + 1}</small>
                </span>
                <span className="fleet-mid">
                  <span className="fleet-status">
                    <span className={`dot tone-${f.status === 'unloading' ? 'blue' : f.status === 'charging' ? 'green' : 'grey'}`} />
                    {f.status === 'unloading' ? `Unloading ${truck?.id ?? ''}` : f.status === 'charging' ? 'Charging' : truck ? 'Waiting' : 'Idle'}
                  </span>
                  <Progress value={f.status === 'charging' ? f.battery / 100 : progress} tone={f.status === 'charging' ? 'green' : 'blue'} thin />
                </span>
                <span className="fleet-bat">
                  <BatteryIcon f={f} />
                  {Math.round(f.battery)}%
                </span>
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
}
