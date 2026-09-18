# Coaster track editor

Agent-facing source of truth for the **RCT2-style construction window**,
**discrete track connection rules**, **piece families**, and **per-type
constraints**. Gameplay, queues, tickets, and ride access stay in
[`attractions.md`](attractions.md). Do not dump this file into that topic.

Headliner uses a **shared** parametric engine gated by a discrete
`{heading, pitchLevel, bankLevel}` connection machine and per-type catalogs.
All `COASTER_CATALOG` rows are playable. Do not add freeform spline placement.

## Current vs target

| Layer | Current Headliner | RCT2 / OpenRCT2 target |
| --- | --- | --- |
| Types | All catalog ids playable (`COASTER_TYPES` = `COASTER_CATALOG`) | Many ride types; groups on the RTD, not 300 listed IDs |
| Piece identity | `TrackPieceKind` + discrete begin/end; pitch/bank still stored on `TrackAnchor` | Piece ID = geometry **plus** begin/end slope **plus** bank |
| Slope | `flat`, gentle `atan(0.5)` ≈ 26.6°, steep **±45°** (labelled Steil) | `None`, `Up25` / `Down25`, `Up60` / `Down60`, `Up90` / `Down90` |
| Bank | `0`, `±35°`, inverted `π` after `halfLoopUp` | `None`, `Left`, `Right`, `UpsideDown` |
| Heading | 4 cardinals (`0..3`) | Cardinals plus optional diagonal `+4` |
| Chain lift | `chainLift: boolean` on uphill / pitch-up transition | Usually a **flag** on uphill pieces (`allowsChainLift`). Exceptions: CableLiftHill, PoweredLift, curved lift hills |
| Trains | One train; cars = station tile count × `carCapacity` (4) | Trains × cars; block brakes before a second train |
| Dispatch | `full-or-timed` / `full-only` / `timed` | Circuit, block-sectioned, powered launch, reverse-incline shuttle |
| Physics | SI mass / drag / g telemetry | Do **not** port RCT2 ratings; keep Headliner SI physics |

That model difference is why layouts do not snap like RCT2. A Headliner
`curveLeft2` on a banked, sloped end is still the same kind. An RCT2 piece is
illegal unless begin slope/bank match.

UI labels say **Sanft** / **Steil**, not “~20°”. Headliner steep stays **45°**
so existing `classicSteel` saves keep their rise-per-tile (`tan(45°)` = 1).
RCT2 60° is not mixed into comments or the palette. Gentle is `atan(0.5)`.

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Piece kinds, geometry, trains, sampling | `src/game/coasters.ts` | `TRACK_PIECE_KINDS`, `TrackAnchor`, `createTrackPiece`, `sampleCoasterTrack`, `getSmoothedCoasterPiecePoints` |
| Fester Betriebs-/Physik-Tick | `src/game/coasterSimulation.ts` | `CoasterSimulation`; Queue, Dispatch, Integration, Telemetrie, Recall, Ausstieg |
| Playable type catalog + styles | `src/game/coasterTypes.ts` | `COASTER_CATALOG`, `resolveSupportedTrackPieces`, `resolveCoasterTypeId`, `coasterVehiclePreview` |
| Live type table / helix geometry | `src/game/coasters.ts` | `COASTER_TYPES`, `getCoasterType`, `createHelixTrack` |
| Connection / palette legality | `src/game/coasterConnections.ts` | `describeTrackAppendIssue`, `resolveNextTrackPiece`, `applyConstructionPitch` / `Bank` / `Kind`, `listTrackPalettePieces` (type-supported + `enabled`) |
| Schienen-Baucommands | `src/game/commands/coasterCommands.ts`, `src/game/GameState.ts` | Services `startCoasterCommand`, `appendCoasterPieceCommand`, `undoCoasterPieceCommand`, `deleteCoasterPieceCommand`; gleichnamige Fassadenmethoden bleiben für Netz/UI |
| Abriss, Tore, Betrieb | `src/game/GameState.ts` | `removeCoaster`, `setCoasterAccess`, `setCoasterOperationMode` |
| Commands | `src/net/protocol.ts`, `src/net/commands.ts`, `src/net/bind.ts` | `GameCommand` coaster variants |
| Balancing / SI physics | `src/game/simulationConfig.ts` | `coasters`, `classicSteel.physics` (shared SI baseline + per-type overrides), `trackPieceCosts.helixLeft/Right`, `physicsSimulation`, `trackJoinSmoothing`. Speed keys: `stationLaunchSpeed` 22.4, `stationDriveSpeed` 6.72, `chainSpeed` 10.4, `dragArea` 0.53, `maximumSpeed` 90; gravity stays 9.81 |
| Construction window | `src/ui/coasterBuilderPanel.ts`, `src/main.ts` (`#coaster-builder`) | `updateCoasterBuilderPanel` owns rendering/preview; the composition root supplies typed state and DOM groups |
| Palette mount helper | `src/game/coasterConstructionUI.ts` | `updateCoasterConstruction` / `coasterConstructionViewKey`, `syncCoasterPalette`, stable ids, `coasterConstructionPreviewKey` |
| Catalog train tiles | `src/view/WorldView.ts` | `coasterTrainThumbnail` — same `createCoasterCar` family as in-world trains |
| Track styles | `src/view/coasterTrack.ts` | one merged vertex-color mesh per piece; family rails / ties / supports; posts stop at land or a solid and skip if the bay is filled |
| Specials mesh | `src/view/coasterSpecials.ts` | photo, splash, brakes overlays |
| Cars | `src/view/coasterCars.ts` | one merged mesh per train style + color; shared geometry |
| Queues / access / demolish | [`attractions.md`](attractions.md) | do not duplicate |
| Catalog + connection tests | `tests/coasterTypes.ts` | **required** when editing types or legality |

## Connection state machine (must follow)

RCT2 treats a coaster as a sequence of discrete track elements. Each piece has
baked-in entry/exit slope, bank, and direction. A piece is legal **only** if it
matches the open end.

```
end_state = { direction ∈ {0,1,2,3} ∪ optional diagonal(+4), slope, bank, z }
legal next  iff beginDirection, beginSlope, beginBank match
             and piece ∈ ride enabled TrackGroups
             and vehicle allows inversions / banking
             and collision OK
new_end    = { rotated dir, piece.endSlope, piece.endBank, z + Δz }
```

Headliner live types use `TrackAnchor` `{ x, z, elevation, heading, pitch, bank }`.
Target discrete labels live in `src/game/coasterConnections.ts`:

- Pitch: `steepDown`, `gentleDown`, `flat`, `gentleUp`, `steepUp`
- Bank: `left`, `none`, `right`, `inverted`

### Bank

- Unbanked cannot join a banked piece without a transition
  (`FlatToLeftBank`, `LeftBankToFlat`, `LeftBankToUp25`, …).
- Cannot jump Left ↔ Right. Go through `None`.
- Headliner: `bankTransition` may change bank by at most `TRACK_BANK_ANGLE`
  (35°). Left → Right is rejected.

### Slope

- Cannot skip slope states. Cannot jump flat → 60° unless the type has
  `flatToSteep` / long-base (`capabilities.flatToSteep` in the catalog).
- Headliner live: `canTransitionTrackPitch` allows adjacent levels **or**
  flat ↔ steep (`usesWidePitchTransition`, 4-tile clothoid).
- Headliner live also still accepts `slopeGentleUp` **directly from a flat
  station**. That is current gameplay (`docs/attractions.md`). The **target**
  helper `describeDiscreteConnectionIssue` rejects constant steep/gentle
  pieces unless the open end already has that slope.

### Chain lift

Usually a **flag** on uphill pieces (`allowsChainLift` / Headliner
`chainLift` + `chainAllowed`), not a separate type. Exceptions in RCT2:
CableLiftHill, PoweredLift, curved lift hills. Do not port those until the
state machine and footprints work.

### Backwards build

OpenRCT2 can build from the other open end. Some inversion variants break when
built backwards. Headliner inserts after the selected piece
(`afterPieceIndex`) and has `undoCoasterPiece` (last) plus
`deleteCoasterPiece` (selected). That is closer to OpenRCT2 than to RCT2
“demolish last only”.

### Height units (OpenRCT2)

Tile 32×32, `kCoordsZStep = 8`, land increment 16 (`2 * kCoordsZStep`), max
station length 32. Typical stored Δz:

| Piece | Stored Δz (usual) | Notes |
| --- | --- | --- |
| Flat | 0 | |
| FlatToUp25 | +1 (8 Z) | **FLAG:** verify `TrackData.cpp` before coding |
| constant Up25 | +2 (16 Z = one land increment) | |
| Up60 | often cited +8 stored | **FLAG:** verify `TrackData.cpp` before coding |

Headliner elevations are tile units with half-steps (`snapTrackRise`). Gentle
up from flat rises **0.5**; steep 45° rises **1**. Stations and the start
platform use `buildElevation` (snap 0.5).

## Piece families

| Family | Typical names | Footprint | Multi-tile? | Height notes |
| --- | --- | --- | --- | --- |
| Straight / flat | Flat, sloped straight | 1×1 | no | Constant pitch |
| Station | Begin / Middle / End | 1×1 chain | chain of 1×1 | Flat, unbanked only |
| Gentle / steep / vertical + transitions | FlatToUp25, Up25ToUp60, FlatToUp60, LongBase | 1 or long-base 4 | long-base yes | Headliner: `pitchTransition` 1 tile (adjacent) or 4 tiles (flat↔steep) |
| Bank transitions | FlatToLeftBank, LeftBankToFlat, LeftBankToUp25 | 1×1 | no | Must pass through none |
| Banked-slope variants | declared combos only | 1×1 | no | Not “any curve inherits pitch/bank” (target) |
| Tight 90° | 1-tile | 1×1 | no | Wild mouse / compact |
| Sharp 90° | QuarterTurn3Tiles | ~2×2 | yes | Headliner `curve*1` is 1-tile; `curve*2` ≈ 2×2 |
| Medium 90° | QuarterTurn5Tiles | ~3×3 | yes | Headliner `curve*3` |
| Large / diagonal eighth | eighth-to-diag | ~4×4 / 5×5 | yes | Headliner `curve*4`; **no diagonal yet** |
| S-bend | SBend | ~2×4 flat | yes | Headliner `sBendLeft` / `sBendRight` |
| Helix | small ~3×3, large ~5×5 | 3×3 / 5×5 | yes | Headliner `helixLeft` / `helixRight`: small 3×3, +1 rise, heading unchanged. Large helix not shipped |
| Vertical loop | VerticalLoop | ~4 along | yes | Headliner `verticalLoop`; heading unchanged |
| Half loop | HalfLoop (reverses heading) | ~4 along | yes | `halfLoopUp` → inverted + heading+2; `halfLoopDown` from inverted. Left/right “down” names were historically swapped in RCT2 |
| Corkscrew / twist / barrel / zero-G / quarter loop | | multi-tile | yes | **Missing** |
| Brakes / photos / splash | Brakes, BlockBrakes, BrakeForDrop, Booster, OnRidePhoto, Watersplash | 2–4 along | yes | Headliner has `brakes`, `photo`, `splash` only |
| Lifts | chain flag vs cable / powered / curved | — | — | Headliner: flag only |
| Covered / supports | track style vs ride type | — | — | Not a piece ID |

**Track groups** are availability buckets on the ride type:

`straight`, `stationEnd`, `liftHill`, `liftHillSteep`, `slope`,
`slopeSteepUp` / `Down`, `slopeVertical`, `slopeCurve`, `slopeCurveBanked`,
`sBend`, `curveVerySmall` / `Small` / `Large`, `verticalLoop`, `halfLoop`,
`corkscrew`, `twist`, `barrelRoll`, `zeroGRoll`, `helix`, `brakes`,
`blockBrakes`, `booster`, `onridePhoto`, `waterSplash`, `diag*`.

Do **not** port 337 OpenRCT2 `TrackElemType` numeric IDs. Keep parametric
generation but **gate** by connection state + TrackGroup-like
`supportedPieces` / `headlinerPieces`. Numeric IDs grew past 337 —
do not treat 337 as a hard ceiling.

**Multi-tile:** sequence 0 = origin; later tiles increment sequence.
Collision / placement / supports should use a **tile list**. Cars still follow
sampled `points[]`. Headliner collision today samples `points[]` plus a
narrow right-offset (`canBuildTrackPiece`). That is not a sequence occupancy
map yet.

## Builder UI

### RCT2 / OpenRCT2 construction (target)

1. Pick **ride type** first, then place the first station tile
   (`StartTrackPiece = endStation`).
2. Build only from an **open end**. Buttons rebuild from that end’s slope/bank
   so only legal next pieces show.
3. **Direction:** straight / sharp (3-tile) / medium (5-tile) / smooth
   (eighth → diagonal). On diagonal, only straight + smooth.
4. **Slope:** flat / 25 / 60 / 90 if the type allows **and** the end can reach
   it via transitions.
5. **Specials** menu: loops, corkscrews, helix, brakes, photo, splash —
   filtered by current end + TrackGroups.
6. **Chain lift** checkbox on eligible uphill pieces.
7. Build places a ghost. RCT2 demolishes **last**; OpenRCT2 can demolish
   selected / from-here.
8. Entrance / exit **adjacent to STATION tiles only**. Path / queue to the
   entrance.
9. **Operating:** mode (circuit, block-sectioned, powered launch,
   reverse-incline shuttle); trains × cars; wait times; lift speed;
   brake / booster speed per piece. Closed circuit except launch / shuttle.
10. Test → rate → open.

### What Headliner already has (`#coaster-builder` in `src/main.ts`)

Do not reinvent this window.

| Control | DOM / state | Behaviour |
| --- | --- | --- |
| Type | Attraktionen → **Achterbahn** catalog tab | Each playable type is a **direct catalog tile** (Wooden / Twister / Junior / …), same grid as buildings. The tile icon is a generated **train thumbnail** (`WorldView.coasterTrainThumbnail` / `coasterVehiclePreview`) of that type’s in-world `trainStyle` (wooden, B&M sitdown, invert V, mouse, bobsled, junior, launched, giga, flying, swinging, …) — not a generic coaster emoji. Picking a type opens `#coaster-builder` and locks that type. The construction window shows `#coaster-type-name` + `#coaster-type-hint` (LIM: no chain, junior: gentle only, …) — no nested type dropdown. |
| Direction | `#track-direction-palette` | `curveLeft4` … `curveLeft1`, `straight`, `curveRight1` … `curveRight4` |
| Specials | `#toggle-track-specials`, `#track-special-palette` | station, s-bends, verticalLoop, halfLoopUp/Down, photo, splash, brakes, helixLeft/Right. Type-unsupported kinds stay **hidden**. Currently illegal on this end stay **visible and greyed** (`disabled`) |
| Slope | `#track-slope-palette` | steep down / gentle down / flat / gentle up / steep up. Type-never slopes (junior Steil) stay **hidden**. Unreachable from this end stay **greyed**. Enabled slope clicks may still **hard-switch** bank; greyed clicks do nothing |
| Bank | `#track-bank-palette` | left / none / right (`±TRACK_BANK_ANGLE`). Types without banking hide left/right. Opposite-bank and illegal combos stay **greyed**. Enabled bank clicks may snap slope |
| Chain | `#toggle-chain-lift` / `#chain-lift` | Shown when the type allows a lift (`isTrackChainLiftVisible`). Greyed when this end / next piece cannot take one (`isTrackChainLiftEligible`). LIM / no-lift types hide it |
| Preview / build | `#coaster-build-piece` | Ghost via `createTrackPiece` → `setCoasterConstructionPreview`. First click sets start candidate; confirm calls `startCoaster`. Later calls `appendCoasterPiece` |
| Undo last | `#coaster-undo` | `undoCoasterPiece` |
| Delete selected | `#delete-track-from-here` | `deleteCoasterPiece` (cannot delete index 0) |
| Cursor | `#track-previous` / `#track-next` | Selects the open end after that piece |
| Start heading | `#coaster-rotate` | Only before the first station exists |
| Gates | `#place-coaster-entrance` / `#place-coaster-exit` | `setCoasterAccess` — must be adjacent to a `station` tile |
| Demolish ride | `#demolish-coaster-construction` | `removeCoaster` |
| Info panel | `#coaster-options` | `setCoasterOperationMode` (`closed` / `open` / `test`), `updateCoasterSettings`, `updateCoasterPrice`, `recallCoasterTrain`. **Testbetrieb** dispatches the empty train immediately on a closed circuit and keeps integrating physics on every sim tick — including during festival **planning** (new scenarios start there) as long as speed is not 0. Planning still holds guests, economy and the weekend clock. |

Palette visibility **must** go through `src/game/coasterConnections.ts`
(`listTrackPalettePieces`, `listTrackPitchChoices`, `listTrackBankChoices`,
`isTrackChainLiftVisible` / `isTrackChainLiftEligible`,
`resolveNextTrackPiece`, `applyConstructionPitch` / `applyConstructionBank` /
`applyConstructionKind`), not only DOM conditionals. `updateCoasterBuilderPanel`
in `src/ui/coasterBuilderPanel.ts` is called through the composition root's
snapshot listener, but **returns immediately**
unless `updateCoasterConstruction` reports a change (open end, type,
selected kind/pitch/bank, legal ride flags, start pose). Visitor/vehicle
ticks do not remount or re-style the palette. When the window *does*
change, `coasterBuilderPanel.ts` **diff-updates** the direction / special / slope / bank /
chain buttons via `syncCoasterPalette` (no leftover `[hidden]` nodes). Do
**not** `innerHTML`-replace or `replaceChildren` the construction window on
every tick, hover, or mousemove — that remounts buttons, wipes `:hover`,
and drops clicks between pointerdown and click. Remount only when the
stable id list changes (type-supported set). Type-supported buttons keep a
**stable per-type layout**; current-state illegality uses `disabled` + grey
CSS (`.rct-coaster-construction .piece-palette button:disabled`), not
omission. Greyed pieces stay disabled without remounting the palette.
The ghost mesh (`WorldView.setCoasterConstructionPreview`) is recreated
only when `coasterConstructionPreviewKey` changes, not on every hover.

A direction/special button is **listed** if `catalogAllowsTrackPiece` /
`supportedPieces` includes it. It is **enabled** only if
`describeTrackAppendIssue` accepts that kind on the **current open end**
(begin slope/bank + inverted + banked-sloped-curve + type groups).
Slope/bank buttons are listed when the type can ever use that value.
They are enabled only if `resolveNextTrackPiece` after an enabled
hard-switch would actually apply that pitch/bank. Greyed slope/bank/kind
clicks are ignored (`applyConstructionKind` returns the window unchanged;
pitch/bank selectors no-op) so the ghost cannot desync.

**Hidden (type can never build):** wooden 1-tile turns and helix; junior
Steil and inversions; LIM chain button; wild mouse banking and 2+ tile
curves; catalog-omitted specials (no corkscrew on junior).

**Greyed (cannot use on this end):** mine-train banked sloped curves and
banked Steil; bobsled sloped curves; specials on a sloped or wrongly
banked end; opposite-bank; chain on a flat/downhill end; direction
buttons before the first station.

Slope / bank / heading **hard-switch** applies only to **enabled** clicks:
changing one enabled axis snaps the others to a legal default. Selecting
an enabled direction/special that is legal at the open end snaps
`targetPitch` / `targetBank` back to that end
(`applyConstructionKind(..., openEnd)`) so the ghost becomes that piece
instead of a leftover pitch/bank transition. No steep+bank unless the type
declares that combination (`steep && banking && slopeCurveBanked`). The next
piece + ghost are a **pure function** of the construction window and the
open end — they update when the player clicks a different **enabled**
slope/bank/direction **before** placing. Ghost mesh uses
`createStyledCoasterTrackPiece` with the type’s rail family (cyan ghost
material). `appendCoasterPiece` uses the same `resolveNextTrackPiece`
result; `describeTrackAppendIssue` still rejects leftovers.

Specials need a flat, unbanked end (except `halfLoopDown`, which needs
inverted). Stations need flat + unbanked. Curves must match bank sign.
Slope buttons use `canTransitionTrackPitch`. Bank buttons cannot jump
Left ↔ Right.

### Game commands

Die Schienenmutationen laufen hinter `CoasterCommandContext`; das Modul
importiert keinen konkreten `GameState`. Netzwerk-Bindung und öffentliche
Fassadenmethoden bleiben unverändert.

| Command | GameState |
| --- | --- |
| `startCoaster` `{ typeId, x, z }` | `startCoaster` — first piece is always `station`, flat, unbanked, heading = `buildRotation` |
| `appendCoasterPiece` `{ coasterId, kind, chainLift, afterPieceIndex?, options }` | `appendCoasterPiece` — `options` is `TrackBuildOptions` `{ targetPitch?, targetBank? }` |
| `undoCoasterPiece` `{ coasterId }` | pop last (not the first station) |
| `deleteCoasterPiece` `{ coasterId, pieceIndex }` | remove selected; index 0 forbidden |
| `removeCoaster` `{ coasterId }` | full demolish + entrance queue; see `attractions.md` |
| `setCoasterAccess` `{ coasterId, accessType, x, z }` | adjacent station only |
| `updateCoasterSettings` | dispatch mode + interval |
| `updateCoasterPrice` | ticket |
| `setCoasterOperationMode` | `closed` / `test` / `open` — open/test require `coaster.closed` (circuit) and gates for `open` |
| `recallCoasterTrain` | unload / return |

Circuit close: `isCoasterCircuitClosed` / `trackAnchorsAlign(last.end, first.start)`.
Operation cannot leave `closed` until the circuit is closed.
`setCoasterOperationMode(..., 'test')` recalls the train, then
`CoasterSimulation.update` launches it from boarding with
`stationLaunchSpeed` on the next tick. That tick still runs in planning
(`stepFixed` → `updateCoastersForCurrentTick`) so Testfahrt works before
**Festival starten**. Der Service importiert keinen konkreten `GameState`.

## Per-type matrix

Vanilla enabled groups. OpenRCT2 extras are **cheats / modern RTDs** — decide
vanilla vs modern **before** copying. Floorless is a **Twister vehicle**, not
its own ride type. Go-karts / mini railway share `TrackElemType` with tiny
groups — **not** Headliner coaster types.

The live table is `COASTER_CATALOG` in `src/game/coasterTypes.ts`. Every row
has `playable === true` and a matching `COASTER_TYPES` entry. Missing /
unknown `typeId` on load becomes `classicSteel`. Tests in
`tests/coasterTypes.ts` lock the facts below.

| Type | 25 | 60 | 90 | Bank | Inversions | Distinct editor notes |
| --- | --- | --- | --- | --- | --- | --- |
| **classicSteel** | yes | Headliner 45° | no | yes | loop + half-loop | All current kinds except helix. Chain flag. Circuit. One train. Save fallback |
| wooden | yes | yes | no | yes | loop default; no corkscrew | Water splash, reverse-incline shuttle |
| looping | yes | yes | **extra** | yes | vertical loop default | Powered launch |
| corkscrew | yes | yes | no | yes | loop, half-loop, corkscrew | Corkscrew kind not in Headliner yet |
| hyper | yes | yes | no | yes | none | Corkscrew-style **without** inversion pieces; taller |
| twister | yes | yes | **vanilla** | yes | full modern | Circuit + block only, no launch |
| hyperTwister | yes | yes | vanilla | yes | none | Twister without inversions |
| verticalDrop | yes | yes | vanilla | yes | none | Brake-for-drop, steep chain, boxed supports |
| giga | yes | yes | no | yes | **extra only** | Cable lift |
| lsmLaunched | yes | yes | no | yes | on | Boosters; chain **extra** |
| limLaunched | yes | yes | no | yes | on | **No lift hill**; launch only |
| inverted | yes | yes | no | yes | on | Suspended, quarter helices, dive |
| compactInverted | yes | yes | no | yes | on | Smaller; reverse-incline |
| flying | yes | yes | no | yes | on | Starts inverted; fly↔lie; two drawers |
| standUp | yes | yes | no default | yes | loop / half / corkscrew | |
| junior | **only** | no | no | yes | none | Curved lift, low height; no `flatToSteep` |
| steelWildMouse | yes | yes | no | **no** | none | 1-tile turns; cars not trains |
| woodenWildMouse | yes | yes | no | **no** | none | No brakes **group**; circuit only |
| mineTrain | yes | yes | no | yes | none | Banking but **no** `slopeCurveBanked` |
| bobsled | **only** | no | no | trough | none | No large / sloped curves |
| suspendedSwinging | yes | yes | no | **no roll** | none | Unbanked helix; swinging cars |

Vehicle flags can further forbid banked track or inversions even if the RTD
enables the group.

**Shipped this round:** discrete live gate, all catalog types, helix family
(`helixLeft` / `helixRight`, 3×3, +1 rise, same heading), existing specials
filtered by type, family track + train visuals.

**Still not placeable (catalog / groups only):** corkscrew, barrel / zero-G,
twist, diagonal, booster, block brake, cable / powered lift *pieces*, 90°
vertical, dedicated banked-slope curve IDs. Corkscrew/hyper types can still
build with loops / half-loops / helix where the catalog allows.

## Current Headliner model

Cite `src/game/coasters.ts`.

**Type:** `CoasterTypeId` = all `COASTER_CATALOG_TYPE_IDS`.
`getCoasterType(id)` / `resolveCoasterTypeId` fall back to `classicSteel`.
Each type has `supportedPieces`, `liftStyle`, `trackStyle`, `trainStyle`.

**Kinds:** `station`, `straight`, `slopeGentleUp` / `Down`, `slopeUp` /
`slopeDown`, `pitchTransition`, `bankTransition`, `curveLeft1..4`,
`curveRight1..4`, `sBendLeft` / `Right`, `verticalLoop`, `halfLoopUp` /
`Down`, `photo`, `splash`, `brakes`, `helixLeft` / `helixRight`.

**Visual families** (`src/view/coasterTrack.ts` + `coasterCars.ts`):

| Style | Types |
| --- | --- |
| steelLattice / sitDownSteel | classicSteel, looping, corkscrew, standUp |
| wooden / wooden or mine trains | wooden, mineTrain |
| boxSpine / bmSitdown | twister, hyperTwister |
| invertedBox / invertV | inverted, compactInverted |
| flyingSpine / flying | flying |
| juniorTubular / junior | junior |
| wildMouse / mouse | steelWildMouse |
| woodenMouse / mouse | woodenWildMouse |
| bobsledTrough / bobsled | bobsled |
| suspendedSpine / swinging | suspendedSwinging |
| gigaLattice / giga or sitDown | giga, verticalDrop, hyper |
| launchedSteel / launched | lsmLaunched, limLaunched |

**Geometry:** `TrackPiece` has `start` / `end` `TrackAnchor` and sampled
`points[]`. Curves are quarter-circles with radii 1–4; they keep start pitch
and bank. Bank sign must match turn (`turn` −1 left / +1 right). Specials are
built in `createSpecialTrack` (s-bend lateral 2, loops radius 2, splash length
4, photo/brakes length 2).

**Pitch:** `TRACK_PITCHES` — flat `0`, gentle `±atan(0.5)`, steep `±π/4`
(labelled Steil, **not 60°**). Live append uses the discrete machine plus
the documented exception: `slopeGentleUp` / `slopeGentleDown` from a flat
station. Constant steep from flat needs a `pitchTransition`.

**Bank:** `TRACK_BANK_ANGLE = 35°` or `0`. After `halfLoopUp`, `end.bank = π`
and heading `+2`. `halfLoopDown` requires that inverted end.

**Chain:** boolean; `chainAllowed` on `slopeGentleUp`, `slopeUp`,
`pitchTransition` (only if the transition goes up). Extra cost
`economy.chainLiftCost`.

**Trains:** `train.cars = stationCount`, `capacity = stations * carCapacity`
(4 seats). One train. `DispatchMode` is not block sections.

**Physics:** `classicSteel.physics` + `physicsSimulation` (SI). Join smoothing
`trackJoinSmoothing.sigma` (0.28 tiles), Gaussian on elevation / non-curve
joins; plan curves stay circular. Snapshot `points` stay sharp. **Keep this.**
Do not port RCT2 excitement / intensity / nausea. Circuit pace (~60 % faster
than 0.1.160) comes from launch / chain / station drive, a higher
`maximumSpeed` clip (90 m/s), and lower `dragArea` — not from changing
`gravity` or freezing guests. Per-type overrides keep the same ratios
(Giga `chainSpeed` 11.5, LSM 28.8 / LIM 32 launch, hyper / mouse drag).

**Join / cache:** `getSmoothedCoasterPiecePoints`, invalidate on piece-id /
chain signature. Cars follow the same derived centerline as the mesh.

## Editing rules (invariants)

When editing the coaster editor:

1. Preserve a discrete end state. **Refuse illegal appends.** Do not add
   freeform spline placement.
2. Split **constant** pieces vs **transition** pieces. The palette must not
   skip slope / bank states.
3. Banked + sloped curves only as **declared combinations**, not “any curve
   inherits current pitch/bank”.
4. Do not port 337 OpenRCT2 piece IDs. Keep parametric generation; gate with
   connection state + `supportedPieces` / catalog groups.
5. New types via `supportedPieces` / group bitsets, **not** a new geometry
   engine. Suggested first split: `classicSteel` vs wooden vs junior / mouse.
6. Helix **before** corkscrews. Diagonal is expensive (8-way heading) —
   defer until orthogonal + helix + banked slopes feel right.
7. Station = flat unbanked chain. Chain-lift is a flag. Do not silently
   shrink legacy scenery / saves (project-wide rule).
8. Multi-tile occupancy: tile list for placement / collision / supports;
   cars follow `points[]`.
9. Do not freeze visitors or skip sim for benchmarks.
10. Keep SI physics and Gaussian join smoothing (`trackJoinSmoothing`).
11. Do not port boosters, cable lifts, flying invert, TD6, or ~40 RTDs until
    the state machine + footprints work.
12. Steep stays 45° and is labelled Steil. Do not mix 60° into comments.
13. Update **this file** when adding piece kinds, types, commands, or
    connection rules. New `GameCommand` / snapshot fields also need
    [`multiplayer.md`](multiplayer.md) and [`saves.md`](saves.md). New
    balancing keys go in `simulationConfig.ts` **and** this topic.
14. After simulation / render changes: `npm test` && `npm run build`.

### Do / don't

| Do | Don't |
| --- | --- |
| Filter type-never pieces; grey currently illegal ones | Hide currently-illegal buttons so the palette jumps |
| Use `describeTrackAppendIssue` for live gates | Duplicate legality only in `main.ts` DOM |
| Add a catalog row + tests before a new type | Invent 20 live `CoasterTypeId`s |
| Keep `classicSteel` save-compatible | Silently change `supportedPieces` |
| Gate extras as `extra`, not vanilla | Copy OpenRCT2 cheat groups as default |

## Required checks

Changing piece kinds, connection / state-machine rules, type catalogs,
specials, or builder legality **requires** updating and passing
`tests/coasterTypes.ts` (wired from `tests/regression.ts`).

- Do **not** add a coaster type or special piece without a catalog row
  (`COASTER_CATALOG`) and tests.
- Do **not** weaken tests to make an illegal connection pass.
- `describeTrackAppendIssue` is the live gate: discrete begin/end + type
  groups, plus the Headliner exception “gentle climb from a flat station”.
- `resolveNextTrackPiece` is the shared next-piece helper for UI ghost and
  `appendCoasterPiece`. It must never return an illegal combo. Palette lists
  use `listTrackPalettePieces`: type-unsupported kinds omitted; currently
  illegal kinds listed with `enabled: false`. Greyed clicks must not change
  the ghost.
- `describeDiscreteConnectionIssue` stays the stricter RCT2-style spec
  (constant steep/gentle from the wrong slope still fail there).
- Attractions / demolish / queue tests stay in `tests/festivalAdditions.ts`,
  `tests/rideAccess.ts`, `tests/performanceGuards.ts`.

Run: `npm test` (full suite via `scripts/test.mjs`) and `npm run build`.

## Recommended implementation priority

1. Document / implement Headliner connection state aligned with RCT2:
   heading 0–3, pitch ∈ {steepDown, gentleDown, flat, gentleUp, steepUp},
   bank ∈ {left, none, right, inverted}. Every `TrackPieceKind` + options
   declares begin/end (`discretePieceEnds`).
2. Transitions first-class in the palette (already the slope/bank buttons).
3. Fix or honestly label the steep angle (45° vs 60°).
4. Explicit banked-turn rules (declared combos).
5. Helix family.
6. Second type via `supportedPieces` (wooden or junior / mouse).
7. Untie car count from station tiles; block brakes **before** a second train.
8. Multi-tile AABB / sequence occupancy.

## Tests

| File | What it locks |
| --- | --- |
| `tests/coasterTypes.ts` | Catalog matrix, all types playable, **vehicle thumbnail spec** per type, live append legality, palette **type-omit vs current-state grey** (wooden / junior / LIM / wild mouse / mine train / bobsled), hard-switch slope/bank/**kind** (first enabled click changes window), disabled kind does not change ghost, **palette listed twice without click keeps ids / does not remount**, **`updateCoasterConstruction` does not apply across playing `tick`s**, helix, missing-type → classicSteel, discrete machine, `GameState` smoke, **classicSteel rectangle in Testbetrieb during planning advances distance/speed**, SI floors (`chainSpeed` ≥ 10, `stationLaunchSpeed` ≥ 20, `dragArea` ≤ 0.55, `gravity` 9.81, `maximumSpeed` ≥ 85) |
| `tests/festivalAdditions.ts` | 1-tile slopes, flat↔steep clothoid, inversions, join smoothing, full demolish, physics speed floors |
| `tests/performanceGuards.ts` | Specials batch, one photo charge, car mesh |
| `tests/rideAccess.ts` | Carousel / bungee gates (not the track editor) |

## Related docs

- [`attractions.md`](attractions.md) — queues, access, demolish, SI physics caches
- [`ui.md`](ui.md) — construction window placement in the build menu
- [`rendering.md`](rendering.md) — rail tubes, car meshes
- [`multiplayer.md`](multiplayer.md) / [`saves.md`](saves.md) — commands / snapshot
- [`testing.md`](testing.md) — how to run the suite

## Sources

Not a dump — read these when implementing, not instead of this file:

- OpenRCT2 `Track.h`, `TrackData`, `RideConstruction`, `RideData`, `rtd/coaster/*.h`
- OpenRCT2 wiki: Maps / Track drawers
- rct.wiki: Building A Ride
- Local: this file, [`attractions.md`](attractions.md), `src/game/coasters.ts`

## Uncertainty flags

- Exact TrackData Δz (especially Up60 / FlatToUp25) — verify before coding
  height tables.
- OpenRCT2 extras vs vanilla RCT2 — catalog marks `extra`; do not treat extras
  as default.
- Floorless is a vehicle of Twister, not an RTD.
- `TrackElemType` numeric IDs grew past 337.

## Bei Änderungen dieses Dokument

Update when piece kinds, connection rules, catalog types, commands, builder
legality, visual styles, or tests change. New playable `CoasterTypeId` also
belongs in `COASTER_TYPES`, `simulationConfig.ts` (if stats change), and the
Attraktionen → Achterbahn catalog tiles in `buildMenu.ts`. Gameplay-only
queue / gate changes stay in `attractions.md`.
