// utils/math.js
// Pure helper functions with no Three.js or React dependency beyond
// THREE's MathUtils — safe to unit test in isolation.

import * as THREE from 'three';

/** Euclidean distance between two landmark points (2D or 3D). */
export const distance = (p1, p2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  const dz = p1.z && p2.z ? p1.z - p2.z : 0;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * Vertical extent of the camera's view frustum at its current distance,
 * used to find the world-space floor for gravity simulation.
 */
export const getFloorY = (camera, gridSize) => {
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const height = 2 * Math.tan(vFOV / 2) * camera.position.z;
  return -(height / 2) + gridSize / 2;
};

/** Maps a normalized landmark (0..1) to world space in front of the camera. */
export const landmarkToWorld = (point, scaleX = 25, scaleY = 18) =>
  new THREE.Vector3((0.5 - point.x) * scaleX, (0.5 - point.y) * scaleY, 0);

/** Snaps a world coordinate to the nearest voxel grid cell. */
export const snapToGrid = (value, gridSize) => Math.round(value / gridSize) * gridSize;

/** Stable string key for a voxel position, used for Map/Set lookups. */
export const voxelKey = (x, y, z) => `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`;
