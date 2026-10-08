'use client';

import dynamic from 'next/dynamic';

// The whole command center is client-only: WebGL + a live in-browser simulation.
const WareTrack = dynamic(() => import('@/components/WareTrack'), {
  ssr: false,
  loading: () => (
    <div className="boot">
      <span className="brand-mark" />
      <span>Loading yard…</span>
    </div>
  ),
});

export default function Page() {
  return <WareTrack />;
}
