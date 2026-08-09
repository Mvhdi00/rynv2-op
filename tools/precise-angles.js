/*
 * precise-angles.js
 *
 * The precise-angle system, as source strings shared by the client builds.
 *
 * Nothing in the protocol quantises a direction. The move packet ("9") carries
 * raw radians that the server feeds straight into cos(moveDir) / sin(moveDir)
 * (src/game_index.js, Player.update), and a placement angle is the same kind of
 * float. What limits a client is its own input and its own search grid: the key
 * vector gives 8 absolute directions and nothing between them, and the angle
 * sweeps were written around literal step counts.
 *
 * Both clients in src/ carry the same InputHandler and the same
 * getAngleFromBitmask, so the movement half is character-for-character the same
 * patch. It lives here rather than in either build script so the two cannot
 * drift apart. What differs between them — the placer, the menu markup, which
 * sweeps exist — stays in the build script that knows about it.
 */

/* One circle, N steps, shared by movement and placement. Both fall back to the
 * pre-patch resolutions when precise angles are off, so the toggle is a true
 * bypass rather than a different setting. */
function angleGrid({ moveSteps = 624 } = {}) {
  return `  const AngleGrid = {
    /* 624 rather than 628: it is the largest multiple of 8 at or under the 628
     * directions the game's own fixTo(angle, 2) can express, and a multiple of
     * 8 keeps the eight key directions exactly on the grid at every setting. */
    _steps(value, fallback) {
      const steps = Math.round(Number(value));
      return Number.isFinite(steps) && steps >= 4 ? steps : fallback;
    },
    get moveSteps() {
      return Settings_default._preciseAngles ? this._steps(Settings_default._moveAngleSteps, ${moveSteps}) : 8;
    },
    /* Each sweep was written with its own step count — 36 here, 72 there — so
     * switching precise angles off puts every one of them back to the exact
     * number it had rather than to some shared stand-in. */
    buildStepsOr(original) {
      return Settings_default._preciseAngles ? this._steps(Settings_default._buildAngleSteps, 624) : original;
    },
    step(steps) {
      return Math.PI * 2 / steps;
    },
    /* Step index of an angle, wrapped into [0, steps) so negative radians and
     * angles past a full turn land on the same step as their equivalents. */
    index(angle, steps) {
      const step = this.step(steps);
      return (Math.round(angle / step) % steps + steps) % steps;
    },
    fromIndex(index, steps) {
      return index * this.step(steps);
    },
    snap(angle, steps) {
      if (angle === null || angle === undefined || !Number.isFinite(angle)) return angle;
      return this.fromIndex(this.index(angle, steps), steps);
    }
  };
`;
}

/* `nudgeKeys` adds the J/L rotate keys and the mouse-movement hotkey. v4 keeps
 * them; v5 was asked for the menu options without any new keybinds, and there
 * the mouse is the only way onto the fine grid. */
function settings({ nudgeKeys = true, moveSteps = 624 } = {}) {
  return `    _preciseAngles: true,
    _moveAngleSteps: ${moveSteps},
    _buildAngleSteps: 624,
    _mouseMovement: false,` + (nudgeKeys ? `
    _mouseMovementKey: "",
    _angleLeft: "KeyJ",
    _angleRight: "KeyL",` : "");
}

function inputState({ nudgeKeys = true } = {}) {
  return (nudgeKeys ? `    moveNudge=0;
` : "") + `    _lastSteerTime=0;
    _steerTimer=null;`;
}

/* `botFanout` is the block a client runs after its own movement send to mirror
 * it onto spectated bots; only one of the two clients has one. */
function movement(botFanout = "", { nudgeKeys = true, wire = null } = {}) {
  const nudgeTerm = nudgeKeys ? " + this.moveNudge * AngleGrid.step(steps)" : "";
  const nudgeReset = nudgeKeys ? `
      if (this.move === 0) {
        this.moveNudge = 0;
      }` : "";
  const angleKeys = nudgeKeys ? `
    /* One grid step per press, auto-repeat included, so holding the key sweeps
     * the circle. The offset is cleared as soon as the player stops moving, in
     * handleMovement, rather than persisting into the next run. */
    handleAngleKeys(event) {
      if (!Settings_default._preciseAngles || isActiveInput() || UI_default.isMenuOpened) return false;
      if (!this.client.myPlayer.inGame) return false;
      const code = event.code;
      if (code !== "" && code === Settings_default._mouseMovementKey) {
        if (event.repeat) return true;
        Settings_default._mouseMovement = !Settings_default._mouseMovement;
        SaveSettings();
        try {
          const doc = UI_default.frame && UI_default.frame.document;
          const box = doc && doc.getElementById("_mouseMovement");
          if (box) box.checked = Settings_default._mouseMovement;
        } catch (e) {}
        if (this.move !== 0) this.steerMovement();
        return true;
      }
      let delta = 0;
      if (code !== "" && code === Settings_default._angleLeft) {
        delta = -1;
      } else if (code !== "" && code === Settings_default._angleRight) {
        delta = 1;
      } else {
        return false;
      }
      /* About 2.5 degrees per press whatever the grid is, so a finer grid does
       * not make the keys slower to turn with. The mouse still reaches every
       * step; the keys are the coarse control. */
      const steps = AngleGrid.moveSteps;
      const perPress = Math.max(1, Math.round(steps / 144));
      this.moveNudge = (this.moveNudge + delta * perPress) % steps;
      if (this.move !== 0) this.steerMovement();
      return true;
    }` : "";

  /* A client that rounds its attack/place angle for the wire should round the
   * movement angle the same way: it is the resolution the game itself works in,
   * and it keeps the two paths emitting the same shape of value. */
  const open = wire ? wire + "(" : "";
  const close = wire ? ")" : "";
  return `    /* The direction the keys are asking for. Vanilla reads the key vector as
     * an absolute screen direction, which is 8 angles and nothing between. With
     * mouse movement on it is read relative to the cursor instead — W is
     * "toward the cursor", A and D strafe, S backs off — so aiming reaches
     * every step on the grid. */
    getMoveAngle() {
      const base = getAngleFromBitmask(this.move, false);
      if (base === null || !Settings_default._preciseAngles) {
        return base;
      }
      const steps = AngleGrid.moveSteps;
      const relative = Settings_default._mouseMovement ? this.mouse.angle + base + Math.PI / 2 : base;
      return ${open}AngleGrid.snap(relative${nudgeTerm}, steps)${close};
    }
    handleMovement() {${nudgeReset}
      const {isOwner: isOwner, clients: clients, _ModuleHandler: ModuleHandler} = this.client;
      const angle = this.getMoveAngle();
      ModuleHandler.startMovement(angle);${botFanout}
    }
    /* Moving the mouse produces a continuous stream of direction changes, which
     * is the one thing that could spend the packet budget faster than the game
     * does, so it goes through a gate.
     *
     * Only the packet is held back — the angle itself keeps updating at full
     * rate, so a finer grid never turns more slowly, it just sends the step it
     * reached. The trailing send is what makes that safe: a change that arrives
     * inside the window is not dropped, it is delivered when the window closes,
     * so the direction settled on is always the one the server ends up with. */
    steerMovement() {
      if (this._steerTimer !== null) {
        return;
      }
      const wait = 60 - (performance.now() - this._lastSteerTime);
      if (wait > 0) {
        this._steerTimer = setTimeout(() => {
          this._steerTimer = null;
          this.steerMovement();
        }, wait);
        return;
      }
      const {_ModuleHandler: ModuleHandler} = this.client;
      if (!this.client.myPlayer.inGame || this.move === 0) return;
      const angle = this.getMoveAngle();
      if (angle === null || ModuleHandler.moveTo !== "disable") return;
      if (ModuleHandler.move_dir === angle) return;
      if (ModuleHandler.packetCount + 10 > ModuleHandler.packetLimit) return;
      this._lastSteerTime = performance.now();
      this.handleMovement();
    }${angleKeys}`;
}

/* Ahead of the repeat guard, because a held nudge key is meant to keep turning. */
const KEYDOWN_HOOK_FIND = `      if (event.ctrlKey && [ "KeyD", "KeyS", "KeyW" ].includes(event.code)) {
        event.preventDefault();
      }
      if (event.repeat) {
        return;
      }`;

const KEYDOWN_HOOK_REPLACE = `      if (event.ctrlKey && [ "KeyD", "KeyS", "KeyW" ].includes(event.code)) {
        event.preventDefault();
      }
      /* Ahead of the repeat guard: a held nudge key is meant to keep turning. */
      if (this.handleAngleKeys(event)) {
        return;
      }
      if (event.repeat) {
        return;
      }`;

const MOUSEMOVE_HOOK_FIND = `      this.mouse.angle = angle;
      if (this.rotation) {`;

const MOUSEMOVE_HOOK_REPLACE = `      this.mouse.angle = angle;
      if (this.move !== 0 && Settings_default._preciseAngles && Settings_default._mouseMovement) {
        this.steerMovement();
      }
      if (this.rotation) {`;

/* The placeable/blocked map for one sweep, from a single grid query.
 *
 * Every candidate sits on a circle of radius `length` around an anchor, so an
 * object at distance `d` blocks one contiguous arc of that circle: the angles
 * within acos((d² + length² - reach²) / (2·d·length)) of the object's own
 * bearing, where `reach` is the two scales added. That is the same law
 * ObjectManager.getBestPlacementAngles already solves for its tangents — it is
 * just applied to the whole circle at once here.
 *
 * Sampling instead costs a spatial-grid query per angle, which is what made a
 * fine grid unaffordable. This makes the cost scale with the objects around the
 * anchor rather than with the resolution.
 *
 * The answer is the sampling answer, angle for angle, including the strict
 * comparison at the boundary and the river rule; tools/check-angles.js holds it
 * to that against the original.
 */
const PLACEABLE_MASK = `  function _getPlaceableMask(id, anchor, ObjectManager2, excludeObj, steps, addRadius = 0, search = 4) {
    const item = Items[id];
    const length = 35 + item.scale + (item.placeOffset || 0);
    const mask = new Uint8Array(steps);
    const arcs = [];
    let blocksEverything = false;
    /* One query around the anchor. Its radius covers the placement circle plus
     * the furthest an object can reach onto it, so it is a superset of what the
     * per-angle queries saw. */
    ObjectManager2.grid2D.query(anchor.x, anchor.y, search, objId => {
      const obj = ObjectManager2.objects.get(objId);
      if (!obj) return;
      if (excludeObj && obj === excludeObj) return;
      const dx = obj.pos.current.x - anchor.x;
      const dy = obj.pos.current.y - anchor.y;
      const distance = Math.hypot(dx, dy);
      const reach = item.scale + obj.placementScale + addRadius;
      if (distance >= length + reach) return;
      if (distance < reach - length) {
        blocksEverything = true;
        return;
      }
      const cosArg = (distance * distance + length * length - reach * reach) / (2 * distance * length);
      /* also catches the NaN a zero distance produces */
      if (!(cosArg < 1)) return;
      arcs.push(Math.atan2(dy, dx), cosArg <= -1 ? Math.PI : Math.acos(cosArg));
    });
    if (blocksEverything) return mask;
    mask.fill(1);
    const step = Math.PI * 2 / steps;
    for (let a = 0; a < arcs.length; a += 2) {
      const from = arcs[a] - arcs[a + 1];
      const to = arcs[a] + arcs[a + 1];
      /* strictly inside the arc, matching the strict distance test */
      for (let k = Math.floor(from / step) + 1; k * step < to; k++) {
        if (k * step <= from) continue;
        mask[(k % steps + steps) % steps] = 0;
      }
    }
    if (id !== 18) {
      const mid = Config_default.mapScale / 2;
      const riverHalf = Config_default.riverWidth / 2;
      for (let i = 0; i < steps; i++) {
        if (!mask[i]) continue;
        const y = anchor.y + length * Math.sin(i * step);
        if (y >= mid - riverHalf && y <= mid + riverHalf) mask[i] = 0;
      }
    }
    return mask;
  }
`;

/* Menu copy, so both clients describe the feature the same way. */
const COPY = {
  master: "Off is the old behaviour: 8 movement directions and the original placement sweeps.",
  move:
    "Directions the circle is cut into for movement. 624 is the ceiling the game itself can express, " +
    "since it rounds every angle to 0.01 rad. Costs nothing at any setting.",
  build:
    "Angles the client sweeps around a target when it is looking for somewhere to build. " +
    "The sweep is solved, not sampled, so a finer setting is free.",
  mouse:
    "Reads the movement keys relative to the cursor: W goes toward it, A and D strafe, S backs off. " +
    "Aiming then reaches every angle on the grid."
};

module.exports = {
  angleGrid,
  settings,
  inputState,
  movement,
  KEYDOWN_HOOK_FIND,
  KEYDOWN_HOOK_REPLACE,
  MOUSEMOVE_HOOK_FIND,
  MOUSEMOVE_HOOK_REPLACE,
  PLACEABLE_MASK,
  COPY
};
