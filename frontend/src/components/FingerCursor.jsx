// components/FingerCursor.jsx
// The reticle that tracks the right index fingertip in real screen
// coordinates — this is what makes pointing feel like pointing instead
// of guessing. It's deliberately a crosshair, not a filled dot: a dot
// obscures exactly the pixel you're trying to point at, a ring/crosshair
// doesn't. Tightens and brightens on pinch so a "click" reads at a glance.

import React from 'react';

const FingerCursor = ({ cursor }) => {
  if (!cursor.visible) return null;

  const size = cursor.pinching ? 18 : 26;
  const color = cursor.pinching ? 'var(--va-tone-active)' : 'var(--va-text)';

  return (
    <div
      style={{
        position: 'absolute',
        left: cursor.x,
        top: cursor.y,
        zIndex: 120,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: -size / 2,
          top: -size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          border: `1.5px solid ${color}`,
          boxShadow: `0 0 ${cursor.pinching ? 16 : 8}px ${color}`,
          transition: 'width 0.12s ease, height 0.12s ease, left 0.12s ease, top 0.12s ease, border-color 0.12s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -2,
          top: -2,
          width: 4,
          height: 4,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {/* Crosshair ticks */}
      {[
        { left: -1, top: -size / 2 - 6, width: 2, height: 4 },
        { left: -1, top: size / 2 + 2, width: 2, height: 4 },
        { left: -size / 2 - 6, top: -1, width: 4, height: 2 },
        { left: size / 2 + 2, top: -1, width: 4, height: 2 },
      ].map((tick, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: tick.left,
            top: tick.top,
            width: tick.width,
            height: tick.height,
            background: color,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
};

export default FingerCursor;
