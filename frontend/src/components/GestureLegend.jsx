// components/GestureLegend.jsx
// Bottom instrument strip documenting the gesture vocabulary. The original
// component crammed every control into colored text lines competing for
// attention; this groups them by hand and fades to low opacity once the
// person has hands in frame (passed in via `dimmed`), so it teaches once
// and then gets out of the way.

import React from 'react';

const LEGEND_GROUPS = [
  {
    hand: 'Right',
    accent: 'var(--va-hand-right)',
    items: [
      { gesture: 'Pinch + drag', action: 'Build' },
      { gesture: 'Pinch + point (left hand pinched)', action: 'Erase' },
      { gesture: 'Open palm', action: 'Navigate / commit' },
      { gesture: 'Peace sign', action: 'Disco pulse' },
    ],
  },
  {
    hand: 'Left',
    accent: 'var(--va-hand-left)',
    items: [
      { gesture: 'Open palm', action: 'Show menu dock' },
      { gesture: 'Fist, hold', action: 'Grab structure' },
      { gesture: 'Thumb down, hold', action: 'Drop (gravity)' },
      { gesture: 'Thumb up, hold', action: 'Restore' },
    ],
  },
  {
    hand: 'Both',
    accent: 'var(--va-text-dim)',
    items: [
      { gesture: 'Two fists, hold', action: 'Reset' },
      { gesture: 'Two palms, hold', action: 'Rotate' },
    ],
  },
];

const GestureLegend = ({ dimmed = false }) => (
  <div
    style={{
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: 'flex',
      justifyContent: 'center',
      gap: 28,
      padding: '16px 22px 18px',
      background: 'linear-gradient(to top, rgba(11,13,16,0.88), rgba(11,13,16,0))',
      fontFamily: 'var(--va-font-display)',
      pointerEvents: 'none',
      opacity: dimmed ? 0.35 : 1,
      transition: 'opacity 0.4s ease',
      flexWrap: 'wrap',
    }}
  >
    {LEGEND_GROUPS.map((group) => (
      <div key={group.hand} style={{ minWidth: 200 }}>
        <div
          style={{
            fontSize: 10,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: group.accent,
            marginBottom: 6,
            opacity: 0.85,
          }}
        >
          {group.hand}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {group.items.map((item) => (
            <div key={item.action} style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              <span style={{ color: 'var(--va-text-dim)', minWidth: 150 }}>{item.gesture}</span>
              <span style={{ color: 'var(--va-text)' }}>{item.action}</span>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export default GestureLegend;
