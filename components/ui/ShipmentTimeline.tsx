'use client';

import { ArrowRight, Check, Clock } from 'lucide-react';
import { SIM_SCALE, STAGES, etaSeconds, formatSimMinutes, phaseLabel, stageIndex, useActiveSite, useWT, type Truck } from '@/lib/store';
import { useSelectAndFocus } from './shared';

function stageAgo(ms: number | null) {
  if (ms === null) return '—';
  const simMin = ((Date.now() - ms) / 1000) * (SIM_SCALE / 60);
  if (simMin < 1) return 'now';
  if (simMin < 60) return `${Math.round(simMin)}m ago`;
  return `${Math.floor(simMin / 60)}h ${Math.floor(simMin % 60)}m ago`;
}

function stageProgress(t: Truck) {
  switch (t.phase) {
    case 'confirmed':
    case 'picked':
    case 'loaded':
      return t.t;
    case 'transit':
      return t.t * 0.7;
    case 'queued':
      return 0.72;
    case 'arriving':
      return 0.72 + t.t * 0.18;
    case 'reversing':
      return 0.9 + t.t * 0.1;
    case 'unloading':
      return t.palletsDone / t.pallets;
    default:
      return 1;
  }
}

export function ShipmentTimeline() {
  const site = useActiveSite();
  const selection = useWT((s) => s.selection);
  const go = useSelectAndFocus();

  const upcoming = site.trucks
    .filter((t) => t.phase !== 'unloading' && t.phase !== 'departing')
    .sort((a, b) => etaSeconds(a) - etaSeconds(b));
  const selected = selection.kind === 'truck' ? site.trucks.find((t) => t.id === selection.id) : undefined;
  const truck = selected ?? upcoming[0] ?? site.trucks[0];
  if (!truck) return <div className="card timeline" />;

  const si = stageIndex(truck.phase);
  const eta = etaSeconds(truck);
  const etaText =
    truck.phase === 'unloading'
      ? `${truck.palletsDone}/${truck.pallets} plt`
      : truck.phase === 'departing'
        ? 'Delivered'
        : truck.phase === 'queued'
          ? 'Waiting'
          : formatSimMinutes(eta);
  const lateRisk = truck.delayed || truck.phase === 'queued';

  return (
    <div className="card timeline">
      <div className="tl-head">
        <div>
          <span className="sel-kicker">{selected ? 'Selected shipment' : 'Next arrival'}</span>
          <div className="tl-title">
            <b>{truck.shipmentId}</b>
            <button className="tl-truck" onClick={() => go({ kind: 'truck', id: truck.id })}>
              {truck.id} · {truck.plate}
            </button>
          </div>
          <div className="tl-route">
            <span>{truck.origin}</span>
            <ArrowRight size={13} />
            <span>
              {site.code}
              {truck.dock !== null ? ` · Bay ${truck.dock + 1}` : ''}
            </span>
            <span className="muted">· {truck.carrier}</span>
          </div>
        </div>
        <div className={`tl-eta ${lateRisk ? 'is-risk' : ''} ${truck.phase === 'unloading' ? 'is-docked' : ''}`}>
          <small>
            <Clock size={12} /> {truck.phase === 'unloading' ? 'Unloading' : truck.phase === 'departing' ? 'Status' : 'ETA'}
          </small>
          <b>{etaText}</b>
          <span>{lateRisk ? (truck.phase === 'queued' ? 'All bays busy' : 'Traffic delay') : truck.late === false ? 'On time' : truck.late ? 'Arrived late' : phaseLabel(truck)}</span>
        </div>
      </div>

      <ol className="stages">
        {STAGES.map((label, i) => {
          const state = i < si ? 'done' : i === si ? 'active' : 'todo';
          return (
            <li key={label} className={`stage is-${state}`}>
              <div className="stage-track">
                <span className="stage-node">{state === 'done' ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
                {i < STAGES.length - 1 && (
                  <span className="stage-line">
                    <span style={{ width: i < si ? '100%' : i === si ? `${stageProgress(truck) * 100}%` : '0%' }} />
                  </span>
                )}
              </div>
              <b>{label}</b>
              <small>{state === 'todo' ? (i === 4 && eta !== Infinity ? `in ${formatSimMinutes(eta)}` : '—') : stageAgo(truck.stageAt[i])}</small>
            </li>
          );
        })}
      </ol>

      <div className="tl-next">
        <span className="muted">Up next</span>
        {upcoming
          .filter((t) => t.id !== truck.id)
          .slice(0, 4)
          .map((t) => (
            <button key={t.id} className="chip-btn" onClick={() => go({ kind: 'truck', id: t.id })}>
              <b>{t.id}</b>
              <span>{t.phase === 'queued' ? 'gate' : formatSimMinutes(etaSeconds(t))}</span>
            </button>
          ))}
      </div>
    </div>
  );
}
