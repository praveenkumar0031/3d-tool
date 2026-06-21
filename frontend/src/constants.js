// constants.js
// Central configuration for the voxel scene, gesture timings, and palette.
// Keeping these in one place means tuning feel (hold durations, grid size)
// never requires touching engine logic.

export const GRID_SIZE = 1.2;

export const COLOR_PALETTE = [
  0x00f0ff, 0xff0000, 0x0000ff, 0x00ff00, 0xffff00, 0xff00ff,
  0xffa500, 0x800080, 0x00ff7f, 0xff1493, 0x7fff00, 0x40e0d0,
  0xffd700, 0xff4500, 0x9370db, 0x00ced1, 0xf08080, 0xadff2f,
  0xff6347, 0x00bfff, 0xda70d6,
];

export const MENU_OPTIONS = [
  { id: 'color', label: 'Color', hint: 'Cycle palette' },
  { id: 'gravity', label: 'Gravity', hint: 'Drop structure' },
  { id: 'disco', label: 'Disco', hint: 'Pulse all voxels' },
];

// Fixed screen-space layout for the menu dock — a Stark-HUD style panel
// pinned to the right edge instead of one that chases the hand around.
// itemHeight + itemGap must match the rendered MenuDock.jsx sizing exactly,
// since the gesture engine hit-tests against these same numbers without
// ever touching the DOM.
export const DOCK_LAYOUT = {
  rightOffset: 28, // px from right edge of screen to dock center
  topOffset: 0.5, // fraction of screen height where the dock vertically centers
  itemWidth: 124,
  itemHeight: 44,
  itemGap: 14,
};

// Hold durations, in ms, for every "intent confirm" gesture in the app.
export const HOLD_TIMES = {
  GRAB: 500,
  INTENT: 500, // build / erase lock-in
  RESET: 1000,
  ROTATE: 1000,
  GRAVITY: 800,
  MENU_HOVER: 500,
};

export const PINCH_THRESHOLD = 0.05;

// Hand landmark connection pairs (MediaPipe Hands topology) used to draw
// the skeleton overlay on the tracking canvas.
export const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [9, 10], [10, 11], [11, 12],
  [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17], [0, 5],
];

export const FINGERTIP_INDICES = [4, 8, 12, 16, 20];

// System status strings, grouped so UI components can branch on tone
// (idle / active / warning / error) without string-matching everywhere.
export const STATUS_TONE = {
  ERROR: 'error',
  WARNING: 'warning',
  ACTIVE: 'active',
  IDLE: 'idle',
};
