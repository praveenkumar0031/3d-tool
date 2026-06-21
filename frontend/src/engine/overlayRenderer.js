// engine/overlayRenderer.js
// Pure canvas-drawing functions for the 2D tracking overlay: the hand
// skeleton and the radial "hold to confirm" gauge that's the app's
// signature interaction cue. Kept separate from gesture logic so the
// visual language can be restyled without touching recognition code.

import { HAND_CONNECTIONS, FINGERTIP_INDICES } from '../constants';

const HAND_TINT = {
  Left: { line: 'rgba(237, 232, 223, 0.55)', dot: '#EDE8DF', glow: 'rgba(237, 232, 223, 0.5)' },
  Right: { line: 'rgba(255, 183, 77, 0.55)', dot: '#FFB74D', glow: 'rgba(255, 183, 77, 0.5)' },
};

/** Exponential smoothing of raw landmarks to remove camera jitter. */
export const smoothLandmarks = (store, label, rawLandmarks) => {
  if (!store[label] || store[label].length === 0) {
    store[label] = rawLandmarks.map((p) => ({ ...p }));
  } else {
    rawLandmarks.forEach((p, i) => {
      store[label][i].x += (p.x - store[label][i].x) * 0.45;
      store[label][i].y += (p.y - store[label][i].y) * 0.45;
      store[label][i].z += (p.z - store[label][i].z) * 0.1;
    });
  }
  return store[label];
};

export const drawHandSkeleton = (ctx, points, label, canvasWidth, canvasHeight) => {
  const tint = HAND_TINT[label] ?? HAND_TINT.Right;

  ctx.shadowBlur = 6;
  ctx.shadowColor = tint.glow;
  ctx.strokeStyle = tint.line;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  HAND_CONNECTIONS.forEach(([a, b]) => {
    ctx.moveTo(points[a].x * canvasWidth, points[a].y * canvasHeight);
    ctx.lineTo(points[b].x * canvasWidth, points[b].y * canvasHeight);
  });
  ctx.stroke();

  points.forEach((pt, i) => {
    const x = pt.x * canvasWidth;
    const y = pt.y * canvasHeight;
    if (FINGERTIP_INDICES.includes(i)) {
      ctx.strokeStyle = tint.dot;
      ctx.strokeRect(x - 5, y - 5, 10, 10);
    } else {
      ctx.fillStyle = 'rgba(237, 232, 223, 0.85)';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
  });
  ctx.shadowBlur = 0;
};

/**
 * The signature hold-to-confirm radial gauge. Every timed gesture in the
 * app (build, erase, reset, rotate, gravity) renders through this one
 * function so the interaction language stays visually unified.
 */
export const drawHoldGauge = (ctx, x, y, progress, color) => {
  const radius = 26;
  ctx.save();

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(237, 232, 223, 0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.shadowBlur = 12;
  ctx.shadowColor = color;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.fill();

  ctx.restore();
};
