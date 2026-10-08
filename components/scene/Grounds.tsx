'use client';

import { useMemo } from 'react';
import { C } from './palette';
import { BUILDING, DOCK_FACE_Z, FENCE, ROAD, dockX } from '@/lib/layout';

type V3 = [number, number, number];

function Slab({ pos, size, color, receive = true }: { pos: V3; size: V3; color: string; receive?: boolean }) {
  return (
    <mesh position={pos} receiveShadow={receive}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.95} />
    </mesh>
  );
}

/** Deterministic pseudo random so the layout is stable between renders. */
function prng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function Tree({ x, z, s, color }: { x: number; z: number; s: number; color: string }) {
  return (
    <group position={[x, 0, z]} scale={s}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.3, 1.8, 6]} />
        <meshStandardMaterial color={C.trunk} roughness={1} />
      </mesh>
      <mesh position={[0, 2.9, 0]} castShadow>
        <icosahedronGeometry args={[1.55, 0]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
      <mesh position={[0.35, 4.0, 0.15]} castShadow>
        <icosahedronGeometry args={[0.95, 0]} />
        <meshStandardMaterial color={color} roughness={0.9} flatShading />
      </mesh>
    </group>
  );
}

function FenceRun({ from, to }: { from: [number, number]; to: [number, number] }) {
  const [x1, z1] = from;
  const [x2, z2] = to;
  const len = Math.hypot(x2 - x1, z2 - z1);
  const n = Math.max(1, Math.round(len / 4));
  const angle = Math.atan2(x2 - x1, z2 - z1);
  const posts = Array.from({ length: n + 1 }, (_, i) => [x1 + ((x2 - x1) * i) / n, z1 + ((z2 - z1) * i) / n]);
  return (
    <group>
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.9, z]} castShadow>
          <boxGeometry args={[0.16, 1.8, 0.16]} />
          <meshStandardMaterial color={C.fence} />
        </mesh>
      ))}
      {[0.6, 1.6].map((y) => (
        <mesh key={y} position={[(x1 + x2) / 2, y, (z1 + z2) / 2]} rotation={[0, angle, 0]} castShadow>
          <boxGeometry args={[0.06, 0.08, len]} />
          <meshStandardMaterial color={C.fence} />
        </mesh>
      ))}
      {/* mesh panel */}
      <mesh position={[(x1 + x2) / 2, 1.1, (z1 + z2) / 2]} rotation={[0, angle, 0]}>
        <boxGeometry args={[0.02, 1.0, len]} />
        <meshStandardMaterial color={C.fence} transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function Car({ x, z, rot, color }: { x: number; z: number; rot: number; color: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.8, 0.7, 4.2]} />
        <meshStandardMaterial color={color} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.15, -0.2]} castShadow>
        <boxGeometry args={[1.6, 0.6, 2.2]} />
        <meshStandardMaterial color={C.glass} roughness={0.3} />
      </mesh>
    </group>
  );
}

function LampPost({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.12, 6, 6]} />
        <meshStandardMaterial color={C.metal} />
      </mesh>
      <mesh position={[0, 6.05, 0.5]}>
        <boxGeometry args={[0.4, 0.15, 1.2]} />
        <meshStandardMaterial color={C.navy} />
      </mesh>
    </group>
  );
}

export function Grounds({ docks }: { docks: number }) {
  const trees = useMemo(() => {
    const r = prng(7);
    const out: { x: number; z: number; s: number; color: string }[] = [];
    // ring around the fence
    const push = (x: number, z: number) => out.push({ x, z, s: 0.85 + r() * 0.6, color: C.leaf[Math.floor(r() * C.leaf.length)] });
    for (let x = -78; x <= 78; x += 7 + r() * 4) push(x, FENCE.minZ - 5 - r() * 6);
    for (let z = -36; z <= 40; z += 7 + r() * 4) {
      push(FENCE.minX - 5 - r() * 7, z);
      push(FENCE.maxX + 5 + r() * 7, z);
    }
    for (let x = -100; x <= 100; x += 9 + r() * 8) {
      if (Math.abs(x) < 6) continue;
      push(x, ROAD.z + 9 + r() * 5);
    }
    // a few on the inner lawn strips
    push(-56, 40);
    push(56, 40);
    push(52, -30);
    push(-56, -30);
    return out;
  }, []);

  const yardW = FENCE.maxX - FENCE.minX - 4;
  const yardDepth = FENCE.maxZ - DOCK_FACE_Z - 2;

  return (
    <group>
      {/* base ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[700, 700]} />
        <meshStandardMaterial color={C.ground} roughness={1} />
      </mesh>
      {/* site pad (lawn tone) */}
      <Slab pos={[0, 0.01, (FENCE.minZ + FENCE.maxZ) / 2]} size={[FENCE.maxX - FENCE.minX, 0.02, FENCE.maxZ - FENCE.minZ]} color={C.grass} />
      {/* building apron + yard asphalt */}
      <Slab pos={[0, 0.03, DOCK_FACE_Z + yardDepth / 2]} size={[yardW, 0.04, yardDepth]} color={C.asphalt} />
      {/* perimeter service lane */}
      <Slab pos={[0, 0.025, BUILDING.backZ - 4]} size={[yardW, 0.03, 6]} color={C.asphalt} />
      <Slab pos={[-BUILDING.width / 2 - 4, 0.025, (BUILDING.backZ + DOCK_FACE_Z) / 2 - 2]} size={[6, 0.03, BUILDING.depth + 10]} color={C.asphalt} />
      {/* gate apron */}
      <Slab pos={[(FENCE.gateMinX + FENCE.gateMaxX) / 2, 0.03, FENCE.maxZ + 1.5]} size={[FENCE.gateMaxX - FENCE.gateMinX, 0.04, 3.2]} color={C.asphalt} />
      {/* public road */}
      <Slab pos={[0, 0.02, ROAD.z]} size={[ROAD.maxX - ROAD.minX + 80, 0.04, ROAD.width]} color={C.road} />
      {Array.from({ length: 46 }, (_, i) => (
        <mesh key={i} position={[-180 + i * 8, 0.05, ROAD.z]} receiveShadow>
          <boxGeometry args={[4, 0.02, 0.22]} />
          <meshStandardMaterial color={C.line} />
        </mesh>
      ))}
      {/* curbs */}
      {[ROAD.z - ROAD.width / 2, ROAD.z + ROAD.width / 2].map((z) => (
        <mesh key={z} position={[0, 0.08, z]} receiveShadow>
          <boxGeometry args={[ROAD.maxX - ROAD.minX + 80, 0.16, 0.35]} />
          <meshStandardMaterial color="#e5ebf2" />
        </mesh>
      ))}
      {/* bay guide lines */}
      {Array.from({ length: docks + 1 }, (_, i) => {
        const x = dockX(i, docks) - 4.25;
        return (
          <mesh key={i} position={[x, 0.06, DOCK_FACE_Z + 9]} receiveShadow>
            <boxGeometry args={[0.18, 0.02, 18]} />
            <meshStandardMaterial color={C.line} />
          </mesh>
        );
      })}
      {/* yellow stop bars */}
      {Array.from({ length: docks }, (_, i) => (
        <mesh key={i} position={[dockX(i, docks), 0.06, DOCK_FACE_Z + 18.6]}>
          <boxGeometry args={[3.4, 0.02, 0.3]} />
          <meshStandardMaterial color="#facc15" />
        </mesh>
      ))}
      {/* staff parking lines + cars */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[-BUILDING.width / 2 - 16.5, 0.06, -14 + i * 3.2]}>
          <boxGeometry args={[5, 0.02, 0.12]} />
          <meshStandardMaterial color={C.line} />
        </mesh>
      ))}
      <Slab pos={[-BUILDING.width / 2 - 16.5, 0.03, -4.4]} size={[7, 0.04, 22]} color={C.asphalt} />
      {[
        [-14 + 1.6, '#ffffff'],
        [-14 + 4.8, '#9fb7e8'],
        [-14 + 11.2, '#e7ecf3'],
        [-14 + 14.4, '#3b5b9a'],
        [-14 + 17.6, '#ffffff'],
      ].map(([z, c], i) => (
        <Car key={i} x={-BUILDING.width / 2 - 16.5} z={z as number} rot={Math.PI / 2} color={c as string} />
      ))}

      {/* fence */}
      <FenceRun from={[FENCE.minX, FENCE.minZ]} to={[FENCE.maxX, FENCE.minZ]} />
      <FenceRun from={[FENCE.minX, FENCE.minZ]} to={[FENCE.minX, FENCE.maxZ]} />
      <FenceRun from={[FENCE.maxX, FENCE.minZ]} to={[FENCE.maxX, FENCE.maxZ]} />
      <FenceRun from={[FENCE.minX, FENCE.maxZ]} to={[FENCE.gateMinX, FENCE.maxZ]} />
      <FenceRun from={[FENCE.gateMaxX, FENCE.maxZ]} to={[FENCE.maxX, FENCE.maxZ]} />

      {/* gate booth */}
      <group position={[FENCE.gateMinX - 4, 0, FENCE.maxZ - 3]}>
        <mesh position={[0, 1.4, 0]} castShadow receiveShadow>
          <boxGeometry args={[3, 2.8, 2.6]} />
          <meshStandardMaterial color={C.wall} />
        </mesh>
        <mesh position={[0, 1.7, 1.31]}>
          <boxGeometry args={[2.4, 1, 0.02]} />
          <meshStandardMaterial color={C.glass} />
        </mesh>
        <mesh position={[0, 2.95, 0]} castShadow>
          <boxGeometry args={[3.6, 0.3, 3.2]} />
          <meshStandardMaterial color={C.blue} />
        </mesh>
      </group>
      {/* boom barrier */}
      <group position={[FENCE.gateMinX + 0.5, 0, FENCE.maxZ]}>
        <mesh position={[0, 0.6, 0]} castShadow>
          <boxGeometry args={[0.5, 1.2, 0.5]} />
          <meshStandardMaterial color={C.navy} />
        </mesh>
        <mesh position={[0.4, 1.1, 0]} rotation={[0, 0, 1.25]} castShadow>
          <boxGeometry args={[0.14, 7, 0.14]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
      </group>

      {/* lamp posts */}
      {[
        [-58, 18],
        [-58, 34],
        [58, 18],
        [58, 34],
        [52, 43],
      ].map(([x, z]) => (
        <LampPost key={`${x}:${z}`} x={x} z={z} />
      ))}

      {trees.map((t, i) => (
        <Tree key={i} {...t} />
      ))}
    </group>
  );
}
