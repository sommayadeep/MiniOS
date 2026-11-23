import { ArrowLeft, ArrowRight, Pause, Play, RotateCcw } from 'lucide-react';
import type { ChangeEvent } from 'react';

type Props = {
  index: number; count: number; playing: boolean; speed: number;
  onPlay: () => void; onPause: () => void; onBack: () => void; onForward: () => void;
  onReplay: () => void; onScrub: (index: number) => void; onSpeed: (speed: number) => void;
};

export function PlaybackBar({ index, count, playing, speed, onPlay, onPause, onBack, onForward, onReplay, onScrub, onSpeed }: Props) {
  const scrub = (event: ChangeEvent<HTMLInputElement>) => onScrub(Number(event.target.value));
  return <div className="visual-playback" aria-label="Simulation playback controls">
    <div className="button-row visual-playback-buttons">
      <button type="button" onClick={onReplay} title="Replay from the first step" aria-label="Replay"><RotateCcw size={14}/></button>
      <button type="button" onClick={onBack} disabled={index <= 0} title="Step back" aria-label="Step back"><ArrowLeft size={14}/></button>
      <button type="button" className="primary" onClick={playing ? onPause : onPlay} title={playing ? 'Pause playback' : 'Play timeline'} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={14}/> : <Play size={14}/>}</button>
      <button type="button" onClick={onForward} disabled={index >= count - 1} title="Step forward" aria-label="Step forward"><ArrowRight size={14}/></button>
    </div>
    <label className="visual-speed">SPEED <select aria-label="Playback speed" value={speed} onChange={event => onSpeed(Number(event.target.value))}>{[0.5,1,2,4].map(value => <option value={value} key={value}>{value}×</option>)}</select></label>
    <input className="visual-scrubber" aria-label="Scrub simulation timeline" type="range" min={0} max={Math.max(0,count-1)} value={index} onChange={scrub}/>
    <span className="visual-step-count">{String(index+1).padStart(2,'0')} / {String(count).padStart(2,'0')}</span>
  </div>;
}
