'use client';

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { CARRIERS, ORIGINS, SITES, SKUS, type Zone } from './data';
import { dockX, pathLength, SPEEDS } from './layout';

/** 1 real second = SIM_SCALE simulated seconds (used for ETAs and "x min ago"). */
export const SIM_SCALE = 30;
export const FORKLIFT_CYCLE = 3.4; // real seconds per pallet move

export type TruckPhase =
  | 'confirmed'
  | 'picked'
  | 'loaded'
  | 'transit'
  | 'queued'
  | 'arriving'
  | 'reversing'
  | 'unloading'
  | 'departing';

export const STAGES = ['Confirmed', 'Picked', 'Loaded', 'In Transit', 'Unloading'] as const;

export interface Truck {
  id: string;
  shipmentId: string;
  plate: string;
  carrier: string;
  origin: string;
  sku: string;
  skuName: string;
  pallets: number;
  palletsDone: number;
  phase: TruckPhase;
  t: number; // progress within the current phase, 0..1
  dur: { confirmed: number; picked: number; loaded: number; transit: number; arrive: number; reverse: number; depart: number };
  dock: number | null;
  stageAt: (number | null)[]; // real ms timestamp when each of the 5 stages was reached
  plannedDockAt: number; // sim clock seconds
  dockedAt: number | null;
  late: boolean | null;
  delayed: boolean; // traffic delay injected in transit
  reeferTemp: number;
}

export interface Dock {
  idx: number;
  maintenance: boolean;
  truckId: string | null;
}

export type ForkliftStatus = 'idle' | 'unloading' | 'charging';

export interface Forklift {
  id: string;
  dock: number;
  status: ForkliftStatus;
  battery: number;
  cycle: number; // cumulative pallet cycles (fraction = progress within current move)
  moved: number;
}

export interface InventoryItem {
  sku: string;
  name: string;
  zone: Zone;
  qty: number;
  nominal: number;
  min: number;
}

export interface SiteState {
  id: string;
  name: string;
  code: string;
  city: string;
  capacity: number;
  docks: Dock[];
  trucks: Truck[];
  forklifts: Forklift[];
  inventory: InventoryItem[];
  delivered: number;
  onTime: number;
  temps: { frozen: number; chilled: number; frozenSet: number; chilledSet: number };
  startStock: number;
  palletsIn: number;
  palletsOut: number;
  stockHistory: number[];
  otdHistory: number[];
  spawnTimer: number;
  outboundAcc: number;
}

export type Selection =
  | { kind: 'site' }
  | { kind: 'truck'; id: string }
  | { kind: 'forklift'; id: string }
  | { kind: 'dock'; idx: number };

export interface Notice {
  id: number;
  at: number;
  siteId: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  text: string;
  read: boolean;
}

interface Store {
  sites: Record<string, SiteState>;
  siteOrder: string[];
  activeSiteId: string;
  selection: Selection;
  notices: Notice[];
  clock: number; // sim clock in real seconds since start
  histTimer: number;
  flashSku: string | null;
  setFlashSku: (sku: string | null) => void;
  setActiveSite: (id: string) => void;
  select: (sel: Selection) => void;
  markAllRead: () => void;
  tick: (dt: number) => void;
}

/* ------------------------------------------------------------------ helpers */

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];

let truckSeq = 418;
let shipSeq = 20431;
let noticeSeq = 1;

const ARRIVE_NOMINAL = 11;
const REVERSE_NOMINAL = 7.5;

export function stageIndex(phase: TruckPhase): number {
  switch (phase) {
    case 'confirmed':
      return 0;
    case 'picked':
      return 1;
    case 'loaded':
      return 2;
    case 'transit':
    case 'queued':
    case 'arriving':
    case 'reversing':
      return 3;
    case 'unloading':
      return 4;
    case 'departing':
      return 5;
  }
}

export const ON_MAP: TruckPhase[] = ['arriving', 'reversing', 'unloading', 'departing'];
export const isOnMap = (t: Truck) => ON_MAP.includes(t.phase);

/** Seconds (real) until the truck is docked; Infinity while queued; 0 once docked. */
export function etaSeconds(t: Truck): number {
  const d = t.dur;
  const rest = (phase: TruckPhase) => {
    switch (phase) {
      case 'confirmed':
        return d.picked + d.loaded + d.transit + d.arrive + d.reverse;
      case 'picked':
        return d.loaded + d.transit + d.arrive + d.reverse;
      case 'loaded':
        return d.transit + d.arrive + d.reverse;
      case 'transit':
        return d.arrive + d.reverse;
      case 'arriving':
        return d.reverse;
      default:
        return 0;
    }
  };
  switch (t.phase) {
    case 'queued':
      return Infinity;
    case 'unloading':
    case 'departing':
      return 0;
    default: {
      const cur = (d as Record<string, number>)[t.phase] ?? 0;
      return (1 - t.t) * cur + rest(t.phase);
    }
  }
}

export function formatSimMinutes(realSeconds: number) {
  const mins = (realSeconds * SIM_SCALE) / 60;
  if (!isFinite(mins)) return '—';
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${Math.floor(mins - h * 60)}m`;
}

export function phaseLabel(t: Truck): string {
  switch (t.phase) {
    case 'confirmed':
      return 'Order confirmed';
    case 'picked':
      return 'Picking at origin';
    case 'loaded':
      return 'Loaded, departing';
    case 'transit':
      return t.delayed ? 'In transit · traffic' : 'In transit';
    case 'queued':
      return 'Waiting for bay';
    case 'arriving':
      return 'Entering yard';
    case 'reversing':
      return 'Reversing to bay';
    case 'unloading':
      return 'Unloading';
    case 'departing':
      return 'Departing';
  }
}

export const stockTotal = (s: SiteState) => s.inventory.reduce((a, i) => a + i.qty, 0);

function plate() {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  return `${L[randInt(0, L.length - 1)]}${L[randInt(0, L.length - 1)]}${L[randInt(0, L.length - 1)]}-${randInt(100, 999)}`;
}

function chooseSku(site: SiteState) {
  // favour items that are furthest below their nominal level
  const weights = site.inventory.map((i) => Math.max(0.05, 1.25 - i.qty / i.nominal) ** 2);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return site.inventory[i];
  }
  return site.inventory[0];
}

function newTruck(site: SiteState, clock: number, now: number): Truck {
  const item = chooseSku(site);
  const dur = {
    confirmed: rand(6, 10),
    picked: rand(6, 10),
    loaded: rand(4, 7),
    transit: rand(16, 30),
    arrive: ARRIVE_NOMINAL,
    reverse: REVERSE_NOMINAL,
    depart: 12,
  };
  const planned = clock + dur.confirmed + dur.picked + dur.loaded + dur.transit + dur.arrive + dur.reverse + rand(1, 4);
  const delayed = Math.random() < 0.12;
  if (delayed) dur.transit += rand(8, 16);
  return {
    id: `TR-${truckSeq++}`,
    shipmentId: `SH-${shipSeq++}`,
    plate: plate(),
    carrier: pick(CARRIERS),
    origin: pick(ORIGINS),
    sku: item.sku,
    skuName: item.name,
    pallets: randInt(9, 16),
    palletsDone: 0,
    phase: 'confirmed',
    t: 0,
    dur,
    dock: null,
    stageAt: [now, null, null, null, null],
    plannedDockAt: planned,
    dockedAt: null,
    late: null,
    delayed,
    reeferTemp: item.zone === 'Frozen' ? rand(-22, -18) : rand(1, 4),
  };
}

function notify(state: Store, siteId: string, tone: Notice['tone'], text: string) {
  state.notices.unshift({ id: noticeSeq++, at: Date.now(), siteId, tone, text, read: false });
  if (state.notices.length > 40) state.notices.length = 40;
}

function freeDock(site: SiteState): Dock | undefined {
  const free = site.docks.filter((d) => !d.maintenance && !d.truckId);
  return free.length ? pick(free) : undefined;
}

function assignDock(site: SiteState, truck: Truck, dock: Dock) {
  dock.truckId = truck.id;
  truck.dock = dock.idx;
  const dx = dockX(dock.idx, site.docks.length);
  truck.dur.arrive = pathLength('arrive', dx) / SPEEDS.arrive;
  truck.dur.reverse = pathLength('reverse', dx) / SPEEDS.reverse;
  truck.dur.depart = pathLength('depart', dx) / SPEEDS.depart;
}

/* -------------------------------------------------------------- site seeding */

function seedSite(seed: (typeof SITES)[number]): SiteState {
  const now = Date.now();
  const stock = seed.capacity * seed.fill;
  const inventory: InventoryItem[] = SKUS.map((s) => {
    const nominal = Math.round(stock * s.share);
    return {
      sku: s.sku,
      name: s.name,
      zone: s.zone,
      nominal,
      min: Math.round(nominal * s.min),
      qty: Math.round(nominal * rand(0.72, 1.12)),
    };
  });
  // make sure the board shows something to act on
  const lowA = inventory[randInt(0, inventory.length - 1)];
  lowA.qty = Math.round(lowA.min * rand(0.7, 0.92));
  if (seed.id === 'rv') {
    const lowB = inventory.find((i) => i !== lowA)!;
    lowB.qty = Math.round(lowB.min * 0.85);
  }

  const docks: Dock[] = Array.from({ length: seed.docks }, (_, idx) => ({
    idx,
    maintenance: seed.maintenanceDocks.includes(idx),
    truckId: null,
  }));
  const forklifts: Forklift[] = docks.map((d, i) => ({
    id: `FL-${String(i + 1).padStart(2, '0')}`,
    dock: d.idx,
    status: 'idle',
    battery: Math.round(rand(26, 96)),
    cycle: 0,
    moved: randInt(40, 160),
  }));

  const site: SiteState = {
    id: seed.id,
    name: seed.name,
    code: seed.code,
    city: seed.city,
    capacity: seed.capacity,
    docks,
    trucks: [],
    forklifts,
    inventory,
    delivered: seed.delivered,
    onTime: seed.onTime,
    temps: { frozen: seed.temps.frozen, chilled: seed.temps.chilled, frozenSet: seed.temps.frozen, chilledSet: seed.temps.chilled },
    startStock: 0,
    palletsIn: randInt(300, 700),
    palletsOut: randInt(300, 700),
    stockHistory: [],
    otdHistory: [],
    spawnTimer: 2,
    outboundAcc: 0,
  };
  site.startStock = stockTotal(site);

  // trucks already on site
  for (const dock of docks) {
    if (dock.maintenance) continue;
    const r = Math.random();
    if (r < 0.15) continue;
    const t = newTruck(site, 0, now);
    t.stageAt = [now - 190e3, now - 150e3, now - 120e3, now - 85e3, null];
    assignDock(site, t, dock);
    t.plannedDockAt = 0;
    if (r < 0.72) {
      t.phase = 'unloading';
      t.palletsDone = randInt(0, t.pallets - 3);
      t.stageAt[4] = now - t.palletsDone * FORKLIFT_CYCLE * 1000;
      t.dockedAt = 0;
      t.late = false;
      const fl = forklifts.find((f) => f.dock === dock.idx)!;
      if (fl.battery < 30) fl.battery = 55;
      fl.status = 'unloading';
      fl.cycle = Math.random() * 0.6;
    } else if (r < 0.86) {
      t.phase = 'reversing';
      t.t = rand(0, 0.5);
    } else {
      t.phase = 'arriving';
      t.t = rand(0.2, 0.7);
    }
    site.trucks.push(t);
  }
  // pipeline of upcoming shipments
  const phases: TruckPhase[] = ['transit', 'transit', 'loaded', 'picked', 'confirmed'];
  for (const ph of phases) {
    const t = newTruck(site, 0, now);
    t.phase = ph;
    t.t = rand(0.05, 0.85);
    const si = stageIndex(ph);
    for (let i = 0; i <= si; i++) t.stageAt[i] = now - (si - i + t.t) * rand(7e3, 11e3);
    site.trucks.push(t);
  }
  const otd = (site.onTime / site.delivered) * 100;
  site.stockHistory = Array.from({ length: 30 }, (_, i) => site.startStock * (1 + Math.sin(i / 4) * 0.004 + rand(-0.003, 0.003)));
  site.otdHistory = Array.from({ length: 30 }, () => otd + rand(-0.8, 0.8));
  return site;
}

/* --------------------------------------------------------------- simulation */

function tickSite(state: Store, site: SiteState, dt: number) {
  const now = Date.now();
  const clock = state.clock;
  const activeDocks = site.docks.filter((d) => !d.maintenance).length;

  // spawn new shipments to keep the pipeline full
  site.spawnTimer -= dt;
  if (site.spawnTimer <= 0 && site.trucks.length < activeDocks + 3) {
    site.trucks.push(newTruck(site, clock, now));
    site.spawnTimer = rand(5, 10);
  }

  const removed: string[] = [];

  for (const t of site.trucks) {
    switch (t.phase) {
      case 'confirmed':
      case 'picked':
      case 'loaded': {
        t.t += dt / t.dur[t.phase];
        if (t.t >= 1) {
          t.t = 0;
          t.phase = t.phase === 'confirmed' ? 'picked' : t.phase === 'picked' ? 'loaded' : 'transit';
          t.stageAt[stageIndex(t.phase)] = now;
          if (t.phase === 'transit' && t.delayed) {
            notify(state, site.id, 'warning', `${t.id} delayed in traffic — ${t.carrier}`);
          }
        }
        break;
      }
      case 'transit': {
        t.t += dt / t.dur.transit;
        if (t.t >= 1) {
          t.t = 0;
          const dock = freeDock(site);
          if (dock) {
            assignDock(site, t, dock);
            t.phase = 'arriving';
            notify(state, site.id, 'info', `${t.id} entered the yard → Bay ${dock.idx + 1}`);
          } else {
            t.phase = 'queued';
            notify(state, site.id, 'warning', `${t.id} waiting at gate — all bays busy`);
          }
        }
        break;
      }
      case 'queued': {
        const dock = freeDock(site);
        if (dock) {
          assignDock(site, t, dock);
          t.phase = 'arriving';
          t.t = 0;
          notify(state, site.id, 'info', `${t.id} released from gate → Bay ${dock.idx + 1}`);
        }
        break;
      }
      case 'arriving': {
        t.t += dt / t.dur.arrive;
        if (t.t >= 1) {
          t.t = 0;
          t.phase = 'reversing';
        }
        break;
      }
      case 'reversing': {
        t.t += dt / t.dur.reverse;
        if (t.t >= 1) {
          t.t = 0;
          t.phase = 'unloading';
          t.stageAt[4] = now;
          t.dockedAt = clock;
          t.late = clock > t.plannedDockAt + 3;
          site.delivered += 1;
          if (!t.late) site.onTime += 1;
          notify(
            state,
            site.id,
            t.late ? 'warning' : 'success',
            `${t.id} docked at Bay ${(t.dock ?? 0) + 1}${t.late ? ` · late ${formatSimMinutes(clock - t.plannedDockAt)}` : ' · on time'}`,
          );
        }
        break;
      }
      case 'unloading': {
        const fl = site.forklifts.find((f) => f.dock === t.dock);
        if (!fl || fl.status === 'charging') break;
        fl.status = 'unloading';
        const before = Math.floor(fl.cycle);
        fl.cycle += dt / FORKLIFT_CYCLE;
        if (Math.floor(fl.cycle) > before) {
          t.palletsDone += 1;
          fl.moved += 1;
          fl.battery = Math.max(0, fl.battery - 0.6);
          site.palletsIn += 1;
          const item = site.inventory.find((i) => i.sku === t.sku);
          if (item) item.qty += 1;
          if (t.palletsDone >= t.pallets) {
            fl.cycle = Math.floor(fl.cycle);
            fl.status = 'idle';
            t.phase = 'departing';
            t.t = 0;
            notify(state, site.id, 'success', `${t.id} unloaded ${t.pallets} pallets of ${t.skuName}`);
          }
          if (fl.battery < 14) {
            fl.status = 'charging';
            notify(state, site.id, 'warning', `${fl.id} battery low — sent to charging`);
          }
        }
        break;
      }
      case 'departing': {
        t.t += dt / t.dur.depart;
        if (t.t > 0.4) {
          const dock = site.docks.find((d) => d.truckId === t.id);
          if (dock) dock.truckId = null;
        }
        if (t.t >= 1) removed.push(t.id);
        break;
      }
    }
  }
  if (removed.length) {
    site.trucks = site.trucks.filter((t) => !removed.includes(t.id));
    if (state.selection.kind === 'truck' && removed.includes(state.selection.id) && state.activeSiteId === site.id) {
      state.selection = { kind: 'site' };
    }
  }

  // forklift batteries
  for (const f of site.forklifts) {
    if (f.status === 'charging') {
      f.battery = Math.min(100, f.battery + 2.4 * dt);
      if (f.battery >= 98) {
        f.status = 'idle';
        notify(state, site.id, 'info', `${f.id} fully charged`);
      }
    } else if (f.status === 'idle') {
      f.battery = Math.min(100, f.battery + 0.05 * dt);
      // stay "unloading" if its bay still has a truck in progress
    }
  }

  // outbound picking drains stock
  site.outboundAcc += dt * activeDocks * 0.16;
  while (site.outboundAcc >= 1) {
    site.outboundAcc -= 1;
    const total = site.inventory.reduce((a, i) => a + i.nominal, 0);
    let r = Math.random() * total;
    for (const item of site.inventory) {
      r -= item.nominal;
      if (r <= 0) {
        if (item.qty > 0) {
          const wasOk = item.qty >= item.min;
          item.qty -= 1;
          site.palletsOut += 1;
          if (wasOk && item.qty < item.min) notify(state, site.id, 'danger', `Low stock: ${item.name} (${item.qty} plt)`);
        }
        break;
      }
    }
  }

  // temperatures: drift with door activity
  const doorsOpen = site.trucks.filter((t) => t.phase === 'unloading').length;
  const tm = site.temps;
  tm.frozen += (tm.frozenSet + doorsOpen * 0.18 - tm.frozen) * 0.08 * dt + rand(-0.04, 0.04);
  tm.chilled += (tm.chilledSet + doorsOpen * 0.09 - tm.chilled) * 0.08 * dt + rand(-0.03, 0.03);
}

/* --------------------------------------------------------------------- store */

export const useWT = create<Store>()(
  immer((set) => {
    const sites: Record<string, SiteState> = {};
    for (const s of SITES) sites[s.id] = seedSite(s);
    return {
      sites,
      siteOrder: SITES.map((s) => s.id),
      activeSiteId: SITES[0].id,
      selection: { kind: 'site' },
      notices: [
        { id: noticeSeq++, at: Date.now() - 4 * 60e3, siteId: 'nh', tone: 'info', text: 'Shift B started · 6 operators checked in', read: true },
        { id: noticeSeq++, at: Date.now() - 9 * 60e3, siteId: 'rv', tone: 'danger', text: 'Bay 4 leveler fault — maintenance ticket opened', read: false },
      ],
      clock: 0,
      histTimer: 0,
      flashSku: null,
      setFlashSku: (sku) =>
        set((s) => {
          s.flashSku = sku;
        }),
      setActiveSite: (id) =>
        set((s) => {
          s.activeSiteId = id;
          s.selection = { kind: 'site' };
        }),
      select: (sel) =>
        set((s) => {
          s.selection = sel;
        }),
      markAllRead: () =>
        set((s) => {
          s.notices.forEach((n) => (n.read = true));
        }),
      tick: (dt) =>
        set((s) => {
          s.clock += dt;
          for (const id of s.siteOrder) tickSite(s as Store, s.sites[id], dt);
          s.histTimer += dt;
          if (s.histTimer >= 2) {
            s.histTimer = 0;
            for (const id of s.siteOrder) {
              const site = s.sites[id];
              site.stockHistory.push(stockTotal(site));
              site.otdHistory.push((site.onTime / site.delivered) * 100);
              if (site.stockHistory.length > 40) site.stockHistory.shift();
              if (site.otdHistory.length > 40) site.otdHistory.shift();
            }
          }
        }),
    };
  }),
);

/** Non-reactive access for the render loop. */
export const getWT = () => useWT.getState();

export function useActiveSite() {
  return useWT((s) => s.sites[s.activeSiteId]);
}
