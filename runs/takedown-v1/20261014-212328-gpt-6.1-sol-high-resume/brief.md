Build a small Burnout 3 style racing game in the browser with Three.js.

You drive fast down a highway with traffic. There is one rival car. Slam it into a wall or into traffic to take it down. That should feel great: a short "TAKEDOWN!" on the HUD, a sound, and the rival wrecks. If you crash, show "CRASHED" and respawn fast.

Focus on feel: it should feel really fast, drifting should be fun, the camera should stay behind the car, and the HUD should look like Burnout (speed, boost bar, takedowns). Keep it small. One car, one road, no menus. The game starts driving as soon as the page loads.

Controls (keyboard):
- W or Up: gas
- S or Down: brake, then reverse
- A or Left: steer left
- D or Right: steer right
- Space: boost
- Shift: drift

Setup:
- This folder is an empty git repo. Commit often. Your last commit is what counts.
- `npm install` and `npm run build` must work. The build goes to `dist/` and runs as static files.
- Node, npm, git, Chromium, Playwright (browsers in /ms-playwright) and ffmpeg are installed. You can install npm packages.
- You run alone. Nobody answers questions. Do not wait on background jobs.
- You have 45 minutes in total. After that the box stops.

At the end, record a gameplay trailer of max 30 seconds that shows the best of your game. Save it as `trailer.mp4` in the repo root and commit it.
