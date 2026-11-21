/** Pure playback clock: hidden tabs do not consume narration time; the last scene always stops. */
export interface AtlasPlayback { index: number; elapsed: number; playing: boolean }
export function advanceAtlas(state: AtlasPlayback, seconds: number, durations: readonly number[]): AtlasPlayback {
  if (!state.playing || !durations.length || !Number.isFinite(seconds) || seconds <= 0) return state;
  const index = Math.max(0,Math.min(durations.length-1,state.index)), duration=durations[index];
  if (duration<=0) return {...state,index,playing:false};
  const elapsed=state.elapsed+Math.min(seconds,0.25);
  if (elapsed<duration) return {...state,index,elapsed};
  return index>=durations.length-1 ? {index,elapsed:duration,playing:false} : {index:index+1,elapsed:0,playing:durations[index+1]>0};
}
