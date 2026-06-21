// utils/gestures.js
// Pure predicates that classify a hand's *shape* from its 21 landmarks.
// None of these touch timers, refs, or React state — they answer one
// question each ("is this a fist?") so the orchestration logic in
// useGestureEngine stays readable.

import { distance } from './math';
import { PINCH_THRESHOLD } from '../constants';

const curled = (hand, tipIdx, pipIdx) => hand[tipIdx].y > hand[pipIdx].y;
const extended = (hand, tipIdx, pipIdx) => hand[tipIdx].y < hand[pipIdx].y;

export const isFist = (hand) =>
  curled(hand, 8, 6) && curled(hand, 12, 10) && curled(hand, 16, 14) && curled(hand, 20, 18);

export const isFistWithThumb = (hand) => isFist(hand) && distance(hand[4], hand[12]) < 0.1;

export const isPalmOpen = (hand) =>
  extended(hand, 8, 6) && extended(hand, 12, 10) && extended(hand, 20, 18);

export const isPeaceSign = (hand) =>
  extended(hand, 8, 6) && extended(hand, 12, 10) && curled(hand, 16, 14) && curled(hand, 20, 18);

export const isPointing = (hand) => hand[8].y < hand[6].y && hand[12].y > hand[10].y;

export const isPinching = (hand) => distance(hand[4], hand[8]) < PINCH_THRESHOLD;

export const isThumbDown = (hand) =>
  hand[4].y > hand[3].y && hand[4].y > hand[17].y && isFist(hand);

export const isThumbUp = (hand) =>
  hand[4].y < hand[3].y && hand[4].y < hand[5].y && isFist(hand);

/**
 * True when the thumb is folded in across the palm rather than extended
 * up or down. isThumbDown/isThumbUp are near mutually-exhaustive once
 * isFist is true (a folded thumb's tip is always slightly above or below
 * its own IP joint), so "fist AND NOT thumbDown AND NOT thumbUp" almost
 * never holds for a real hand — the grab gesture needs this dedicated
 * tucked-thumb check instead of trying to detect a thumb "doing nothing".
 */
export const isThumbTucked = (hand) => distance(hand[4], hand[12]) < 0.12;

/** A true closed fist for grab: all fingers curled AND thumb tucked in. */
export const isClosedFist = (hand) => isFist(hand) && isThumbTucked(hand);

/**
 * Determines anatomical handedness (Left/Right) from raw camera-mirrored
 * landmarks via the cross product of wrist->index and wrist->pinky.
 * MediaPipe's own handedness label is unreliable when hands cross or
 * partially leave frame, so we re-derive it geometrically every frame.
 */
export const resolvePhysicalHandedness = (landmarks) => {
  const v1 = { x: landmarks[5].x - landmarks[0].x, y: landmarks[5].y - landmarks[0].y };
  const v2 = { x: landmarks[17].x - landmarks[0].x, y: landmarks[17].y - landmarks[0].y };
  const cross = v1.x * v2.y - v1.y * v2.x;
  return cross < -0.01 ? 'Left' : 'Right';
};