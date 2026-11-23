# MiniOS — Operating System Simulator

MiniOS is an interactive operating systems simulator built with **C** and a lightweight **Python** web server. It provides hands-on demonstrations of core OS concepts through a terminal interface and a browser-based dashboard.

**Live demo:** [minios-cktq.onrender.com](https://minios-cktq.onrender.com) · **Health:** [`/health`](https://minios-cktq.onrender.com/health) · **Course project:** CSE302 — Operating Systems

> The live demo uses Render’s free service and may take up to a minute to wake after inactivity.

## Highlights

- Process creation, state transitions, listing, and termination
- CPU scheduling: FCFS, SJF, Round Robin, Priority, and MLFQ
- Memory allocation: First Fit, Best Fit, and Worst Fit, with a visual memory map
- Synchronization demonstrations: Producer–Consumer and Banker’s Algorithm
- Page replacement: FIFO, LRU, and Optimal
- Disk scheduling: FCFS, SSTF, SCAN, and C-SCAN
- Interactive browser dashboard with a live command console

## Run locally

### Requirements

- Python 3
- GCC or another C99-compatible compiler
- GNU Make

### Build and launch

```bash
make
./minios
```

To launch the web dashboard instead:

```bash
python3 ui/app.py
```

Open [http://127.0.0.1:5050](http://127.0.0.1:5050). The Python server uses only the standard library. On first launch, it compiles and starts the MiniOS binary for interactive commands.

Example terminal commands:

```text
minios> help
minios> create P1 5 2
minios> list
minios> schedule rr
minios> exit
```

## Health monitoring

`GET /health` returns HTTP 200 and a small JSON response with the service status, service name, and UTC timestamp. It does not run OS simulation algorithms.

The repository includes an optional GitHub Actions workflow at `.github/workflows/render-keepalive.yml`. It requests the health endpoint every 10 minutes and can also be run manually. Configure the repository secret `RENDER_SERVICE_URL` with the Render service’s base URL (without `/health`). To stop scheduled requests, disable **Render Keep-Alive** in the repository’s **Actions** tab or remove the workflow file.

## Deployment

The web service runs in Docker. The image builds the React frontend with Vite, then runs the existing Python server and C simulator. Render uses `render.yaml` and the Dockerfile. For manual Render setup, select **Docker** as the runtime; no separate Build Command or Start Command is needed because both are defined in the Dockerfile. The server listens on Render’s `PORT` environment variable and serves the generated `dist/` assets. The current live instance may still be running the previous frontend until a new deployment is triggered.

For an Oracle Cloud Always Free VM deployment, see [ORACLE_DEPLOY.md](ORACLE_DEPLOY.md). Confirm the eligibility and cost of selected resources in your cloud account before provisioning.

## Project structure

```text
include/    C module interfaces
src/        OS simulation and command-line implementation
ui/         Python HTTP server and legacy browser dashboard
src/        React, TypeScript, modules, shared state, and simulator UI
package.json Vite scripts and frontend dependencies
docs/       Project report
Dockerfile  Container build configuration
render.yaml Render Blueprint configuration
```

## Technology

- **Core:** C99
- **Web server:** Python standard library (`http.server`)
- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Zustand, React Flow
- **Deployment:** Docker and Render

## Author

**Sommayadeep Saha**

## License

No license is currently specified. Contact the author before reusing or redistributing this project.
