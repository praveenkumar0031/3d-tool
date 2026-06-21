// hooks/useVoxelArchitect.js
// The single effect that owns setup/teardown for the whole experience:
// constructs the SceneEngine, initializes MediaPipe Hands, starts the
// camera source, and runs the render loop. Everything here is wiring —
// the actual behavior lives in SceneEngine and useGestureEngine.

import { useEffect, useRef, useState } from 'react';
import { SceneEngine } from '../engine/SceneEngine';
import { startCameraSource } from '../engine/cameraSource';
import { useGestureEngine } from './useGestureEngine';

export const useVoxelArchitect = ({ videoRef, bioCanvasRef, threeCanvasRef }) => {
  const [sysStatus, setSysStatus] = useState({ message: 'Initializing…', tone: 'idle' });
  const [voxelCount, setVoxelCount] = useState(0);
  const [menuDockVisible, setMenuDockVisible] = useState(false);
  const [hoverInfo, setHoverInfo] = useState({ index: -1, progress: 0 });
  const [colorIndex, setColorIndex] = useState(0);
  const [fingerCursor, setFingerCursor] = useState({ x: 0, y: 0, visible: false, pinching: false });

  const sceneEngineRef = useRef(null);

  const { onResults } = useGestureEngine({
    sceneEngineRef,
    bioCanvasRef,
    setSysStatus,
    setVoxelCount,
    setMenuDockVisible,
    setHoverInfo,
    setColorIndex,
    setFingerCursor,
  });

  useEffect(() => {
    if (!videoRef.current || !bioCanvasRef.current || !threeCanvasRef.current) return undefined;

    if (!window.Hands || !window.Camera) {
      setSysStatus({ message: 'MediaPipe scripts not found — check index.html', tone: 'error' });
      return undefined;
    }

    const engine = new SceneEngine(threeCanvasRef.current);
    sceneEngineRef.current = engine;
    engine.start();

    const handsEngine = new window.Hands({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });
    handsEngine.setOptions({ maxNumHands: 2, modelComplexity: 1, minDetectionConfidence: 0.8, minTrackingConfidence: 0.8 });
    handsEngine.onResults(onResults);

    // startCameraSource returns its teardown fn synchronously, but we
    // stagger the actual start by 300ms to avoid contending with the
    // canvas's first paint. `cancelled` guards against unmounting inside
    // that window, and `stopCamera` is filled in once the real source starts.
    let cancelled = false;
    let stopCamera = () => {};

    const startupDelay = setTimeout(() => {
      if (cancelled) return;
      stopCamera = startCameraSource({
        videoEl: videoRef.current,
        bioCanvasEl: bioCanvasRef.current,
        handsEngine,
        onStatus: ({ message, error }) => setSysStatus({ message, tone: error ? 'error' : 'active' }),
      });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(startupDelay);
      stopCamera();
      handsEngine.close();
      engine.dispose();
      sceneEngineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sysStatus, voxelCount, menuDockVisible, hoverInfo, colorIndex, fingerCursor };
};
