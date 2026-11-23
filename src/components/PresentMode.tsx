import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Download, Pause, Play, X } from 'lucide-react';

export type PresentSlide = { kind: 'problem' | 'idea' | 'step' | 'result' | 'comparison'; title: string; text: string; stepIndex?: number };
type Props = { slides: PresentSlide[]; children: ReactNode; speed: number; setSpeed: (speed: number) => void; onStepChange: (index: number) => void; onClose: () => void; onExport: () => void };

export function PresentMode({ slides, children, speed, setSpeed, onStepChange, onClose, onExport }: Props) {
  const [index, setIndex] = useState(0); const [playing, setPlaying] = useState(false);
  useEffect(() => { if (!playing) return; const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false; const timer = window.setTimeout(() => setIndex(i => (i + 1) % slides.length), reduced ? 4000 : 3200 / speed); return () => window.clearTimeout(timer); }, [playing, speed, slides.length, index]);
  useEffect(() => { const slide = slides[index]; if (slide?.stepIndex !== undefined) onStepChange(slide.stepIndex); }, [index, slides, onStepChange]);
  useEffect(() => { setIndex(0); setPlaying(false); }, [slides.length]);
  useEffect(() => { const onKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); }
    else if (event.key === 'ArrowRight') { event.preventDefault(); setIndex(i => Math.min(slides.length - 1, i + 1)); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); setIndex(i => Math.max(0, i - 1)); }
    else if (event.code === 'Space') { event.preventDefault(); setPlaying(value => !value); }
  }; window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey); }, [slides.length, onClose]);
  const slide = slides[index];
  return <div className="present present-story" role="dialog" aria-modal="true" aria-label="MiniOS presentation">
    <div className="present-story-head"><span className="kicker">MINIOS / PRESENTATION</span><button className="present-close" type="button" onClick={onClose}><X size={16}/> Exit <kbd>Esc</kbd></button></div>
    <AnimatePresence mode="wait"><motion.article key={`${index}-${slide?.kind}`} className="present-slide" initial={{opacity:0,x:14,filter:'blur(2px)'}} animate={{opacity:1,x:0,filter:'blur(0px)'}} exit={{opacity:0,x:-10,filter:'blur(2px)'}} transition={{duration:.38,ease:[.22,1,.36,1]}}>
      <div className="present-slide-copy"><span className="kicker">{slide?.kind === 'step' ? `STEP ${String(slide.stepIndex! + 1).padStart(2,'0')}` : slide?.kind?.toUpperCase()}</span><h1>{slide?.title}</h1><p>{slide?.text}</p></div>
      <div className="present-slide-visual">{children}</div>
    </motion.article></AnimatePresence>
    <div className="present-story-footer">
      <div className="present-dots" aria-label="Presentation progress">{slides.map((item, i) => <button key={`${item.kind}-${i}`} type="button" className={i === index ? 'active' : ''} aria-label={`Go to slide ${i+1}: ${item.title}`} onClick={() => setIndex(i)}/>)}</div>
      <span className="present-counter">{String(index+1).padStart(2,'0')} / {String(slides.length).padStart(2,'0')}</span>
      <div className="button-row present-actions"><button type="button" onClick={onExport}><Download size={14}/> Export PNG</button><button type="button" onClick={() => setPlaying(v => !v)}>{playing ? <Pause size={14}/> : <Play size={14}/>} {playing ? 'Pause' : 'Auto-play'}</button><label className="present-speed">SPEED <select aria-label="Presentation speed" value={speed} onChange={event => setSpeed(Number(event.target.value))}>{[0.5,1,2,4].map(v => <option key={v} value={v}>{v}×</option>)}</select></label><button type="button" onClick={() => setIndex(i => Math.max(0,i-1))}><ArrowLeft size={14}/> Previous</button><button type="button" onClick={() => setIndex(i => Math.min(slides.length-1,i+1))}>Next <ArrowRight size={14}/></button></div>
    </div>
  </div>;
}
