// components/MenuDock.jsx
// A fixed vertical dock pinned to the right edge of the screen — the
// "Stark HUD" panel that stays put while the fingertip cursor moves to
// it, instead of a menu that chases the hand around. Layout numbers
// (rightOffset, itemHeight, itemGap) are shared with the gesture engine
// via DOCK_LAYOUT in constants.js so hit-testing matches what's drawn
// here pixel-for-pixel.

import React from 'react';
import { MENU_OPTIONS, DOCK_LAYOUT } from '../constants';

const MenuDock = ({ visible, hoverInfo }) => (
  <div
    style={{
      position: 'absolute',
      right: DOCK_LAYOUT.rightOffset,
      top: '50%',
      transform: `translateY(-50%) translateX(${visible ? '0' : '16px'})`,
      zIndex: 110,
      opacity: visible ? 1 : 0,
      pointerEvents: 'none',
      transition: 'opacity 0.25s ease, transform 0.25s ease',
      display: 'flex',
      flexDirection: 'column',
      gap: DOCK_LAYOUT.itemGap,
      fontFamily: 'var(--va-font-display)',
    }}
  >
    {/* Anchor tick marking the dock's edge, echoing the hold-gauge motif */}
    <div
      style={{
        position: 'absolute',
        left: -14,
        top: 0,
        bottom: 0,
        width: 2,
        background: 'linear-gradient(to bottom, transparent, rgba(237,232,223,0.35), transparent)',
      }}
    />

    {MENU_OPTIONS.map((opt, i) => {
      const isHovered = hoverInfo.index === i;
      const progress = isHovered ? Math.max(0, hoverInfo.progress) : 0;

      return (
        <div
          key={opt.id}
          style={{
            position: 'relative',
            width: DOCK_LAYOUT.itemWidth,
            height: DOCK_LAYOUT.itemHeight,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: isHovered ? 'rgba(94, 234, 212, 0.12)' : 'var(--va-panel)',
            border: `1px solid ${isHovered ? 'var(--va-tone-active)' : 'var(--va-panel-border)'}`,
            borderRadius: 'var(--va-radius-md)',
            overflow: 'hidden',
            transform: isHovered ? 'scale(1.05) translateX(-4px)' : 'scale(1)',
            transition: 'transform 0.16s cubic-bezier(0.175, 0.885, 0.32, 1.275), border-color 0.16s ease, background 0.16s ease',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: isHovered ? 'var(--va-text)' : 'var(--va-text-dim)',
              textTransform: 'uppercase',
            }}
          >
            {opt.label}
          </span>
          <span style={{ fontSize: 9, color: 'var(--va-text-faint)', marginTop: 2 }}>{opt.hint}</span>

          {progress > 0 && (
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                height: 2,
                width: `${progress * 100}%`,
                background: 'var(--va-tone-active)',
                boxShadow: '0 0 8px var(--va-tone-active)',
              }}
            />
          )}
        </div>
      );
    })}
  </div>
);

export default MenuDock;
