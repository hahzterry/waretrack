'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Boxes, Building2, Check, ChevronDown, Forklift, Package, Search, Truck, Warehouse } from 'lucide-react';
import { useWT, stockTotal } from '@/lib/store';
import { relTime, siteHealth, useSelectAndFocus } from './shared';

function useOutside(ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, close]);
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="live">
      <span className="live-dot" />
      <span className="live-tag">Live</span>
      <span className="live-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
      <span className="live-date">{now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
    </div>
  );
}

function SiteSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const sites = useWT((s) => s.sites);
  const order = useWT((s) => s.siteOrder);
  const activeId = useWT((s) => s.activeSiteId);
  const setActive = useWT((s) => s.setActiveSite);
  const active = sites[activeId];
  return (
    <div className="dropdown" ref={ref}>
      <button className="site-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="site-ico">
          <Warehouse size={16} />
        </span>
        <span className="site-txt">
          <b>{active.name}</b>
          <small>
            {active.code} · {order.length} sites
          </small>
        </span>
        <ChevronDown size={16} className={open ? 'rot' : ''} />
      </button>
      {open && (
        <div className="menu menu-sites">
          <div className="menu-title">Switch warehouse</div>
          {order.map((id) => {
            const s = sites[id];
            const h = siteHealth(s);
            const fill = stockTotal(s) / s.capacity;
            const busy = s.docks.filter((d) => d.truckId).length;
            return (
              <button
                key={id}
                className={`menu-site ${id === activeId ? 'is-active' : ''}`}
                onClick={() => {
                  setActive(id);
                  setOpen(false);
                }}
              >
                <span className={`dot tone-${h.tone}`} />
                <span className="menu-site-main">
                  <b>{s.name}</b>
                  <small>
                    {s.code} · {s.city}
                  </small>
                </span>
                <span className="menu-site-stats">
                  <small>
                    {busy}/{s.docks.length} bays
                  </small>
                  <small>{Math.round(fill * 100)}% full</small>
                </span>
                {id === activeId && <Check size={15} className="menu-check" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

type Hit = { key: string; icon: React.ReactNode; title: string; sub: string; run: () => void };

function SearchBox() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  useOutside(ref, () => setOpen(false));
  const site = useWT((s) => s.sites[s.activeSiteId]);
  const setFlash = useWT((s) => s.setFlashSku);
  const go = useSelectAndFocus();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        input.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  // rebuild hits only when the query or the entity lists change shape
  const truckKey = site.trucks.map((t) => t.id).join();
  const hits = useMemo<Hit[]>(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    const out: Hit[] = [];
    for (const t of site.trucks) {
      if ([t.id, t.plate, t.carrier, t.shipmentId, t.skuName].some((v) => v.toLowerCase().includes(term)))
        out.push({ key: t.id, icon: <Truck size={15} />, title: `${t.id} · ${t.plate}`, sub: `${t.carrier} · ${t.shipmentId}`, run: () => go({ kind: 'truck', id: t.id }) });
    }
    for (const f of site.forklifts) {
      if (f.id.toLowerCase().includes(term) || 'forklift'.includes(term))
        out.push({ key: f.id, icon: <Forklift size={15} />, title: f.id, sub: `Forklift · Bay ${f.dock + 1}`, run: () => go({ kind: 'forklift', id: f.id }) });
    }
    for (const d of site.docks) {
      const label = `bay ${d.idx + 1}`;
      if (label.includes(term) || `dock ${d.idx + 1}`.includes(term))
        out.push({ key: `bay${d.idx}`, icon: <Boxes size={15} />, title: `Bay ${d.idx + 1}`, sub: 'Dock door', run: () => go({ kind: 'dock', idx: d.idx }) });
    }
    for (const i of site.inventory) {
      if (i.name.toLowerCase().includes(term) || i.sku.toLowerCase().includes(term))
        out.push({
          key: i.sku,
          icon: <Package size={15} />,
          title: i.name,
          sub: `${i.sku} · ${i.zone}`,
          run: () => {
            go({ kind: 'site' }, false);
            setFlash(i.sku);
            setTimeout(() => setFlash(null), 2600);
          },
        });
    }
    return out.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, truckKey, site.id]);

  const choose = (h: Hit) => {
    h.run();
    setOpen(false);
    setQ('');
    input.current?.blur();
  };

  return (
    <div className="search" ref={ref}>
      <Search size={16} className="search-ico" />
      <input
        ref={input}
        value={q}
        placeholder="Search trucks, SKUs, bays…"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setCursor((c) => Math.min(hits.length - 1, c + 1));
          if (e.key === 'ArrowUp') setCursor((c) => Math.max(0, c - 1));
          if (e.key === 'Enter' && hits[cursor]) choose(hits[cursor]);
          if (e.key === 'Escape') {
            setOpen(false);
            input.current?.blur();
          }
        }}
      />
      <kbd>⌘K</kbd>
      {open && q.trim() && (
        <div className="menu menu-search">
          {hits.length === 0 && <div className="menu-empty">No matches in {site.code}</div>}
          {hits.map((h, i) => (
            <button key={h.key} className={`menu-hit ${i === cursor ? 'is-cursor' : ''}`} onMouseEnter={() => setCursor(i)} onClick={() => choose(h)}>
              <span className="hit-ico">{h.icon}</span>
              <span>
                <b>{h.title}</b>
                <small>{h.sub}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutside(ref, () => setOpen(false));
  const notices = useWT((s) => s.notices);
  const sites = useWT((s) => s.sites);
  const markAll = useWT((s) => s.markAllRead);
  const setActive = useWT((s) => s.setActiveSite);
  const unread = notices.filter((n) => !n.read).length;
  return (
    <div className="dropdown" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="badge-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="menu menu-notes">
          <div className="menu-head">
            <span>Notifications</span>
            <button onClick={markAll}>Mark all read</button>
          </div>
          <div className="notes-list">
            {notices.slice(0, 14).map((n) => (
              <button
                key={n.id}
                className={`note ${n.read ? '' : 'is-unread'}`}
                onClick={() => {
                  setActive(n.siteId);
                  setOpen(false);
                }}
              >
                <span className={`dot tone-${n.tone === 'success' ? 'green' : n.tone === 'warning' ? 'amber' : n.tone === 'danger' ? 'red' : 'blue'}`} />
                <span className="note-main">
                  <span>{n.text}</span>
                  <small>
                    {sites[n.siteId]?.code} · {relTime(n.at)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  return (
    <header className="card topbar">
      <div className="brand">
        <span className="brand-mark">
          <Building2 size={18} />
        </span>
        <span className="brand-name">
          Ware<b>Track</b>
        </span>
      </div>
      <SearchBox />
      <div className="topbar-spacer" />
      <SiteSwitcher />
      <LiveClock />
      <Notifications />
      <div className="user">
        <span className="avatar">MC</span>
        <span className="user-txt">
          <b>Maya Chen</b>
          <small>Ops Manager</small>
        </span>
      </div>
    </header>
  );
}
