# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is InviNotes

An Electron desktop app that combines **screen-share invisibility** (`setContentProtection`) with **real-time collaborative notes** (Yjs CRDT over WebSocket). The window is hidden from Zoom/Meet/Teams screen captures. Users share an `invinotes://join/<roomId>` deep link to collaborate on rich text + code in real time.

Research doc with OS-level invisibility details: `InVinotes.docx` in project root. Full handover doc: `HANDOVER.md`.

## Commands

```bash
# Both server and app must run simultaneously for collaboration to work

# Terminal 1 — Yjs WebSocket server (port 1234)
npm run server

# Terminal 2 — Electron app
npm start

# Second client for local collab testing (bypasses single-instance lock)
npm run start:peer

# Dev mode (esbuild watch + DevTools)
npm run dev

# Build renderer bundle only (no Electron launch)
npm run build

# Production build (points to Fly.io server)
npm run build:prod

# Package distributables
npm run dist:mac    # .dmg
npm run dist:win    # .exe (NSIS)
```

The server has its own `package.json` in `server/` (ESM, separate `node_modules`). Install its deps with `cd server && npm install`.

## Architecture

### Two-process Electron app + standalone server

```
src/main/main.js          → Electron main process (CommonJS)
src/preload/preload.js     → IPC bridge (contextIsolation: true)
src/renderer/              → Renderer (browser, bundled by esbuild)
server/server.js           → Standalone Yjs WebSocket server (ESM)
```

### Renderer bundle pipeline

`src/renderer/app.js` is the entry point. esbuild (`build.js`, CommonJS) bundles it into `src/renderer/bundle.js` (IIFE, target: chrome120). **Never edit `bundle.js` directly** — it's gitignored and regenerated on every build. The `SERVER_URL` env var is injected at build time via `define`.

### Editor stack

TipTap (ProseMirror) with these extensions:
- **StarterKit** (minus `codeBlock`, minus `history` in collab mode)
- **CodeBlockLowlight** — syntax highlighting via lowlight/highlight.js
- **TaskList + TaskItem** — Notion-style to-do checkboxes
- **Collaboration** — Yjs document binding
- **CollabCursors** — custom extension in `editor.js` using `yCursorPlugin` from `@tiptap/y-tiptap`
- **Placeholder** — dynamic per-node placeholder text

Two editor factory functions in `editor.js`: `createEditor()` (standalone) and `createCollabEditor()` (with Yjs). The collab version disables StarterKit's history since Yjs handles undo.

### Collaboration flow

`collaboration.js` → `CollaborationManager` wraps `Y.Doc` + `WebsocketProvider` (from `y-websocket`). Creates/joins rooms by UUID. Awareness tracks cursor positions, user names ("Swift Fox"), and colors.

The server (`server/server.js`) implements the Yjs sync protocol manually (not using `y-websocket/bin/utils` which was dropped in v3). Rooms auto-cleanup 30s after last client leaves. Persistence is stubbed out (LevelDB code exists in `persistence.js` but is commented out — currently in-memory only).

### UI structure

Notion-style dark theme. The titlebar has a **Share** button that opens a dropdown for room creation/joining (replaces the old toolbar-style room panel). The formatting toolbar element exists in HTML but is hidden via CSS (`display: none`) — keyboard shortcuts still work through it. A **slash command menu** (`slash-menu.js`) opens when typing `/` at the start of an empty block, offering block type selection (headings, lists, to-do, code, etc.).

### Deep links

Custom protocol `invinotes://join/<roomId>`. macOS uses `app.on('open-url')`, Windows uses `second-instance` event with argv parsing. The `--multi` flag (used by `npm run start:peer`) bypasses the single-instance lock for local testing.

## Critical constraints

**Electron pinned to 34.3.0.** Versions after 34.3.0 have regressions where `setContentProtection` fails or shows a black rectangle. Do not upgrade without testing invisibility on both macOS and Windows.

**TipTap collaboration cursor conflict.** `@tiptap/extension-collaboration` uses sync plugins from `@tiptap/y-tiptap`, while `@tiptap/extension-collaboration-cursor` uses plugins from `y-prosemirror`. Loading both causes a silent crash. The fix is the custom `CollabCursors` extension in `editor.js` — do not import `@tiptap/extension-collaboration-cursor`.

**`setContentProtection` must be re-applied** on `show` and `restore` events to avoid a black-rectangle bug. See `applyContentProtection()` in `main.js`.

**Main app is CommonJS, server is ESM.** The main app `package.json` has `"type": "commonjs"`. The server has its own `package.json` with `"type": "module"`. Renderer code uses ES module imports but is bundled by esbuild into IIFE.

## Deploy

Server target: Fly.io (`invinotes-server`). Config in `server/fly.toml`. Production WebSocket URL: `wss://invinotes-server.fly.dev`. The `SERVER_URL` env var at build time switches the client between local (`ws://localhost:1234`) and production.
