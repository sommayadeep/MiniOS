import type { Process, SimStep } from './types';

export type CpuAlgorithm = 'fcfs' | 'sjf' | 'rr' | 'priority' | 'mlfq';
export type CpuSlice = { name: string; pid: number; start: number; end: number; queue?: number };
export type CpuMetrics = { name: string; waiting: number; turnaround: number; response: number };
export type CpuSchedule = { steps: SimStep[]; slices: CpuSlice[]; metrics: CpuMetrics[]; averageWaiting: number; averageTurnaround: number; averageResponse: number };
export type MemoryBlock = { offset: number; size: number; name: string; allocated: boolean };
export type PageAlgorithm = 'fifo' | 'lru' | 'optimal';
export type DiskAlgorithm = 'fcfs' | 'sstf' | 'scan' | 'cscan';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const safeProcesses = (items: Process[]) => items.filter(item => item.burst > 0).map(item => ({ ...item, burst: Math.max(1, item.burst), arrival: Math.max(0, item.arrival) }));

export function createProcessSteps(processes: Process[]): SimStep[] {
  const rows = safeProcesses(processes);
  if (!rows.length) return [{ label: 'Waiting for processes', why: 'Create a process or load the sample set to start the lifecycle view.', state: { states: [], readyQueue: [], active: null } }];
  const steps: SimStep[] = [];
  const states = rows.map(p => ({ pid: p.pid, name: p.name, state: 'NEW' }));
  const readyQueue: string[] = [];
  const push = (label: string, why: string, active: string | null = null) => steps.push({ label, why, state: { states: clone(states), readyQueue: [...readyQueue], active } });
  push('New', 'A process has been created and is waiting to enter the ready queue.');
  rows.forEach((p, i) => { states[i].state = 'READY'; readyQueue.push(p.name); push(`${p.name} → Ready`, 'The process is admitted and becomes eligible for CPU time.'); });
  rows.forEach((p, i) => {
    const position = readyQueue.indexOf(p.name);
    if (position >= 0) readyQueue.splice(position, 1);
    states[i].state = 'RUNNING'; push(`${p.name} → Running`, 'The scheduler selects this ready process for the CPU.', p.name);
    states[i].state = 'WAITING'; push(`${p.name} → Waiting`, 'The process yields while waiting for an event or resource.', p.name);
    states[i].state = 'READY'; readyQueue.push(p.name); push(`${p.name} → Ready`, 'The wait has ended, so the process returns to the ready queue.');
    readyQueue.splice(readyQueue.indexOf(p.name), 1); states[i].state = 'TERMINATED'; push(`${p.name} → Terminated`, 'The process has completed and leaves the ready queue.');
  });
  return steps;
}

export function scheduleCpu(processes: Process[], algorithm: CpuAlgorithm = 'fcfs', quantum = 2): CpuSchedule {
  const jobs = safeProcesses(processes);
  const steps: SimStep[] = [];
  const slices: CpuSlice[] = [];
  const remaining = jobs.map(p => p.burst);
  const completed = jobs.map(() => false);
  const firstStart = jobs.map(() => -1);
  const completion = jobs.map(() => 0);
  let time = 0;
  const push = (label: string, why: string, active: number | null, queue: number[]) => steps.push({
    label, why, state: { time, active: active === null ? null : jobs[active]?.name, readyQueue: queue.map(i => jobs[i]?.name).filter(Boolean), slices: clone(slices), remaining: jobs.map((p, i) => ({ name: p.name, value: remaining[i] })), completed: jobs.filter((_, i) => completed[i]).map(p => p.name) },
  });
  push('Ready queue', 'The scheduler begins with the processes available at their arrival times.', null, jobs.map((_, i) => i).filter(i => jobs[i].arrival <= 0));
  const arriveAt = (at: number) => jobs.map((_, i) => i).filter(i => !completed[i] && remaining[i] > 0 && jobs[i].arrival <= at);
  const idleUntilNext = () => {
    const next = jobs.map((p, i) => !completed[i] && remaining[i] > 0 ? p.arrival : Infinity).filter(t => t > time).sort((a, b) => a - b)[0];
    if (Number.isFinite(next)) { time = next; slices.push({ pid: -1, name: 'Idle', start: slices.at(-1)?.end ?? 0, end: time }); push(`CPU idle · ${time}`, 'No process has arrived; the clock advances to the next arrival.', null, arriveAt(time)); }
  };
  const execute = (index: number, duration: number, queue: number[], queueLevel?: number) => {
    const start = time; const runFor = Math.min(remaining[index], duration);
    if (firstStart[index] < 0) firstStart[index] = start;
    time += runFor; remaining[index] -= runFor;
    slices.push({ pid: jobs[index].pid, name: jobs[index].name, start, end: time, ...(queueLevel === undefined ? {} : { queue: queueLevel }) });
    if (remaining[index] === 0) { completed[index] = true; completion[index] = time; }
    const why = algorithm === 'fcfs' ? 'FCFS selects the earliest-arriving process first.'
      : algorithm === 'sjf' ? 'SJF chooses the shortest burst among processes already in the ready queue.'
      : algorithm === 'priority' ? 'Priority scheduling chooses the lowest priority number among ready processes.'
      : algorithm === 'rr' ? `Round Robin gives each ready process up to ${Math.max(1, quantum)} time units.`
      : `MLFQ runs this process in queue ${queueLevel ?? 0} and demotes unfinished work after its time slice.`;
    push(`${jobs[index].name} · ${start}–${time}`, why, index, queue);
  };

  if (algorithm === 'fcfs' || algorithm === 'sjf' || algorithm === 'priority') {
    let done = 0;
    while (done < jobs.length) {
      const ready = arriveAt(time);
      if (!ready.length) { idleUntilNext(); continue; }
      let index = ready[0];
      if (algorithm === 'sjf') index = ready.reduce((best, i) => jobs[i].burst < jobs[best].burst ? i : best, ready[0]);
      if (algorithm === 'priority') index = ready.reduce((best, i) => jobs[i].priority < jobs[best].priority ? i : best, ready[0]);
      execute(index, remaining[index], ready.filter(i => i !== index)); done++;
    }
  } else if (algorithm === 'rr') {
    const q = Math.max(1, Math.floor(quantum)); const queue: number[] = []; const seen = jobs.map(p => p.arrival <= 0);
    jobs.forEach((p, i) => { if (p.arrival <= 0) queue.push(i); });
    let done = 0;
    while (done < jobs.length) {
      if (!queue.length) { idleUntilNext(); jobs.forEach((p, i) => { if (!seen[i] && p.arrival <= time) { queue.push(i); seen[i] = true; } }); continue; }
      const index = queue.shift()!; execute(index, q, [...queue]);
      jobs.forEach((p, i) => { if (!seen[i] && p.arrival <= time) { queue.push(i); seen[i] = true; } });
      if (remaining[index] > 0) queue.push(index); else done++;
    }
  } else {
    const queues: number[][] = [[], [], []]; const levels = jobs.map(() => 0); const seen = jobs.map(() => false); const quanta = [1, 2, Number.MAX_SAFE_INTEGER]; let done = 0;
    while (done < jobs.length) {
      jobs.forEach((p, i) => { if (!seen[i] && p.arrival <= time) { queues[0].push(i); seen[i] = true; } });
      let level = queues.findIndex(q => q.length > 0);
      if (level < 0) { idleUntilNext(); continue; }
      const index = queues[level].shift()!;
      execute(index, quanta[level], queues.flat(), level);
      jobs.forEach((p, i) => { if (!seen[i] && p.arrival <= time) { queues[0].push(i); seen[i] = true; } });
      if (remaining[index] > 0) { levels[index] = Math.min(level + 1, 2); queues[levels[index]].push(index); } else done++;
    }
  }
  const metrics = jobs.map((p, i) => ({ name: p.name, waiting: Math.max(0, completion[i] - p.arrival - p.burst), turnaround: Math.max(0, completion[i] - p.arrival), response: Math.max(0, firstStart[i] - p.arrival) }));
  const average = (key: 'waiting' | 'turnaround' | 'response') => metrics.length ? metrics.reduce((sum, m) => sum + m[key], 0) / metrics.length : 0;
  push('Schedule complete', 'Every process has received its CPU time; the table summarizes the completed schedule.', null, []);
  return { steps, slices, metrics, averageWaiting: average('waiting'), averageTurnaround: average('turnaround'), averageResponse: average('response') };
}

export function createMemorySteps(before: MemoryBlock[], after: MemoryBlock[], action: string, input: { name?: string; size?: number; policy?: string } = {}): SimStep[] {
  const blocks = before.length ? before : [{ offset: 0, size: 1024, name: '', allocated: false }];
  const amount = Math.max(0, Number(input.size) || 0); const candidates = blocks.map((b, i) => !b.allocated && b.size >= amount ? i : -1).filter(i => i >= 0);
  const policy = (input.policy || 'ff').toLowerCase();
  const selected = policy === 'bf' ? candidates.reduce((best, i) => blocks[i].size < blocks[best].size ? i : best, candidates[0])
    : policy === 'wf' ? candidates.reduce((best, i) => blocks[i].size > blocks[best].size ? i : best, candidates[0]) : candidates[0];
  const fragmentation = (list: MemoryBlock[]) => { const free = list.filter(b => !b.allocated); const total = free.reduce((sum, b) => sum + b.size, 0); const largest = Math.max(0, ...free.map(b => b.size)); return total ? Math.round((total - largest) / total * 100) : 0; };
  return [
    { label: 'Candidate holes', why: `The ${policy === 'bf' ? 'Best Fit' : policy === 'wf' ? 'Worst Fit' : 'First Fit'} policy checks free blocks that can hold ${amount || 'the requested'} MB.`, state: { blocks: clone(blocks), candidates, selected: null, fragmentation: fragmentation(blocks) } },
    { label: action.startsWith('mem_free') ? 'Release block' : 'Choose placement', why: selected === undefined ? 'No free block can fit this request.' : `The selected hole starts at ${blocks[selected].offset} MB; the arena is split without changing total capacity.`, state: { blocks: clone(blocks), candidates, selected: selected ?? null, fragmentation: fragmentation(blocks) } },
    { label: 'Arena updated', why: 'The memory map reflects the backend’s resulting allocation state.', state: { blocks: clone(after.length ? after : blocks), candidates: [], selected: null, fragmentation: fragmentation(after.length ? after : blocks), name: input.name } },
  ];
}

export function createPageSteps(refs: number[], frameCount: number, algorithm: PageAlgorithm = 'fifo') {
  const frames = Array.from({ length: Math.max(1, Math.min(12, frameCount || 3)) }, () => -1); const steps: SimStep[] = [];
  let faults = 0; let hits = 0; let pointer = 0; const lastUsed = new Map<number, number>();
  refs.forEach((page, i) => {
    const hitAt = frames.indexOf(page); let evicted: number | null = null; let why = '';
    if (hitAt >= 0) { hits++; lastUsed.set(page, i); why = `Page ${page} is already resident, so this reference is a hit.`; }
    else {
      faults++;
      let slot = frames.indexOf(-1);
      if (slot < 0) {
        if (algorithm === 'fifo') slot = pointer++ % frames.length;
        else if (algorithm === 'lru') slot = frames.reduce((best, value, idx) => (lastUsed.get(value) ?? -1) < (lastUsed.get(frames[best]) ?? -1) ? idx : best, 0);
        else slot = frames.reduce((best, value, idx) => {
          const next = refs.slice(i + 1).indexOf(value); const bestNext = refs.slice(i + 1).indexOf(frames[best]);
          return (next < 0 ? Infinity : next) > (bestNext < 0 ? Infinity : bestNext) ? idx : best;
        }, 0);
        evicted = frames[slot];
      }
      frames[slot] = page; lastUsed.set(page, i); why = evicted === null ? `Page ${page} faults and uses the first empty frame.` : `Page ${page} faults; ${algorithm.toUpperCase()} replaces ${evicted}.`;
    }
    steps.push({ label: `Reference ${i + 1} · ${page}`, why, state: { reference: page, frames: [...frames], faults, hits, hitRatio: refs.length ? hits / (i + 1) : 0, evicted, index: i } });
  });
  return steps.length ? steps : [{ label: 'Reference string ready', why: 'Enter at least one page reference to simulate replacement.', state: { frames, faults, hits, hitRatio: 0, evicted: null, index: -1 } }];
}

export function createDiskSteps(head: number, requests: number[], algorithm: DiskAlgorithm = 'fcfs') {
  const start = Math.max(0, Math.min(199, head)); const pending = requests.map(x => Math.max(0, Math.min(199, x)));
  if (!pending.length) return [{ label: 'Waiting for requests', why: 'Add disk requests to see how the selected policy moves the head.', state: { order: [start], current: start, seek: 0, algorithm } }];
  let order = [start];
  if (algorithm === 'fcfs') order = [start, ...pending];
  if (algorithm === 'sstf') {
    const rest = [...pending]; let at = start; order = [start];
    while (rest.length) { let best = 0; for (let i = 1; i < rest.length; i++) if (Math.abs(rest[i] - at) < Math.abs(rest[best] - at)) best = i; at = rest.splice(best, 1)[0]; order.push(at); }
  }
  if (algorithm === 'scan' || algorithm === 'cscan') {
    const sorted = [...pending].sort((a, b) => a - b); const split = sorted.findIndex(v => v >= start); const pivot = split < 0 ? sorted.length : split;
    const right = sorted.slice(pivot); const left = sorted.slice(0, pivot);
    order = algorithm === 'scan' ? [start, ...right, ...(sorted[sorted.length - 1] !== 199 && right.length ? [199] : []), ...left.reverse()] : [start, ...right, 199, 0, ...left];
  }
  let seek = 0; const steps: SimStep[] = [{ label: 'Head positioned', why: `The disk head begins at cylinder ${start}.`, state: { order: [start], current: start, seek: 0, algorithm } }];
  order.slice(1).forEach((cylinder, i) => { seek += Math.abs(cylinder - order[i]); steps.push({ label: `Move to ${cylinder}`, why: `${algorithm.toUpperCase()} moves from ${order[i]} to the next cylinder in its service order.`, state: { order: order.slice(0, i + 2), current: cylinder, seek, algorithm } }); });
  return steps;
}

export function createProducerSteps() {
  const buffer = Array.from({ length: 5 }, () => 0); const actions = ['produce','produce','produce','consume','produce','consume','produce','consume','consume','consume'];
  let empty = 5, full = 0, item = 1, input = 0, output = 0;
  return actions.map((action, i) => {
    let why = ''; let blocked = false;
    if (action === 'produce' && empty > 0) { buffer[input] = item++; input = (input + 1) % 5; empty--; full++; why = 'The producer acquires an empty slot and adds the next item under the mutex.'; }
    else if (action === 'consume' && full > 0) { buffer[output] = 0; output = (output + 1) % 5; full--; empty++; why = 'The consumer removes the oldest item, releasing a slot for the producer.'; }
    else { blocked = true; why = action === 'produce' ? 'The bounded buffer is full, so the producer blocks.' : 'The bounded buffer is empty, so the consumer blocks.'; }
    return { label: `${action === 'produce' ? 'Produce' : 'Consume'} · ${i + 1}`, why, state: { buffer: [...buffer], empty, full, mutex: 1, action, blocked } };
  });
}

export function createBankerSteps() {
  const allocation = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]]; const maximum = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]]; const available = [3,3,2];
  const need = maximum.map((row, i) => row.map((value, j) => value - allocation[i][j])); const work = [...available]; const finished = Array(5).fill(false); const safe: number[] = [];
  const steps: SimStep[] = [{ label: 'Need matrix', why: 'Need is calculated cell by cell as Max minus Allocation.', state: { allocation, maximum, need, available, work: [...work], safe: [...safe], finished: [...finished] } }];
  let progress = true;
  while (safe.length < 5 && progress) { progress = false; for (let i = 0; i < 5; i++) { if (finished[i] || need[i].some((value, j) => value > work[j])) continue; finished[i] = true; safe.push(i); allocation[i].forEach((value, j) => work[j] += value); progress = true; steps.push({ label: `P${i} can finish`, why: `P${i} can meet its remaining need with the available work vector, then releases its allocation.`, state: { allocation, maximum, need, available, work: [...work], safe: [...safe], finished: [...finished] } }); } }
  steps.push({ label: safe.length === 5 ? 'SAFE' : 'UNSAFE', why: safe.length === 5 ? `All processes can finish in the safe order ${safe.map(i => `P${i}`).join(' → ')}.` : 'No unfinished process can satisfy its remaining need with the available resources.', state: { allocation, maximum, need, available, work, safe, finished, safeState: safe.length === 5 } });
  return steps;
}

export function parseProcessOutput(output: string): Process[] {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  return [...clean.matchAll(/^\s*(\d+)\s+(\w+)\s+(\d+)\s+\d+\s+(\d+)\s+(\d+)\s+(\w+)/gm)].map(m => ({ pid: Number(m[1]), name: m[2], burst: Number(m[3]), arrival: Number(m[4]), priority: Number(m[5]), state: m[6] }));
}

export function parseMemoryOutput(output: string): MemoryBlock[] {
  const clean = output.replace(/\x1b\[[0-9;]*m/g, '');
  return [...clean.matchAll(/\[\s*(\d+)\s*-\s*(\d+)\]\s+(\S+)\s+(\d+)\s+MB\s+(ALLOCATED|FREE)/g)].map(m => ({ offset: Number(m[1]), size: Number(m[2]) - Number(m[1]) + 1, name: m[3] === '---' ? '' : m[3], allocated: m[5] === 'ALLOCATED' }));
}
