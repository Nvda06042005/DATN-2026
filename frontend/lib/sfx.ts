/** Sound Lab Breeze exports, cached and played quietly after an explicit user gesture. */
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { readHomeSound, saveHomeSound } from '@/lib/storage';

const WEB = Platform.OS === 'web' && typeof window !== 'undefined';
const COOLDOWN_MS = 900;
const SOURCES = {
  up: require('../assets/sounds/cloud-breeze-up.mp3'),
  down: require('../assets/sounds/cloud-breeze-down.mp3'),
};
const buffers = new Map<string, Promise<AudioBuffer>>();
const active = new Set<AudioBufferSourceNode>();
const listeners = new Set<() => void>();
let context: AudioContext | null = null;
let master: GainNode | null = null;
let unlocked = false;
let last = -Infinity;
let on = readHomeSound() ?? true;

const emit = () => listeners.forEach((listener) => listener());
const stopAll = () => {
  active.forEach((source) => { try { source.stop(); } catch { /* already ended */ } });
  active.clear();
};

const load = (direction: 'up' | 'down') => {
  const audio = context!;
  let pending = buffers.get(direction);
  if (!pending) {
    // Static bundled audio, not an application API request.
    pending = fetch(SOURCES[direction])
      .then((response) => {
        if (!response.ok) throw new Error('Cloud audio unavailable');
        return response.arrayBuffer();
      })
      .then((data) => audio.decodeAudioData(data))
      .catch((error: unknown) => { buffers.delete(direction); throw error; });
    buffers.set(direction, pending);
  }
  return pending;
};

const start = () => {
  if (!WEB || !on) return;
  const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return;
  if (!context) {
    try {
      context = new Audio();
      master = context.createGain();
      master.gain.value = 0.6;
      master.connect(context.destination);
    } catch { context = null; master = null; return; }
  }
  void context.resume().catch(() => undefined);
  (['up', 'down'] as const).forEach((direction) => { void load(direction).catch(() => undefined); });
};

if (WEB) {
  const unlock = () => {
    unlocked = true;
    start();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') stopAll();
  });
  document.addEventListener('play', (event) => {
    if (event.target instanceof HTMLVideoElement && !event.target.muted) stopAll();
  }, true);
}

const canPlay = () => WEB && on && unlocked && context?.state === 'running'
  && document.visibilityState === 'visible'
  && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  && !Array.from(document.querySelectorAll('video')).some((video) => !video.muted && !video.paused);

/** Returns a cancellation function, including while a bundled clip is still loading. */
export const playCloudBreeze = ({ direction = 'up', variant = 0 }: {
  direction?: 'up' | 'down';
  variant?: 0 | 1 | 2;
} = {}): (() => void) => {
  let cancelled = false;
  let source: AudioBufferSourceNode | null = null;
  const cancel = () => {
    cancelled = true;
    try { source?.stop(); } catch { /* already ended */ }
  };
  if (!canPlay() || performance.now() - last < COOLDOWN_MS) return cancel;
  last = performance.now();
  void load(direction).then((buffer) => {
    if (cancelled || !canPlay() || !context || !master) return;
    source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = [1.06, 1, 0.94][variant];
    source.connect(master);
    active.add(source);
    const current = source;
    source.onended = () => { active.delete(current); current.disconnect(); };
    source.start();
  }).catch(() => undefined);
  return cancel;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

/** The header speaker keeps its saved choice and stops active effects immediately when muted. */
export const useSound = (): [boolean, () => void] => {
  const value = useSyncExternalStore(subscribe, () => on, () => on);
  const toggle = () => {
    on = !on;
    saveHomeSound(on);
    if (!on) stopAll();
    emit();
    if (on) {
      unlocked = true;
      start();
      if (context) void load('up').then(() => { playCloudBreeze(); }).catch(() => undefined);
    }
  };
  return [value, toggle];
};
