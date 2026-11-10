build a small burnout 3 style racing game in the browser with three.js.

everything below is a guideline, not a law. it shows what i want. if you think a different rule or an extra idea makes the game better and more complete, do it, and write why in NOTES.md. the goal is a fun, fast, polished game.

## the game
- one mode: a 3 lap race against 7 rival cars. no traffic.
- you win by finishing first. slam rivals into walls to take them down.
- it starts driving when the page loads. no menus. after the race show the result and "press r to restart".

## feel (most important)
- the feeling of speed is the most important thing. research how good racing games create it (fov, camera, motion blur, roadside objects, sound) and use what fits. it is fast and fun, not absurd: the player must still be able to react. boost must feel clearly faster.
- driving must be fun and easy to control, but the player drives. light help is ok (for example a little grip help in bends). no auto steer and no lane keeping: if you hold only gas, you hit the wall or leave the road at the first real bend. a wall may push the car back along the road, that is fine.
- steering: a/left turns the car left, d/right turns it right, also in reverse and at the start. many games get this backwards, and their own tests pass anyway. check it on the screen, not with a vector you derived yourself: hold d, take a screenshot, and look at it. the road must swing to the left of the screen as the car turns right. in three.js (y up), a car with forward (sin h, 0, cos h) has its right side at (-cos h, 0, sin h). if a test fails, fix the game, not the test, unless the screenshot shows the test is wrong.
- steering responds fast: a quick tap changes direction at once, and you can take a fast bend without waiting for the car to turn.
- walls are forgiving. a scrape or a side hit costs speed and makes sparks. only a hard head-on hit at high speed is a crash.
- after a crash: show "crashed", respawn on the road center within 1.5 s, facing the right way, with some speed.

## controls
- w/up gas, s/down brake then reverse, a/left and d/right steer.
- shift + a/d: drift. the car slides sideways through the bend at a big angle, like in burnout. you hold the angle with a/d and let go of shift to straighten out. smoke, skid marks and a tire screech. drifting fills the boost bar and must be fun, so play it a lot.
- space: boost, at once, with any charge in the bar. it must not flicker: when the bar runs empty, boost stops cleanly and stays off until you press space again. drifts, near misses and takedowns fill the bar.

## track
- wide roads: two lanes, each fits 2 to 3 cars side by side. 8 cars must race without constant contact.
- a closed circuit, 60 to 90 s per lap, with a mix of long straights for speed and fast bends for drifts.
- make it creative: for example a tunnel, a bridge, a jump, a city part and a cliff part.
- fun and easy first. a new player must finish the race on the first try and must not crash often. the track is interesting, not hard.

## rivals
- they start on a grid next to and behind the player, never in front, never inside a wall.
- a rival that respawns appears on the road, behind the player or out of view, never where it hits something at once.
- not too good and not too bad: an average player finishes in the middle, a good player can win.
- rubber banding: rivals that fall behind catch up, and rivals far ahead slow down a bit, so the race stays close. test it: drive slowly and check that rivals stay near you, then drive well and check that some keep up.
- if you want, rivals can ram you. a rival may wreck you only when you drive really badly, and it must be rare.

## takedowns
- a short slow motion (under 1 s), the rival wrecks, a big "takedown!" card with a nice animation on the hud, a sound. no long cutscene.

## hud
- burnout style: speed, boost bar, position (1st/8th), lap (1/3), takedowns.

## art and sound
- use blender (`blender -b`) to model the cars and some track props. export glb and load it.
- use earshot for sound (`earshot sfx`, `earshot kit`, `earshot describe`): engine, boost, drift, crash, takedown. listen to your sounds and fix bad ones.

## how to spend your time
you choose the plan. a good split:
- 5% plan: write PLAN.md with the track, the cars and a test list.
- 30% core: driving, camera, track, rivals. playable early.
- 20% content: blender models, sounds, hud, takedowns.
- 40% play test, the most important part, do not skip: play like a real player with real key presses and real timing. no teleports, no changed game state. drive full races. check: steering direction and speed, drift on shift, boost without flicker, no auto steer, rubber banding, wall hits, spawns, is it fun, is it too hard or too easy, can you win. do not stop when all tests pass. look at screenshots and videos of your own play and ask: does it all fit together, does it make sense, is it fun? write what works and what does not in TESTS.md, fix it, test again. after your last change, run all tests once more.
- 5% walkthrough.

## tips (checked against the docs, verify in the box)
- blender: write a python script, run `blender -b --factory-startup -P make_car.py --python-exit-code 1 -- --out public/car.glb`. read args after `--`.
- export: `bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True)`. delete the default cube, light and camera first. principled bsdf colors only, no textures. glTF forward is +z: check the car faces the right way in three.
- blender 5.x: eevee is `BLENDER_EEVEE`. to check a model, render a small preview png with cycles on cpu and few samples (`scene.cycles.samples = 32`) and look at it.
- three: load with `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`.
- webgl in headless chromium: launch with `--use-angle=gl-egl --ignore-gpu-blocklist` (mesa's software gl on the cpu. measured on the box, a 1280x720 three.js scene with 400 shadowed boxes: 23 ms per frame, swiftshader 123 ms). judge fps from the game's own frame time, not from the test. support `?lowq` (pixel ratio 0.5, no post effects) for play tests. use full quality for screenshots and the walkthrough. for the walkthrough video, `/opt/slop/README.md` has a virtual clock helper: one frame per 1/30 s of game time, then ffmpeg.
- play tests: one playwright script per test. hold keys with `page.keyboard.down`, a real wait, `page.keyboard.up`. expose `window.__game` (speed, position, heading, drift, boost, lap, rivals) and assert on it. fail on `pageerror`, log console errors.
- simulation: run it at a fixed step (1/60 s), separate from rendering. expose `window.__game.step(n)` that advances n steps without rendering, for fast logic tests (balance, rubber banding, spawns). play tests with real keys still run in real time.
- races: support `?laps=1` for most tests. drive full 3-lap races at least twice.
- quick looks: `agent-browser` for screenshots, console and eval.
- look at many screenshots as one contact sheet: `ffmpeg -pattern_type glob -i 'shots/*.png' -vf 'scale=480:-1,tile=4x3' -frames:v 1 sheet.png`.
- video: playwright `recordVideo` with `size: {width: 1280, height: 720}`, then `ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4`.
- fast loop: `vite preview --port 4173` in the background, `vite build` after changes, then run tests one at a time, not in parallel (the box has 2.5 cpus). to stop a background job, save its pid when you start it and kill that pid. never kill processes by matching their command line.

## setup
- this folder is an empty git repo. commit often, your last commit counts.
- `npm install` and `npm run build` must work. build goes to `dist/` as static files.
- installed: node, npm, git, chromium, playwright (browsers in /ms-playwright), agent-browser, ffmpeg, blender, earshot. you can install npm packages.
- you are alone, nobody answers questions. do not wait on background jobs.
- you have 1 hour total, then the box stops.

## walkthrough
write `walkthrough.mjs` in the repo root. `node walkthrough.mjs <url> <out.mp4>` opens the game with playwright, plays it with real key presses for 30 s and saves a video that shows the game well: speed, drifts, boost, a takedown, the hud. it must work on linux and on a mac with only node, playwright and ffmpeg installed. run it on your build, check the video, and commit `walkthrough.mp4` too.

## helper
you can hand simple, well-defined tasks to the `helper` subagent (claude haiku 5.5, xhigh), for example a blender or earshot script, one test script, or a look at a contact sheet. give it a complete instruction. it is fast and cheap but less careful: check its work. you stay responsible for the game.
