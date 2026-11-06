/** Adapted from React Bits Shape Magic SVG export; see third-party/react-bits/LICENSE.md. */
export const cloudMorphTiming = (hold: number, duration: number) => {
  const total = (hold + duration) * 2;
  return {
    dur: `${total}s`,
    keyTimes: [0, hold, hold + duration, hold * 2 + duration, total]
      .map((time) => Math.round(time / total * 10000) / 10000).join(';'),
    keySplines: ['0 0 1 1', '0.45 0 0.55 1', '0 0 1 1', '0.45 0 0.55 1'].join(';'),
  };
};
