# MiniOS Mission Control

## Design direction
A dark-first instrument workspace for learning OS concepts by watching system state change. Students can keep the terminal output close to its visual context, arrange their work area, and present a focused simulation. Teal is reserved for active controls and process identity; green, amber, and red communicate system states.

## Tokens

| Role | Token |
| --- | --- |
| Canvas | `#101716` |
| Panel | `#18211f` |
| Raised panel | `#202a27` |
| Borders | `#2a3935` |
| Signal | `#64d8bd` |
| Ready | `#82d5a5` |
| Waiting | `#e9bd70` |
| Error | `#ed827b` |
| Display | Space Grotesk |
| Interface | Geist Sans |
| Data | JetBrains Mono |

Tailwind tokens are in `tailwind.config.js`; theme variables are in `src/styles/main.css`. Fonts are bundled locally through Fontsource. Use 4px spacing increments, 3–7px radii, thin inner borders, and reserve glow for active state.

## Components and layout

- `src/App.tsx`: top controls, module rail, canvas windows, process table, console, tour, presentation overlay.
- `src/store/useMiniOS.ts`: Zustand global workspace, theme, process list, console output.
- `src/lib/api.ts`: adapter for the unchanged MiniOS HTTP commands.
- `src/engine`: typed step model and algorithm presentation adapters.
- `src/modules`: module-specific controls and visuals.

```text
┌ Top bar: status · demo · restart · theme · present ────────────────────┐
│ Rail │ Infinite dotted canvas                                         │
│      │  ┌ Module controls ───────┐  ┌ Flow / visual ───────────────┐  │
│      │  └ draggable window ──────┘  └ draggable window ────────────┘  │
│      │  ┌ Persistent process table ─────────────────────────────────┐  │
├──────┴──── Resizable console dock ──────────────────────────────────┤
└───────────────────────────────────────────────────────────────────────┘
```

On small screens the rail moves to a bottom tab strip and the workspace is constrained to a stacked layout. Reduced motion and visible focus outlines are maintained in the UI styles.

## Before and after

The previous UI stacked module controls and relied on terminal text for feedback. The React workspace introduces module navigation, movable canvas windows, a persistent process panel, local fonts, theme switching, and presentation/evaluator controls. The C simulator remains the source of algorithm behavior; the React interface calls the same Python API routes.
