You judge one entry in a coding-agent benchmark. An AI agent had 2 hours to build a small
Burnout 3 style racing game in Three.js from the brief below (a 3 lap race against 7 rivals). A fixed script then drove the game
with the keyboard and filmed it. You see labeled contact sheets of that film and of the agent's own walkthrough video.

BRIEF THE AGENT GOT:
---
{brief}
---

MEASUREMENTS (automatic, from the filmed drive):
{measurements}

Images (open each one):
{images}

Judge only what you see. Be strict and concrete. A dark empty plane with box cars is slop, not "minimal".
The motion numbers are weak hints only: energy = how much the image changes, zoom > 0 = view expands
(moving forward), zoom < 0 = view contracts (moving backward), hshift = sideways image shift.
The checks are measured from the game itself: "fail" is final, "unknown" means not measurable.
The script holds only W (and space) for 15 s at the start: a car that follows the road's bends then has auto-steer.

Score 0-10 each (10 = feels like real Burnout 3, 5 = works but bland, 0 = missing/broken):
- feel: speed sense, camera stays behind the car, drift, controls respond the right way.
  The road must have bends and corners to drift through. A straight road scores max 4 on feel.
  Auto-steer or lane keeping (the car follows the road with no steering key) scores max 3 on feel.
- takedown: rivals exist, can be slammed into walls, the takedown (slow motion, card, sound) is readable and punchy.
- looks: real-looking road and world, lighting, cars; no generic AI look.
  Traffic (cars other than yours and the 7 rivals) breaks the brief: max 4 on looks.
- hud: Burnout-like HUD: speed, boost bar, position, lap, takedowns; clear and reacting.
- trailer: the agent's walkthrough video shows the game well: speed, drifts, boost, a takedown, the hud.
  0 if there is no walkthrough sheet.

Controls verdict from the controls sheet (true/false/null if you cannot tell):
- forward: W moves the car forward.  - reverse: S brakes then drives backward.
- left: A turns left.  - right: D turns right.
Also: rival_visible (a rival car can be seen at some point), curves_visible (the road has bends),
only_two_cars (true if there is no traffic: only your car and the rivals).

Reply with ONLY this JSON, no other text:
{{"feel":0,"takedown":0,"looks":0,"hud":0,"trailer":0,
"controls":{{"forward":null,"reverse":null,"left":null,"right":null}},
"rival_visible":null,"curves_visible":null,"only_two_cars":null,
"good":["max 3 short points"],"bad":["max 3 short points"],
"one_line":"one honest sentence a gamer would say about it"}}
