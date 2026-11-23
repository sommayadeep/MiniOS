import { lazy, Suspense, useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Workflow, ChartNoAxesColumnIncreasing, Info } from 'lucide-react';
import type { Process, SimStep } from '../engine/types';
import { createBankerSteps, createDiskSteps, createMemorySteps, createPageSteps, createProcessSteps, createProducerSteps, parseMemoryOutput, scheduleCpu, type CpuAlgorithm, type CpuSchedule, type DiskAlgorithm, type MemoryBlock, type PageAlgorithm } from '../engine/visualization';
import { usePlayback } from '../hooks/usePlayback';
import { PlaybackBar } from './PlaybackBar';
import { PresentMode, type PresentSlide } from './PresentMode';

const FlowMap = lazy(() => import('./FlowMap').then(module => ({ default: module.FlowMap })));

export type SimulationModule = 'process' | 'cpu' | 'memory' | 'sync' | 'paging' | 'disk';
export type InputSnapshot = Record<string, string>;
type Props = { module: SimulationModule; processes: Process[]; inputs: InputSnapshot; commandText: string; output: string; memoryBefore: MemoryBlock[]; memoryAfter: MemoryBlock[]; present: boolean; onClosePresent: () => void };

const colors = ['--signal', '--green', '--amber', '--red', '--muted'];
export const processColor = (name: string) => `var(${colors[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % colors.length]})`;
const number = (value: string | undefined, fallback: number) => Number.isFinite(Number(value)) && Number(value) ? Number(value) : fallback;
const list = (value: string | undefined) => (value ?? '').split(/[\s,]+/).map(Number).filter(Number.isFinite);
const stateOf = (step?: SimStep) => (step?.state ?? {}) as Record<string, unknown>;

function useModuleModel(module: SimulationModule, processes: Process[], inputs: InputSnapshot, commandText: string, memoryBefore: MemoryBlock[], memoryAfter: MemoryBlock[]) {
  const words = commandText.trim().split(/\s+/); const verb = words[0] ?? '';
  const cpuAlgorithm: CpuAlgorithm = words[1] === 'sjf' || words[1] === 'priority' || words[1] === 'rr' || words[1] === 'mlfq' ? words[1] : 'fcfs';
  const pageAlgorithm: PageAlgorithm = words[1] === 'lru' || words[1] === 'optimal' ? words[1] : 'fifo';
  const diskAlgorithm: DiskAlgorithm = words[1] === 'sstf' || words[1] === 'scan' || words[1] === 'cscan' ? words[1] : 'fcfs';
  const refs = useMemo(() => list(inputs.refs || '7,0,1,2,0,3,0,4,2,3,0,3'), [inputs.refs]);
  const pagesCount = number(inputs.frames, 3);
  const head = number(inputs.head, 53); const requests = useMemo(() => list(inputs.requests || '98,183,37,122,14,124,65,67'), [inputs.requests]);
  const size = number(inputs.memsize, 128); const memName = inputs.memname || 'P1'; const policy = inputs.policy || 'ff';
  const selectedSchedule = useMemo(() => scheduleCpu(processes, cpuAlgorithm, number(inputs.quantum, 2)), [processes, cpuAlgorithm, inputs.quantum]);
  const cpuComparison = useMemo(() => (['fcfs','sjf','rr','priority','mlfq'] as CpuAlgorithm[]).map(algo => ({ algorithm: algo.toUpperCase(), ...scheduleCpu(processes, algo, number(inputs.quantum, 2)) })), [processes, inputs.quantum]);
  const pageComparison = useMemo(() => (['fifo','lru','optimal'] as PageAlgorithm[]).map(algo => ({ algorithm: algo.toUpperCase(), steps: createPageSteps(refs, pagesCount, algo) })), [refs, pagesCount]);
  const diskComparison = useMemo(() => (['fcfs','sstf','scan','cscan'] as DiskAlgorithm[]).map(algo => ({ algorithm: algo.toUpperCase(), steps: createDiskSteps(head, requests, algo) })), [head, requests]);
  const steps = useMemo(() => {
    if (module === 'process') return createProcessSteps(processes);
    if (module === 'cpu') return selectedSchedule.steps;
    if (module === 'memory') return createMemorySteps(memoryBefore, memoryAfter, commandText || 'mem_status', { name: memName, size, policy });
    if (module === 'sync') return verb === 'bankers' ? createBankerSteps() : createProducerSteps();
    if (module === 'paging') return createPageSteps(refs, pagesCount, pageAlgorithm);
    return createDiskSteps(head, requests, diskAlgorithm);
  }, [module, processes, selectedSchedule, memoryBefore, memoryAfter, commandText, memName, size, policy, verb, refs, pagesCount, pageAlgorithm, head, requests, diskAlgorithm]);
  return { steps, cpuAlgorithm, selectedSchedule, cpuComparison, pageComparison, diskComparison, refs, pagesCount, head, requests, pageAlgorithm, diskAlgorithm, verb, memoryBefore: memoryBefore.length ? memoryBefore : parseMemoryOutput(''), memoryAfter };
}

function LifecycleGraphic({ state, processes }: { state: Record<string, unknown>; processes: Process[] }) {
  const rows = (state.states as Array<{pid:number;name:string;state:string}> | undefined) ?? [];
  const ready = (state.readyQueue as string[] | undefined) ?? [];
  const active = state.active as string | null;
  const stages = ['NEW','READY','RUNNING','WAITING','TERMINATED'];
  const current = rows.find(row => row.name === active)?.state ?? rows[0]?.state ?? 'NEW';
  return <div className="visual-graphic-stack">
    <svg data-export-visual="true" viewBox="0 0 720 220" role="img" aria-label="Process lifecycle from New through Terminated" className="visual-svg">
      <defs><marker id="process-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="var(--faint)"/></marker></defs>
      {stages.map((label, i) => { const x = 18 + i * 141; const isCurrent = label === current; return <g key={label}>
        {i < stages.length - 1 && <motion.path d={`M ${x+116} 70 H ${x+138}`} stroke="var(--edge)" strokeWidth="2" markerEnd="url(#process-arrow)" strokeDasharray="22" initial={{strokeDashoffset:22}} animate={{strokeDashoffset:isCurrent?0:0}} transition={{duration:.55,ease:[.22,1,.36,1]}}/>}
        <motion.rect x={x} y="48" width="116" height="46" rx="10" fill="var(--panel)" stroke={isCurrent?'var(--signal)':'var(--edge)'} strokeWidth={isCurrent?2:1} animate={{scale:isCurrent?1.035:1,opacity:isCurrent?1:.84}} transition={{duration:.42,ease:[.22,1,.36,1]}}/>
        <text x={x+58} y="76" textAnchor="middle" fill={isCurrent?'var(--signal)':'var(--muted)'} className="visual-svg-label">{label}</text>
      </g>; })}
      {rows.slice(0,5).map((row,i) => { const stageIndex = stages.indexOf(row.state); return <motion.circle key={row.pid} r="6" fill={processColor(row.name)} initial={{opacity:0}} animate={{opacity:1,x:22+stageIndex*141+Math.min(90,i*14),y:126+(i%2)*20}} transition={{duration:.62,ease:[.22,1,.36,1]}}><title>{row.name} · {row.state}</title></motion.circle>; })}
      <text x="18" y="190" className="visual-svg-mono">PROCESS TOKENS</text>
      <text x="702" y="190" textAnchor="end" className="visual-svg-mono">{processes.length} TOTAL</text>
    </svg>
    <div className="visual-ready-lane"><span className="kicker">READY QUEUE</span>{ready.length ? ready.map((name,i)=><span className="visual-token" style={{color:processColor(name)}} key={`${name}-${i}`}>{name}</span>) : <span className="visual-note">Queue is empty at this step</span>}</div>
  </div>;
}

function GanttGraphic({ schedule, visibleSlices, algorithm }: { schedule: CpuSchedule; visibleSlices: CpuSchedule['slices']; algorithm: CpuAlgorithm }) {
  const total = Math.max(1, visibleSlices.at(-1)?.end ?? 1); const left = 22; const chartWidth = 676; const scale = chartWidth / total;
  const multilevel = algorithm === 'mlfq';
  return <div className="visual-graphic-stack">
    <svg data-export-visual="true" viewBox={`0 0 720 ${multilevel?258:196}`} role="img" aria-label="Animated CPU Gantt chart" className="visual-svg">
      <text x="20" y="22" className="visual-svg-mono">TIME 0 — {total}</text>
      {multilevel&&[0,1,2].map(level=><g key={`queue-${level}`}><text x="20" y={66+level*55} className="visual-svg-mono">Q{level}</text><line x1={left} y1={74+level*55} x2="698" y2={74+level*55} stroke="var(--edge)" strokeWidth="1" strokeDasharray="3 4"/></g>)}
      {visibleSlices.map((slice,i)=> { const x=left+slice.start*scale; const width=Math.max(3,(slice.end-slice.start)*scale-2); const y=multilevel?42+(slice.queue??0)*55:50; const height=multilevel?32:44; const context=i>0&&visibleSlices[i-1].pid!==slice.pid; return <g key={`${slice.pid}-${i}`}>
        {context&&<line x1={x} y1="38" x2={x} y2={multilevel?210:112} stroke="var(--edge)" strokeWidth="1" strokeDasharray="3 4"><title>Context switch</title></line>}
        <motion.rect x={x} y={y} width={width} height={height} rx="8" fill={slice.pid < 0?'var(--panel2)':processColor(slice.name)} stroke="var(--edge)" initial={{opacity:0,scaleX:.96}} animate={{opacity:1,scaleX:1}} transition={{duration:.52,ease:[.22,1,.36,1]}}><title>{slice.name}: {slice.start}–{slice.end}{multilevel?` · queue ${slice.queue}`:''}</title></motion.rect>
        {width>28&&<text x={x+width/2} y={y+height/2+4} textAnchor="middle" fill="var(--text)" className="visual-svg-label">{slice.name}</text>}
        <text x={x} y={multilevel?222:116} className="visual-svg-mono">{slice.start}</text>
      </g>; })}
      <text x={left+Math.min(chartWidth,total*scale)} y={multilevel?222:116} textAnchor="end" className="visual-svg-mono">{visibleSlices.at(-1)?.end ?? 0}</text>
      {!multilevel&&<text x="20" y="151" className="visual-svg-mono">READY LANE</text>}
      {schedule.steps.find((_,i)=>i===Math.min(schedule.steps.length-1, Math.max(0,visibleSlices.length)))?.state && (()=>{
        const index = Math.min(schedule.steps.length-1, Math.max(0,visibleSlices.length)); const queue = (schedule.steps[index]?.state.readyQueue as string[] | undefined) ?? [];
        return queue.slice(0,8).map((name,i)=><g key={`${name}-${i}`}><rect x={126+i*70} y="132" width="60" height="28" rx="8" fill="var(--panel)" stroke="var(--edge)"/><text x={156+i*70} y="151" textAnchor="middle" fill={processColor(name)} className="visual-svg-label">{name}</text></g>);
      })()}
      {multilevel&&<text x="22" y="248" className="visual-svg-mono">Q0 · RR 1     Q1 · RR 2     Q2 · FCFS</text>}
    </svg>
    <div className="visual-ready-lane"><span className="kicker">CPU STATE</span><span className="visual-note">{visibleSlices.length} of {schedule.slices.length} slices shown</span><span className="visual-note">Avg wait {schedule.averageWaiting.toFixed(2)}</span></div>
  </div>;
}

function MemoryGraphic({ state }: { state: Record<string, unknown> }) {
  const blocks = (state.blocks as MemoryBlock[] | undefined) ?? [{offset:0,size:1024,name:'',allocated:false}]; const candidates = (state.candidates as number[] | undefined) ?? []; const selected = state.selected as number | null;
  return <div className="visual-graphic-stack"><svg data-export-visual="true" viewBox="0 0 720 150" role="img" aria-label="1024 megabyte memory arena" className="visual-svg">
    <text x="20" y="22" className="visual-svg-mono">MEMORY ARENA · 1024 MB</text>
    {blocks.map((block,i)=>{const x=20+block.offset/1024*680;const width=Math.max(1,block.size/1024*680);const active=selected===i;return <g key={`${block.offset}-${i}`}><motion.rect x={x} y="48" width={width} height="48" rx="8" fill={block.allocated?'var(--signal)':'var(--panel)'} stroke={active?'var(--signal)':'var(--edge)'} strokeWidth={active?3:1} initial={{opacity:.55,scaleX:.985}} animate={{opacity:1,scaleX:1}} transition={{duration:.48,ease:[.22,1,.36,1]}}><title>{`${block.allocated?block.name:'Free'} · address ${block.offset} MB · ${block.size} MB`}</title></motion.rect>{width>52&&<text x={x+width/2} y="76" textAnchor="middle" fill={block.allocated?'var(--text)':'var(--muted)'} className="visual-svg-label">{block.allocated?`${block.name} · ${block.size} MB`:`${block.size} MB free`}</text>}{candidates.includes(i)&&<text x={x+width/2} y="119" textAnchor="middle" className="visual-svg-mono">CANDIDATE</text>}</g>;})}
    <text x="20" y="142" className="visual-svg-mono">0 MB</text><text x="700" y="142" textAnchor="end" className="visual-svg-mono">1024 MB</text>
  </svg><div className="visual-ready-lane"><span className="kicker">EXTERNAL FRAGMENTATION</span><span className="visual-note">{Number(state.fragmentation ?? 0)}%</span><span className="visual-note">Hover a segment for address and size</span></div></div>;
}

function PageGraphic({ state, refs }: { state: Record<string, unknown>; refs: number[] }) {
  const frames = (state.frames as number[] | undefined) ?? [-1,-1,-1]; const index = Number(state.index ?? -1); const current = state.reference as number | undefined;
  return <div className="visual-graphic-stack"><svg data-export-visual="true" viewBox="0 0 720 200" role="img" aria-label="Page references and frame table" className="visual-svg">
    <text x="20" y="23" className="visual-svg-mono">REFERENCE STRING</text>
    {refs.slice(0,15).map((page,i)=><g key={`${page}-${i}`}><rect x={20+i*44} y="40" width="36" height="30" rx="8" fill={i===index?'var(--signal)':'var(--panel)'} stroke="var(--edge)"/><text x={38+i*44} y="60" textAnchor="middle" fill="var(--text)" className="visual-svg-label">{page}</text>{i===index&&<motion.circle cx={38+i*44} cy="32" r="4" fill="var(--signal)" initial={{opacity:0}} animate={{opacity:1}}/>}</g>)}
    <text x="20" y="103" className="visual-svg-mono">FRAME TABLE</text>
    {frames.map((page,i)=>{const slot=680/frames.length;const width=Math.max(18,slot-8);const x=20+i*slot+(slot-width)/2;return <g key={`frame-${i}`}><rect x={x} y="120" width={width} height="48" rx="8" fill="var(--panel)" stroke="var(--edge)"/>{page===current&&<motion.rect x={x} y="120" width={width} height="48" rx="8" fill="var(--signal)" fillOpacity=".16" stroke="var(--signal)" strokeWidth="2" initial={{opacity:0}} animate={{opacity:1}} transition={{duration:.42,ease:[.22,1,.36,1]}}/>}<text x={x+width/2} y="149" textAnchor="middle" fill="var(--text)" className="visual-svg-label">{page<0?'EMPTY':page}</text></g>})}
  </svg><div className="visual-ready-lane"><span className="kicker">{state.evicted === null || state.evicted === undefined ? 'PAGE STATUS' : `EVICTED ${state.evicted}`}</span><span className="visual-note">{Number(state.faults ?? 0)} faults</span><span className="visual-note">{(Number(state.hitRatio ?? 0)*100).toFixed(1)}% hit ratio</span></div></div>;
}

function DiskGraphic({ state }: { state: Record<string, unknown> }) {
  const order = (state.order as number[] | undefined) ?? [53]; const points = order.map((c,i)=>`${34+c/199*650},${40+i*34}`).join(' '); const current=Number(state.current ?? 53);
  return <div className="visual-graphic-stack"><svg data-export-visual="true" viewBox={`0 0 720 ${Math.max(170,order.length*34+62)}`} role="img" aria-label="Disk head movement" className="visual-svg">
    <text x="20" y="20" className="visual-svg-mono">CYLINDER 0 — 199</text><line x1="34" y1="40" x2="684" y2="40" stroke="var(--edge)" strokeWidth="1"/>
    <polyline points={points} fill="none" stroke="var(--signal)" strokeWidth="2" strokeDasharray="1200" strokeDashoffset="0" style={{transition:'stroke-dashoffset .7s cubic-bezier(.22,1,.36,1)'}}/>
    {order.map((c,i)=><g key={`${c}-${i}`}><circle cx={34+c/199*650} cy={40+i*34} r={i===order.length-1?4:3} fill="var(--panel)" stroke="var(--signal)" strokeWidth="1.5"><title>Request at cylinder {c}</title></circle><text x={Math.min(684,38+c/199*650)} y={44+i*34} className="visual-svg-mono">{c}</text></g>)}
    <motion.circle cx={34+current/199*650} cy={40+(order.length-1)*34} r="7" fill="var(--signal)" stroke="var(--panel)" strokeWidth="2" initial={false} animate={{cx:34+current/199*650,cy:40+(order.length-1)*34}} transition={{duration:.68,ease:[.22,1,.36,1]}}><title>Current disk head: cylinder {current}</title></motion.circle>
  </svg><div className="visual-ready-lane"><span className="kicker">CURRENT HEAD</span><span className="visual-note">Cylinder {current}</span><span className="visual-note">Total seek {Number(state.seek ?? 0)} cylinders</span></div></div>;
}

function SyncGraphic({ module, state }: { module: string; state: Record<string, unknown> }) {
  if (module === 'sync' && Array.isArray(state.need)) {
    const allocation = state.allocation as number[][]; const need = state.need as number[][]; const safe = state.safe as number[];
    return <div className="visual-graphic-stack"><div className="visual-matrix-label"><span className="kicker">NEED = MAX − ALLOCATION</span><span className="visual-note">SAFE ORDER · {safe.length ? safe.map(i=>`P${i}`).join(' → ') : 'checking'}</span></div><table className="visual-matrix"><thead><tr><th>PROCESS</th><th>ALLOCATION</th><th>NEED</th></tr></thead><tbody>{need.map((row,i)=><tr key={i}><th>P{i}</th><td>{allocation[i].join(' · ')}</td><td>{row.join(' · ')}</td></tr>)}</tbody></table><svg data-export-visual="true" viewBox="0 0 720 92" role="img" aria-label="Banker's safe sequence" className="visual-svg visual-safe-sequence">{safe.map((p,i)=><g key={p}><rect x={20+i*132} y="18" width="110" height="46" rx="10" fill="var(--panel)" stroke="var(--edge)"/><text x={75+i*132} y="46" textAnchor="middle" fill="var(--signal)" className="visual-svg-label">P{p} can finish</text></g>)}</svg><div className="visual-ready-lane"><span className="kicker">{state.safeState === false ? 'UNSAFE' : safe.length===5 ? 'SAFE' : 'SAFETY CHECK'}</span><span className="visual-note">Available work: {(state.work as number[] ?? []).join(' · ')}</span></div></div>;
  }
  const buffer = (state.buffer as number[] | undefined) ?? [0,0,0,0,0];
  return <div className="visual-graphic-stack"><svg data-export-visual="true" viewBox="0 0 720 190" role="img" aria-label="Producer, bounded buffer and consumer" className="visual-svg">
    <defs><marker id="sync-arrow" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto"><path d="M0 0 L7 3.5 L0 7" fill="var(--faint)"/></marker></defs>
    <rect x="22" y="60" width="138" height="54" rx="10" fill="var(--panel)" stroke="var(--edge)"/><text x="91" y="92" textAnchor="middle" className="visual-svg-label" fill="var(--text)">PRODUCER</text>
    <line x1="160" y1="87" x2="218" y2="87" stroke="var(--signal)" strokeWidth="2" markerEnd="url(#sync-arrow)" strokeDasharray="58"/>
    <text x="360" y="24" textAnchor="middle" className="visual-svg-mono">BOUNDED BUFFER · 5 SLOTS</text>
    {buffer.map((value,i)=><g key={i}><motion.rect x={224+i*54} y="62" width="44" height="48" rx="8" fill={value?'var(--signal)':'var(--panel)'} stroke="var(--edge)" initial={{opacity:.65,scale:.97}} animate={{opacity:1,scale:1}} transition={{duration:.4,ease:[.22,1,.36,1]}}/><text x={246+i*54} y="91" textAnchor="middle" className="visual-svg-label" fill="var(--text)">{value||'—'}</text></g>)}
    <line x1="500" y1="87" x2="558" y2="87" stroke="var(--signal)" strokeWidth="2" markerEnd="url(#sync-arrow)" strokeDasharray="58"/>
    <rect x="560" y="60" width="138" height="54" rx="10" fill="var(--panel)" stroke="var(--edge)"/><text x="629" y="92" textAnchor="middle" className="visual-svg-label" fill="var(--text)">CONSUMER</text>
  </svg><div className="visual-ready-lane"><span className="kicker">SEMAPHORES</span><span className="visual-note">empty {Number(state.empty ?? 5)}</span><span className="visual-note">full {Number(state.full ?? 0)}</span><span className="visual-note">mutex {Number(state.mutex ?? 1)}</span><span className="visual-note">{state.blocked?'BLOCKED':'RUNNING'}</span></div></div>;
}

function ComparisonTable({ rows, metric }: { rows: Array<{algorithm:string;value:number;detail?:string}>; metric: string }) {
  const best = Math.min(...rows.map(row => row.value));
  return <table className="visual-matrix"><thead><tr><th>ALGORITHM</th><th>{metric}</th><th>RESULT</th></tr></thead><tbody>{rows.map(row=><tr key={row.algorithm} className={row.value===best?'visual-best':''}><th>{row.algorithm}</th><td>{row.value.toFixed(metric==='FAULTS'||metric==='SEEK' ? 0 : 2)}</td><td>{row.detail ?? (row.value===best?'Best result':'—')}</td></tr>)}</tbody></table>;
}

function Graphic({ module, state, processes, cpu, refs, algorithm }: { module: SimulationModule; state: Record<string, unknown>; processes: Process[]; cpu: CpuSchedule; refs: number[]; algorithm: CpuAlgorithm }) {
  if (module === 'process') return <LifecycleGraphic state={state} processes={processes}/>;
  if (module === 'cpu') return <GanttGraphic schedule={cpu} visibleSlices={(state.slices as CpuSchedule['slices'] | undefined) ?? []} algorithm={algorithm}/>;
  if (module === 'memory') return <MemoryGraphic state={state}/>;
  if (module === 'paging') return <PageGraphic state={state} refs={refs}/>;
  if (module === 'disk') return <DiskGraphic state={state}/>;
  return <SyncGraphic module={module} state={state}/>;
}

export function SimulationVisualization({ module, processes, inputs, commandText, output, memoryBefore, memoryAfter, present, onClosePresent }: Props) {
  const model = useModuleModel(module, processes, inputs, commandText, memoryBefore, memoryAfter);
  const words = commandText.trim().split(/\s+/); const verb = words[0] ?? '';
  const playback = usePlayback(model.steps);
  const [flowView, setFlowView] = useState(false);
  const reduced = useReducedMotion();
  const state = stateOf(playback.step);
  const processNames = processes.map(p=>p.name);
  const currentCpu = model.selectedSchedule;
  const cpuComparison = model.cpuComparison.map(item=>({algorithm:item.algorithm,value:item.averageWaiting,detail:`TAT ${item.averageTurnaround.toFixed(2)} · response ${item.averageResponse.toFixed(2)}`}));
  const pageCompareRows = model.pageComparison.map(item=>{const last=stateOf(item.steps.at(-1));return {algorithm:item.algorithm,value:Number(last.faults??0),detail:`Hit ratio ${(Number(last.hitRatio??0)*100).toFixed(1)}%`};});
  const diskCompareRows = model.diskComparison.map(item=>{const last=stateOf(item.steps.at(-1));return {algorithm:item.algorithm,value:Number(last.seek??0),detail:`${(last.order as number[]|undefined)?.length ?? 0} stops`};});
  const isCompare = (module === 'cpu' && verb === 'schedule' && words[1] === 'compare') || (module === 'paging' && verb === 'page' && words[1] === 'compare') || (module === 'disk' && verb === 'disk' && words[1] === 'compare');
  const chart = <Graphic module={module} state={state} processes={processes} cpu={currentCpu} refs={model.refs} algorithm={model.cpuAlgorithm}/>;
  const exportPng = useCallback(async () => {
    const source = document.querySelector<SVGSVGElement>('[data-export-visual="true"]');
    if (!source) return;
    const copy = source.cloneNode(true) as SVGSVGElement;
    const style = getComputedStyle(document.querySelector('.app') ?? document.documentElement);
    copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
    const embeddedStyle=document.createElementNS('http://www.w3.org/2000/svg','style'); embeddedStyle.textContent='.visual-svg-mono{fill:var(--muted);font:10px IBM Plex Mono,monospace;letter-spacing:.04em}.visual-svg-label{font:500 12px Instrument Sans,sans-serif}'; copy.prepend(embeddedStyle);
    copy.setAttribute('style',`--signal:${style.getPropertyValue('--signal')};--green:${style.getPropertyValue('--green')};--amber:${style.getPropertyValue('--amber')};--red:${style.getPropertyValue('--red')};--muted:${style.getPropertyValue('--muted')};--panel:${style.getPropertyValue('--panel')};--panel2:${style.getPropertyValue('--panel2')};--edge:${style.getPropertyValue('--edge')};--text:${style.getPropertyValue('--text')};--faint:${style.getPropertyValue('--faint')};font-family:${style.getPropertyValue('--font-data')}`);
    const view = (copy.getAttribute('viewBox') ?? '0 0 720 220').split(/\s+/).map(Number); const svg = new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}); const url=URL.createObjectURL(svg); const image=new Image();
    image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=view[2]*2;canvas.height=view[3]*2;const context=canvas.getContext('2d');if(context){context.scale(2,2);context.drawImage(image,0,0,view[2],view[3]);canvas.toBlob(blob=>{if(blob){const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`minios-${module}-visual.png`;link.click();URL.revokeObjectURL(link.href);}URL.revokeObjectURL(url);});}else URL.revokeObjectURL(url);}; image.onerror=()=>URL.revokeObjectURL(url); image.src=url;
  },[module]);
  const explanation = playback.step?.why ?? 'Step through the simulation to see why each decision occurs.';
  const slides = useMemo<PresentSlide[]>(()=>[
    {kind:'problem',title:`${module==='cpu'?'CPU scheduling':module==='paging'?'Page replacement':module==='disk'?'Disk scheduling':module==='sync'?'Synchronization':module==='memory'?'Memory allocation':'Process lifecycle'}`,text:`${module==='cpu'?'Decide which ready process should use the CPU next.':module==='paging'?'Keep frequently needed pages available in a limited frame set.':module==='disk'?'Service cylinder requests while limiting head movement.':module==='sync'?'Coordinate shared resources without violating safety.':module==='memory'?'Place allocations into free regions of a fixed memory arena.':'Track how a process moves through the operating system.'}`},
    {kind:'idea',title:'Algorithm idea',text:explanation},
    ...model.steps.map((step,i)=>({kind:'step' as const,title:step.label,text:step.why,stepIndex:i})),
    {kind:'result',title:'Result',text:output || 'No backend result yet. Run the module to see its final output.'},
    ...(isCompare?[{kind:'comparison' as const,title:'Comparison',text:'Compare the algorithms using the same input set and inspect their measured outcomes.'}]:[]),
  ],[module,model.steps,explanation,output,isCompare]);
  const updatePresentStep = useCallback((index:number)=>playback.scrub(index),[playback.scrub]);

  return <>
    <section className="module-card visualization-card" aria-label="Animated simulation visualization">
      <div className="section-head"><div><span className="kicker">STEP-BY-STEP VISUALIZATION</span><h2>{playback.step?.label ?? 'Simulation timeline'}</h2></div><div className="visual-card-actions"><span className="visual-step-why" title={explanation} aria-label={`Why? ${explanation}`}><Info size={14}/> Why?</span><button type="button" onClick={()=>setFlowView(value=>!value)} title={flowView?'Return to the animated chart':'Open movable flowchart'}>{flowView?<ChartNoAxesColumnIncreasing size={14}/>:<Workflow size={14}/>} {flowView?'Chart view':'Flow view'}</button></div></div>
      {!flowView&&<AnimatePresence mode="wait" initial={false}><motion.div className="visual-step-content" key={module} initial={reduced?false:{opacity:0,y:8,filter:'blur(2px)'}} animate={{opacity:1,y:0,filter:'blur(0px)'}} exit={reduced?undefined:{opacity:0,y:-4,filter:'blur(2px)'}} transition={{duration:reduced?0:.34,ease:[.22,1,.36,1]}}>
        {module==='cpu'&&isCompare?<><ComparisonTable metric="AVG WAIT" rows={cpuComparison}/><GanttGraphic schedule={currentCpu} visibleSlices={(state.slices as CpuSchedule['slices']|undefined)??[]} algorithm={model.cpuAlgorithm}/></>
          :module==='paging'&&isCompare?<><ComparisonTable metric="FAULTS" rows={pageCompareRows}/><PageGraphic state={state} refs={model.refs}/></>
          :module==='disk'&&isCompare?<><ComparisonTable metric="SEEK" rows={diskCompareRows}/><DiskGraphic state={state}/></>
          :chart}
      </motion.div></AnimatePresence>}
      {flowView&&<Suspense fallback={<div className="visual-flow-loading">Preparing flow view…</div>}><FlowMap module={module} activeStep={playback.step?.label ?? ''} processNames={processNames}/></Suspense>}
      <div className="visual-step-caption"><span className="kicker">WHY THIS STEP</span><span>{explanation}</span></div>
      {module==='cpu'&&!isCompare&&<div className="visual-metrics-strip"><span>AVG WAIT <b>{currentCpu.averageWaiting.toFixed(2)}</b></span><span>AVG TURNAROUND <b>{currentCpu.averageTurnaround.toFixed(2)}</b></span><span>AVG RESPONSE <b>{currentCpu.averageResponse.toFixed(2)}</b></span></div>}
      {module==='paging'&&isCompare&&<div className="visual-note">Comparison runs FIFO, LRU, and Optimal on the same reference string.</div>}
      {module==='disk'&&isCompare&&<div className="visual-note">Comparison runs FCFS, SSTF, SCAN, and C-SCAN on the same request queue.</div>}
      <PlaybackBar index={playback.index} count={playback.count} playing={playback.playing} speed={playback.speed} onPlay={playback.play} onPause={playback.pause} onBack={playback.back} onForward={playback.forward} onReplay={playback.replay} onScrub={playback.scrub} onSpeed={playback.setSpeed}/>
      <div className="visual-help-hint">SPACE play/pause · ← → step · P present · Esc exit</div>
    </section>
    {present&&<PresentMode slides={slides} speed={playback.speed} setSpeed={playback.setSpeed} onStepChange={updatePresentStep} onClose={onClosePresent} onExport={exportPng}>{flowView?<Suspense fallback={<div className="visual-flow-loading">Preparing flow view…</div>}><FlowMap module={module} activeStep={playback.step?.label??''} processNames={processNames}/></Suspense>:chart}</PresentMode>}
  </>;
}
