import { DOCKED_Z, FORKLIFT_LANE, dockX, truckPose } from './layout';
import { isOnMap, type SiteState, type Selection } from './store';

/** World position of a selectable entity, or null when it is not on the map. */
export function entityPosition(site: SiteState, sel: Selection): { x: number; z: number } | null {
  const n = site.docks.length;
  switch (sel.kind) {
    case 'site':
      return { x: 0, z: 4 };
    case 'dock':
      return { x: dockX(sel.idx, n), z: DOCKED_Z - 4 };
    case 'forklift': {
      const f = site.forklifts.find((x) => x.id === sel.id);
      return f ? { x: dockX(f.dock, n), z: FORKLIFT_LANE.idleZ } : null;
    }
    case 'truck': {
      const t = site.trucks.find((x) => x.id === sel.id);
      if (!t || !isOnMap(t)) return null;
      const dx = dockX(t.dock ?? 0, n);
      if (t.phase === 'arriving') {
        // aim a little ahead so the truck drives into frame
        const p = truckPose('arrive', dx, Math.min(1, t.t + 0.25));
        return { x: p.x, z: p.z };
      }
      if (t.phase === 'departing') {
        const p = truckPose('depart', dx, t.t);
        return { x: p.x, z: p.z };
      }
      return { x: dx, z: DOCKED_Z + 4 };
    }
  }
}
