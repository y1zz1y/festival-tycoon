# Simulation and rendering performance

Index of all system docs: `docs/README.md`. Tick rules: `docs/simulation.md`.
Batching and lights: `docs/rendering.md`. How to run the suites: `docs/testing.md`.
Update this file when changing scheduling or rendering architecture.

Version 0.1.4, measured locally on 2026-09-11 using the saved `rtest3` scenario.
The starting world contains 1,093 visitors, 335 camp installations, 435 buildings,
41 staff and 361 incidents. Personal saves stay in the ignored `saves/` directory.

## Reproduce

Run `npm run test:performance -- rtest3 120` for identical starting snapshots at
1×, 3× and 8×. A JSON path also works, for either a raw snapshot or server save slot.
Run `npm run test:performance -- rtest3 1200` for a longer simulation.
In PowerShell, set `$env:PROFILE_METHODS='1'` for inclusive method timing;
remove it with `Remove-Item Env:PROFILE_METHODS` for normal measurement.
Method totals overlap and must not be added together.

The test advances real fixed 100 ms ticks without rendering or sleeping. It reports
median/p95/max CPU time, actual ticks and final population, not browser FPS or TPS.
The 1,200-tick test covers 120 real seconds of intended simulation. At 8× the
festival eventually closes and the park empties, so use the short populated run
as well. Do not interpret lower population as a CPU optimization.

## Measured result

Before this change (including the already present occupancy/panic optimizations),
the first 120 ticks at 3× took 6,429 ms total; median 15.79 ms, p95 288.78 ms,
maximum 321.82 ms. At 8×: 10,351 ms total, p95 551.23 ms, maximum 832.26 ms.

After the changes, with the same method instrumentation and starting save:
- 3×: 1,492 ms total; median 11.33 ms, p95 23.13 ms, maximum 30.90 ms.
- 8×: 2,118 ms total; median 18.10 ms, p95 28.72 ms, maximum 45.00 ms.
- 1×: 1,097 ms total; median 7.35 ms, p95 19.86 ms, maximum 46.48 ms.

The 1,200-tick run without instrumentation measured p95 18.99 ms at 3×
(427 visitors remaining) and 25.92 ms at 8× (festival finished, zero visitors).
Hardware, warmup and browser load affect absolute timings. Browser measurements
must also include scene updates, WebGL rendering, UI and multiplayer encoding.

## Architecture and regression checks

The fixed tick remains 100 ms; game speed scales simulated minutes and movement.
Needs, transport, staff and state transitions still progress every tick. Destination
selection has a deterministic 16-decision budget per tick, including direct
callbacks. The insertion-ordered deferred queue drains on subsequent ticks.
Each visitor can consume that budget at most once per tick. Bench rest is not
continually interrupted by the exhausted-visitor branch.

Camping social selection previously scanned every visitor and ran a separate A*
for every installation. It now makes one occupancy pass and one multi-goal search,
including distant reachable alternatives when nearby spots are full or blocked.

Crowd changes update live movement/cost indexes without clearing all cached routes.
Routes expire after 30–59 ticks, staggered by start cell. New construction or access
changes still invalidate navigation immediately. Cache capacity evicts one entry;
budget-limited failures never poison the reachability cache.

Detailed core building models use baked vertex colors and shared geometry. Static
instances draw once per model kind, rather than once per detail or placed building.
Animated stages, light pools, transport and interaction metadata retain their own
objects. Existing picking uses the logical building grid.

`tests/performanceGuards.ts` enforces bounded decision work and queue drainage,
one route search for 335 camp destinations, exclusion of occupied seats, crowd
cache expiry, construction invalidation, and bounded geometry/draw batches.
`tests/supplyChain.ts` checks detours and recovery after cache expiry; the main
suite checks frame-partition determinism at all speeds and real multiplayer sockets.
Run `npm test` and `npm run build` for changes in these systems.

No timing threshold is enforced in shared CI because hardware varies. Structural
work bounds fail deterministically; the saved-scenario benchmark is the additional
manual check against CPU regressions.

Terrain detail (0.1.9) uses one static merged surface mesh and a deterministic
256×512 pixel material atlas. All soil types and prepared surfaces share that
single draw call. Rebuild only after terrain, environment, surface/compaction,
or building/area footprint edits; rain changes a material tint, not geometry. Adjacent natural soils blend
at shared corners, while constructed surfaces keep their exact tile boundary.
The atlas uses nearest magnification and mipmaps for a stable distant view.
TerrainShape caches four shared corner heights and the saved centre height per
cell. Four triangles make automatic slopes; buildings, paths and designated areas
retain flat pads. A second merged mesh draws only world borders and retaining
edges between incompatible pad heights, replacing the former terrain cubes.
The lake bed lies below the existing water planes. Actor/scenery height queries
sample the same triangles in constant time without raycasts or visitor scans.
Authoritative integer terrain and navigation heights remain unchanged.
`tests/terrainSurface.ts` covers geometry bounds, seamless slopes, flat pads,
raycast/actor contact, material selection, save/reload stability, and absence of
simulation mutations.

Festival construction additions (0.1.13): camping grass shares one texture and
instanced tiles; an exterior flood fill rebuilds the discontinuous curb only on
area edits. Festival scenery remains shared/merged and supports one deterministic
line-placement command. Debug waste cleanup uses a single owner index and preserves
active camping property and fire incidents.

Coaster segment lengths and frames are cached per coaster, invalidated by the
piece-ID/chain signature, then sampled with binary search. Do not rebuild and scan
all sampled track points for every car/physics substep. New slopes end on integer
height differences; old saved points are preserved. Loop frames retain a fixed
reference heading through vertical tangents so rails and cars do not flip.
Photo purchases and braking/water resistance run in simulation ticks. Bungee
towers use one static mesh, one rider and one rope, with one active visitor at a
time; visuals derive from the authoritative interaction timer. Heights and busy
visitor IDs persist through saves and multiplayer.

Validation on the existing rtest3 save, 120 calls: median/p95/max CPU milliseconds
were 7.59/20.83/46.16 at 1x (1106 visitors), 11.26/24.26/38.12 at 3x (1126),
18.80/30.19/41.14 at 8x (1191). For 1200 calls: 6.85/17.39/50.92 at 1x (1180),
9.30/23.20/66.22 at 3x (566), 14.65/34.05/169.87 at 8x (40).
These are validation measurements with concurrent local development, not an
isolated before/after claim or browser FPS. The 8x long run nearly empties the park;
its lower average does not establish faster crowded rendering. Tests cover actual
special-piece construction, continuous loop orientation, brake/splash resistance,
one photo charge per passage, bungee exclusivity/payment, save/network metadata,
camp perimeter seams and debug cleanup.

Pixel people (0.1.14): four shared, vertex-coloured geometries provide torso,
head/face, hip-pivoted legs with shoes, and shoulder-pivoted arms with hands.
The existing six visitor instance batches remain the picking targets. Eight
additional compact batches contain merged hair/headwear, bags and festival passes;
their draw count is independent of population. Each visible guest writes one
accessory instance, and counts reset every frame to remove departed/hidden guests.
Do not turn these details into individual scene objects per visitor. All variants
stay below 1600 vertices per complete person, without character shadows.
Appearance derives from a stable hash of the full visitor ID, never array position,
simulation RNG or frame time. Staff reuse the same shared parts. Distant guests
keep complete limbs while using the existing cheaper animation path.
`tests/pixelPeople.ts` verifies 10,000-person batch bounds, cached geometry,
save/reorder appearance, varied palettes and removal of stale accessories.
`tests/people-preview.html` is a development-only close-up visual fixture; it uses
the actual production geometries and can be opened through the Vite server.

Carousel/bungee access (introduced in 0.1.15): optional `rideEntrance` and
`rideExit` belong to the placed building and survive saves and multiplayer worlds.
Each gate reserves a separate adjacent cell. Legacy rides without gates remain
closed until the player places and connects them in the ride construction panel.
Entrance queues use the same directional queue traversal as coasters. Finished
riders exit through the chosen exit; a removed exit path delays release without
repeated charges. Gate edits invalidate the building spatial index and navigation.
Gate collision queries use that spatial index; access path checks inspect only
four neighboring cells rather than scanning all buildings per guest.
`tests/rideAccess.ts` covers both ride types, placement, queue routing, interrupted
exit connections, removal, save round trips and optimistic multiplayer reconciliation.

Attraction access visuals (0.1.23): `attractionAccess.ts` caches six merged,
vertex-colored entrance/exit meshes across carousel, bungee and coaster themes.
Ride gates use the existing static instancing pass; details never add individual
draw calls. Placement previews reuse geometry but own their tint material, so
preview disposal or invalid-placement colors cannot affect built gates.
Coaster access positions participate in the render fingerprint, including moves.
`tests/access-preview.html` displays all six production models; performance guards
check shared geometry, tile bounds, preview ownership and six instanced batches.

Female silhouettes (0.1.18): the persistent ID-derived female flag selects a
shared tailored torso, narrower shoulder pivots and eight matching hair/outfit
variants. Three variants use stepped skirts, the others retain trousers.
Male/female and clothed/bare accessories use at most 32 instance batches total,
independent of crowd size; never create individual hair or clothing meshes per
guest. Female staff reuse the torso and tied-hair geometry with their uniforms.
The model regression counts all rendered clothed body parts (including the bust)
against the 1600-vertex budget and checks 10,000-guest instance counts, stable
appearance and both skirt/trouser alternatives.

Camping models (0.1.20): four tent silhouettes and three pavilion silhouettes
each share one merged fabric geometry and one merged detail geometry. Seams,
doors, poles, ropes, pegs and furniture do not add individual draw calls. Across
all seven shapes the camping batcher emits 14 batches, regardless of prop count,
plus the existing cart/chair/music-box batches. Custom BufferGeometry buckets
must key by geometry identity, not only geometry type/constructor parameters;
otherwise different silhouettes collapse to the first model. Batch copies own
their resources and must copy userData before clearing the shared flag.
Each model stays within its tile and below 1800 vertices, checked by
`tests/campingModels.ts`. Appearance uses stable IDs, without simulation RNG or
frame-time input. Optional appearanceId/fabricColor on abandoned tents retain
the original tent's shape, orientation and color through departure and saves.
Legacy abandoned tents retain their brown fallback; wear fades in linear color
space. `tests/camping-preview.html` shows the production models with orbit controls.

## Browser freezes from changing light counts (0.1.27)

The user-provided server save `dessert` (205 visitors, 1817 buildings, 119 incidents,
90 camp installations, 80x80 world) reproduced a 23,692.5 ms `renderer.render()`
call during an ordinary 180-frame run. Initial rendering also took 23,483.5 ms.
Scene updates peaked at 22.9 ms and simulation at 39.8 ms in that run. The main
freeze was therefore in rendering, not pathfinding or the fixed-tick scheduler.
`FestivalLightsView` created/removes a PointLight for each currently active source.
Three's WebGLLights includes point-light count in its shader cache key, so changes
to shop hours or lit tents recompiled large shaders synchronously.

Keep the eight festival PointLights and cursor light permanently attached, even
at zero intensity. Never resize that pool, toggle its visibility, or create a
PointLight per lamp/tent. The nearest sources to the camera focus use the fixed
pool for illumination on objects. Every active source keeps its visible bulb and
a soft, instanced ground light patch (two batches total), including sources beyond
the real-time budget. Ground patches approximate distant light rather than casting
full dynamic illumination onto all objects. Store no render choices in game state.
`tests/performanceGuards.ts` covers schedules, 0/1/514 sources, stable light object
identities/attachment, retained bulb/patch counts, and moving the camera focus.

Reproduce browser timing with the Vite-only `tests/render-performance.html`.
It reads an ignored local copy at `saves/performance-dessert-copy.json`; no personal
save belongs in git. `?save=filename.json&frames=1800` changes the fixture and frame
count. Select Pause/1x/3x/8x and start; each measurement restores the same snapshot.
Initialization is reported separately from frame/CPU stage timings. Long tasks
exclude initialization. The harness measures the production WorldView and GameState,
without the main game's DOM panels. It does not overwrite saves or contact the
public server. Hardware, viewport and graphics-driver cache affect timings.

Measured in the in-app Chromium browser at 639x698: before the fix, 1x render
median/p95/max was 11.5/19.7/23692.5 ms. After the fix, 180-frame render results were
1x: 6.8/12.6/51.9 ms, 3x: 6.5/12.8/55.2 ms, and 8x: 7.4/52.8/54.9 ms.
The longer 1800-frame 8x run reached 301 visitors, with render 6.9/51.8/78.2 ms,
whole-frame 7.0/69.5/111.1 ms and a maximum long task of 112 ms. This removes the
reproduced multi-second stall, but does not promise a hitch-free 60 FPS on all
devices: several hundred draw calls and occasional 50–100 ms frames remain.

CPU-only `dessert` 1200-step medians/p95/max: 1x 1.08/5.90/38.27 ms (206 visitors),
3x 5.35/13.86/48.84 ms (467), 8x 10.30/25.29/46.38 ms (446).
The mandatory `rtest3` 120-step before/after medians/p95/max were
1x 8.82/23.75/50.52 -> 7.93/20.42/45.15 ms (1101 visitors),
3x 15.99/27.80/30.26 -> 13.93/25.20/30.81 ms (1125),
8x 17.43/27.28/39.33 -> 18.78/31.19/39.17 ms (1162).
There is no simulation change; these differences are measurement noise.
The 1200-step `rtest3` run measured 13.31/24.55/45.88 ms at 1x (1209 visitors),
15.94/29.99/83.70 at 3x (666), and 14.67/29.37/110.24 at 8x (1).
The latter ends the festival and empties the park, so it is not a steady-load result.
Full regression tests and production build pass.

## Follow-up check after gameplay fixes (0.1.86, 2026-09-14)

Measured the current working tree, including concurrent finance/scenario/UI work,
with the unchanged `rtest3` slot (SHA256
`42AF6AA49753B0BAA8C9C90A0CAC513873DBDF64CF676EE8C07658591E9761FE`).
These are local measurements, not an isolated comparison with earlier releases.

Before the render-only optimization, 120 CPU ticks (median/p95/max ms):
- 1x: 11.91 / 41.02 / 53.54, 1105 visitors.
- 3x: 18.46 / 42.43 / 103.69, 1119 visitors.
- 8x: 21.26 / 48.92 / 66.91, 1171 visitors.

The 1200-tick run measured:
- 1x: 8.73 / 24.74 / 119.97, 1183 visitors.
- 3x: 14.55 / 35.53 / 177.42, 741 visitors.
- 8x: 19.09 / 48.66 / 439.31, 16 visitors.

The long 8x run nearly empties the festival and includes a 439 ms CPU outlier;
it does not demonstrate stable crowded performance. Inclusive method profiling
of 120 ticks at 8x attributes about 1087 ms to `findPath`, 1023 ms to
`updateVisitors`, 427 ms to concert selection and 273 ms to `updateLogistics`.
These overlap. Road-step validation uses cached graph lookups and at most four
neighbors; the new shop lookup still uses one multi-goal route search.

Browser baseline: `tests/render-performance.html` with the same slot, 180 frames,
1280x720 Chromium viewport, separately initialized for each speed. Frame interval
median/p95/max ms was 13.9/55.7/125.0 at 1x (1094 visitors),
20.8/83.3/132.0 at 3x (1106), and 20.9/111.1/145.8 at 8x (1141).
Draw counts were 998/953/1016. The harness excludes the main game's DOM panels;
frame intervals include pacing and are not CPU-tick measurements.

Confirmed bottleneck: `IncidentView.update` destroyed and recreated every incident
model whenever any severity changed. At 8x this consumed 914.7 ms across 180 frames,
with a 27.7 ms maximum call. It now retains models by ID and visible shape count,
rebuilds only changed models, updates transforms in place, and disposes removed
models. Fire animation uses direct model lookup in the same pass. Fractional
severity changes with the same visible piece count do not rebuild geometry.
This does not alter simulation, admission, effects, or time progression.
Regression tests cover 400 incidents with one change, resource disposal,
fractional severity, transforms, removal and full invalidation.

Afterward, 120 CPU ticks measured 12.26/37.90/62.39 ms at 1x,
17.05/45.76/78.43 at 3x and 20.65/48.74/62.80 at 8x, with identical final
populations. As expected for a view-only change, these differences are noise,
not evidence of a CPU simulation speedup. `npm test` and `npm run build` pass.

Browser follow-up (same starting save, viewport and 180-frame harness):
- 1x: frame median/p95/max 13.9/55.5/97.3 ms, 1094 visitors, 997 draws.
  Incident update total/max 23.1/0.9 ms, previously 242.4/19.0 ms.
- 3x: frame 14.0/62.5/111.1 ms, 1105 visitors, 934 draws.
  Incident update total/max 26.4/0.7 ms, previously 597.7/21.1 ms.
- 8x: frame 20.7/76.4/97.3 ms, 1130 visitors, 964 draws.
  Incident update total/max 34.7/1.7 ms, previously 914.7/27.7 ms.

Faster frame runs advance less wall-clock simulation time, hence slightly
different final populations and draw counts. Do not interpret these as a precise
whole-game speedup percentage. The structural test proves the removed rebuild
work; the browser results support a substantial reduction in incident updates.
Remaining hotspots include pathfinding, camping props (25.1 ms maximum update
in the follow-up 8x run), and roughly a thousand draw calls. Occasional 76–111 ms
frames remain; this is not a steady 60 FPS result. No personal save was modified.

Final 1200-tick CPU control run (median/p95/max ms): 1x 9.29/25.29/65.17
(1183 visitors), 3x 13.84/35.86/84.85 (741), 8x 22.67/56.98/502.64 (16).
Final populations match the pre-change long run exactly. The approximately
half-second 8x simulation outlier remains unresolved by this render-only fix;
the short inclusive profile does not identify the cause of that late outlier.

## Broader performance pass (0.1.87, 2026-09-14)

Same `rtest3` fixture as above; its file SHA256 remains unchanged. No visitor,
render-detail, light/effect or simulation-speed limits were lowered. Concurrent
finance/scenario/UI changes in this working tree remain present.

Confirmed and fixed:
- Long profiles locate the former 518 ms tick at 8x in simultaneous camp packing:
  `updateVisitors` 502 ms, `findPath` 479 ms, `tryDisposeWaste` 420 ms (inclusive).
  Day-visitor closing also performed many departure searches in one tick.
  Departure, exit and direct waste-routing callbacks now share the existing
  16-decision budget and FIFO queue. Immediate state cleanup still runs that tick.
  Existing waste routes survive closing checks instead of being recomputed.
  Pending camp packing/waste cannot disappear at the exit; saves resume packing.
- `findPath` can reject universally forbidden goal nodes before traversal, while
  preserving cache policy, original heuristic goals and ordinary weighted routing.
- Camping previously replaced every instanced geometry/material/buffer when any
  prop changed. `CampMeshBatcher` retains batches, updates matrices/colors, and
  grows capacity only when needed. Static handcart assets are shared; geometry
  signatures are cached. No camp detail or sprite is removed.
- Incident drawing now uses one batch for all litter scraps, one for all vomit
  patches and two for fire. Geometry dimensions, offsets, colors, piece counts and
  fire animation match the previous models. Buffers persist across changes.
- Instanced meshes require their own `dispose()` event to release instance
  attributes. The common disposal helper now releases these, including replaced
  camp batches; growing camping ground also releases old instance attributes.

CPU baseline, 120 ticks, median/p95/max ms:
- 1x: 10.89 / 26.24 / 53.50, 1105 visitors.
- 3x: 16.20 / 29.92 / 41.13, 1119 visitors.
- 8x: 20.88 / 35.74 / 43.87, 1171 visitors.

Long baseline with inclusive profiling, 1200 ticks:
- 1x: 8.52 / 19.65 / 51.37, 1183 visitors.
- 3x: 14.26 / 27.90 / 111.88, 741 visitors.
- 8x: 19.33 / 39.78 / 518.23, 16 visitors.
The uninstrumented pre-change control from 0.1.86 was
9.29/25.29/65.17, 13.84/35.86/84.85, 22.67/56.98/502.64 respectively.

After the routing/renderer fixes, 120 ticks without instrumentation:
- 1x: 10.50 / 25.04 / 50.24, 1104 visitors.
- 3x: 16.70 / 32.22 / 45.46, 1128 visitors.
- 8x: 20.78 / 30.54 / 45.13, 1185 visitors.

1200 ticks without instrumentation:
- 1x: 7.53 / 18.33 / 48.88, 1175 visitors.
- 3x: 15.35 / 34.41 / 79.90, 698 visitors.
- 8x: 17.23 / 31.06 / 66.86, 7 visitors.

Scheduling changes intentionally alter when routes are chosen, so end-state
hashes and populations differ from 0.1.86. This is not a visitor-count reduction:
short 3x/8x runs contain more visitors, while the long 8x run reaches festival end.
Do not infer a universal CPU percentage from these evolving populations or mix
instrumented and uninstrumented timings. Median 3x time did not improve; the clear
win is bounding simultaneous departure/waste work and removing the half-second
outlier. One intermediate profile had isolated 245/372 ms outliers which did not
recur in the next run; they are not evidence of another resolved algorithmic bug.

Browser, 1280x720, same starting save, 180 frames at each speed:
- 1x: frame median/p95/max 13.9/41.7/62.5 ms, 1094 visitors, 771 draws;
  render 8.7/12.9/19.3 ms, camp update total/max 72.5/13.0 ms.
- 3x: frame 13.9/48.6/62.6 ms, 1101 visitors, 734 draws;
  render 8.9/12.0/15.0 ms, camp update total/max 107.5/10.9 ms.
- 8x: frame 13.9/55.6/97.3 ms, 1134 visitors, 719 draws;
  render 8.9/12.4/18.7 ms, camp update total/max 219.4/11.8 ms.

The 0.1.86 browser baseline above used 997/934/964 draws, and its 8x frame
median/p95/max was 20.7/76.4/97.3 ms with a 25.1 ms maximum camping update.
Final populations depend on elapsed wall time; these runs do not prove a precise
whole-game percentage. The screenshot retains the full crowd, tents, chairs,
handcarts and litter. This harness excludes main-game DOM panels. Occasional
frames above 50 ms remain; a stable 60 FPS or absence of every possible bottleneck
on every device is not established.

Regression guards cover queued departures/waste, reconstruction on load,
forbidden goal rejection, unchanged camp/incident shapes and transforms, batch
counts, buffer growth and disposal. Full `npm test` and `npm run build` pass;
Vite still reports the existing large-bundle warning (startup/download size,
not a measured simulation-tick issue).

Longer browser control (1800 frames, 8x, 1280x720): 937 final visitors,
frame median/p95/max 13.9/48.6/104.3 ms, render 7.5/11.3/54.0 ms,
scene 3.8/14.2/28.7 ms, 820 draws, 559 geometries, 23 programs.
Camp update max was 20.1 ms, incident update max 7.5 ms. This remains a
populated-festival measurement rather than the nearly-empty 1200-tick CPU endpoint.

This longer check exposed NaN bounding spheres in four legacy stage trusses:
old 2D workshop saves lacked part `y` and stage height. Migration now supplies
finite ground-level part heights and normal headroom before regridding. It keeps
all parts and existing coordinates, and does not write the original slot. A browser
reload verifies that the two NaN errors are gone. Tests cover legacy migration and
finite geometry for every current stage component in all six directions.
Manual closure from the UI/network also defers mass departure routing into the
same tick budget instead of performing unbounded searches inside the command.

Further concurrent sleep/day-plan/access/carrier work arrived during the final
checks and raised the combined working-tree version to 0.1.88. It is preserved.
The later run therefore is NOT an isolated before/after measure of this patch:
120 ticks (median/p95/max, population) were 1x 11.82/28.60/59.62 ms (1104),
3x 17.33/47.20/83.66 (1128), 8x 21.86/50.35/90.80 (1193).
1200 ticks were 1x 8.73/24.58/72.65 ms (1176), 3x 19.73/48.61/116.55 (714),
8x 20.75/54.11/128.99 (36). Concurrent work also makes machine-load comparisons
less reliable. The previous 67 ms maximum must not be presented as a guarantee
for the combined tree. No effects, graphics settings or admission limits were
reduced to produce any of these results. The source save hash remains unchanged.
