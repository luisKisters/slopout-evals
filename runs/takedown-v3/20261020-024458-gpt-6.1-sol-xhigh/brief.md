build a small burnout 3 style racing game in the browser with three.js.

everything below is a guideline, not a law. it shows what i want. if you think a different rule or an extra idea makes the game better and more complete, do it, and write why in NOTES.md. the goal is a fun, fast, polished game.

## the game
- one mode: a 3 lap race against 7 rival cars. no traffic.
- you win by finishing first. slam rivals into walls to take them down.
- it starts driving when the page loads. no menus. after the race show the result and "press r to restart".

## feel (most important)
- the feeling of speed is the most important thing. research how good racing games create it (fov, camera, motion blur, roadside objects, sound) and use what fits. it is fast and fun, not absurd: the player must still be able to react. boost must feel clearly faster.
- driving must be fun and easy to control, but the player drives. light help is ok (for example a little grip help in bends). no auto steer and no lane keeping: if you hold only gas, you leave the road at the first real bend.
- steering: a/left turns the car left, d/right turns it right, also in reverse and at the start. test this.
- walls are forgiving. a scrape or a side hit costs speed and makes sparks. only a hard head-on hit at high speed is a crash.
- after a crash: show "crashed", respawn on the road center within 1.5 s, facing the right way, with some speed.

## controls
- w/up gas, s/down brake then reverse, a/left and d/right steer.
- shift: always a drift. the rear slides out at once, you see smoke and skid marks and "drift" on the hud. it is not just sharper steering.
- space: boost. boost starts only when the bar is at least 25% full. if you hold space with an empty bar, nothing happens. no flicker on and off. drifts, near misses and takedowns fill the bar.

## track
- wide roads: two lanes, each fits 2 to 3 cars side by side. 8 cars must race without constant contact.
- a closed circuit, 60 to 90 s per lap, with a mix of long straights for speed and fast bends for drifts.
- make it creative: for example a tunnel, a bridge, a jump, a city part and a cliff part.
- fun and easy first. a new player must finish the race on the first try and must not crash often. the track is interesting, not hard.

## rivals
- they start on a grid next to and behind the player, never in front, never inside a wall.
- a rival that respawns appears on the road, behind the player or out of view, never where it hits something at once.
- not too good and not too bad: an average player finishes in the middle, a good player can win. rubber band a little so the race stays close.
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
- 35% core: driving, camera, track, rivals. playable early.
- 25% content: blender models, sounds, hud, takedowns.
- 30% play test, do not skip: play like a real player with real key presses and real timing. no teleports, no changed game state. drive full races. check: steering direction, drift on shift, boost threshold, no auto steer, wall hits, spawns, is it fun, is it too hard or too easy, can you win. write what you find in TESTS.md, fix it, test again.
- 5% walkthrough.

## tips (checked against the docs, verify in the box)
- blender: write a python script, run `blender -b --factory-startup -P make_car.py --python-exit-code 1 -- --out public/car.glb`. read args after `--`.
- export: `bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True)`. delete the default cube, light and camera first. principled bsdf colors only, no textures. glTF forward is +z: check the car faces the right way in three.
- blender 5.x: eevee is `BLENDER_EEVEE`. to check a model, render a small preview png with cycles on cpu and few samples (`scene.cycles.samples = 32`) and look at it.
- three: load with `GLTFLoader` from `three/addons/loaders/GLTFLoader.js`.
- webgl in headless chromium: launch with `--use-gl=angle --use-angle=swiftshader-webgl`. it is slow, so judge fps from the game's own frame time, not from the test.
- play tests: one playwright script per test. hold keys with `page.keyboard.down`, a real wait, `page.keyboard.up`. expose `window.__game` (speed, position, heading, drift, boost, lap, rivals) and assert on it. check steering with the car's right vector. fail on `pageerror`, log console errors.
- quick looks: `agent-browser` for screenshots, console and eval.
- look at many screenshots as one contact sheet: `ffmpeg -pattern_type glob -i 'shots/*.png' -vf 'scale=480:-1,tile=4x3' -frames:v 1 sheet.png`.
- video: playwright `recordVideo` with `size: {width: 1280, height: 720}`, then `ffmpeg -i in.webm -c:v libx264 -pix_fmt yuv420p out.mp4`.
- fast loop: `vite build --watch` and `vite preview --port 4173` in the background, then run tests.

## setup
- this folder is an empty git repo. commit often, your last commit counts.
- `npm install` and `npm run build` must work. build goes to `dist/` as static files.
- installed: node, npm, git, chromium, playwright (browsers in /ms-playwright), agent-browser, ffmpeg, blender, earshot. you can install npm packages.
- you are alone, nobody answers questions. do not wait on background jobs.
- you have 2 hours total, then the box stops.

## walkthrough
write `walkthrough.mjs` in the repo root. `node walkthrough.mjs <url> <out.mp4>` opens the game with playwright, plays it with real key presses for 30 s and saves a video that shows the game well: speed, drifts, boost, a takedown, the hud. it must work on linux and on a mac with only node, playwright and ffmpeg installed. run it on your build, check the video, and commit `walkthrough.mp4` too.
