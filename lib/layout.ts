import * as THREE from 'three';

/**
 * World layout shared by the simulation and the 3D scene.
 * Units are roughly metres. +x = east, +z = towards the road (camera side).
 */
export const BUILDING = {
  width: 60,
  depth: 28,
  height: 11,
  backZ: -22,
  frontZ: 6,
};

export const PLATFORM = { depth: 5, height: 1.3 }; // dock platform from z=6 to z=11
export const DOCK_FACE_Z = BUILDING.frontZ + PLATFORM.depth;
export const DOCK_SPACING = 8.5;

export const TRUCK = { length: 16.5, trailer: 12.4, cab: 3.4, width: 2.6 };
export const DOCKED_Z = DOCK_FACE_Z + TRUCK.length / 2 + 0.15;
export const REVERSE_START_Z = 39;

export const FENCE = { minX: -62, maxX: 62, minZ: -34, maxZ: 46, gateMinX: -48, gateMaxX: 42 };
export const ROAD = { z: 52, width: 9, laneIn: 54, laneOut: 50, minX: -140, maxX: 140 };

export const SPEEDS = { arrive: 13, reverse: 2.6, depart: 11 };

export function dockX(index: number, count: number) {
  return (index - (count - 1) / 2) * DOCK_SPACING;
}

export type PathKind = 'arrive' | 'reverse' | 'depart';

const cache = new Map<string, THREE.Curve<THREE.Vector3>>();

const v = (x: number, z: number) => new THREE.Vector3(x, 0, z);

export function getPath(kind: PathKind, dx: number): THREE.Curve<THREE.Vector3> {
  const key = `${kind}:${dx.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let curve: THREE.Curve<THREE.Vector3>;
  if (kind === 'arrive') {
    curve = new THREE.CatmullRomCurve3(
      [
        v(ROAD.minX, ROAD.laneIn),
        v(dx - 30, ROAD.laneIn),
        v(dx + 2, ROAD.laneIn),
        v(dx + 11, ROAD.laneIn - 2.5),
        v(dx + 15, 44),
        v(dx + 12.5, 36.5),
        v(dx + 6, 32.6),
        v(dx + 1.2, 34.6),
        v(dx, REVERSE_START_Z),
      ],
      false,
      'centripetal',
    );
  } else if (kind === 'reverse') {
    curve = new THREE.LineCurve3(v(dx, REVERSE_START_Z), v(dx, DOCKED_Z));
  } else {
    curve = new THREE.CatmullRomCurve3(
      [
        v(dx, DOCKED_Z),
        v(dx, 30),
        v(dx, 41),
        v(dx - 4, ROAD.laneOut - 1),
        v(dx - 14, ROAD.laneOut),
        v(dx - 40, ROAD.laneOut),
        v(ROAD.minX, ROAD.laneOut),
      ],
      false,
      'centripetal',
    );
  }
  cache.set(key, curve);
  return curve;
}

export function pathLength(kind: PathKind, dx: number) {
  return getPath(kind, dx).getLength();
}

const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2);
const easeIn = (t: number) => t * t;

const tmp = new THREE.Vector3();
const tan = new THREE.Vector3();

/** Pose of a truck on the yard for a given path + linear progress (0..1). */
export function truckPose(kind: PathKind, dx: number, t: number) {
  const curve = getPath(kind, dx);
  const clamped = Math.min(1, Math.max(0, t));
  const u = kind === 'reverse' ? easeInOut(clamped) : kind === 'arrive' ? easeOut(clamped) : easeIn(clamped);
  curve.getPointAt(u, tmp);
  let heading: number;
  if (kind === 'reverse') {
    heading = 0; // facing the road while backing in
  } else {
    curve.getTangentAt(Math.min(0.999, Math.max(0.001, u)), tan);
    heading = Math.atan2(tan.x, tan.z);
  }
  return { x: tmp.x, z: tmp.z, heading };
}

/** Forklift positions along a dock's work lane (z): inside door <-> trailer lip. */
export const FORKLIFT_LANE = { insideZ: 4.4, idleZ: 7.6, pickZ: DOCK_FACE_Z - 1.55 };
