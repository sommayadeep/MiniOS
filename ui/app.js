// MiniOS Simulator Dashboard Logic
// Supports both:
// 1. Local mode (communicating with compiled C binary via Python app.py on 127.0.0.1:5050)
// 2. Standalone Web / GitHub Pages mode (pure in-browser C-equivalent OS simulation engine)

const terminal = document.getElementById("terminalOutput");
const cliInput = document.getElementById("cliInput");
const statusBadge = document.getElementById("statusBadge");
const fullDemoBtn = document.getElementById("fullDemoBtn");
const terminalTitle = document.getElementById("terminalTitle");

// Detection of local server vs static GitHub Pages
let useLocalServer = window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost";

// Command history
let cmdHistory = [];
let historyIndex = -1;

// Demo state
let isDemoRunning = false;

// ANSI escape sequence to HTML converter
function ansiToHtml(text) {
  if (!text) return "";
  
  let safe = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  safe = safe
    .replace(/\x1b\[1;31m/g, '<span class="ansi-red">')
    .replace(/\x1b\[1;32m/g, '<span class="ansi-green">')
    .replace(/\x1b\[1;33m/g, '<span class="ansi-yellow">')
    .replace(/\x1b\[1;34m/g, '<span class="ansi-blue">')
    .replace(/\x1b\[1;35m/g, '<span class="ansi-magenta">')
    .replace(/\x1b\[1;36m/g, '<span class="ansi-cyan">')
    .replace(/\x1b\[1;37m/g, '<span class="ansi-white">')
    .replace(/\x1b\[0m/g, '</span>');

  return safe;
}

function appendToTerminal(rawText, isUserInput = false, isStepBanner = false) {
  const block = document.createElement("div");
  if (isStepBanner) {
    block.innerHTML = `<div class="step-banner">${rawText}</div>`;
  } else if (isUserInput) {
    block.innerHTML = `<span style="color:#06b6d4;font-weight:600;">minios&gt;</span> <span style="color:#f8fafc;">${rawText}</span>`;
  } else {
    block.innerHTML = ansiToHtml(rawText);
  }
  
  terminal.appendChild(block);
  terminal.scrollTop = terminal.scrollHeight;
}

function setStatus(text, isBusy = false) {
  if (!statusBadge) return;
  statusBadge.classList.toggle("is-busy", isBusy);
  const label = statusBadge.querySelector("span:last-child");
  if (label) label.textContent = "Status: " + text;
  else statusBadge.textContent = "Status: " + text;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toggleCard(header) {
  const card = header.closest(".card");
  if (card) {
    card.classList.toggle("collapsed");
  }
}

// ============================================================================
// STANDALONE IN-BROWSER SIMULATION ENGINE (Identical to MiniOS C Implementation)
// ============================================================================

const StandaloneOS = {
  processes: [],
  memoryBlocks: [{ offset: 0, size: 1024, allocated: false, processName: "" }],

  reset() {
    this.processes = [];
    this.memoryBlocks = [{ offset: 0, size: 1024, allocated: false, processName: "" }];
  },

  createProcess(name, burst, priority, arrival) {
    burst = parseInt(burst);
    priority = parseInt(priority);
    arrival = parseInt(arrival) || 0;

    if (isNaN(burst) || burst <= 0) {
      return "\x1b[1;31mError: Burst time must be positive\x1b[0m\n";
    }
    if (this.processes.some((p) => p.name === name)) {
      return `\x1b[1;31mError: Process '${name}' already exists\x1b[0m\n`;
    }

    const pid = this.processes.length;
    this.processes.push({
      pid,
      name,
      burst,
      remaining: burst,
      priority,
      arrival,
      state: "READY",
      waitingTime: 0,
      turnaroundTime: 0,
      completionTime: 0,
    });
    return `\x1b[1;32mProcess '${name}' created with PID ${pid}\x1b[0m\n`;
  },

  listProcesses() {
    if (this.processes.length === 0) {
      return "\x1b[1;33mNo processes in the system.\x1b[0m\n";
    }
    let out = "\x1b[1;36m\nPID   Name         Burst    Remaining  Arrival    Priority State     \n\x1b[0m";
    out += "───────────────────────────────────────────────────────────────\n";
    for (const p of this.processes) {
      const pidStr = String(p.pid).padEnd(5);
      const nameStr = p.name.padEnd(12);
      const burstStr = String(p.burst).padEnd(8);
      const remStr = String(p.remaining).padEnd(10);
      const arrStr = String(p.arrival).padEnd(10);
      const prioStr = String(p.priority).padEnd(8);
      out += `${pidStr} ${nameStr} ${burstStr} ${remStr} ${arrStr} ${prioStr} ${p.state}\n`;
    }
    out += `\nTotal processes: ${this.processes.length}\n\n`;
    return out;
  },

  killProcess(pid) {
    pid = parseInt(pid);
    const idx = this.processes.findIndex((p) => p.pid === pid);
    if (idx === -1) {
      return `\x1b[1;31mError: Process ${pid} does not exist\x1b[0m\n`;
    }
    this.processes.splice(idx, 1);
    return `\x1b[1;32mProcess ${pid} terminated.\x1b[0m\n`;
  },

  clearProcesses() {
    this.processes = [];
    return "\x1b[1;32mAll processes cleared.\x1b[0m\n";
  },

  // CPU Schedulers
  buildGanttChart(order, startTimes, endTimes) {
    let out = "\x1b[1;36m\nGantt Chart:\n\x1b[0m ";
    for (let i = 0; i < order.length; i++) {
      let width = Math.max(4, (endTimes[i] - startTimes[i]) * 3);
      out += "─".repeat(width) + " ";
    }
    out += "\n|";
    for (let i = 0; i < order.length; i++) {
      let width = Math.max(4, (endTimes[i] - startTimes[i]) * 3);
      let label = order[i];
      let left = Math.floor((width - label.length) / 2);
      let right = width - label.length - left;
      out += " ".repeat(left) + label + " ".repeat(right) + "|";
    }
    out += "\n ";
    for (let i = 0; i < order.length; i++) {
      let width = Math.max(4, (endTimes[i] - startTimes[i]) * 3);
      out += "─".repeat(width) + " ";
    }
    out += "\n" + String(startTimes[0]).padEnd(3);
    for (let i = 0; i < order.length; i++) {
      let width = Math.max(4, (endTimes[i] - startTimes[i]) * 3);
      let timeStr = String(endTimes[i]);
      let pad = width + 1 - timeStr.length;
      out += " ".repeat(Math.max(1, pad)) + timeStr;
    }
    out += "\n\n";
    return out;
  },

  buildResultsTable(procs, algoName) {
    let totalWt = 0, totalTat = 0;
    let out = `\x1b[1;36m--- ${algoName} Results ---\n\x1b[0m`;
    out += "Name     Arrival  Burst      Priority Completion   Turnaround   Waiting     \n";
    out += "────────────────────────────────────────────────────────────────────────\n";
    for (const p of procs) {
      out += `${p.name.padEnd(8)} ${String(p.arrival).padEnd(8)} ${String(p.burst).padEnd(10)} ${String(p.priority).padEnd(8)} ${String(p.completionTime).padEnd(12)} ${String(p.turnaroundTime).padEnd(12)} ${String(p.waitingTime).padEnd(12)}\n`;
      totalWt += p.waitingTime;
      totalTat += p.turnaroundTime;
    }
    out += "────────────────────────────────────────────────────────────────────────\n";
    const avgTat = (totalTat / procs.length).toFixed(2);
    const avgWt = (totalWt / procs.length).toFixed(2);
    out += `\x1b[1;33mAverage Turnaround Time: ${avgTat}\nAverage Waiting Time   : ${avgWt}\n\n\x1b[0m`;
    return { out, avgWt: parseFloat(avgWt), avgTat: parseFloat(avgTat) };
  },

  scheduleFCFS() {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created.\x1b[0m\n";
    const procs = JSON.parse(JSON.stringify(this.processes)).sort((a, b) => a.arrival - b.arrival);
    let curTime = 0, order = [], startTimes = [], endTimes = [];

    for (const p of procs) {
      if (curTime < p.arrival) {
        order.push("idle");
        startTimes.push(curTime);
        endTimes.push(p.arrival);
        curTime = p.arrival;
      }
      order.push(p.name);
      startTimes.push(curTime);
      endTimes.push(curTime + p.burst);
      curTime += p.burst;
      p.completionTime = curTime;
      p.turnaroundTime = p.completionTime - p.arrival;
      p.waitingTime = p.turnaroundTime - p.burst;
    }

    let res = "\x1b[1;35m\n========== FCFS Scheduling ==========\n\x1b[0m";
    res += this.buildGanttChart(order, startTimes, endTimes);
    const table = this.buildResultsTable(procs, "FCFS");
    return { text: res + table.out, avgWt: table.avgWt, avgTat: table.avgTat };
  },

  scheduleSJF() {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created.\x1b[0m\n";
    const procs = JSON.parse(JSON.stringify(this.processes));
    let completed = new Array(procs.length).fill(false);
    let done = 0, curTime = 0, order = [], startTimes = [], endTimes = [];

    while (done < procs.length) {
      let shortest = -1, minBurst = Infinity;
      for (let i = 0; i < procs.length; i++) {
        if (!completed[i] && procs[i].arrival <= curTime && procs[i].burst < minBurst) {
          minBurst = procs[i].burst;
          shortest = i;
        }
      }
      if (shortest === -1) {
        curTime++;
        continue;
      }
      const p = procs[shortest];
      order.push(p.name);
      startTimes.push(curTime);
      endTimes.push(curTime + p.burst);
      curTime += p.burst;
      p.completionTime = curTime;
      p.turnaroundTime = p.completionTime - p.arrival;
      p.waitingTime = p.turnaroundTime - p.burst;
      completed[shortest] = true;
      done++;
    }

    let res = "\x1b[1;35m\n========== SJF Scheduling (Non-Preemptive) ==========\n\x1b[0m";
    res += this.buildGanttChart(order, startTimes, endTimes);
    const table = this.buildResultsTable(procs, "SJF (Non-Preemptive)");
    return { text: res + table.out, avgWt: table.avgWt, avgTat: table.avgTat };
  },

  scheduleRR(quantum = 2) {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created.\x1b[0m\n";
    const procs = JSON.parse(JSON.stringify(this.processes)).sort((a, b) => a.arrival - b.arrival);
    let remaining = procs.map((p) => p.burst);
    let curTime = 0, done = 0, queue = [], inQueue = new Array(procs.length).fill(false);
    let order = [], startTimes = [], endTimes = [];

    for (let i = 0; i < procs.length; i++) {
      if (procs[i].arrival <= 0) {
        queue.push(i);
        inQueue[i] = true;
      }
    }

    while (done < procs.length) {
      if (queue.length === 0) {
        curTime++;
        for (let i = 0; i < procs.length; i++) {
          if (!inQueue[i] && remaining[i] > 0 && procs[i].arrival <= curTime) {
            queue.push(i);
            inQueue[i] = true;
          }
        }
        continue;
      }
      const idx = queue.shift();
      const p = procs[idx];
      const exec = Math.min(remaining[idx], quantum);

      order.push(p.name);
      startTimes.push(curTime);
      endTimes.push(curTime + exec);
      curTime += exec;
      remaining[idx] -= exec;

      for (let i = 0; i < procs.length; i++) {
        if (!inQueue[i] && remaining[i] > 0 && procs[i].arrival <= curTime) {
          queue.push(i);
          inQueue[i] = true;
        }
      }

      if (remaining[idx] === 0) {
        p.completionTime = curTime;
        p.turnaroundTime = p.completionTime - p.arrival;
        p.waitingTime = p.turnaroundTime - p.burst;
        done++;
      } else {
        queue.push(idx);
      }
    }

    let res = `\x1b[1;35m\n========== Round Robin (quantum=${quantum}) ==========\n\x1b[0m`;
    res += this.buildGanttChart(order, startTimes, endTimes);
    const table = this.buildResultsTable(procs, "Round Robin");
    return { text: res + table.out, avgWt: table.avgWt, avgTat: table.avgTat };
  },

  schedulePriority() {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created.\x1b[0m\n";
    const procs = JSON.parse(JSON.stringify(this.processes));
    let completed = new Array(procs.length).fill(false);
    let done = 0, curTime = 0, order = [], startTimes = [], endTimes = [];

    while (done < procs.length) {
      let best = -1, bestPrio = Infinity;
      for (let i = 0; i < procs.length; i++) {
        if (!completed[i] && procs[i].arrival <= curTime && procs[i].priority < bestPrio) {
          bestPrio = procs[i].priority;
          best = i;
        }
      }
      if (best === -1) {
        curTime++;
        continue;
      }
      const p = procs[best];
      order.push(p.name);
      startTimes.push(curTime);
      endTimes.push(curTime + p.burst);
      curTime += p.burst;
      p.completionTime = curTime;
      p.turnaroundTime = p.completionTime - p.arrival;
      p.waitingTime = p.turnaroundTime - p.burst;
      completed[best] = true;
      done++;
    }

    let res = "\x1b[1;35m\n========== Priority Scheduling (Non-Preemptive) ==========\n\x1b[0m";
    res += this.buildGanttChart(order, startTimes, endTimes);
    const table = this.buildResultsTable(procs, "Priority (Non-Preemptive)");
    return { text: res + table.out, avgWt: table.avgWt, avgTat: table.avgTat };
  },

  scheduleMLFQ() {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created.\x1b[0m\n";
    const procs = JSON.parse(JSON.stringify(this.processes)).sort((a, b) => a.arrival - b.arrival);
    let q0 = [], q1 = [], q2 = [];
    let remaining = procs.map((p) => p.burst);
    let arrived = new Array(procs.length).fill(false);
    let curTime = 0, done = 0, order = [], startTimes = [], endTimes = [];
    const quanta = [1, 2, 9999];

    while (done < procs.length) {
      for (let i = 0; i < procs.length; i++) {
        if (!arrived[i] && procs[i].arrival <= curTime) {
          q0.push(i);
          arrived[i] = true;
        }
      }

      let qi = -1, level = -1;
      if (q0.length > 0) { qi = q0.shift(); level = 0; }
      else if (q1.length > 0) { qi = q1.shift(); level = 1; }
      else if (q2.length > 0) { qi = q2.shift(); level = 2; }

      if (qi === -1) {
        curTime++;
        continue;
      }

      const p = procs[qi];
      const exec = Math.min(remaining[qi], quanta[level]);

      order.push(p.name);
      startTimes.push(curTime);
      endTimes.push(curTime + exec);
      curTime += exec;
      remaining[qi] -= exec;

      for (let i = 0; i < procs.length; i++) {
        if (!arrived[i] && procs[i].arrival <= curTime) {
          q0.push(i);
          arrived[i] = true;
        }
      }

      if (remaining[qi] === 0) {
        p.completionTime = curTime;
        p.turnaroundTime = p.completionTime - p.arrival;
        p.waitingTime = p.turnaroundTime - p.burst;
        done++;
      } else {
        if (level === 0) q1.push(qi);
        else q2.push(qi);
      }
    }

    let res = "\x1b[1;35m\n========== Multilevel Feedback Queue (3 levels) ==========\n\x1b[0m";
    res += "Queue 0: RR q=1 | Queue 1: RR q=2 | Queue 2: FCFS\n\n";
    res += this.buildGanttChart(order, startTimes, endTimes);
    const table = this.buildResultsTable(procs, "MLFQ");
    return { text: res + table.out, avgWt: table.avgWt, avgTat: table.avgTat };
  },

  scheduleCompare() {
    if (this.processes.length === 0) return "\x1b[1;31mError: No processes created. Use 'create' first.\x1b[0m\n";

    let out = "\x1b[1;35m\n╔══════════════════════════════════════════╗\n║     Comparing All Scheduling Algorithms   ║\n╚══════════════════════════════════════════╝\n\x1b[0m";
    const fcfs = this.scheduleFCFS();
    const sjf = this.scheduleSJF();
    const rr = this.scheduleRR(2);
    const prio = this.schedulePriority();
    const mlfq = this.scheduleMLFQ();

    out += fcfs.text + sjf.text + rr.text + prio.text + mlfq.text;

    const names = ["FCFS", "SJF", "RR(q=2)", "Priority", "MLFQ"];
    const wts = [fcfs.avgWt, sjf.avgWt, rr.avgWt, prio.avgWt, mlfq.avgWt];
    const tats = [fcfs.avgTat, sjf.avgTat, rr.avgTat, prio.avgTat, mlfq.avgTat];

    let bestIdx = 0;
    for (let i = 1; i < wts.length; i++) {
      if (wts[i] < wts[bestIdx]) bestIdx = i;
    }

    out += "\x1b[1;36m\n╔═══════════════════════════════════════════════════════╗\n";
    out += "║              Algorithm Comparison Summary              ║\n";
    out += "╠═══════════════╦═══════════════════╦═══════════════════╣\n";
    out += "║  Algorithm    ║  Avg Wait Time    ║  Avg Turnaround   ║\n";
    out += "╠═══════════════╬═══════════════════╬═══════════════════╣\n\x1b[0m";

    for (let i = 0; i < 5; i++) {
      let isBest = i === bestIdx;
      let line = `║  ${names[i].padEnd(12)} ║      ${wts[i].toFixed(2).padStart(8)}     ║      ${tats[i].toFixed(2).padStart(8)}     ║\n`;
      out += isBest ? `\x1b[1;32m${line}\x1b[0m` : line;
    }
    out += "\x1b[1;36m╚═══════════════╩═══════════════════╩═══════════════════╝\n\x1b[0m";
    out += `\x1b[1;32m\nBest Average Waiting Time: ${names[bestIdx]} (${wts[bestIdx].toFixed(2)})\n\n\x1b[0m`;
    return out;
  },

  // Memory Management (1024 MB arena)
  memAlloc(pname, size, policy) {
    size = parseInt(size);
    if (isNaN(size) || size <= 0 || size > 1024) {
      return "\x1b[1;31mError: Invalid memory size (must be 1-1024 MB)\x1b[0m\n";
    }
    if (this.memoryBlocks.some((b) => b.allocated && b.processName === pname)) {
      return `\x1b[1;31mError: '${pname}' already has memory allocated\x1b[0m\n`;
    }

    let chosenIdx = -1;
    if (policy === "ff") {
      chosenIdx = this.memoryBlocks.findIndex((b) => !b.allocated && b.size >= size);
    } else if (policy === "bf") {
      let minSize = Infinity;
      for (let i = 0; i < this.memoryBlocks.length; i++) {
        const b = this.memoryBlocks[i];
        if (!b.allocated && b.size >= size && b.size < minSize) {
          minSize = b.size;
          chosenIdx = i;
        }
      }
    } else if (policy === "wf") {
      let maxSize = -1;
      for (let i = 0; i < this.memoryBlocks.length; i++) {
        const b = this.memoryBlocks[i];
        if (!b.allocated && b.size >= size && b.size > maxSize) {
          maxSize = b.size;
          chosenIdx = i;
        }
      }
    }

    if (chosenIdx === -1) {
      return `\x1b[1;31mError: Not enough contiguous memory for ${size} MB\x1b[0m\n`;
    }

    const block = this.memoryBlocks[chosenIdx];
    const offset = block.offset;
    const policyName = policy === "ff" ? "First Fit" : policy === "bf" ? "Best Fit" : "Worst Fit";

    if (block.size === size) {
      block.allocated = true;
      block.processName = pname;
    } else {
      const remainingSize = block.size - size;
      block.size = size;
      block.allocated = true;
      block.processName = pname;
      this.memoryBlocks.splice(chosenIdx + 1, 0, {
        offset: offset + size,
        size: remainingSize,
        allocated: false,
        processName: "",
      });
    }

    return `\x1b[1;32m  [${policyName}] Allocated at offset ${offset}\nAllocated ${size} MB to '${pname}'\x1b[0m\n`;
  },

  memFree(pname) {
    const idx = this.memoryBlocks.findIndex((b) => b.allocated && b.processName === pname);
    if (idx === -1) {
      return `\x1b[1;31mError: No memory allocated to '${pname}'\x1b[0m\n`;
    }
    this.memoryBlocks[idx].allocated = false;
    this.memoryBlocks[idx].processName = "";

    // Coalesce adjacent free blocks
    for (let i = 0; i < this.memoryBlocks.length - 1; ) {
      if (!this.memoryBlocks[i].allocated && !this.memoryBlocks[i + 1].allocated) {
        this.memoryBlocks[i].size += this.memoryBlocks[i + 1].size;
        this.memoryBlocks.splice(i + 1, 1);
      } else {
        i++;
      }
    }
    return `\x1b[1;32mFreed memory for '${pname}'\x1b[0m\n`;
  },

  memStatus() {
    let out = "\x1b[1;36m\n=== Memory Map (Total: 1024 MB) ===\n\x1b[0m────────────────────────────────────────────────\n";
    let allocTotal = 0, freeTotal = 0;
    for (const b of this.memoryBlocks) {
      const start = String(b.offset).padStart(4);
      const end = String(b.offset + b.size - 1).padStart(4);
      const name = b.allocated ? b.processName.padEnd(10) : "---".padEnd(10);
      const sz = String(b.size).padStart(4);
      if (b.allocated) {
        out += `\x1b[1;32m  [${start} - ${end}]  ${name}  ${sz} MB  ALLOCATED\x1b[0m\n`;
        allocTotal += b.size;
      } else {
        out += `\x1b[1;33m  [${start} - ${end}]  ${name}  ${sz} MB  FREE\x1b[0m\n`;
        freeTotal += b.size;
      }
    }
    out += `────────────────────────────────────────────────\n  Allocated: ${allocTotal} MB | Free: ${freeTotal} MB\n\n`;
    return out;
  },

  producerConsumer() {
    let out = "\x1b[1;35m\n========== Producer-Consumer Problem ==========\n\x1b[0m";
    out += "Buffer size: 5 | Simulating 10 steps\n\n";
    out += "\x1b[1;36mStep   Action       empty    full     mutex     Buffer State\n\x1b[0m──────────────────────────────────────────────────────────\n";

    const buffer = ["_", "_", "_", "_", "_"];
    let empty = 5, full = 0, item = 1, inIdx = 0, outIdx = 0;
    const actions = ["P", "P", "P", "C", "P", "C", "P", "C", "C", "C"];

    for (let step = 0; step < actions.length; step++) {
      const act = actions[step];
      const stepStr = String(step + 1).padEnd(6);
      if (act === "P") {
        empty--;
        buffer[inIdx] = String(item);
        inIdx = (inIdx + 1) % 5;
        full++;
        out += `${stepStr} \x1b[1;32mProduce ${String(item).padEnd(4)}\x1b[0m ${String(empty).padEnd(8)} ${String(full).padEnd(8)} 1         [${buffer.join(",")}]\n`;
        item++;
      } else {
        full--;
        const consumed = buffer[outIdx];
        buffer[outIdx] = "_";
        outIdx = (outIdx + 1) % 5;
        empty++;
        out += `${stepStr} \x1b[1;33mConsume ${consumed.padEnd(4)}\x1b[0m ${String(empty).padEnd(8)} ${String(full).padEnd(8)} 1         [${buffer.join(",")}]\n`;
      }
    }
    out += "\n";
    return out;
  },

  bankers() {
    let out = "\x1b[1;35m\n========== Banker's Algorithm ==========\n\x1b[0m";
    out += "\x1b[1;36m\n--- Need Matrix (Max - Allocation) ---\n\x1b[0m";
    out += "     R0  R1  R2  \n";
    out += "P0:  7   4   3   \nP1:  1   2   2   \nP2:  6   0   0   \nP3:  0   1   1   \nP4:  4   3   1   \n";
    out += "\x1b[1;36m\n--- Safety Algorithm Execution ---\n\x1b[0m";
    out += "  P1 can run: Need(1,2,2) <= Work(3,3,2)\n         Work updated to (5,3,2)\n";
    out += "  P3 can run: Need(0,1,1) <= Work(5,3,2)\n         Work updated to (7,4,3)\n";
    out += "  P4 can run: Need(4,3,1) <= Work(7,4,3)\n         Work updated to (7,4,5)\n";
    out += "  P0 can run: Need(7,4,3) <= Work(7,4,5)\n         Work updated to (7,5,5)\n";
    out += "  P2 can run: Need(6,0,0) <= Work(7,5,5)\n         Work updated to (10,5,7)\n";
    out += "\x1b[1;32m\nSystem is in a SAFE state!\n\x1b[0m";
    out += "\x1b[1;32mSafe Sequence: < P1 -> P3 -> P4 -> P0 -> P2 >\n\n\x1b[0m";
    return out;
  },

  pageReplace(algo, frames, ref) {
    frames = parseInt(frames);
    const pages = ref.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    if (pages.length === 0) return "\x1b[1;31mError: Empty reference string\x1b[0m\n";

    if (algo === "compare") {
      let out = "\x1b[1;35m\n╔══════════════════════════════════════════╗\n║   Comparing Page Replacement Algorithms   ║\n╚══════════════════════════════════════════╝\n\x1b[0m";
      out += this.pageReplace("fifo", frames, ref);
      out += this.pageReplace("lru", frames, ref);
      out += this.pageReplace("optimal", frames, ref);
      out += "\x1b[1;36mNote: Optimal is theoretical (requires future knowledge)\n      and gives the minimum possible page faults.\n\n\x1b[0m";
      return out;
    }

    const title = algo.toUpperCase();
    let out = `\x1b[1;35m\n========== ${title} Page Replacement (${frames} frames) ==========\n\x1b[0m`;
    out += "\x1b[1;36mRef      Frames          Status    \n\x1b[0m─────────────────────────────────\n";

    let frameArr = new Array(frames).fill("-");
    let faults = 0;
    let fifoPtr = 0;
    let lastUsed = new Array(frames).fill(-1);

    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const inFrame = frameArr.indexOf(p);
      const refStr = `  ${String(p).padEnd(6)}`;

      if (inFrame !== -1) {
        lastUsed[inFrame] = i;
        out += `${refStr} [ ${frameArr.map((v) => String(v).padStart(2)).join(", ")} ]  \x1b[1;32mHIT\x1b[0m\n`;
      } else {
        faults++;
        if (algo === "fifo") {
          frameArr[fifoPtr] = p;
          fifoPtr = (fifoPtr + 1) % frames;
        } else if (algo === "lru") {
          let lruIdx = 0, minTime = lastUsed[0];
          for (let j = 1; j < frames; j++) {
            if (lastUsed[j] < minTime) { minTime = lastUsed[j]; lruIdx = j; }
          }
          frameArr[lruIdx] = p;
          lastUsed[lruIdx] = i;
        } else if (algo === "optimal") {
          const emptySlot = frameArr.indexOf("-");
          if (emptySlot !== -1) {
            frameArr[emptySlot] = p;
          } else {
            let farthest = -1, replaceIdx = 0;
            for (let j = 0; j < frames; j++) {
              let nextUse = pages.slice(i + 1).indexOf(frameArr[j]);
              if (nextUse === -1) nextUse = 9999;
              if (nextUse > farthest) { farthest = nextUse; replaceIdx = j; }
            }
            frameArr[replaceIdx] = p;
          }
        }
        out += `${refStr} [ ${frameArr.map((v) => String(v).padStart(2)).join(", ")} ]  \x1b[1;31mFAULT\x1b[0m\n`;
      }
    }

    out += "─────────────────────────────────\n";
    out += `\x1b[1;33mTotal Page Faults: ${faults} / ${pages.length}\n`;
    out += `Hit Ratio: ${(((pages.length - faults) / pages.length) * 100).toFixed(2)}%\n\n\x1b[0m`;
    return out;
  },

  diskSchedule(algo, head, reqStr) {
    head = parseInt(head);
    const reqs = reqStr.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
    if (reqs.length === 0) return "\x1b[1;31mError: Empty request list\x1b[0m\n";

    if (algo === "compare") {
      let out = "\x1b[1;35m\n╔══════════════════════════════════════════╗\n║    Comparing Disk Scheduling Algorithms   ║\n╚══════════════════════════════════════════╝\n\x1b[0m";
      out += this.diskSchedule("fcfs", head, reqStr);
      out += this.diskSchedule("sstf", head, reqStr);
      out += this.diskSchedule("scan", head, reqStr);
      out += this.diskSchedule("cscan", head, reqStr);
      return out;
    }

    let order = [head], totalSeek = 0;

    if (algo === "fcfs") {
      let cur = head;
      for (const r of reqs) {
        totalSeek += Math.abs(r - cur);
        cur = r;
        order.push(cur);
      }
    } else if (algo === "sstf") {
      let visited = new Array(reqs.length).fill(false);
      let cur = head;
      for (let i = 0; i < reqs.length; i++) {
        let minDist = Infinity, nearest = -1;
        for (let j = 0; j < reqs.length; j++) {
          if (!visited[j]) {
            const dist = Math.abs(reqs[j] - cur);
            if (dist < minDist) { minDist = dist; nearest = j; }
          }
        }
        if (nearest === -1) break;
        visited[nearest] = true;
        totalSeek += minDist;
        cur = reqs[nearest];
        order.push(cur);
      }
    } else if (algo === "scan") {
      const sorted = [...reqs].sort((a, b) => a - b);
      let start = sorted.findIndex((r) => r >= head);
      if (start === -1) start = sorted.length;
      for (let i = start; i < sorted.length; i++) order.push(sorted[i]);
      if (sorted[sorted.length - 1] !== 199 && start < sorted.length) order.push(199);
      for (let i = start - 1; i >= 0; i--) order.push(sorted[i]);

      for (let i = 1; i < order.length; i++) totalSeek += Math.abs(order[i] - order[i - 1]);
    } else if (algo === "cscan") {
      const sorted = [...reqs].sort((a, b) => a - b);
      let start = sorted.findIndex((r) => r >= head);
      if (start === -1) start = sorted.length;
      for (let i = start; i < sorted.length; i++) order.push(sorted[i]);
      order.push(199);
      order.push(0);
      for (let i = 0; i < start; i++) order.push(sorted[i]);

      for (let i = 1; i < order.length; i++) totalSeek += Math.abs(order[i] - order[i - 1]);
    }

    const title = algo.toUpperCase();
    let out = `\x1b[1;35m\n========== ${title} Disk Scheduling ==========\n\x1b[0m`;
    out += `  Initial Head Position: ${head}\n\n`;
    out += `\x1b[1;36m  Seek Order: \x1b[0m${order.join(" -> ")}\n`;
    out += `\x1b[1;33m  Total Seek Time: ${totalSeek} cylinders\n\n\x1b[0m`;
    return out;
  },

  executeCommand(cmd) {
    const parts = cmd.trim().split(/\s+/);
    const action = parts[0];

    if (action === "create") {
      return this.createProcess(parts[1], parts[2], parts[3], parts[4]);
    } else if (action === "list") {
      return this.listProcesses();
    } else if (action === "kill") {
      return this.killProcess(parts[1]);
    } else if (action === "clear_all") {
      return this.clearProcesses();
    } else if (action === "schedule") {
      const algo = parts[1];
      if (algo === "fcfs") return this.scheduleFCFS().text;
      if (algo === "sjf") return this.scheduleSJF().text;
      if (algo === "rr") return this.scheduleRR(parseInt(parts[2]) || 2).text;
      if (algo === "priority") return this.schedulePriority().text;
      if (algo === "mlfq") return this.scheduleMLFQ().text;
      if (algo === "compare") return this.scheduleCompare();
      return `\x1b[1;31mUnknown algorithm: ${algo}\x1b[0m\n`;
    } else if (action === "mem_alloc") {
      return this.memAlloc(parts[1], parts[2], parts[3]);
    } else if (action === "mem_free") {
      return this.memFree(parts[1]);
    } else if (action === "mem_status") {
      return this.memStatus();
    } else if (action === "mem_reset") {
      this.memoryBlocks = [{ offset: 0, size: 1024, allocated: false, processName: "" }];
      return "\x1b[1;32mMemory reset.\x1b[0m\n";
    } else if (action === "producer_consumer") {
      return this.producerConsumer();
    } else if (action === "bankers") {
      return this.bankers();
    } else if (action === "page") {
      return this.pageReplace(parts[1], parts[2], parts[3]);
    } else if (action === "disk") {
      return this.diskSchedule(parts[1], parts[2], parts[3]);
    } else if (action === "help") {
      return "\x1b[1;33m\nCommands: create, list, kill, schedule (fcfs|sjf|rr|priority|mlfq|compare), mem_alloc, mem_free, mem_status, producer_consumer, bankers, page, disk, clear_all\x1b[0m\n";
    }
    return `\x1b[1;31mUnknown command: '${action}'\x1b[0m\n`;
  },
};

// ============================================================================
// COMMAND DISPATCHER (Local Server with Standalone In-Browser Fallback)
// ============================================================================

async function runCommand(cmd, timeoutSeconds = 6.0) {
  if (!cmd || !cmd.trim()) return;
  const cleanCmd = cmd.trim();

  appendToTerminal(cleanCmd, true);
  setStatus("Executing...", true);

  // If local server mode is active, try local API
  if (useLocalServer) {
    try {
      const res = await fetch("/api/cmd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: cleanCmd, timeout: timeoutSeconds }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.output) {
          appendToTerminal(data.output);
          finishCommand(cleanCmd, data.output);
          return data.output;
        }
      } else {
        useLocalServer = false; // switch to client-side fallback
      }
    } catch {
      useLocalServer = false; // switch to client-side fallback
    }
  }

  // Standalone in-browser execution
  const out = StandaloneOS.executeCommand(cleanCmd);
  appendToTerminal(out);
  finishCommand(cleanCmd, out);
  return out;
}

function finishCommand(command, output) {
  if (!isDemoRunning) setStatus("System Ready", false);
  if (typeof updateMiniOSViews === "function") updateMiniOSViews(command, output);
}

// Module 1 Actions
function createProcess() {
  const name = document.getElementById("procName").value.trim() || "P1";
  const burst = document.getElementById("procBurst").value.trim() || "5";
  const priority = document.getElementById("procPriority").value.trim() || "1";
  const arrival = document.getElementById("procArrival").value.trim() || "0";

  runCommand(`create ${name} ${burst} ${priority} ${arrival}`);

  const match = name.match(/^P(\d+)$/i);
  if (match) {
    const nextNum = parseInt(match[1]) + 1;
    document.getElementById("procName").value = "P" + nextNum;
  }
}

async function loadSampleProcesses() {
  appendToTerminal("Loading 5 textbook sample processes (P1 to P5)...", false, true);
  await runCommand("clear_all");
  await sleep(150);
  await runCommand("create P1 7 3 0");
  await sleep(150);
  await runCommand("create P2 4 1 2");
  await sleep(150);
  await runCommand("create P3 1 4 4");
  await sleep(150);
  await runCommand("create P4 4 2 5");
  await sleep(150);
  await runCommand("create P5 3 5 6");
  await sleep(150);
  await runCommand("list");
}

function killProcess() {
  const pid = document.getElementById("killPid").value;
  runCommand(`kill ${pid}`);
}

// Module 2 Actions
function runRR() {
  const q = document.getElementById("rrQuantum").value.trim() || "2";
  runCommand(`schedule rr ${q}`);
}

// Module 3 Actions
function allocMemory() {
  const name = document.getElementById("memProcName").value.trim() || "P1";
  const size = document.getElementById("memSize").value.trim() || "128";
  const policy = document.getElementById("memPolicy").value;
  runCommand(`mem_alloc ${name} ${size} ${policy}`);
}

function freeMemory() {
  const name = document.getElementById("memProcName").value.trim() || "P1";
  runCommand(`mem_free ${name}`);
}

// Module 4 Actions
async function runBankers() {
  appendToTerminal("Executing Banker's Algorithm deadlock safety check...", false, true);
  setStatus("Computing Banker's...", true);

  if (useLocalServer) {
    try {
      const res = await fetch("/api/bankers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.output) {
          appendToTerminal(data.output);
          if (typeof renderBankers === "function") renderBankers(data.output);
          setStatus("System Ready", false);
          return;
        }
      }
    } catch {}
  }

  const out = StandaloneOS.bankers();
  appendToTerminal(out);
  if (typeof renderBankers === "function") renderBankers(out);
  setStatus("System Ready", false);
}

// Module 5 Actions
function runPage(algo) {
  const frames = document.getElementById("pageFrames").value.trim() || "3";
  const ref = document.getElementById("pageRef").value.trim() || "7,0,1,2,0,3,0,4,2,3,0,3";
  runCommand(`page ${algo} ${frames} ${ref}`);
}

// Module 6 Actions
function runDisk(algo) {
  const head = document.getElementById("diskHead").value.trim() || "53";
  const requests = document.getElementById("diskRequests").value.trim() || "98,183,37,122,14,124,65,67";
  runCommand(`disk ${algo} ${head} ${requests}`);
}

// ============================================================================
// STEP-BY-STEP FULL DEMO RUNNER (One by One)
// ============================================================================

const demoSteps = [
  { label: "Initialize: Resetting process table", cmd: "clear_all" },
  { label: "Initialize: Resetting 1024 MB memory arena", cmd: "mem_reset" },
  { label: "Creating Process P1 (Burst=7, Priority=3, Arrival=0)", cmd: "create P1 7 3 0" },
  { label: "Creating Process P2 (Burst=4, Priority=1, Arrival=2)", cmd: "create P2 4 1 2" },
  { label: "Creating Process P3 (Burst=1, Priority=4, Arrival=4)", cmd: "create P3 1 4 4" },
  { label: "Creating Process P4 (Burst=4, Priority=2, Arrival=5)", cmd: "create P4 4 2 5" },
  { label: "Creating Process P5 (Burst=3, Priority=5, Arrival=6)", cmd: "create P5 3 5 6" },
  { label: "Listing all processes in Process Table (PCB)", cmd: "list" },
  { label: "Running FCFS (First-Come, First-Served) CPU Scheduling", cmd: "schedule fcfs" },
  { label: "Running SJF (Shortest Job First) CPU Scheduling", cmd: "schedule sjf" },
  { label: "Running Round Robin Scheduling (Time Quantum = 2)", cmd: "schedule rr 2" },
  { label: "Running Priority Scheduling (Non-Preemptive)", cmd: "schedule priority" },
  { label: "Running Multilevel Feedback Queue (MLFQ - 3 Levels)", cmd: "schedule mlfq" },
  { label: "Side-by-Side Comparison of All 5 CPU Scheduling Algorithms", cmd: "schedule compare" },
  { label: "Memory Allocation: P1 requests 128 MB using First Fit (ff)", cmd: "mem_alloc P1 128 ff" },
  { label: "Memory Allocation: P2 requests 256 MB using Best Fit (bf)", cmd: "mem_alloc P2 256 bf" },
  { label: "Memory Allocation: P3 requests 64 MB using Worst Fit (wf)", cmd: "mem_alloc P3 64 wf" },
  { label: "Displaying 1024 MB Memory Allocation Map", cmd: "mem_status" },
  { label: "Freeing memory allocated to P1 & merging adjacent free blocks", cmd: "mem_free P1" },
  { label: "Re-inspecting Memory Map after coalescing free space", cmd: "mem_status" },
  { label: "Synchronization: Simulating Producer-Consumer with Semaphores", cmd: "producer_consumer" },
  { label: "Deadlock Avoidance: Running Banker's Safety Algorithm", action: "bankers" },
  { label: "Virtual Memory: Comparing FIFO vs LRU vs Optimal Page Replacement", cmd: "page compare 3 7,0,1,2,0,3,0,4,2,3,0,3" },
  { label: "Disk Scheduling: Comparing FCFS vs SSTF vs SCAN vs C-SCAN (Head=53)", cmd: "disk compare 53 98,183,37,122,14,124,65,67" },
];

function setDemoButton(running) {
  fullDemoBtn.classList.toggle("button-danger-quiet", running);
  fullDemoBtn.classList.toggle("button-primary", !running);
  fullDemoBtn.innerHTML = running ? "Stop Demo" : 'Run Full Demo <kbd>⌘↵</kbd>';
}

async function toggleFullDemo() {
  if (isDemoRunning) {
    isDemoRunning = false;
    setDemoButton(false);
    setStatus("Demo Stopped", false);
    appendToTerminal('<span class="ansi-yellow">[Demo stopped by user]</span>');
    return;
  }

  isDemoRunning = true;
  setDemoButton(true);

  appendToTerminal('<span class="ansi-cyan">========================================================================\nStarting MiniOS Automated Demonstration (24 Steps)\nExecuting operations sequentially...\n========================================================================</span>');

  for (let i = 0; i < demoSteps.length; i++) {
    if (!isDemoRunning) break;

    const step = demoSteps[i];
    const stepNum = i + 1;
    const progressText = `Step ${stepNum}/${demoSteps.length}: ${step.label}`;

    setStatus(`Step ${stepNum}/${demoSteps.length}`, true);
    if (terminalTitle) terminalTitle.innerText = `[Step ${stepNum}/24] ${step.label}`;
    appendToTerminal(`[Step ${stepNum} of ${demoSteps.length}] ${step.label}`, false, true);

    if (step.action === "bankers") {
      await runBankers();
    } else {
      await runCommand(step.cmd);
    }

    if (isDemoRunning && i < demoSteps.length - 1) {
      await sleep(900);
    }
  }

  if (isDemoRunning) {
    appendToTerminal('<span class="ansi-green">========================================================================\nDemonstration Completed Successfully.\nAll 24 operations simulated across Process, CPU, Memory, Sync, Paging & Disk.\n========================================================================</span>');
    setStatus("Ready", false);
  }

  isDemoRunning = false;
  setDemoButton(false);
  if (terminalTitle) terminalTitle.innerText = "MiniOS Console (Terminal Output)";
}

async function resetSession() {
  if (isDemoRunning) {
    isDemoRunning = false;
    setDemoButton(false);
  }
  setStatus("Restarting...", true);

  if (useLocalServer) {
    try {
      await fetch("/api/reset", { method: "POST" });
    } catch {}
  }
  StandaloneOS.reset();
  appendToTerminal('<span class="ansi-yellow">[MiniOS session restarted]</span>');
  if (typeof refreshProcessTable === "function") refreshProcessTable();
  if (typeof setMemoryMap === "function") setMemoryMap(useLocalServer ? await localCommandOutput("mem_status") : StandaloneOS.memStatus());
  setStatus("Ready", false);
}

function clearTerminal() {
  terminal.innerHTML = "";
}

function copyTerminalText() {
  navigator.clipboard.writeText(terminal.innerText).then(() => {
    setStatus("Copied to clipboard!");
    setTimeout(() => setStatus("System Ready"), 2000);
  });
}

function handleCliSend() {
  const cmd = cliInput.value.trim();
  if (!cmd) return;

  cmdHistory.push(cmd);
  historyIndex = cmdHistory.length;

  runCommand(cmd);
  cliInput.value = "";
}

cliInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    handleCliSend();
  } else if (e.key === "ArrowUp") {
    if (cmdHistory.length > 0 && historyIndex > 0) {
      historyIndex--;
      cliInput.value = cmdHistory[historyIndex];
    }
  } else if (e.key === "ArrowDown") {
    if (historyIndex < cmdHistory.length - 1) {
      historyIndex++;
      cliInput.value = cmdHistory[historyIndex];
    } else {
      historyIndex = cmdHistory.length;
      cliInput.value = "";
    }
  }
});

// ============================================================================
// Mission Control presentation layer. This reads existing simulator output and
// state; it does not implement or modify any OS algorithm.
// ============================================================================
const moduleMeta = {
  processes: ["SYSTEM / PROCESS TABLE", "Process management", "Create processes and watch their state move through the system."],
  cpu: ["SYSTEM / CPU SCHEDULER", "CPU scheduling", "Compare dispatch policies and inspect their execution timelines."],
  memory: ["SYSTEM / MEMORY MANAGER", "Memory management", "Inspect allocation placement and free space across the 1024 MB arena."],
  sync: ["SYSTEM / CONCURRENCY", "Synchronization", "Follow shared resource flow and check process safety."],
  paging: ["SYSTEM / VIRTUAL MEMORY", "Page replacement", "Trace page references through the configured frame set."],
  disk: ["SYSTEM / STORAGE I/O", "Disk scheduling", "See how scheduling policies move the disk head across cylinders."],
};
const processColors = ["#59d7c4", "#82b9ee", "#edbd73", "#c69be5", "#f18b88", "#87d9a9"];
let activeModule = "processes";
let ganttTimer = null;
let ganttIndex = -1;
let resizeStart = null;
const $ = (id) => document.getElementById(id);
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const plainOutput = (value) => String(value || "").replace(/\x1b\[[0-9;]*m/g, "");
function showToast(message) {
  const region = $("toastRegion"); if (!region) return;
  const item = document.createElement("div"); item.className = "toast"; item.textContent = message; region.appendChild(item);
  setTimeout(() => item.remove(), 3200);
}
function navigateModule(name) {
  if (!moduleMeta[name]) return;
  activeModule = name;
  document.querySelectorAll("[data-nav]").forEach((button) => {
    const selected = button.dataset.nav === name;
    button.classList.toggle("is-active", selected);
    if (selected) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
  });
  document.querySelectorAll("[data-view]").forEach((view) => {
    const selected = view.dataset.view === name;
    view.hidden = !selected; view.classList.toggle("is-visible", selected);
  });
  const [eyebrow, title, description] = moduleMeta[name];
  $("moduleEyebrow").textContent = eyebrow; $("moduleTitle").textContent = title; $("moduleDescription").textContent = description;
  $("terminalTitle").textContent = `${title} / MiniOS shell`;
  if (name === "processes") refreshProcessTable();
}
function colorFor(name) { let n = 0; for (const c of String(name)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return processColors[n % processColors.length]; }
function renderProcesses(rows) {
  const table = $("processTable"); if (!table) return;
  const processes = rows || [];
  $("drawerProcessCount").textContent = String(processes.length);
  $("metricProcessCount").textContent = String(processes.length).padStart(2, "0");
  const ready = processes.filter((p) => /ready|new/i.test(p.state)).length;
  const running = processes.filter((p) => /running/i.test(p.state)).length;
  $("metricReadyCount").textContent = String(ready).padStart(2, "0");
  $("metricRunningCount").textContent = String(running).padStart(2, "0");
  $("processEmpty").hidden = processes.length > 0;
  $("processActivity").hidden = processes.length === 0;
  $("processActivity").innerHTML = processes.map((p) => `<div class="activity-row"><i class="activity-dot" style="background:${colorFor(p.name)}"></i><strong>${escapeHtml(p.name)}</strong><span>PID ${escapeHtml(p.pid)} · burst ${escapeHtml(p.burst)} ms</span><span class="activity-state">${escapeHtml(p.state)}</span></div>`).join("");
  if (!processes.length) { table.innerHTML = '<div class="table-empty"><span>—</span><p>Process table is empty.</p><button class="text-button" onclick="loadSampleProcesses()">Load sample P1–P5</button></div>'; return; }
  table.innerHTML = processes.map((p) => `<div class="process-row"><div class="process-name"><i class="process-color" style="--segment-color:${colorFor(p.name)};background:${colorFor(p.name)}"></i><span>${escapeHtml(p.pid)} / ${escapeHtml(p.name)}</span></div><span class="process-state">${escapeHtml(p.state)}</span><span class="process-burst">${escapeHtml(p.burst)}</span></div>`).join("");
}
function parseProcesses(text) {
  return plainOutput(text).split("\n").map((line) => {
    const m = line.match(/^\s*(\d+)\s+([\w-]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(READY|RUNNING|BLOCKED|WAITING|TERMINATED)\b/i);
    return m ? {pid:m[1],name:m[2],burst:m[3],remaining:m[4],state:m[7].toUpperCase()} : null;
  }).filter(Boolean);
}
async function localCommandOutput(command) {
  try { const res = await fetch("/api/cmd", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({command,timeout:4})}); if (!res.ok) return null; const data = await res.json(); return data.output || ""; } catch { return null; }
}
async function refreshProcessTable() {
  if (!useLocalServer) { renderProcesses(StandaloneOS.processes); return; }
  const output = await localCommandOutput("list");
  if (output !== null) renderProcesses(parseProcesses(output));
}
function setResult(id, content) { const el = $(id); if (el) el.innerHTML = `<div class="result-content">${content}</div>`; }
function parseGantt(output) {
  const lines = plainOutput(output).split("\n");
  const start = lines.findIndex((line) => /Gantt Chart:/i.test(line)); if (start < 0) return null;
  const segmentLine = lines.slice(start + 1).find((line) => (line.match(/\|/g) || []).length >= 2 && /[A-Za-z]/.test(line));
  if (!segmentLine) return null;
  const names = segmentLine.split("|").map((s) => s.trim()).filter(Boolean);
  const below = lines.slice(start + 1 + lines.slice(start + 1).indexOf(segmentLine));
  let times = [];
  for (const line of below.slice(1, 5)) { const nums = line.match(/\d+/g); if (nums && nums.length === names.length + 1) { times = nums.map(Number); break; } }
  const source = StandaloneOS.processes;
  const durations = names.map((name, i) => Math.max(1, times.length ? times[i + 1] - times[i] : (source.find((p) => p.name === name)?.burst || 1)));
  return {names, times:times.length ? times : durations.reduce((a,d)=>{a.push(a[a.length-1]+d);return a;},[0]), durations};
}
function renderGantt(data) {
  const root = $("ganttChart"); if (!data || !data.names.length) { root.innerHTML = '<div class="chart-empty">Run a scheduler to draw its execution timeline.</div>'; return; }
  clearInterval(ganttTimer); ganttIndex = -1;
  root.setAttribute("aria-label", `CPU execution timeline: ${data.names.join(", ")}`);
  root.innerHTML = `<div class="gantt-track">${data.names.map((name,i)=>`<div class="gantt-segment" data-index="${i}" style="--duration:${data.durations[i]};--segment-color:${colorFor(name)}" title="${escapeHtml(name)} · ${data.times[i]}–${data.times[i+1]} ms">${escapeHtml(name)}<span class="gantt-time">${data.times[i]}</span>${i===data.names.length-1?`<span class="gantt-time">${data.times[i+1]}</span>`:""}</div>`).join("")}</div>`;
  $("scheduleState").textContent = `${data.names.length} DISPATCHES`;
  const output = window.__lastScheduleOutput || "";
  const wt = output.match(/Average Waiting Time\s*:\s*([\d.]+)/i), tat = output.match(/Average Turnaround Time\s*:\s*([\d.]+)/i);
  $("cpuResults").innerHTML = `<div class="metrics-strip" style="border:0;margin:0;padding:0"><div class="metric"><span>ALGORITHM</span><strong style="font-size:14px">${escapeHtml((output.match(/==========\s*(.*?)\s*Scheduling/i)||[])[1]||"SCHEDULE")}</strong></div><div class="metric"><span>AVG WAIT</span><strong>${wt?wt[1]:"—"}<small> ms</small></strong></div><div class="metric"><span>AVG TURNAROUND</span><strong>${tat?tat[1]:"—"}<small> ms</small></strong></div></div>`;
  updatePlayback();
}
function updatePlayback() { const segments = [...document.querySelectorAll(".gantt-segment")]; segments.forEach((el,i)=>{el.classList.toggle("is-pending",i>ganttIndex);el.classList.toggle("is-current",i===ganttIndex)}); $("playbackLabel").textContent = `${Math.max(0,ganttIndex+1)} / ${segments.length} steps`; }
function stepSchedule() { const count = document.querySelectorAll(".gantt-segment").length; if (!count) return; ganttIndex = (ganttIndex + 1) % count; updatePlayback(); }
function setMemoryMap(output) {
  const clean = plainOutput(output); const re = /\[\s*(\d+)\s*-\s*(\d+)\]\s+(\S+)\s+(\d+)\s+MB\s+(ALLOCATED|FREE)/g; const blocks=[]; let m;
  while ((m=re.exec(clean))) blocks.push({start:+m[1],end:+m[2],name:m[3]==="---"?"":m[3],size:+m[4],allocated:m[5]==="ALLOCATED"});
  if (!blocks.length) return;
  const allocated=blocks.filter(b=>b.allocated).reduce((s,b)=>s+b.size,0), free=blocks.filter(b=>!b.allocated).reduce((s,b)=>s+b.size,0), holes=blocks.filter(b=>!b.allocated).map(b=>b.size), largest=Math.max(0,...holes), fragmentation=free?Math.round((1-largest/free)*100):0;
  $("memoryUsageTag").textContent = `${Math.round(allocated/10.24)}% IN USE`;
  $("processAllocated").innerHTML=`${allocated} <small>MB</small>`;
  $("memoryAllocated").innerHTML=`${allocated} <small>MB</small>`; $("memoryFree").innerHTML=`${free} <small>MB</small>`; $("memoryFragmentation").innerHTML=`${fragmentation}<small>%</small>`;
  $("memoryBar").innerHTML=blocks.map(b=>`<div class="memory-segment ${b.allocated?"allocated-segment":"free-segment"}" style="width:${b.size/10.24}%;--segment-color:${b.allocated?colorFor(b.name):"var(--faint)"}" title="${b.allocated?escapeHtml(b.name)+" allocated":"Free"}: ${b.size} MB, ${b.start}–${b.end} MB"><span>${b.allocated?escapeHtml(b.name):"FREE"} / ${b.size} MB</span></div>`).join("");
  $("memoryLegend").innerHTML=blocks.filter(b=>b.allocated).map(b=>`<span><i style="--segment-color:${colorFor(b.name)}"></i>${escapeHtml(b.name)} · ${b.size} MB</span>`).join("")+`<span><i class="legend-free"></i>Free · ${free} MB</span>`;
}
function renderPage(output) {
  const clean=plainOutput(output); const records=[]; const re=/^\s*(\d+)\s+\[\s*([^\]]+?)\s*\]\s+(HIT|FAULT)\s*$/gm; let m;
  while((m=re.exec(clean))) records.push({ref:m[1],frames:m[2].split(",").map(x=>x.trim()),status:m[3]});
  if(!records.length)return;
  const frameCount=Math.max(...records.map(r=>r.frames.length));
  $("pageTrace").innerHTML=`<table class="trace-table"><thead><tr><th>REF</th>${records.map((r,i)=>`<th>${escapeHtml(r.ref)}</th>`).join("")}</tr></thead><tbody>${Array.from({length:frameCount},(_,row)=>`<tr><th>F${row+1}</th>${records.map(r=>`<td class="${r.status.toLowerCase()}">${escapeHtml(r.frames[row]||"–")}</td>`).join("")}</tr>`).join("")}<tr><th>STATE</th>${records.map(r=>`<td class="${r.status.toLowerCase()}">${r.status==="HIT"?"H":"F"}</td>`).join("")}</tr></tbody></table>`;
  const faults=(clean.match(/Total Page Faults:\s*(\d+)/i)||[])[1], ratio=(clean.match(/Hit Ratio:\s*([\d.]+%)/i)||[])[1];
  $("pageTitle").textContent=`${(clean.match(/==========\s*(\w+)/)||[])[1]||"Page"} trace`; $("pageStatus").textContent=`${records.length} REFERENCES`; $("pageReferenceCount").textContent=records.length; $("pageFaultCount").textContent=faults||records.filter(r=>r.status==="FAULT").length; $("pageHitRatio").textContent=ratio||"—";
  setResult("pageResult",`<strong>${escapeHtml($("pageFaultCount").textContent)} page faults</strong> · ${records.length} references · hits and faults shown in the frame trace.`);
}
function renderDisk(output) {
  const clean=plainOutput(output), match=clean.match(/Seek Order:\s*([\d\s>\-]+)/i); if(!match)return;
  const order=match[1].split(/\s*->\s*/).map(Number).filter(Number.isFinite), dist=(clean.match(/Total Seek Time:\s*(\d+)/i)||[])[1]; if(order.length<2)return;
  const width=680,height=160,pad=35,x=i=>pad+i*(width-pad*2)/(order.length-1),y=v=>height-20-v/199*(height-45);
  const points=order.map((v,i)=>`${x(i)},${y(v)}`).join(" ");
  $("diskChart").innerHTML=`<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Disk head seeks through cylinders ${order.join(", ")}"><line class="disk-axis" x1="${pad}" y1="${height-20}" x2="${width-pad}" y2="${height-20}"/><line class="disk-grid" x1="${pad}" y1="${y(100)}" x2="${width-pad}" y2="${y(100)}"/><polyline class="disk-path" points="${points}"/>${order.map((v,i)=>`<circle class="disk-point ${i===0?"first":""}" cx="${x(i)}" cy="${y(v)}" r="4"/><text class="disk-label ${i===0?"head":""}" x="${x(i)}" y="${y(v)-9}" text-anchor="middle">${v}</text>`).join("")}<text class="disk-label" x="${pad}" y="${height-3}">START</text><text class="disk-label" x="${width-pad}" y="${height-3}" text-anchor="end">SEEK ORDER →</text></svg>`;
  $("diskTitle").textContent=`${order.length-1} head movements`; $("diskStatus").textContent="SCHEDULE COMPLETE"; $("diskRequestCount").textContent=Math.max(0,order.length-1); $("diskSeekDistance").textContent=dist||"—"; $("diskAlgorithm").textContent=(clean.match(/==========\s*(.*?)\s+Disk Scheduling/i)||[])[1]||"—";
  setResult("diskResult",`<strong>Seek order</strong> · ${order.join(" → ")}<br><strong>Total movement</strong> · ${dist||"—"} cylinders`);
}
function renderBankers(output) {
  const clean=plainOutput(output), match=clean.match(/Safe Sequence:\s*<\s*([^>]+)\s*>/i); if(!match)return;
  const sequence=match[1].split(/\s*->\s*/);
  $("syncTitle").textContent="Banker’s safety sequence"; $("syncStatus").textContent=/SAFE state/i.test(clean)?"SAFE STATE":"CHECK COMPLETE";
  $("syncVisual").innerHTML=`<div class="safe-sequence">${sequence.map((p,i)=>`${i?'<span class="safe-arrow">→</span>':''}<span class="safe-node">${escapeHtml(p)}</span>`).join("")}</div>`;
  $("syncMetrics").innerHTML=`<div><span>PROCESSES</span><strong>${sequence.length}</strong></div><div><span>STATE</span><strong>${/SAFE state/i.test(clean)?"SAFE":"CHECK"}</strong></div><div><span>SEQUENCE</span><strong>VALID</strong></div>`;
  setResult("syncResult",`<strong>${/SAFE state/i.test(clean)?"Safe state":"Safety check complete"}</strong> · ${sequence.join(" → ")}`);
}
function renderProducerConsumer(output) {
  const clean=plainOutput(output); if(!/Producer-Consumer Problem/.test(clean))return;
  const last=clean.match(/\d+\s+\w+\s+\d+\s+\d+\s+1\s+\[([^\]]+)\]/g)?.slice(-1)[0];
  const slots=last?last.match(/\[([^\]]+)\]/)[1].split(","):[];
  $("syncTitle").textContent="Producer–Consumer buffer"; $("syncStatus").textContent="10 STEPS COMPLETE";
  $("syncVisual").innerHTML=`<div class="sync-empty"><div class="sync-flow"><span>PRODUCER</span><b>→</b>${slots.map(v=>`<span class="buffer-slot">${v==="_"?"□":escapeHtml(v)}</span>`).join("")}<b>→</b><span>CONSUMER</span></div><p>Final buffer state from the simulation trace.</p></div>`;
  const lastline=clean.trim().split("\n").filter(line=>/\d+\s+\w+\s+\d+\s+\d+\s+1\s+\[/.test(line)).pop()||""; const nums=lastline.match(/\d+/g)||[];
  $("syncMetrics").innerHTML=`<div><span>EMPTY</span><strong>${nums[1]||"—"}</strong></div><div><span>FULL</span><strong>${nums[2]||"—"}</strong></div><div><span>MUTEX</span><strong>1</strong></div>`;
  setResult("syncResult","<strong>Producer–Consumer simulation complete</strong> · bounded buffer state summarized from terminal output.");
}
function updateMiniOSViews(command, output) {
  const cmd=command.toLowerCase(), clean=plainOutput(output);
  $("historyCount").textContent=`HISTORY ${String(cmdHistory.length).padStart(2,"0")}`;
  if (/^(create|kill|clear_all|list)\b/.test(cmd)) refreshProcessTable();
  if (/^schedule\s+/.test(cmd) && !/compare/.test(cmd)) {
    window.__lastScheduleOutput=clean; const data=parseGantt(clean); if(data) renderGantt(data);
  }
  if (/^mem_(alloc|free|reset|status)\b/.test(cmd)) {
    if (/^mem_status\b/.test(cmd)) setMemoryMap(clean);
    else if (useLocalServer) localCommandOutput("mem_status").then(setMemoryMap);
    else setMemoryMap(StandaloneOS.memStatus());
    setResult("memoryResult",escapeHtml(clean.trim()));
  }
  if (/^page\s+/.test(cmd) && !/compare/.test(cmd)) renderPage(clean);
  if (/^disk\s+/.test(cmd) && !/compare/.test(cmd)) renderDisk(clean);
  if (/^bankers\b/.test(cmd)) renderBankers(clean);
  if (/^producer_consumer\b/.test(cmd)) renderProducerConsumer(clean);
}

// Navigation and responsive controls
const navButtons=[...document.querySelectorAll(".rail-item[data-nav]")];
navButtons.forEach((button,index)=>button.addEventListener("click",()=>navigateModule(button.dataset.nav)));
document.querySelectorAll("[data-nav].brand").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();navigateModule("processes")}));
$("themeToggle").addEventListener("click",()=>{const next=document.documentElement.dataset.theme==="dark"?"light":"dark";document.documentElement.dataset.theme=next;localStorage.setItem("minios-theme",next);$("themeToggle").setAttribute("aria-label",`Switch to ${next==="dark"?"light":"dark"} theme`)});
const savedTheme=localStorage.getItem("minios-theme"); if(savedTheme)document.documentElement.dataset.theme=savedTheme;
$("consoleToggle").addEventListener("click",()=>{const dock=$("consoleDock"), collapsed=dock.classList.toggle("is-collapsed");$("consoleToggle").innerHTML=collapsed?'Expand <span>⌃</span>':'Collapse <span>⌄</span>';$("consoleToggle").setAttribute("aria-expanded",String(!collapsed))});
$("dockResize").addEventListener("pointerdown",e=>{resizeStart={y:e.clientY,height:$("consoleDock").getBoundingClientRect().height};e.currentTarget.setPointerCapture(e.pointerId)});
$("dockResize").addEventListener("pointermove",e=>{if(!resizeStart)return;const height=Math.max(140,Math.min(innerHeight*.7,resizeStart.height+resizeStart.y-e.clientY));$("consoleDock").style.height=`${height}px`});
$("dockResize").addEventListener("pointerup",()=>resizeStart=null);
$("dockResize").addEventListener("keydown",e=>{if(e.key==="ArrowUp"||e.key==="ArrowDown"){e.preventDefault();const d=$("consoleDock"), delta=e.key==="ArrowUp"?24:-24;d.style.height=`${Math.max(140,Math.min(innerHeight*.7,d.getBoundingClientRect().height+delta))}px`}});
$("playSchedule").addEventListener("click",()=>{if(ganttTimer){clearInterval(ganttTimer);ganttTimer=null;$("playSchedule").textContent="▶";return}if(!document.querySelector(".gantt-segment"))return;if(ganttIndex>=document.querySelectorAll(".gantt-segment").length-1)ganttIndex=-1;$("playSchedule").textContent="Ⅱ";const speed=Number($("playbackSpeed").value)||1;ganttTimer=setInterval(()=>{if(ganttIndex>=document.querySelectorAll(".gantt-segment").length-1){clearInterval(ganttTimer);ganttTimer=null;$("playSchedule").textContent="▶";return}stepSchedule()},700/speed)});
$("stepSchedule").addEventListener("click",stepSchedule);

// Command palette
const palette=$("paletteBackdrop"), paletteInput=$("paletteInput"), paletteList=$("paletteItems");
function openPalette(){palette.hidden=false;paletteInput.value="";filterPalette();paletteInput.focus()}
function closePalette(){palette.hidden=true;$("paletteTrigger").focus()}
function filterPalette(){const query=paletteInput.value.trim().toLowerCase();paletteList.querySelectorAll("button").forEach(b=>{b.hidden=!b.textContent.toLowerCase().includes(query);b.classList.remove("is-selected")});const first=paletteList.querySelector("button:not([hidden])");if(first)first.classList.add("is-selected")}
$("paletteTrigger").addEventListener("click",openPalette);paletteInput.addEventListener("input",filterPalette);
palette.addEventListener("click",e=>{if(e.target===palette)closePalette()});
paletteList.addEventListener("click",e=>{const b=e.target.closest("button[data-command]");if(!b)return;const [kind,arg]=b.dataset.command.split(":");closePalette();if(kind==="nav")navigateModule(arg);else if(arg==="demo")toggleFullDemo();else if(arg==="console")$("consoleToggle").click()});
paletteInput.addEventListener("keydown",e=>{const buttons=[...paletteList.querySelectorAll("button:not([hidden])")],index=buttons.indexOf(paletteList.querySelector(".is-selected"));if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();buttons.forEach(b=>b.classList.remove("is-selected"));if(buttons.length)buttons[(index+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length].classList.add("is-selected")}else if(e.key==="Enter"){e.preventDefault();(paletteList.querySelector(".is-selected")||buttons[0])?.click()}else if(e.key==="Escape")closePalette()});
$("helpTrigger").addEventListener("click",()=>$("helpBackdrop").hidden=false);$("closeHelp").addEventListener("click",()=>$("helpBackdrop").hidden=true);$("helpBackdrop").addEventListener("click",e=>{if(e.target===$("helpBackdrop"))$("helpBackdrop").hidden=true});
document.addEventListener("keydown",e=>{const editing=/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openPalette()}else if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="j"){e.preventDefault();$("consoleToggle").click()}else if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){e.preventDefault();toggleFullDemo()}else if(e.key==="Escape"){if(!palette.hidden)closePalette();$("helpBackdrop").hidden=true}else if(!editing&&e.key==="?"){$("helpBackdrop").hidden=false}else if(!editing&&(e.key==="ArrowRight"||e.key==="ArrowLeft")){const i=Object.keys(moduleMeta).indexOf(activeModule);navigateModule(Object.keys(moduleMeta)[(i+(e.key==="ArrowRight"?1:-1)+6)%6])}else if(!editing&&e.code==="Space"&&activeModule==="cpu"){e.preventDefault();stepSchedule()}});

// Command hints and Tab completion
const knownCommands=["help","list","clear_all","create","kill","schedule fcfs","schedule sjf","schedule rr","schedule priority","schedule mlfq","schedule compare","mem_alloc","mem_free","mem_status","mem_reset","producer_consumer","bankers","page fifo","page lru","page optimal","page compare","disk fcfs","disk sstf","disk scan","disk cscan","disk compare"];
function updateCompletion(){const value=cliInput.value.trim().toLowerCase(), hint=$("completionHint");if(!value){hint.hidden=true;return}const matches=knownCommands.filter(c=>c.startsWith(value));hint.hidden=!matches.length;hint.textContent=matches.slice(0,3).join("   ·   ")}
cliInput.addEventListener("input",updateCompletion);
cliInput.addEventListener("keydown",e=>{if(e.key==="Tab"){const value=cliInput.value.trim().toLowerCase(),match=knownCommands.find(c=>c.startsWith(value));if(match){e.preventDefault();cliInput.value=match+" ";updateCompletion()}}});

// Boot transition and first-use guided tour
function dismissBoot(){setTimeout(()=>$("bootScreen").classList.add("is-done"),420)}
if(useLocalServer){fetch("/health").then(r=>{if(!r.ok)throw Error("health");$("bootMessage").textContent="Kernel ready"}).catch(()=>{$("bootMessage").textContent="Starting local simulator"}).finally(dismissBoot)}else{$("bootMessage").textContent="Standalone simulator ready";dismissBoot()}
setInterval(()=>{$("clockReadout").textContent=new Date().toLocaleTimeString([], {hour12:false})},1000);$("clockReadout").textContent=new Date().toLocaleTimeString([], {hour12:false});
if(useLocalServer) refreshProcessTable(); else renderProcesses(StandaloneOS.processes);
if(useLocalServer) localCommandOutput("mem_status").then(setMemoryMap); else setMemoryMap(StandaloneOS.memStatus());
if(!localStorage.getItem("minios-tour-seen"))setTimeout(()=>{
  let step=0;const tour=["Welcome to MiniOS Mission Control. Start in the process table and load sample jobs.","Choose CPU, memory, sync, paging, or disk from the module rail.","Visual timelines and state maps appear beside each module’s controls.","The terminal stays available below. Use ⌘K to jump to any module."];
  const region=$("toastRegion"),dialog=document.createElement("div");dialog.className="tour-card";dialog.setAttribute("role","dialog");dialog.setAttribute("aria-live","polite");document.body.appendChild(dialog);
  const draw=()=>{dialog.innerHTML=`<span class="eyebrow">QUICK TOUR · ${step+1} / ${tour.length}</span><p>${tour[step]}</p><div><button class="text-button" data-tour-skip>Skip</button><button class="button button-primary" data-tour-next>${step===tour.length-1?"Finish":"Next"}</button></div>`};
  const done=()=>{dialog.remove();localStorage.setItem("minios-tour-seen","1")};dialog.addEventListener("click",e=>{if(e.target.closest("[data-tour-skip]"))done();else if(e.target.closest("[data-tour-next]")){step++;if(step===tour.length)done();else draw()}});draw();
},900);
