// components/ColorSwatch.jsx
// A small fixed indicator of the current build color. The original UI
// never showed this anywhere — you only discovered the active color by
// looking at the voxels themselves. Surfacing it here closes that gap
// and gives the "Color" menu action a visible result.

import React from 'react';

const toHex = (numericColor) => `#${numericColor.toString(16).padStart(6, '0')}`;

const ColorSwatch = ({ colorIndex, palette }) => {
  const hex = toHex(palette[colorIndex] ?? palette[0]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 18,
        right: 22,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'var(--va-font-display)',
        pointerEvents: 'none',
      }}
    >
      <span style={{ fontSize: 10, color: 'var(--va-text-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        active
      </span>
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: hex,
          boxShadow: `0 0 10px ${hex}`,
          border: '1px solid rgba(237, 232, 223, 0.25)',
        }}
      />
    </div>
  );
};

export default ColorSwatch;
