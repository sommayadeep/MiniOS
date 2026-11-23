# MiniOS Mission Control

The MiniOS browser UI presents the existing operating systems simulator as a focused, responsive workspace. It keeps process management, CPU scheduling, memory allocation, synchronization, paging, disk scheduling, and the command terminal available through one consistent shell.

## Run locally

From the repository root:

```bash
python3 ui/app.py
```

Open [http://127.0.0.1:5050](http://127.0.0.1:5050). The Python bridge uses the standard library. When the backend is unavailable, the page falls back to its existing in-browser simulator.

## Workspace

- **Processes:** create jobs, load sample processes, inspect state, and terminate by PID.
- **CPU scheduling:** run FCFS, SJF, Priority, MLFQ, or Round Robin, then play or step through the Gantt timeline.
- **Memory:** allocate/free blocks and inspect the memory map and free-space fragmentation.
- **Synchronization:** inspect the bounded-buffer trace or Banker’s safe sequence.
- **Paging:** trace frame contents and hits/faults for FIFO, LRU, or Optimal.
- **Disk:** view head movement and total seek distance for FCFS, SSTF, SCAN, and C-SCAN.
- **Terminal:** run existing MiniOS CLI commands, recall history with ↑/↓, and use Tab for command completion.

The terminal remains the complete command output. The charts summarize output returned by the simulator and do not replace the algorithms.

## Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘/Ctrl + K` | Open the command palette |
| `⌘/Ctrl + Enter` | Run the full demonstration |
| `⌘/Ctrl + J` | Collapse or expand the terminal |
| `← / →` | Move between modules when focus is outside a field |
| `Space` | Step the CPU timeline when focus is outside a field |
| `?` | Open shortcut help |

## Design and implementation

See [`../DESIGN.md`](../DESIGN.md) for the experience audit, interaction model, design tokens, layout sketch, accessibility choices, and implementation boundaries. The UI adds no JavaScript package dependencies. The simulator commands, API, algorithms, C modules, Python bridge, and CLI remain the sources of behavior.
