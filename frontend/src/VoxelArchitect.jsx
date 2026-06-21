// VoxelArchitect.jsx
// Entry point. All behavior lives in hooks/ and engine/; this file is
// purely composition — wiring refs to the lifecycle hook and laying out
// the UI components around the camera viewport.
//
// File map:
//   constants.js                 shared config (palette, grid size, hold timings)
//   utils/math.js                 pure geometry helpers
//   utils/gestures.js             pure hand-shape predicates
//   engine/SceneEngine.js         Three.js scene, voxels, physics, render loop
//   engine/cameraSource.js        MediaPipe -> native -> simulator fallback chain
//   engine/overlayRenderer.js     hand-skeleton + hold-gauge canvas drawing
//   hooks/useGestureEngine.js     per-frame gesture -> action orchestration
//   hooks/useVoxelArchitect.js    setup/teardown effect, exposes UI state
//   components/StatusRail.jsx     top status strip
//   components/GestureLegend.jsx  bottom gesture reference
//   components/MenuDock.jsx       fixed-position HUD menu (right edge)
//   components/FingerCursor.jsx   real-time fingertip reticle
//   components/ColorSwatch.jsx    active build-color indicator
//   components/SceneViewport.jsx  video + WebGL + tracking canvas stack
//   styles/theme.css              design tokens (import once, e.g. in main.jsx)

import React, { useRef } from 'react';
import { useVoxelArchitect } from './hooks/useVoxelArchitect';
import { COLOR_PALETTE } from './constants';
import SceneViewport from './components/SceneViewport';
import StatusRail from './components/StatusRail';
import GestureLegend from './components/GestureLegend';
import MenuDock from './components/MenuDock';
import FingerCursor from './components/FingerCursor';
import ColorSwatch from './components/ColorSwatch';
import './styles/theme.css';

const VoxelArchitect = () => {
  const videoRef = useRef(null);
  const bioCanvasRef = useRef(null);
  const threeCanvasRef = useRef(null);

  const { sysStatus, voxelCount, menuDockVisible, hoverInfo, colorIndex, fingerCursor } = useVoxelArchitect({
    videoRef,
    bioCanvasRef,
    threeCanvasRef,
  });

  return (
    <div
      style={{
        margin: 0,
        background: 'var(--va-bg)',
        overflow: 'hidden',
        width: '100vw',
        height: '100vh',
        position: 'relative',
      }}
    >
      <SceneViewport videoRef={videoRef} threeCanvasRef={threeCanvasRef} bioCanvasRef={bioCanvasRef} />

      <StatusRail status={sysStatus} voxelCount={voxelCount} streamLabel="Voxel Architect" />
      <ColorSwatch colorIndex={colorIndex} palette={COLOR_PALETTE} />
      <GestureLegend dimmed={voxelCount > 0} />
      <MenuDock visible={menuDockVisible} hoverInfo={hoverInfo} />
      <FingerCursor cursor={fingerCursor} />
    </div>
  );
};

export default VoxelArchitect;
