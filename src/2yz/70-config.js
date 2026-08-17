/* ===========================================================================
 * 2yz / Config
 * ---------------------------------------------------------------------------
 * One schema. The menu is generated from it and the code reads through it, so a
 * setting that exists is a setting that does something -- there is no second
 * list to drift out of sync, and a control with no reader cannot be built
 * because the control IS the reader's storage.
 *
 * tools/verify-2yz.js walks this schema and greps the module sources for a
 * matching Config.get / Config.section call. A key with no reader fails the
 * build. That is the mechanical version of "no fake settings".
 *
 * Every leaf carries: label, description, type, default, and for numbers a
 * range. Defaults are the values the analysis settled on, and where a figure
 * comes from a game table it is derived rather than typed.
 * =========================================================================== */

const Config = (function () {
    const STORAGE_KEY = '2yz.config.v1';

    /* --- schema --------------------------------------------------------- */

    const schema = {
        combat: {
            _label: 'Combat',
            _desc: 'Target selection, weapon choice and swing timing.',
            enabled: {
                label: 'Enable Combat', type: 'bool', def: true,
                desc: 'Master switch for automatic attacking. Off leaves aiming and swinging entirely to you.'
            },
            targetRadius: {
                label: 'Target Radius', type: 'number', def: 400, min: 100, max: 1000, step: 10,
                desc: 'How far out to consider enemies. Beyond this they are ignored by every module, not just Combat.'
            },
            weightDistance: {
                label: 'Priority: Proximity', type: 'number', def: 1.0, min: 0, max: 3, step: 0.1,
                desc: 'How much closeness counts when ranking targets.'
            },
            weightThreat: {
                label: 'Priority: Threat', type: 'number', def: 1.4, min: 0, max: 3, step: 0.1,
                desc: 'How much a target\'s ability to hurt you counts. Raise to prefer whoever is winding up on you.'
            },
            weightVulnerable: {
                label: 'Priority: Vulnerability', type: 'number', def: 1.2, min: 0, max: 3, step: 0.1,
                desc: 'How much being trapped, low or exposed counts. Raise to finish wounded targets.'
            },
            switchMargin: {
                label: 'Switch Margin', type: 'number', def: 0.25, min: 0, max: 1, step: 0.05,
                desc: 'A new target must score this much better before Combat drops the current one. Higher is stickier.'
            },
            switchMinTicks: {
                label: 'Switch Cooldown', type: 'number', def: 3, min: 0, max: 20, step: 1,
                desc: 'Ticks to hold a target before any switch is allowed. Stops flip-flopping between two equals.'
            },
            burstEnabled: {
                label: 'Burst Sequences', type: 'bool', def: true,
                desc: 'Chain both weapon slots across consecutive ticks when both are off cooldown.'
            },
            minBurstDamage: {
                label: 'Minimum Burst Damage', type: 'number', def: 60, min: 0, max: 200, step: 5,
                desc: 'Do not spend both cooldowns for less than this, unless the target is trapped and cannot escape.'
            },
            longReachRange: {
                label: 'Long-Reach Threshold', type: 'number', def: 115, min: 60, max: 160, step: 1,
                desc: 'A primary with more reach than this swings second in a burst, after a knockback secondary. At the default this is the katana and the polearm.'
            },
            leadTarget: {
                label: 'Lead Moving Targets', type: 'bool', def: true,
                desc: 'Aim at where the target will be when the packet lands rather than where it is now.'
            },
            urgencyBurst: {
                label: 'Urgency: Burst', type: 'number', def: 70, min: 0, max: 100, step: 1,
                desc: 'How strongly a burst competes against placement and defence for the tick.'
            },
            urgencySwing: {
                label: 'Urgency: Single Swing', type: 'number', def: 55, min: 0, max: 100, step: 1,
                desc: 'How strongly one swing competes for the tick.'
            },

            autoBreak: {
                _label: 'Auto Break',
                _desc: 'Swing at structures: escape traps, clear the line to the target, remove hazards.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Break structures automatically. Without this, Anti Smart Tick guards an escape the client never attempts.' },
                clearLine: { label: 'Clear Blocked Line', type: 'bool', def: true, desc: 'Break an enemy structure standing between you and the target.' },
                clearHazards: { label: 'Clear Hazards', type: 'bool', def: true, desc: 'Break an enemy spike close enough to hurt you where you stand.' },
                hazardMargin: {
                    label: 'Hazard Margin', type: 'number', def: 25, min: 0, max: 120, step: 5,
                    desc: 'Extra distance past contact at which an enemy spike still counts as worth removing.'
                },
                fastPrimarySpeed: {
                    label: 'Fast Primary Threshold', type: 'number', def: 400, min: 100, max: 800, step: 50,
                    desc: 'Milliseconds. A primary quicker than this is preferred over the hammer when it can break the structure in one hit, because it recovers sooner.'
                },
                urgencyEscape: { label: 'Urgency: Escape Trap', type: 'number', def: 80, min: 0, max: 100, step: 1, desc: 'Very high: nothing else matters while you cannot move.' },
                urgencyClear: { label: 'Urgency: Clear Line', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'How strongly clearing a blocked swing competes for the tick.' },
                urgencyHazard: { label: 'Urgency: Clear Hazard', type: 'number', def: 40, min: 0, max: 100, step: 1, desc: 'How strongly removing a nearby enemy spike competes for the tick.' }
            }
        },

        placement: {
            _label: 'Placement',
            _desc: 'Where structures go, and which module gets to put one there.',
            angleSteps: {
                label: 'Sweep Resolution', type: 'number', def: 72, min: 24, max: 144, step: 12,
                desc: 'Positions tested around you per sweep. Higher finds tighter gaps and costs more CPU.'
            },
            lookaheadTicks: {
                label: 'Path Lookahead', type: 'number', def: 2, min: 1, max: 6, step: 1,
                desc: 'How far ahead your own movement is projected when checking a structure would not wall you in.'
            },
            losPadding: {
                label: 'Line-of-Sight Padding', type: 'number', def: 5, min: 0, max: 30, step: 1,
                desc: 'Extra margin around a structure when testing whether it blocks your own swing.'
            },
            escapeSamples: {
                label: 'Escape Samples', type: 'number', def: 16, min: 8, max: 48, step: 4,
                desc: 'Directions sampled around a target when measuring how many exits it still has.'
            },
            escapeTicks: {
                label: 'Escape Horizon', type: 'number', def: 3, min: 1, max: 8, step: 1,
                desc: 'How far a target is assumed to be able to run when measuring its exits.'
            },
            pushbackGuard: {
                label: 'Pushback Guard', type: 'number', def: 0.6283, min: 0, max: 1.57, step: 0.05,
                desc: 'Radians. A spike whose knockback would push the target toward you within this angle is penalised.'
            },
            maxIntentAgeTicks: {
                label: 'Placement Intent Lifetime', type: 'number', def: 2, min: 1, max: 10, step: 1,
                desc: 'Ticks a queued placement stays valid before it is discarded as stale.'
            },

            weights: {
                _label: 'Scoring Weights',
                _desc: 'How the placement engine ranks one position against another. These apply to every placing module.',
                intercept: {
                    label: 'Intercepts Target', type: 'number', def: 40, min: 0, max: 100, step: 1,
                    desc: 'Reward for a position the target will actually walk into.'
                },
                proximity: {
                    label: 'Proximity', type: 'number', def: 15, min: 0, max: 100, step: 1,
                    desc: 'Reward for being close to the target, scaled so touching is full marks.'
                },
                boundary: {
                    label: 'Flush Against Structure', type: 'number', def: 12, min: 0, max: 100, step: 1,
                    desc: 'Reward for a position that sits flush against something already there, sealing the gap.'
                },
                knockbackChain: {
                    label: 'Knockback Chain', type: 'number', def: 35, min: 0, max: 100, step: 1,
                    desc: 'Reward for a spike whose hit throws the target onto another of your spikes.'
                },
                escapeClosure: {
                    label: 'Closes Escape', type: 'number', def: 30, min: 0, max: 100, step: 1,
                    desc: 'Reward proportional to how many of the target\'s exits this position removes.'
                },
                enclosure: {
                    label: 'Full Enclosure', type: 'number', def: 45, min: 0, max: 100, step: 1,
                    desc: 'Bonus for a position that takes the target\'s last exit.'
                },
                losPenalty: {
                    label: 'Blocks Your Swing', type: 'number', def: 30, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a structure that would come between you and the target.'
                },
                pathPenalty: {
                    label: 'Blocks Your Path', type: 'number', def: 20, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a structure across the direction you are moving.'
                },
                pushbackPenalty: {
                    label: 'Pushes Target At You', type: 'number', def: 25, min: 0, max: 100, step: 1,
                    desc: 'Penalty for a spike whose knockback hands the target a free approach.'
                },
                utilityBehind: {
                    label: 'Utility Trails Behind', type: 'number', def: 20, min: 0, max: 100, step: 1,
                    desc: 'Reward for putting mills and other utility structures behind your direction of travel.'
                }
            },

            autoPlace: {
                _label: 'Auto Place',
                _desc: 'Reactive spikes and traps around a target you are already fighting.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Place spikes and traps against the current target.' },
                spikes: { label: 'Place Spikes', type: 'bool', def: true, desc: 'Allow spike placement.' },
                traps: { label: 'Place Traps', type: 'bool', def: true, desc: 'Allow trap placement when neither of you is already held.' },
                range: {
                    label: 'Range', type: 'number', def: 350, min: 50, max: 600, step: 10,
                    desc: 'Stop placing when the target is further away than this.'
                },
                minScore: {
                    label: 'Minimum Score', type: 'number', def: 25, min: 0, max: 100, step: 1,
                    desc: 'Reject any position that does not reach this score. Raise to place only when it clearly helps.'
                },
                minConfidence: {
                    label: 'Minimum Prediction Confidence', type: 'number', def: 0.35, min: 0, max: 1, step: 0.05,
                    desc: 'Skip the tick when the target\'s movement is too erratic to place against.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 50, min: 0, max: 100, step: 1, desc: 'How strongly ordinary placements compete for the tick.' },
                urgencyEnclose: { label: 'Urgency: Enclosure', type: 'number', def: 65, min: 0, max: 100, step: 1, desc: 'Raised urgency for a placement that takes the target\'s last exit.' }
            },

            preplace: {
                _label: 'Preplace',
                _desc: 'Structures built for where the target is going, released so they land on the predicted tick.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Arm placements against predicted movement.' },
                useTrap: { label: 'Prefer Trap', type: 'bool', def: true, desc: 'Lead with a trap when the target is not already held; otherwise lead with a spike.' },
                range: { label: 'Range', type: 'number', def: 300, min: 50, max: 600, step: 10, desc: 'Stop preplacing beyond this distance.' },
                horizonTicks: {
                    label: 'Prediction Horizon', type: 'number', def: 2, min: 1, max: 6, step: 1,
                    desc: 'How many ticks ahead the interception point is computed. Higher leads further and is easier to dodge.'
                },
                minConfidence: {
                    label: 'Minimum Confidence', type: 'number', def: 0.6, min: 0, max: 1, step: 0.05,
                    desc: 'The strictest confidence gate in the client. A preplace built on a bad prediction is a wasted item.'
                },
                minSpeed: {
                    label: 'Minimum Target Speed', type: 'number', def: 2, min: 0, max: 20, step: 0.5,
                    desc: 'Do not lead a target that is standing still -- Auto Place covers that case.'
                },
                minScore: { label: 'Minimum Score', type: 'number', def: 30, min: 0, max: 100, step: 1, desc: 'Reject interception points below this score.' },
                driftTolerance: {
                    label: 'Drift Tolerance', type: 'number', def: 45, min: 5, max: 200, step: 5,
                    desc: 'Cancel an armed placement once the target has strayed this far from where it was predicted to be.'
                },
                maxAgeTicks: { label: 'Armed Lifetime', type: 'number', def: 4, min: 1, max: 12, step: 1, desc: 'Ticks an armed placement survives before it is dropped unfired.' },
                releaseBias: {
                    label: 'Release Bias', type: 'number', def: 10, min: -50, max: 50, step: 1,
                    desc: 'Milliseconds to fire early. Early still lands; late does not.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 60, min: 0, max: 100, step: 1, desc: 'How strongly a preplace competes for the tick.' }
            },

            replace: {
                _label: 'Replace',
                _desc: 'Rebuild a structure into the gap left by one that is about to break.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Watch for structures about to be destroyed and fill the gap as it opens.' },
                range: { label: 'Range', type: 'number', def: 300, min: 50, max: 600, step: 10, desc: 'Only replace structures within this distance of you.' },
                relevanceRange: {
                    label: 'Relevance Range', type: 'number', def: 250, min: 50, max: 600, step: 10,
                    desc: 'A structure this far from the target is not part of the fight and is not worth replacing.'
                },
                improvementMargin: {
                    label: 'Improvement Margin', type: 'number', def: 5, min: 0, max: 50, step: 1,
                    desc: 'The replacement must score this much better than what it replaces. Stops swapping a good spike for a worse one.'
                },
                replaceOutOfCombat: { label: 'Replace Out Of Combat', type: 'bool', def: false, desc: 'Also replace structures when there is no target. Off saves resources.' },
                maxPerTick: { label: 'Max Per Tick', type: 'number', def: 1, min: 1, max: 4, step: 1, desc: 'How many replacements may be offered in one tick.' },
                graceTicks: { label: 'Prediction Grace', type: 'number', def: 3, min: 1, max: 10, step: 1, desc: 'Ticks a break prediction is kept after its expected break time.' },
                urgency: { label: 'Urgency', type: 'number', def: 58, min: 0, max: 100, step: 1, desc: 'How strongly a replacement competes for the tick.' }
            },

            spikeTick: {
                _label: 'Spike Tick',
                _desc: 'Timing only. Where the spike goes is decided by the placement engine.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Place a spike into a held target at the moment the trap can be broken.' },
                contactRange: {
                    label: 'Contact Range', type: 'number', def: 55, min: 20, max: 120, step: 5,
                    desc: 'How close the spike must land to the target to count as a contact tick rather than area denial.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 75, min: 0, max: 100, step: 1, desc: 'High by default: the window is narrow and closes when the trap breaks.' }
            }
        },

        defense: {
            _label: 'Defense',
            _desc: 'Damage projection, hat swaps and healing.',
            shameCeiling: {
                label: 'Shame Ceiling', type: 'number', def: 7, min: 0, max: 12, step: 1,
                desc: 'Stop eating once shame reaches this. Past it the food is given away for nothing.'
            },

            antiSmartTick: {
                _label: 'Anti Smart Tick',
                _desc: 'Refuse to break out of a trap on the tick the enemy is waiting for.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Detect a spike setup around your exit and hold the break.' },
                sweepSteps: {
                    label: 'Sweep Resolution', type: 'number', def: 36, min: 12, max: 72, step: 6,
                    desc: 'Positions tested around the enemy when looking for the spike they could drop on your exit.'
                },
                maxHoldTicks: {
                    label: 'Maximum Hold', type: 'number', def: 6, min: 1, max: 30, step: 1,
                    desc: 'Give up and break out after this many ticks. An unbounded wait is how a patient enemy pins you until you die.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 68, min: 0, max: 100, step: 1, desc: 'How strongly the hold competes against the placement it suppresses.' }
            },

            safeSoldier: {
                _label: 'Safe Soldier',
                _desc: 'Wear the damage-reduction hat when the projected incoming hit justifies it.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Swap to Soldier Helmet against projected incoming damage.' },
                threshold: {
                    label: 'Damage Threshold', type: 'number', def: 45, min: 0, max: 140, step: 5,
                    desc: 'Projected incoming damage needed before the hat is worth the swap.'
                },
                damageCap: {
                    label: 'Projection Cap', type: 'number', def: 140, min: 50, max: 300, step: 10,
                    desc: 'Upper bound on the projection, so a crowd cannot inflate it past what one tick can deliver.'
                },
                scanRange: { label: 'Scan Range', type: 'number', def: 400, min: 100, max: 800, step: 20, desc: 'How far out to look for sources of incoming damage.' },
                urgencyBase: { label: 'Urgency: Base', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'Urgency for a survivable projected hit.' },
                urgencyScale: { label: 'Urgency: Lethality Scale', type: 'number', def: 45, min: 0, max: 100, step: 1, desc: 'Added urgency in proportion to how close the projection comes to killing you.' }
            },

            autoHeal: {
                _label: 'Auto Heal',
                _desc: 'Eat food, budgeted against the packet allowance.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Eat automatically when hurt or about to be.' },
                minMissing: { label: 'Minimum Missing Health', type: 'number', def: 20, min: 1, max: 100, step: 1, desc: 'Do not eat for less than this much missing health.' },
                calmTicks: { label: 'Calm Delay', type: 'number', def: 1, min: 0, max: 10, step: 1, desc: 'Ticks since the last hit before a routine top-up is allowed.' },
                dangerFloor: { label: 'Danger Floor', type: 'number', def: 40, min: 0, max: 100, step: 5, desc: 'Eat when the projected hit would leave you below this.' },
                maxItems: { label: 'Max Items Per Tick', type: 'number', def: 5, min: 1, max: 12, step: 1, desc: 'Upper bound on food eaten in one tick.' },
                frameReserve: {
                    label: 'Frame Reserve', type: 'number', def: 12, min: 0, max: 60, step: 2,
                    desc: 'Packets kept back for other actions. Healing never spends the whole allowance.'
                },
                urgencyLethal: { label: 'Urgency: Lethal', type: 'number', def: 95, min: 0, max: 100, step: 1, desc: 'Urgency when the projected hit would kill you.' },
                urgencyDanger: { label: 'Urgency: Danger', type: 'number', def: 62, min: 0, max: 100, step: 1, desc: 'Urgency when the projected hit would leave you below the floor.' },
                urgencyTopUp: { label: 'Urgency: Top Up', type: 'number', def: 25, min: 0, max: 100, step: 1, desc: 'Urgency for a routine heal between fights.' }
            },

            shameReset: {
                _label: 'Shame Reset',
                _desc: 'Burn down the anti-heal-spam counter during a lull by wearing the draining hat.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Wear Bull Helmet while safe so its health drain clears accumulated shame.' },
                minShame: { label: 'Minimum Shame', type: 'number', def: 3, min: 1, max: 12, step: 1, desc: 'Inferred shame level at which burning it down is worth the drain.' },
                safeRadius: { label: 'Safe Radius', type: 'number', def: 450, min: 100, max: 900, step: 25, desc: 'Refuse if any enemy is within this distance.' },
                minHealthFraction: { label: 'Minimum Health', type: 'number', def: 0.75, min: 0.2, max: 1, step: 0.05, desc: 'Fraction of full health below which the hat\'s drain is itself the risk.' },
                urgency: { label: 'Urgency', type: 'number', def: 20, min: 0, max: 100, step: 1, desc: 'Deliberately below Safe Soldier, so any real threat takes the hat slot instead.' }
            }
        },

        utility: {
            _label: 'Utility',
            _desc: 'Economy actions, which always yield to anything real.',
            autoMills: {
                _label: 'Auto Mills',
                _desc: 'Trail mills behind you while nothing else is happening.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Build mills behind you when idle and safe. Off by default -- it spends resources.' },
                perTick: { label: 'Mills Per Tick', type: 'number', def: 3, min: 1, max: 5, step: 1, desc: 'How many mills to offer in one tick.' },
                spreadFactor: {
                    label: 'Spread Factor', type: 'number', def: 1.5, min: 0.5, max: 3, step: 0.1,
                    desc: 'Multiplier on the mill\'s own scale for the angular gap between them, so they form a line rather than a pile.'
                },
                safeRadius: { label: 'Safe Radius', type: 'number', def: 500, min: 100, max: 1000, step: 20, desc: 'Stop building if any enemy is within this distance.' },
                minHealthFraction: { label: 'Minimum Health', type: 'number', def: 0.9, min: 0, max: 1, step: 0.05, desc: 'Fraction of full health below which mills are not worth the tick.' },
                resourceReserve: { label: 'Resource Reserve', type: 'number', def: 200, min: 0, max: 2000, step: 50, desc: 'Never spend a resource below this. Keeps material back for spikes and traps.' },
                frameFloor: { label: 'Frame Floor', type: 'number', def: 40, min: 0, max: 100, step: 5, desc: 'Packets that must remain in the allowance before a mill may be offered.' },
                urgency: { label: 'Urgency', type: 'number', def: 5, min: 0, max: 100, step: 1, desc: 'Lowest in the client by design: a mill never wins a contested tick.' }
            },

            autoUpgrade: {
                _label: 'Auto Upgrade',
                _desc: 'Spend age upgrade points automatically.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Take an upgrade as soon as points are offered.' },
                order: {
                    label: 'Preference Order', type: 'text',
                    def: 'katana,polearm,great hammer,pit trap,greater spikes,spikes,windmill,mine,turret,castle wall,stone wall',
                    desc: 'Comma-separated item and weapon names, best first. Names are resolved against the game\'s own tables, so a renumbering upstream cannot repoint a choice.'
                },
                takeAnything: {
                    label: 'Take Anything Offered', type: 'bool', def: true,
                    desc: 'If nothing in the preference list is on offer, take the first available rather than sitting on unspent points.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 30, min: 0, max: 100, step: 1, desc: 'How strongly an upgrade competes for the tick.' }
            },

            autoBuy: {
                _label: 'Auto Buy',
                _desc: 'Buy the hats the defensive and offensive modules want to wear.',
                enabled: { label: 'Enable', type: 'bool', def: true, desc: 'Buy hats when affordable. Without it, Safe Soldier and the damage hat are permanent no-ops on a fresh account.' },
                wanted: {
                    label: 'Shopping List', type: 'text',
                    def: 'Soldier Helmet,Bull Helmet,Booster Hat,Tank Gear,Turret Gear',
                    desc: 'Comma-separated hat and accessory names, in buying order. Prices come from the game\'s own tables.'
                },
                pointReserve: {
                    label: 'Point Reserve', type: 'number', def: 0, min: 0, max: 20000, step: 500,
                    desc: 'Never spend below this many points.'
                },
                urgency: { label: 'Urgency', type: 'number', def: 12, min: 0, max: 100, step: 1, desc: 'Low: a purchase never displaces a fight.' }
            },

            autoRespawn: {
                _label: 'Auto Respawn',
                _desc: 'Rejoin after death by replaying the game\'s own spawn packet.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Respawn automatically. Off by default so death stays a decision you make.' },
                delayMs: { label: 'Delay', type: 'number', def: 1200, min: 0, max: 10000, step: 100, desc: 'Milliseconds to wait after death before rejoining.' },
                urgency: { label: 'Urgency', type: 'number', def: 90, min: 0, max: 100, step: 1, desc: 'High, but it only ever competes with other intents while dead.' }
            },

            autoGather: {
                _label: 'Auto Gather',
                _desc: 'Hold the attack for farming, and release it when the swing is needed.',
                enabled: { label: 'Enable', type: 'bool', def: false, desc: 'Toggle the game\'s auto-gather to match the situation. Off by default: it moves your hands for you.' },
                combatRadius: { label: 'Combat Radius', type: 'number', def: 400, min: 100, max: 900, step: 25, desc: 'An enemy inside this distance counts as combat for the purpose of releasing the held attack.' },
                urgency: { label: 'Urgency', type: 'number', def: 15, min: 0, max: 100, step: 1, desc: 'Low: the toggle is cheap and never urgent.' }
            }
        },

        movement: {
            _label: 'Movement',
            _desc: 'The only part of 2yz that steers for you. Off by default; your own movement passes through untouched.',
            enabled: { label: 'Enable Movement', type: 'bool', def: false, desc: 'Master switch. While off, 2yz never sends a movement packet.' },
            antiKnockback: {
                label: 'Anti Knockback', type: 'bool', def: true,
                desc: 'When an incoming hit would throw you onto a structure, lean into the push so the displacement lands short of it.'
            },
            safeWalk: {
                label: 'Safe Walk', type: 'bool', def: true,
                desc: 'Steer around enemy spikes, traps, boost pads and teleporters on the heading you are already using.'
            },
            autoPush: {
                label: 'Auto Push', type: 'bool', def: false,
                desc: 'Body-block the target toward one of your spikes, but only when the lane is clear of hazards for you.'
            },
            lookaheadDistance: {
                label: 'Lookahead Distance', type: 'number', def: 240, min: 60, max: 600, step: 20,
                desc: 'How far ahead the current heading is projected when checking for hazards.'
            },
            avoidSteps: {
                label: 'Avoidance Resolution', type: 'number', def: 6, min: 2, max: 16, step: 1,
                desc: 'How many headings either side are tried when steering around a hazard. The smallest correction that works is chosen.'
            },
            pushRange: {
                label: 'Push Range', type: 'number', def: 120, min: 40, max: 300, step: 10,
                desc: 'Stop trying to body-block beyond this distance.'
            },
            pushDistance: {
                label: 'Push Projection', type: 'number', def: 160, min: 50, max: 400, step: 10,
                desc: 'How far a shove is assumed to carry the target when checking whether it lands them on a spike.'
            },
            urgencyAntiKnockback: { label: 'Urgency: Anti Knockback', type: 'number', def: 72, min: 0, max: 100, step: 1, desc: 'How strongly the knockback correction competes for the tick.' },
            urgencySafeWalk: { label: 'Urgency: Safe Walk', type: 'number', def: 50, min: 0, max: 100, step: 1, desc: 'How strongly hazard avoidance competes for the tick.' },
            urgencyPush: { label: 'Urgency: Push', type: 'number', def: 35, min: 0, max: 100, step: 1, desc: 'How strongly body-blocking competes for the tick.' }
        },

        chat: {
            _label: 'Chat',
            _desc: 'Automatic messages, rate-limited by the game\'s own chat cooldown.',
            enabled: { label: 'Enable Chat', type: 'bool', def: false, desc: 'Master switch for automatic messages. Off by default.' },
            killChat: { label: 'Kill Messages', type: 'bool', def: true, desc: 'Say a line after a kill.' },
            killLines: {
                label: 'Kill Lines', type: 'text', def: 'gg|nice try|too easy|sit down',
                desc: 'Pipe-separated lines, used in rotation. Truncated to 30 characters, which is the game\'s own limit.'
            },
            idleChat: { label: 'Idle Messages', type: 'bool', def: false, desc: 'Say a line periodically while no enemy is nearby.' },
            idleLines: {
                label: 'Idle Lines', type: 'text', def: '2yz|.|..',
                desc: 'Pipe-separated lines, used in rotation while idle.'
            },
            idleGapMs: { label: 'Idle Gap', type: 'number', def: 20000, min: 3000, max: 120000, step: 1000, desc: 'Milliseconds between idle messages.' },
            minGapMs: {
                label: 'Minimum Gap', type: 'number', def: 900, min: 500, max: 10000, step: 100,
                desc: 'Floor on the gap between messages. The larger of this and the game\'s own chat cooldown is used, so 2yz cannot outrun the server\'s limiter.'
            },
            urgency: { label: 'Urgency', type: 'number', def: 8, min: 0, max: 100, step: 1, desc: 'Low: a message never displaces an action.' }
        },

        overlay: {
            _label: 'Overlay',
            _desc: 'Drawing. 2yz renders on its own canvas over the game, reproducing the game\'s camera; nothing it draws feeds a decision.',
            enabled: { label: 'Enable Overlay', type: 'bool', def: false, desc: 'Master switch for all drawing.' },
            showTargets: { label: 'Targets', type: 'bool', def: true, desc: 'Ring every candidate; highlight the current target and draw the line to it.' },
            showHealth: { label: 'Health Numbers', type: 'bool', def: true, desc: 'Print each candidate\'s health above them.' },
            showPrediction: { label: 'Prediction', type: 'bool', def: true, desc: 'Draw where each candidate is predicted to be.' },
            predictionTicks: { label: 'Prediction Horizon', type: 'number', def: 3, min: 1, max: 8, step: 1, desc: 'How many ticks ahead the prediction marker is drawn.' },
            showPlacement: { label: 'Placement Candidates', type: 'bool', def: true, desc: 'Draw the top-ranked spike positions the placement engine picked.' },
            placementCount: { label: 'Candidates Shown', type: 'number', def: 3, min: 1, max: 10, step: 1, desc: 'How many ranked positions to draw.' },
            showHazards: { label: 'Hazards', type: 'bool', def: true, desc: 'Ring enemy spikes and traps, and your own spikes faintly.' },
            showRanges: { label: 'Weapon Ranges', type: 'bool', def: false, desc: 'Draw your weapon reach, dimmed while on cooldown.' }
        },

        prediction: {
            _label: 'Prediction',
            _desc: 'The one movement model every module shares.',
            recalcAngle: {
                label: 'Direction-Change Threshold', type: 'number', def: 0.5, min: 0.05, max: 3.14, step: 0.05,
                desc: 'Radians. A target that turns more sharply than this in one tick invalidates anything predicted from its old heading.'
            },
            knockbackDistance: {
                label: 'Knockback Distance', type: 'number', def: 200, min: 50, max: 400, step: 10,
                desc: 'How far a hit is assumed to push a player, used for chain and escape projections.'
            },
            fitTolerance: {
                label: 'Fit Tolerance', type: 'number', def: 40, min: 5, max: 200, step: 5,
                desc: 'Units of replay error at which confidence reaches zero. Lower makes every module more cautious about acting on a prediction.'
            }
        },

        network: {
            _label: 'Network',
            _desc: 'Packet budget and the single send path.',
            packetsPerSecond: {
                label: 'Packet Budget', type: 'number', def: 110, min: 20, max: 200, step: 5,
                desc: 'Hard cap on outbound frames per second, shared by 2yz and the game\'s own traffic. The scheduler reserves against this before anything is sent.'
            },
            aimEpsilon: {
                label: 'Aim Epsilon', type: 'number', def: 0.3, min: 0, max: 1, step: 0.05,
                desc: 'Radians. Aim changes smaller than this are dropped -- the game applies the same gate, so sending them is pure waste.'
            }
        },

        debug: {
            _label: 'Debug',
            _desc: 'Diagnostics. All off by default.',
            enabled: { label: 'Enable Debug Overlay', type: 'bool', def: false, desc: 'Master switch for the on-screen panel.' },
            prediction: { label: 'Prediction', type: 'bool', def: false, desc: 'Show target velocity, predicted position, model branch and confidence.' },
            targeting: { label: 'Targeting', type: 'bool', def: false, desc: 'Show the current target, its score and the candidate count.' },
            placement: { label: 'Placement', type: 'bool', def: false, desc: 'Show the top-ranked positions and why each scored as it did.' },
            combat: { label: 'Combat', type: 'bool', def: false, desc: 'Show combat state, the active sequence and reload readiness.' },
            arbiter: { label: 'Arbitration', type: 'bool', def: false, desc: 'Show every intent submitted this tick, which won, and why the rest were rejected.' },
            packets: { label: 'Packets', type: 'bool', def: false, desc: 'Show frames sent and dropped, and the remaining budget.' },
            modules: { label: 'Modules', type: 'bool', def: false, desc: 'Show each module\'s own state.' }
        }
    };

    /* --- storage -------------------------------------------------------- */

    const values = {};

    function isLeaf(node) {
        return node && typeof node === 'object' && 'type' in node && 'def' in node;
    }

    function walk(node, path, fn) {
        for (const key in node) {
            if (key.startsWith('_')) continue;
            const child = node[key];
            const childPath = path ? path + '.' + key : key;
            if (isLeaf(child)) fn(childPath, child);
            else walk(child, childPath, fn);
        }
    }

    function nodeAt(path) {
        const parts = path.split('.');
        let node = schema;
        for (const part of parts) {
            if (!node) return null;
            node = node[part];
        }
        return node || null;
    }

    walk(schema, '', function (path, leaf) { values[path] = leaf.def; });

    function load() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { saved = null; }
        if (!saved) return;
        for (const path in saved) {
            if (path in values) values[path] = saved[path];
        }
    }

    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch (e) { /* storage disabled */ }
    }

    return {
        schema,
        load,
        save,

        get(path) {
            if (!(path in values)) {
                Log.error('config', new Error('unknown key ' + path));
                return undefined;
            }
            return values[path];
        },

        set(path, value) {
            const leaf = nodeAt(path);
            if (!leaf || !isLeaf(leaf)) return false;
            let v = value;
            if (leaf.type === 'number') {
                v = parseFloat(v);
                if (isNaN(v)) return false;
                if (leaf.min != null) v = Math.max(leaf.min, v);
                if (leaf.max != null) v = Math.min(leaf.max, v);
            } else if (leaf.type === 'bool') {
                v = !!v;
            } else if (leaf.type === 'text') {
                v = String(v);
            }
            values[path] = v;
            save();
            return true;
        },

        /* Whole sub-tree as a flat object of leaf-name -> value. Used where a
         * module wants a bag of related numbers, such as the scoring weights. */
        section(path) {
            const node = nodeAt(path);
            if (!node) return {};
            const out = {};
            for (const key in node) {
                if (key.startsWith('_')) continue;
                if (isLeaf(node[key])) out[key] = values[path + '.' + key];
            }
            return out;
        },

        reset() {
            walk(schema, '', function (p, leaf) { values[p] = leaf.def; });
            save();
        },

        /* Every leaf path, for the verifier and the menu builder. */
        keys() {
            const out = [];
            walk(schema, '', function (p) { out.push(p); });
            return out;
        },

        leafAt(path) {
            const node = nodeAt(path);
            return isLeaf(node) ? node : null;
        },

        all() { return Object.assign({}, values); }
    };
})();
