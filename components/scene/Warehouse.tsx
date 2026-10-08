'use client';

import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { C } from './palette';
import { BUILDING, DOCK_FACE_Z, PLATFORM, dockX } from '@/lib/layout';
import { useWT } from '@/lib/store';

const W = BUILDING.width;
const D = BUILDING.depth;
const H = BUILDING.height;
const CZ = (BUILDING.backZ + BUILDING.frontZ) / 2;
const FRONT = BUILDING.frontZ;

export type DockVisual = 'free' | 'docking' | 'unloading' | 'maintenance';

function AcUnit({ x, z }: { x: number; z: number }) {
  const fans = useRef<THREE.Group[]>([]);
  useFrame((_, dt) => fans.current.forEach((f, i) => f && (f.rotation.y += dt * (5 + i))));
  return (
    <group position={[x, H + 0.3, z]}>
      <mesh position={[0, 0.8, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.2, 1.6, 2.8]} />
        <meshStandardMaterial color={C.acUnit} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.25, 1.41]}>
        <boxGeometry args={[4.6, 0.5, 0.02]} />
        <meshStandardMaterial color={C.acFan} />
      </mesh>
      {[-1.3, 1.3].map((fx, i) => (
        <group key={fx} position={[fx, 1.62, 0]}>
          <mesh>
            <cylinderGeometry args={[1.0, 1.0, 0.06, 20]} />
            <meshStandardMaterial color="#5f6d80" />
          </mesh>
          <group ref={(g) => void (g && (fans.current[i] = g))} position={[0, 0.05, 0]}>
            {[0, 1, 2].map((b) => (
              <mesh key={b} rotation={[0, (b * Math.PI * 2) / 3, 0]}>
                <boxGeometry args={[1.7, 0.03, 0.26]} />
                <meshStandardMaterial color="#cfd8e3" />
              </mesh>
            ))}
          </group>
        </group>
      ))}
    </group>
  );
}

function DockBay({ x, state, selected }: { x: number; state: DockVisual; selected: boolean }) {
  const lamp = useRef<THREE.MeshStandardMaterial>(null);
  const lampColor = state === 'free' ? C.green : state === 'docking' ? C.amber : state === 'unloading' ? C.blue : C.red;
  useFrame(({ clock }) => {
    if (!lamp.current) return;
    const pulse = state === 'docking' || state === 'maintenance' ? 0.6 + Math.sin(clock.elapsedTime * 6) * 0.4 : 0.9;
    lamp.current.emissiveIntensity = pulse * 1.6;
  });
  const open = state === 'unloading';
  return (
    <group position={[x, 0, FRONT]}>
      {/* shelter frame */}
      <mesh position={[0, PLATFORM.height + 2.25, 0.35]} castShadow>
        <boxGeometry args={[4.4, 4.5, 0.7]} />
        <meshStandardMaterial color={selected ? C.blueDeep : C.shelter} roughness={0.8} />
      </mesh>
      {/* opening / door */}
      <mesh position={[0, PLATFORM.height + 1.95, 0.72]}>
        <boxGeometry args={[3.3, 3.9, 0.06]} />
        <meshStandardMaterial color={open ? C.doorOpen : C.door} roughness={0.7} />
      </mesh>
      {!open &&
        Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[0, PLATFORM.height + 0.35 + i * 0.55, 0.77]}>
            <boxGeometry args={[3.3, 0.05, 0.03]} />
            <meshStandardMaterial color="#b9c8de" />
          </mesh>
        ))}
      {/* status lamp */}
      <mesh position={[1.6, PLATFORM.height + 4.9, 0.4]}>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial ref={lamp} color={lampColor} emissive={lampColor} emissiveIntensity={1.5} />
      </mesh>
      {/* bay number plate */}
      <mesh position={[-1.2, PLATFORM.height + 4.9, 0.12]}>
        <boxGeometry args={[1.2, 0.7, 0.05]} />
        <meshStandardMaterial color={C.blue} />
      </mesh>
      {/* dock leveler lip + bumpers */}
      <mesh position={[0, PLATFORM.height + 0.02, PLATFORM.depth - 0.6]} receiveShadow>
        <boxGeometry args={[2.6, 0.06, 1.2]} />
        <meshStandardMaterial color={state === 'maintenance' ? '#f3c5c5' : '#aab7c7'} />
      </mesh>
      {[-1.6, 1.6].map((bx) => (
        <mesh key={bx} position={[bx, PLATFORM.height - 0.4, PLATFORM.depth + 0.12]} castShadow>
          <boxGeometry args={[0.45, 0.55, 0.25]} />
          <meshStandardMaterial color={C.navy} />
        </mesh>
      ))}
      {/* hazard stripe on platform edge */}
      <mesh position={[0, PLATFORM.height - 0.05, PLATFORM.depth + 0.01]}>
        <boxGeometry args={[3.2, 0.12, 0.02]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>
      {state === 'maintenance' && (
        <group position={[0, PLATFORM.height, PLATFORM.depth - 1.6]}>
          {[-1, 1].map((cx) => (
            <mesh key={cx} position={[cx, 0.4, 0]} castShadow>
              <coneGeometry args={[0.25, 0.8, 8]} />
              <meshStandardMaterial color="#fb923c" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function Warehouse({ docks, dockStates }: { docks: number; dockStates: DockVisual[] }) {
  const select = useWT((s) => s.select);
  const selection = useWT((s) => s.selection);
  const siteSelected = selection.kind === 'site';
  const [hover, setHover] = useState(false);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    select({ kind: 'site' });
  };

  const seams = Math.floor(W / 3);

  return (
    <group>
      <group
        onClick={onClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        {/* plinth */}
        <mesh position={[0, 0.5, CZ]} castShadow receiveShadow>
          <boxGeometry args={[W + 0.3, 1, D + 0.3]} />
          <meshStandardMaterial color="#d5dde8" />
        </mesh>
        {/* main insulated box */}
        <mesh position={[0, H / 2, CZ]} castShadow receiveShadow>
          <boxGeometry args={[W, H, D]} />
          <meshStandardMaterial color={hover ? '#ffffff' : C.wall} emissive={hover ? '#dbe7ff' : '#000000'} emissiveIntensity={hover ? 0.25 : 0} roughness={0.85} />
        </mesh>
        {/* panel seams front/back */}
        {Array.from({ length: seams - 1 }, (_, i) => {
          const x = -W / 2 + (i + 1) * 3;
          return (
            <group key={i}>
              <mesh position={[x, H / 2 + 1.5, FRONT + 0.01]}>
                <boxGeometry args={[0.06, H - 4, 0.02]} />
                <meshStandardMaterial color={C.seam} />
              </mesh>
              <mesh position={[x, H / 2, BUILDING.backZ - 0.01]}>
                <boxGeometry args={[0.06, H - 2, 0.02]} />
                <meshStandardMaterial color={C.seam} />
              </mesh>
            </group>
          );
        })}
        {/* side seams */}
        {Array.from({ length: Math.floor(D / 3) - 1 }, (_, i) => {
          const z = BUILDING.backZ + (i + 1) * 3;
          return [-1, 1].map((sx) => (
            <mesh key={`${i}${sx}`} position={[sx * (W / 2 + 0.01), H / 2, z]}>
              <boxGeometry args={[0.02, H - 2, 0.06]} />
              <meshStandardMaterial color={C.seam} />
            </mesh>
          ));
        })}
        {/* blue fascia band */}
        <mesh position={[0, H - 0.7, CZ]} castShadow>
          <boxGeometry args={[W + 0.12, 1.1, D + 0.12]} />
          <meshStandardMaterial color={C.blue} roughness={0.5} />
        </mesh>
        <mesh position={[0, H - 1.45, CZ]}>
          <boxGeometry args={[W + 0.1, 0.2, D + 0.1]} />
          <meshStandardMaterial color="#9dbbff" />
        </mesh>
        {/* roof + parapet */}
        <mesh position={[0, H + 0.05, CZ]} receiveShadow>
          <boxGeometry args={[W - 0.8, 0.1, D - 0.8]} />
          <meshStandardMaterial color={C.roof} roughness={1} />
        </mesh>
        {[
          [0, CZ - D / 2 + 0.2, W, 0.4],
          [0, CZ + D / 2 - 0.2, W, 0.4],
        ].map(([x, z, w, d], i) => (
          <mesh key={i} position={[x, H + 0.35, z]} castShadow>
            <boxGeometry args={[w, 0.7, d]} />
            <meshStandardMaterial color={C.parapet} />
          </mesh>
        ))}
        {[-1, 1].map((sx) => (
          <mesh key={sx} position={[sx * (W / 2 - 0.2), H + 0.35, CZ]} castShadow>
            <boxGeometry args={[0.4, 0.7, D]} />
            <meshStandardMaterial color={C.parapet} />
          </mesh>
        ))}
        {/* skylights */}
        {[-18, -6, 6, 18].map((x) => (
          <mesh key={x} position={[x, H + 0.18, CZ - 7]}>
            <boxGeometry args={[5, 0.18, 2.2]} />
            <meshStandardMaterial color="#c7d8f3" roughness={0.2} metalness={0.1} />
          </mesh>
        ))}
        {/* rooftop AC units */}
        {[
          [-19, CZ + 3],
          [-11, CZ + 3],
          [-3, CZ + 3],
          [9, CZ + 4],
          [17, CZ + 4],
          [12, CZ - 6.5],
        ].map(([x, z]) => (
          <AcUnit key={`${x}:${z}`} x={x} z={z} />
        ))}
        {/* duct run */}
        <mesh position={[-11, H + 0.6, CZ + 0.4]} castShadow>
          <boxGeometry args={[18, 0.6, 0.8]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>

        {/* office annex */}
        <group position={[W / 2 + 5, 0, FRONT - 6]}>
          <mesh position={[0, 3.2, 0]} castShadow receiveShadow>
            <boxGeometry args={[10, 6.4, 12]} />
            <meshStandardMaterial color={C.wall} />
          </mesh>
          {[1.8, 4.2].map((y) => (
            <mesh key={y} position={[0, y, 6.01]}>
              <boxGeometry args={[8.6, 1.1, 0.03]} />
              <meshStandardMaterial color={C.glass} roughness={0.25} metalness={0.2} />
            </mesh>
          ))}
          {[1.8, 4.2].map((y) => (
            <mesh key={`s${y}`} position={[5.01, y, 0]}>
              <boxGeometry args={[0.03, 1.1, 10.6]} />
              <meshStandardMaterial color={C.glass} roughness={0.25} metalness={0.2} />
            </mesh>
          ))}
          <mesh position={[0, 6.55, 0]} castShadow>
            <boxGeometry args={[10.3, 0.3, 12.3]} />
            <meshStandardMaterial color={C.blue} />
          </mesh>
          {/* entrance canopy */}
          <mesh position={[0, 2.8, 7]} castShadow>
            <boxGeometry args={[4, 0.15, 2]} />
            <meshStandardMaterial color={C.navy} />
          </mesh>
        </group>

        {/* refrigeration plant on west wall */}
        <group position={[-W / 2 - 1.6, 0, CZ - 4]}>
          {[-4, 0, 4].map((z) => (
            <group key={z} position={[0, 0, z]}>
              <mesh position={[0, 1.3, 0]} castShadow>
                <boxGeometry args={[2.2, 2.6, 3.2]} />
                <meshStandardMaterial color={C.acUnit} />
              </mesh>
              <mesh position={[-1.11, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.95, 0.95, 0.04, 18]} />
                <meshStandardMaterial color={C.acFan} />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* dock platform (not part of the building click target) */}
      <mesh position={[0, PLATFORM.height / 2, FRONT + PLATFORM.depth / 2]} castShadow receiveShadow>
        <boxGeometry args={[W, PLATFORM.height, PLATFORM.depth]} />
        <meshStandardMaterial color={C.concrete} roughness={0.95} />
      </mesh>
      {/* platform stairs */}
      <group position={[W / 2 + 0.9, 0, FRONT + PLATFORM.depth - 1.4]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[0, 0.16 + i * 0.32, -i * 0.35]} castShadow receiveShadow>
            <boxGeometry args={[1.8, 0.32, 1.4 - i * 0.1]} />
            <meshStandardMaterial color={C.concrete} />
          </mesh>
        ))}
      </group>
      {Array.from({ length: docks }, (_, i) => (
        <DockBay key={i} x={dockX(i, docks)} state={dockStates[i] ?? 'free'} selected={selection.kind === 'dock' && selection.idx === i} />
      ))}
      {/* forklift lanes painted on the platform */}
      {Array.from({ length: docks }, (_, i) => (
        <mesh key={i} position={[dockX(i, docks), PLATFORM.height + 0.01, FRONT + PLATFORM.depth / 2 - 0.3]}>
          <boxGeometry args={[2.4, 0.01, PLATFORM.depth - 1.8]} />
          <meshStandardMaterial color="#bfcad7" />
        </mesh>
      ))}
      {/* walkway line */}
      <mesh position={[0, PLATFORM.height + 0.012, DOCK_FACE_Z - 1.3]}>
        <boxGeometry args={[W - 1, 0.01, 0.12]} />
        <meshStandardMaterial color="#facc15" />
      </mesh>

      {siteSelected && <SelectionFrame w={W + 4} d={D + PLATFORM.depth + 4} z={CZ + PLATFORM.depth / 2} />}
    </group>
  );
}

function SelectionFrame({ w, d, z }: { w: number; d: number; z: number }) {
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: C.blue, transparent: true, opacity: 0.5 }), []);
  useFrame(({ clock }) => {
    mat.opacity = 0.4 + Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  const t = 0.45;
  const parts: [number, number, number, number][] = [
    [0, z - d / 2, w, t],
    [0, z + d / 2, w, t],
    [-w / 2, z, t, d],
    [w / 2, z, t, d],
  ];
  return (
    <group>
      {parts.map(([x, pz, sw, sd], i) => (
        <mesh key={i} position={[x, 0.09, pz]} material={mat}>
          <boxGeometry args={[sw, 0.04, sd]} />
        </mesh>
      ))}
    </group>
  );
}
