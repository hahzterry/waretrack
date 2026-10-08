'use client';

import { useEffect, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import * as THREE from 'three';
import { C } from './palette';
import { Grounds } from './Grounds';
import { Warehouse, type DockVisual } from './Warehouse';
import { Forklifts, Trucks } from './Vehicles';
import { useWT } from '@/lib/store';
import { cameraApi } from '@/lib/camera';

const HOME = { pos: new THREE.Vector3(95, 88, 105), target: new THREE.Vector3(0, 0, 10) };

function fitZoom(w: number, h: number) {
  // keep the yard comfortably framed between the floating panels
  return Math.max(4, Math.min(w / 160, h / 100));
}

function CameraRig() {
  const ref = useRef<CameraControls>(null);
  const size = useThree((s) => s.size);
  const homeZoom = useRef(fitZoom(size.width, size.height));

  const camera = useThree((s) => s.camera);
  useEffect(() => {
    homeZoom.current = fitZoom(size.width, size.height);
    // centre the yard in the space left free by the floating panels
    const offX = size.width > 900 ? 186 : 0;
    const offY = size.width > 900 ? 70 : 40;
    camera.setViewOffset(size.width, size.height, offX, offY, size.width, size.height);
    camera.updateProjectionMatrix();
  }, [size.width, size.height, camera]);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.setLookAt(HOME.pos.x, HOME.pos.y, HOME.pos.z, HOME.target.x, HOME.target.y, HOME.target.z, false);
    c.zoomTo(homeZoom.current, false);
    cameraApi.zoomIn = () => c.zoomTo(c.camera.zoom * 1.3, true);
    cameraApi.zoomOut = () => c.zoomTo(c.camera.zoom / 1.3, true);
    cameraApi.rotate = (dir) => c.rotate((dir * Math.PI) / 4, 0, true);
    cameraApi.reset = () => {
      c.setLookAt(HOME.pos.x, HOME.pos.y, HOME.pos.z, HOME.target.x, HOME.target.y, HOME.target.z, true);
      c.zoomTo(homeZoom.current, true);
    };
    cameraApi.focus = (x, z) => {
      c.moveTo(x, 0, z, true);
      if (c.camera.zoom < homeZoom.current * 1.35) c.zoomTo(homeZoom.current * 1.5, true);
    };
  }, []);

  // frame the new yard whenever the site switcher changes warehouse
  const siteId = useWT((s) => s.activeSiteId);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    cameraApi.reset();
  }, [siteId]);

  return (
    <CameraControls
      ref={ref}
      makeDefault
      minPolarAngle={0.35}
      maxPolarAngle={1.18}
      minZoom={3}
      maxZoom={40}
      smoothTime={0.35}
      draggingSmoothTime={0.12}
      dollyToCursor
    />
  );
}

export default function Scene() {
  const docks = useWT((s) => s.sites[s.activeSiteId].docks.length);
  const dockStates = useWT((s) => {
    const site = s.sites[s.activeSiteId];
    return site.docks
      .map((d): DockVisual => {
        if (d.maintenance) return 'maintenance';
        const t = site.trucks.find((x) => x.id === d.truckId);
        if (!t) return 'free';
        if (t.phase === 'unloading') return 'unloading';
        return 'docking';
      })
      .join(',');
  });
  const select = useWT((s) => s.select);

  return (
    <Canvas
      shadows="percentage"
      orthographic
      dpr={[1, 2]}
      camera={{ position: [HOME.pos.x, HOME.pos.y, HOME.pos.z], zoom: 7, near: 1, far: 800 }}
      onPointerMissed={() => select({ kind: 'site' })}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[C.bg]} />
      <hemisphereLight args={['#ffffff', '#c9d6ec', 1.25]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[70, 110, 45]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[4096, 4096]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.05}
        shadow-radius={6}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={1}
        shadow-camera-far={320}
      />
      <directionalLight position={[-60, 40, -30]} intensity={0.35} color="#dbe7ff" />
      <Grounds docks={docks} />
      <Warehouse docks={docks} dockStates={dockStates.split(',') as DockVisual[]} />
      <Trucks />
      <Forklifts />
      <CameraRig />
    </Canvas>
  );
}
