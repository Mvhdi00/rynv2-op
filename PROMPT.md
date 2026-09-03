# SINGLE TARGET AIM LOCK + TRAP ENCLOSURE GAP FILL

> Paste this whole file as your prompt. Attach every reference client you have
> alongside the target client. Phase 0 is blocking: do not write a line of code
> until it is done and reported.

---

# PHASE 0 — READ EVERY ATTACHED FILE FIRST (MANDATORY, BLOCKING)

You have been given several complete moomoo.io clients. They are **not**
decoration and they are **not** optional context. They are the corpus. Several
of them already solve parts of this task, and some of those solutions are
better than what you would invent from scratch.

**Do not open the target client and start editing.** Read the reference clients
first, and report what you found. A plan written without reading them is
rejected.

## The files

| File | Role |
|---|---|
| `Ryn_Type_2.txt` (or whichever RYN build is named) | **the target** — this is what you modify |
| `game_index.js` / `121.txt` | game bundle: protocol, data tables, engine, collision |
| `game_vendor.js` / `221.txt` | game bundle: msgpack codec, polyfills |
| `x18k_Original.txt` | reference client |
| `Aurora_Client.txt` | reference client |
| `13ms_laffer.txt` | reference client |
| `COOKIE_CaraMila.txt` | reference client |
| `luminary_fixed.txt` | reference client |

First, checksum every file against anything already in the repo. Some uploads
are byte-identical copies of files that are already checked in; say so and move
on rather than treating them as new material.

```sh
md5sum <upload> <repo-copy>
```

## What to extract from the GAME BUNDLE (this is authoritative)

Everything about entity rules comes from here, never from your own reasoning.
Find and quote, with line numbers:

1. **`checkCollision`** — exactly which objects push a player, which do not,
   and the trap exception. Pay attention to the owner and team clauses.
2. The **object collision loop** — is every object in the grid checked, or only
   some layer?
3. **`ignoreCollision`**, **`trap`**, **`dmg`**, **`boostSpeed`**, **`teleport`**,
   **`healCol`** — which item definitions carry them.
4. **`layer`** on item groups and resources, and what reads it.
5. The **tick rate** and any client-side prediction the bundle itself does.

Write down the collision rule as one sentence before you use it. If your
enclosure logic disagrees with that sentence later, the logic is wrong.

## What to extract from EACH REFERENCE CLIENT

For every reference client, search for and report:

1. **Target selection** — `nearestEnemy`, `getTarget`, `pickTarget`,
   `ActiveTarget`, `lockTarget`, any target cache. How does it choose? Does it
   hold a target across ticks? Does it have hysteresis? What is its validity
   test?
2. **Aim / target indicator rendering** — `drawTarget`, `aimCircle`, `marker`,
   any ring or reticle drawn on an enemy. How does it stay smooth?
3. **Prediction** — `predict`, `future`, `velocity`, `intercept`, `lead`,
   `motion`, ping compensation. How many ticks ahead, and bounded how?
4. **Enclosure / escape geometry** — `isEscapable`, `exits`, `gap`, `surround`,
   `trapped`, `siege`. Does anything already compute where a boxed-in enemy can
   still get out?
5. **Spike tick / placement scheduling** — how do they keep placement modules
   from fighting each other over the same tick?

Report as a comparison table: feature × client × "has it / how good / worth
stealing". Name the file and line for anything you would borrow.

**Then state plainly:** which reference implementation is better than the
obvious approach, and which you are going to take ideas from. If none is better,
say that — but only after looking.

## Report format for Phase 0

```
FILES:      <n> read, <n> byte-identical duplicates of repo files
GAME RULE:  <the collision sentence, with the line it came from>
PRIOR ART:  <table>
TAKING:     <what you are borrowing, from where, and why>
NOT TAKING: <what you looked at and rejected, and why>
```

Only after this do you touch the target client.

---

# PHASE 1 — MAP THE TARGET CLIENT BEFORE EDITING

Before designing anything, answer these about the target client specifically.
Clients differ enormously between versions; do not assume the structure of one
build applies to another.

1. **How many places independently select a target?** Grep for every
   `nearestEnemy` read. List each one with its class and what it feeds. There is
   usually more than one, and that is the actual bug.
2. **Where does Preplace live? Where does Replace live?** They are not always in
   the same class, and not always in the class named after the placer.
3. **Is there already a placement engine** with its own frame, candidate
   generator, scorer, planner or booking system? If so, you extend it. You do
   not build a second one beside it.
4. **Is there already a prediction system?** If yes, you use it. Writing a
   second predictor for the same quantity is a defect, not a feature.
5. **Is there already escape / exit geometry?** If yes, widen it in place rather
   than duplicating it.
6. **How does spike tick claim a tick?** Find the existing guard —
   there is usually one — and use it rather than inventing a check.
7. **What is the module execution order?** Which modules run before which.
8. **What is the settings object, and how does the menu bind to it?**

Write this map out before proposing a design.

---

# PHASE 2 — THE REQUIREMENT

## CRITICAL — SINGLE TARGET AIM LOCK

The Preplace + Replace engine must operate on ONE TARGET ONLY.
The engine must always select the closest valid enemy to the local player.
Do NOT distribute Preplace/Replace calculations between multiple enemies.
Do NOT switch targets unnecessarily.

### 1. CLOSEST-ENEMY TARGET SELECTION

Create a dedicated target-selection layer for Preplace/Replace.
The selection priority must be:

1. Valid enemy
2. Inside the configured targeting/placement range
3. Closest distance to the local player

The closest valid enemy becomes `ActiveTarget`.

Preplace and Replace must ONLY operate on `ActiveTarget`. All other enemies must
be ignored by the Preplace/Replace engine until the active target becomes
invalid or another enemy becomes legitimately closer.

### 2. AIM CIRCLE / TARGET INDICATOR

Add a lightweight visual target indicator around the currently selected enemy.
The indicator should clearly show:

* The enemy currently locked by Preplace/Replace.
* The targeting radius.
* That this enemy is the active target.

Prefer a simple circle/ring around the enemy rather than a complicated UI
element.

```
LOCAL PLAYER
     |
     |  targeting area
     v
┌─────────────┐
│  AIM AREA   │
│             │
│      ◎      │  ← ActiveTarget
│             │
└─────────────┘
```

The circle should follow the enemy smoothly.
Do NOT make the circle itself responsible for targeting.
The targeting system remains authoritative; the visual indicator only displays
the current target.

### 3. TARGET LOCK

Once an ActiveTarget is selected, Preplace and Replace must use ONLY that
target. The pipeline becomes:

```
Closest Valid Enemy
      ↓
  ActiveTarget
      ↓
Target Prediction
      ↓
Predicted Position
      ↓
Candidate Generation
      ↓
Best Preplace / Replace Position
      ↓
   Validation
      ↓
   Execution
```

Do NOT allow Preplace or Replace to independently select another enemy.

### 4. SMART TARGET SWITCHING

Do NOT constantly switch targets simply because another enemy moves slightly
closer. Use a small target-switch threshold/hysteresis.

Keep the current ActiveTarget unless:

* It dies.
* It leaves the valid range.
* It becomes invalid.
* It disappears.
* Another enemy becomes meaningfully closer according to the configured
  switching threshold.

This prevents rapid `Target A → Target B → Target A → Target B` switching.

### 5. TARGET PRIORITY

Distance is the primary priority. However, distance alone must NOT select an
invalid target.

**INVALID TARGET = NEVER SELECT**

Valid target examples should be determined using the existing game's/player
validation logic. Do not target:

* dead entities
* invalid entities
* teammates
* non-player entities
* entities that cannot be interacted with by the placement system

Use the existing RYN/Game Files definitions rather than inventing new entity
rules.

### 6. AIM POSITION

The aim point should not blindly use the enemy's raw coordinate. Use
`CurrentEnemyPosition`, then calculate `PredictedEnemyPosition` using the
existing prediction system and dynamic network timing.

The visual aim indicator may display the current target, while the actual
Preplace/Replace calculations use the predicted position. This distinction is
important:

* **VISUAL TARGET** → shows who is locked
* **PREDICTED TARGET POSITION** → determines where Preplace/Replace should act

### 7. TARGET UPDATE PERFORMANCE

Do not perform an expensive full enemy scan every frame. Use an efficient target
update system. Cache:

* current ActiveTarget
* target distance
* target position
* target velocity
* target validity

Only recalculate the full target selection when necessary. However, if the
ActiveTarget becomes invalid or another enemy clearly becomes the closer valid
target, switch immediately.

### 8. PREPLACE TARGET LOCK

Preplace must NEVER place based on another enemy while ActiveTarget exists.
Every Preplace calculation must reference `ActiveTarget` and its:

* current position
* predicted position
* velocity
* direction
* distance
* movement state

If ActiveTarget changes, invalidate stale Preplace candidates immediately.

### 9. REPLACE TARGET LOCK

Replace must use the exact same ActiveTarget. Do NOT allow Replace to
independently acquire another target. Replace should calculate:

```
ActiveTarget → predicted position → replacement opportunity
             → best replacement position → best angle
             → validation → execution
```

If ActiveTarget changes, invalidate the old Replace decision.

### 10. AIM CIRCLE MUST FOLLOW THE ACTIVE TARGET

The visual circle should continuously follow the ActiveTarget. It should not:

* remain at the old position
* lag significantly behind the target
* jump between enemies unnecessarily
* display multiple targets

There must be exactly ONE active aim target.

### 11. IMPORTANT BEHAVIOR

```
Enemy A is closest
  → Aim Circle locks Enemy A
  → Preplace calculates only for Enemy A
  → Replace calculates only for Enemy A

Enemy B becomes significantly closer
  → switch lock to Enemy B
  → immediately invalidate Enemy A's stale Preplace/Replace calculations
  → calculate only for Enemy B

Enemy B remains closest
  → keep lock
  → continuously predict Enemy B
  → continuously optimize Preplace/Replace around Enemy B
```

This must be smooth and stable.

### 12. NO MULTI-TARGET LOGIC

Do NOT create:

* multiple simultaneous ActiveTargets
* multiple aim circles
* separate Preplace targets
* separate Replace targets
* competing target selectors

There must be one centralized `ActiveTarget` used by both Preplace and Replace.

### 13. FINAL VALIDATION

Verify:

* Only the closest valid enemy is selected.
* Preplace uses only ActiveTarget.
* Replace uses only ActiveTarget.
* Aim Circle displays only ActiveTarget.
* Target switching is stable.
* Prediction follows the locked target.
* Ping compensation follows the locked target.
* Stale calculations are invalidated after target switching.
* No unnecessary target scanning occurs.
* No unrelated RYN systems are modified.

---

## 14. TRAP ENCLOSURE + SMART SPIKE GAP FILL

Add a specialized Trap Enclosure Gap-Fill layer that works with the existing
Preplace + Replace target-lock system.

**IMPORTANT:** This is NOT a rebuild of Spike Tick. Do NOT modify the existing
Spike Tick system. This feature is only responsible for intelligently placing a
spike when the ActiveTarget is trapped or partially enclosed and there is a
valid nearby opening/gap.

### 14.1 DETECT TRAP ENCLOSURE

When the `ActiveTarget` is inside or strongly constrained by:

* My traps
* Enemy traps
* A combination of nearby obstacles/traps

analyze the local geometry around the target. Determine:

* Which directions are blocked.
* Which directions are open.
* Which gaps are reachable by the player.
* Which nearby placement positions are valid.
* Whether placing a spike would meaningfully reduce the enemy's available
  movement.

Do not assume that every trap near the enemy means they are trapped. Use actual
collision/range/geometry definitions from the Game Files.

### 14.2 SMART GAP DETECTION

When the target is enclosed or partially enclosed, search for the closest useful
gap. Priority:

1. Valid spike placement.
2. Closest possible placement point to the ActiveTarget.
3. Gap that meaningfully restricts enemy movement.
4. Placement within the player's valid range.
5. Collision-safe placement.
6. Best angle/orientation.

The system must NOT simply place a spike at an arbitrary nearby coordinate.

### 14.3 CLOSEST VALID SPIKE POSITION

The spike should be placed at the nearest valid point that satisfies: spike
placement range, collision rules, existing object restrictions, enemy collision
geometry, player accessibility, valid angle, no duplicate/overlapping placement.

```
ActiveTarget
   ↓ Find nearby gaps
   ↓ Generate spike candidates
   ↓ Reject invalid candidates
   ↓ Score remaining candidates
   ↓ Select closest useful spike
   ↓ Place immediately
```

### 14.4 BREAKING TRAP SITUATION

If the ActiveTarget is trapped inside my trap structure and I need to
break/remove a trap to create the correct opening, the system must understand
the local trap layout before deciding where to place the spike. It must
determine:

* Which trap is blocking the optimal path.
* Whether breaking/removing that trap creates a better spike opportunity.
* Whether the target is likely to move through the resulting opening.
* Where the spike should be prepared after the opening is created.

Do NOT blindly break traps. Only perform the action when it improves the
tactical position.

### 14.5 MY TRAP VS ENEMY TRAP

The logic must distinguish between **my trap** (owned by the local player) and
**enemy trap** (owned by another player). The engine must use the existing
ownership/entity definitions from the Game Files. Do not guess ownership from
appearance or coordinates.

### 14.6 PREDICT THE ESCAPE ROUTE

Do not only look at the target's current position. Calculate likely escape
directions using: current velocity, recent movement direction, predicted
position, available gaps, nearby traps, nearby obstacles, player position.

Then prioritize a spike that blocks the most likely escape route.

```
TRAP ───── TRAP
│               │
│    TARGET     │
│               │
TRAP ── GAP ─ TRAP
```

If the target is moving toward the gap → prioritize the closest valid spike
candidate around that gap.

### 14.7 TARGET LOCK INTEGRATION

This feature MUST use the same `ActiveTarget` from the existing Target Lock
system. There must NOT be a second target selector.

```
Closest Valid Enemy → ActiveTarget → Prediction
  → Trap Enclosure Detection → Gap Detection
  → Spike Candidate Generation → Best Spike
  → Final Validation → Execution
```

If ActiveTarget changes: immediately invalidate old gap calculations and
recalculate around the new target.

### 14.8 PREPLACE INTEGRATION

If a valid spike gap is detected, Preplace should be able to prepare the spike
position before the enemy reaches the gap. Use current target position,
predicted target position, target velocity, ping-adjusted timing.

The goal: prepare the spike where the enemy is going, not where they were.

### 14.9 REPLACE INTEGRATION

If the optimal gap requires replacing an existing placement, Replace should
evaluate whether the replacement creates a better enclosure. Do NOT replace
simply because another position exists. Only replace when
`new_position_score > current_position_score` by a meaningful threshold.

### 14.10 SPIKE PRIORITY

When an enemy is genuinely enclosed and a useful gap exists, the gap-filling
spike should receive high tactical priority. However:

* Do NOT override Spike Tick.
* Do NOT interfere with an active Spike Tick execution.
* Do NOT create duplicate spike packets.
* Do NOT create a second spike-placement scheduler.
* Use the existing placement execution architecture.

### 14.11 ANTI-DUPLICATE LOGIC

Before placing, check: is there already a spike at the candidate location? Is
another spike already being placed there? Did Preplace already reserve this
position? Did Spike Tick already reserve this position? Is the candidate
effectively overlapping an existing object?

If yes → reject candidate and select the next-best candidate.

### 14.12 FAST LOCAL SEARCH

Do NOT scan the entire map. When the target becomes enclosed, search only a
local region around: ActiveTarget, PredictedTargetPosition, nearby traps, nearby
obstacles, player position.

Use a small set of high-quality candidate points first. Only expand the search if
no valid candidate is found. This is important for maintaining high speed.

### 14.13 SMART CANDIDATE SCORING

Score spike candidates using: distance to target, distance from player,
escape-route blocking, target movement direction, predicted target position,
enclosure improvement, placement validity, collision safety, ping/timing
suitability, existing object density.

The closest candidate should generally win, BUT a slightly farther spike that
completely blocks the predicted escape route should beat a closer useless spike.

### 14.14 LAST-MOMENT VALIDATION

Immediately before execution, recheck: ActiveTarget, target validity, target
position, predicted position, trap layout, gap availability, candidate
collision, placement range, existing spike/object, Spike Tick reservation,
current packet/placement state.

If anything changed → reject stale candidate and select the next valid
candidate. Do NOT restart the entire system unnecessarily.

### 14.15 FINAL BEHAVIOR

```
Enemy gets trapped
  ↓ ActiveTarget remains locked
  ↓ Analyze surrounding traps
  ↓ Detect available gaps
  ↓ Predict enemy escape direction
  ↓ Find closest useful spike position
  ↓ Preplace spike toward that position
  ↓ Synchronize timing with ping
  ↓ When valid, execute
  ↓ Enemy's escape route becomes blocked
```

If the enemy changes direction → immediately update prediction and candidate
priority. If the enemy escapes the enclosure → disable this special gap-fill
mode and return control to normal Preplace/Replace.

### 14.16 IMPORTANT RESTRICTIONS

Do NOT: rebuild Spike Tick, create another target selector, create another
packet scheduler, create another placement engine, spam spikes, place spikes
randomly around the target, scan the entire map continuously, modify unrelated
systems, override existing Spike Tick decisions.

This must be a lightweight tactical layer integrated into the existing
Preplace + Replace architecture.

---

# PHASE 3 — ENGINEERING RULES

These are not style preferences. Each one corresponds to a real defect that has
already happened on this task.

## 3.1 Never call a method you have not seen defined

Before writing `x.foo()`, grep for `foo(` in the target client and confirm the
signature. `node --check` passes a call to a method that does not exist; it will
throw at runtime, in combat, silently killing the module.

> Real case: `book.clear()` was written from imagination. The class only had
> `invalidateAll(reason, engine)` — which also returns the ledger tokens the
> bookings were holding, so the invented call would have leaked them too.

## 3.2 Check call ordering before reading a field off a shared object

If you read `frame.motion`, prove that whatever sets `frame.motion` runs
*before* your code, on **every** path that reaches you.

> Real case: `sense()` runs before `predict()`, and a second entry point
> re-senses without predicting at all, so a field read there was always
> undefined and the escape direction silently fell back to a default.

## 3.3 A fallback must never be "anywhere near the target"

Every search pass must stay anchored to a real, validated opening. If no
candidate qualifies, place **nothing**. A widening pass that degrades into "any
angle near the enemy" is exactly the spike-spam §14.16 forbids.

> Real case: a `[null, wideCone]` fallback pass let a candidate on the opposite
> side of the enemy win, because with no exit to compare against every angle
> scored equally.

## 3.4 Tie-break scores must be tactical, not incidental

If several candidates tie on the primary score, the tie-break must mean
something. Distance alone is not a tie-break when everything is on a ring at
equal distance.

> Real case: three traps at exactly 90 units all "qualified" and the winner was
> whichever the loop hit first. Fixed by scoring on alignment with the target's
> escape heading, with distance only breaking ties.

## 3.5 Test against the built artifact, not a copy of the logic

Slice the classes under test out of the **output file** and run them against
stand-ins for the game objects, together with the client's own geometry and
prediction helpers. A test that re-implements the logic tests nothing.

## 3.6 An assertion that passes on an empty array proves nothing

`[].every(...)` is `true`. Check the length first, then the property.

> Real case: "enemy traps are not mine" passed while the array was empty. The
> real behaviour — enemy traps being excluded from the box entirely — was
> invisible until the length was asserted.

## 3.7 Anchor every edit to an exact string, and fail loudly

If the build patches a source file, route every edit through a helper that
throws when the anchor is missing **or ambiguous**. Duplicated code is common in
these clients; a "unique" anchor often is not.

## 3.8 Do not modify unrelated systems

Some modules legitimately keep their own target (movement, self-defence). Locking
them is scope creep. Identify them, state why they are excluded, and add a test
that pins the exclusion.

## 3.9 Report what you did not do

If a requirement cannot be met without violating another requirement, implement
everything up to that line, say exactly where you stopped and why, and let the
user decide. Do not silently narrow scope, and do not silently exceed it.

---

# PHASE 4 — DELIVERABLES AND VERIFICATION

1. Keep the original client as an unmodified input. Apply changes through an
   anchored build script producing a separate output file.
2. Write a behaviour test suite that slices the new code out of the built output.
   Cover at minimum:
   - closest-valid selection, including a list deliberately out of order
   - the switch margin (prove A→B→A cannot happen)
   - validity: dead, gone, teammate
   - prediction and the ping-derived lead, including the cap
   - the per-tick scan budget (prove repeat calls inside one tick do nothing)
   - enclosure detection: open field, two objects, a real box
   - ownership: my traps, their traps, their spikes
   - the sealed-box → identify blocker → place once it clears cycle
   - anti-duplicate and the Spike Tick stand-downs
   - every menu input resolves to a real setting
3. Run and paste the real output of:
   ```sh
   node <build>.js
   node --check <output>.user.js
   node <test>.js
   ```
4. Report a before/after table and an explicit list of what you did **not**
   implement and why.

---

# WHAT ALREADY EXISTS (if continuing prior work)

Repo `Mvhdi00/rynv2-op`, branch `claude/single-target-aim-lock-wza9da`:

- `tools/build-reup.js` → `ReUp_Mix.user.js` (RYN v4 base, 33 anchors)
- `tools/build-ryn-type2.js` → `Ryn_Type_2_TargetLock.user.js` (RYN Type 2 v5.4, 23 anchors)
- `tools/test-target-lock.js` (67 tests) and `tools/test-ryn-type2.js` (68 tests)

Both builds already have the target lock and an enclosure layer. Known gap: the
five reference clients listed in Phase 0 were **never read**. Start there — the
point of this revision is to find out what prior art was missed.
