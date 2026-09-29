# The House of Silence

A fully client-side, original 3D browser escape-horror prototype built with Three.js and WebGL.

## Run locally

This project is designed to run with VS Code Live Server.

1. Clone or download the repository.
2. Open the folder in VS Code.
3. Install the **Live Server** extension.
4. Right-click `index.html`.
5. Select **Open with Live Server**.
6. Click **NEW GAME**.

No backend, database, authentication, Python server, or Node server is required for the game itself.

## Controls

- **WASD** — move
- **Mouse** — look
- **Shift** — run
- **Ctrl** — crouch
- **E** — interact
- **F** — flashlight
- **Esc** — pause

## Gameplay

You are trapped inside an abandoned house during a storm. Restore the electrical system, find the archive access, recover the gate key, and escape through the front gate while avoiding the Warden.

The game uses original procedural geometry and browser-generated effects rather than extracted assets from existing games.

## Technology

- HTML5
- CSS3
- JavaScript ES modules
- Three.js
- WebGL
- Pointer Lock API
- Web Audio API
- LocalStorage

Three.js is loaded from jsDelivr at runtime.

## Current systems

- First-person controls
- Pointer lock
- Sprint and crouch
- Stamina
- Flashlight and battery
- Interactive doors
- Collectible items
- Inventory
- Notes/clues
- Electrical progression
- Enemy patrol AI
- Enemy vision
- Enemy hearing/noise investigation
- Chase and capture
- Dynamic rain
- Lightning/thunder events
- Atmospheric lighting
- Pause/settings screens
- Local statistics
- Escape ending

## Asset policy

Do not add ripped or extracted assets from commercial games. Any future third-party asset should be compatible with redistribution and documented in `CREDITS.md`.

## Performance

The renderer caps device pixel ratio to keep GPU load reasonable. The house uses simple collision volumes rather than expensive mesh collision.

The next production pass should replace the procedural placeholder geometry with original optimized GLTF assets, baked environment textures, authored animations, more robust navmesh/pathfinding, and a larger puzzle graph.

## License

See the repository license. Game-specific original code in this repository is intended to remain distinct from third-party dependencies and assets.