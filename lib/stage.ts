/**
 * Shared, mutable link between the page (scroll, the light switch) and the
 * 3D scene, which reads it every frame without going through React state.
 */
export const stage = {
  /** 0 at the street outside, 1 on the dance floor. */
  progress: 0,
  /** 0 while the lights are off, 1 once switched on. */
  power: 0,
};
