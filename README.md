# go-deck

**English** · [Português](README.pt-BR.md)

[![License: MIT](https://img.shields.io/github/license/mariombn/go-deck)](LICENSE)
[![Latest release](https://img.shields.io/github/v/release/mariombn/go-deck)](https://github.com/mariombn/go-deck/releases/latest)
[![Build](https://img.shields.io/github/actions/workflow/status/mariombn/go-deck/release.yml)](https://github.com/mariombn/go-deck/actions/workflows/release.yml)
[![Platforms](https://img.shields.io/badge/platforms-Windows%20%7C%20macOS-blue)](#installation)
[![Stars](https://img.shields.io/github/stars/mariombn/go-deck?style=social)](https://github.com/mariombn/go-deck/stargazers)

An open-source *Stream Deck*: a desktop app (**Windows & macOS**) that exposes
**multiple grids** of buttons on your local network. From your phone, via QR Code,
you open the grids in a browser and, on tapping a button, your computer runs the
configured action — from a **keyboard macro** to launching a program, opening a URL,
controlling **OBS Studio** or muting **Discord**.

No extra hardware. Your phone becomes the deck.

<!-- TODO: add a screenshot of the desktop editor and a short GIF of "tap on phone -> action on PC".
     Drop the files in docs/ and reference them here, e.g.:
     ![Desktop editor](docs/screenshot-editor.png)
     ![Demo](docs/demo.gif)
     This is the single highest-impact addition for new users — please add it before announcing. -->

---

## Installation

> You don't need to install Go, Node, or compile anything. Grab the prebuilt app:

**➡️ [Download the latest release](https://github.com/mariombn/go-deck/releases/latest)**

### Windows

1. Download `go-deck.exe`.
2. When you open it, Windows may show *"Windows protected your PC"* (because the
   app isn't code-signed yet). Click **More info → Run anyway**.
3. A window with the editor and the QR Code will open.

### macOS

1. Download `go-deck-macos.zip`, unzip it, and drag `go-deck.app` into Applications.
2. The first time, **right-click the app → Open** (it isn't notarized yet, so a
   normal double-click is blocked by Gatekeeper).
3. The app will ask for **Accessibility** permission (required to simulate the
   keyboard). Approve it in *System Settings → Privacy & Security → Accessibility*.

### Requirements

- **Windows 10/11** (WebView2 is already included on Windows 11).
- **macOS** (recent version).
- Phone and PC on the **same Wi-Fi network**.

> **Heads up on security:** go-deck has no authentication. Anyone on the same Wi-Fi
> who opens the URL can trigger the buttons you've already configured. Use it on
> your home/trusted network — not on public Wi-Fi. See
> [Security & known limitations](#security--known-limitations).

---

## Usage

1. Open `go-deck.exe` / `go-deck.app`.
2. Create/rename **grids** in the side tabs and set each one's size (rows × columns).
   Click a cell to create a button: label, **action type**, and **appearance**
   (emoji/image/color). Click **Save configuration**.
3. On your phone (same Wi-Fi), scan the QR Code.
4. Tap a button → the action runs on the PC (or, if it's *navigate*, it switches
   grids on the phone itself). The fixed **Home** button returns to the first grid.

The configuration is stored at:

- **Windows:** `%APPDATA%/DeckPilot/config.json`
- **macOS:** `~/Library/Application Support/DeckPilot/config.json`

### Available actions

| Type | What it does |
|------|--------------|
| **keypress** | Fires a simultaneous key combo (see the key model below). |
| **launch** | Opens a program (`path` + `args`), via `os/exec` without a shell. |
| **url** | Opens a URL in the OS default app. |
| **obs** | Controls OBS: switch scene, record/stream, mute a source, trigger a hotkey. |
| **discord** | Mute/Deafen — under the hood a *keypress* of Discord's global keybind. |
| **sequence** | Runs a list of actions in order (aborts on the first error). |
| **navigate** | Goes to another grid — resolved **on the phone**, doesn't touch the PC. |

### Integrations

- **OBS Studio:** enable *Tools → WebSocket Server Settings* in OBS, then fill in
  host/port/password in the editor's side panel (with **Test connection**). The
  connection is made per tap (stateless), via obs-websocket v5.
- **Discord:** there's no local API to control the client. Set the desired shortcut
  as a **global keybind** in Discord and capture the same key in go-deck. That's why
  only *mute/deafen* are supported (push-to-talk is "hold", which doesn't fit a tap).

### Multiple grids and navigation

Each grid is a page with its own size and buttons. A *navigate* button leads to
another grid (client-side switch, nothing sent to the PC); the phone has a fixed
**Home** button to return to the first one.

### Button appearance

Each button can have a background color (palette or free color; the text gets
automatic contrast) and an icon — an **emoji** (searchable picker) **or an image**
(uploaded and resized to 128 px, embedded in the config as a data URL).

### Key model

- Modifiers: `ctrl`, `shift`, `alt`, `win` — plus `cmd`, `opt` (macOS only)
- Letters `a`–`z`, digits `0`–`9`, `f1`–`f12`
- Specials: `enter`, `esc`, `tab`, `space`, `backspace`, `delete`, `insert`,
  `home`, `end`, `pageup`, `pagedown`, arrows (`up`/`down`/`left`/`right`)
- Media: `mute`, `volup`, `voldown` — plus `playpause`, `nexttrack`, `prevtrack` (Windows only)
- One button = **one simultaneous combo** (e.g. `["ctrl","shift","m"]`, or `["cmd","c"]` on Mac).

---

## Security & known limitations

This is an early-stage project (POC posture). Please know the trade-offs:

- **No authentication / HTTPS:** any device on the LAN that opens the URL can
  trigger the **already-configured** buttons. There's an `Origin` check on the
  WebSocket (minimal hygiene) and a pairing token in the QR URL, but it is **not
  safe on untrusted networks**. With the **launch** action, that means the LAN can
  trigger opening the programs/URLs defined on the PC (the phone only ever sends a
  button *id*, never a `path`). The **OBS password** is stored in `config.json` in
  **plain text**.
- The **port** is read at startup. Changing it in the editor requires restarting
  the app (an occupied port produces an explicit error, no automatic fallback).
- `Ctrl+Alt+Del` and the Win key in a combo can't be captured by the browser (the
  OS intercepts them); use the special-key buttons for Win/media.
- **Linux** isn't supported yet (stubs return an error; input is already isolated
  behind an interface — see [Contributing](#contributing)).
- **macOS:** `keypress` actions require **Accessibility** permission. Media keys
  `playpause`/`nexttrack`/`prevtrack` are not supported on macOS.
- The macOS app isn't signed/notarized — to open it the first time: right-click → Open.

---

## Contributing

Contributions are very welcome! Some great entry points:

- **🐧 Linux support** — the architecture is already isolated behind interfaces;
  only the native implementations are missing. Add
  `internal/input/sendinput_linux.go` and `internal/launch/launcher_linux.go`
  (use the `_other.go` stubs as a skeleton and adjust the build tags). Nothing else
  needs to change.
- **A new Action or integration** — thanks to `ExecContext`, adding a capability is
  a single new field, no need to refactor the rest. See `internal/action/`.
- **UX and bug fixes** are always welcome.

See [docs/kanban.md](docs/kanban.md) for what's planned.

> **Note:** the project's code and comments are written in **pt-BR (Brazilian
> Portuguese)**. PRs in English are fine, but please keep code comments in pt-BR to
> stay consistent with the codebase.

### Development setup

Prerequisites:

- **Go 1.21+**
- **Node.js LTS**
- **Wails CLI v2:** `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Windows:** WebView2 runtime (already on Windows 11); no CGO (keyboard via `SendInput` in pure Go)
- **macOS:** Xcode Command Line Tools (`xcode-select --install`); CGO is required for keyboard simulation via `CGEvent`

Run in development (hot-reload):

```bash
wails dev
```

This opens the desktop window with hot-reload. In dev, the network server
reverse-proxies to Vite (port 5173), so the phone gets the same version. The phone
access address shows up in the UI's QR Code.

Production build:

```bash
wails build
```

Produces the app with the React bundle embedded:

- **Windows:** `build/bin/go-deck.exe`
- **macOS:** `build/bin/go-deck.app`

---

## How it works

```
Tap on phone ──ws──► Go server ──► runs the Action:
                                    • keypress  (SendInput/Win32 or CGEvent/macOS)
                                    • launch / url (os/exec, no shell)
                                    • obs       (obs-websocket v5)
                                    • discord   (global keybind)
                                    • sequence  (several in order)
                       └─ navigate is resolved on the phone itself (grid switch)
```

- **Desktop (Wails):** config editor + QR Code. The webview is NOT exposed on the network.
- **Network server (net/http + gorilla/websocket):** a separate process, in the same
  binary, serves the React app to the phone and receives taps over WebSocket.
- **Layers isolated behind interfaces:** `InputController` (keyboard — Windows via
  `SendInput` in pure Go, macOS via `CGEvent` with CGO), `Launcher` (opens
  programs/URLs — Windows uses `rundll32`, macOS uses `open`) and `obs.Controller`
  (OBS via obs-websocket, platform-agnostic). Actions receive an `ExecContext` with
  these capabilities, so adding a new one = one extra field, no refactor.
- **A single React bundle:** detects at runtime whether it's inside Wails (shows the
  editor) or in the phone browser (shows the grids only).

Inspired by [OpenDeck](https://github.com/nekename/OpenDeck). Built with
**Go + Wails v2 + React/TypeScript + Tailwind**.

### Implementation gotchas (Windows + Wails v2)

Two traps that cost hours of debugging and are already handled in the code:

1. **`crossorigin` on `<script type="module">`** — Vite adds this attribute by
   default. Under Wails's internal scheme (`wails.localhost`), WebView2 may block the
   module as CORS (no `Access-Control-Allow-Origin` header), resulting in a
   **completely blank webview** (just the background color). Removed via a plugin in
   [vite.config.ts](frontend/vite.config.ts).
2. **A `nil` slice becomes `null` in JSON** — in Go, `append([]T(nil))` with zero
   elements returns `nil`, which serializes as `null` (not `[]`). A deck with no
   buttons sent `"buttons": null`, and the frontend broke on `.find()`. The config's
   `clone()` forces `[]T{}`; the frontend also has defensive guards.

### Project structure

```
go-deck/
├── main.go                 # Wails bootstrap + frontend embed
├── app.go                  # bindings exposed to the desktop (config, network, QR, TestOBS)
├── internal/
│   ├── config/             # data model (Pages/Button/Integrations) + load/save
│   ├── input/              # InputController — SendInput (Windows) / CGEvent (macOS)
│   ├── launch/             # Launcher (opens programs/URLs, no shell) — per OS
│   ├── obs/                # obs.Controller via obs-websocket v5 (goobs lib)
│   ├── action/             # Action interface + types (keypress/launch/url/obs/…)
│   └── server/             # http + websocket + QR + LAN IP detection
└── frontend/src/
    ├── components/         # DeckGrid, DeckButton (shared)
    ├── desktop/            # editor: grid tabs, ButtonEditor, ActionFields,
    │                       #   AppearanceFields (emoji/image/color), OBSPanel
    ├── mobile/             # grids + WebSocket + navigation/Home (phone mode)
    ├── lib/                # runtime, keys, action summary, appearance/contrast
    └── types.ts            # shared types (DeckConfig, Page, Action…)
```

---

## License

[MIT](LICENSE) © Mario de Moraes
