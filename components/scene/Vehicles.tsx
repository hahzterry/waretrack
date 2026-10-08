'use client';

import { useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { C } from './palette';
import { DOCKED_Z, FORKLIFT_LANE, PLATFORM, TRUCK, dockX, truckPose } from '@/lib/layout';
import { getWT, isOnMap, phaseLabel, useWT, type Truck as TruckT } from '@/lib/store';

const L = TRUCK.length;

/* ------------------------------------------------------------------ helpers */

function hoverHandlers(set: (v: boolean) => void) {
  return {
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      set(true);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: () => {
      set(false);
      document.body.style.cursor = '';
    },
  };
}

function SelectRing({ radius, color = C.blue }: { radius: number; color?: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.06;
    ref.current.scale.set(s, s, s);
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
      <ringGeometry args={[radius, radius + 0.45, 40]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} />
    </mesh>
  );
}

/** Pose of a truck in world space computed from simulation state. */
export function poseForTruck(t: TruckT, docks: number, tOverride?: number) {
  const dx = dockX(t.dock ?? 0, docks);
  const tt = tOverride ?? t.t;
  switch (t.phase) {
    case 'arriving':
      return truckPose('arrive', dx, tt);
    case 'reversing':
      return truckPose('reverse', dx, tt);
    case 'departing':
      return truckPose('depart', dx, tt);
    default:
      return { x: dx, z: DOCKED_Z, heading: 0 };
  }
}

/* -------------------------------------------------------------------- truck */

function Wheel({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, 0.5, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.5, 0.5, 0.45, 12]} />
      <meshStandardMaterial color={C.tire} roughness={0.9} />
    </mesh>
  );
}

function TruckModel({ highlight, reversing, carrierColor }: { highlight: boolean; reversing: boolean; carrierColor: string }) {
  const rear = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (!rear.current) return;
    rear.current.emissiveIntensity = reversing ? (Math.sin(clock.elapsedTime * 10) > 0 ? 2.4 : 0.2) : 0.5;
  });
  const trailerZ0 = -L / 2;
  const trailerC = trailerZ0 + TRUCK.trailer / 2;
  const cabC = L / 2 - TRUCK.cab / 2;
  const wx = TRUCK.width / 2 - 0.15;
  return (
    <group>
      {/* trailer box */}
      <mesh position={[0, 2.75, trailerC]} castShadow receiveShadow>
        <boxGeometry args={[TRUCK.width, 2.9, TRUCK.trailer]} />
        <meshStandardMaterial color={C.trailer} emissive={highlight ? '#c7d9ff' : '#000'} emissiveIntensity={highlight ? 0.35 : 0} roughness={0.6} />
      </mesh>
      {/* stripe */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (TRUCK.width / 2 + 0.01), 2.1, trailerC]}>
          <boxGeometry args={[0.02, 0.35, TRUCK.trailer - 0.6]} />
          <meshStandardMaterial color={carrierColor} />
        </mesh>
      ))}
      {/* roof logo block */}
      <mesh position={[0, 4.22, trailerC + 1]}>
        <boxGeometry args={[1.6, 0.02, 6]} />
        <meshStandardMaterial color={carrierColor} />
      </mesh>
      {/* chassis */}
      <mesh position={[0, 0.95, 0]} castShadow>
        <boxGeometry args={[TRUCK.width - 0.5, 0.35, L - 0.4]} />
        <meshStandardMaterial color="#3a4556" />
      </mesh>
      {/* reefer unit */}
      <mesh position={[0, 3.0, trailerZ0 + TRUCK.trailer + 0.12]} castShadow>
        <boxGeometry args={[2.0, 1.7, 0.45]} />
        <meshStandardMaterial color="#d6dde7" />
      </mesh>
      {/* rear doors + lights */}
      <mesh position={[0, 2.75, trailerZ0 - 0.01]}>
        <boxGeometry args={[TRUCK.width - 0.2, 2.7, 0.02]} />
        <meshStandardMaterial color="#e8eef6" />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.05, 1.35, trailerZ0 - 0.03]}>
          <boxGeometry args={[0.35, 0.18, 0.04]} />
          <meshStandardMaterial ref={s === 1 ? rear : undefined} color="#ff5a5a" emissive="#ff3b3b" emissiveIntensity={0.5} />
        </mesh>
      ))}
      {/* cab */}
      <group position={[0, 0, cabC]}>
        <mesh position={[0, 2.05, -0.1]} castShadow>
          <boxGeometry args={[TRUCK.width, 2.5, TRUCK.cab - 0.2]} />
          <meshStandardMaterial color={C.cab} emissive={highlight ? '#3b82f6' : '#000'} emissiveIntensity={highlight ? 0.25 : 0} roughness={0.45} />
        </mesh>
        <mesh position={[0, 3.6, -0.5]} castShadow>
          <boxGeometry args={[TRUCK.width - 0.1, 0.65, 2.0]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
        <mesh position={[0, 2.55, TRUCK.cab / 2 - 0.19]}>
          <boxGeometry args={[TRUCK.width - 0.3, 1.0, 0.04]} />
          <meshStandardMaterial color={C.glass} roughness={0.2} metalness={0.3} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * (TRUCK.width / 2 + 0.01), 2.6, 0.5]}>
            <boxGeometry args={[0.02, 0.8, 1.0]} />
            <meshStandardMaterial color={C.glass} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`h${s}`} position={[s * 0.95, 1.2, TRUCK.cab / 2 - 0.17]}>
            <boxGeometry args={[0.38, 0.22, 0.04]} />
            <meshStandardMaterial color="#fff7d6" emissive="#fff3c4" emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {/* wheels */}
      {[L / 2 - 1.1, L / 2 - 3.2, L / 2 - 4.4, -L / 2 + 1.2, -L / 2 + 2.5].map((z) =>
        [-1, 1].map((s) => <Wheel key={`${z}${s}`} x={s * wx} z={z} />),
      )}
    </group>
  );
}

const CARRIER_COLORS: Record<string, string> = {
  'Polar Freight': '#2f6bff',
  'ColdLine Logistics': '#0ea5e9',
  'Nordic Reefer': '#6366f1',
  FrostWay: '#14b8a6',
  'BlueChain Transport': '#1d4ed8',
  'Arctic Express': '#38bdf8',
};

function TruckActor({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const smooth = useRef<{ phase: string; t: number } | null>(null);
  const [hover, setHover] = useState(false);
  const selected = useWT((s) => s.selection.kind === 'truck' && s.selection.id === id);
  const info = useWT((s) => {
    const t = s.sites[s.activeSiteId].trucks.find((x) => x.id === id);
    return t ? `${t.phase}|${t.carrier}|${t.palletsDone}/${t.pallets}|${t.dock}` : '';
  });
  const [phase, carrier, progress, dock] = info.split('|');
  const select = useWT((s) => s.select);

  useFrame((_, dt) => {
    const st = getWT();
    const site = st.sites[st.activeSiteId];
    const t = site.trucks.find((x) => x.id === id);
    if (!t || !group.current) return;
    // smooth the 10 Hz simulation progress for 60 fps motion
    if (!smooth.current || smooth.current.phase !== t.phase) smooth.current = { phase: t.phase, t: t.t };
    else smooth.current.t += (t.t - smooth.current.t) * Math.min(1, dt * 9);
    const pose = poseForTruck(t, site.docks.length, smooth.current.t);
    const g = group.current;
    g.position.set(pose.x, 0, pose.z);
    // smooth heading (shortest arc)
    let d = pose.heading - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * Math.min(1, dt * 10);
  });

  // place freshly mounted trucks immediately at their pose
  const initial = (() => {
    const st = getWT();
    const site = st.sites[st.activeSiteId];
    const t = site.trucks.find((x) => x.id === id);
    return t ? poseForTruck(t, site.docks.length) : { x: -200, z: 54, heading: Math.PI / 2 };
  })();

  return (
    <group ref={group} position={[initial.x, 0, initial.z]} rotation={[0, initial.heading, 0]}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: 'truck', id });
        }}
        {...hoverHandlers(setHover)}
      >
        <TruckModel highlight={hover || selected} reversing={phase === 'reversing'} carrierColor={CARRIER_COLORS[carrier] ?? C.blue} />
        {/* generous invisible hit box */}
        <mesh position={[0, 2.2, 0]} visible={false}>
          <boxGeometry args={[TRUCK.width + 1, 4.4, L + 0.5]} />
          <meshBasicMaterial />
        </mesh>
      </group>
      {selected && (
        <group scale={[1, 1, (L + 3) / 6]}>
          <SelectRing radius={2.7} />
        </group>
      )}
      {(selected || hover) && (
        <Html position={[0, 6.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="map-label">
            <b>{id}</b>
            <span>
              {phaseLabel({ phase } as TruckT)}
              {phase === 'unloading' ? ` · ${progress}` : ''}
              {dock !== 'null' && dock !== '' ? ` · Bay ${Number(dock) + 1}` : ''}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Trucks() {
  const ids = useWT((s) =>
    s.sites[s.activeSiteId].trucks
      .filter(isOnMap)
      .map((t) => t.id)
      .join(','),
  );
  const siteId = useWT((s) => s.activeSiteId);
  return (
    <group>
      {ids
        .split(',')
        .filter(Boolean)
        .map((id) => (
          <TruckActor key={`${siteId}:${id}`} id={id} />
        ))}
    </group>
  );
}

/* ----------------------------------------------------------------- forklift */

function PalletLoad() {
  return (
    <group>
      <mesh position={[0, 0.08, 0]} castShadow>
        <boxGeometry args={[1.2, 0.16, 1.2]} />
        <meshStandardMaterial color={C.pallet} roughness={1} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.12, 0.92, 1.12]} />
        <meshStandardMaterial color={C.cargo} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.62, 0.565]}>
        <boxGeometry args={[0.6, 0.3, 0.01]} />
        <meshStandardMaterial color={C.cargoAlt} />
      </mesh>
    </group>
  );
}

/**
 * Work cycle (u in 0..1): 0–.38 drive out to the trailer, .38–.5 pick,
 * .5–.92 reverse into the building with the pallet, .92–1 drop inside.
 */
function forkliftCycle(u: number) {
  const { insideZ, pickZ } = FORKLIFT_LANE;
  const ease = (x: number) => x * x * (3 - 2 * x);
  if (u < 0.38) return { z: insideZ + (pickZ - insideZ) * ease(u / 0.38), lift: 0.15, carrying: false };
  if (u < 0.5) {
    const k = (u - 0.38) / 0.12;
    return { z: pickZ, lift: 0.15 + 0.35 * k, carrying: k > 0.4 };
  }
  if (u < 0.92) return { z: pickZ + (insideZ - pickZ) * ease((u - 0.5) / 0.42), lift: 0.5, carrying: true };
  return { z: insideZ, lift: 0.15, carrying: false };
}

function ForkliftActor({ id }: { id: string }) {
  const group = useRef<THREE.Group>(null);
  const forks = useRef<THREE.Group>(null);
  const load = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.MeshStandardMaterial>(null);
  const smoothCycle = useRef<number | null>(null);
  const [hover, setHover] = useState(false);
  const selected = useWT((s) => s.selection.kind === 'forklift' && s.selection.id === id);
  const status = useWT((s) => s.sites[s.activeSiteId].forklifts.find((f) => f.id === id)?.status ?? 'idle');
  const battery = useWT((s) => Math.round(s.sites[s.activeSiteId].forklifts.find((f) => f.id === id)?.battery ?? 0));
  const select = useWT((s) => s.select);

  useFrame(({ clock }, dt) => {
    const st = getWT();
    const site = st.sites[st.activeSiteId];
    const f = site.forklifts.find((x) => x.id === id);
    if (!f || !group.current) return;
    const dx = dockX(f.dock, site.docks.length);
    const truck = site.trucks.find((t) => t.dock === f.dock && t.phase === 'unloading');
    if (smoothCycle.current === null || Math.abs(f.cycle - smoothCycle.current) > 1.5) smoothCycle.current = f.cycle;
    smoothCycle.current += (f.cycle - smoothCycle.current) * Math.min(1, dt * 10);

    let tx = dx + 2.3;
    let tz = FORKLIFT_LANE.idleZ;
    let lift = 0.15;
    let carrying = false;
    if (truck && f.status === 'unloading') {
      const c = forkliftCycle(smoothCycle.current - Math.floor(smoothCycle.current));
      tx = dx;
      tz = c.z;
      lift = c.lift;
      carrying = c.carrying;
    }
    const g = group.current;
    const k = Math.min(1, dt * 8);
    g.position.x += (tx - g.position.x) * k;
    g.position.z += (tz - g.position.z) * k;
    g.position.y = PLATFORM.height;
    if (forks.current) forks.current.position.y += (lift - forks.current.position.y) * Math.min(1, dt * 12);
    if (load.current) load.current.visible = carrying;
    if (beacon.current) {
      const on = f.status === 'charging' ? 0.6 + Math.sin(clock.elapsedTime * 3) * 0.4 : f.status === 'unloading' ? (Math.sin(clock.elapsedTime * 8) > 0 ? 1.8 : 0.3) : 0.4;
      beacon.current.emissiveIntensity = on;
      beacon.current.emissive.set(f.status === 'charging' ? C.green : C.amber);
      beacon.current.color.set(f.status === 'charging' ? C.green : C.amber);
    }
  });

  const initial = (() => {
    const st = getWT();
    const site = st.sites[st.activeSiteId];
    const f = site.forklifts.find((x) => x.id === id);
    return f ? dockX(f.dock, site.docks.length) + 2.3 : 0;
  })();

  return (
    <group ref={group} position={[initial, PLATFORM.height, FORKLIFT_LANE.idleZ]} scale={1.25}>
      <group
        onClick={(e) => {
          e.stopPropagation();
          select({ kind: 'forklift', id });
        }}
        {...hoverHandlers(setHover)}
      >
        {/* body */}
        <mesh position={[0, 0.55, -0.15]} castShadow>
          <boxGeometry args={[1.1, 0.7, 1.5]} />
          <meshStandardMaterial color={C.forklift} emissive={hover || selected ? '#fde68a' : '#000'} emissiveIntensity={hover || selected ? 0.4 : 0} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.6, -0.95]} castShadow>
          <boxGeometry args={[1.12, 0.8, 0.4]} />
          <meshStandardMaterial color={C.forkliftDark} />
        </mesh>
        {/* seat */}
        <mesh position={[0, 1.05, -0.35]}>
          <boxGeometry args={[0.5, 0.3, 0.45]} />
          <meshStandardMaterial color={C.navy} />
        </mesh>
        {/* overhead guard */}
        {[
          [-0.48, -0.75],
          [0.48, -0.75],
          [-0.48, 0.35],
          [0.48, 0.35],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 1.45, z]} castShadow>
            <boxGeometry args={[0.07, 1.3, 0.07]} />
            <meshStandardMaterial color={C.navy} />
          </mesh>
        ))}
        <mesh position={[0, 2.1, -0.2]} castShadow>
          <boxGeometry args={[1.05, 0.06, 1.25]} />
          <meshStandardMaterial color={C.navy} />
        </mesh>
        <mesh position={[0, 2.22, -0.7]}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshStandardMaterial ref={beacon} color={C.amber} emissive={C.amber} emissiveIntensity={0.5} />
        </mesh>
        {/* mast */}
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 1.15, 0.68]} castShadow>
            <boxGeometry args={[0.1, 2.2, 0.12]} />
            <meshStandardMaterial color="#4b5563" />
          </mesh>
        ))}
        {/* forks + load */}
        <group ref={forks} position={[0, 0.15, 0]}>
          {[-0.28, 0.28].map((x) => (
            <mesh key={x} position={[x, 0, 1.3]} castShadow>
              <boxGeometry args={[0.12, 0.06, 1.2]} />
              <meshStandardMaterial color="#374151" />
            </mesh>
          ))}
          <group ref={load} position={[0, 0.03, 1.35]} scale={0.8} visible={false}>
            <PalletLoad />
          </group>
        </group>
        {/* wheels */}
        {[
          [-0.55, 0.35],
          [0.55, 0.35],
          [-0.55, -0.85],
          [0.55, -0.85],
        ].map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x, 0.25, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.25, 0.25, 0.2, 10]} />
            <meshStandardMaterial color={C.tire} />
          </mesh>
        ))}
        <mesh position={[0, 0.9, 0]} visible={false}>
          <boxGeometry args={[2, 2.4, 3.4]} />
          <meshBasicMaterial />
        </mesh>
      </group>
      {selected && <SelectRing radius={1.5} color="#f59e0b" />}
      {(selected || hover) && (
        <Html position={[0, 3.2, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="map-label">
            <b>{id}</b>
            <span>
              {status === 'unloading' ? 'Moving pallets' : status === 'charging' ? 'Charging' : 'Idle'} · {battery}%
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}

export function Forklifts() {
  const ids = useWT((s) =>
    s.sites[s.activeSiteId].forklifts
      .map((f) => f.id)
      .join(','),
  );
  const siteId = useWT((s) => s.activeSiteId);
  return (
    <group>
      {ids
        .split(',')
        .filter(Boolean)
        .map((id) => (
          <ForkliftActor key={`${siteId}:${id}`} id={id} />
        ))}
    </group>
  );
}
