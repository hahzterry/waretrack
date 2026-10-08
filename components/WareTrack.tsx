'use client';

import { useEffect } from 'react';
import { Locate, Minus, Plus, RotateCcw, RotateCw } from 'lucide-react';
import Scene from './scene/Scene';
import { TopBar } from './ui/TopBar';
import { KpiCards } from './ui/KpiCards';
import { SitePanel } from './ui/SitePanel';
import { ShipmentTimeline } from './ui/ShipmentTimeline';
import { OpsTabs } from './ui/OpsTabs';
import { cameraApi } from '@/lib/camera';
import { useWT } from '@/lib/store';

const TICK_MS = 100;

function useSimulation() {
  const tick = useWT((s) => s.tick);
  useEffect(() => {
    let last = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      // clamp so a backgrounded tab doesn't fast-forward the yard
      const dt = Math.min(0.5, (now - last) / 1000);
      last = now;
      tick(dt);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);
}

function MapControls() {
  return (
    <div className="card map-ctrl" aria-label="Camera controls">
      <button onClick={() => cameraApi.zoomIn()} title="Zoom in" aria-label="Zoom in">
        <Plus size={17} />
      </button>
      <button onClick={() => cameraApi.zoomOut()} title="Zoom out" aria-label="Zoom out">
        <Minus size={17} />
      </button>
      <span className="map-ctrl-sep" />
      <button onClick={() => cameraApi.rotate(-1)} title="Rotate left" aria-label="Rotate left">
        <RotateCcw size={16} />
      </button>
      <button onClick={() => cameraApi.rotate(1)} title="Rotate right" aria-label="Rotate right">
        <RotateCw size={16} />
      </button>
      <span className="map-ctrl-sep" />
      <button onClick={() => cameraApi.reset()} title="Reset view" aria-label="Reset view">
        <Locate size={16} />
      </button>
    </div>
  );
}

function Legend() {
  return (
    <div className="legend">
      <span>
        <i className="pip pip-free" /> Free
      </span>
      <span>
        <i className="pip pip-amber" /> Docking
      </span>
      <span>
        <i className="pip pip-blue" /> Unloading
      </span>
      <span>
        <i className="pip pip-red" /> Maintenance
      </span>
    </div>
  );
}

export default function WareTrack() {
  useSimulation();
  return (
    <main className="app">
      <div className="viewport">
        <Scene />
      </div>
      <div className="hud">
        <TopBar />
        <KpiCards />
        <MapControls />
        <Legend />
        <SitePanel />
        <div className="bottom">
          <ShipmentTimeline />
          <OpsTabs />
        </div>
      </div>
    </main>
  );
}
