// components/StatusRail.jsx
// Thin instrument-panel strip across the top of the viewport. Replaces the
// old always-on wall of green text with a single live status line plus a
// voxel counter — quiet by default, only the active build color accents it.

import React from 'react';

const TONE_DOT = {
  idle: 'var(--va-tone-idle)',
  active: 'var(--va-tone-active)',
  warning: 'var(--va-tone-warning)',
  error: 'var(--va-tone-error)',
};

const StatusRail = ({ status, voxelCount, streamLabel }) => {
  const dotColor = TONE_DOT[status.tone] ?? TONE_DOT.idle;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 22px',
        fontFamily: 'var(--va-font-display)',
        background: 'linear-gradient(to bottom, rgba(11,13,16,0.85), rgba(11,13,16,0))',
        pointerEvents: 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: dotColor,
            boxShadow: `0 0 8px ${dotColor}`,
            flexShrink: 0,
            transition: 'background 0.2s ease',
          }}
        />
        <span style={{ fontSize: 12, letterSpacing: '0.04em', color: 'var(--va-text)' }}>
          {status.message}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <span style={{ fontSize: 11, color: 'var(--va-text-faint)', letterSpacing: '0.04em' }}>
          {streamLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--va-text)', fontVariantNumeric: 'tabular-nums' }}>
            {voxelCount}
          </span>
          <span style={{ fontSize: 10, color: 'var(--va-text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            voxels
          </span>
        </div>
      </div>
    </div>
  );
};

export default StatusRail;
