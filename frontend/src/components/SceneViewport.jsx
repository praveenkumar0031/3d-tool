// components/SceneViewport.jsx
// The stacked video + WebGL + tracking-overlay layers. Pulled out of the
// root component since it's pure layout (z-index ordering, mirroring,
// sizing) with no logic of its own — the refs are owned by the parent
// and just passed through.

import React from 'react';

const SceneViewport = ({ videoRef, threeCanvasRef, bioCanvasRef }) => (
  <>
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: 'scaleX(-1)',
        zIndex: 1,
        filter: 'saturate(0.7) brightness(0.55)',
      }}
    />

    <canvas
      ref={threeCanvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />

    <canvas
      ref={bioCanvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        transform: 'scaleX(-1)',
        pointerEvents: 'none',
      }}
    />
  </>
);

export default SceneViewport;
