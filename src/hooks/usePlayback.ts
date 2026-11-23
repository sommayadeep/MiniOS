import { useCallback, useEffect, useState } from 'react';
import type { SimStep } from '../engine/types';

export function usePlayback(steps: SimStep[], initialSpeed = 1) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(initialSpeed);
  useEffect(() => { setIndex(0); setPlaying(false); }, [steps]);
  useEffect(() => {
    if (!playing || steps.length < 2) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const timer = window.setTimeout(() => {
      if (index >= steps.length - 1) setPlaying(false);
      else setIndex(index + 1);
    }, reduced ? 900 : 900 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, steps.length]);
  const play = useCallback(() => { if (index >= steps.length - 1) setIndex(0); setPlaying(true); }, [index, steps.length]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying(value => !value), []);
  const forward = useCallback(() => { setPlaying(false); setIndex(value => Math.min(steps.length - 1, value + 1)); }, [steps.length]);
  const back = useCallback(() => { setPlaying(false); setIndex(value => Math.max(0, value - 1)); }, []);
  const replay = useCallback(() => { setPlaying(false); setIndex(0); }, []);
  const scrub = useCallback((value: number) => { setPlaying(false); setIndex(Math.max(0, Math.min(steps.length - 1, value))); }, [steps.length]);
  return { index, step: steps[index], playing, speed, setSpeed, play, pause, toggle, forward, back, replay, scrub, count: steps.length };
}
