'use client';

import { Clock3, Package, Truck } from 'lucide-react';
import { isOnMap, stockTotal, useActiveSite } from '@/lib/store';
import { Sparkline, fmt } from './shared';

export function KpiCards() {
  const site = useActiveSite();
  const stock = stockTotal(site);
  const delta = stock - site.startStock;
  const fill = stock / site.capacity;

  const onMap = site.trucks.filter(isOnMap);
  const docked = site.trucks.filter((t) => t.phase === 'unloading').length;
  const inbound = site.trucks.filter((t) => ['transit', 'queued'].includes(t.phase)).length;
  const otd = (site.onTime / site.delivered) * 100;
  const otdPrev = site.otdHistory[0] ?? otd;
  const otdDelta = otd - otdPrev;

  return (
    <div className="kpis">
      <div className="card kpi">
        <div className="kpi-head">
          <span className="kpi-ico ico-blue">
            <Package size={16} />
          </span>
          <span>Stock on hand</span>
        </div>
        <div className="kpi-body">
          <div>
            <div className="kpi-value">
              {fmt(stock)}
              <small> plt</small>
            </div>
            <div className="kpi-sub">
              <span className={`chip ${delta >= 0 ? 'chip-up' : 'chip-down'}`}>
                {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
              </span>
              <span>{Math.round(fill * 100)}% of capacity</span>
            </div>
          </div>
          <Sparkline data={site.stockHistory} width={92} />
        </div>
      </div>

      <div className="card kpi">
        <div className="kpi-head">
          <span className="kpi-ico ico-indigo">
            <Truck size={16} />
          </span>
          <span>Trucks on site</span>
        </div>
        <div className="kpi-body">
          <div>
            <div className="kpi-value">
              {onMap.length}
              <small> / {site.docks.filter((d) => !d.maintenance).length} bays</small>
            </div>
            <div className="kpi-sub">
              <span className="chip chip-blue">{docked} docked</span>
              <span>{inbound} inbound</span>
            </div>
          </div>
          <div className="bay-pips" aria-hidden>
            {site.docks.map((d) => {
              const t = site.trucks.find((x) => x.id === d.truckId);
              const cls = d.maintenance ? 'pip-red' : !t ? 'pip-free' : t.phase === 'unloading' ? 'pip-blue' : 'pip-amber';
              return <span key={d.idx} className={`pip ${cls}`} />;
            })}
          </div>
        </div>
      </div>

      <div className="card kpi">
        <div className="kpi-head">
          <span className="kpi-ico ico-green">
            <Clock3 size={16} />
          </span>
          <span>On-time delivery</span>
        </div>
        <div className="kpi-body">
          <div>
            <div className="kpi-value">
              {otd.toFixed(1)}
              <small>%</small>
            </div>
            <div className="kpi-sub">
              <span className={`chip ${otdDelta >= 0 ? 'chip-up' : 'chip-down'}`}>
                {otdDelta >= 0 ? '▲' : '▼'} {Math.abs(otdDelta).toFixed(1)}
              </span>
              <span>
                {site.onTime}/{site.delivered} today
              </span>
            </div>
          </div>
          <Sparkline data={site.otdHistory} width={92} color="#16a34a" />
        </div>
      </div>
    </div>
  );
}
