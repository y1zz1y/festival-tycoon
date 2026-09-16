# Bandversorgung (backstage / tour bus)

Agent-facing source of truth for **Bandversorgung**, **Backstage** areas,
**Tourbus-Parkplatz**, band arrival, and how supply changes concert quality.

Guest **Festivallust** (`Visitor.motivation`) already refills from booked live
shows (`atmosphere.concertMotivationPerMinute`). Keep that. Bandversorgung
**scales** that refill (and the other show hooks below). Do not revert concert
motivation.

Player-facing labels stay German even though this spec is English:

| UI label | Meaning |
| --- | --- |
| **Logistik** | Logistics management window (`#logistics-panel`, title Transport & Logistik) |
| **Bandversorgung** | New tab next to Übersicht / Waren & Träger / Buslinien |
| **Backstage** / **Backstagebereich** | Designated artist-area tiles |
| **Parkplatz für den Tourbus** / **Tourbus-Parkplatz** | First supply building: one bus slot |
| **Verpflegung** | Catering stat |
| **Attraktivität** | Attractiveness of the backstage pool (not the park atmosphere overlay) |
| **Bandzufriedenheit** / **Drauf** | Derived band satisfaction |
| **Personaleingang** | `staffGate` on a `staffOnly` path |

Show / festival gameplay stays in [`festival.md`](festival.md) and
[`stages.md`](stages.md). Do not dump this file there.

## Status

Implemented. Concerts stay legal on a bare stage; supply scales show quality.

| Layer | Implementation |
| --- | --- |
| Bands | Catalog `BANDS` + `Booking`; `bandActors` lineup on site; same `bandLooks` costume on stage (`stageBand.ts`) and backstage |
| Backstage | `backstageCells` overlay, walkable for staff/bands/intruding fans, **placeable** |
| Logistics tabs | `overview`, `supply`, `routes`, `band-supply` (**Bandversorgung**) |
| Tour bus | `tourBusParking` + road vehicle `tourBus` (not guest `parkingCells` / shuttle `bus`) |
| Concert quality | Fun, Festivallust, and `sales` tips multiply by **show quality** from Drauf |
| Security vs fans | Baseline fan leak; no security/fence reduction in v1 |

## Wo finden

| Aufgabe | Datei | Einstieg |
| --- | --- | --- |
| Graph, stats, designation, inspect text | `src/game/bandSupply.ts` | `buildBandSupplyGraph`, `computeBandSupplyStats`, `designateBackstageAreas`, `formatBackstageInspect` |
| Band actors / arrival plan | `src/game/bandActors.ts` | `planBandPresence`, `createTourBusVehicle`, `createBandActor` |
| Costume / lineup | `src/game/bandLooks.ts` | `bandCostumeId`, `bandLook`, `bandRoles` (genre palette + per-act accent) |
| Tick / place / inspect | `src/game/GameState.ts` | `designateBackstageArea`, `syncBandSupply`, `showQualityForStage`, `canPlace` lock |
| Catalog | `src/game/catalog.ts` | `tourBusParking`, `Tool` `backstageArea` |
| Build menu | `src/game/buildMenu.ts` | Logistik → Bandversorgung: **Backstage ausweisen** (`backstageArea`) then Tourbus-Parkplatz |
| Balancing | `src/game/simulationConfig.ts` | `SIMULATION_CONFIG.bandSupply`, `economy.buildings.tourBusParking` |
| Commands | `src/net/protocol.ts`, `commands.ts`, `bind.ts` | `designateBackstageArea`; `place` / `bulldoze` for parking |
| Snapshot | `GameSnapshot` v29 | `backstageCells`, `bandActors`, `bandSupply` |
| Logistics UI | `src/main.ts` `#logistics-panel` | Tab `data-logistics-tab="band-supply"` |
| Overlay | `src/view/BackstageView.ts` | One `InstancedMesh` (active teal / inactive amber) |
| Band people | `src/view/BandActorView.ts`, `src/view/bandMemberMesh.ts` | Same merged musician mesh as the stage; hide while `vehicleId` is set or `state === 'performing'` |
| Parking mesh | `src/view/logisticsModels.ts` | `tourBusParking` pad; distinct dark `tourBus` coach (not the yellow shuttle) |
| Tests | `tests/bandSupply.ts` | Wired from `tests/regression.ts` |

Do not edit `src/game/coasters.ts`, `coasterTypes.ts`, `coasterConnections.ts`,
coaster view meshes, or `tests/coasterTypes.ts` for this feature.

## Docking (real type names)

Read these before coding. Match the identifiers.

| Topic | Names |
| --- | --- |
| Band catalog | `BANDS`, fields `id`, `name`, `genre`, `audience`, `fee`, `draw`, `speakers`, `reputation` in `festivalManagement.ts` |
| Booking | `Booking` `{ id, bandId, stageId, day, start, duration, fee }` |
| Live show gate | `showIssue`, `activeBookings`, `watchableBookings` |
| Stage | `BuildingKind` `'stage'`, footprint `buildingFootprint` / `occupiesBuildingCell` |
| Forecourt (not backstage) | `stageForecourtCells`, `designateStageForecourt` |
| Guest fun at a live slot | `updateFestival`: `needs.fun += minutes * (1.5 * affinity) * (1 + show.boost)` when `partying` on the booking within 8 tiles |
| Festivallust | `Visitor.motivation`, `updateConcertAttendance` × `atmosphere.concertMotivationPerMinute` |
| Stage design boost | `show.boost` from `stageStats(design).party` and `stagePhase` volume/intensity |
| Festival clock | `GameSnapshot.day`, `minute` (0–1439), `festivalTime`, `DayPlan`, `FestivalPhase` `lead` / `festival` / `break` |
| Booking window | 08–24 on a festival day (`start >= 8 * 60`) |
| Day visitors | `dayPlan.dayVisitorEntryHour` default **8**, `dayVisitorExitHour` default **23** |
| Food / drink stands | `BuildingKind` `'food'` (**Imbiss**), `'alcohol'` (**Getränkestand**) |
| Shop access | `isShopServiceKind`, `shopAccess.ts` — guests at the front; carriers any side |
| Roads / parking | `logistics.parkingCells` = **guest** bays; `findRoadRoute`, `getParkingApproachRoads` |
| Shuttle bus | `bus`, `busStop`, `busDepot` — guest shuttle, **not** the tour bus |
| Staff entrance | `staffGate` FestivalAction / path tool **Personaleingang**; path flag `staffOnly`; `staffGateDirection`; `staffGateWorldPosition` |
| Staff | `StaffRole` `'security'` / `'cleaner'` / …; `allowStaff` on `findPath` |
| Scenery | `SCENERY_KINDS`, optional `decorationSlot`; missing slot = legacy full tile |
| Logistics tabs | `data-logistics-tab`: `overview`, `supply`, `routes`, `band-supply` |
| Finance | `FinanceCategory` `'bands'` = **Gagen**. Concert **Trinkgeld** books to `'sales'` |
| Atmosphere overlay | `attractiveness` / `partyMood` — park-wide; **different** from backstage Attraktivität |

## Core loop (must follow)

1. A booked band may perform with **only a stage** (`showIssue` unchanged:
   power, forecourt, speakers, weather, day-plan). That remains legal.
2. Bare stage ⇒ low **Bandzufriedenheit** ⇒ worse **show quality** ⇒ worse
   guest fun, Festivallust refill, festival satisfaction samples, and tip
   income (see [Show hooks](#show-hooks-existing-stats)).
3. The better the band is doing (satisfaction / Drauf), the better those
   stats. Stage design `show.boost` still applies; supply is an extra
   multiplier, not a replacement.
4. **Bandversorgung always applies to the adjacent/connected stage.** Several
   stages that share one connected backstage graph **share one pool**. Do
   not stack independent per-stage bonuses on the same tiles.

Default sharing (do not “justify” a split in v1):

```
component = 4-neighbour flood fill of
  backstageCells ∪ stage footprint cells (kind === 'stage')
active   = component contains ≥ 1 stage
stats    = one BandSupplyStats for the whole active component
```

Orthogonal neighbours only (same rule as `connectedWasteDumpStats`).
Elevation: same tile elevation as the designation (terrain pad). Do not
connect across a full-tile height gap.

## Backstage designation

Painted from **Logistik → Bandversorgung** in the build catalog
(`backstageArea`, same rectangle / stroke as waste dump or camping) and from
the **Bandversorgung** tab in `#logistics-panel`. Not a `BuildingKind` `'path'`.

### Invariants

- A backstage tile is **active** only if its component reaches a `stage`
  footprint (directly or through other backstage tiles).
- Disconnected tiles stay designated, show a **warning tint**, and
  **do not** contribute deco, parking, catering extras, or walkability
  privileges. Items sitting on them do not count.
- Bandversorgung **buildings/items can only be placed on designated
  backstage** (active or not). Reject otherwise.
- Items on inactive tiles do not count until the region connects.
- Designation is not a `WayType`. Do not add `footBackstage` to `WAY_TYPES`.
- Topology change ⇒ invalidate pedestrian nav immediately (`worldRevision`).

### Movement (walkable overlay + placeable)

Backstage is **not** a normal path and **not** a camping/forecourt lockout.

| Rule | Must |
| --- | --- |
| Walkable | Staff, band actors, and fans who already have an intrusion flag treat active backstage like a way (`NAV_BACKSTAGE`). Cost ≈ paved / `footPaved`, not grass |
| Not a guest shortcut | Regular `findPath` **without** staff/intrusion must **not** use backstage (same idea as `staffOnly`) |
| Placeable | `canPlace` must **not** reject ordinary buildings/scenery the way camping, medical, waste dump, and forecourt do |
| Collision | Buildings still collide with each other and with volume (`findCollision`, coaster volumes). Scenery uses `scenery.ts` slots |
| Legacy scenery | Missing `decorationSlot` remains a full-tile object. **Never silently shrink old saves** |
| Paths on backstage | Allowed. A path on a backstage tile stays a path; the overlay remains. Guests on that path do not automatically count as backstage fans unless they leave the path onto overlay-only tiles |
| Solid buildings | Still block walking through the occupied cell (same as a stall on grass). Overlay does not punch through solids |

Do **not** implement walkability by spawning hidden `path` buildings. That
would block placement.

### Overlay

Distinct ground tint (active vs inactive/warning). One shared/instanced
overlay mesh, same batching rules as waste-dump tiles or staff-zone
instances. **No material or draw call per tile decoration.** Keep animated
stages, lights, picking, and this overlay **outside** static building
batches ([`rendering.md`](rendering.md)).

## Fans

Fans **try to enter** nearby active backstage. That is a **baseline leak**.
Security, staff zones, and fences do **not** reduce it in v1.

Today `security` only stations at `securityGate` or patrols
(`staffSimulation.ts`). Fences are scenery/buildings, not guest lockout
except as solids. When a later pass adds a hook, update [`staff.md`](staff.md)
and this file. Until then, quantify the leak with config keys (values later):

```
eligible guest: not leaving / sleeping / medical / injured / vehicle-arrival / bus-riding
  and Manhattan(guest, nearest active backstage tile) ≤ fanIntrusionRange
attempt: each eligible guest, at most once per decision, chance
  minutes * fanIntrusionChancePerMinute
  (counts against pathfinding.decisionsPerTick; fair queue)
success: one multi-goal findPath to any active tile of that component
  with an intrusion flag (do not A* once per tile)
on backstage: guest is a fan; they wander briefly, then leave
```

**Attraktivität** penalty:

```
fanPenalty = min(fanAttractivenessPenaltyCap,
                 fansOnActiveTiles * fanAttractivenessPenaltyPerFan)
```

Index fans once per pass. Do not scan all visitors inside a per-tile loop.

Keys under `SIMULATION_CONFIG.bandSupply`:

| Key | Proposed default | Role |
| --- | --- | --- |
| `fanIntrusionRange` | 6 | Manhattan tiles |
| `fanIntrusionChancePerMinute` | 0.035 | Per eligible guest |
| `fanAttractivenessPenaltyPerFan` | 6 | Points |
| `fanAttractivenessPenaltyCap` | 36 | Cap |
| `fanLingerMinutes` | 4 | Then they path out |

## Tourbus-Parkplatz

First supply item: **Parkplatz für den Tourbus**.

### Invariants

- `BuildingKind` `'tourBusParking'` (catalog name **Parkplatz für den Tourbus**).
- Place **only on designated backstage**.
- Must be **road-reachable**: at least one orthogonal adjacent `road` cell
  (`getParkingApproachRoads` pattern) and a `findRoadRoute` from a map-edge
  entry. Same freight/road rules as depots / guest bays — **do not** mix
  with the pedestrian graph.
- Do **not** reuse `logistics.parkingCells` / tool `parkingArea`. Those are
  guest cars.
- One building = **one bus slot**.
- Usable slot = on **active** backstage **and** currently road-reachable.
- **One slot needed per bus-arrival band** booked that calendar day on a
  stage in this component (`booking.day === snapshot.day`, distinct
  `bandId`). Junior/visitor-arrival bands do **not** consume a slot.
- **Maximum parking attractiveness only if `usableSlots >= busDemand`.**
  3 bus-bands and 2 spots ⇒ not max.

```
parkingRatio = busDemand <= 0 ? null
             : min(1, usableSlots / busDemand)
parkingTerm  = parkingRatio === null ? 0
             : parkingRatio * parkingFullAttractivenessBonus
```

Zero bus-demand (only junior bands, or no bookings today) ⇒ parking does
**not** grant the max bonus. The inspect panel shows „nicht nötig“.

### Morning arrive / evening leave

Tie to the festival clock, not wall time.

| Event | Clock |
| --- | --- |
| Bus arrive | `bandSupply.busArriveHour` — proposed **8**, same default as `dayPlan.dayVisitorEntryHour` |
| Bus leave | `max(busDepartHour, end of that band's last booking that day)` — proposed `busDepartHour` **23** (`dayVisitorExitHour`). Never past 24:00 |
| Which days | Festival days with a `Booking` for that band (`FestivalPhase` `festival`). Not lead/break unless a booking exists (bookings are already festival-day only) |

Vehicle: new `RoadVehicle.kind` `'tourBus'` with a distinct coach mesh.
Drive the road to the slot, **pull onto the `tourBusParking` tile**, then
stay parked until evening leave. Occupants are band actors (not `Visitor`).
Disembark onto the backstage overlay, not the guest
`chooseParkingDisembarkPath` rules. Until parked they are not pedestrians
(same seated-passenger idea as guest cars). Do **not** despawn the empty
coach after drop-off — it must remain on the pad until departure.

If the slot is lost or the road breaks after arrival, the band stays on site
on foot and leaves in the evening via Personaleingang if no bus can depart.

## Arrival modes

Bands are **not** guests. They do not buy tickets and do not run the visitor
need sim.

| Mode | When | How |
| --- | --- | --- |
| **Tourbus** | `band.draw >= visitorArrivalDrawBelow` **and** a usable slot can be reserved for them in the component of their booked stage | Morning bus → slot → hang out on that backstage |
| **Personaleingang** | Automatic fallback: no usable slot, or junior/local (`draw < visitorArrivalDrawBelow`, proposed **30**) | Spawn at a `staffOnly` **Personaleingang** (`staffGate`) like `hireStaff`; `findPath(..., { allowStaff: true })` to the active backstage. If no gate exists, spawn at the map staff/logistics edge already used for staff hire and walk |

No player toggle in v1. Do not add a booking flag until a later UI pass.

Junior examples at `draw < 30`: Meadow Letters (20), Brass Picnic (25),
Campfire Atlas (18), Iron Daisies (28), Confetti Club (22). Headliners
(`aurora` 100, `wildcard` 84, …) always want a bus if parking exists.

If several components exist, a band belongs to the component of
`booking.stageId`. One band, one stage per booking (already true).

## Presence when not performing

On-site band actors **hang out on active backstage** of their component:
idle wander / sit / talk. Spawn the full `bandRoles` lineup (not one
generic extra). **Not** a full `Visitor` need loop.

Each `bandId` has a stable `costumeId` (`genre:bandId`) from
`bandLooks.ts`. Backstage, walking, and on-stage performers use the **same**
merged musician mesh and colours (`bandMemberMesh.ts` / `stageBand.ts`).
Hide `BandActorView` while `state === 'performing'` so the existing stage
animation is not doubled; the stage group stores the same `costumeId`.

At slot start they appear on the stage as today (`stageBand.ts` visuals).
If the stage footprint is connected, they may walk onto it; otherwise they
may snap onto the stage for the show (v1 allowed). After the slot they
return to backstage until evening leave.

Sandbox / no `festival.enabled`: no band actors, no buses. Existing
sandbox dancing stays guest-only.

## Catering (Verpflegung) and deco

### Park stands (v1)

User rule: private food from **stands that already exist on the grounds**
raises Verpflegung. That is **not** “must sit on backstage”.

**Design: proximity count, not a global park total.**

Count `food` and `alcohol` buildings whose Manhattan distance to **any**
tile of (active backstage ∪ connected stage footprint) is
`≤ cateringRange` (proposed **12**, same order as speaker radius 10 /
forecourt 8).

Why not global: one Imbiss on the far camping field must not feed every
stage. Logistics already thinks in reach (`shopAccess`, depot carriers).
Why not backstage-only: the player asked for stands **auf dem Gelände**.
Why presence, not stock: v1 must not nest supply-chain scans inside the
band pass. Stock-out / day-plan `offers.food` can hook later.

```
parkCatering = foodCount * cateringPerFoodStall
             + alcoholCount * cateringPerDrinkStall
```

Bare stage (no active backstage): still count stands near the **stage
footprint** only. A lonely stage next to an Imbiss is less miserable than
a lonely stage in a field.

### Dedicated backstage catering (later)

Future `BuildingKind`s placed only on backstage add into the same
Verpflegung pool (diminishing cap). Do not implement them in v1.

### Deko

Scenery (`SCENERY_KINDS`) whose anchor cell is an **active** backstage tile
raises **Attraktivität**. Use `atmosphere.sources[kind].beauty` (or catalog
`appeal` if a kind has no source). Sum raw, then apply the same style of
diminishing saturation as `atmosphere.ts` (`diminishingSaturation`). Missing
`decorationSlot` still counts as one full-tile object.

Park-wide atmosphere overlay (`GameSnapshot.attractiveness`) is **unchanged**.
Backstage Attraktivität is a separate 0–100 pool stat.

## Stats model

One `BandSupplyStats` per **active** component (shared by every stage in
it). Clamp displayed scores to 0–100.

```
decoScore    = diminish(sum of scenery beauty on active tiles)
parkingTerm  = see Tourbus (0 if no bus demand)
fanPenalty   = see Fans
attractiveness = clamp(decoScore + parkingTerm - fanPenalty)
               // no active backstage: bareStageAttractiveness (fans/deco/parking skipped)

catering     = clamp(0, cateringCap, parkCatering + dedicatedCatering)

satisfaction = clamp(
  attractiveness * satisfactionFromAttractiveness
  + catering * satisfactionFromCatering
  - (activeBackstage ? 0 : satisfactionBarePenalty)
)

showQuality  = lerp(bareShowQuality, maxShowQuality, satisfaction / 100)
```

Comfort / Privacy / Facilities are **out of scope** for v1.

### Bare stage (playable, worse)

No active backstage connected to the stage:

| Stat | Proposed default | Playable? |
| --- | --- | --- |
| Attraktivität | `bareStageAttractiveness` **22** | Yes — grim catering case / empty field |
| Verpflegung | park stands near the stage only (often **0**) | Yes |
| Bandzufriedenheit | mix minus `satisfactionBarePenalty` **28** (typical ~25–40) | Yes |
| Show quality | near `bareShowQuality` **0.62** | Concert still runs if `showIssue` is null |

A well-supplied component should clearly beat this (quality toward
`maxShowQuality` **1.18**). Tests must lock “bare < supplied”.

### `SIMULATION_CONFIG.bandSupply` keys

Values live in `src/game/simulationConfig.ts`. Mention the keys here if they change.

| Key | Proposed | Notes |
| --- | --- | --- |
| `bareStageAttractiveness` | 22 | No active backstage |
| `satisfactionBarePenalty` | 28 | Only when no active backstage |
| `bareShowQuality` | 0.62 | Multiplier floor |
| `maxShowQuality` | 1.18 | At satisfaction 100 |
| `satisfactionFromAttractiveness` | 0.45 | Weight |
| `satisfactionFromCatering` | 0.40 | Weight |
| `parkingFullAttractivenessBonus` | 28 | At ratio 1 |
| `cateringRange` | 12 | Manhattan |
| `cateringPerFoodStall` | 18 | `food` |
| `cateringPerDrinkStall` | 10 | `alcohol` |
| `cateringCap` | 100 | |
| `visitorArrivalDrawBelow` | 30 | Junior/local → gate |
| `busArriveHour` | 8 | |
| `busDepartHour` | 23 | |
| `backstageDesignationCost` | 8 | Like `forecourtDesignationCost` |
| `tourBusParkingCost` | (catalog / `economy.buildings`) | Pay via `bookFinance` `construction` |
| plus fan keys above | | |

## Show hooks (existing stats)

Apply `showQuality` of the booking's stage component (bare defaults if
none). Do not add a parallel fun need.

| Effect | Existing code | Hook |
| --- | --- | --- |
| Guest fun | `updateFestival` live-watch term `(1.5 * affinity) * (1 + show.boost)` | Multiply by `showQuality` |
| Festivallust | `updateConcertAttendance` × `atmosphere.concertMotivationPerMinute` | Multiply by `showQuality`. Waiting / dark / sandbox dance stay as today |
| Festival rating | `festival.metrics.satisfaction` from visitor need averages; `reputation.music` from `concertMinutes` | Do **not** fabricate concert minutes. Higher fun flows into satisfaction samples. Leave `concertMinutes` as watched time |
| Tip / income | `bookFinance(s, 'sales', minutes * tipPerWatcherMinute * showQuality)` in the live-watch branch | Inspect label **Trinkgeld**. No new finance category |

`showIssue` does **not** fail for missing backstage. Supply is quality, not
a hard booking requirement.

## Logistics UI

Window: `#logistics-panel` (Paket-Icon, group **Verwalten**).

Add tab **Bandversorgung** (`data-logistics-tab="band-supply"`) beside
Übersicht, Waren & Träger, Buslinien.

Tab duties:

- Explain that Backstage must connect to a stage
- Paint / erase backstage (preview cell count + cost)
- List connected components: active/inactive, stages, parking ratio
- Catalog shortcut / tool for **Parkplatz für den Tourbus**
- Same paint tool is also the first item in the Logistik catalog tab **Bandversorgung**
- Selecting a component focuses the camera like other inspect “Hin” buttons

Clicking a backstage tile (info tool) opens the **Infofenster** (same side
panel pattern as waste-dump / depot inspect). UI reads the snapshot only.

### Infofenster stats (all of them)

1. Active / inactive + disconnected warning  
2. Tile count (designated vs active)  
3. Connected stages (building id + name / `bandName`)  
4. Bookings today on those stages (`BANDS[].name`, slot time)  
5. Per band: arrival mode **Tourbus** / **Personaleingang**  
6. Usable Tourbus-Parkplätze / bus demand / sufficiency (or „nicht nötig“)  
7. **Attraktivität** 0–100  
8. Breakdown: Deko, Parkplätze, Fan-Abzug  
9. **Verpflegung** 0–100  
10. Breakdown: Imbiss count, Getränkestand count, dedicated catering (0 in v1)  
11. **Bandzufriedenheit** / Drauf 0–100  
12. Bare-stage flag  
13. Show-quality modifier (e.g. 0.62–1.18)  
14. Fans currently on active tiles  
15. Security note: baseline leak; no reduction in v1  

## Save / multiplayer

`GameSnapshot.version` is **29**. Missing `backstageCells` / `bandActors`
normalize to `[]`; missing `bandSupply` becomes an empty summary. Documented
in [`multiplayer.md`](multiplayer.md) and [`saves.md`](saves.md).

### `GameCommand`s

| Command | Role |
| --- | --- |
| `designateBackstageArea` | `{ cells: CellRef[]; enabled?: boolean }` paint / erase, same shape as `designateStageForecourt` / `designateWasteDump` |
| existing `place` / `bulldoze` | `tourBusParking` and later catering kinds |
| existing `manageFestival` | unchanged booking API |

Optional later: `configureBandArrival` toggle — **not** v1.

Optimistic construction like other designation commands. Host remains
authoritative.

### Snapshot fields

| Field | Shape |
| --- | --- |
| `backstageCells` | `{ x, z, elevation }[]` — designation only |
| `bandActors` | Staff-like array (`memberIndex`, `role`, `costumeId`). Do **not** stuff them into `visitors` |
| `bandSupply` | Derived inspect summary: `components`, `showQualityByStageId`, `activeKeys` |
| `logistics.roadVehicles[]` | `kind: 'tourBus'` + `reservedParkingId` / target `tourBusParking` |
| `PlacedBuilding.kind` | `'tourBusParking'` string; unknown kinds already dropped on old clients |
| `Visitor.backstageIntrusion` / `backstageLingerMinutes` | Optional fan-leak flags |

### Kinds / nav / tools

| Item | Name |
| --- | --- |
| Designation | `backstageCells` + `Tool` `'backstageArea'` |
| Way type | **None** — overlay, not `WAY_TYPES` |
| Nav flag | `NAV_BACKSTAGE` next to `NAV_FORECOURT` / `NAV_PARKING` |
| Building | `'tourBusParking'` |
| Vehicle | `'tourBus'` |
| Finance | tips → `'sales'`; build cost → `'construction'` |

Old saves without `backstageCells` play as today: every stage is bare
(playable, worse shows).

## Do / don't

| Do | Don't |
| --- | --- |
| Share one pool per connected graph | Stack the same deco/parking once per stage |
| Keep concerts legal without backstage | Fail `showIssue` for missing supply |
| Scale existing fun / motivation / sales | Revert `Visitor.motivation` or add a second lust need |
| Place supply only on backstage | Let Tourbus-Parkplatz sit on guest `parkingCells` |
| Walkable overlay + placeable tiles | Hidden paths, or treat backstage like camping lockout |
| Guest pathing stays off backstage except fans | Open a public shortcut through artist areas |
| One multi-goal search for fan entry / band idle | A* per interchangeable tile |
| Batch the overlay | Draw call per tinted tile |
| Junior bands + missing slots → Personaleingang | Require a bus for `draw` 18 locals |
| Count nearby `food` / `alcohol` for Verpflegung | Global stand count, or ignore park stands |
| Tests in `tests/bandSupply.ts` | Ship the feature without the required checks |
| Update this file + multiplayer/saves when coded | Leave new commands undocumented |

## Required checks

`tests/bandSupply.ts` (wired from `tests/regression.ts`) locks:

| Case | Lock |
| --- | --- |
| Bare vs supplied | Same booking/stage: no backstage ⇒ lower satisfaction **and** lower `showQuality` than a connected supplied area (deco + enough parking + catering) |
| Shared pool | Two stages, one connected backstage graph ⇒ identical stats object / same `showQuality`; adding deco once helps both, not double |
| Parking ratio | 3 bus-demand bands, 2 usable slots ⇒ parking term `<` full bonus; 3/3 reaches max parking term |
| Fan leak | A visitor flagged on active backstage lowers Attraktivität vs the same area empty |
| Clock | Bus-arrival band present after `busArriveHour` on the booking day; `tourBus` drives onto the parking tile and stays; band actors idle on active backstage; gone after evening leave (bus departs, then despawns) |
| Costume | Idle backstage actor and `updateStageBand` group share `costumeId` for that `bandId` |
| Placement | `tourBusParking` (and any supply kind) rejected off backstage and on ordinary grass; accepted on designated backstage next to a road. Ordinary buildings and deco stay placeable on the overlay |
| Disconnected | Designated tiles with no path to a stage stay markable but inactive; their deco/parking do not count |
| Visitor arrival | Junior or unslotted band uses a `staffOnly` Personaleingang (`allowStaff`), not a tour bus |

Also run `npm test` and `npm run build`. Do not weaken tests to make a
disconnected region look active.

When the suite exists, add a row in [`testing.md`](testing.md).

## Recommended implementation priority

1. `backstageCells` + designation command + batched overlay + inspect stub  
2. Graph / active flag + shared `BandSupplyStats` + `showQuality` hooks  
3. Placement lock + Tourbus-Parkplatz + road-reach + parking ratio  
4. Morning/evening `tourBus` + junior/fallback Personaleingang  
5. Fan intrusion (budgeted)  
6. Park-stand Verpflegung + deco Attraktivität  
7. `tests/bandSupply.ts` + docs (`multiplayer`, `saves`, `buildings`, `README`)

## Related docs

- [`festival.md`](festival.md) — `BANDS`, `Booking`, clock, reputation  
- [`stages.md`](stages.md) — live show, Festivallust conditions, forecourt  
- [`logistics.md`](logistics.md) — roads, `findRoadRoute`, guest parking vs this  
- [`staff.md`](staff.md) — Personaleingang, later security hook  
- [`visitors.md`](visitors.md) — `motivation`, decisions, do not nest scans  
- [`buildings.md`](buildings.md) / [`terrain.md`](terrain.md) — catalog, slots, no new way type  
- [`pathfinding.md`](pathfinding.md) — multi-goal, `staffOnly`, invalidate on topology  
- [`atmosphere.md`](atmosphere.md) — park overlay ≠ backstage Attraktivität  
- [`ui.md`](ui.md) — Logistik tabs, Infofenster  
- [`rendering.md`](rendering.md) — batch the tint  
- [`multiplayer.md`](multiplayer.md) / [`saves.md`](saves.md) — update **when implemented**  
- [`testing.md`](testing.md) — how to run the suite  
- [`architecture.md`](architecture.md) — dock in `game/*`, commands, snapshot  

## Uncertainty / later

- Security / fence reduction of the fan leak — dock in `staff.md` when designed.  
- Dedicated backstage catering buildings — same Verpflegung cap.  
- Player toggle for bus vs gate — not v1.  
- Stock-aware catering — not v1.  
- Comfort / privacy / showers — not v1.  
- Exact euro tip per watcher-minute — pick in `simulationConfig` with the rest.

## Bei Änderungen dieses Dokument

Update when designation, sharing, arrival modes, show hooks, placement,
stats formulae, commands, or required tests change. Implementation must
not silently diverge from the tables above.
