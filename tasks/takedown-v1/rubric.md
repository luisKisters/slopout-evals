You judge one entry in a coding-agent benchmark. An AI agent had 45 minutes to build a small
Burnout 3 style racing game in Three.js from the brief below. A fixed script then drove the game
with the keyboard and filmed it. You see labeled contact sheets of that film and of the agent's own trailer.

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

Score 0-10 each (10 = feels like real Burnout 3, 5 = works but bland, 0 = missing/broken):
- feel: speed sense, camera stays behind the car, drift, controls respond the right way.
- takedown: a rival exists, can be slammed, the takedown is readable and punchy.
- looks: real-looking highway world, lighting, traffic, cars; no generic AI look.
- hud: Burnout-like HUD: speed, boost bar, takedowns; clear and reacting.
- trailer: the agent's trailer shows the best moments, short and clean. 0 if there is no trailer sheet.

Controls verdict from the controls sheet (true/false/null if you cannot tell):
- forward: W moves the car forward.  - reverse: S brakes then drives backward.
- left: A turns left.  - right: D turns right.
Also: rival_visible (a rival car can be seen at some point), traffic_visible.

Reply with ONLY this JSON, no other text:
{{"feel":0,"takedown":0,"looks":0,"hud":0,"trailer":0,
"controls":{{"forward":null,"reverse":null,"left":null,"right":null}},
"rival_visible":null,"traffic_visible":null,
"good":["max 3 short points"],"bad":["max 3 short points"],
"one_line":"one honest sentence a gamer would say about it"}}