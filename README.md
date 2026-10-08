# WareTrack

A cold-storage warehouse control center that feels like a strategy game: an isometric 3D yard (Next.js + React Three Fiber + drei) where trucks drive in, reverse into the loading docks and forklifts unload pallets, all kept in sync in real time with the floating panels.

> Inspired by [Dilum Sanjaya's WareTrack demo](https://x.com/DilumSanjaya/status/2106426962738880879). This is an independent recreation, not the original code. All data is mock data.

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

Production build: `npm run build && npm start`.
Static export (any static file host, relative paths): `STATIC_EXPORT=1 npm run build` → `./out`.

## How it's built

```
lib/
  layout.ts      Shared world geometry: building, docks, road, arrival / reverse / departure
                 curves (CatmullRom) and the truck pose for a given progress t.
  store.ts       Zustand + immer store with the simulation: sites, trucks, docks,
                 forklifts, inventory, KPIs and notifications. tick(dt) at 10 Hz.
  data.ts        Seeds: 4 warehouses, cold-chain SKUs, carriers, origins.
  focus.ts       World position of a selected entity (to center the camera).
  camera.ts      Imperative camera API (zoom / rotate / reset / focus) for the buttons.
components/
  scene/         Canvas, grounds (road, fence, trees, parking), warehouse (docks,
                 rooftop AC units, per-dock status lights) and vehicles.
  ui/            Top bar, KPIs, right panel, shipment timeline and operations tabs.
```

### A single source of truth

The simulation lives in the store, **not** in the scene. Each truck has a `phase` + `t` (progress 0..1):

`confirmed → picked → loaded → transit → (queued) → arriving → reversing → unloading → departing`

- The first three phases and `transit` happen off-map and feed the timeline and the ETA.
- When `transit` ends, a free dock is assigned; if there is none, the truck waits at the gate (`queued`) and its delivery counts as late.
- The 3D scene reads the same state in `useFrame` and computes the pose with `truckPose(path, dockX, t)`, smoothing the 10 Hz step to 60 fps. That's why the 3D view and the panels never drift apart.
- Every pallet the forklift takes out of the trailer adds to the inventory of the truck's SKU; outbound picking drains it. The *In Stock / Low Stock* badges and the stock KPI come from there.
- Forklifts drain battery per pallet; below 14% they go to charge and unloading at that dock pauses.

Time scale: 1 real second = 30 simulated seconds (`SIM_SCALE`), used for ETAs and "x min ago".

### Interaction

- Clicking a truck, forklift or dock (on the map or in any list) selects it across all panels; from the lists, the camera also pans to it.
- Clicking the building (or empty space) goes back to the site view.
- Search (⌘K): trucks, plates, carriers, forklifts, bays and SKUs.
- Site switcher: every warehouse keeps simulating in the background.
- Camera: wheel = zoom, drag = rotate, right-click = pan; zoom, rotate 45° and reset buttons.

### Connecting real data

Replace the body of `tick()` in `lib/store.ts` with updates from your backend (WebSocket/SSE), keeping the shape of `SiteState`. The scene only needs `phase`, `t` and `dock` for each truck, and `status` + `cycle` for each forklift.
