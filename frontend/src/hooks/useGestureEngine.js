// hooks/useGestureEngine.js
// The orchestration layer: takes per-frame MediaPipe landmark results and
// decides what they mean (build, erase, grab, rotate, reset, menu...),
// driving the SceneEngine and surfacing lightweight status to React.
//
// Recognition (utils/gestures.js), drawing (engine/overlayRenderer.js),
// and 3D mutation (engine/SceneEngine.js) are all pure/isolated modules —
// this hook is the only place that combines them with timers and state,
// which keeps the per-frame state machine in one readable spot.

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import { HOLD_TIMES, MENU_OPTIONS, GRID_SIZE, DOCK_LAYOUT } from '../constants';
import { landmarkToWorld, snapToGrid } from '../utils/math';
import {
  isFist,
  isClosedFist,
  isPalmOpen,
  isPeaceSign,
  isPointing,
  isPinching,
  isThumbDown,
  isThumbUp,
  resolvePhysicalHandedness,
} from '../utils/gestures';
import { smoothLandmarks, drawHandSkeleton, drawHoldGauge } from '../engine/overlayRenderer';

const FRAME_MS = 16;

export const useGestureEngine = ({
  sceneEngineRef,
  bioCanvasRef,
  setSysStatus,
  setVoxelCount,
  setMenuDockVisible,
  setHoverInfo,
  setColorIndex,
  setFingerCursor,
}) => {
  // Mutable per-frame state lives in refs so onResults() never triggers
  // React re-renders except through the explicit setters above.
  const smoothed = useRef({ Left: [], Right: [] });
  const timers = useRef({
    grab: 0, build: 0, erase: 0, reset: 0, rotate: 0, gravity: 0, restore: 0, hover: 0,
  });
  const flags = useRef({
    isGrabbing: false, isErasing: false,
    hoveredIdx: -1, startPinchPos: null, activeAxis: null,
  });
  const grabOffset = useRef(new THREE.Vector3());
  const dockState = useRef({ visible: false });
  const sketchActive = useRef(false);

  const menuActions = useRef([
    () => {
      sceneEngineRef.current?.cycleColor();
      if (sceneEngineRef.current) setColorIndex(sceneEngineRef.current.colorIndex);
    },
    () => {
      const engine = sceneEngineRef.current;
      if (!engine) return;
      if (engine.gravityEnabled) engine.restoreGravity();
      else engine.triggerGravity();
    },
    () => sceneEngineRef.current?.toggleRainbow(),
  ]);

  const resetFrameTimers = useCallback(() => {
    timers.current = { grab: 0, build: 0, erase: 0, reset: 0, rotate: 0, gravity: 0, restore: 0, hover: 0 };
    flags.current.hoveredIdx = -1;
    setHoverInfo({ index: -1, progress: 0 });
  }, [setHoverInfo]);

  const onResults = useCallback(
    (results) => {
      const engine = sceneEngineRef.current;
      const bioCanvas = bioCanvasRef.current;
      if (!engine || !bioCanvas) return;

      const ctx = bioCanvas.getContext('2d');
      ctx.clearRect(0, 0, bioCanvas.width, bioCanvas.height);
      engine.hideCrosshair();

      if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        resetFrameTimers();
        setFingerCursor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
        return;
      }

      let lHand = null;
      let rHand = null;
      results.multiHandLandmarks.forEach((landmarks) => {
        const label = resolvePhysicalHandedness(landmarks);
        const pts = smoothLandmarks(smoothed.current, label, landmarks);
        drawHandSkeleton(ctx, pts, label, bioCanvas.width, bioCanvas.height);
        if (label === 'Left') lHand = pts;
        else rHand = pts;
      });

      const t = timers.current;
      const f = flags.current;

      // --- Two-hand synchronized gestures (reset / rotate) take priority ---
      if (lHand && rHand) {
        const lFist = isFist(lHand);
        const rFist = isFist(rHand);
        const lPalm = isPalmOpen(lHand);
        const rPalm = isPalmOpen(rHand);

        if (lFist && rFist) {
          if (t.reset < HOLD_TIMES.RESET) {
            t.reset += FRAME_MS;
            drawHoldGauge(ctx, bioCanvas.width / 2, bioCanvas.height / 2, t.reset / HOLD_TIMES.RESET, '#FF6B6B');
            setSysStatus({ message: 'Hold to reset structure', tone: 'warning' });
          } else if (t.reset < 2000) {
            engine.resetTransform();
            setSysStatus({ message: 'Structure reset', tone: 'active' });
            t.reset = 2000;
          }
          return;
        }
        t.reset = 0;

        if (lPalm && rPalm) {
          if (t.rotate < HOLD_TIMES.ROTATE) {
            t.rotate += FRAME_MS;
            drawHoldGauge(ctx, bioCanvas.width / 2, bioCanvas.height / 2, t.rotate / HOLD_TIMES.ROTATE, '#7FDBFF');
            setSysStatus({ message: 'Hold to enable rotation', tone: 'warning' });
          } else {
            setSysStatus({ message: 'Rotating structure', tone: 'active' });
            engine.rotateGroup(rHand[9].x - lHand[9].x, rHand[9].y - lHand[9].y);
          }
          return;
        }
        t.rotate = 0;
      } else {
        t.reset = 0;
        t.rotate = 0;
      }

      // --- Left hand: dock toggle, grab, gravity burst/restore ---
      if (lHand) {
        handleLeftHand({ lHand, engine, ctx, bioCanvas, t, f, dockState, grabOffset, setSysStatus, setMenuDockVisible });
      } else if (dockState.current.visible) {
        dockState.current.visible = false;
        setMenuDockVisible(false);
      }

      // --- Right hand: build / erase / navigate / menu select / cursor ---
      if (rHand) {
        handleRightHand({
          rHand, lHand, engine, ctx, bioCanvas, t, f, sketchActive, dockState,
          setSysStatus, setVoxelCount, setHoverInfo, setFingerCursor, menuActions,
        });
      } else {
        setFingerCursor((prev) => (prev.visible ? { ...prev, visible: false } : prev));
      }
    },
    [sceneEngineRef, bioCanvasRef, setSysStatus, setVoxelCount, setMenuDockVisible, setHoverInfo, setFingerCursor, resetFrameTimers]
  );

  return { onResults };
};

// --- Left hand sub-handler -------------------------------------------------

function handleLeftHand({ lHand, engine, ctx, bioCanvas, t, f, dockState, grabOffset, setSysStatus, setMenuDockVisible }) {
  // isThumbDown/isThumbUp are near mutually-exhaustive once the fingers
  // are curled (a folded thumb's tip naturally sits slightly above or
  // below its own IP joint), so grab can't be defined as "fist minus
  // thumb-direction" — that's almost never true and resets the hold
  // timer before it can complete. isClosedFist checks the thumb is
  // tucked across the palm instead, which is a distinct, stable shape.
  const closedFist = isClosedFist(lHand);
  const palm = isPalmOpen(lHand);
  const thumbDown = isThumbDown(lHand);
  const thumbUp = isThumbUp(lHand);

  // Open left palm shows the fixed dock; anything else hides it. No
  // position tracking needed anymore — the dock lives at a constant
  // screen location, so this is just a visibility toggle.
  if (palm !== dockState.current.visible) {
    dockState.current.visible = palm;
    setMenuDockVisible(palm);
  }
  if (palm) {
    f.isGrabbing = false;
    t.grab = 0;
    setSysStatus({ message: 'Menu dock open — point to select', tone: 'active' });
  }

  if (thumbDown && !closedFist) {
    t.restore = 0;
    if (!engine.gravityEnabled) {
      if (t.gravity < HOLD_TIMES.GRAVITY) {
        t.gravity += FRAME_MS;
        drawHoldGauge(ctx, lHand[4].x * bioCanvas.width, lHand[4].y * bioCanvas.height, t.gravity / HOLD_TIMES.GRAVITY, '#FF6B9D');
        setSysStatus({ message: 'Hold to release gravity', tone: 'warning' });
      } else {
        engine.triggerGravity();
        setSysStatus({ message: 'Gravity active', tone: 'active' });
        t.gravity = 0;
      }
    }
  } else if (thumbUp && !closedFist) {
    t.gravity = 0;
    if (engine.gravityEnabled) {
      if (t.restore < HOLD_TIMES.GRAVITY) {
        t.restore += FRAME_MS;
        drawHoldGauge(ctx, lHand[4].x * bioCanvas.width, lHand[4].y * bioCanvas.height, t.restore / HOLD_TIMES.GRAVITY, '#5EEAD4');
        setSysStatus({ message: 'Hold to restore structure', tone: 'warning' });
      } else {
        engine.restoreGravity();
        setSysStatus({ message: 'Structure restored', tone: 'active' });
        t.restore = 0;
      }
    }
  } else {
    t.gravity = 0;
    t.restore = 0;
  }

  if (closedFist) {
    if (t.grab < HOLD_TIMES.GRAB) {
      t.grab += FRAME_MS;
      drawHoldGauge(ctx, lHand[0].x * bioCanvas.width, lHand[0].y * bioCanvas.height, t.grab / HOLD_TIMES.GRAB, '#FFD166');
    } else {
      const handWorldPos = landmarkToWorld(lHand[9]);
      if (!f.isGrabbing) {
        grabOffset.current.copy(engine.voxelGroup.position).sub(handWorldPos);
        f.isGrabbing = true;
      }
      engine.setGroupPosition(handWorldPos.add(grabOffset.current));
      setSysStatus({ message: 'Structure grabbed', tone: 'active' });
    }
  } else if (f.isGrabbing) {
    const handWorldPos = landmarkToWorld(lHand[9]);
    engine.setGroupPosition(handWorldPos.add(grabOffset.current));
  } else {
    t.grab = 0;
  }
}

// --- Right hand sub-handler -------------------------------------------------

function handleRightHand({ rHand, lHand, engine, ctx, bioCanvas, t, f, sketchActive, dockState, setSysStatus, setVoxelCount, setHoverInfo, setFingerCursor, menuActions }) {
  const pinching = isPinching(rHand);
  const pointing = isPointing(rHand);
  const palmOpen = isPalmOpen(rHand);
  const peace = isPeaceSign(rHand);

  if (peace) engine.toggleRainbow(true);
  else if (palmOpen) engine.toggleRainbow(false);

  const indexTip = rHand[8];
  const px = indexTip.x * bioCanvas.width;
  const py = indexTip.y * bioCanvas.height;

  // Real screen-space position of the fingertip — mirrored to match what
  // the person sees of themselves, since the video feed is mirrored too.
  // This drives the always-on cursor: the Stark-HUD reticle that shows
  // exactly where the system thinks you're pointing, at all times.
  const screenX = (1 - indexTip.x) * window.innerWidth;
  const screenY = indexTip.y * window.innerHeight;
  setFingerCursor({ x: screenX, y: screenY, visible: true, pinching });

  // --- Fixed menu dock hover/select ---
  // The dock no longer follows the hand; it lives at a constant screen
  // position (see DOCK_LAYOUT) and the cursor above does the moving.
  // Hovering a static target is far more reliable than chasing one.
  if (dockState.current.visible) {
    const dockCenterX = window.innerWidth - DOCK_LAYOUT.rightOffset - DOCK_LAYOUT.itemWidth / 2;
    const dockCenterY = window.innerHeight * DOCK_LAYOUT.topOffset;
    const totalHeight = MENU_OPTIONS.length * DOCK_LAYOUT.itemHeight + (MENU_OPTIONS.length - 1) * DOCK_LAYOUT.itemGap;
    const dockTop = dockCenterY - totalHeight / 2;

    let currentHover = -1;
    MENU_OPTIONS.forEach((_, idx) => {
      const itemTop = dockTop + idx * (DOCK_LAYOUT.itemHeight + DOCK_LAYOUT.itemGap);
      const itemCenterY = itemTop + DOCK_LAYOUT.itemHeight / 2;
      const withinX = Math.abs(screenX - dockCenterX) < DOCK_LAYOUT.itemWidth / 2;
      const withinY = Math.abs(screenY - itemCenterY) < DOCK_LAYOUT.itemHeight / 2;
      if (withinX && withinY) currentHover = idx;
    });

    if (currentHover !== -1) {
      if (f.hoveredIdx === currentHover) {
        t.hover += FRAME_MS;
        if (t.hover >= HOLD_TIMES.MENU_HOVER) {
          menuActions.current[currentHover]?.();
          setSysStatus({ message: `${MENU_OPTIONS[currentHover].label} activated`, tone: 'active' });
          t.hover = -1000; // refractory period prevents instant re-trigger
        }
      } else {
        f.hoveredIdx = currentHover;
        t.hover = 0;
      }
    } else {
      f.hoveredIdx = -1;
      t.hover = 0;
    }
    setHoverInfo({ index: f.hoveredIdx, progress: Math.max(0, t.hover / HOLD_TIMES.MENU_HOVER) });

    // While the dock is open the right hand is dedicated to menu
    // selection — skip build/erase targeting so a pinch near the dock
    // doesn't also place or erase a voxel underneath it.
    return;
  }
  if (f.hoveredIdx !== -1) {
    f.hoveredIdx = -1;
    t.hover = 0;
    setHoverInfo({ index: -1, progress: 0 });
  }

  // --- Build / erase grid targeting ---
  const worldPos = landmarkToWorld(indexTip);
  const localPos = engine.voxelGroup.worldToLocal(worldPos.clone());
  const gx = snapToGrid(localPos.x, GRID_SIZE);
  const gy = snapToGrid(localPos.y, GRID_SIZE);
  const gz = 0;

  const leftPinching = lHand && isPinching(lHand);

  if (leftPinching && pointing && !palmOpen) {
    t.build = 0;
    if (t.erase < HOLD_TIMES.INTENT) {
      t.erase += FRAME_MS;
      drawHoldGauge(ctx, px, py, t.erase / HOLD_TIMES.INTENT, '#FF6B6B');
      setSysStatus({ message: 'Locking eraser…', tone: 'warning' });
    } else {
      f.isErasing = true;
      const removed = engine.eraseVoxelAt(gx, gy, gz, setVoxelCount);
      setSysStatus({ message: removed ? 'Erasing' : 'Erasing (empty cell)', tone: 'active' });
    }
  } else if (pinching && !f.isGrabbing && !palmOpen) {
    t.erase = 0;
    if (t.build < HOLD_TIMES.INTENT) {
      t.build += FRAME_MS;
      drawHoldGauge(ctx, px, py, t.build / HOLD_TIMES.INTENT, '#5EEAD4');
      setSysStatus({ message: 'Syncing build…', tone: 'warning' });
    } else {
      if (!sketchActive.current) {
        f.startPinchPos = { x: gx, y: gy, z: gz };
        engine.clearSketchKeys();
        sketchActive.current = true;
        f.activeAxis = null;
      } else {
        const dx = Math.abs(gx - f.startPinchPos.x);
        const dy = Math.abs(gy - f.startPinchPos.y);
        if (!f.activeAxis && (dx > 0.4 || dy > 0.4)) {
          f.activeAxis = dx >= dy ? 'x' : 'y';
        }
        let tx = f.startPinchPos.x;
        let ty = f.startPinchPos.y;
        if (f.activeAxis === 'x') tx = gx;
        else if (f.activeAxis === 'y') ty = gy;
        engine.addSketchVoxel(tx, ty, gz);
      }
      setSysStatus({ message: 'Building', tone: 'active' });
    }
  } else if (palmOpen) {
    if (sketchActive.current) engine.commitSketch(setVoxelCount);
    sketchActive.current = false;
    f.isErasing = false;
    t.build = 0;
    t.erase = 0;
    setSysStatus({ message: 'Navigating', tone: 'idle' });
  }

  if (sketchActive.current || t.build > 0 || f.isErasing || t.erase > 0) {
    engine.showCrosshair(engine.voxelGroup.localToWorld(new THREE.Vector3(gx, gy, gz)), f.isErasing || t.erase > 0);
  }
}