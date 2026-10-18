build a small burnout 3 style racing game in the browser with three.js.

it's just you and one rival car. no traffic, no other cars. the whole game is that duel.

winding road with fast bends and tight corners you drift through. slam the rival into a wall to take it down. that has to feel great: a short "takedown!" on the hud, a sound, the rival wrecks. if you crash show "crashed" and respawn fast.

focus on feel. really fast, drifting is fun, camera stays behind the car, hud looks like burnout (speed, boost bar, takedowns). no menus, it starts driving when the page loads.

controls: w/up gas, s/down brake then reverse, a/left and d/right steer, space boost, shift drift.

setup:
- this folder is an empty git repo. commit often, your last commit counts.
- `npm install` and `npm run build` must work. build goes to `dist/` as static files.
- node, npm, git, chromium, playwright (browsers in /ms-playwright), ffmpeg and blender (headless, `blender -b`) are installed. you can install npm packages.
- you're alone, nobody answers questions. don't wait on background jobs.
- you have 45 min total, then the box stops.

at the end record a gameplay trailer, max 30 s, best moments only. save it as `trailer.mp4` in the repo root and commit it.
