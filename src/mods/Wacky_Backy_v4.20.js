// ==UserScript==
// @name        Wacky-Backy
// @match       *://*.moomoo.io/*
// @match       localhost:3000
// @grant       none
// @version     v4.20
// @author      Yurio, Oe And Brt3726, MihailSurviv
// @description WARNING: There's a strange data transfer from discord, so download at your own risk. If something goes wrong, don't blame me. You downloaded it yourself.
// @require     https://cdnjs.cloudflare.com/ajax/libs/msgpack-lite/0.1.26/msgpack.min.js
// @require     https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js
// ==/UserScript==


/*
Welcome all the skidders
Just some suggestions to what u can improve on
Make a projectile detection system. I was thinking of creating rectangles of how far each projectile can travel, and do some velocity calculations to try to get out of the rectangles. This idea may be good, may be bad just some random idea I have
Make some kind of simulator for hits to break with the autobreaker. Rn it uses hammer + tank, or primary without tank when fast breaking. But I think primary + tank should be considered as well. And have some scenarios where u attempt to break slower if u can get spike ticked (ur in trap, enemy push u to spike, and sync their attack with ur tank break to tick). In these scenarios u can either try to wait one tick (stop all breaks and hat hat switching and wear soldier) or break with soldier. Both has pros and cons obviously. I think if its possible to survive (like without soldier, u can break the spike within 2 no soldier hits), then do soldier break. If not try to wait one tick and break. Ofc u can also make prediction system to guess if they will sync hit with ur tank and then do accordingly.
Make a new autoplacing system. Rn its still using old ueh stuff. But u can finish up my spike kb simulator and use my op angle calculator to make better placers. Angle calculator gives u the exact angles u can place in. Since placing is done before movement server side, x2 y2 gives accurate placement coordinates. (or the most accurate cuz of the rounding stuff)
new idea for anti retrap: do function selectToBuild with a trap. So ur gonna be holding a trap, then sendAtck in like 50 angles. This ensures that a lot of angles are checked while sending very little packets. And the pain point of anti retrap is to place something somewhere after breaking out of trap. So even if only one trap placed, its still prevents u from being retrapped.
I feel like preplacer should be autoplacer just with one building ignored and packet is sent delayed so that it gets to the server right after the next server side tick update. Replacer should be the same thing unless for certain scenarios like anti retrap. So i feel like its just putting one logic into 3 things. But I may be wrong ofc with no testing and stuff.
Movement simulator from my testing is pretty accurate. At least for immediate next tick predictions based on movement packet sent. It can be used for pathfinding, more accurate safewalk, more accurate preplacer, more accurate healing.
Can add animal logic on the heal too so u dont die to animals cuz it doesnt want to shame at all costs and right now it doesnt use naimals when calculating damage threat.
Good luck and enjoy coding
*/
let daSongs = [
    {
        "name": "Avicii - The Nights",
        "lyrics": [
            [
                3200,
                "Once upon a younger year"
            ],
            [
                4895,
                "When all our shadows"
            ],
            [
                5960,
                "disappeared"
            ],
            [
                6805,
                "The animals inside"
            ],
            [
                8017,
                "came out to play"
            ],
            [
                10754,
                "Went face to face"
            ],
            [
                11482,
                "with all our fears"
            ],
            [
                12731,
                "Learned our lessons"
            ],
            [
                13646,
                "through the tears"
            ],
            [
                14428,
                "Made memories we knew"
            ],
            [
                15761,
                "would never fade"
            ],
            [
                17794,
                "One day, my father,"
            ],
            [
                19150,
                "he told me,"
            ],
            [
                19864,
                "Son, don't let it slip away"
            ],
            [
                22065,
                "He took me in his arms,"
            ],
            [
                23325,
                "I heard him say"
            ],
            [
                25869,
                "When you get older,"
            ],
            [
                26778,
                "your wild heart will"
            ],
            [
                28002,
                "live for younger days"
            ],
            [
                29788,
                "Think of me if"
            ],
            [
                30689,
                "ever you're afraid"
            ],
            [
                32988,
                "He said,"
            ],
            [
                33654,
                "One day,"
            ],
            [
                34508,
                "you'll leave this world behind"
            ],
            [
                36777,
                "So live a life"
            ],
            [
                38205,
                "you will remember"
            ],
            [
                40695,
                "My father told me when"
            ],
            [
                42318,
                "I was just a child"
            ],
            [
                44429,
                "These are the nights"
            ],
            [
                45729,
                "that never die"
            ],
            [
                47686,
                "My father told me"
            ],
            [
                79400,
                "When thunderclouds"
            ],
            [
                80349,
                "start pouring down"
            ],
            [
                81219,
                "Light a fire"
            ],
            [
                81992,
                "they can't put out"
            ],
            [
                83286,
                "Carve your name"
            ],
            [
                83917,
                "into those shining stars"
            ],
            [
                86457,
                "He said,"
            ],
            [
                87010,
                "Go venture far"
            ],
            [
                87841,
                "beyond the shores"
            ],
            [
                88876,
                "Don't forsake this"
            ],
            [
                89746,
                "life of yours"
            ],
            [
                90527,
                "I'll guide you home"
            ],
            [
                91493,
                "no matter where you are"
            ],
            [
                93932,
                "One day, my father,"
            ],
            [
                95309,
                "he told me,"
            ],
            [
                96018,
                "Son, don't let it slip away"
            ],
            [
                98247,
                "When I was just a kid,"
            ],
            [
                99549,
                "I heard him say"
            ],
            [
                101853,
                "When you get older,"
            ],
            [
                103150,
                "your wild heart"
            ],
            [
                104064,
                "will live for younger days"
            ],
            [
                106088,
                "Think of me if"
            ],
            [
                106947,
                "ever you're afraid"
            ],
            [
                109229,
                "He said,"
            ],
            [
                109656,
                "One day,"
            ],
            [
                110614,
                "you'll leave this world behind"
            ],
            [
                113017,
                "So live a life"
            ],
            [
                114356,
                "you will remember"
            ],
            [
                116823,
                "My father told me when"
            ],
            [
                118283,
                "I was just a child"
            ],
            [
                120576,
                "These are the nights"
            ],
            [
                121980,
                "that never die"
            ],
            [
                124003,
                "My father told me"
            ],
            [
                136169,
                "These are the nights"
            ],
            [
                137292,
                "that never die"
            ],
            [
                139361,
                "My father told me"
            ],
            [
                163736,
                "Oh~"
            ],
            [
                169915,
                "My father told me"
            ]
        ]
    },
    {
        "name": "Initial D - Gas Gas Gas",
        "lyrics": [
            [
                17000,
                "Ahhhhh"
            ],
            [
                19954,
                "gas,"
            ],
            [
                20720,
                "Gas,"
            ],
            [
                21509,
                "gas"
            ],
            [
                24000,
                "Ahhhhh"
            ],
            [
                28432,
                "Do you like"
            ],
            [
                29789,
                "My car?"
            ],
            [
                31489,
                "my car"
            ],
            [
                33067,
                "m y  c a r"
            ],
            [
                53120,
                "Guess you're ready"
            ],
            [
                54234,
                "Cause I'm waiting for you"
            ],
            [
                55956,
                "It's gonna be so exciting!"
            ],
            [
                59140,
                "Got this feeling"
            ],
            [
                60397,
                "Really deep in my soul"
            ],
            [
                62309,
                "Let's get out, I wanna go"
            ],
            [
                63983,
                "Come along, get it on!"
            ],
            [
                65956,
                "Gonna take my car"
            ],
            [
                67536,
                "Gonna sit in"
            ],
            [
                69106,
                "Gona drive along til I get you"
            ],
            [
                71770,
                "Cause I'm crazy, hot and ready"
            ],
            [
                73609,
                "But you'll like it!"
            ],
            [
                74894,
                "I wanna race for you!"
            ],
            [
                76739,
                "(Shall I go now?)"
            ],
            [
                78426,
                "Gas Gas Gas!"
            ],
            [
                79661,
                "I'm gonna step on the gas"
            ],
            [
                81378,
                "Tonight I'll fly!"
            ],
            [
                82900,
                "And be your lover"
            ],
            [
                84218,
                "Yeah yeah yeah!"
            ],
            [
                85933,
                "I'll be so quick as a flash"
            ],
            [
                87594,
                "And I'll be your hero"
            ],
            [
                90462,
                "Gas Gas Gas!"
            ],
            [
                92184,
                "I'm gonna run as a flash"
            ],
            [
                93930,
                "Tonight I'll fight!"
            ],
            [
                95561,
                "To be the winner"
            ],
            [
                96766,
                "Yeah yeah yeah!"
            ],
            [
                98475,
                "I'm gonna step on the gas"
            ],
            [
                100093,
                "And you'll see the big show!"
            ],
            [
                115553,
                "Don't be lazy"
            ],
            [
                116577,
                "Cause I'm burning for you"
            ],
            [
                118431,
                "It's like a hot sensation!"
            ],
            [
                121661,
                "Got this power"
            ],
            [
                122805,
                "That is taking me out"
            ],
            [
                124524,
                "Yes, I've got a crush on you"
            ],
            [
                126383,
                "Ready, now"
            ],
            [
                127324,
                "Ready, go!"
            ],
            [
                128283,
                "Gonna take my car"
            ],
            [
                129837,
                "Gonna sit in"
            ],
            [
                131431,
                "Gona drive along til I get you"
            ],
            [
                134033,
                "Cause I'm crazy, hot and ready"
            ],
            [
                135838,
                "But you'll like it!"
            ],
            [
                137299,
                "I wanna race for you!"
            ],
            [
                139000,
                "Shall I go now?"
            ],
            [
                140495,
                "Gas Gas Gas!"
            ],
            [
                141981,
                "I'm gonna step on the gas"
            ],
            [
                143616,
                "Tonight I'll fly!"
            ],
            [
                145350,
                "And be your lover"
            ],
            [
                146554,
                "Yeah yeah yeah!"
            ],
            [
                148246,
                "I'll be so quick as a flash"
            ],
            [
                149886,
                "And I'll be your hero"
            ],
            [
                152696,
                "Gas Gas Gas!"
            ],
            [
                154549,
                "I'm gonna run as a flash"
            ],
            [
                156175,
                "Tonight I'll fight!"
            ],
            [
                157747,
                "To be the winner"
            ],
            [
                158965,
                "Yeah yeah yeah!"
            ],
            [
                160813,
                "I'm gonna step on the gas"
            ],
            [
                162436,
                "And you'll see the big show!"
            ],
            [
                190357,
                "Guess you're ready"
            ],
            [
                191319,
                "Cause I'm waiting for you"
            ],
            [
                193338,
                "It's gonna be so exciting!"
            ],
            [
                196258,
                "Got this feeling"
            ],
            [
                197534,
                "Really deep in my soul"
            ],
            [
                199240,
                "Let's get out, I wanna go"
            ],
            [
                201109,
                "Come along, get it on"
            ],
            [
                203124,
                "Gonna take my car"
            ],
            [
                206184,
                "Do you like my car?"
            ],
            [
                208904,
                "Cause I'm crazy, hot and ready"
            ],
            [
                210626,
                "But you'll like it!"
            ],
            [
                212057,
                "I wanna race for you!"
            ],
            [
                213833,
                "Shall I go now?"
            ],
            [
                216846,
                "Gas Gas Gas!"
            ],
            [
                218433,
                "I'm gonna step on the gas"
            ],
            [
                220052,
                "Tonight I'll fly!"
            ],
            [
                221687,
                "And be your lover"
            ],
            [
                222927,
                "Yeah yeah yeah!"
            ],
            [
                224791,
                "I'll be so quick as a flash"
            ],
            [
                226348,
                "And I'll be your hero"
            ],
            [
                229497,
                "Gas Gas Gas!"
            ],
            [
                230955,
                "I'm gonna run as a flash"
            ],
            [
                232590,
                "Tonight I'll fight!"
            ],
            [
                234096,
                "To be the winner"
            ],
            [
                235462,
                "Yeah yeah yeah!"
            ],
            [
                237258,
                "I'm gonna step on the gas"
            ],
            [
                238816,
                "And you'll see the big show!"
            ],
            [
                242147,
                "Gas Gas Gas!"
            ],
            [
                244960,
                "Yeah yeah yeah!"
            ],
            [
                248228,
                "Gas Gas Gas!"
            ],
            [
                251217,
                "And you'll see the big show!"
            ]
        ]
    },
    {
        "name": "Ruth B - Dandelions",
        "lyrics": [
            [
                12262,
                "Maybe it's the way you"
            ],
            [
                13658,
                "say my name"
            ],
            [
                18179,
                "Maybe it's the way you"
            ],
            [
                19909,
                "play your game"
            ],
            [
                23413,
                "But it's so good,"
            ],
            [
                25263,
                "I've never known"
            ],
            [
                26444,
                "anybody like you"
            ],
            [
                29395,
                "But it's so good,"
            ],
            [
                31377,
                "I've never dreamed"
            ],
            [
                32581,
                "of nobody like you"
            ],
            [
                36052,
                "And I've heard of a love"
            ],
            [
                38112,
                "that comes once in a lifetime"
            ],
            [
                42952,
                "And I'm pretty sure that"
            ],
            [
                44197,
                "you are that love of mine"
            ],
            [
                48426,
                "'Cause"
            ],
            [
                49149,
                "I'm in a field of dandelions"
            ],
            [
                52165,
                "Wishing on every one"
            ],
            [
                54328,
                "that you'd be mine,"
            ],
            [
                58249,
                "mine"
            ],
            [
                60742,
                "And I see forever"
            ],
            [
                62970,
                "in your eyes"
            ],
            [
                64612,
                "I feel okay when I"
            ],
            [
                66752,
                "see you smile,"
            ],
            [
                70601,
                "smile"
            ],
            [
                73029,
                "Wishing on dandelions"
            ],
            [
                74563,
                "all of the time"
            ],
            [
                76054,
                "Praying to God that"
            ],
            [
                77225,
                "one day you'll be mine"
            ],
            [
                79069,
                "Wishing on dandelions"
            ],
            [
                80697,
                "all of the time,"
            ],
            [
                82231,
                "all of the time"
            ],
            [
                85965,
                "I think that you"
            ],
            [
                87070,
                "are the one for me"
            ],
            [
                91994,
                "'Cause it gets so"
            ],
            [
                92369,
                "hard to breathe"
            ],
            [
                97220,
                "When you're looking at me,"
            ],
            [
                98988,
                "I've never felt so"
            ],
            [
                100361,
                "alive and free"
            ],
            [
                103448,
                "When you're looking at me,"
            ],
            [
                105249,
                "I've never felt so happy"
            ],
            [
                109930,
                "And I've heard of a love"
            ],
            [
                111902,
                "that comes once in a lifetime"
            ],
            [
                116665,
                "And I'm pretty sure that"
            ],
            [
                117986,
                "you are that love of mine"
            ],
            [
                122308,
                "'Cause"
            ],
            [
                123135,
                "I'm in a field of dandelions"
            ],
            [
                126030,
                "Wishing on every one"
            ],
            [
                128050,
                "that you'd be mine,"
            ],
            [
                131823,
                "mine"
            ],
            [
                134401,
                "And I see forever"
            ],
            [
                136962,
                "in your eyes"
            ],
            [
                138340,
                "I feel okay when I"
            ],
            [
                140597,
                "see you smile,"
            ],
            [
                144420,
                "smile"
            ],
            [
                147113,
                "Wishing on dandelions"
            ],
            [
                148588,
                "all of the time"
            ],
            [
                149911,
                "Praying to God that"
            ],
            [
                151384,
                "one day you'll be mine"
            ],
            [
                153038,
                "Wishing on dandelions"
            ],
            [
                154526,
                "all of the time"
            ],
            [
                155979,
                "All of the time"
            ],
            [
                159832,
                "Dandelion,"
            ],
            [
                160821,
                "into the wind you go"
            ],
            [
                162930,
                "Won't you let"
            ],
            [
                164150,
                "my darling know?"
            ],
            [
                166029,
                "Dandelion,"
            ],
            [
                167097,
                "into the wind you go"
            ],
            [
                169038,
                "Won't you let"
            ],
            [
                169975,
                "my darling know?"
            ],
            [
                171700,
                "That"
            ],
            [
                173969,
                "I'm in a field of dandelions"
            ],
            [
                176822,
                "Wishing on every one that"
            ],
            [
                179183,
                "you'd be mine,"
            ],
            [
                182976,
                "mine"
            ],
            [
                185325,
                "And I see forever"
            ],
            [
                187536,
                "in your eyes"
            ],
            [
                189051,
                "I feel okay when I"
            ],
            [
                191232,
                "see you smile,"
            ],
            [
                195272,
                "smile"
            ],
            [
                197665,
                "Wishing on dandelions"
            ],
            [
                199124,
                "all of the time"
            ],
            [
                200537,
                "Praying to God that"
            ],
            [
                201771,
                "one day you'll be mine"
            ],
            [
                203741,
                "Wishing on dandelions"
            ],
            [
                205284,
                "all of the time,"
            ],
            [
                206818,
                "all of the time"
            ],
            [
                210608,
                "I'm in a field of dandelions"
            ],
            [
                213827,
                "Wishing on every one that"
            ],
            [
                216100,
                "you'd be mine,"
            ],
            [
                219909,
                "mine"
            ]
        ]
    },
    {
        "name": "Sub Urban - Cradles",
        "lyrics": [
            [
                12757,
                "I live inside my own"
            ],
            [
                15758,
                "world of make-believe"
            ],
            [
                18587,
                "Kids screaming"
            ],
            [
                20238,
                "in their cradles,"
            ],
            [
                22040,
                "profanities"
            ],
            [
                24702,
                "I see the world through eyes"
            ],
            [
                27215,
                "covered in ink and bleach"
            ],
            [
                30746,
                "Cross out the ones who heard"
            ],
            [
                33242,
                "my cries and watched me weep"
            ],
            [
                36700,
                "I love everything"
            ],
            [
                39742,
                "Fire's spreading"
            ],
            [
                41193,
                "all around my room"
            ],
            [
                43257,
                "My world's so bright"
            ],
            [
                44664,
                "It's hard to breathe"
            ],
            [
                46165,
                "but that's alright"
            ],
            [
                47436,
                "Hush Shh"
            ],
            [
                72704,
                "Tape my eyes open"
            ],
            [
                74621,
                "to force reality"
            ],
            [
                76696,
                "(oh, no no)"
            ],
            [
                78525,
                "Why can't you just let me"
            ],
            [
                80876,
                "eat my weight in glee"
            ],
            [
                84737,
                "I live inside my own"
            ],
            [
                87595,
                "world of make-believe"
            ],
            [
                90622,
                "Kids screaming"
            ],
            [
                91974,
                "in their cradles,"
            ],
            [
                93934,
                "profanities"
            ],
            [
                96731,
                "Some days I feel skinnier"
            ],
            [
                99084,
                "than all the other days"
            ],
            [
                102780,
                "Sometimes I can't tell"
            ],
            [
                104407,
                "if my body belongs to me"
            ],
            [
                108800,
                "I love everything"
            ],
            [
                111452,
                "Fire's spreading"
            ],
            [
                112835,
                "all around my room"
            ],
            [
                115108,
                "My world's so bright"
            ],
            [
                116547,
                "It's hard to breathe"
            ],
            [
                118155,
                "but that's alright"
            ],
            [
                119402,
                "Hush Shh"
            ],
            [
                144344,
                "I wanna taste your content"
            ],
            [
                146703,
                "Hold your breath and"
            ],
            [
                148365,
                "feel the tension"
            ],
            [
                150024,
                "Devils hide behind redemption"
            ],
            [
                152745,
                "Honesty is a"
            ],
            [
                154330,
                "one-way gate to hell"
            ],
            [
                156300,
                "I wanna taste consumption"
            ],
            [
                159100,
                "Breathe faster to waste oxygen"
            ],
            [
                162090,
                "Hear the children sing aloud"
            ],
            [
                164628,
                "It's music 'til the"
            ],
            [
                166425,
                "wick burns out"
            ],
            [
                167776,
                "Hush"
            ],
            [
                180700,
                "Just wanna be"
            ],
            [
                181627,
                "care free lately,"
            ],
            [
                184477,
                "yeah"
            ],
            [
                185000,
                "Just kicking up daisies"
            ],
            [
                188225,
                "Got one too many"
            ],
            [
                189336,
                "quarters in my pockets"
            ],
            [
                191585,
                "Count 'em like the four-leaf"
            ],
            [
                193231,
                "clovers in my locket"
            ],
            [
                195292,
                "Untied laces, yeah"
            ],
            [
                198507,
                "Just tripping on daydreams"
            ],
            [
                201160,
                "Got dirty little lullabies"
            ],
            [
                203140,
                "playing on repeat"
            ],
            [
                204662,
                "Might as well just rot around"
            ],
            [
                206200,
                "the nursery and count sheep"
            ]
        ]
    },
    {
        "name": "Kord Hell - Scopin",
        "lyrics": [
            [
                2732,
                "I got that gauge 38"
            ],
            [
                3934,
                "and that four-five Glock"
            ],
            [
                5066,
                "Deep in the bushes, see"
            ],
            [
                5954,
                "I'm scopin' with that red dot"
            ],
            [
                7532,
                "I got that, I got that,"
            ],
            [
                8784,
                "I got that four-five Glock"
            ],
            [
                9905,
                "Deep in the bushes, see"
            ],
            [
                10848,
                "I'm scopin' with that red dot"
            ],
            [
                12486,
                "I got that gauge 38"
            ],
            [
                13583,
                "and that four-five Glock"
            ],
            [
                14860,
                "Deep in the bushes, see"
            ],
            [
                15688,
                "I'm scopin' with that red dot"
            ],
            [
                17365,
                "I got that, I got that,"
            ],
            [
                18203,
                "I got that, I got that"
            ],
            [
                19522,
                "I, I, I, I"
            ],
            [
                30581,
                "Scopin' with that red dot"
            ],
            [
                39267,
                "Deep in the bushes, see"
            ],
            [
                40266,
                "I'm scopin' with that red dot"
            ],
            [
                41762,
                "I got that gauge 38"
            ],
            [
                43041,
                "and that four-five Glock"
            ],
            [
                44272,
                "Deep in the bushes, see"
            ],
            [
                45270,
                "I'm scopin' with that red dot"
            ],
            [
                46746,
                "I got that, I got that,"
            ],
            [
                47901,
                "I got that four-five Glock"
            ],
            [
                49176,
                "Deep in the bushes, see"
            ],
            [
                50071,
                "I'm scopin' with that red dot"
            ],
            [
                51587,
                "I got that gauge 38"
            ],
            [
                52684,
                "and that four-five Glock"
            ],
            [
                53830,
                "Deep in the bushes, see"
            ],
            [
                54965,
                "I'm scopin' with that red dot"
            ],
            [
                56433,
                "I got that, I got that,"
            ],
            [
                57588,
                "I got that four-five Glock"
            ],
            [
                58831,
                "Deep in the bushes, see I'm"
            ],
            [
                59823,
                "scopin' with that red dot"
            ],
            [
                69768,
                "Scopin' with that red dot"
            ],
            [
                78434,
                "Deep in the bushes, see"
            ],
            [
                79314,
                "I'm scopin' with that red dot"
            ],
            [
                81811,
                "Scopin' with that red dot"
            ],
            [
                84108,
                "Scopin', scopin'"
            ],
            [
                84779,
                "with that red dot"
            ],
            [
                86825,
                "Scopin' with that red dot"
            ],
            [
                88363,
                "Deep in the bushes, see"
            ],
            [
                89175,
                "I'm scopin' with that red dot"
            ],
            [
                91900,
                "Scopin' with that red dot"
            ],
            [
                93989,
                "Scopin', scopin'"
            ],
            [
                94560,
                "with that red dot"
            ],
            [
                96801,
                "Scopin' with that red dot"
            ],
            [
                97969,
                "Deep in the bushes, see"
            ],
            [
                99088,
                "I'm scopin' with that red dot"
            ]
        ]
    },
    {
        "name": "The Living Tombstone - My Ordinary Life",
        "lyrics": [
            [
                29252,
                "They tell me keep it simple,"
            ],
            [
                30570,
                "I tell them take it slow"
            ],
            [
                31904,
                "I feed and water an idea,"
            ],
            [
                33362,
                "so I let it grow"
            ],
            [
                34596,
                "I tell them take it easy,"
            ],
            [
                35829,
                "they laugh and tell me no"
            ],
            [
                37143,
                "It's cool, but I dont see them"
            ],
            [
                38277,
                "laughin' at my money, though"
            ],
            [
                39705,
                "They spittin' facts at me,"
            ],
            [
                41002,
                "Im spittin' tracks, catch me?"
            ],
            [
                42366,
                "Im spinnin gold out my records"
            ],
            [
                43847,
                "know you can't combat me"
            ],
            [
                45121,
                "They tell me, Jesus walks,"
            ],
            [
                46289,
                "I tell them, money talks"
            ],
            [
                47504,
                "Bling got me chill, 'cause im"
            ],
            [
                48915,
                "living in an icebox"
            ],
            [
                50551,
                "They tell me I've been sleepin"
            ],
            [
                51669,
                "I say im wide awake"
            ],
            [
                52885,
                "Tracks hot and ready so they,"
            ],
            [
                54230,
                "call me Mr. Easy-Bake"
            ],
            [
                55574,
                "They say the grass is greener,"
            ],
            [
                56962,
                "I think my grass is dank"
            ],
            [
                58122,
                "Drivin' with a drank on an"
            ],
            [
                59514,
                "empty tank to the bank"
            ],
            [
                61220,
                "Do you feel me? Take a look,"
            ],
            [
                62413,
                "inside my brain"
            ],
            [
                63644,
                "The people always different,"
            ],
            [
                64569,
                "but it always feels the same"
            ],
            [
                66009,
                "That's the real me, pop the"
            ],
            [
                67614,
                "champagne"
            ],
            [
                68586,
                "The haters wanna hurt me,"
            ],
            [
                69775,
                "and im laughin' at the pain"
            ],
            [
                72107,
                "Stayin' still, eyes closed"
            ],
            [
                74235,
                "Let the world just pass me by,"
            ],
            [
                77245,
                "Pain pills, nice clothes"
            ],
            [
                79611,
                "If I fall, I think I'll fly"
            ],
            [
                82366,
                "Touch me, Midas"
            ],
            [
                84691,
                "Make me part of your design"
            ],
            [
                87629,
                "None to, guide us"
            ],
            [
                89943,
                "I feel fear"
            ],
            [
                91005,
                "for the very last time"
            ],
            [
                114272,
                "They tell me that im special,"
            ],
            [
                115274,
                "I smile and shake my head"
            ],
            [
                116527,
                "I'll give them stories to tell,"
            ],
            [
                117793,
                "friends bout the things I said"
            ],
            [
                119228,
                "They tell me im so humble,"
            ],
            [
                120424,
                "I say im turning red"
            ],
            [
                121833,
                "They let me lie to them"
            ],
            [
                122856,
                "and dont feel like"
            ],
            [
                123662,
                "they've been misled"
            ],
            [
                124661,
                "They give so much to me,"
            ],
            [
                125733,
                "Im losing touch, get me?"
            ],
            [
                127113,
                "Served on a silver platter,"
            ],
            [
                128150,
                "ask for seconds,"
            ],
            [
                129043,
                "they just let me"
            ],
            [
                129909,
                "They tell me im a god,"
            ],
            [
                131044,
                "Im lost in the facade"
            ],
            [
                132378,
                "Six feet off the ground at all"
            ],
            [
                133453,
                "times, I think im feelin' odd"
            ],
            [
                135203,
                "No matter what I make,"
            ],
            [
                136306,
                "they never see mistakes"
            ],
            [
                137493,
                "Makin' so much bread,"
            ],
            [
                138562,
                "I don't care that"
            ],
            [
                139300,
                "they're just fake"
            ],
            [
                140468,
                "They tell me they're below me,"
            ],
            [
                141579,
                "I act like im above"
            ],
            [
                142638,
                "The people blend together,"
            ],
            [
                143686,
                "but I'd be lost"
            ],
            [
                144496,
                "without their love"
            ],
            [
                145775,
                "Can you heal me?"
            ],
            [
                146578,
                "Have I gained too much?"
            ],
            [
                148125,
                "When you become untouchable,"
            ],
            [
                149228,
                "you're unable to touch"
            ],
            [
                150882,
                "Is there a real me?"
            ],
            [
                151910,
                "Pop the champagne"
            ],
            [
                153164,
                "It hurts me just to think,"
            ],
            [
                154310,
                "and I don't do pain"
            ],
            [
                156397,
                "Stayin' still, eyes closed,"
            ],
            [
                158726,
                "Let the world just pass me by"
            ],
            [
                161741,
                "Pain pills, nice clothes,"
            ],
            [
                164232,
                "If I fall, I think I'll fly"
            ],
            [
                167202,
                "Touch me, Midas,"
            ],
            [
                169509,
                "Make me part of your design,"
            ],
            [
                172527,
                "None to guide us,"
            ],
            [
                174481,
                "I feel fear"
            ],
            [
                175555,
                "for the very last time"
            ],
            [
                177913,
                "Lay still, restless,"
            ],
            [
                180073,
                "Losing sleep while"
            ],
            [
                181003,
                "I lose my mind"
            ],
            [
                182800,
                "All thrill, no stress,"
            ],
            [
                185234,
                "All my muses left behind"
            ],
            [
                188339,
                "World is below,"
            ],
            [
                190847,
                "So high up, im near-divine"
            ],
            [
                193805,
                "Lean in, let go,"
            ],
            [
                195774,
                "I feel fear"
            ],
            [
                196752,
                "for the very last time"
            ]
        ]
    },
    {
        "name": "Ed Sheeran - Shape Of You",
        "lyrics": [
            [
                9932,
                "The club isn't the"
            ],
            [
                10541,
                "best place to find a lover"
            ],
            [
                11993,
                "So the bar is where I go"
            ],
            [
                14804,
                "Me and my friends at"
            ],
            [
                15739,
                "the table doing shots"
            ],
            [
                16766,
                "Drinking fast and then"
            ],
            [
                17807,
                "we talk slow"
            ],
            [
                19811,
                "Come over and start up"
            ],
            [
                20705,
                "a conversation with just me"
            ],
            [
                22328,
                "And trust me I'll"
            ],
            [
                23023,
                "give it a chance now"
            ],
            [
                24491,
                "Take my hand, stop,"
            ],
            [
                25571,
                "put Van the Man on the jukebox"
            ],
            [
                27131,
                "And then we start to dance,"
            ],
            [
                28640,
                "and now I'm singing like"
            ],
            [
                29671,
                "Girl, you know"
            ],
            [
                30587,
                "I want your love"
            ],
            [
                32163,
                "Your love was handmade"
            ],
            [
                33297,
                "for somebody like me"
            ],
            [
                35444,
                "Come on now, follow my lead"
            ],
            [
                37227,
                "I may be crazy, don't mind me"
            ],
            [
                39364,
                "Say, boy, let's"
            ],
            [
                40271,
                "not talk too much"
            ],
            [
                42178,
                "Grab on my waist"
            ],
            [
                43064,
                "and put that body on me"
            ],
            [
                45319,
                "Come on now, follow my lead"
            ],
            [
                46864,
                "Come, come on now,"
            ],
            [
                47705,
                "follow my lead"
            ],
            [
                50638,
                "I'm in love with"
            ],
            [
                51332,
                "the shape of you"
            ],
            [
                53147,
                "We push and pull"
            ],
            [
                53804,
                "like a magnet do"
            ],
            [
                55774,
                "Although my heart"
            ],
            [
                56427,
                "is falling too"
            ],
            [
                58193,
                "I'm in love with your body"
            ],
            [
                60855,
                "And last night you"
            ],
            [
                61509,
                "were in my room"
            ],
            [
                63160,
                "And now my bedsheets"
            ],
            [
                63980,
                "smell like you"
            ],
            [
                65010,
                "Every day discovering"
            ],
            [
                66300,
                "something brand new"
            ],
            [
                68273,
                "I'm in love with your body"
            ],
            [
                69772,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                73218,
                "I'm in love with your body"
            ],
            [
                74974,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                78230,
                "I'm in love with your body"
            ],
            [
                79674,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                83028,
                "I'm in love with your body"
            ],
            [
                84677,
                "Every day discovering"
            ],
            [
                86248,
                "something brand new"
            ],
            [
                88183,
                "I'm in love with"
            ],
            [
                88814,
                "the shape of you"
            ],
            [
                89967,
                "One week in we"
            ],
            [
                90565,
                "let the story begin"
            ],
            [
                91774,
                "We're going out"
            ],
            [
                92392,
                "on our first date"
            ],
            [
                94690,
                "You and me are thrifty,"
            ],
            [
                95593,
                "so go all you can eat"
            ],
            [
                96776,
                "Fill up your bag"
            ],
            [
                97458,
                "and I fill up a plate"
            ],
            [
                99660,
                "We talk for hours and hours"
            ],
            [
                100463,
                "about the sweet and the sour"
            ],
            [
                101779,
                "And how your family"
            ],
            [
                102662,
                "is doing okay"
            ],
            [
                104709,
                "And leave and get in a taxi,"
            ],
            [
                105975,
                "then kiss in the backseat"
            ],
            [
                106839,
                "Tell the driver make the"
            ],
            [
                107909,
                "radio play, and"
            ],
            [
                109024,
                "I'm singing like"
            ],
            [
                109725,
                "Girl, you know"
            ],
            [
                110586,
                "I want your love"
            ],
            [
                112019,
                "Your love was handmade"
            ],
            [
                113299,
                "for somebody like me"
            ],
            [
                115514,
                "Come on now, follow my lead"
            ],
            [
                117395,
                "I may be crazy, don't mind me"
            ],
            [
                119499,
                "Say, boy, let's"
            ],
            [
                120864,
                "not talk too much"
            ],
            [
                122263,
                "Grab on my waist"
            ],
            [
                123225,
                "and put that body on me"
            ],
            [
                125389,
                "Come on now, follow my lead"
            ],
            [
                126886,
                "Come, come on now,"
            ],
            [
                127821,
                "follow my lead"
            ],
            [
                130575,
                "I'm in love with"
            ],
            [
                131312,
                "the shape of you"
            ],
            [
                133136,
                "We push and pull"
            ],
            [
                133753,
                "like a magnet do"
            ],
            [
                135717,
                "Although my heart"
            ],
            [
                136380,
                "is falling too"
            ],
            [
                138181,
                "I'm in love with your body"
            ],
            [
                140628,
                "And last night you"
            ],
            [
                141395,
                "were in my room"
            ],
            [
                143346,
                "And now my bedsheets"
            ],
            [
                144070,
                "smell like you"
            ],
            [
                145073,
                "Every day discovering"
            ],
            [
                146211,
                "something brand new"
            ],
            [
                148114,
                "I'm in love with your body"
            ],
            [
                149872,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                153305,
                "I'm in love with your body"
            ],
            [
                154800,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                158180,
                "I'm in love with your body"
            ],
            [
                159848,
                "(Oh-I-oh-I-oh-I-oh-I)"
            ],
            [
                163093,
                "I'm in love with your body"
            ],
            [
                165173,
                "Every day discovering"
            ],
            [
                166183,
                "something brand new"
            ],
            [
                168162,
                "I'm in love with"
            ],
            [
                168991,
                "the shape of you"
            ],
            [
                170090,
                "Come on, be my baby,"
            ],
            [
                171685,
                "come on"
            ],
            [
                172656,
                "Come on, be my baby,"
            ],
            [
                174142,
                "come on"
            ],
            [
                175123,
                "Come on, be my baby"
            ],
            [
                176592,
                "come on"
            ],
            [
                177579,
                "Come on, be my baby,"
            ],
            [
                179150,
                "come on"
            ],
            [
                180284,
                "Come on, be my baby,"
            ],
            [
                181486,
                "come on"
            ],
            [
                182483,
                "Come on, be my baby,"
            ],
            [
                184108,
                "come on"
            ],
            [
                185069,
                "Come on, be my baby,"
            ],
            [
                186558,
                "come on"
            ],
            [
                187570,
                "Come on, be my baby,"
            ],
            [
                189135,
                "come on"
            ],
            [
                190619,
                "I'm in love with"
            ],
            [
                191341,
                "the shape of you"
            ],
            [
                193197,
                "We push and pull"
            ],
            [
                193858,
                "like a magnet do"
            ],
            [
                195714,
                "Although my heart"
            ],
            [
                196391,
                "is falling too"
            ],
            [
                198208,
                "I'm in love with your body"
            ],
            [
                200686,
                "And last night you"
            ],
            [
                201398,
                "were in my room"
            ],
            [
                203141,
                "And now my bedsheets"
            ],
            [
                204049,
                "smell like you"
            ],
            [
                205060,
                "Every day discovering"
            ],
            [
                206256,
                "something brand new"
            ],
            [
                208147,
                "I'm in love with your body"
            ],
            [
                210279,
                "Come on, be my baby,"
            ],
            [
                211970,
                "come on"
            ],
            [
                212900,
                "Come on"
            ],
            [
                213513,
                "(I'm in love with your body),"
            ],
            [
                213514,
                "be my baby, come on"
            ],
            [
                215542,
                "Come on, be my baby, come on"
            ],
            [
                216636,
                "Come on"
            ],
            [
                218500,
                "(I'm in love with your body),"
            ],
            [
                218501,
                "be my baby, come on"
            ],
            [
                220481,
                "Come on, be my baby,"
            ],
            [
                221900,
                "come on"
            ],
            [
                222624,
                "Come on, be my baby,"
            ],
            [
                223420,
                "(I'm in love with your body),"
            ],
            [
                223421,
                "come on"
            ],
            [
                225305,
                "Every day discovering"
            ],
            [
                226240,
                "something brand new"
            ],
            [
                228190,
                "I'm in love with"
            ],
            [
                228817,
                "the shape of you"
            ]
        ]
    },
    {
        "name": "Powfu - Death Bed",
        "lyrics": [
            [
                100,
                "Don't stay awake for too long"
            ],
            [
                3191,
                "Don't go to bed"
            ],
            [
                5514,
                "I'll make a cup of coffee"
            ],
            [
                7158,
                "for your head"
            ],
            [
                8867,
                "I'll get you up and going"
            ],
            [
                10537,
                "out of bed"
            ],
            [
                12069,
                "Yeah, I dont wanna fall asleep"
            ],
            [
                14395,
                "I don't wanna pass away"
            ],
            [
                16132,
                "I've been thinking"
            ],
            [
                16964,
                "of our future"
            ],
            [
                17819,
                "Cause Ill never see those days"
            ],
            [
                19581,
                "I don't know why"
            ],
            [
                20300,
                "this has happened,"
            ],
            [
                21169,
                "but I probably deserve it"
            ],
            [
                22700,
                "I tried to do my best,"
            ],
            [
                24216,
                "but you know that"
            ],
            [
                25214,
                "I'm not perfect"
            ],
            [
                26354,
                "I've been praying"
            ],
            [
                27097,
                "for forgiveness,"
            ],
            [
                27931,
                "you've been praying"
            ],
            [
                28628,
                "for my health"
            ],
            [
                29500,
                "When I leave this earth,"
            ],
            [
                30829,
                "hoping youll find someone else"
            ],
            [
                32706,
                "Cause, yeah, were still young,"
            ],
            [
                34232,
                "theres so much we haven't done"
            ],
            [
                36175,
                "Getting married,"
            ],
            [
                36843,
                "start a family,"
            ],
            [
                37767,
                "watch your husband"
            ],
            [
                38491,
                "with his son"
            ],
            [
                39544,
                "I wish it could be me,"
            ],
            [
                41012,
                "but I wont make it of this bed"
            ],
            [
                42648,
                "I hope I go to heaven,"
            ],
            [
                44284,
                "so I see you once again"
            ],
            [
                46446,
                "My life was kindda short,"
            ],
            [
                47660,
                "but I got so many blessings"
            ],
            [
                49825,
                "Happy you were mine,"
            ],
            [
                50969,
                "it sucks that it's all ending"
            ],
            [
                53399,
                "Don't stay awake for too long"
            ],
            [
                56507,
                "Don't go to bed"
            ],
            [
                58893,
                "I'll make a cup of coffee"
            ],
            [
                60529,
                "for your head"
            ],
            [
                62299,
                "I'll get you up and going"
            ],
            [
                63875,
                "out of bed, yeah"
            ],
            [
                65864,
                "And I,"
            ],
            [
                66474,
                "don't stay awake for too long"
            ],
            [
                69795,
                "Don't go to bed"
            ],
            [
                72103,
                "I'll make a cup of coffee"
            ],
            [
                73890,
                "for your head"
            ],
            [
                75499,
                "I'll get you up and going"
            ],
            [
                77154,
                "out of bed"
            ],
            [
                78552,
                "Yeah, I'm happy that"
            ],
            [
                80279,
                "you're here with me"
            ],
            [
                81416,
                "I'm sorry if I tear up"
            ],
            [
                83000,
                "When me and you were younger,"
            ],
            [
                84263,
                "you would always"
            ],
            [
                85100,
                "make me cheer up"
            ],
            [
                86359,
                "Taking goofy videos while"
            ],
            [
                87889,
                "walking through the park"
            ],
            [
                89320,
                "You would jump into my arms"
            ],
            [
                90772,
                "every time you heard a bark"
            ],
            [
                93127,
                "Cuddle in your sheets,"
            ],
            [
                94430,
                "sang me sound asleep"
            ],
            [
                96396,
                "And sneak out through"
            ],
            [
                97304,
                "your kitchen at exactly 1:03"
            ],
            [
                99767,
                "Sundays went to church,"
            ],
            [
                101567,
                "on Mondays watched a movie"
            ],
            [
                103081,
                "Soon you'll be alone,"
            ],
            [
                104556,
                "sorry that you have to lose me"
            ],
            [
                106457,
                "Don't stay awake for too long"
            ],
            [
                109810,
                "Don't go to bed"
            ],
            [
                112102,
                "I'll make a cup of coffee"
            ],
            [
                113983,
                "for your head"
            ],
            [
                115647,
                "I'll get you up and going"
            ],
            [
                117188,
                "out of bed"
            ],
            [
                118721,
                "And I,"
            ],
            [
                119877,
                "don't stay awake for too long"
            ],
            [
                123213,
                "Don't go to bed"
            ],
            [
                125613,
                "I'll make a cup of coffee"
            ],
            [
                127141,
                "for your head"
            ],
            [
                128934,
                "I'll get you up and going"
            ],
            [
                130436,
                "out of bed"
            ],
            [
                133392,
                "Don't stay awake for too long"
            ],
            [
                136507,
                "Don't go to bed"
            ],
            [
                138850,
                "I'll make a cup of coffee"
            ],
            [
                140560,
                "for your head"
            ],
            [
                142240,
                "I'll get you up and going"
            ],
            [
                143810,
                "out of bed"
            ],
            [
                145553,
                "And I,"
            ],
            [
                146501,
                "don't stay awake for too long"
            ],
            [
                149780,
                "Don't go to bed"
            ],
            [
                152281,
                "I'll make a cup of coffee"
            ],
            [
                154200,
                "for your head"
            ],
            [
                155540,
                "I'll get you up and going"
            ],
            [
                157185,
                "out of bed"
            ],
            [
                158938,
                "And I,"
            ],
            [
                159877,
                "don't stay awake for too long"
            ],
            [
                163084,
                "Don't go to bed"
            ],
            [
                165483,
                "I'll make a cup of coffee"
            ],
            [
                167378,
                "for your head"
            ],
            [
                168826,
                "I'll get you up and going"
            ],
            [
                170323,
                "out of bed"
            ]
        ]
    },
    {
        "name": "Marina - Bubblegum Bitch",
        "lyrics": [
            [
                14000,
                "I've got a figure"
            ],
            [
                14710,
                "like a pin-up"
            ],
            [
                15803,
                "Got a figure like a doll"
            ],
            [
                17428,
                "Don't care if you"
            ],
            [
                18091,
                "think I'm dumb"
            ],
            [
                18948,
                "I don't care at all"
            ],
            [
                20369,
                "Candy bear, sweetie pie"
            ],
            [
                21912,
                "I wanna be adored"
            ],
            [
                23489,
                "I'm the girl you'd die for"
            ],
            [
                26797,
                "I'll chew you up and"
            ],
            [
                28353,
                "I'll spit you out"
            ],
            [
                29885,
                "'Cause that's what young love"
            ],
            [
                31243,
                "is all about"
            ],
            [
                32897,
                "So pull me closer"
            ],
            [
                34457,
                "and kiss me hard"
            ],
            [
                35823,
                "I'm gonna pop your"
            ],
            [
                37003,
                "bubblegum heart"
            ],
            [
                38684,
                "I'm Miss Sugar Pink,"
            ],
            [
                40104,
                "liquor, liquor lips"
            ],
            [
                41614,
                "Hit me with your sweet love"
            ],
            [
                43110,
                "Steal me with a kiss"
            ],
            [
                44756,
                "I'm Miss Sugar Pink,"
            ],
            [
                46175,
                "liquor, liquor lips"
            ],
            [
                47645,
                "I'm gonna be your"
            ],
            [
                49368,
                "bubblegum Bitch"
            ],
            [
                50850,
                "I'm gonna be your"
            ],
            [
                52241,
                "bubblegum Bitch"
            ],
            [
                60048,
                "Queentex, latex,"
            ],
            [
                61433,
                "I'm your wonder maid"
            ],
            [
                62908,
                "Life gave me some lemons,"
            ],
            [
                64119,
                "so I made some lemonade"
            ],
            [
                66088,
                "Soda pop, soda pop,"
            ],
            [
                67439,
                "baby here I come"
            ],
            [
                68992,
                "Straight to number one"
            ],
            [
                72315,
                "Oh, Dear diary, I met a boy"
            ],
            [
                75314,
                "He made my doll heart"
            ],
            [
                76714,
                "light up with joy"
            ],
            [
                78347,
                "Oh, Dear diary, we fell apart"
            ],
            [
                81224,
                "Welcome to the life"
            ],
            [
                82184,
                "of Electra Heart"
            ],
            [
                84233,
                "I'm Miss Sugar Pink,"
            ],
            [
                85724,
                "liquor, liquor lips"
            ],
            [
                87192,
                "Hit me with your sweet love"
            ],
            [
                88753,
                "Steal me with a kiss"
            ],
            [
                90297,
                "I'm Miss Sugar Pink,"
            ],
            [
                91787,
                "liquor, liquor lips"
            ],
            [
                93254,
                "I'm gonna be your"
            ],
            [
                94813,
                "bubblegum Bitch"
            ],
            [
                96370,
                "I'm gonna be your"
            ],
            [
                97863,
                "bubblegum Bitch"
            ],
            [
                99490,
                "I think I want your-,"
            ],
            [
                101317,
                "your American tan"
            ],
            [
                104129,
                "Oh, oh, oh"
            ],
            [
                105700,
                "I think you're gonna"
            ],
            [
                107266,
                "be my biggest fan"
            ],
            [
                110427,
                "Oh, oh, oh"
            ],
            [
                123868,
                "I'm Miss Sugar Pink,"
            ],
            [
                125300,
                "liquor, liquor lips"
            ],
            [
                126826,
                "Hit me with your sweet love"
            ],
            [
                128235,
                "Steal me with a kiss"
            ],
            [
                129795,
                "I'm Miss Sugar Pink,"
            ],
            [
                131218,
                "liquor, liquor lips"
            ],
            [
                132789,
                "I'm gonna be your"
            ],
            [
                134310,
                "bubblegum Bitch"
            ],
            [
                135910,
                "I'm gonna be your"
            ],
            [
                137327,
                "bubblegum Bitch"
            ],
            [
                139100,
                "I'm Miss Sugar Pink,"
            ],
            [
                140388,
                "liquor, liquor lips"
            ],
            [
                142042,
                "Hit me with your sweet love"
            ],
            [
                143344,
                "Steal me with a kiss"
            ],
            [
                145000,
                "I'm Miss Sugar Pink,"
            ],
            [
                146309,
                "liquor, liquor lips"
            ],
            [
                147998,
                "I'm gonna be your"
            ],
            [
                149525,
                "bubblegum Bitch"
            ],
            [
                151000,
                "I'm gonna be your"
            ],
            [
                152518,
                "bubblegum Bitch"
            ]
        ]
    },
    {
        "name": "Nyan Cat!",
        "lyrics": [
            [
                8822,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                9502,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                10182,
                "nyan nyan nyan nyan nyan"
            ],
            [
                10862,
                "nyan nyan nyan nyan"
            ],
            [
                11542,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                12222,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                12902,
                "nyan nyan nyan nyan nyan"
            ],
            [
                13582,
                "nyan nyan nyan nyan"
            ],
            [
                14262,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                14942,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                15622,
                "nyan nyan nyan nyan nyan"
            ],
            [
                16302,
                "nyan nyan nyan nyan"
            ],
            [
                16982,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                17662,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                18342,
                "nyan nyan nyan nyan nyan"
            ],
            [
                19022,
                "nyan nyan nyan nyan"
            ],
            [
                19702,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                20382,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                21062,
                "nyan nyan nyan nyan nyan"
            ],
            [
                21742,
                "nyan nyan nyan nyan"
            ],
            [
                22422,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                23102,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                23782,
                "nyan nyan nyan nyan nyan"
            ],
            [
                24462,
                "nyan nyan nyan nyan"
            ],
            [
                25142,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                25822,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                26502,
                "nyan nyan nyan nyan nyan"
            ],
            [
                27182,
                "nyan nyan nyan nyan"
            ],
            [
                27862,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                28542,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                29222,
                "nyan nyan nyan nyan nyan"
            ],
            [
                29902,
                "nyan nyan nyan nyan"
            ],
            [
                30582,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                31262,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                31942,
                "nyan nyan nyan nyan nyan"
            ],
            [
                32622,
                "nyan nyan nyan nyan"
            ],
            [
                33302,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                33982,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                34662,
                "nyan nyan nyan nyan nyan"
            ],
            [
                35342,
                "nyan nyan nyan nyan"
            ],
            [
                36022,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                36702,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                37382,
                "nyan nyan nyan nyan nyan"
            ],
            [
                38062,
                "nyan nyan nyan nyan"
            ],
            [
                38742,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                39422,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                40102,
                "nyan nyan nyan nyan nyan"
            ],
            [
                40782,
                "nyan nyan nyan nyan"
            ],
            [
                41462,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                42142,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                42822,
                "nyan nyan nyan nyan nyan"
            ],
            [
                43502,
                "nyan nyan nyan nyan"
            ],
            [
                44182,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                44862,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                45542,
                "nyan nyan nyan nyan nyan"
            ],
            [
                46222,
                "nyan nyan nyan nyan"
            ],
            [
                46902,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                47582,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                48262,
                "nyan nyan nyan nyan nyan"
            ],
            [
                48942,
                "nyan nyan nyan nyan"
            ],
            [
                49622,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                50302,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                50982,
                "nyan nyan nyan nyan nyan"
            ],
            [
                51662,
                "nyan nyan nyan nyan"
            ],
            [
                52342,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                53022,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                53702,
                "nyan nyan nyan nyan nyan"
            ],
            [
                54382,
                "nyan nyan nyan nyan"
            ],
            [
                55062,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                55742,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                56422,
                "nyan nyan nyan nyan nyan"
            ],
            [
                57102,
                "nyan nyan nyan nyan"
            ],
            [
                57782,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                58462,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                59142,
                "nyan nyan nyan nyan nyan"
            ],
            [
                59822,
                "nyan nyan nyan nyan"
            ],
            [
                60502,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                61182,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                61862,
                "nyan nyan nyan nyan nyan"
            ],
            [
                62542,
                "nyan nyan nyan nyan"
            ],
            [
                63222,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                63902,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                64582,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                65262,
                "nyan nyan nyan Nyan nyan nyan"
            ],
            [
                65942,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                66622,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                67302,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                67982,
                "nyan nyan nyan nyan"
            ],
            [
                68662,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                69342,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                70022,
                "nyan nyan nyan nyan nyan"
            ],
            [
                70702,
                "nyan nyan nyan nyan"
            ],
            [
                71382,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                72062,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                72742,
                "nyan nyan nyan nyan nyan"
            ],
            [
                73422,
                "nyan nyan nyan nyan"
            ],
            [
                74102,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                74782,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                75462,
                "nyan nyan nyan nyan nyan"
            ],
            [
                76142,
                "nyan nyan nyan nyan"
            ],
            [
                76822,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                77502,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                78182,
                "nyan nyan nyan nyan nyan"
            ],
            [
                78862,
                "nyan nyan nyan nyan"
            ],
            [
                79542,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                80222,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                80902,
                "nyan nyan nyan nyan nyan"
            ],
            [
                81582,
                "nyan nyan nyan nyan"
            ],
            [
                82262,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                82942,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                83622,
                "nyan nyan nyan nyan nyan"
            ],
            [
                84302,
                "nyan nyan nyan nyan"
            ],
            [
                84982,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                85662,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                86342,
                "nyan nyan nyan nyan nyan"
            ],
            [
                87022,
                "nyan nyan nyan nyan"
            ],
            [
                87702,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                88382,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                89062,
                "nyan nyan nyan nyan nyan"
            ],
            [
                89742,
                "nyan nyan nyan nyan"
            ],
            [
                90422,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                91102,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                91782,
                "nyan nyan nyan nyan nyan"
            ],
            [
                92462,
                "nyan nyan nyan nyan"
            ],
            [
                93142,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                93822,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                94502,
                "nyan nyan nyan nyan nyan"
            ],
            [
                95182,
                "nyan nyan nyan nyan"
            ],
            [
                95862,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                96542,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                97222,
                "nyan nyan nyan nyan nyan"
            ],
            [
                97902,
                "nyan nyan nyan nyan"
            ],
            [
                98582,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                99262,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                99942,
                "nyan nyan nyan nyan nyan"
            ],
            [
                100622,
                "nyan nyan nyan nyan"
            ],
            [
                101302,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                101982,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                102662,
                "nyan nyan nyan nyan nyan"
            ],
            [
                103342,
                "nyan nyan nyan nyan"
            ],
            [
                104022,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                104702,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                105382,
                "nyan nyan nyan nyan nyan"
            ],
            [
                106062,
                "nyan nyan nyan nyan"
            ],
            [
                106742,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                107422,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                108102,
                "nyan nyan nyan nyan nyan"
            ],
            [
                108782,
                "nyan nyan nyan nyan"
            ],
            [
                109462,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                110142,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                110822,
                "nyan nyan nyan nyan nyan"
            ],
            [
                111502,
                "nyan nyan nyan nyan"
            ],
            [
                112182,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                112862,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                113542,
                "nyan nyan nyan nyan nyan"
            ],
            [
                114222,
                "nyan nyan nyan nyan"
            ],
            [
                114902,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                115582,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                116262,
                "nyan nyan nyan nyan nyan"
            ],
            [
                116942,
                "nyan nyan nyan nyan"
            ],
            [
                117622,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                118302,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                118982,
                "nyan nyan nyan nyan nyan"
            ],
            [
                119662,
                "nyan nyan nyan nyan"
            ],
            [
                120342,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                121022,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                121702,
                "nyan nyan nyan nyan nyan"
            ],
            [
                122382,
                "nyan nyan nyan nyan"
            ],
            [
                123062,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                123742,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                124422,
                "nyan nyan nyan nyan nyan"
            ],
            [
                125102,
                "nyan nyan nyan nyan"
            ],
            [
                125782,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                126462,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                127142,
                "nyan nyan nyan nyan nyan"
            ],
            [
                127822,
                "nyan nyan nyan nyan"
            ],
            [
                128502,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                129182,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                129862,
                "nyan nyan nyan nyan nyan"
            ],
            [
                130542,
                "nyan nyan nyan nyan"
            ],
            [
                131222,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                131902,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                132582,
                "nyan nyan nyan nyan nyan"
            ],
            [
                133262,
                "nyan nyan nyan nyan"
            ],
            [
                133942,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                134622,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                135302,
                "nyan nyan nyan nyan nyan"
            ],
            [
                135982,
                "nyan nyan nyan nyan"
            ],
            [
                136662,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                137342,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                138022,
                "nyan nyan nyan nyan nyan"
            ],
            [
                138702,
                "nyan nyan nyan nyan"
            ],
            [
                139382,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                140062,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                140742,
                "nyan nyan nyan nyan nyan"
            ],
            [
                141422,
                "nyan nyan nyan nyan"
            ],
            [
                142102,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                142782,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                143462,
                "nyan nyan nyan nyan nyan"
            ],
            [
                144142,
                "nyan nyan nyan nyan"
            ],
            [
                144822,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                145502,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                146182,
                "nyan nyan nyan nyan nyan"
            ],
            [
                146862,
                "nyan nyan nyan nyan"
            ],
            [
                147542,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                148222,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                148902,
                "nyan nyan nyan nyan nyan"
            ],
            [
                149582,
                "nyan nyan nyan nyan"
            ],
            [
                150262,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                150942,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                151622,
                "nyan nyan nyan nyan nyan"
            ],
            [
                152302,
                "nyan nyan nyan nyan"
            ],
            [
                152982,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                153662,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                154342,
                "nyan nyan nyan nyan nyan"
            ],
            [
                155022,
                "nyan nyan nyan nyan"
            ],
            [
                155702,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                156382,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                157062,
                "nyan nyan nyan nyan nyan"
            ],
            [
                157742,
                "nyan nyan nyan nyan"
            ],
            [
                158422,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                159102,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                159782,
                "nyan nyan nyan nyan nyan"
            ],
            [
                160462,
                "nyan nyan nyan nyan"
            ],
            [
                161142,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                161822,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                162502,
                "nyan nyan nyan nyan nyan"
            ],
            [
                163182,
                "nyan nyan nyan nyan"
            ],
            [
                163862,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                164542,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                165222,
                "nyan nyan nyan nyan nyan"
            ],
            [
                165902,
                "nyan nyan nyan nyan"
            ],
            [
                166582,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                167262,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                167942,
                "nyan nyan nyan nyan nyan"
            ],
            [
                168622,
                "nyan nyan nyan nyan"
            ],
            [
                169302,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                169982,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                170662,
                "nyan nyan nyan nyan nyan"
            ],
            [
                171342,
                "nyan nyan nyan nyan"
            ],
            [
                172022,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                172702,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                173382,
                "nyan nyan nyan nyan nyan"
            ],
            [
                174062,
                "nyan nyan nyan nyan"
            ],
            [
                174742,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                175422,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                176102,
                "nyan nyan nyan nyan nyan"
            ],
            [
                176782,
                "nyan nyan nyan nyan"
            ],
            [
                177462,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                178142,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                178822,
                "nyan nyan nyan nyan nyan"
            ],
            [
                179502,
                "nyan nyan nyan nyan"
            ],
            [
                180182,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                180862,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                181542,
                "nyan nyan nyan nyan nyan"
            ],
            [
                182222,
                "nyan nyan nyan nyan"
            ],
            [
                182902,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                183582,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                184262,
                "nyan nyan nyan nyan nyan"
            ],
            [
                184942,
                "nyan nyan nyan nyan"
            ],
            [
                185622,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                186302,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                186982,
                "nyan nyan nyan nyan nyan"
            ],
            [
                187662,
                "nyan nyan nyan nyan"
            ],
            [
                188342,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                189022,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                189702,
                "nyan nyan nyan nyan nyan"
            ],
            [
                190382,
                "nyan nyan nyan nyan"
            ],
            [
                191062,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                191742,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                192422,
                "nyan nyan nyan nyan nyan"
            ],
            [
                193102,
                "nyan nyan nyan nyan"
            ],
            [
                193782,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                194462,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                195142,
                "nyan nyan nyan nyan nyan"
            ],
            [
                195822,
                "nyan nyan nyan nyan"
            ],
            [
                196502,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                197182,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                197862,
                "nyan nyan nyan nyan nyan"
            ],
            [
                198542,
                "nyan nyan nyan nyan"
            ],
            [
                199222,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                199902,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                200582,
                "nyan nyan nyan nyan nyan"
            ],
            [
                201262,
                "nyan nyan nyan nyan"
            ],
            [
                201942,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                202622,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                203302,
                "nyan nyan nyan nyan nyan"
            ],
            [
                203982,
                "nyan nyan nyan nyan"
            ],
            [
                204662,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                205342,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                206022,
                "nyan nyan nyan nyan nyan"
            ],
            [
                206702,
                "nyan nyan nyan nyan"
            ],
            [
                207382,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                208062,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                208742,
                "nyan nyan nyan nyan nyan"
            ],
            [
                209422,
                "nyan nyan nyan nyan"
            ],
            [
                210102,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                210782,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                211462,
                "nyan nyan nyan nyan nyan"
            ],
            [
                212142,
                "nyan nyan nyan nyan"
            ],
            [
                212822,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                213502,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                214182,
                "nyan nyan nyan nyan nyan"
            ],
            [
                214862,
                "nyan nyan nyan nyan"
            ],
            [
                215542,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                216222,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                216902,
                "nyan nyan nyan nyan nyan"
            ],
            [
                217582,
                "nyan nyan nyan nyan"
            ],
            [
                218262,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                218942,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                219622,
                "nyan nyan nyan nyan nyan"
            ],
            [
                220302,
                "nyan nyan nyan nyan"
            ],
            [
                220982,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                221662,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                222342,
                "nyan nyan nyan nyan nyan"
            ],
            [
                223022,
                "nyan nyan nyan nyan"
            ],
            [
                223702,
                "Nyan nyan nyan nyan nyan nyan"
            ],
            [
                224382,
                "nyan nyan nyan nyan nyan nyan"
            ],
            [
                225062,
                "nyan nyan nyan nyan nyan"
            ]
        ]
    },
    {
        "name": "Olly Murs - That Girl",
        "lyrics": [
            [
                100,
                "There's a girl,"
            ],
            [
                1850,
                "but I let her get away"
            ],
            [
                5603,
                "It's all my fault,"
            ],
            [
                7299,
                "'cause pride got in the way"
            ],
            [
                11100,
                "And I'd be lying if I said,"
            ],
            [
                13670,
                "I was okay"
            ],
            [
                16302,
                "About that girl,"
            ],
            [
                18048,
                "the one I let get away"
            ],
            [
                21405,
                "I keep saying no"
            ],
            [
                23774,
                "This can't be the way"
            ],
            [
                24647,
                "it was supposed to be"
            ],
            [
                26511,
                "I keep saying no"
            ],
            [
                29001,
                "There's gotta be a way"
            ],
            [
                30008,
                "to get you close to me"
            ],
            [
                32506,
                "Now I know, you gotta speak up"
            ],
            [
                34169,
                "if you want somebody"
            ],
            [
                36250,
                "Can't let them get away, oh no"
            ],
            [
                38961,
                "You don't wanna end up sorry"
            ],
            [
                41714,
                "The way that I'm feeling"
            ],
            [
                42544,
                "every day"
            ],
            [
                44444,
                "No, no, no, no"
            ],
            [
                47076,
                "There's no hope for"
            ],
            [
                47869,
                "the broken heart"
            ],
            [
                49300,
                "(Don't you know?)"
            ],
            [
                50000,
                "No, no, no, no"
            ],
            [
                52214,
                "There's no hope for the broken"
            ],
            [
                54400,
                "There's a girl,"
            ],
            [
                55700,
                "but I let her get away"
            ],
            [
                59477,
                "It's my fault,"
            ],
            [
                61223,
                "'cause I said I needed space"
            ],
            [
                64729,
                "And I've been torturing myself"
            ],
            [
                67693,
                "night and day"
            ],
            [
                70212,
                "About that girl,"
            ],
            [
                72038,
                "the one I let get away"
            ],
            [
                74945,
                "I keep saying no"
            ],
            [
                77514,
                "This can't be the way"
            ],
            [
                78598,
                "it was supposed to be"
            ],
            [
                80422,
                "I keep saying no"
            ],
            [
                83000,
                "There's gotta be"
            ],
            [
                83869,
                "a way to get you,"
            ],
            [
                84582,
                "gotta be a way to"
            ],
            [
                85569,
                "get you close to me"
            ],
            [
                86872,
                "You gotta speak up"
            ],
            [
                87956,
                "if you want somebody"
            ],
            [
                90131,
                "Can't let them get away, oh no"
            ],
            [
                92873,
                "You don't wanna end up sorry"
            ],
            [
                95511,
                "The way that I'm feeling"
            ],
            [
                96483,
                "every day"
            ],
            [
                98400,
                "No, no, no, no"
            ],
            [
                101013,
                "There's no hope for"
            ],
            [
                101869,
                "the broken heart"
            ],
            [
                103078,
                "(Don't you know?)"
            ],
            [
                103720,
                "No, no, no, no"
            ],
            [
                106231,
                "There's no hope for the broken"
            ],
            [
                109167,
                "No hope for me (no)"
            ],
            [
                111647,
                "No hope 'cause I'm broken"
            ],
            [
                114509,
                "No room to breathe (no)"
            ],
            [
                116899,
                "And I got no one to blame"
            ],
            [
                119836,
                "No home for me (no)"
            ],
            [
                122369,
                "No home 'cause I'm broken"
            ],
            [
                124458,
                "About that girl,"
            ],
            [
                125800,
                "the one I let get away"
            ],
            [
                129316,
                "So, you better speak up"
            ],
            [
                131969,
                "if you want somebody"
            ],
            [
                133349,
                "You can't let them get away,"
            ],
            [
                134900,
                "oh no, no"
            ],
            [
                136002,
                "You don't wanna end up sorry"
            ],
            [
                138300,
                "(oh, no)"
            ],
            [
                138800,
                "The way that I'm feeling"
            ],
            [
                139649,
                "every day"
            ],
            [
                141569,
                "No, no, no, no"
            ],
            [
                144076,
                "There's no home for"
            ],
            [
                145185,
                "the broken heart"
            ],
            [
                146333,
                "(Don't you know?)"
            ],
            [
                147000,
                "No, no, no, no"
            ],
            [
                149338,
                "There's no home for the broken"
            ],
            [
                151377,
                "Oh, you don't wanna"
            ],
            [
                153224,
                "lose that love"
            ],
            [
                154507,
                "It's only gonna hurt too much"
            ],
            [
                156406,
                "(I'm telling you)"
            ],
            [
                157600,
                "you don't wanna lose that love"
            ],
            [
                159880,
                "It's only gonna hurt too much"
            ],
            [
                161876,
                "(I'm telling you)"
            ],
            [
                162189,
                "you don't wanna lose that love"
            ],
            [
                165335,
                "'Cause there's no home"
            ],
            [
                166294,
                "for the broken"
            ],
            [
                167479,
                "About that girl,"
            ],
            [
                169222,
                "the one I let get away"
            ]
        ]
    },
    {
        "name": "Lil Nax X - Industry Baby",
        "lyrics": [
            [
                4596,
                "D-D-Daytrip took it to ten"
            ],
            [
                5869,
                "(hey!)"
            ],
            [
                6764,
                "Baby back, ayy,"
            ],
            [
                8203,
                "couple racks, ayy"
            ],
            [
                9792,
                "Couple Grammys on him"
            ],
            [
                11426,
                "Couple plaques, ayy"
            ],
            [
                13125,
                "That's a fact, ayy"
            ],
            [
                14795,
                "Throw it back, ayy,"
            ],
            [
                16246,
                "throw it back, ayy"
            ],
            [
                17876,
                "And this one is"
            ],
            [
                18712,
                "for the champions"
            ],
            [
                21139,
                "I ain't lost since I began,"
            ],
            [
                23400,
                "yeah"
            ],
            [
                24000,
                "Funny how you said it"
            ],
            [
                24880,
                "was the end, yeah"
            ],
            [
                27360,
                "Then I went did it again, yeah"
            ],
            [
                30624,
                "I told you long ago"
            ],
            [
                32965,
                "on the road"
            ],
            [
                34156,
                "I got what they waiting for"
            ],
            [
                36994,
                "I don't run from nothing, dawg"
            ],
            [
                39463,
                "Get your soldiers,"
            ],
            [
                40686,
                "tell 'em I ain't laying low"
            ],
            [
                43555,
                "You was never really"
            ],
            [
                44553,
                "rooting for me anyway"
            ],
            [
                46808,
                "When I'm back up at the top,"
            ],
            [
                48011,
                "I wanna hear you say"
            ],
            [
                49870,
                "He dont run from nothing, dawg"
            ],
            [
                52281,
                "Get your soldiers,"
            ],
            [
                53501,
                "tell em that the break is over"
            ],
            [
                56079,
                "(uh)"
            ],
            [
                56300,
                "Need to, uh,"
            ],
            [
                57200,
                "need to get this album done"
            ],
            [
                58537,
                "Need a couple number ones"
            ],
            [
                60113,
                "Need a plaque on every song"
            ],
            [
                61816,
                "Need me like one"
            ],
            [
                62574,
                "with Nicki now"
            ],
            [
                63406,
                "Tell a rap Nigga"
            ],
            [
                64142,
                "I don't see ya (hah)"
            ],
            [
                64968,
                "I'm a pop Nigga"
            ],
            [
                65685,
                "like Bieber (hah)"
            ],
            [
                66548,
                "I don't fuck bitches,"
            ],
            [
                67286,
                "I'm queer (hah)"
            ],
            [
                68160,
                "But these niggas"
            ],
            [
                68780,
                "Bitches like Madea,"
            ],
            [
                69367,
                "yeah, yeah, yeah, ayy"
            ],
            [
                71580,
                "Oh, let do it"
            ],
            [
                73089,
                "I ain't fall off,"
            ],
            [
                73765,
                "I jus aint release my new Shit"
            ],
            [
                76252,
                "I blew up,"
            ],
            [
                76887,
                "now everybody tryna sue me"
            ],
            [
                79368,
                "You call me Nas,"
            ],
            [
                80182,
                "but the hood call me Doobie"
            ],
            [
                82062,
                "And this one is"
            ],
            [
                82700,
                "for the champions"
            ],
            [
                85085,
                "I ain't lost since I began,"
            ],
            [
                87400,
                "yeah"
            ],
            [
                88000,
                "Funny how you said"
            ],
            [
                88767,
                "it was the end, yeah"
            ],
            [
                91362,
                "Then I went did it again, yeah"
            ],
            [
                94618,
                "I told you long ago"
            ],
            [
                96972,
                "on the road"
            ],
            [
                98241,
                "I got what they waiting for"
            ],
            [
                101235,
                "I don't run from nothing, dawg"
            ],
            [
                103400,
                "Get your soldiers,"
            ],
            [
                104592,
                "tell 'em I ain't laying low"
            ],
            [
                107666,
                "You was never really"
            ],
            [
                108696,
                "rooting for me anyway"
            ],
            [
                110213,
                "(ooh, ooh)"
            ],
            [
                110783,
                "When I'm back up at the top,"
            ],
            [
                111949,
                "I wanna hear you say"
            ],
            [
                113300,
                "(ooh, ooh)"
            ],
            [
                113916,
                "He dont run from nothing, dawg"
            ],
            [
                116107,
                "Get your soldiers,"
            ],
            [
                117319,
                "tell em that the break is over"
            ],
            [
                121000,
                "(yeah)"
            ],
            [
                121890,
                "My track record so clean,"
            ],
            [
                123869,
                "they couldn't wait"
            ],
            [
                124644,
                "to just bash me"
            ],
            [
                125479,
                "I must be getting too flashy,"
            ],
            [
                126896,
                "y'all shouldn't have"
            ],
            [
                127525,
                "let the world gas me (woo)"
            ],
            [
                128492,
                "It's too late 'cause"
            ],
            [
                129446,
                "I'm here to stay and"
            ],
            [
                130211,
                "these girls know that Im nasty"
            ],
            [
                131300,
                "(mm)"
            ],
            [
                131900,
                "I sent her back to"
            ],
            [
                132696,
                "her boyfriend with"
            ],
            [
                133284,
                "my handprint on her ass cheek"
            ],
            [
                136308,
                "City talking, we taking notes"
            ],
            [
                137966,
                "Tell 'em all to"
            ],
            [
                138581,
                "keep making posts"
            ],
            [
                139478,
                "Wish he could,"
            ],
            [
                140033,
                "but he can't get close"
            ],
            [
                141049,
                "OG so proud of me that he"
            ],
            [
                142554,
                "choking up while"
            ],
            [
                143487,
                "he making toasts"
            ],
            [
                144463,
                "I'm the type that"
            ],
            [
                145076,
                "you can't control,"
            ],
            [
                145796,
                "said I would then I made it so"
            ],
            [
                147969,
                "I don't clear up rumors (ayy),"
            ],
            [
                149612,
                "where's y'all sense of humor?"
            ],
            [
                150777,
                "(Ayy)"
            ],
            [
                151169,
                "I'm done making jokes 'cause"
            ],
            [
                152300,
                "they got old like baby boomers"
            ],
            [
                153971,
                "Turned my haters to consumers,"
            ],
            [
                155444,
                "I make vets feel"
            ],
            [
                156100,
                "like they juniors (juniors)"
            ],
            [
                156969,
                "Say your time is coming soon,"
            ],
            [
                158497,
                "but just like Oklahoma (mm)"
            ],
            [
                160800,
                "Mine is coming sooner (mm),"
            ],
            [
                162400,
                "I'm just a late bloomer (mm)"
            ],
            [
                164000,
                "I didn't peak in high school,"
            ],
            [
                164985,
                "I'm still out here"
            ],
            [
                165800,
                "getting cuter (woo)"
            ],
            [
                167164,
                "All these social"
            ],
            [
                167767,
                "networks and computers"
            ],
            [
                168965,
                "Got these pussies walking"
            ],
            [
                170169,
                "'round like they ain't losers"
            ],
            [
                171505,
                "I told you long ago"
            ],
            [
                173712,
                "on the road"
            ],
            [
                174991,
                "I got what they waiting for"
            ],
            [
                176700,
                "(I got what they waiting for)"
            ],
            [
                178109,
                "I don't run from nothing, dawg"
            ],
            [
                180227,
                "Get your soldiers,"
            ],
            [
                181498,
                "tell 'em I ain't laying low"
            ],
            [
                184098,
                "You was never really"
            ],
            [
                185307,
                "rooting for me anyway"
            ],
            [
                186666,
                "(ooh, ooh)"
            ],
            [
                187458,
                "When I'm back up at the top,"
            ],
            [
                188718,
                "I wanna hear you say"
            ],
            [
                189696,
                "(ooh, ooh)"
            ],
            [
                190326,
                "He dont run from nothing, dawg"
            ],
            [
                193013,
                "Get your soldiers,"
            ],
            [
                194304,
                "tell em that the break is over"
            ],
            [
                198000,
                "(yeah)"
            ],
            [
                202444,
                "I'm the industry baby, mmm"
            ],
            [
                204555,
                "(yeah)"
            ],
            [
                208888,
                "I'm the industry baby (yeah)"
            ]
        ]
    },
    {
        "name": "Rachie - My R",
        "lyrics": [
            [
                726,
                "Just as I was about"
            ],
            [
                1718,
                "to take my shoes"
            ],
            [
                3397,
                "Off of the rooftop,"
            ],
            [
                4459,
                "there I see"
            ],
            [
                5614,
                "A girl with braided hair"
            ],
            [
                6280,
                "here before me"
            ],
            [
                8003,
                "Despite myself,"
            ],
            [
                8575,
                "I go and scream"
            ],
            [
                10355,
                "Hey, don't do it, please!"
            ],
            [
                21521,
                "Whoa, wait a minute,"
            ],
            [
                22117,
                "what did I just say?"
            ],
            [
                23911,
                "I couldn't care less,"
            ],
            [
                24873,
                "either way"
            ],
            [
                26169,
                "To be honest,"
            ],
            [
                26569,
                "I was somewhat pissed"
            ],
            [
                28400,
                "This was an opportunity missed"
            ],
            [
                30718,
                "The girl with braided hair"
            ],
            [
                31474,
                "told me her woes"
            ],
            [
                32943,
                "You've probably"
            ],
            [
                33581,
                "heard it all before"
            ],
            [
                35222,
                "I really thought that"
            ],
            [
                35837,
                "he might be the one"
            ],
            [
                37462,
                "But then he told me"
            ],
            [
                38630,
                "he was done"
            ],
            [
                39757,
                "For God's sake, please!"
            ],
            [
                41508,
                "Are you serious?"
            ],
            [
                42755,
                "I just can't believe"
            ],
            [
                44095,
                "That for some stupid reason,"
            ],
            [
                45893,
                "you got here before me"
            ],
            [
                48643,
                "Are you upset"
            ],
            [
                50613,
                "'cause you can't have"
            ],
            [
                51663,
                "what you wanted?"
            ],
            [
                53226,
                "You're lucky that you've never"
            ],
            [
                55218,
                "gotten robbed of anything"
            ],
            [
                57953,
                "I'm feeling better,"
            ],
            [
                58696,
                "thank you for listening"
            ],
            [
                60075,
                "The girl with braided hair"
            ],
            [
                61775,
                "then disappeared"
            ],
            [
                67152,
                "Alright, today's the day,"
            ],
            [
                68325,
                "or so I thought"
            ],
            [
                69642,
                "Just as I took both"
            ],
            [
                70510,
                "of my shoes off"
            ],
            [
                71790,
                "There was but a girl,"
            ],
            [
                72587,
                "short as can be"
            ],
            [
                74112,
                "Despite myself,"
            ],
            [
                74828,
                "I go and scream"
            ],
            [
                76370,
                "The petite girl"
            ],
            [
                77224,
                "told me her woes"
            ],
            [
                78625,
                "You've probably"
            ],
            [
                79243,
                "heard it all before"
            ],
            [
                80955,
                "Everyone ignores me,"
            ],
            [
                82075,
                "everyone steals"
            ],
            [
                83262,
                "I dont fit in with anyone here"
            ],
            [
                85529,
                "For God's sake, please!"
            ],
            [
                87343,
                "Are you serious?"
            ],
            [
                88279,
                "I just can't believe"
            ],
            [
                89779,
                "That for some stupid reason"
            ],
            [
                91719,
                "you got here before me"
            ],
            [
                94464,
                "'Cause even so,"
            ],
            [
                96450,
                "you're still loved"
            ],
            [
                97115,
                "by everyone at home"
            ],
            [
                98918,
                "There's always dinner"
            ],
            [
                100325,
                "waiting on the table, you know"
            ],
            [
                103757,
                "I'm hungry, said the girl"
            ],
            [
                104601,
                "as she shed a tear"
            ],
            [
                105627,
                "The girl short as can be"
            ],
            [
                107543,
                "then disappeared"
            ],
            [
                109315,
                "And like that,"
            ],
            [
                110147,
                "there was someone every day"
            ],
            [
                112847,
                "I listened to their tale,"
            ],
            [
                115157,
                "I made them turn away"
            ],
            [
                117385,
                "And yet there was no one"
            ],
            [
                118733,
                "who would do this for me"
            ],
            [
                120713,
                "No way I could"
            ],
            [
                122072,
                "let out all this pain"
            ],
            [
                135795,
                "For the very first time,"
            ],
            [
                136931,
                "there I see"
            ],
            [
                138108,
                "Someone with the"
            ],
            [
                139069,
                "same pains as me"
            ],
            [
                140341,
                "Having done this"
            ],
            [
                141118,
                "time and time again"
            ],
            [
                142617,
                "She wore a yellow cardigan"
            ],
            [
                145025,
                "I just wanna stop the"
            ],
            [
                146098,
                "scars that grow"
            ],
            [
                147311,
                "Every time that I go home"
            ],
            [
                149552,
                "That's why I"
            ],
            [
                150169,
                "came up here instead"
            ],
            [
                151770,
                "That's what the girl"
            ],
            [
                152744,
                "in the cardigan said"
            ],
            [
                154081,
                "Whoa, wait a minute,"
            ],
            [
                154778,
                "what did I just say?"
            ],
            [
                156399,
                "I couldn't care less,"
            ],
            [
                157517,
                "either way"
            ],
            [
                158658,
                "But in the moment"
            ],
            [
                159686,
                "I just screamed"
            ],
            [
                160875,
                "Something that I"
            ],
            [
                161727,
                "could not believe"
            ],
            [
                163286,
                "Hey, don't do it, please!"
            ],
            [
                167744,
                "Ah, what to do?"
            ],
            [
                169493,
                "I can't stop this girl,"
            ],
            [
                170949,
                "oh this is new"
            ],
            [
                172104,
                "For once, I think I've"
            ],
            [
                173527,
                "bitten of more than I can chew"
            ],
            [
                176711,
                "But even so,"
            ],
            [
                178622,
                "please just go away,"
            ],
            [
                180055,
                "so I can't see"
            ],
            [
                181274,
                "Your pitiful expression"
            ],
            [
                183165,
                "is just too much for me"
            ],
            [
                185835,
                "I guess today is"
            ],
            [
                186971,
                "just not my day"
            ],
            [
                188125,
                "She looked away from me"
            ],
            [
                189247,
                "and then she disappeared"
            ],
            [
                192869,
                "There's no one here today,"
            ],
            [
                193800,
                "I guess it's time"
            ],
            [
                195297,
                "It's just me, myself and I"
            ],
            [
                197578,
                "There is no one"
            ],
            [
                198243,
                "who can interfere"
            ],
            [
                199852,
                "No one to get in my way here"
            ],
            [
                202142,
                "Taking off my yellow cardigan"
            ],
            [
                204442,
                "Watching my braids"
            ],
            [
                205400,
                "all come undone"
            ],
            [
                206661,
                "This petite girl,"
            ],
            [
                207265,
                "short as can be"
            ],
            [
                209033,
                "Is gonna jump now and be free"
            ]
        ]
    },
    {
        "name": "OMI - Cheerleader",
        "lyrics": [
            [
                16000,
                "When I need motivation"
            ],
            [
                18499,
                "My one solution is my queen"
            ],
            [
                20823,
                "'Cause she stay strong,"
            ],
            [
                22645,
                "yeah, yeah"
            ],
            [
                23913,
                "She is always in my corner"
            ],
            [
                26010,
                "Right there when I want her"
            ],
            [
                27943,
                "All these other"
            ],
            [
                28976,
                "girls are tempting"
            ],
            [
                29926,
                "But I'm empty when you're gone"
            ],
            [
                31900,
                "And they say"
            ],
            [
                32921,
                "Do you need me?"
            ],
            [
                34785,
                "Do you think I'm pretty?"
            ],
            [
                35994,
                "Do I make you feel"
            ],
            [
                37344,
                "like cheating?"
            ],
            [
                38369,
                "And I'm like no,"
            ],
            [
                39121,
                "not really 'cause"
            ],
            [
                40644,
                "Oh, I think that I found"
            ],
            [
                42981,
                "myself a cheerleader"
            ],
            [
                45346,
                "She is always right there"
            ],
            [
                47033,
                "when I need her"
            ],
            [
                48811,
                "Oh, I think that I found"
            ],
            [
                51063,
                "myself a cheerleader"
            ],
            [
                53371,
                "She is always right there"
            ],
            [
                55216,
                "when I need her"
            ],
            [
                56668,
                "She walks like a model"
            ],
            [
                59222,
                "She grants my wishes"
            ],
            [
                60467,
                "like a genie in a bottle,"
            ],
            [
                63335,
                "yeah, yeah"
            ],
            [
                64427,
                "'Cause I'm the wizard of love"
            ],
            [
                66706,
                "And I got the magic wand"
            ],
            [
                68500,
                "All these other"
            ],
            [
                69659,
                "girls are tempting"
            ],
            [
                70643,
                "But I'm empty when you're gone"
            ],
            [
                72495,
                "And they say"
            ],
            [
                73662,
                "Do you need me?"
            ],
            [
                75256,
                "Do you think I'm pretty?"
            ],
            [
                76798,
                "Do I make you feel"
            ],
            [
                78084,
                "like cheating?"
            ],
            [
                78900,
                "And I'm like no,"
            ],
            [
                79867,
                "not really 'cause"
            ],
            [
                81345,
                "Oh, I think that I found"
            ],
            [
                83703,
                "myself a cheerleader"
            ],
            [
                86008,
                "She is always right there"
            ],
            [
                87626,
                "when I need her"
            ],
            [
                89418,
                "Oh, I think that I found"
            ],
            [
                91696,
                "myself a cheerleader"
            ],
            [
                94047,
                "She is always right there"
            ],
            [
                95740,
                "when I need her"
            ],
            [
                129222,
                "Hmm, she gives me love"
            ],
            [
                130696,
                "and affection,"
            ],
            [
                132352,
                "baby, did I mention?"
            ],
            [
                134354,
                "You're the only girl for me,"
            ],
            [
                136032,
                "no, I don't need a next one"
            ],
            [
                138410,
                "Mama loves you too,"
            ],
            [
                139717,
                "she thinks I made"
            ],
            [
                140544,
                "the right selection"
            ],
            [
                142387,
                "Now all that's left to do"
            ],
            [
                143674,
                "is just for me to"
            ],
            [
                144850,
                "pop the question"
            ],
            [
                146471,
                "Oh, I think that I found"
            ],
            [
                148861,
                "myself a cheerleader"
            ],
            [
                151169,
                "She is always right there"
            ],
            [
                152728,
                "when I need her"
            ],
            [
                154508,
                "Oh, I think that I found"
            ],
            [
                156830,
                "myself a cheerleader"
            ],
            [
                159145,
                "She is always right there"
            ],
            [
                160952,
                "when I need her"
            ]
        ]
    },
    {
        "name": "Yung kai - Blue",
        "lyrics": [
            [
                19318,
                "Your morning eyes,"
            ],
            [
                21690,
                "I could stare"
            ],
            [
                22958,
                "like watching stars"
            ],
            [
                26200,
                "I could walk you by,"
            ],
            [
                29696,
                "and Ill tell without a thought"
            ],
            [
                32416,
                "You'd be mine,"
            ],
            [
                34571,
                "would you mind"
            ],
            [
                36518,
                "if I took your hand tonight?"
            ],
            [
                40574,
                "Know you're all"
            ],
            [
                41864,
                "that I want this life"
            ],
            [
                48134,
                "I'll imagine we fell in love"
            ],
            [
                50879,
                "I'll nap under"
            ],
            [
                51726,
                "moonlight skies with you"
            ],
            [
                54768,
                "I think I'll picture us,"
            ],
            [
                56408,
                "you with the waves"
            ],
            [
                58250,
                "The ocean's colors"
            ],
            [
                60042,
                "on your face"
            ],
            [
                61898,
                "I'll leave my heart"
            ],
            [
                63676,
                "with your air"
            ],
            [
                66316,
                "So let me fly with you"
            ],
            [
                69469,
                "Will you be forever with me?"
            ],
            [
                107151,
                "My love will always"
            ],
            [
                109128,
                "stay by you"
            ],
            [
                112900,
                "I'll keep it safe,"
            ],
            [
                115200,
                "so don't you worry a thing"
            ],
            [
                117969,
                "I'll tell you I love you more"
            ],
            [
                121831,
                "It's stuck with you forever,"
            ],
            [
                125319,
                "so promise you won't let it go"
            ],
            [
                128498,
                "I'll trust the universe"
            ],
            [
                130962,
                "will always bring me to you"
            ],
            [
                136721,
                "I'll imagine we fell in love"
            ],
            [
                139397,
                "I'll nap under"
            ],
            [
                140288,
                "moonlight skies with you"
            ],
            [
                143052,
                "I think I'll picture us,"
            ],
            [
                145012,
                "you with the waves"
            ],
            [
                146847,
                "The ocean's colors"
            ],
            [
                148625,
                "on your face"
            ],
            [
                150609,
                "I'll leave my heart"
            ],
            [
                152350,
                "with your air"
            ],
            [
                154900,
                "So let me fly with you"
            ],
            [
                158400,
                "Will you be forever with me?"
            ]
        ]
    },
    {
        "name": "BWO - Sunshine In The Rain",
        "lyrics": [
            [
                14200,
                "When I'm in Berlin,"
            ],
            [
                15676,
                "you're off to London"
            ],
            [
                17826,
                "When I'm in New York,"
            ],
            [
                19439,
                "you're doing Rome"
            ],
            [
                21600,
                "All those crazy nights"
            ],
            [
                23224,
                "we spend together"
            ],
            [
                25408,
                "As voices on the phone"
            ],
            [
                29207,
                "Wishing we could"
            ],
            [
                30332,
                "be more telepathic"
            ],
            [
                33004,
                "Tired of the nights"
            ],
            [
                34371,
                "I sleep alone"
            ],
            [
                36677,
                "Wishing we could"
            ],
            [
                37698,
                "redirect the traffic"
            ],
            [
                40395,
                "And find ourselves a home"
            ],
            [
                44155,
                "Can you feel the"
            ],
            [
                45190,
                "raindrops in the desert?"
            ],
            [
                47750,
                "Have you seen the"
            ],
            [
                49010,
                "sunrays in the dark?"
            ],
            [
                51500,
                "Do you feel my love"
            ],
            [
                53132,
                "when I'm not present"
            ],
            [
                55326,
                "Standing by your side"
            ],
            [
                56933,
                "while miles apart?"
            ],
            [
                59034,
                "Sunshine in the rain,"
            ],
            [
                60889,
                "love is still the same"
            ],
            [
                62823,
                "Sunshine in the rain"
            ],
            [
                66500,
                "Sunshine in the rain,"
            ],
            [
                68424,
                "love is still the same"
            ],
            [
                70274,
                "Sunshine in the rain"
            ],
            [
                74247,
                "Even if we call"
            ],
            [
                75647,
                "the highest power"
            ],
            [
                77901,
                "We can only do one town a time"
            ],
            [
                81588,
                "Words are not enough,"
            ],
            [
                83133,
                "action speaks louder"
            ],
            [
                85400,
                "Second time around"
            ],
            [
                89001,
                "Can you feel the"
            ],
            [
                90299,
                "raindrops in the desert?"
            ],
            [
                92837,
                "Have you seen the"
            ],
            [
                93940,
                "sunrays in the dark?"
            ],
            [
                96544,
                "Do you feel my love"
            ],
            [
                98202,
                "when I'm not present"
            ],
            [
                100317,
                "Standing by your side"
            ],
            [
                101931,
                "while miles apart?"
            ],
            [
                104089,
                "Sunshine in the rain,"
            ],
            [
                105910,
                "love is still the same"
            ],
            [
                107816,
                "Sunshine in the rain"
            ],
            [
                109713,
                "(Sunshine in the rain)"
            ],
            [
                111589,
                "Sunshine in the rain,"
            ],
            [
                113387,
                "love is still the same"
            ],
            [
                115290,
                "Sunshine in the rain"
            ],
            [
                117229,
                "(Sunshine in the rain)"
            ],
            [
                133469,
                "When I'm in Berlin,"
            ],
            [
                135747,
                "you're off to London"
            ],
            [
                137695,
                "When I'm in New York,"
            ],
            [
                139409,
                "you're doing Rome"
            ],
            [
                141500,
                "All those crazy nights"
            ],
            [
                143219,
                "we spend together"
            ],
            [
                145319,
                "As voices on the phone"
            ],
            [
                149323,
                "Can you feel the"
            ],
            [
                150213,
                "raindrops in the desert?"
            ],
            [
                152791,
                "Have you seen the"
            ],
            [
                153964,
                "sunrays in the dark?"
            ],
            [
                156576,
                "Do you feel my love"
            ],
            [
                158165,
                "when I'm not present"
            ],
            [
                160411,
                "Standing by your side"
            ],
            [
                161935,
                "while miles apart?"
            ],
            [
                163979,
                "Sunshine in the rain,"
            ],
            [
                165850,
                "love is still the same"
            ],
            [
                167768,
                "Sunshine in the rain"
            ],
            [
                169605,
                "(Sunshine in the rain)"
            ],
            [
                171529,
                "Sunshine in the rain,"
            ],
            [
                173447,
                "love is still the same"
            ],
            [
                175305,
                "Sunshine in the rain"
            ],
            [
                177295,
                "(Sunshine in the rain)"
            ],
            [
                179101,
                "Can you feel the"
            ],
            [
                180251,
                "raindrops in the desert?"
            ],
            [
                182749,
                "Have you seen the"
            ],
            [
                183974,
                "sunrays in the dark?"
            ],
            [
                186509,
                "Do you feel my love"
            ],
            [
                188113,
                "when I'm not present"
            ],
            [
                190251,
                "Standing by your side"
            ],
            [
                191846,
                "while miles apart?"
            ],
            [
                193926,
                "Sunshine in the rain,"
            ],
            [
                195913,
                "love is still the same"
            ],
            [
                197747,
                "Sunshine in the rain"
            ],
            [
                199639,
                "(sunshine in the rain)"
            ],
            [
                201565,
                "Sunshine in the rain,"
            ],
            [
                203376,
                "love is still the same"
            ],
            [
                205369,
                "Sunshine in the rain"
            ]
        ]
    },
    {
        "name": "Post Malone - Circles",
        "lyrics": [
            [
                32944,
                "We couldn't turn around"
            ],
            [
                36655,
                "'Til we were upside down"
            ],
            [
                40486,
                "I'll be the bad guy now"
            ],
            [
                44400,
                "But know I ain't too proud"
            ],
            [
                48222,
                "I couldn't be there"
            ],
            [
                52400,
                "Even when I tried"
            ],
            [
                56052,
                "You don't believe it"
            ],
            [
                59850,
                "We do this every time"
            ],
            [
                61700,
                "Seasons change and"
            ],
            [
                63030,
                "our love went cold"
            ],
            [
                65657,
                "Feed the flame 'cause"
            ],
            [
                66815,
                "we can't let go"
            ],
            [
                69480,
                "Run away,"
            ],
            [
                70393,
                "but we're running in circles"
            ],
            [
                73303,
                "Run away, run away"
            ],
            [
                75707,
                "I dare you to do something"
            ],
            [
                79469,
                "I'm waiting on you again"
            ],
            [
                82869,
                "So I don't take the blame"
            ],
            [
                84825,
                "Run away,"
            ],
            [
                85774,
                "but we're running in circles"
            ],
            [
                88717,
                "Run away, run away, run away"
            ],
            [
                92500,
                "Let go"
            ],
            [
                94369,
                "I got a feeling that"
            ],
            [
                95726,
                "it's time to let go"
            ],
            [
                99469,
                "I say so"
            ],
            [
                102081,
                "I knew that this was doomed"
            ],
            [
                103671,
                "from the get-go"
            ],
            [
                106543,
                "You thought that it was"
            ],
            [
                107463,
                "special, special"
            ],
            [
                110069,
                "But it was just the Sex,"
            ],
            [
                111805,
                "though, the Sex, though"
            ],
            [
                113890,
                "And I still hear the echoes"
            ],
            [
                116380,
                "(the echoes)"
            ],
            [
                117500,
                "I got a feeling that it's time"
            ],
            [
                119400,
                "to let it go, let it go"
            ],
            [
                123420,
                "Seasons change and"
            ],
            [
                124483,
                "our love went cold"
            ],
            [
                127155,
                "Feed the flame"
            ],
            [
                128056,
                "'cause we can't let go"
            ],
            [
                131042,
                "Run away,"
            ],
            [
                131953,
                "but we're running in circles"
            ],
            [
                134844,
                "Run away, run away"
            ],
            [
                137078,
                "I dare you to do something"
            ],
            [
                140928,
                "I'm waiting on you again"
            ],
            [
                144396,
                "So I don't take the blame"
            ],
            [
                146380,
                "Run away,"
            ],
            [
                147700,
                "but we're running in circles"
            ],
            [
                150295,
                "Run away, run away, run away"
            ],
            [
                154193,
                "Maybe you don't understand"
            ],
            [
                155795,
                "what I'm going through"
            ],
            [
                157969,
                "It's only me"
            ],
            [
                159888,
                "What you got to lose?"
            ],
            [
                161853,
                "Make up your mind, tell me"
            ],
            [
                163240,
                "What are you gonna do?"
            ],
            [
                165595,
                "It's only me"
            ],
            [
                167420,
                "Let it go"
            ],
            [
                169481,
                "Seasons change and"
            ],
            [
                170628,
                "our love went cold"
            ],
            [
                173296,
                "Feed the flame"
            ],
            [
                174285,
                "'cause we can't let go"
            ],
            [
                177132,
                "Run away,"
            ],
            [
                178091,
                "but we're running in circles"
            ],
            [
                180999,
                "Run away, run away"
            ],
            [
                183200,
                "I dare you to do something"
            ],
            [
                187000,
                "I'm waiting on you again"
            ],
            [
                190420,
                "So I don't take the blame"
            ],
            [
                192551,
                "Run away,"
            ],
            [
                193479,
                "but we're running in circles"
            ],
            [
                196456,
                "Run away, run away, run away"
            ]
        ]
    },
    {
        "name": "Lady Gaga - Poker Face",
        "lyrics": [
            [
                7500,
                "Mum-mum-mum-mah"
            ],
            [
                11666,
                "Mum-mum-mum-mah"
            ],
            [
                15600,
                "Mum-mum-mum-mah"
            ],
            [
                19696,
                "Mum-mum-mum-mah"
            ],
            [
                23555,
                "Mum-mum-mum-mah"
            ],
            [
                24654,
                "I wanna hold 'em like"
            ],
            [
                25721,
                "they do in Texas, please (Woo)"
            ],
            [
                28369,
                "Fold 'em, let 'em hit me,"
            ],
            [
                29648,
                "raise it, baby, stay with me"
            ],
            [
                31440,
                "(I love it)"
            ],
            [
                32330,
                "LoveGame intuition,"
            ],
            [
                33677,
                "play the cards with"
            ],
            [
                34691,
                "spades to start"
            ],
            [
                36000,
                "And after he's been hooked,"
            ],
            [
                37399,
                "I'll play the one"
            ],
            [
                38376,
                "that's on his heart"
            ],
            [
                40569,
                "Oh, woah-oh, oh, oh"
            ],
            [
                42973,
                "Oh-oh-oh-oh-oh-oh"
            ],
            [
                44350,
                "I'll get him hot,"
            ],
            [
                45600,
                "show him what I've got"
            ],
            [
                48313,
                "Oh, woah-oh, oh, oh"
            ],
            [
                51103,
                "Oh-oh-oh-oh-oh-oh"
            ],
            [
                52335,
                "I'll get him hot,"
            ],
            [
                54114,
                "show him what I've got"
            ],
            [
                56715,
                "Can't read my, can't read my"
            ],
            [
                58586,
                "No, he cant read my poker face"
            ],
            [
                62427,
                "(She's got me like nobody)"
            ],
            [
                64748,
                "Can't read my, can't read my"
            ],
            [
                66620,
                "No, he cant read my poker face"
            ],
            [
                70553,
                "(She's got me like nobody)"
            ],
            [
                72792,
                "P-p-p-poker face,"
            ],
            [
                74156,
                "f-f-fuck her face"
            ],
            [
                76000,
                "(Mum-mum-mum-mah)"
            ],
            [
                76878,
                "P-p-p-poker face,"
            ],
            [
                78270,
                "f-f-fuck her face"
            ],
            [
                79882,
                "(Mum-mum-mum-mah)"
            ],
            [
                80951,
                "I wanna roll with him,"
            ],
            [
                82369,
                "a hard pair we will be (Woo)"
            ],
            [
                84700,
                "A little gamblin' is fun"
            ],
            [
                86898,
                "when you're with me"
            ],
            [
                88696,
                "(I love it, woo)"
            ],
            [
                89345,
                "Russian roulette is"
            ],
            [
                90169,
                "not the same without a gun"
            ],
            [
                92655,
                "And baby, when it's love,"
            ],
            [
                93849,
                "if its not rough, it isnt fun,"
            ],
            [
                96153,
                "fun"
            ],
            [
                96969,
                "Oh, woah-oh, oh, oh"
            ],
            [
                98623,
                "Oh-oh-oh-oh-oh-oh"
            ],
            [
                100808,
                "I'll get him hot,"
            ],
            [
                102286,
                "show him what I've got"
            ],
            [
                104800,
                "Oh, woah-oh, oh, oh"
            ],
            [
                106841,
                "Oh-oh-oh-oh-oh-oh"
            ],
            [
                109069,
                "I'll get him hot,"
            ],
            [
                110444,
                "show him what I've got"
            ],
            [
                113124,
                "Can't read my, can't read my"
            ],
            [
                115048,
                "No, he cant read my poker face"
            ],
            [
                118922,
                "(She's got me like nobody)"
            ],
            [
                121193,
                "Can't read my, can't read my"
            ],
            [
                123087,
                "No, he cant read my poker face"
            ],
            [
                126995,
                "(She's got me like nobody)"
            ],
            [
                129214,
                "P-p-p-poker face,"
            ],
            [
                130687,
                "f-f-fuck her face"
            ],
            [
                132394,
                "(Mum-mum-mum-mah)"
            ],
            [
                133428,
                "P-p-p-poker face,"
            ],
            [
                134758,
                "f-f-fuck her face"
            ],
            [
                136258,
                "(Mum-mum-mum-mah)"
            ],
            [
                140777,
                "(Mum-mum-mum-mah)"
            ],
            [
                144900,
                "I won't tell you"
            ],
            [
                145900,
                "that I love you"
            ],
            [
                147000,
                "Kiss or hug you"
            ],
            [
                147869,
                "'Cause I'm bluffin'"
            ],
            [
                148584,
                "with my muffin"
            ],
            [
                149637,
                "I'm not lyin',"
            ],
            [
                150541,
                "I'm just stunnin' with"
            ],
            [
                151899,
                "my love-glue-gunnin'"
            ],
            [
                153500,
                "Just like a chick"
            ],
            [
                154405,
                "in the casino"
            ],
            [
                155661,
                "Take your bank"
            ],
            [
                156475,
                "before I pay you out"
            ],
            [
                157978,
                "I promise this, promise this"
            ],
            [
                159982,
                "Check this hand"
            ],
            [
                160596,
                "'cause I'm marvelous"
            ],
            [
                161676,
                "Can't read my, can't read my"
            ],
            [
                163451,
                "No, he cant read my poker face"
            ],
            [
                167334,
                "(She's got me like nobody)"
            ],
            [
                169544,
                "Can't read my, can't read my"
            ],
            [
                171555,
                "No, he cant read my poker face"
            ],
            [
                175397,
                "(She's got me like nobody)"
            ],
            [
                177627,
                "Can't read my, can't read my"
            ],
            [
                179652,
                "No, he cant read my poker face"
            ],
            [
                183462,
                "(She's got me like nobody)"
            ],
            [
                185724,
                "Can't read my, can't read my"
            ],
            [
                187648,
                "No, he cant read my poker face"
            ],
            [
                191486,
                "(She's got me like nobody)"
            ],
            [
                193770,
                "Can't read my, can't read my"
            ],
            [
                195740,
                "No, he cant read my poker face"
            ],
            [
                199606,
                "(She's got me like nobody)"
            ],
            [
                201869,
                "Can't read my, can't read my"
            ],
            [
                203808,
                "No, he cant read my poker face"
            ],
            [
                207635,
                "(She's got me like nobody)"
            ],
            [
                209869,
                "P-p-p-poker face,"
            ],
            [
                211395,
                "f-f-fuck her face"
            ],
            [
                213869,
                "P-p-p-poker face,"
            ],
            [
                215401,
                "f-f-fuck her face"
            ],
            [
                216222,
                "(She's got me like nobody)"
            ],
            [
                217868,
                "P-p-p-poker face,"
            ],
            [
                219458,
                "f-f-fuck her face"
            ],
            [
                220967,
                "(Mum-mum-mum-mah)"
            ],
            [
                222124,
                "P-p-p-poker face,"
            ],
            [
                223549,
                "f-f-fuck her face"
            ]
        ]
    },
    {
        "name": "Edward Maya - Stereo Love",
        "lyrics": [
            [
                4200,
                "When you gonna stop"
            ],
            [
                5770,
                "breaking my heart?"
            ],
            [
                11700,
                "I don't wanna be another one"
            ],
            [
                19300,
                "Paying for the"
            ],
            [
                20400,
                "things I never done"
            ],
            [
                25969,
                "Don't let go,"
            ],
            [
                27573,
                "don't let go to my love"
            ],
            [
                49300,
                "I think I found the one"
            ],
            [
                51007,
                "that'll hold my heart"
            ],
            [
                56869,
                "I wanna feel your heart,"
            ],
            [
                58686,
                "we're in love tonight"
            ],
            [
                60500,
                "I can fix all those lies"
            ],
            [
                62860,
                "Oh baby, baby, I run,"
            ],
            [
                64568,
                "but I'm running to you"
            ],
            [
                66696,
                "You won't see me cry,"
            ],
            [
                68569,
                "I'm hiding inside"
            ],
            [
                70373,
                "My heart is in pain,"
            ],
            [
                72111,
                "but I'm smiling for you"
            ],
            [
                76000,
                "Can I get to your soul?"
            ],
            [
                77777,
                "Can you get to my flow?"
            ],
            [
                79696,
                "Can we promise we wont let go?"
            ],
            [
                83500,
                "All the things that I need,"
            ],
            [
                85469,
                "all the things that you need"
            ],
            [
                87168,
                "You can make it feel so real"
            ],
            [
                91022,
                "'Cause you can't deny,"
            ],
            [
                92708,
                "you've blown my mind"
            ],
            [
                94637,
                "When I touch your body,"
            ],
            [
                96430,
                "I feel I'm losing control"
            ],
            [
                98358,
                "'Cause you can't deny,"
            ],
            [
                100096,
                "you've blown my mind"
            ],
            [
                102162,
                "When I see you baby,"
            ],
            [
                103906,
                "I just don't wanna let go"
            ],
            [
                106752,
                "(Oohh)"
            ],
            [
                109942,
                "When you gonna stop"
            ],
            [
                111609,
                "breaking my heart?"
            ],
            [
                117469,
                "I don't wanna be another one"
            ],
            [
                139966,
                "I think I found the one"
            ],
            [
                141800,
                "that'll hold my heart"
            ],
            [
                147606,
                "I wanna feel your heart,"
            ],
            [
                149379,
                "we're in love tonight"
            ],
            [
                151169,
                "I can fix all those lies"
            ],
            [
                153526,
                "Oh baby, baby, I run,"
            ],
            [
                155288,
                "but I'm running to you"
            ],
            [
                157479,
                "You won't see me cry,"
            ],
            [
                159310,
                "I'm hiding inside"
            ],
            [
                161190,
                "My heart is in pain,"
            ],
            [
                162868,
                "but I'm smiling for you"
            ],
            [
                165000,
                "Oh baby, I'll try"
            ],
            [
                166755,
                "to make the things right"
            ],
            [
                168688,
                "I need you more than air"
            ],
            [
                170305,
                "when I'm not with you"
            ],
            [
                172653,
                "Please don't ask me why,"
            ],
            [
                174385,
                "just kiss me this time"
            ],
            [
                176300,
                "My only dream"
            ],
            [
                178000,
                "is about you and I"
            ]
        ]
    },
    {
        "name": "The Walters - I Love You So",
        "lyrics": [
            [
                1250,
                "I just need someone in my life"
            ],
            [
                3969,
                "to give it structure"
            ],
            [
                7200,
                "To handle all the selfish ways"
            ],
            [
                9369,
                "I'd spend my time without her"
            ],
            [
                13600,
                "You're everything I want,"
            ],
            [
                14953,
                "but I can't deal"
            ],
            [
                16533,
                "with all your lovers"
            ],
            [
                20151,
                "You're saying I'm the one,"
            ],
            [
                21507,
                "but it's your actions"
            ],
            [
                23234,
                "that speak louder"
            ],
            [
                26700,
                "Giving me love when you are"
            ],
            [
                28854,
                "down and need another"
            ],
            [
                32722,
                "I've gotta get away an"
            ],
            [
                34300,
                "let you go, Ive gotta get over"
            ],
            [
                38915,
                "But I love you so"
            ],
            [
                42756,
                "(ooh-ooh-ooh)"
            ],
            [
                45312,
                "I love you so (ooh-ooh-ooh)"
            ],
            [
                51631,
                "I love you so (ooh-ooh-ooh)"
            ],
            [
                57929,
                "I love you so"
            ],
            [
                62500,
                "I'm gonna pack my things"
            ],
            [
                65933,
                "and leave you behind"
            ],
            [
                68850,
                "This feeling's old,"
            ],
            [
                70642,
                "and I know that"
            ],
            [
                72567,
                "I've made up my mind"
            ],
            [
                75079,
                "I hope you feel what I felt"
            ],
            [
                78529,
                "when you shattered my soul"
            ],
            [
                81332,
                "'Cause you were cruel,"
            ],
            [
                83000,
                "and I'm a fool,"
            ],
            [
                85000,
                "so please, let me go"
            ],
            [
                89569,
                "But I love you so"
            ],
            [
                92745,
                "(please, let me go)"
            ],
            [
                95978,
                "I love you so"
            ],
            [
                99107,
                "(please, let me go)"
            ],
            [
                102223,
                "I love you so"
            ],
            [
                106295,
                "(please, let me go)"
            ],
            [
                108659,
                "I love you so"
            ],
            [
                118169,
                "Ooh-ooh-ooh"
            ],
            [
                124500,
                "Ooh-ooh-ooh-ooh"
            ],
            [
                130696,
                "Ooh-ooh-ooh"
            ],
            [
                137195,
                "Ooh-ooh-ooh-ooh"
            ]
        ]
    },
    {
        "name": "Sam Gellaitry - Assumptions",
        "lyrics": [
            [
                60400,
                "If it's love that you want,"
            ],
            [
                62769,
                "I'll give my everything"
            ],
            [
                67800,
                "And have I made the"
            ],
            [
                68886,
                "right assumption?"
            ],
            [
                70819,
                "Do you feel the same?"
            ],
            [
                75756,
                "If it's love that you want,"
            ],
            [
                78300,
                "I'll give my everything"
            ],
            [
                83100,
                "And have I made the"
            ],
            [
                84030,
                "right assumption?"
            ],
            [
                86063,
                "Do you feel the same?"
            ],
            [
                121469,
                "If it's love that you want,"
            ],
            [
                124024,
                "I'll give my everything"
            ],
            [
                128900,
                "And have I made the"
            ],
            [
                129850,
                "right assumption?"
            ],
            [
                131661,
                "Do you feel the same?"
            ],
            [
                136600,
                "If it's love that you want,"
            ],
            [
                139287,
                "I'll give my everything"
            ],
            [
                143969,
                "And have I made the"
            ],
            [
                144889,
                "right assumption?"
            ],
            [
                146972,
                "Do you feel the same?"
            ],
            [
                167728,
                "Love that you want,"
            ],
            [
                169667,
                "I'll give my everything"
            ],
            [
                174469,
                "And have I made the"
            ],
            [
                175474,
                "right assumption?"
            ],
            [
                177398,
                "Do you feel the same?"
            ],
            [
                182400,
                "If it's love that you want,"
            ],
            [
                184800,
                "I'll give my everything"
            ],
            [
                189696,
                "And have I made the"
            ],
            [
                190600,
                "right assumption?"
            ],
            [
                192745,
                "Do you feel the same?"
            ]
        ]
    },
    {
        "name": "The Weekend - Blinding Lights",
        "lyrics": [
            [
                13769,
                "Yeah"
            ],
            [
                27492,
                "I've been tryna call"
            ],
            [
                30043,
                "I've been on my own"
            ],
            [
                31269,
                "for long enough"
            ],
            [
                32800,
                "Maybe you can show me"
            ],
            [
                34169,
                "how to love, maybe"
            ],
            [
                38547,
                "I'm goin' through withdrawals"
            ],
            [
                41241,
                "You don't even have"
            ],
            [
                42242,
                "to do too much"
            ],
            [
                44119,
                "You can turn me on"
            ],
            [
                45082,
                "with just a touch, baby"
            ],
            [
                49691,
                "I look around and"
            ],
            [
                50693,
                "Sin City's cold and empty"
            ],
            [
                53121,
                "(oh)"
            ],
            [
                53705,
                "No one's around to judge me"
            ],
            [
                55880,
                "(oh)"
            ],
            [
                56304,
                "I can't see clearly"
            ],
            [
                57923,
                "when you're gone"
            ],
            [
                60842,
                "I said, ooh,"
            ],
            [
                63645,
                "I'm blinded by the lights"
            ],
            [
                66841,
                "No, I can't sleep until"
            ],
            [
                68631,
                "I feel your touch"
            ],
            [
                72172,
                "I said, ooh,"
            ],
            [
                75230,
                "I'm drowning in the night"
            ],
            [
                78004,
                "Oh, when I'm like this,"
            ],
            [
                79852,
                "you're the one I trust"
            ],
            [
                82123,
                "(Hey, hey, hey)"
            ],
            [
                94469,
                "I'm running out of time"
            ],
            [
                97366,
                "'Cause I can see the"
            ],
            [
                98220,
                "sun light up the sky"
            ],
            [
                100225,
                "So I hit the road"
            ],
            [
                101202,
                "in overdrive, baby, oh"
            ],
            [
                107000,
                "The city's cold and empty"
            ],
            [
                109269,
                "(oh)"
            ],
            [
                109807,
                "No one's around to judge me"
            ],
            [
                111900,
                "(oh)"
            ],
            [
                112512,
                "I can't see clearly"
            ],
            [
                114015,
                "when you're gone"
            ],
            [
                117000,
                "I said, ooh,"
            ],
            [
                120076,
                "I'm blinded by the lights"
            ],
            [
                122981,
                "No, I can't sleep until"
            ],
            [
                124924,
                "I feel your touch"
            ],
            [
                128169,
                "I said, ooh,"
            ],
            [
                131200,
                "I'm drowning in the night"
            ],
            [
                134146,
                "Oh, when I'm like this,"
            ],
            [
                136011,
                "you're the one I trust"
            ],
            [
                139600,
                "I'm just walking by to"
            ],
            [
                140696,
                "let you know"
            ],
            [
                141769,
                "(by to let you know)"
            ],
            [
                142300,
                "I could never say it"
            ],
            [
                143354,
                "on the phone"
            ],
            [
                144489,
                "(say it on the phone)"
            ],
            [
                145500,
                "Will never let you"
            ],
            [
                147000,
                "go this time"
            ],
            [
                150014,
                "(ooh)"
            ],
            [
                150696,
                "I said, ooh,"
            ],
            [
                153888,
                "I'm blinded by the lights"
            ],
            [
                156600,
                "No, I can't sleep until"
            ],
            [
                158606,
                "I feel your touch"
            ],
            [
                161000,
                "(Hey, hey, hey)"
            ],
            [
                172000,
                "(Hey, hey, hey)"
            ],
            [
                184369,
                "I said, ooh,"
            ],
            [
                187500,
                "I'm blinded by the lights"
            ],
            [
                190269,
                "No, I can't sleep until"
            ],
            [
                192304,
                "I feel your touch"
            ]
        ]
    },
    {
        "name": "Sia - Cheap Thrills",
        "lyrics": [
            [
                10883,
                "Come on, come on,"
            ],
            [
                11732,
                "turn the radio on"
            ],
            [
                13421,
                "It's Friday night"
            ],
            [
                14510,
                "and I won't be long"
            ],
            [
                15944,
                "Gotta do my hair,"
            ],
            [
                17139,
                "put my make up on"
            ],
            [
                18888,
                "It's Friday night"
            ],
            [
                19863,
                "and I won't be long"
            ],
            [
                21292,
                "'Til I hit the dance floor,"
            ],
            [
                23064,
                "hit the dance floor"
            ],
            [
                24248,
                "I got all I need"
            ],
            [
                26786,
                "No, I ain't got cash,"
            ],
            [
                28124,
                "I ain't got cash"
            ],
            [
                29483,
                "But I got you, baby"
            ],
            [
                31969,
                "Baby, I don't need dollar"
            ],
            [
                34169,
                "bills to have fun tonight"
            ],
            [
                35923,
                "(I love cheap thrills)"
            ],
            [
                37252,
                "Baby, I don't need dollar"
            ],
            [
                39407,
                "bills to have fun tonight"
            ],
            [
                41295,
                "(I love cheap thrills)"
            ],
            [
                43000,
                "I don't need no money"
            ],
            [
                48275,
                "As long as I can feel the beat"
            ],
            [
                53758,
                "I don't need no money"
            ],
            [
                59077,
                "As long as I keep dancing"
            ],
            [
                64400,
                "Come on, come on,"
            ],
            [
                65400,
                "turn the radio on"
            ],
            [
                66926,
                "It's Saturday"
            ],
            [
                68000,
                "and I won't be long"
            ],
            [
                69500,
                "Gotta paint my nails,"
            ],
            [
                70724,
                "put my high heels on"
            ],
            [
                72339,
                "It's Saturday"
            ],
            [
                73368,
                "and I won't be long"
            ],
            [
                74727,
                "'Til I hit the dance floor,"
            ],
            [
                76609,
                "hit the dance floor"
            ],
            [
                77854,
                "I got all I need"
            ],
            [
                80163,
                "No, I ain't got cash,"
            ],
            [
                81645,
                "I ain't got cash"
            ],
            [
                83017,
                "But I got you, baby"
            ],
            [
                85524,
                "Baby, I don't need dollar"
            ],
            [
                87653,
                "bills to have fun tonight"
            ],
            [
                89498,
                "(I love cheap thrills)"
            ],
            [
                91031,
                "Baby, I don't need dollar"
            ],
            [
                92982,
                "bills to have fun tonight"
            ],
            [
                94845,
                "(I love cheap thrills)"
            ],
            [
                96494,
                "I don't need no money"
            ],
            [
                102000,
                "As long as I can feel the beat"
            ],
            [
                107400,
                "I don't need no money"
            ],
            [
                112699,
                "As long as I keep dancing"
            ],
            [
                121700,
                "(I love cheap thrills)"
            ],
            [
                127200,
                "(I love cheap thrills)"
            ],
            [
                128820,
                "I don't need no money"
            ],
            [
                134086,
                "As long as I can feel the beat"
            ],
            [
                139501,
                "I don't need no money"
            ],
            [
                144800,
                "As long as I keep dancing"
            ],
            [
                149069,
                "(Oh, oh, oh)"
            ],
            [
                150300,
                "Baby, I don't need dollar"
            ],
            [
                152138,
                "bills to have fun tonight"
            ],
            [
                154025,
                "(I love cheap thrills)"
            ],
            [
                155500,
                "Baby, I don't need dollar"
            ],
            [
                157360,
                "bills to have fun tonight"
            ],
            [
                159213,
                "(I love cheap thrills)"
            ],
            [
                160736,
                "I don't need no money"
            ],
            [
                166313,
                "As long as I can feel the beat"
            ],
            [
                171761,
                "I don't need no money"
            ],
            [
                177068,
                "As long as I keep dancing"
            ],
            [
                182600,
                "La, la, la, la, la, la, la"
            ],
            [
                186969,
                "(I love cheap thrills)"
            ],
            [
                188169,
                "La, la, la, la, la, la, la"
            ],
            [
                191869,
                "(I love cheap thrills)"
            ],
            [
                193200,
                "La, la, la, la, la, la, la"
            ],
            [
                196700,
                "(I love cheap thrills)"
            ],
            [
                198708,
                "La, la, la, la, la, la, la"
            ],
            [
                202137,
                "(I love cheap thrills)"
            ]
        ]
    },
    {
        "name": "ATC - Around The World",
        "lyrics": [
            [
                8000,
                "The kisses of the sun"
            ],
            [
                10147,
                "were sweet, I didn't blink"
            ],
            [
                11527,
                "I let it in my eyes"
            ],
            [
                13736,
                "like an exotic dream"
            ],
            [
                15121,
                "The radio playing songs"
            ],
            [
                17420,
                "that I have never heard"
            ],
            [
                18690,
                "I don't know what to say,"
            ],
            [
                21036,
                "oh, not another word"
            ],
            [
                22326,
                "Just la la la la la,"
            ],
            [
                24696,
                "it goes around the world"
            ],
            [
                26049,
                "Just la la la la la,"
            ],
            [
                28404,
                "it's all around the world"
            ],
            [
                29673,
                "Just la la la la la,"
            ],
            [
                32012,
                "and everybody's singing"
            ],
            [
                33520,
                "La la la la la,"
            ],
            [
                35631,
                "and now the bells are ringing"
            ],
            [
                37125,
                "La la la la la,"
            ],
            [
                39296,
                "la la la la la la la,"
            ],
            [
                40765,
                "la la la la la,"
            ],
            [
                42868,
                "la la la la la la la"
            ],
            [
                44444,
                "La la la la la,"
            ],
            [
                46483,
                "la la la la la la la,"
            ],
            [
                48049,
                "la la la la la,"
            ],
            [
                50102,
                "la la la la la la la"
            ],
            [
                66222,
                "Inside an empty room,"
            ],
            [
                68365,
                "my inspiration flows"
            ],
            [
                69703,
                "Now wait to hear the tune,"
            ],
            [
                71970,
                "around my head it goes"
            ],
            [
                73363,
                "The magic melody,"
            ],
            [
                75643,
                "you want to sing with me"
            ],
            [
                76953,
                "Just la la la la la,"
            ],
            [
                79244,
                "the music is the key"
            ],
            [
                80618,
                "And now the night is gone,"
            ],
            [
                82896,
                "still it goes on and on"
            ],
            [
                84569,
                "So deep inside of me,"
            ],
            [
                86569,
                "I long to set it free"
            ],
            [
                87798,
                "I don't know what to do,"
            ],
            [
                90148,
                "just can't explain to you"
            ],
            [
                91520,
                "I don't know what to say,"
            ],
            [
                93719,
                "oh, not another word"
            ],
            [
                95102,
                "Just la la la la la,"
            ],
            [
                97370,
                "it goes around the world"
            ],
            [
                98686,
                "Just la la la la la,"
            ],
            [
                100998,
                "it's all around the world"
            ],
            [
                102346,
                "Just la la la la la,"
            ],
            [
                104654,
                "and everybody's singing"
            ],
            [
                106265,
                "La la la la la,"
            ],
            [
                108335,
                "and now the bells are ringing"
            ],
            [
                109934,
                "La la la la la,"
            ],
            [
                111990,
                "la la la la la la la,"
            ],
            [
                113570,
                "la la la la la,"
            ],
            [
                115638,
                "la la la la la la la"
            ],
            [
                117158,
                "La la la la la,"
            ],
            [
                119243,
                "la la la la la la la,"
            ],
            [
                120760,
                "la la la la la,"
            ],
            [
                122783,
                "la la la la la la la"
            ],
            [
                140666,
                "The kisses of the sun"
            ],
            [
                141800,
                "kisses of the sun,"
            ],
            [
                143170,
                "of the sun, of the sun"
            ],
            [
                146269,
                "Around, around, around,"
            ],
            [
                148656,
                "around, around, around,"
            ],
            [
                151500,
                "around the world"
            ],
            [
                155651,
                "La la la la la,"
            ],
            [
                157368,
                "it goes around the world"
            ],
            [
                158756,
                "Just la la la la la,"
            ],
            [
                160996,
                "it's all around the world"
            ],
            [
                162378,
                "Just la la la la la,"
            ],
            [
                164677,
                "and everybody's singing"
            ],
            [
                166255,
                "La la la la la,"
            ],
            [
                168325,
                "and now the bells are ringing"
            ],
            [
                169839,
                "La la la la la,"
            ],
            [
                171969,
                "la la la la la la la,"
            ],
            [
                173548,
                "la la la la la,"
            ],
            [
                175599,
                "la la la la la la la"
            ],
            [
                176854,
                "La la la la la,"
            ],
            [
                179229,
                "la la la la la la la,"
            ],
            [
                180845,
                "la la la la la,"
            ],
            [
                182973,
                "la la la la la la la"
            ],
            [
                184457,
                "La la la la la,"
            ],
            [
                186209,
                "la la la la la la la"
            ],
            [
                188100,
                "La la la la la,"
            ],
            [
                190191,
                "la la la la la la la,"
            ],
            [
                191725,
                "La la la la la,"
            ],
            [
                193897,
                "la la la la la la la"
            ],
            [
                195401,
                "La la la la la,"
            ],
            [
                197444,
                "la la la la la la la"
            ]
        ]
    },
    {
        "name": "Edward Sharpe - Home",
        "lyrics": [
            [
                18904,
                "Alabama, Arkansas"
            ],
            [
                21420,
                "I do love my ma and pa"
            ],
            [
                23135,
                "Not that way that"
            ],
            [
                24222,
                "I do love you"
            ],
            [
                27329,
                "Well, holy moly, me oh my"
            ],
            [
                29568,
                "You're the apple of my eye"
            ],
            [
                31750,
                "Girl, I've never"
            ],
            [
                32802,
                "loved one like you"
            ],
            [
                35957,
                "Man, oh man,"
            ],
            [
                36756,
                "you're my best friend"
            ],
            [
                38000,
                "I scream it to"
            ],
            [
                38852,
                "the nothingness"
            ],
            [
                40696,
                "There aint nothing that I need"
            ],
            [
                44250,
                "Well, hot and heavy,"
            ],
            [
                45575,
                "pumpkin pie"
            ],
            [
                46620,
                "Chocolate candy,"
            ],
            [
                47712,
                "Jesus Christ"
            ],
            [
                48843,
                "Ain't nothing please"
            ],
            [
                50100,
                "me more than you"
            ],
            [
                52800,
                "Oh, home, let me come home"
            ],
            [
                57269,
                "Home is wherever I'm with you"
            ],
            [
                61250,
                "Oh, home, let me come home"
            ],
            [
                65835,
                "Home is wherever I'm with you"
            ],
            [
                84969,
                "La, la, la, la, take me home"
            ],
            [
                90069,
                "(Daddy) Mother, Im coming home"
            ],
            [
                114200,
                "I'll follow you into the park"
            ],
            [
                116453,
                "Through the jungle,"
            ],
            [
                117525,
                "through the dark"
            ],
            [
                118687,
                "Girl, I never"
            ],
            [
                119678,
                "loved one like you (hey)"
            ],
            [
                122943,
                "Moats and boats and waterfalls"
            ],
            [
                125210,
                "Alleyways and pay phone calls"
            ],
            [
                127420,
                "I've been everywhere"
            ],
            [
                129200,
                "(hey) with you"
            ],
            [
                130569,
                "That's true,"
            ],
            [
                131696,
                "laugh until we think we'll die"
            ],
            [
                133869,
                "Barefoot on a summer night"
            ],
            [
                135918,
                "Never could be sweeter"
            ],
            [
                137469,
                "than with you (hey)"
            ],
            [
                140200,
                "And in the streets"
            ],
            [
                141174,
                "you run a-free"
            ],
            [
                142452,
                "Like it's only you and me"
            ],
            [
                144654,
                "Geez, you're something to see"
            ],
            [
                148395,
                "Oh, home, let me come home"
            ],
            [
                153334,
                "Home is wherever I'm with you"
            ],
            [
                157269,
                "Oh, home, let me come home"
            ],
            [
                161840,
                "Home is wherever I'm with you"
            ],
            [
                181000,
                "La, la, la, la, take me home"
            ],
            [
                186532,
                "(Daddy) Mother, Im coming home"
            ],
            [
                193933,
                "Jade"
            ],
            [
                194859,
                "Alexander"
            ],
            [
                196300,
                "Do you remember that day"
            ],
            [
                197379,
                "you fell out of my window?"
            ],
            [
                198899,
                "I sure do, you came"
            ],
            [
                199956,
                "jumping out after me"
            ],
            [
                202000,
                "Well, you fell on the concrete"
            ],
            [
                204123,
                "nearly broke your ass"
            ],
            [
                205117,
                "And you were bleedin'"
            ],
            [
                206015,
                "all over the place"
            ],
            [
                206983,
                "And I rushed you out to the"
            ],
            [
                208067,
                "hospital, you remember that?"
            ],
            [
                209311,
                "Yes, I do"
            ],
            [
                210300,
                "Well, theres something I never"
            ],
            [
                211270,
                "told you about that night"
            ],
            [
                212757,
                "What didn't you tell me?"
            ],
            [
                214222,
                "While you were sitting in the"
            ],
            [
                215200,
                "backseat smoking a cigarette"
            ],
            [
                217038,
                "You thought was gonna"
            ],
            [
                217847,
                "be your last"
            ],
            [
                219500,
                "I was falling deep,"
            ],
            [
                221192,
                "deeply in love with you"
            ],
            [
                223400,
                "And I never told you"
            ],
            [
                224800,
                "'til just now"
            ],
            [
                225901,
                "Aww"
            ],
            [
                227545,
                "Oh, home, let me come home"
            ],
            [
                231988,
                "Home is wherever I'm with you"
            ],
            [
                235866,
                "Oh, home, let me come home"
            ],
            [
                240696,
                "Home is where I'm"
            ],
            [
                242000,
                "alone with you"
            ],
            [
                244780,
                "Home, let me come home"
            ],
            [
                249397,
                "Home is wherever I'm with you"
            ],
            [
                253686,
                "Oh, home, yes, I am home"
            ],
            [
                258716,
                "Home is when I'm"
            ],
            [
                260275,
                "alone with you"
            ],
            [
                263289,
                "Alabama, Arkansas"
            ],
            [
                267569,
                "I do love my ma and pa"
            ],
            [
                271618,
                "Moats and boats and waterfalls"
            ],
            [
                275960,
                "Alleyways and pay phone calls"
            ],
            [
                284569,
                "Home is when"
            ],
            [
                285600,
                "I'm alone with you"
            ],
            [
                293000,
                "Home is when"
            ],
            [
                294081,
                "I'm alone with you"
            ]
        ]
    },
    {
        "name": "NCS - MATAFAKA",
        "lyrics": [
            [
                27769,
                "Matafaka, matafaka"
            ],
            [
                48000,
                "Matafaka, matafaka"
            ],
            [
                90696,
                "Uh, thank God that"
            ],
            [
                91960,
                "the brother's on the rise now"
            ],
            [
                93777,
                "Endless celebrations"
            ],
            [
                94772,
                "all at my house"
            ],
            [
                96300,
                "Levitatin' now I'm"
            ],
            [
                96935,
                "super duper fly now"
            ],
            [
                98696,
                "Lemon boy but they"
            ],
            [
                99560,
                "see why I reside now"
            ],
            [
                100900,
                "Put the time in while you"
            ],
            [
                102064,
                "always yellin' time out"
            ],
            [
                103700,
                "Fa critic 'cause I"
            ],
            [
                104218,
                "know I'm comin' wit it"
            ],
            [
                105761,
                "You were sittin"
            ],
            [
                106387,
                "you were wishin,"
            ],
            [
                106939,
                "I was handlin' my business"
            ],
            [
                108300,
                "Now I got the ball like"
            ],
            [
                109300,
                "Harry Potter playin' Quidditch"
            ],
            [
                110625,
                "And my nuts are so humongous"
            ],
            [
                111722,
                "you would think that"
            ],
            [
                112514,
                "Hagrid's in it"
            ],
            [
                113200,
                "Ah man, I'm all bad,"
            ],
            [
                114721,
                "yeah I'm all bad"
            ],
            [
                115888,
                "Workin' for that whip, yeah"
            ],
            [
                116989,
                "that what you call that"
            ],
            [
                118202,
                "I'ma blow up in the summer"
            ],
            [
                119437,
                "have 'em yellin', \"Fall back\""
            ],
            [
                120643,
                "And I've always been ahead"
            ],
            [
                121978,
                "like an effin ball cap"
            ],
            [
                123304,
                "Man, I came in the"
            ],
            [
                124329,
                "game like, \"Woah\""
            ],
            [
                125331,
                "Gotta couple chains on"
            ],
            [
                126412,
                "me 'cause I like gold"
            ],
            [
                127747,
                "They told me I'm the best,"
            ],
            [
                128733,
                "and I told 'em, \"I know\""
            ],
            [
                130350,
                "'Cause when I'm in your"
            ],
            [
                131188,
                "town every ticket I sold"
            ],
            [
                133589,
                "Yeah, they sayin' I'm"
            ],
            [
                134808,
                "the man, facts bro"
            ],
            [
                136591,
                "A lot of haters, tell"
            ],
            [
                137706,
                "me where they at though"
            ],
            [
                138864,
                "I'm the new pop all"
            ],
            [
                140018,
                "I do is rap dough"
            ],
            [
                141365,
                "\"Want me on your song?\""
            ],
            [
                142492,
                "Throw a couple stacks yo"
            ],
            [
                144500,
                "Everybody wanna"
            ],
            [
                145336,
                "do the same thing"
            ],
            [
                146754,
                "That's why we ain't"
            ],
            [
                148081,
                "on the same page"
            ],
            [
                149348,
                "Do my own thing,"
            ],
            [
                150200,
                "and I maintain"
            ],
            [
                151764,
                "Flow like water so"
            ],
            [
                152842,
                "I'm goin' mainstream"
            ],
            [
                155308,
                "I'm goin' mainstream"
            ],
            [
                156888,
                "Flow like water so"
            ],
            [
                157848,
                "I'm goin' mainstream"
            ],
            [
                160095,
                "Yeah, I'm goin' mainstream"
            ],
            [
                161840,
                "Flow like water so"
            ],
            [
                163000,
                "I'm goin' mainstream"
            ],
            [
                165600,
                "I'm going mainstream"
            ],
            [
                168300,
                "Mainstream"
            ],
            [
                172000,
                "Flow like water so"
            ],
            [
                173064,
                "I'm goin' mainstream"
            ],
            [
                177000,
                "Yup"
            ],
            [
                183615,
                "I'm goin' mainstream"
            ],
            [
                186930,
                "Damn"
            ],
            [
                192115,
                "Flow like water so"
            ],
            [
                193132,
                "I'm goin' mainstream"
            ],
            [
                196813,
                "Wooh"
            ],
            [
                203444,
                "I'm goin' mainstream"
            ],
            [
                212400,
                "Flow like water so"
            ],
            [
                213421,
                "I'm goin' mainstream"
            ],
            [
                215000,
                "They sayin' I'm"
            ],
            [
                215696,
                "the man, facts bro"
            ],
            [
                217369,
                "A lot of haters, tell"
            ],
            [
                218700,
                "me where they at though"
            ],
            [
                220000,
                "I'm the new pop all"
            ],
            [
                221080,
                "I do is rap dough"
            ],
            [
                222233,
                "\"Want me on your song?\""
            ],
            [
                223270,
                "Throw a couple stacks yo"
            ],
            [
                225138,
                "Everybody wanna"
            ],
            [
                226185,
                "do the same thing"
            ],
            [
                227662,
                "That's why we ain't"
            ],
            [
                228949,
                "on the same page"
            ],
            [
                230224,
                "Do my own thing,"
            ],
            [
                231500,
                "and I maintain"
            ],
            [
                232585,
                "Flow like water so"
            ],
            [
                233700,
                "I'm goin' mainstream"
            ],
            [
                236488,
                "I'm goin' mainstream"
            ],
            [
                237842,
                "Flow like water so"
            ],
            [
                238658,
                "I'm goin' mainstream"
            ],
            [
                240700,
                "Yeah, I'm goin' mainstream"
            ],
            [
                242696,
                "Flow like water so"
            ],
            [
                243800,
                "I'm goin' mainstream"
            ],
            [
                246489,
                "I'm goin' mainstream"
            ],
            [
                249308,
                "Mainstream"
            ],
            [
                252903,
                "Flow like water so"
            ],
            [
                253917,
                "I'm goin' mainstream"
            ]
        ]
    },
    {
        "name": "Nae Nae Niga",
        "lyrics": [
            [
                8895,
                "Zen me neng ku ne"
            ],
            [
                11200,
                "yi que hui hao da"
            ],
            [
                13800,
                "yi qie dou qu ba"
            ],
            [
                16252,
                "ni jiu de xiang zhe"
            ],
            [
                18750,
                "ji ran mei ban fa"
            ],
            [
                21295,
                "hai hen ta gan ma"
            ],
            [
                23751,
                "hai guan ta gan ma"
            ],
            [
                26166,
                "xin li yao ji de"
            ],
            [
                29600,
                "ni shi nae niga"
            ],
            [
                30400,
                "nae nae niga niga nae nae"
            ],
            [
                32300,
                "nae niga nae nae niga niga"
            ],
            [
                34000,
                "nae nae"
            ],
            [
                34609,
                "yang guang cai hong"
            ],
            [
                35868,
                "xiao bai ma"
            ],
            [
                37014,
                "nae niga nae niga"
            ],
            [
                39615,
                "wo shi nae niga nae nae"
            ],
            [
                40802,
                "niga niga nae nae"
            ],
            [
                42133,
                "nae niga nae nae niga niga"
            ],
            [
                44003,
                "nae nae"
            ],
            [
                44653,
                "yang guang cai hong"
            ],
            [
                46033,
                "xiao bai ma"
            ],
            [
                47300,
                "nae niga nae niga"
            ],
            [
                50169,
                "Hey, hey, hey, hey!"
            ],
            [
                52178,
                "Wooh, Wooh!"
            ],
            [
                57400,
                "nae niga nae niga"
            ],
            [
                77564,
                "yang guang cai hong"
            ],
            [
                78354,
                "xiao bai ma"
            ],
            [
                79719,
                "ni shi zui qiang da"
            ],
            [
                80517,
                "zui bang da"
            ],
            [
                80992,
                "zui liang da"
            ],
            [
                81591,
                "zui fa guang da"
            ],
            [
                82180,
                "lan bu zhu ni fa ya"
            ],
            [
                84336,
                "ni shi zui hao da"
            ],
            [
                85276,
                "zui qiao da"
            ],
            [
                85914,
                "zui miao da"
            ],
            [
                86630,
                "zui jiao ao da"
            ],
            [
                87243,
                "jin qing de sheng kai ba"
            ],
            [
                89038,
                "ni jiu shi"
            ],
            [
                89690,
                "zui xiang da"
            ],
            [
                90297,
                "zui bang da"
            ],
            [
                90917,
                "zui liang da"
            ],
            [
                91551,
                "zui fa guang da"
            ],
            [
                92220,
                "xin xu yao ni hong ta"
            ],
            [
                94604,
                "ni shi zui hao da"
            ],
            [
                95302,
                "zui qiao da"
            ],
            [
                95937,
                "zui miao da"
            ],
            [
                96563,
                "zui jiao ao da"
            ],
            [
                97263,
                "yang guang cai hong"
            ],
            [
                98401,
                "xiao bai ma"
            ],
            [
                103666,
                "sheng huo shi xiao hua"
            ],
            [
                106094,
                "bie ku zhe ting ta"
            ],
            [
                108657,
                "bie zai yi beng kua"
            ],
            [
                111163,
                "bu le shi ni sha"
            ],
            [
                113753,
                "xin yao ni hong ta"
            ],
            [
                116167,
                "yi qie hui hao da"
            ],
            [
                118635,
                "yi qie dou lai ba"
            ],
            [
                121270,
                "tian di sui ni shua"
            ],
            [
                124497,
                "ni shi nae niga"
            ],
            [
                125275,
                "nae nae niga niga nae nae"
            ],
            [
                127154,
                "nae niga nae nae niga niga"
            ],
            [
                128975,
                "nae nae"
            ],
            [
                129601,
                "yang guang cai hong"
            ],
            [
                130916,
                "xiao bai ma"
            ],
            [
                132101,
                "nae niga nae niga"
            ],
            [
                134470,
                "wo shi nae niga"
            ],
            [
                135321,
                "nae nae niga niga nae nae"
            ],
            [
                137115,
                "nae niga nae nae niga niga"
            ],
            [
                138971,
                "nae nae"
            ],
            [
                139607,
                "yang guang cai hong"
            ],
            [
                140881,
                "xiao bai ma"
            ],
            [
                142066,
                "nae niga nae niga"
            ],
            [
                145169,
                "Hey, hey, hey, hey!"
            ],
            [
                147208,
                "Wooh, wooh!"
            ],
            [
                152153,
                "nae niga nae niga, hey!"
            ],
            [
                172400,
                "yang guang cai hong"
            ],
            [
                173385,
                "xiao bai ma"
            ],
            [
                174569,
                "ni shi zui qiang da"
            ],
            [
                175347,
                "zui bang da"
            ],
            [
                175952,
                "zui liang da"
            ],
            [
                176554,
                "zui fa guang da"
            ],
            [
                177247,
                "lan bu zhu ni fa ya"
            ],
            [
                179387,
                "ni shi zui hao da"
            ],
            [
                180228,
                "zui qiao da"
            ],
            [
                180949,
                "zui miao da"
            ],
            [
                181574,
                "zui jiao ao da"
            ],
            [
                182227,
                "jin qing de sheng kai ba"
            ],
            [
                184067,
                "ni jiu shi"
            ],
            [
                184711,
                "zui xiang da"
            ],
            [
                185343,
                "zui bang da"
            ],
            [
                185933,
                "zui liang da"
            ],
            [
                186550,
                "zui fa guang da"
            ],
            [
                187179,
                "xin xu yao ni hong ta"
            ],
            [
                189452,
                "ni shi zui hao da"
            ],
            [
                190268,
                "zui qiao da"
            ],
            [
                190975,
                "zui miao da"
            ],
            [
                191571,
                "zui jiao ao da"
            ],
            [
                192170,
                "yang guang cai hong"
            ],
            [
                193399,
                "xiao bai ma"
            ],
            [
                194696,
                "ni shi zui qiang da"
            ],
            [
                195307,
                "zui bang da"
            ],
            [
                195957,
                "zui liang da"
            ],
            [
                196567,
                "zui fa guang da"
            ],
            [
                197189,
                "lan bu zhu ni fa ya"
            ],
            [
                199358,
                "ni shi zui hao da"
            ],
            [
                200265,
                "zui qiao da"
            ],
            [
                201047,
                "zui miao da"
            ],
            [
                201601,
                "zui jiao ao da"
            ],
            [
                202185,
                "jin qing de sheng kai ba"
            ],
            [
                204069,
                "ni jiu shi"
            ],
            [
                204751,
                "zui xiang da"
            ],
            [
                205406,
                "zui bang da"
            ],
            [
                205977,
                "zui liang da"
            ],
            [
                206586,
                "zui fa guang da"
            ],
            [
                207242,
                "xin xu yao ni hong ta"
            ],
            [
                209506,
                "ni shi zui hao da"
            ],
            [
                210288,
                "zui qiao da"
            ],
            [
                210953,
                "zui miao da"
            ],
            [
                211569,
                "zui jiao ao da"
            ],
            [
                212197,
                "yang guang cai hong"
            ],
            [
                213397,
                "xiao bai ma"
            ]
        ]
    },
    {
        "name": "Eminem - Mockingbird",
        "lyrics": [
            [
                2500,
                "Yeah"
            ],
            [
                4660,
                "I know sometimes"
            ],
            [
                6069,
                "Things may not always make"
            ],
            [
                7694,
                "sense to you right now"
            ],
            [
                10280,
                "But hey"
            ],
            [
                11950,
                "What Daddy always tell you?"
            ],
            [
                13956,
                "Straighten up, little soldier"
            ],
            [
                16466,
                "Stiffen up that upper lip"
            ],
            [
                19223,
                "What you cryin' about?"
            ],
            [
                21145,
                "You got me"
            ],
            [
                22300,
                "Hailie, I know you"
            ],
            [
                22990,
                "miss your mom,"
            ],
            [
                23812,
                "and I know you miss your dad"
            ],
            [
                25230,
                "When I'm gone, but I'm tryin'"
            ],
            [
                26202,
                "to give you the life"
            ],
            [
                26988,
                "that I never had"
            ],
            [
                28300,
                "I can see you're sad,"
            ],
            [
                28992,
                "even when you smile,"
            ],
            [
                30016,
                "even when you laugh"
            ],
            [
                31106,
                "I can see it in your eyes,"
            ],
            [
                32590,
                "deep inside you wanna cry"
            ],
            [
                33960,
                "'Cause you're scared,"
            ],
            [
                34686,
                "I ain't there, Daddy's wit'"
            ],
            [
                35379,
                "you in your prayers"
            ],
            [
                36623,
                "No more cryin',"
            ],
            [
                37405,
                "wipe them tears,"
            ],
            [
                38246,
                "Daddys here no more nightmares"
            ],
            [
                39615,
                "We gon' pull together"
            ],
            [
                40569,
                "through it, we gon' do it"
            ],
            [
                41752,
                "Lainie, Uncles crazy, aint he?"
            ],
            [
                43044,
                "Yeah, but he loves you, girl,"
            ],
            [
                44353,
                "and you better know it"
            ],
            [
                45323,
                "We're all we got in this world"
            ],
            [
                46579,
                "when it spins, when it swirls"
            ],
            [
                48098,
                "When it whirls, when it twirls"
            ],
            [
                49552,
                "two little beautiful girls"
            ],
            [
                51028,
                "Lookin' puzzled, in a daze,"
            ],
            [
                52361,
                "I know it's confusin' you"
            ],
            [
                53903,
                "Daddy's always on the move,"
            ],
            [
                55245,
                "Mama's always on the news"
            ],
            [
                56575,
                "I try to keep you sheltered"
            ],
            [
                57715,
                "from it, but somehow it seems"
            ],
            [
                59082,
                "The harder that I try"
            ],
            [
                59969,
                "to do that, the more"
            ],
            [
                60864,
                "it backfires on me"
            ],
            [
                61833,
                "All the things growin' up"
            ],
            [
                63335,
                "as Daddy that he had to see"
            ],
            [
                64708,
                "Daddy don't want you to see,"
            ],
            [
                66154,
                "but you see just as"
            ],
            [
                67046,
                "much as he did"
            ],
            [
                67926,
                "We did not plan it to be"
            ],
            [
                68888,
                "this way, your mother and me"
            ],
            [
                70435,
                "But things have got"
            ],
            [
                71106,
                "so bad between us, I don't"
            ],
            [
                72044,
                "see us ever bein' together"
            ],
            [
                73793,
                "ever again, like we used to"
            ],
            [
                75468,
                "be when we was teenagers"
            ],
            [
                76593,
                "But then, of course,"
            ],
            [
                77523,
                "everything always happens"
            ],
            [
                78831,
                "for a reason, I guess it was"
            ],
            [
                80170,
                "never meant to be"
            ],
            [
                81453,
                "But it's just somethin we have"
            ],
            [
                82548,
                "no control over, and that's"
            ],
            [
                83668,
                "what destiny is"
            ],
            [
                84602,
                "But no more worries,"
            ],
            [
                86073,
                "rest your head and go to sleep"
            ],
            [
                87303,
                "Maybe one day we'll wake up"
            ],
            [
                88708,
                "and thisll all just be a dream"
            ],
            [
                90204,
                "Now hush, little baby,"
            ],
            [
                92111,
                "don't you cry"
            ],
            [
                93499,
                "Everything's gonna be alright"
            ],
            [
                94800,
                "Stiffen that upper lip up,"
            ],
            [
                96705,
                "little lady, I told ya"
            ],
            [
                98402,
                "Daddy's here to hold ya"
            ],
            [
                99801,
                "through the night"
            ],
            [
                101108,
                "I know Mommy's not here"
            ],
            [
                102407,
                "right now and we dont know why"
            ],
            [
                104610,
                "We feel how we feel inside"
            ],
            [
                106486,
                "It may seem a little"
            ],
            [
                107675,
                "crazy, pretty baby"
            ],
            [
                109571,
                "But I promise Mama's"
            ],
            [
                111158,
                "gon' be alright"
            ],
            [
                112282,
                "Heh, it's funny"
            ],
            [
                113205,
                "I remember back one year when"
            ],
            [
                114970,
                "Daddy had no money"
            ],
            [
                116155,
                "Mommy wrapped the Christmas"
            ],
            [
                116999,
                "presents up and stuck 'em"
            ],
            [
                118014,
                "under the tree and said"
            ],
            [
                119100,
                "some of 'em were from me cause"
            ],
            [
                120211,
                "Daddy couldn't buy 'em"
            ],
            [
                121540,
                "Ill never forget that Chrismas"
            ],
            [
                122940,
                "I sat up the whole night"
            ],
            [
                124229,
                "crying cause Daddy felt"
            ],
            [
                125658,
                "like a bum see Daddy had a job"
            ],
            [
                126494,
                "But his job was to keep the"
            ],
            [
                128128,
                "food on the table for"
            ],
            [
                129196,
                "you and Mom and at the time,"
            ],
            [
                131111,
                "every house that we lived in"
            ],
            [
                132514,
                "Either kept gettin"
            ],
            [
                133400,
                "broken into and robbed or"
            ],
            [
                134869,
                "shot up on the block"
            ],
            [
                136000,
                "And your Mom was savin'"
            ],
            [
                137162,
                "money for you in a jar"
            ],
            [
                138696,
                "Tryin to start a piggy bank"
            ],
            [
                139884,
                "for you so you could"
            ],
            [
                140750,
                "go to college"
            ],
            [
                141465,
                "Almost had a thousand dollars"
            ],
            [
                142736,
                "til someone broke in"
            ],
            [
                144261,
                "and stole it an I know it hurt"
            ],
            [
                145577,
                "so bad it broke"
            ],
            [
                146341,
                "your Mama's heart"
            ],
            [
                147420,
                "And it seemed like everything"
            ],
            [
                148366,
                "was just startin to fall apart"
            ],
            [
                150200,
                "Mom and Dad was arguin' a lot"
            ],
            [
                151856,
                "So Mama moved back on to"
            ],
            [
                153313,
                "Chalmers in the flat,"
            ],
            [
                154425,
                "one-bedroom apartment"
            ],
            [
                155880,
                "And Dad moved back to the"
            ],
            [
                157000,
                "other side of 8 Mile on Novara"
            ],
            [
                158457,
                "And that's when Daddy went"
            ],
            [
                159775,
                "to California with his CD"
            ],
            [
                161518,
                "And met Dr. Dre, and flew"
            ],
            [
                162489,
                "you and Mama out to see me"
            ],
            [
                164118,
                "But Daddy had to work,"
            ],
            [
                165668,
                "you and Mama had to leave me"
            ],
            [
                167119,
                "Then you started seein"
            ],
            [
                168026,
                "Daddy on the TV"
            ],
            [
                169041,
                "And Mama didn't like it"
            ],
            [
                170491,
                "And you and Lainie were"
            ],
            [
                171657,
                "too young to understand it"
            ],
            [
                172886,
                "Papa was a rolling stone,"
            ],
            [
                174245,
                "Mama developed a habit"
            ],
            [
                175658,
                "And it all happened too fast"
            ],
            [
                177078,
                "for either one o us to grab it"
            ],
            [
                178465,
                "I'm just sorry you were there"
            ],
            [
                179870,
                "an had to witness it firsthand"
            ],
            [
                181304,
                "'Cause all I ever wanted to do"
            ],
            [
                182669,
                "was just make you proud"
            ],
            [
                184025,
                "Now I'm sittin' in this"
            ],
            [
                185275,
                "empty house just reminiscin'"
            ],
            [
                187070,
                "Lookin' at your baby pictures,"
            ],
            [
                188546,
                "it just trips me out"
            ],
            [
                189473,
                "To see how much you both"
            ],
            [
                190526,
                "have grown, it's almost like"
            ],
            [
                191481,
                "you're sisters now"
            ],
            [
                192969,
                "Wow, guess you pretty much are"
            ],
            [
                194732,
                "and Daddy's still here"
            ],
            [
                195851,
                "Lainie, I'm talkin' to you too"
            ],
            [
                197500,
                "Daddy's still here"
            ],
            [
                198829,
                "I like the sound of that, yeah"
            ],
            [
                200125,
                "its got a ring to it, dont it?"
            ],
            [
                201722,
                "Shh, Mama's only gone"
            ],
            [
                203030,
                "for the moment"
            ],
            [
                203962,
                "Now hush, little baby,"
            ],
            [
                205482,
                "don't you cry"
            ],
            [
                207053,
                "Everything's gonna be alright"
            ],
            [
                208832,
                "Stiffen that upper lip up,"
            ],
            [
                210235,
                "little lady, I told ya"
            ],
            [
                211972,
                "Daddy's here to hold ya"
            ],
            [
                213332,
                "through the night"
            ],
            [
                214487,
                "I know Mommy's not here"
            ],
            [
                215875,
                "right now and we dont know why"
            ],
            [
                218281,
                "We feel how we feel inside"
            ],
            [
                220129,
                "It may seem a little"
            ],
            [
                221169,
                "crazy, pretty baby"
            ],
            [
                223155,
                "But I promise Mama's"
            ],
            [
                224627,
                "gon' be alright"
            ],
            [
                225865,
                "And if you ask me to, Daddy's"
            ],
            [
                227328,
                "gonna buy you a mockingbird"
            ],
            [
                229718,
                "I'ma give you the world"
            ],
            [
                231082,
                "I'ma buy a diamond ring"
            ],
            [
                233000,
                "for you, I'ma sing for you"
            ],
            [
                234532,
                "I'll do anything for you"
            ],
            [
                236016,
                "to see you smile"
            ],
            [
                237228,
                "And if that mockingbird don't"
            ],
            [
                238843,
                "sing and that ring don't shine"
            ],
            [
                240982,
                "I'ma break that birdie's neck"
            ],
            [
                242699,
                "I'll go back to the"
            ],
            [
                243868,
                "jeweler who sold it to ya"
            ],
            [
                245633,
                "And make him eat every carat,"
            ],
            [
                247342,
                "don't fuck with Dad"
            ],
            [
                248564,
                "(Haha)"
            ]
        ]
    },
    {
        "name": "Yungatina - 7 Weeks 3 Days",
        "lyrics": [
            [
                15469,
                "When we met, I just knew"
            ],
            [
                18004,
                "That I already loved you,"
            ],
            [
                19907,
                "true, true"
            ],
            [
                22551,
                "I didn't even get it why"
            ],
            [
                26231,
                "Why you gotta stare"
            ],
            [
                27544,
                "with those eyes?"
            ],
            [
                30013,
                "I'm right across"
            ],
            [
                30735,
                "the dance floor"
            ],
            [
                32735,
                "Like it was just last night"
            ],
            [
                37240,
                "I didn't even get it why"
            ],
            [
                41076,
                "Why you gotta say goodbye?"
            ],
            [
                44700,
                "I should have called"
            ],
            [
                45400,
                "him by his last name"
            ],
            [
                47333,
                "It's been seven weeks"
            ],
            [
                48800,
                "and three days"
            ],
            [
                52110,
                "I should have called"
            ],
            [
                52836,
                "him by his last name"
            ],
            [
                55555,
                "It's been seven weeks"
            ],
            [
                56950,
                "and three days"
            ],
            [
                59519,
                "I should have called"
            ],
            [
                60300,
                "him by his last name"
            ],
            [
                62100,
                "It's been seven weeks"
            ],
            [
                63700,
                "and three days"
            ],
            [
                66830,
                "I should have called"
            ],
            [
                67542,
                "him by his last name"
            ],
            [
                70615,
                "It's been seven weeks"
            ],
            [
                71693,
                "and three days"
            ],
            [
                74500,
                "Boy, I let you in"
            ],
            [
                76969,
                "You didn't even have to knock"
            ],
            [
                81629,
                "An extra key on the first day"
            ],
            [
                85519,
                "I know the sheets"
            ],
            [
                86166,
                "by the first date"
            ],
            [
                89000,
                "We really made somethin'"
            ],
            [
                91869,
                "A miracle that most won't see"
            ],
            [
                96345,
                "But it meant a lot to me"
            ],
            [
                100109,
                "I don't get why you"
            ],
            [
                101018,
                "had to leave"
            ],
            [
                103768,
                "I should have called"
            ],
            [
                104521,
                "him by his last name"
            ],
            [
                106400,
                "It's been seven weeks"
            ],
            [
                107973,
                "and three days"
            ],
            [
                111125,
                "I should have called"
            ],
            [
                111856,
                "him by his last name"
            ],
            [
                114923,
                "It's been seven weeks"
            ],
            [
                116039,
                "and three days"
            ],
            [
                118539,
                "I should have called"
            ],
            [
                119300,
                "him by his last name"
            ],
            [
                121400,
                "It's been seven weeks"
            ],
            [
                122790,
                "and three days"
            ],
            [
                125950,
                "I should have called"
            ],
            [
                126769,
                "him by his last name"
            ],
            [
                129588,
                "It's been seven weeks"
            ],
            [
                130772,
                "and three days"
            ],
            [
                133396,
                "All my friends say, fuck you!"
            ],
            [
                136060,
                "But I can't even help"
            ],
            [
                137459,
                "but love you"
            ],
            [
                140736,
                "And even though you"
            ],
            [
                141636,
                "run me out dry"
            ],
            [
                144400,
                "I still think you're"
            ],
            [
                145200,
                "a decent guy, why?"
            ],
            [
                162979,
                "I should have called"
            ],
            [
                163662,
                "him by his last name"
            ],
            [
                165500,
                "It's been seven weeks"
            ],
            [
                166881,
                "and three days"
            ],
            [
                170180,
                "I should have called"
            ],
            [
                170973,
                "him by his last name"
            ],
            [
                173911,
                "It's been seven weeks"
            ],
            [
                175137,
                "and three days"
            ],
            [
                177631,
                "I should have called"
            ],
            [
                178249,
                "him by his last name"
            ],
            [
                181276,
                "It's been seven weeks"
            ],
            [
                182558,
                "and three days"
            ],
            [
                184969,
                "I should have called"
            ],
            [
                185700,
                "him by his last name"
            ],
            [
                187900,
                "It's been seven weeks"
            ],
            [
                189150,
                "and three days, days"
            ]
        ]
    },
    {
        "name": "ABBA - Gimme Gimme Gimme",
        "lyrics": [
            [
                36154,
                "Half past twelve"
            ],
            [
                38000,
                "And I'm watchin' the late show"
            ],
            [
                39927,
                "in my flat, all alone"
            ],
            [
                41861,
                "How I hate to spend"
            ],
            [
                42969,
                "the evening on my own"
            ],
            [
                46500,
                "Autumn winds"
            ],
            [
                47863,
                "Blowin' outside the window"
            ],
            [
                49851,
                "as I look around the room"
            ],
            [
                51900,
                "And it makes me so depressed"
            ],
            [
                53607,
                "to see the gloom"
            ],
            [
                57000,
                "There's not a soul out there"
            ],
            [
                60844,
                "No one to hear my prayer"
            ],
            [
                68506,
                "Gimme, gimme, gimme"
            ],
            [
                69925,
                "a man after midnight"
            ],
            [
                72489,
                "Won't somebody help me"
            ],
            [
                74042,
                "chase these shadows away?"
            ],
            [
                76630,
                "Gimme, gimme, gimme"
            ],
            [
                78054,
                "a man after midnight"
            ],
            [
                80310,
                "Take me through the darkness"
            ],
            [
                81940,
                "to the break of the day"
            ],
            [
                104666,
                "Movie stars"
            ],
            [
                106200,
                "Find the end of the rainbow"
            ],
            [
                108198,
                "with a fortune to win"
            ],
            [
                109961,
                "It's so different from"
            ],
            [
                111291,
                "the world I'm living in"
            ],
            [
                114765,
                "Tired of TV"
            ],
            [
                116600,
                "I open the window"
            ],
            [
                118221,
                "and I gaze into the night"
            ],
            [
                120176,
                "But there's nothing"
            ],
            [
                121208,
                "there to see, no one in sight"
            ],
            [
                125400,
                "There's not a soul out there"
            ],
            [
                129180,
                "No one to hear my prayer"
            ],
            [
                136897,
                "Gimme, gimme, gimme"
            ],
            [
                138365,
                "a man after midnight"
            ],
            [
                140688,
                "Won't somebody help me"
            ],
            [
                142380,
                "chase these shadows away?"
            ],
            [
                144997,
                "Gimme, gimme, gimme"
            ],
            [
                146500,
                "a man after midnight"
            ],
            [
                148517,
                "Take me through the darkness"
            ],
            [
                150330,
                "to the break of the day"
            ],
            [
                153273,
                "Gimme, gimme, gimme"
            ],
            [
                154461,
                "a man after midnight"
            ],
            [
                161278,
                "Gimme, gimme, gimme"
            ],
            [
                162487,
                "a man after midnight"
            ],
            [
                220555,
                "There's not a soul out there"
            ],
            [
                224478,
                "No one to hear my prayer"
            ],
            [
                232240,
                "Gimme, gimme, gimme"
            ],
            [
                233628,
                "a man after midnight"
            ],
            [
                236180,
                "Won't somebody help me"
            ],
            [
                237630,
                "chase these shadows away?"
            ],
            [
                240256,
                "Gimme, gimme, gimme"
            ],
            [
                241650,
                "a man after midnight"
            ],
            [
                243998,
                "Take me through the darkness"
            ],
            [
                245584,
                "to the break of the day"
            ],
            [
                248150,
                "Gimme, gimme, gimme"
            ],
            [
                249645,
                "a man after midnight"
            ],
            [
                251905,
                "Won't somebody help me"
            ],
            [
                253531,
                "chase these shadows away?"
            ],
            [
                256205,
                "Gimme, gimme, gimme"
            ],
            [
                257617,
                "a man after midnight"
            ],
            [
                259823,
                "Take me through the darkness"
            ],
            [
                261543,
                "to the break of the day"
            ]
        ]
    },
    {
        "name": "One Direction - What Makes You Beautiful",
        "lyrics": [
            [
                6755,
                "You're insecure,"
            ],
            [
                8671,
                "don't know what for"
            ],
            [
                10589,
                "You're turnin' heads"
            ],
            [
                11748,
                "when you walk through the door"
            ],
            [
                14387,
                "Don't need makeup"
            ],
            [
                16391,
                "to cover up (Huh)"
            ],
            [
                18249,
                "Bein' the way"
            ],
            [
                19524,
                "that you are is enough"
            ],
            [
                22869,
                "Everyone else in the"
            ],
            [
                24627,
                "room can see it"
            ],
            [
                26577,
                "Everyone else but you"
            ],
            [
                29762,
                "Baby, you light up my world"
            ],
            [
                31726,
                "like nobody else"
            ],
            [
                33550,
                "The way that you flip your"
            ],
            [
                35237,
                "hair gets me overwhelmed"
            ],
            [
                37467,
                "But when you smile at the"
            ],
            [
                39032,
                "ground, it ain't hard to tell"
            ],
            [
                41259,
                "You don't know, oh-oh,"
            ],
            [
                43862,
                "you dont know you're beautiful"
            ],
            [
                45827,
                "If only you saw what I can see"
            ],
            [
                48987,
                "You'll understand why"
            ],
            [
                50300,
                "I want you so desperately"
            ],
            [
                52731,
                "Right now I'm looking"
            ],
            [
                54185,
                "at you and I can't believe"
            ],
            [
                56701,
                "You don't know, oh-oh,"
            ],
            [
                59238,
                "you dont know you're beautiful"
            ],
            [
                61866,
                "oh-oh"
            ],
            [
                63040,
                "Thats what makes you beautiful"
            ],
            [
                68069,
                "So c-come on, you got it wrong"
            ],
            [
                72002,
                "To prove I'm right,"
            ],
            [
                73153,
                "I put it in a song"
            ],
            [
                75794,
                "I don't know why"
            ],
            [
                77767,
                "you're being shy"
            ],
            [
                79744,
                "And turn away when"
            ],
            [
                81014,
                "I look into your eyes"
            ],
            [
                84196,
                "Everyone else in the"
            ],
            [
                86069,
                "room can see it"
            ],
            [
                88046,
                "Everyone else but you"
            ],
            [
                91195,
                "Baby, you light up my"
            ],
            [
                92809,
                "world like nobody else"
            ],
            [
                95065,
                "The way that you flip your"
            ],
            [
                96730,
                "hair gets me overwhelmed"
            ],
            [
                98762,
                "But when you smile at the"
            ],
            [
                100486,
                "ground, it ain't hard to tell"
            ],
            [
                102677,
                "You don't know, oh-oh,"
            ],
            [
                105315,
                "you dont know you're beautiful"
            ],
            [
                107248,
                "If only you saw what I can see"
            ],
            [
                110359,
                "You'll understand why"
            ],
            [
                111673,
                "I want you so desperately"
            ],
            [
                114054,
                "Right now I'm looking"
            ],
            [
                115584,
                "at you and I can't believe"
            ],
            [
                118040,
                "You don't know, oh-oh,"
            ],
            [
                120610,
                "you dont know you're beautiful"
            ],
            [
                123285,
                "oh-oh"
            ],
            [
                124440,
                "Thats what makes you beautiful"
            ],
            [
                127023,
                "Na, na-na-na, na-na-na, na, na"
            ],
            [
                130275,
                "Na, na-na-na, na-na"
            ],
            [
                134269,
                "Na, na-na-na, na-na-na, na, na"
            ],
            [
                137947,
                "Na, na-na-na, na-na"
            ],
            [
                141065,
                "Baby, you light up my world"
            ],
            [
                143125,
                "like nobody else"
            ],
            [
                144946,
                "The way that you flip your"
            ],
            [
                146769,
                "hair gets me overwhelmed"
            ],
            [
                148797,
                "But when you smile at the"
            ],
            [
                150449,
                "ground, it ain't hard to tell"
            ],
            [
                152684,
                "(You don't know, oh-oh)"
            ],
            [
                155257,
                "You dont know you're beautiful"
            ],
            [
                156666,
                "Baby, you light up my world"
            ],
            [
                158415,
                "like nobody else"
            ],
            [
                160242,
                "The way that you flip your"
            ],
            [
                162099,
                "hair Cmon gets me overwhelmed"
            ],
            [
                164116,
                "But when you smile at the"
            ],
            [
                165735,
                "ground, it ain't hard to tell"
            ],
            [
                167975,
                "You don't know, oh-oh,"
            ],
            [
                170595,
                "you dont know you're beautiful"
            ],
            [
                172614,
                "If only you saw what I can see"
            ],
            [
                175609,
                "You'll understand why"
            ],
            [
                177025,
                "I want you so desperately"
            ],
            [
                179459,
                "Right now I'm looking"
            ],
            [
                180956,
                "at you and I can't believe"
            ],
            [
                183277,
                "You don't know oh-oh,"
            ],
            [
                185983,
                "you dont know you're beautiful"
            ],
            [
                188557,
                "oh-oh"
            ],
            [
                189807,
                "You dont know you're beautiful"
            ],
            [
                192498,
                "oh-oh"
            ],
            [
                193665,
                "Thats what makes you beautiful"
            ]
        ]
    },
    {
        "name": "The Coconut Song",
        "lyrics": [
            [
                300,
                "La la la, la la la la,"
            ],
            [
                2238,
                "la la la la la la"
            ],
            [
                3847,
                "La la la, la la la la,"
            ],
            [
                5872,
                "la la la la la la"
            ],
            [
                7549,
                "La la la, la la la la,"
            ],
            [
                9376,
                "la la la la la la"
            ],
            [
                11039,
                "La la la, la la la la,"
            ],
            [
                13054,
                "la la la la la la"
            ],
            [
                14624,
                "KO KO NUT"
            ],
            [
                16210,
                "KO KO KO KO NUT"
            ],
            [
                17620,
                "(kokonut)"
            ],
            [
                18469,
                "KO KO NUT"
            ],
            [
                19697,
                "KO KO KO KO KO NUT"
            ],
            [
                20974,
                "(kokonut)"
            ],
            [
                21913,
                "KO KO NUT"
            ],
            [
                23181,
                "KO KO KO KO KO NUT"
            ],
            [
                24576,
                "(kokonut)"
            ],
            [
                25476,
                "KO KO NUT"
            ],
            [
                26701,
                "KO KO KO KO KO NUT"
            ],
            [
                28647,
                "The kokonut nut"
            ],
            [
                30081,
                "Is a giant nut"
            ],
            [
                31813,
                "If you eat too much..."
            ],
            [
                33417,
                "You'll get VERY fat!!!"
            ],
            [
                35291,
                "Now"
            ],
            [
                35958,
                "The kokonut nut"
            ],
            [
                37331,
                "Is a big big nut"
            ],
            [
                38895,
                "But this delicious nut..."
            ],
            [
                40908,
                "Is NOT a nut!!!"
            ],
            [
                42719,
                "It's a koko fruit"
            ],
            [
                44502,
                "(It's a koko fruit)"
            ],
            [
                46268,
                "Of the koko tree"
            ],
            [
                47969,
                "(Of the koko tree)"
            ],
            [
                49835,
                "From the koko palm family"
            ],
            [
                52607,
                "La la la la la"
            ],
            [
                53940,
                "There are so many uses"
            ],
            [
                55274,
                "Of the kokonut tree"
            ],
            [
                57242,
                "You can build a bigger"
            ],
            [
                58512,
                "House for the family"
            ],
            [
                60656,
                "All you need is to"
            ],
            [
                62333,
                "Find the kokonut man"
            ],
            [
                64737,
                "If he cuts the tree..."
            ],
            [
                66302,
                "I get the fruits free!!!"
            ],
            [
                68421,
                "It's a koko fruit"
            ],
            [
                69966,
                "(It's a koko fruit)"
            ],
            [
                71725,
                "Of the koko tree"
            ],
            [
                73555,
                "(Of the koko tree)"
            ],
            [
                75320,
                "From the koko palm family"
            ],
            [
                78193,
                "La la la la la"
            ],
            [
                79695,
                "KO KO NUT"
            ],
            [
                81110,
                "KO KO KO KO KO NUT"
            ],
            [
                82697,
                "(kokonut)"
            ],
            [
                83559,
                "KO KO NUT"
            ],
            [
                84605,
                "KO KO KO KO KO NUT"
            ],
            [
                86567,
                "The kokonut bark for"
            ],
            [
                88286,
                "the kitchen floor"
            ],
            [
                89676,
                "If you save some of it..."
            ],
            [
                91561,
                "You can build a door"
            ],
            [
                93401,
                "Now"
            ],
            [
                94110,
                "The kokonut trunk"
            ],
            [
                95293,
                "Do not throw this junk"
            ],
            [
                97138,
                "If you save some of it..."
            ],
            [
                98638,
                "You'll have a second floor!!!"
            ],
            [
                101111,
                "The kokonut wood"
            ],
            [
                102480,
                "Is very good"
            ],
            [
                104428,
                "It can stand 20 years..."
            ],
            [
                106121,
                "If you pray it wood!!! :D"
            ],
            [
                107809,
                "Now"
            ],
            [
                108400,
                "The kokonut root"
            ],
            [
                109821,
                "To tell you the truth"
            ],
            [
                111387,
                "You can throw it..."
            ],
            [
                112719,
                "Or use it as firewood!!!"
            ],
            [
                115338,
                "The kokonut leaves"
            ],
            [
                117128,
                "Good shade it gives"
            ],
            [
                119053,
                "For the roof..."
            ],
            [
                119975,
                "For the walls up"
            ],
            [
                120928,
                "against the theives!!!"
            ],
            [
                122441,
                "Now"
            ],
            [
                123073,
                "The kokonut fruit"
            ],
            [
                124486,
                "Says my relatives"
            ],
            [
                126029,
                "Makes good cannon balls..."
            ],
            [
                128202,
                "Up against the thieves!!!"
            ],
            [
                129928,
                "It's a kokofruit"
            ],
            [
                131557,
                "(It's a koko fruit)"
            ],
            [
                133410,
                "Of the koko tree"
            ],
            [
                135216,
                "(Of the koko tree)"
            ],
            [
                137017,
                "From the koko palm family"
            ],
            [
                139702,
                "La la la la la"
            ],
            [
                141221,
                "The kokonut nut"
            ],
            [
                142560,
                "Is a giant nut"
            ],
            [
                144156,
                "If you eat too much..."
            ],
            [
                145809,
                "You'll get very fat!!!"
            ],
            [
                147732,
                "Now"
            ],
            [
                148402,
                "The kokonut nut"
            ],
            [
                149549,
                "Is a big big nut"
            ],
            [
                151303,
                "But this delicious nut..."
            ],
            [
                153317,
                "Is not a nut!!!"
            ],
            [
                154817,
                "The kokonut nut"
            ],
            [
                156762,
                "Is a giant nut"
            ],
            [
                158314,
                "If you eat too much..."
            ],
            [
                160037,
                "You'll get very fat!!!"
            ],
            [
                161888,
                "Now"
            ],
            [
                162400,
                "The kokonut nut"
            ],
            [
                163918,
                "Is a big big nut"
            ],
            [
                165493,
                "But this delicious nut..."
            ],
            [
                167340,
                "Is not a nut!!!"
            ],
            [
                168950,
                "It's a koko fruit"
            ],
            [
                170888,
                "(It's a koko fruit)"
            ],
            [
                172653,
                "Of the koko tree"
            ],
            [
                174400,
                "(Of the koko tree)"
            ],
            [
                176200,
                "From the koko palm family"
            ],
            [
                178924,
                "La la la la la"
            ],
            [
                180196,
                "It's a koko fruit"
            ],
            [
                181669,
                "(It's a koko fruit)"
            ],
            [
                183408,
                "Of the koko tree"
            ],
            [
                185268,
                "(Of the koko tree)"
            ],
            [
                186990,
                "From the koko palm family"
            ],
            [
                189803,
                "La la la la la la"
            ],
            [
                191000,
                "It's a koko fruit"
            ],
            [
                192319,
                "(It's a koko fruit)"
            ],
            [
                194359,
                "Of the koko tree"
            ],
            [
                196295,
                "(Of the koko tree)"
            ],
            [
                197913,
                "From the cocopalm familyyyyyyy"
            ],
            [
                202400,
                "La la la la la la la la la"
            ],
            [
                205269,
                "la la la la la la"
            ],
            [
                206900,
                "la la la la la"
            ],
            [
                208630,
                "Hooray"
            ]
        ]
    },
    {
        "name": "The Neighbourhood - Sweater Weather",
        "lyrics": [
            [
                20957,
                "And all I am is a man"
            ],
            [
                24559,
                "I want the world in my hands"
            ],
            [
                28200,
                "I hate the beach"
            ],
            [
                30535,
                "But I stand in California"
            ],
            [
                33901,
                "with my toes in the sand"
            ],
            [
                36100,
                "Use the sleeves of my sweater"
            ],
            [
                38119,
                "Let's have an adventure"
            ],
            [
                40288,
                "Head in the clouds"
            ],
            [
                41600,
                "but my gravity centered"
            ],
            [
                44140,
                "Touch my neck"
            ],
            [
                45844,
                "and I'll touch yours"
            ],
            [
                47931,
                "You in those little"
            ],
            [
                49358,
                "high waisted shorts, oh"
            ],
            [
                52969,
                "She knows what I think about"
            ],
            [
                55400,
                "And what I think about"
            ],
            [
                56800,
                "One love, two mouths"
            ],
            [
                58913,
                "One love, one house"
            ],
            [
                60607,
                "No shirt, no blouse"
            ],
            [
                62627,
                "Just us, you find out"
            ],
            [
                64384,
                "Nothing that I wouldn't wanna"
            ],
            [
                65400,
                "tell you about, no"
            ],
            [
                67000,
                "'Cause it's too cold"
            ],
            [
                71187,
                "For you here"
            ],
            [
                73917,
                "And now, so let me hold"
            ],
            [
                78878,
                "Both your hands in"
            ],
            [
                81500,
                "the holes of my sweater"
            ],
            [
                83666,
                "And if I may just take"
            ],
            [
                84600,
                "your breath away"
            ],
            [
                85633,
                "I don't mind if there's"
            ],
            [
                86521,
                "not much to say"
            ],
            [
                87546,
                "Sometimes the silence"
            ],
            [
                88333,
                "guides a mind"
            ],
            [
                89468,
                "To move to a place so far away"
            ],
            [
                91969,
                "The goosebumps start to raise"
            ],
            [
                93402,
                "The minute that my left hand"
            ],
            [
                94222,
                "meets your waist"
            ],
            [
                95900,
                "And then I watch your face"
            ],
            [
                97300,
                "Put my finger on your tongue"
            ],
            [
                98100,
                "'cause you love to taste, yeah"
            ],
            [
                100053,
                "These hearts adore, everyone"
            ],
            [
                101600,
                "the other beats hardest for"
            ],
            [
                103200,
                "Inside this place is warm"
            ],
            [
                105200,
                "Outside it starts to pour"
            ],
            [
                107945,
                "Coming down"
            ],
            [
                109001,
                "One love, two mouths"
            ],
            [
                111128,
                "One love, one house"
            ],
            [
                112974,
                "No shirt, no blouse"
            ],
            [
                114827,
                "Just us, you find out"
            ],
            [
                116573,
                "Nothing that I wouldn't wanna"
            ],
            [
                117363,
                "tell you about, no, no, no"
            ],
            [
                121456,
                "'Cause it's too cold"
            ],
            [
                125367,
                "For you here"
            ],
            [
                128136,
                "And now, so let me hold"
            ],
            [
                133068,
                "Both your hands in"
            ],
            [
                135730,
                "the holes of my sweater"
            ],
            [
                137000,
                "'Cause it's too cold"
            ],
            [
                141000,
                "For you here"
            ],
            [
                143643,
                "And now, so let me hold"
            ],
            [
                148544,
                "Both your hands in"
            ],
            [
                151275,
                "the holes of my sweater"
            ],
            [
                153503,
                "Whoa, whoa, whoa"
            ],
            [
                166200,
                "Whoa, whoa, whoa"
            ],
            [
                173900,
                "Whoa, whoa, whoa"
            ],
            [
                181651,
                "Whoa, whoa, whoa"
            ],
            [
                189360,
                "Whoa, whoa, whoa"
            ],
            [
                197069,
                "Whoa, whoa, whoa"
            ],
            [
                202500,
                "'Cause it's too cold"
            ],
            [
                206658,
                "For you here"
            ],
            [
                209372,
                "And now, so let me hold"
            ],
            [
                214380,
                "Both your hands in"
            ],
            [
                217034,
                "the holes of my sweater"
            ],
            [
                218300,
                "It's too cold"
            ],
            [
                222133,
                "For you here"
            ],
            [
                224871,
                "And now, let me hold"
            ],
            [
                229934,
                "Both your hands in"
            ],
            [
                232466,
                "the holes of my sweater"
            ],
            [
                235598,
                "And it's too cold,"
            ],
            [
                237606,
                "it's too cold"
            ],
            [
                240600,
                "The holes of my sweater"
            ]
        ]
    },
    {
        "name": "Eminem - Rap God",
        "lyrics": [
            [
                869,
                "Look,"
            ],
            [
                2000,
                "I was gonna go easy on"
            ],
            [
                2700,
                "you not to hurt your feelings"
            ],
            [
                4571,
                "But I'm only goin' to get"
            ],
            [
                6729,
                "this one chance"
            ],
            [
                9600,
                "Something's wrong,"
            ],
            [
                10300,
                "I can feel it"
            ],
            [
                11500,
                "Just a feelin' I've got, like"
            ],
            [
                14400,
                "somethings about to happen"
            ],
            [
                15885,
                "but I don't know what"
            ],
            [
                17674,
                "If that means what"
            ],
            [
                18369,
                "I think it means,"
            ],
            [
                19215,
                "we're in trouble, big trouble"
            ],
            [
                20924,
                "And if he is as bananas as you"
            ],
            [
                21858,
                "say, I'm not takin any chances"
            ],
            [
                24337,
                "ur just what the doc ordered"
            ],
            [
                25692,
                "I'm beginnin' to feel"
            ],
            [
                26904,
                "like a Rap God, Rap God"
            ],
            [
                28870,
                "All my people from the front"
            ],
            [
                30261,
                "to the back nod, back nod"
            ],
            [
                32046,
                "Now, who thinks their arms are"
            ],
            [
                33094,
                "long enough to slap box,"
            ],
            [
                34805,
                "slap box?"
            ],
            [
                35380,
                "They said I rap like a"
            ],
            [
                36093,
                "robot, so call me Rap-bot"
            ],
            [
                37624,
                "But for me to rap like a"
            ],
            [
                38500,
                "computer it mus be in my genes"
            ],
            [
                40059,
                "I got a laptop in"
            ],
            [
                40805,
                "my back pocket"
            ],
            [
                41681,
                "My pen'll go off when I"
            ],
            [
                42496,
                "half-cock it, got a fat knot"
            ],
            [
                43528,
                "from that rap profit"
            ],
            [
                44915,
                "Made a livin' and a killin off"
            ],
            [
                45748,
                "it, ever since Bill Clinton"
            ],
            [
                46998,
                "was still in office"
            ],
            [
                47873,
                "With Monica Lewinsky"
            ],
            [
                48595,
                "feelin' on his nut sack"
            ],
            [
                49858,
                "I'm an MC still as honest, but"
            ],
            [
                51014,
                "as rude and as"
            ],
            [
                51717,
                "indecent as all hell"
            ],
            [
                52606,
                "Syllables, skill-a-holic"
            ],
            [
                53804,
                "(kill 'em all with)"
            ],
            [
                54442,
                "This flippity dippity-hippity"
            ],
            [
                55162,
                "hip-hop, you dont really wanna"
            ],
            [
                56254,
                "get into a pissin' match"
            ],
            [
                57251,
                "With this rappity brat, packin"
            ],
            [
                58105,
                "a MAC in the back of the Ac',"
            ],
            [
                59491,
                "backpack rap crap,"
            ],
            [
                60298,
                "yap-yap, yackety-yack"
            ],
            [
                61261,
                "And at the exact same time, I"
            ],
            [
                62058,
                "attempt these lyrical acrobat"
            ],
            [
                63120,
                "stunts while im practicin that"
            ],
            [
                64296,
                "I'll still be able to break a"
            ],
            [
                65356,
                "motherfucking table over the"
            ],
            [
                66025,
                "back of a couple of fagots and"
            ],
            [
                66706,
                "crack it in half"
            ],
            [
                67499,
                "Only realized it was ironic, I"
            ],
            [
                68904,
                "was signed to aftermath"
            ],
            [
                70283,
                "after the fact"
            ],
            [
                71388,
                "How could I not blow?"
            ],
            [
                72231,
                "All I do is drop F-bombs,"
            ],
            [
                73299,
                "feel my wrath of attack"
            ],
            [
                74203,
                "Rappers are havin' a rough"
            ],
            [
                75074,
                "time period, here's a maxi pad"
            ],
            [
                76666,
                "It's actually disastrously bad"
            ],
            [
                78226,
                "for the wack while I'm"
            ],
            [
                79000,
                "masterfully constructin' this"
            ],
            [
                80222,
                "masterpiece"
            ],
            [
                80944,
                "'Cause I'm beginnin' to feel"
            ],
            [
                82017,
                "like a Rap God, Rap God"
            ],
            [
                84032,
                "All my people from the front"
            ],
            [
                85572,
                "to the back nod, back nod"
            ],
            [
                87142,
                "Now, who thinks their arms are"
            ],
            [
                88403,
                "long enough to slap box,"
            ],
            [
                89586,
                "slap box?"
            ],
            [
                90400,
                "Let me show u maintainin' this"
            ],
            [
                91696,
                "shit aint that hard, that hard"
            ],
            [
                93500,
                "Everybody want the key and the"
            ],
            [
                94455,
                "secret to rap immortality"
            ],
            [
                95700,
                "like Ι have got"
            ],
            [
                96890,
                "Well, to be truthful the"
            ],
            [
                97569,
                "blueprint's, simply rage and"
            ],
            [
                98765,
                "youthful exuberance"
            ],
            [
                99532,
                "Everybody loves to root for a"
            ],
            [
                100600,
                "nuisance, hit the Earth"
            ],
            [
                101500,
                "like an asteroid"
            ],
            [
                102105,
                "Did nothin' but shoot for"
            ],
            [
                103002,
                "the Moon since (pew)"
            ],
            [
                104200,
                "MCs get taken to school with"
            ],
            [
                105400,
                "this music 'cause I use it as"
            ],
            [
                106600,
                "a vehicle to, \"Bus the rhyme\""
            ],
            [
                107898,
                "Now I lead a new school"
            ],
            [
                108634,
                "full of students"
            ],
            [
                109600,
                "Me? I'm a product of Rakim,"
            ],
            [
                110984,
                "Lakim Shabazz, 2Pac, N.W.A,"
            ],
            [
                113125,
                "Cube, hey Doc, Ren"
            ],
            [
                114341,
                "Yella, Eazy, thank you,"
            ],
            [
                115046,
                "they got Slim"
            ],
            [
                115797,
                "Inspired enough to one day"
            ],
            [
                117043,
                "grow up, blow up and"
            ],
            [
                117859,
                "be in a position"
            ],
            [
                119182,
                "To meet Run–D.M.C.,"
            ],
            [
                120060,
                "and induct them into"
            ],
            [
                120957,
                "the motherfucking"
            ],
            [
                121683,
                "Rock n Roll Hall of Fame even"
            ],
            [
                123400,
                "though I'll walk in the church"
            ],
            [
                124400,
                "and burst in a ball of flames"
            ],
            [
                125700,
                "Only Hall of Fame I'll be"
            ],
            [
                126600,
                "inducted in is the alcohol of"
            ],
            [
                128108,
                "fame on the wall of (shame)"
            ],
            [
                129769,
                "You fags think it's all a game"
            ],
            [
                131300,
                "'til I walk a flock of flames"
            ],
            [
                133169,
                "Off a plank and, tell me what"
            ],
            [
                134400,
                "in the fuck are you thinkin'?"
            ],
            [
                135892,
                "Little gay lookin' boy,"
            ],
            [
                136766,
                "so gay I can barely say it"
            ],
            [
                138058,
                "with a straight face,"
            ],
            [
                138700,
                "lookin' boy (haha)"
            ],
            [
                139400,
                "You're witnessin' a mass-occur"
            ],
            [
                140200,
                "like you're watchin' a church"
            ],
            [
                140800,
                "gatherin' take place,"
            ],
            [
                141826,
                "lookin' boy"
            ],
            [
                142800,
                "\"Oy vey, that boy's gay\","
            ],
            [
                144300,
                "that's all they say,"
            ],
            [
                145100,
                "lookin' boy"
            ],
            [
                145750,
                "You get a thumbs up, pat on"
            ],
            [
                146500,
                "the back and a way to go from"
            ],
            [
                147600,
                "your label every day,"
            ],
            [
                148400,
                "lookin' boy"
            ],
            [
                149100,
                "Hey, lookin' boy,"
            ],
            [
                149700,
                "what you say, lookin' boy?"
            ],
            [
                150568,
                "I get a, hell yeah from Dre,"
            ],
            [
                151600,
                "lookin' boy"
            ],
            [
                152222,
                "I'ma work for everythin I have"
            ],
            [
                153600,
                "never asked nobody for shit,"
            ],
            [
                154569,
                "get outta my face, lookin' boy"
            ],
            [
                155500,
                "Basically, boy, you're never"
            ],
            [
                156217,
                "gonna be capable of keepin' up"
            ],
            [
                157541,
                "with the same pace,"
            ],
            [
                158120,
                "lookin' boy, 'cause"
            ],
            [
                158926,
                "I'm beginnin' to feel"
            ],
            [
                159869,
                "like a Rap God, Rap God"
            ],
            [
                161833,
                "All my people from the front"
            ],
            [
                163240,
                "to the back nod, back nod"
            ],
            [
                164998,
                "The way I'm racin' around the"
            ],
            [
                166100,
                "track, call me NASCAR, NASCAR"
            ],
            [
                168353,
                "Dale Earnhardt of the trailer"
            ],
            [
                169400,
                "park, the White Trash God"
            ],
            [
                170735,
                "Kneel before General Zod,"
            ],
            [
                172270,
                "this planet's Krypton,"
            ],
            [
                173131,
                "no, Asgard, Asgard"
            ],
            [
                174696,
                "So you'll be Thor,"
            ],
            [
                175589,
                "and I'll be Odin, you rodent,"
            ],
            [
                177098,
                "I'm omnipotent"
            ],
            [
                178400,
                "Let off, then I'm reloadin',"
            ],
            [
                179689,
                "immediately with these"
            ],
            [
                180700,
                "bombs I'm totin'"
            ],
            [
                181800,
                "And I should not be woken"
            ],
            [
                183200,
                "I'm the walkin' dead,"
            ],
            [
                183969,
                "but I'm just a talkin' head,"
            ],
            [
                185300,
                "a zombie floatin', but I got"
            ],
            [
                186900,
                "your mom deepthroating"
            ],
            [
                188030,
                "I'm out my Ramen Noodle, we"
            ],
            [
                189700,
                "have nothin' in common, poodle"
            ],
            [
                191142,
                "I'm a Doberman,"
            ],
            [
                191900,
                "pinch yourself in the arm"
            ],
            [
                192947,
                "and pay homage, pupil"
            ],
            [
                194603,
                "It's me, my honesty's brutal"
            ],
            [
                196940,
                "But it's honestly futile if I"
            ],
            [
                198600,
                "don't utilize what I do though"
            ],
            [
                200054,
                "For good, at least"
            ],
            [
                200844,
                "once in a while"
            ],
            [
                201495,
                "So I wanna make sure somewhere"
            ],
            [
                202500,
                "in this chicken scratch I"
            ],
            [
                203200,
                "scribble and doodle"
            ],
            [
                204052,
                "enough rhymes"
            ],
            [
                204750,
                "To maybe try to help get some"
            ],
            [
                205989,
                "people through tough times"
            ],
            [
                207200,
                "But I gotta keep a few"
            ],
            [
                207940,
                "punchlines just in case 'cause"
            ],
            [
                209300,
                "even you unsigned"
            ],
            [
                210200,
                "Rappers are hungry lookin'"
            ],
            [
                211269,
                "at me like it's lunchtime"
            ],
            [
                212800,
                "I know there was a time where"
            ],
            [
                213727,
                "once I was king of"
            ],
            [
                215000,
                "the underground"
            ],
            [
                215569,
                "But I still rap like I'm"
            ],
            [
                216269,
                "on my Pharoahe Monch grind"
            ],
            [
                217600,
                "So I crunch rhymes, but"
            ],
            [
                218652,
                "sometimes when you combine"
            ],
            [
                220169,
                "Appeal with the"
            ],
            [
                220700,
                "skin color of mine"
            ],
            [
                221765,
                "You get too big and here they"
            ],
            [
                222700,
                "come tryin' to censor"
            ],
            [
                223700,
                "you like that one line"
            ],
            [
                224800,
                "I said on, I'm back from"
            ],
            [
                225959,
                "The Mathers LP 1 when"
            ],
            [
                226969,
                "I tried to say I'll take seven"
            ],
            [
                228500,
                "kids from Columbine"
            ],
            [
                229996,
                "Put 'em all in a line, add an"
            ],
            [
                230900,
                "AK-47, a revolver and a .9"
            ],
            [
                233600,
                "See if I get away with it now"
            ],
            [
                234729,
                "that I ain't as big as I was,"
            ],
            [
                236100,
                "but I'm"
            ],
            [
                236747,
                "Morphin' into an immortal,"
            ],
            [
                238243,
                "comin' through the portal"
            ],
            [
                239259,
                "You're stuck in a time"
            ],
            [
                240150,
                "warp from 2004 though"
            ],
            [
                241570,
                "And I don't know what the"
            ],
            [
                242495,
                "fuck that you rhyme for"
            ],
            [
                243700,
                "You're pointless as Rapunzel"
            ],
            [
                244801,
                "with fuckin' cornrows"
            ],
            [
                246500,
                "You write normal?"
            ],
            [
                247159,
                "Fuck bein' normal"
            ],
            [
                248300,
                "And I just bought a new"
            ],
            [
                248822,
                "raygun from the future"
            ],
            [
                250061,
                "Just to come and shoot u, like"
            ],
            [
                251200,
                "when Fabolous made Ray J mad"
            ],
            [
                252681,
                "'Cause Fab said he looked like"
            ],
            [
                253570,
                "a fag at Mayweather's pad"
            ],
            [
                254347,
                "singin' to a man while"
            ],
            [
                255086,
                "he played piano"
            ],
            [
                256200,
                "Man, oh man, that was a 24-7"
            ],
            [
                257800,
                "special on the cable channel"
            ],
            [
                259427,
                "So Ray J went straight to the"
            ],
            [
                260300,
                "radio station, the very next"
            ],
            [
                261500,
                "day, \"Hey Fab, I'ma kill you\""
            ],
            [
                263300,
                "Lyrics comin' at you at"
            ],
            [
                263974,
                "supersonic speed"
            ],
            [
                265269,
                "Uh, summa-lumma, dooma-lumma,"
            ],
            [
                266400,
                "you assumin' I'm a human"
            ],
            [
                267400,
                "What I gotta do to get it"
            ],
            [
                268012,
                "through to you? I'm superhuman"
            ],
            [
                268835,
                "Innovative and I'm made of"
            ],
            [
                269800,
                "rubber so that anythin you say"
            ],
            [
                270749,
                "is ricochetin' off of me, and"
            ],
            [
                271540,
                "it'll glue to you and I'm"
            ],
            [
                272192,
                "devastatin', more than ever"
            ],
            [
                273013,
                "demonstratin', how to give a"
            ],
            [
                273815,
                "motherfuckin audience a feelin"
            ],
            [
                274623,
                "like it's levitatin'"
            ],
            [
                275527,
                "Never fadin' and I know the"
            ],
            [
                276240,
                "haters are forever waitin' for"
            ],
            [
                277200,
                "the day that they can say I"
            ],
            [
                277880,
                "fell off, theyll be celebratin"
            ],
            [
                278548,
                "Cause I know the way to get em"
            ],
            [
                279345,
                "motivated, I make elevatin'"
            ],
            [
                280300,
                "music, you make elevator music"
            ],
            [
                282083,
                "\"Oh, hes too mainstream\", well"
            ],
            [
                283404,
                "that's what they do when they"
            ],
            [
                284300,
                "get jealous, they confuse it"
            ],
            [
                285349,
                "\"It's not hip-hop, it's pop\""
            ],
            [
                286795,
                "'cause I found a"
            ],
            [
                287479,
                "hella way to fuse it"
            ],
            [
                288601,
                "With rock, shock rap with Doc,"
            ],
            [
                290291,
                "throw on \"Lose Yourself\""
            ],
            [
                290983,
                "and make 'em lose it"
            ],
            [
                291840,
                "I don't know how to make songs"
            ],
            [
                292759,
                "like that, I don't know"
            ],
            [
                293900,
                "what words to use"
            ],
            [
                295000,
                "Let me know when it occurs to"
            ],
            [
                295938,
                "you while I'm rippin' any one"
            ],
            [
                296842,
                "of these verses that versus u"
            ],
            [
                298032,
                "Its curtains, Im inadvertently"
            ],
            [
                299001,
                "hurtin' you, how many"
            ],
            [
                299832,
                "verses I gotta murder to"
            ],
            [
                301169,
                "Prove that if you were half as"
            ],
            [
                302346,
                "nice, your songs, you could"
            ],
            [
                303364,
                "sacrifice virgins too?"
            ],
            [
                304499,
                "Ugh, school flunky,"
            ],
            [
                306139,
                "pill junkie, but look at the"
            ],
            [
                307613,
                "accolades this skills brung me"
            ],
            [
                309365,
                "Full of myself,"
            ],
            [
                310078,
                "but still hungry"
            ],
            [
                311300,
                "I bully myself 'cause I make"
            ],
            [
                312340,
                "me do what I put my mind to"
            ],
            [
                314000,
                "And I'm a million leagues"
            ],
            [
                315700,
                "above you, ill when I"
            ],
            [
                316963,
                "speak in tongues"
            ],
            [
                317690,
                "But it's still"
            ],
            [
                318405,
                "tongue-in-cheek, fuck you"
            ],
            [
                319299,
                "I'm drunk, so, Satan, take the"
            ],
            [
                321000,
                "fucking wheel, I'ma sleep"
            ],
            [
                322100,
                "in the front seat"
            ],
            [
                322800,
                "Bumpin' Heavy D and the Boyz,"
            ],
            [
                324213,
                "still \"Chunky but Funky\""
            ],
            [
                326081,
                "But in my head"
            ],
            [
                326818,
                "there's somethin' I can feel"
            ],
            [
                327900,
                "tuggin' and strugglin'"
            ],
            [
                329252,
                "Angels fight with devils and"
            ],
            [
                330867,
                "here's what they want from me"
            ],
            [
                332900,
                "They're askin' me to eliminate"
            ],
            [
                333900,
                "some of the women hate"
            ],
            [
                334700,
                "But if you take into"
            ],
            [
                335400,
                "consideration the bitter"
            ],
            [
                336213,
                "hatred I have, then you may be"
            ],
            [
                337300,
                "a little patient, and more"
            ],
            [
                338115,
                "sympathetic to the situation"
            ],
            [
                339588,
                "And understand the"
            ],
            [
                340207,
                "discrimination"
            ],
            [
                341700,
                "But fuck it, life's handin you"
            ],
            [
                343240,
                "lemons? Make lemonade then"
            ],
            [
                344500,
                "But if I cant batter the women"
            ],
            [
                346000,
                "How the fuck am I supposed"
            ],
            [
                346834,
                "to bake 'em a cake, then?"
            ],
            [
                348300,
                "Don't mistake him for Satan"
            ],
            [
                349285,
                "It's a fatal mistake if you"
            ],
            [
                350269,
                "think I need to be overseas"
            ],
            [
                351533,
                "and take a vacation"
            ],
            [
                352717,
                "To trip a broad, and make"
            ],
            [
                353800,
                "her fall on her face and"
            ],
            [
                355148,
                "Don't be a retard, be a king?"
            ],
            [
                356976,
                "Think not, why be a king"
            ],
            [
                359100,
                "when you can be a God?"
            ]
        ]
    },
    {
        "name": "Tung Tung Tung Sahur - Ratatung",
        "lyrics": [
            [
                1,
                "Tung"
            ],
            [
                748,
                "Ratata ta tung"
            ],
            [
                2525,
                "Ratata ta tung"
            ],
            [
                4461,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                8293,
                "Ratata ta tung (hey)"
            ],
            [
                10300,
                "Ratata ta tung (hey)"
            ],
            [
                12090,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                15995,
                "Ratata ta tung (hey)"
            ],
            [
                17897,
                "Ratata ta tung (hey)"
            ],
            [
                19800,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                23200,
                "Crank it up,"
            ],
            [
                23867,
                "here's my master plan,"
            ],
            [
                25200,
                "Steal the crown like"
            ],
            [
                25969,
                "a wanted man,"
            ],
            [
                26993,
                "Pa pa pa pa da pa"
            ],
            [
                29200,
                "Tralelero Tralala"
            ],
            [
                30933,
                "Every hit is a battle won,"
            ],
            [
                32841,
                "Drop that sound like"
            ],
            [
                33700,
                "a smoking gun,"
            ],
            [
                34939,
                "Pa pa pa pa da pa"
            ],
            [
                36602,
                "Tralelero Tralala"
            ],
            [
                39269,
                "Can you feel it now,"
            ],
            [
                40947,
                "Rising through the crowd,"
            ],
            [
                42826,
                "I'm the one they play"
            ],
            [
                44444,
                "when the world gets loud!"
            ],
            [
                46369,
                "Hey!"
            ],
            [
                47000,
                "Ratata ta tung (hey)"
            ],
            [
                48610,
                "Ratata ta tung (hey)"
            ],
            [
                50422,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                54406,
                "Ratata ta tung (hey)"
            ],
            [
                56330,
                "Ratata ta tung (hey)"
            ],
            [
                58206,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                61600,
                "No..."
            ],
            [
                62400,
                "I don't like boring verses..."
            ],
            [
                64600,
                "So follow me!"
            ],
            [
                66969,
                "Tralalero Tralala"
            ],
            [
                69328,
                "Pa pa pa pa pa da pa pa"
            ],
            [
                71238,
                "Tralalero Tralala"
            ],
            [
                73088,
                "Pa pa pa pa pa da pa pa"
            ],
            [
                75000,
                "Tralalero Tralala"
            ],
            [
                76500,
                "Hey!"
            ],
            [
                77666,
                "Can you feel it now,"
            ],
            [
                79400,
                "Rising through the crowd,"
            ],
            [
                81300,
                "I'm the one they play"
            ],
            [
                82732,
                "when the world gets loud!"
            ],
            [
                84817,
                "Hey!"
            ],
            [
                85565,
                "Ratata ta tung (hey)"
            ],
            [
                87013,
                "Ratata ta tung (hey)"
            ],
            [
                89019,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                92700,
                "Ratata ta tung (hey)"
            ],
            [
                94640,
                "Ratata ta tung (hey)"
            ],
            [
                96590,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                100398,
                "Ratata ta tung (hey)"
            ],
            [
                102367,
                "Ratata ta tung (hey)"
            ],
            [
                104353,
                "Ratata ta tung tung tung SAHUR"
            ],
            [
                108210,
                "Ratata ta tung (hey)"
            ],
            [
                110035,
                "Ratata ta tung (hey)"
            ],
            [
                112012,
                "Ratata ta tung tung tung SAHUR"
            ]
        ]
    },
    {
        "name": "Quadeca - Candles On Fire",
        "lyrics": [
            [
                24800,
                "Woke up feeling mad today"
            ],
            [
                26300,
                "Bitch, im ugly, but"
            ],
            [
                26900,
                "I act like Timmy Chalamet, uh"
            ],
            [
                28666,
                "I hate these motherfuckers"
            ],
            [
                29400,
                "so, so much"
            ],
            [
                30221,
                "Why I keep on tryna get em"
            ],
            [
                31100,
                "all to validate me?"
            ],
            [
                32600,
                "Its no help, im living like,"
            ],
            [
                33500,
                "Oh well"
            ],
            [
                34359,
                "Like my English teacher said,"
            ],
            [
                35083,
                "had to show em, I dont tell"
            ],
            [
                36170,
                "I show em I dont fail,"
            ],
            [
                37100,
                "they knowin me so well"
            ],
            [
                38114,
                "I been catchin all the shade"
            ],
            [
                39007,
                "they've been throwin im, Odell"
            ],
            [
                41000,
                "Turn the cameras on"
            ],
            [
                42311,
                "Quick water break"
            ],
            [
                43005,
                "in the marathon"
            ],
            [
                44242,
                "Walk in your room"
            ],
            [
                45000,
                "and I set the mood"
            ],
            [
                45883,
                "They aint gotta light the"
            ],
            [
                46569,
                "Motherfuckin candles on fire"
            ],
            [
                48500,
                "Cant see without da cameras on"
            ],
            [
                50049,
                "Without a platform"
            ],
            [
                50800,
                "to be standin on, uh"
            ],
            [
                52369,
                "All this baggage"
            ],
            [
                52971,
                "going over they heads"
            ],
            [
                53817,
                "So I keep it underneath"
            ],
            [
                54725,
                "how I carry on, ooh"
            ],
            [
                56647,
                "Im goin crazy"
            ],
            [
                58024,
                "Too hot for Milan,"
            ],
            [
                58852,
                "had to add the AC (Woo)"
            ],
            [
                60035,
                "Guess whats gettin"
            ],
            [
                60696,
                "to em lately?"
            ],
            [
                61916,
                "They been takin shots at a boy"
            ],
            [
                63100,
                "I just say Cheese!"
            ],
            [
                64154,
                "I smell the green,"
            ],
            [
                64669,
                "thats synesthesia"
            ],
            [
                65332,
                "Growin up, im already"
            ],
            [
                66100,
                "too old for Chris D'Elia"
            ],
            [
                67245,
                "They tryna run they mouth,"
            ],
            [
                68169,
                "checkin in on that big career"
            ],
            [
                69242,
                "and look, its nada"
            ],
            [
                70202,
                "Voila, it disappeared, ok, ayy"
            ],
            [
                72006,
                "These sparks are fickle"
            ],
            [
                72830,
                "and simple-minded"
            ],
            [
                73590,
                "Flashlight in the dark"
            ],
            [
                74501,
                "how people gon get behind em"
            ],
            [
                75500,
                "I never killed my ego,"
            ],
            [
                76447,
                "its trippin on psilocybin"
            ],
            [
                77453,
                "That Shit'll kill me inside if"
            ],
            [
                78367,
                "they hear it and never mind-it"
            ],
            [
                79546,
                "Ive been gassed up, thats why"
            ],
            [
                80750,
                "they dont hold a candle to me"
            ],
            [
                81958,
                "Masked up way before"
            ],
            [
                82747,
                "it was a standard duty"
            ],
            [
                83811,
                "Back up, I came in this Shit"
            ],
            [
                85295,
                "Put my sticks in the ground so"
            ],
            [
                86367,
                "I sorry but you cant remove me"
            ],
            [
                88241,
                "Turn the cameras on"
            ],
            [
                89447,
                "Quick water break"
            ],
            [
                90095,
                "in the marathon"
            ],
            [
                91402,
                "Walk in your room"
            ],
            [
                92122,
                "and I set the mood"
            ],
            [
                93200,
                "They aint gotta light the"
            ],
            [
                94000,
                "Motherfuckin candles on fire"
            ],
            [
                95634,
                "Cant see without da cameras on"
            ],
            [
                97305,
                "Without a platform"
            ],
            [
                98000,
                "to be standin on, uh"
            ],
            [
                99511,
                "All this baggage"
            ],
            [
                100207,
                "going over they heads"
            ],
            [
                100981,
                "So I keep it underneath"
            ],
            [
                101830,
                "how I carry on, ooh"
            ],
            [
                107300,
                "They put the red dot"
            ],
            [
                107958,
                "right back on his head"
            ],
            [
                109466,
                "In fact, it never left"
            ],
            [
                110527,
                "Fuck a gold plaque,"
            ],
            [
                111249,
                "I want platinum instead, uh"
            ],
            [
                113200,
                "It wont matter no less"
            ],
            [
                114573,
                "All my nights sleepless,"
            ],
            [
                115363,
                "but my dreams still vivid"
            ],
            [
                116629,
                "Hole getting deeper,"
            ],
            [
                117342,
                "but the team still winnin"
            ],
            [
                118586,
                "Let me look around,"
            ],
            [
                119163,
                "like will you please love me?"
            ],
            [
                120491,
                "End up in the ground,"
            ],
            [
                121124,
                "will they still think of me"
            ],
            [
                122411,
                "Where they stil feel something"
            ],
            [
                123396,
                "Aint nobody laughing,"
            ],
            [
                124186,
                "but it still feels funny to me"
            ],
            [
                125621,
                "Its all a game, all these"
            ],
            [
                126461,
                "people just a number to me"
            ],
            [
                127550,
                "And what could it be?"
            ],
            [
                128369,
                "No matter how I feel you could"
            ],
            [
                129422,
                "bet I give em somethin to see"
            ],
            [
                130681,
                "Whats the price of"
            ],
            [
                131292,
                "living comfortably?"
            ],
            [
                132098,
                "All these numbers mind numbing"
            ],
            [
                132822,
                "to me, its nothin to me"
            ],
            [
                134266,
                "Get my pants tailored"
            ],
            [
                135111,
                "with the big pockets"
            ],
            [
                136033,
                "I dont give em much room"
            ],
            [
                136966,
                "when they Shit talkin, ayy"
            ],
            [
                139300,
                "Turn the cameras on"
            ],
            [
                140666,
                "Quick water break"
            ],
            [
                141500,
                "in the marathon"
            ],
            [
                142615,
                "Walk in your room"
            ],
            [
                143306,
                "and I set the mood"
            ],
            [
                144334,
                "They aint gotta light the"
            ],
            [
                145121,
                "Motherfuckin candles on fire"
            ],
            [
                146819,
                "Cant see without da cameras on"
            ],
            [
                148460,
                "Without a platform"
            ],
            [
                149221,
                "to be standin on, uh"
            ],
            [
                150747,
                "All this baggage"
            ],
            [
                151395,
                "going over they heads"
            ],
            [
                152229,
                "So I keep it underneath"
            ],
            [
                153003,
                "how I carry on, ooh"
            ],
            [
                155313,
                "Turn the cameras on"
            ],
            [
                158388,
                "Walk in your room"
            ],
            [
                159059,
                "and I set the mood"
            ],
            [
                160060,
                "They aint gotta light the"
            ],
            [
                160644,
                "Motherfuckin candles on fire"
            ],
            [
                163265,
                "Cameras on"
            ],
            [
                164276,
                "Without a platform"
            ],
            [
                164968,
                "to be standing on"
            ],
            [
                166336,
                "All this baggage"
            ],
            [
                167039,
                "going over they heads"
            ],
            [
                167882,
                "So I keep it underneath"
            ],
            [
                168792,
                "how I carry on, ooh"
            ],
            [
                174644,
                "The route up the ice ridge"
            ],
            [
                175560,
                "was hard but safe"
            ],
            [
                177296,
                "Boyson could watch the"
            ],
            [
                178419,
                "avalanches go by and"
            ],
            [
                180230,
                "even enjoy the view"
            ]
        ]
    },
    {
        "name": "Justin Bieber - Stay",
        "lyrics": [
            [
                30600,
                "I do the same"
            ],
            [
                31500,
                "thing I told you that"
            ],
            [
                32399,
                "I never would"
            ],
            [
                33325,
                "I told you I'd change,"
            ],
            [
                34347,
                "even when I knew I never could"
            ],
            [
                36018,
                "I know that I can't"
            ],
            [
                37133,
                "find nobody else as good as u"
            ],
            [
                38797,
                "I need you to stay,"
            ],
            [
                39822,
                "need you to stay, hey (oh)"
            ],
            [
                42100,
                "I get drunk,"
            ],
            [
                42869,
                "wake up,"
            ],
            [
                43755,
                "I'm wasted still"
            ],
            [
                44922,
                "I realize the time"
            ],
            [
                46235,
                "that I wasted here"
            ],
            [
                47700,
                "I feel like"
            ],
            [
                48511,
                "you can't feel the way I feel"
            ],
            [
                50479,
                "Oh, I'll be fucked up"
            ],
            [
                51699,
                "if you can't be right here"
            ],
            [
                53128,
                "Oh, ooh-woah"
            ],
            [
                54500,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                55948,
                "Oh, ooh-woah"
            ],
            [
                57416,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                58774,
                "Oh, ooh-woah"
            ],
            [
                59900,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                61387,
                "Oh, I'll be fucked up"
            ],
            [
                62959,
                "if you can't be right here"
            ],
            [
                64384,
                "I do the same"
            ],
            [
                65500,
                "thing I told you that"
            ],
            [
                66141,
                "I never would"
            ],
            [
                67188,
                "I told you I'd change,"
            ],
            [
                68218,
                "even when I knew I never could"
            ],
            [
                69909,
                "I know that I can't"
            ],
            [
                70925,
                "find nobody else as good as u"
            ],
            [
                72730,
                "I need you to stay,"
            ],
            [
                73869,
                "need you to stay, hey"
            ],
            [
                75800,
                "I do the same"
            ],
            [
                76800,
                "thing I told you that"
            ],
            [
                77600,
                "I never would"
            ],
            [
                78467,
                "I told you I'd change,"
            ],
            [
                79539,
                "even when I knew I never could"
            ],
            [
                81217,
                "I know that I can't"
            ],
            [
                82353,
                "find nobody else as good as u"
            ],
            [
                84004,
                "I need you to stay,"
            ],
            [
                85260,
                "need you to stay, hey"
            ],
            [
                87106,
                "When I'm away from you,"
            ],
            [
                88438,
                "I miss your touch (ooh)"
            ],
            [
                90057,
                "You're the reason"
            ],
            [
                90762,
                "I believe in love"
            ],
            [
                92876,
                "It's been difficult"
            ],
            [
                93817,
                "for me to trust (ooh)"
            ],
            [
                95653,
                "And I'm afraid that"
            ],
            [
                96320,
                "I'ma fuck it up"
            ],
            [
                98560,
                "Ain't no way"
            ],
            [
                99133,
                "that I can leave you stranded"
            ],
            [
                101364,
                "'Cause you ain't ever"
            ],
            [
                102100,
                "left me empty-handed"
            ],
            [
                104129,
                "And you know that I know that"
            ],
            [
                105810,
                "I can't live without you"
            ],
            [
                107823,
                "So, baby, stay"
            ],
            [
                109657,
                "Oh, ooh-woah"
            ],
            [
                111013,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                112382,
                "Oh, ooh-woah"
            ],
            [
                113799,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                115300,
                "Oh, ooh-woah"
            ],
            [
                116585,
                "(oh, ooh-woah, ooh-woah)"
            ],
            [
                117900,
                "I'll be fucked up"
            ],
            [
                119500,
                "if you can't be right here"
            ],
            [
                120900,
                "I do the same"
            ],
            [
                121900,
                "thing I told you that"
            ],
            [
                122800,
                "I never would"
            ],
            [
                123535,
                "I told you I'd change,"
            ],
            [
                124625,
                "even when I knew I never could"
            ],
            [
                126351,
                "I know that I can't"
            ],
            [
                127624,
                "find nobody else as good as u"
            ],
            [
                129142,
                "I need you to stay,"
            ],
            [
                130318,
                "need you to stay, hey"
            ],
            [
                132319,
                "I do the same"
            ],
            [
                133150,
                "thing I told you that"
            ],
            [
                134000,
                "I never would"
            ],
            [
                134775,
                "I told you I'd change,"
            ],
            [
                135978,
                "even when I knew I never could"
            ],
            [
                137614,
                "I know that I can't"
            ],
            [
                138753,
                "find nobody else as good as u"
            ],
            [
                140407,
                "I need you to stay,"
            ],
            [
                141500,
                "need you to stay, hey"
            ],
            [
                148700,
                "Woah-oh"
            ],
            [
                151991,
                "I need you to stay,"
            ],
            [
                152856,
                "need you to stay, hey"
            ]
        ]
    },
    {
        "name": "The Rare Occasions - Notion (Sped Up)",
        "lyrics": [
            [
                9932,
                "Sure, it's a calming notion,"
            ],
            [
                12416,
                "perpetual in motion"
            ],
            [
                15056,
                "But I don't need the comfort"
            ],
            [
                17680,
                "of any lies"
            ],
            [
                20399,
                "For I have seen the ending,"
            ],
            [
                22898,
                "and there is no ascending"
            ],
            [
                25952,
                "Ri"
            ],
            [
                26622,
                "Rii"
            ],
            [
                27168,
                "Riii"
            ],
            [
                27743,
                "Riii"
            ],
            [
                28371,
                "Riiiise"
            ],
            [
                30646,
                "Oh, back when I was younger,"
            ],
            [
                33277,
                "was told by other youngsters"
            ],
            [
                35861,
                "That my end will be torture"
            ],
            [
                38422,
                "beneath the earth"
            ],
            [
                41042,
                "'Cause I don't see what they see,"
            ],
            [
                43707,
                "when death is staring at me"
            ],
            [
                46361,
                "I see a window,"
            ],
            [
                47150,
                "a limit,"
            ],
            [
                47774,
                "to live it,"
            ],
            [
                48337,
                "or not at all"
            ],
            [
                75021,
                "If you could pull the lever"
            ],
            [
                77533,
                "to carry on forever"
            ],
            [
                80149,
                "Would your life even"
            ],
            [
                81883,
                "matter anymore?"
            ],
            [
                85414,
                "Sure, it's a calming notion,"
            ],
            [
                87982,
                "perpetual in motion"
            ],
            [
                90878,
                "But it's not"
            ],
            [
                91625,
                "what"
            ],
            [
                92168,
                "you"
            ],
            [
                92746,
                "signed"
            ],
            [
                93366,
                "up"
            ],
            [
                94665,
                "for"
            ],
            [
                107215,
                "I'm sure there won't"
            ],
            [
                108481,
                "always be sunshine"
            ],
            [
                112456,
                "But there's this momentary beam"
            ],
            [
                115801,
                "of light"
            ],
            [
                117407,
                "You don't have to wait"
            ],
            [
                118400,
                "those salty decades"
            ],
            [
                119935,
                "To get through the gate,"
            ],
            [
                121020,
                "it's all in front of your face"
            ],
            [
                122609,
                "I'm sure there won't"
            ],
            [
                124303,
                "always be sunshine"
            ],
            [
                128335,
                "I'm sure"
            ],
            [
                129280,
                "there won't always be sunshine"
            ],
            [
                133414,
                "But there's this momentary beam"
            ],
            [
                136886,
                "of light"
            ],
            [
                138210,
                "I could-could cross the ocean"
            ],
            [
                140617,
                "in a fit of devotion"
            ],
            [
                143351,
                "For every shining second,"
            ],
            [
                145923,
                "this fragile body beckons"
            ],
            [
                148660,
                "You think you're owed it better"
            ],
            [
                151008,
                "believing ancient letters"
            ],
            [
                153887,
                "Sure, it's a calming notion,"
            ],
            [
                156736,
                "but it's a lie"
            ],
            [
                157414,
                "but it's a liee"
            ],
            [
                157958,
                "but it's a lieee"
            ]
        ]
    },
    {
        "name": "Civilian - Close Call",
        "lyrics": [
            [
                4969,
                "I just gotta let you know"
            ],
            [
                7100,
                "Ever since you called me"
            ],
            [
                9100,
                "Im tearing up my schedule"
            ],
            [
                11069,
                "Cause I've been thinking"
            ],
            [
                11844,
                "about you all week"
            ],
            [
                13516,
                "When I get you alone"
            ],
            [
                15100,
                "I don't feel loved like"
            ],
            [
                15915,
                "I say I do"
            ],
            [
                17801,
                "Cause he's calling your phone"
            ],
            [
                19460,
                "I'm dodging bullets"
            ],
            [
                20305,
                "the shape of you"
            ],
            [
                22322,
                "Close call"
            ],
            [
                23488,
                "I hope you never call me again"
            ],
            [
                26418,
                "And so far"
            ],
            [
                27789,
                "We're farther gone than"
            ],
            [
                29174,
                "where we began"
            ],
            [
                30800,
                "I'll let these memories fade"
            ],
            [
                32800,
                "But I don't wanna forget"
            ],
            [
                35303,
                "I'll never be your best"
            ],
            [
                37501,
                "I'm letting you go"
            ],
            [
                43700,
                "I should've known"
            ],
            [
                44238,
                "it would end up like this"
            ],
            [
                45600,
                "Late night body"
            ],
            [
                46421,
                "to somebody I'd miss"
            ],
            [
                47821,
                "Don't say you need"
            ],
            [
                48777,
                "time for yourself"
            ],
            [
                49956,
                "You mean somebody else"
            ],
            [
                51700,
                "I know these days"
            ],
            [
                54081,
                "I feel like I'm better alone"
            ],
            [
                56946,
                "Sweet escape to me babe"
            ],
            [
                59598,
                "I'm letting you go"
            ],
            [
                61226,
                "Ill let these memories fade"
            ],
            [
                63500,
                "So you can leave"
            ],
            [
                64362,
                "my mind in peace"
            ],
            [
                65774,
                "We made it one week"
            ],
            [
                66539,
                "Want a piece of my mind"
            ],
            [
                67764,
                "Baby do this on me"
            ],
            [
                68758,
                "cause darling"
            ],
            [
                70100,
                "When I get you alone"
            ],
            [
                71695,
                "I don't feel loved"
            ],
            [
                72509,
                "like I say I do"
            ],
            [
                74500,
                "Cause he's calling your phone"
            ],
            [
                76125,
                "I'm dodging bullets"
            ],
            [
                76920,
                "in the shape of you"
            ],
            [
                78934,
                "Close call"
            ],
            [
                80069,
                "I hope you never call me again"
            ],
            [
                83038,
                "And so far"
            ],
            [
                84443,
                "We're farther gone than"
            ],
            [
                85899,
                "where we began"
            ],
            [
                87469,
                "I'll let these memories fade"
            ],
            [
                89705,
                "But I don't wanna forget"
            ],
            [
                91984,
                "I'll never be your best"
            ],
            [
                94169,
                "I'm letting you go"
            ],
            [
                96356,
                "Slow down (slow down)"
            ],
            [
                97400,
                "let go (let go)"
            ],
            [
                98600,
                "I won't call back like an echo"
            ],
            [
                100437,
                "I could change my mind"
            ],
            [
                101425,
                "like presto (presto)"
            ],
            [
                102608,
                "But my heads held high"
            ],
            [
                103647,
                "and my stress low"
            ],
            [
                105000,
                "Alright let's go"
            ],
            [
                107300,
                "Imma sign off like XO"
            ],
            [
                109569,
                "You had a shot at this"
            ],
            [
                110800,
                "A close call I'm"
            ],
            [
                111300,
                "the one you'll miss"
            ],
            [
                112600,
                "So come on now"
            ],
            [
                122369,
                "Girl I really thought"
            ],
            [
                122900,
                "I met my match"
            ],
            [
                124122,
                "But without you and I"
            ],
            [
                125001,
                "stroke it off like that"
            ],
            [
                126128,
                "Baby now Im cutting a lit fuse"
            ],
            [
                128476,
                "I see you in hindsight"
            ],
            [
                129366,
                "it's all in my rearview"
            ],
            [
                130769,
                "Our better days bind us"
            ],
            [
                131769,
                "let it fade behind us"
            ],
            [
                132844,
                "Tore us apart quicker"
            ],
            [
                133852,
                "than get away drivers"
            ],
            [
                135200,
                "I've been running"
            ],
            [
                136000,
                "from the day I knew"
            ],
            [
                137195,
                "I'm dodging bullets"
            ],
            [
                138007,
                "the shape of you"
            ],
            [
                140005,
                "Close call"
            ],
            [
                141256,
                "I hope you never call me again"
            ],
            [
                144125,
                "And so far"
            ],
            [
                145504,
                "We're farther gone than"
            ],
            [
                147030,
                "where we began"
            ],
            [
                148433,
                "I'll let these memories fade"
            ],
            [
                150816,
                "But I don't wanna forget"
            ],
            [
                153060,
                "I'll never be your best"
            ],
            [
                155240,
                "I'm letting you go"
            ]
        ]
    },
    {
        "name": "Pharmacist - North Memphis",
        "lyrics": [
            [
                11200,
                "Pharmacist motherfucker"
            ],
            [
                12500,
                "Project Pat don't give a fu-"
            ],
            [
                18400,
                "Project Pat don't give a fuck"
            ],
            [
                25485,
                "North Memphis nigga,"
            ],
            [
                26436,
                "North Memphis nigga"
            ],
            [
                27505,
                "North Memphis,"
            ],
            [
                28271,
                "North Memphis nigga"
            ],
            [
                29729,
                "Project Pat don't give a fuck"
            ],
            [
                31117,
                "North Memphis nigga,"
            ],
            [
                32182,
                "North Memphis nigga"
            ],
            [
                33275,
                "North Memphis-"
            ],
            [
                33984,
                "North Memphis nigga"
            ],
            [
                35500,
                "The definition of a player"
            ],
            [
                37392,
                "A nigga that play hoes"
            ],
            [
                38543,
                "to make the ends meet"
            ],
            [
                39696,
                "You gotta know the game,"
            ],
            [
                40700,
                "how it's played,"
            ],
            [
                41446,
                "it's all about thinkin' deep"
            ],
            [
                42521,
                "Sum' gonna cross you out,"
            ],
            [
                44000,
                "sum' gonna smoke you out"
            ],
            [
                45420,
                "But you can talk yo' ass"
            ],
            [
                46475,
                "off my Glock,"
            ],
            [
                47100,
                "I'm breakin' somethin' off"
            ],
            [
                48262,
                "Proper, I kick it at"
            ],
            [
                49514,
                "right up where the players at"
            ],
            [
                51116,
                "Bumpin', pimpin', smokin' sess"
            ],
            [
                52604,
                "with Dre and Ray-Ray"
            ],
            [
                53599,
                "in that mask"
            ],
            [
                54252,
                "We love to see these niggas"
            ],
            [
                55460,
                "sweat up on our bitch you see"
            ],
            [
                56901,
                "Drizzay hit them,"
            ],
            [
                57608,
                "baby, then we vampin'"
            ],
            [
                58579,
                "with them dead G's"
            ],
            [
                59969,
                "North Memphis niggas,"
            ],
            [
                60856,
                "North Memphis niggas"
            ],
            [
                61917,
                "North Memphis,"
            ],
            [
                62692,
                "North Memphis niggas"
            ],
            [
                64094,
                "Project Pat don't give a fuck"
            ],
            [
                65560,
                "North Memphis niggas,"
            ],
            [
                66595,
                "North Memphis niggas"
            ],
            [
                67687,
                "North Memphis,"
            ],
            [
                68412,
                "North Memphis niggas"
            ],
            [
                69838,
                "Project Pat don't give a fuck"
            ],
            [
                72700,
                "Pharmacist motherfucker"
            ]
        ]
    },
    {
        "name": "Maroon 5 - Payphone",
        "lyrics": [
            [
                179,
                "I'm at a payphone,"
            ],
            [
                2091,
                "trying to call home"
            ],
            [
                4345,
                "All of my change,"
            ],
            [
                5709,
                "I spent on you"
            ],
            [
                8651,
                "Where have the times gone?"
            ],
            [
                10780,
                "Baby, it's all wrong"
            ],
            [
                13016,
                "Where are the plans"
            ],
            [
                14361,
                "we made for two?"
            ],
            [
                17905,
                "Yeah, I,"
            ],
            [
                18857,
                "I know it's hard to remember"
            ],
            [
                21112,
                "the people we used to be"
            ],
            [
                23271,
                "It's even harder to picture"
            ],
            [
                25527,
                "that youre not here next to me"
            ],
            [
                27705,
                "You say it's too late"
            ],
            [
                28656,
                "to make it,"
            ],
            [
                29949,
                "but is it too late to try?"
            ],
            [
                32095,
                "And in our time that u wasted,"
            ],
            [
                33719,
                "all of our bridges burned down"
            ],
            [
                36374,
                "I've wasted my nights,"
            ],
            [
                38617,
                "you turned out the lights"
            ],
            [
                40828,
                "Now I'm paralyzed"
            ],
            [
                42992,
                "Still stuck in that time"
            ],
            [
                45198,
                "when we called it love"
            ],
            [
                47360,
                "But even the sun"
            ],
            [
                49492,
                "sets in paradise"
            ],
            [
                52516,
                "I'm at a payphone,"
            ],
            [
                54431,
                "trying to call home"
            ],
            [
                56638,
                "All of my change,"
            ],
            [
                58048,
                "I spent on you"
            ],
            [
                61013,
                "Where have the times gone?"
            ],
            [
                63149,
                "Baby, it's all wrong"
            ],
            [
                65297,
                "Where are the plans"
            ],
            [
                66710,
                "we made for two?"
            ],
            [
                69731,
                "If happy-ever-afters did exist"
            ],
            [
                74013,
                "I would still be"
            ],
            [
                75175,
                "holding you like this"
            ],
            [
                78365,
                "All those fairy tales"
            ],
            [
                79794,
                "are full of shit"
            ],
            [
                82735,
                "One more fucking love song,"
            ],
            [
                84695,
                "I'll be sick,"
            ],
            [
                87219,
                "oh, yeah"
            ],
            [
                88809,
                "U turned your back on tomorrow"
            ],
            [
                90918,
                "'cause you forgot yesterday"
            ],
            [
                92930,
                "I gave you my love to borrow,"
            ],
            [
                95180,
                "but you just gave it away"
            ],
            [
                97559,
                "You can't expect me to be fine"
            ],
            [
                99757,
                "I don't expect you to care"
            ],
            [
                101831,
                "I know I said it before, but"
            ],
            [
                103585,
                "all of our bridges burned down"
            ],
            [
                106288,
                "I've wasted my nights,"
            ],
            [
                108424,
                "you turned out the lights"
            ],
            [
                110645,
                "Now I'm paralyzed (oh)"
            ],
            [
                112876,
                "Still stuck in that time"
            ],
            [
                115055,
                "when we called it love"
            ],
            [
                117183,
                "But even the sun"
            ],
            [
                119321,
                "sets in paradise"
            ],
            [
                122100,
                "I'm at a payphone,"
            ],
            [
                124275,
                "trying to call home"
            ],
            [
                126435,
                "All of my change,"
            ],
            [
                127888,
                "I spent on you"
            ],
            [
                130200,
                "(oh-oh)"
            ],
            [
                131000,
                "Where have the times gone?"
            ],
            [
                132988,
                "Baby, it's all wrong"
            ],
            [
                135184,
                "Where are the plans"
            ],
            [
                136400,
                "we made for two?"
            ],
            [
                138900,
                "(Yeah)"
            ],
            [
                139590,
                "If happy-ever-afters did exist"
            ],
            [
                143818,
                "I would still be"
            ],
            [
                144927,
                "holding you like this"
            ],
            [
                148219,
                "And all those fairy tales"
            ],
            [
                149631,
                "are full of shit"
            ],
            [
                152597,
                "One more fucking love song,"
            ],
            [
                154488,
                "I'll be sick"
            ],
            [
                156952,
                "Now I'm at a payphone"
            ],
            [
                158984,
                "Man, fuck that shit"
            ],
            [
                160307,
                "I be out spendin' all this"
            ],
            [
                161280,
                "money while you sittin' 'round"
            ],
            [
                162546,
                "Wondering why it wasn't"
            ],
            [
                163519,
                "you who came up from nothin'"
            ],
            [
                164602,
                "Made it from the bottom,"
            ],
            [
                165388,
                "now when you see me im stuntin"
            ],
            [
                166969,
                "And all of my cars start"
            ],
            [
                167813,
                "with the push of a button"
            ],
            [
                169057,
                "Telling me I changed since I"
            ],
            [
                170000,
                "blew up or whatever u call it"
            ],
            [
                171414,
                "Switched the number to my"
            ],
            [
                172309,
                "phone so u never could call it"
            ],
            [
                173612,
                "Don't need my name on my shirt"
            ],
            [
                174775,
                "you can tell that I'm ballin'"
            ],
            [
                175811,
                "Swish, what a shame,"
            ],
            [
                176920,
                "coulda got picked"
            ],
            [
                178085,
                "Had a really good game,"
            ],
            [
                179208,
                "but you missed your last shot"
            ],
            [
                180237,
                "So you talk about who"
            ],
            [
                181177,
                "you see at the top"
            ],
            [
                182055,
                "Or what you could've saw,"
            ],
            [
                182951,
                "but sad to say, it's over for"
            ],
            [
                184500,
                "Phantom pulled up,"
            ],
            [
                185226,
                "valet opened doors"
            ],
            [
                186771,
                "Wished I'd go away,"
            ],
            [
                187383,
                "got what you was looking for"
            ],
            [
                188867,
                "Now it's me who they want"
            ],
            [
                190069,
                "So you can go and take that"
            ],
            [
                191008,
                "little piece of shit with you"
            ],
            [
                191889,
                "I'm at a payphone,"
            ],
            [
                194064,
                "trying to call home"
            ],
            [
                196260,
                "All of my change,"
            ],
            [
                197507,
                "I spent on you"
            ],
            [
                200700,
                "Where have the times gone?"
            ],
            [
                202788,
                "Baby, it's all wrong"
            ],
            [
                204942,
                "Where are the plans"
            ],
            [
                206321,
                "we made for two?"
            ],
            [
                209188,
                "If happy-ever-afters did exist"
            ],
            [
                213603,
                "I would still be"
            ],
            [
                214822,
                "holding you like this"
            ],
            [
                217947,
                "And all these fairy tales"
            ],
            [
                219502,
                "are full of shit"
            ],
            [
                222418,
                "One more fucking love song,"
            ],
            [
                224266,
                "I'll be sick"
            ],
            [
                226662,
                "Now I'm at a payphone"
            ]
        ]
    },
    {
        "name": "Passenger - Let Her Go",
        "lyrics": [
            [
                26400,
                "Well you only need the light"
            ],
            [
                27899,
                "when it's burning low"
            ],
            [
                29855,
                "Only miss the sun"
            ],
            [
                31117,
                "when it starts to snow"
            ],
            [
                33347,
                "Only know you love her"
            ],
            [
                34336,
                "when you let her go"
            ],
            [
                39439,
                "Only know you've been high"
            ],
            [
                40775,
                "when you're feeling low"
            ],
            [
                42841,
                "Only hate the road"
            ],
            [
                44015,
                "when you're missing home"
            ],
            [
                46122,
                "Only know you love her"
            ],
            [
                47285,
                "when you let her go"
            ],
            [
                52313,
                "And you let her go"
            ],
            [
                65956,
                "Staring at the bottom"
            ],
            [
                66900,
                "of your glass"
            ],
            [
                68300,
                "Hoping one day"
            ],
            [
                69500,
                "you'll make a dream last"
            ],
            [
                71303,
                "But dreams come slow"
            ],
            [
                72582,
                "and they go so fast"
            ],
            [
                78200,
                "You see her when"
            ],
            [
                78969,
                "you close your eyes"
            ],
            [
                80876,
                "Maybe one day"
            ],
            [
                82064,
                "you'll understand why"
            ],
            [
                84057,
                "Everything you touch"
            ],
            [
                85500,
                "surely dies"
            ],
            [
                90192,
                "But you only need the light"
            ],
            [
                91513,
                "when it's burning low"
            ],
            [
                93472,
                "Only miss the sun"
            ],
            [
                94655,
                "when it starts to snow"
            ],
            [
                96800,
                "Only know you love her"
            ],
            [
                97925,
                "when you let her go"
            ],
            [
                103050,
                "Only know you've been high"
            ],
            [
                104275,
                "when you're feeling low"
            ],
            [
                106400,
                "Only hate the road"
            ],
            [
                107444,
                "when you're missing home"
            ],
            [
                109550,
                "Only know you love her"
            ],
            [
                110644,
                "when you let her go"
            ],
            [
                116791,
                "Staring at the ceiling"
            ],
            [
                117891,
                "in the dark"
            ],
            [
                119089,
                "Same old empty feeling"
            ],
            [
                121117,
                "in your heart"
            ],
            [
                122309,
                "'Cause love comes slow"
            ],
            [
                123523,
                "and it goes so fast"
            ],
            [
                129334,
                "Well you see her"
            ],
            [
                129897,
                "when you fall asleep"
            ],
            [
                131747,
                "But never to touch"
            ],
            [
                132860,
                "and never to keep"
            ],
            [
                134745,
                "'Cause you loved her too much"
            ],
            [
                136557,
                "and you dive too deep"
            ],
            [
                141231,
                "Well you only need the light"
            ],
            [
                142511,
                "when it's burning low"
            ],
            [
                144465,
                "Only miss the sun"
            ],
            [
                145685,
                "when it starts to snow"
            ],
            [
                147851,
                "Only know you love her"
            ],
            [
                148932,
                "when you let her go"
            ],
            [
                154031,
                "Only know you've been high"
            ],
            [
                155348,
                "when you're feeling low"
            ],
            [
                157488,
                "Only hate the road"
            ],
            [
                158563,
                "when you're missing home"
            ],
            [
                160648,
                "Only know you love her"
            ],
            [
                161857,
                "when you let her go"
            ],
            [
                166755,
                "And you let her go"
            ],
            [
                168900,
                "Oh oh"
            ],
            [
                170600,
                "oh no"
            ],
            [
                173269,
                "And you let her go"
            ],
            [
                175000,
                "Oh oh"
            ],
            [
                176962,
                "oh no"
            ],
            [
                179493,
                "Well you let her go"
            ],
            [
                192369,
                "'Cause you only need the light"
            ],
            [
                193883,
                "when it's burning low"
            ],
            [
                196030,
                "Only miss the sun"
            ],
            [
                197100,
                "when it starts to snow"
            ],
            [
                199172,
                "Only know you love her"
            ],
            [
                200329,
                "when you let her go"
            ],
            [
                205200,
                "Only know you've been high"
            ],
            [
                206663,
                "when you're feeling low"
            ],
            [
                208758,
                "Only hate the road"
            ],
            [
                209862,
                "when you're missing home"
            ],
            [
                212069,
                "Only know you love her"
            ],
            [
                213053,
                "when you let her go"
            ],
            [
                218200,
                "'Cause you only need the light"
            ],
            [
                219700,
                "when it's burning low"
            ],
            [
                221644,
                "Only miss the sun"
            ],
            [
                223000,
                "when it starts to snow"
            ],
            [
                225193,
                "Only know you love her"
            ],
            [
                226322,
                "when you let her go"
            ],
            [
                232045,
                "Only know you've been high"
            ],
            [
                233600,
                "when you're feeling low"
            ],
            [
                235969,
                "Only hate the road"
            ],
            [
                237100,
                "when you're missing home"
            ],
            [
                239696,
                "Only know you love her"
            ],
            [
                240900,
                "when you let her go"
            ],
            [
                246969,
                "And you let her go"
            ]
        ]
    },
    {
        "name": "Busta Rhymes - Taking Everything",
        "lyrics": [
            [811, "Yeah! Yeah! Yeah! Yeah!"],
            [3062, "Let's go! Let's go!"],
            [4300, "Let's go! Let's go!"],
            [5969, "Yeah! Yeah! Yeah! Yeah!"],
            [8300, "Let's go! Let's go!"],
            [9583, "Let's go! Let's go!"],
            [11464, "Yeah! Yeah! Yeah!"],
            [14149, "You ain't courageous enough,"],
            [15300, "most of you probably fold"],
            [16728, "You ain't willin' to face"],
            [17727, "the challenge acquire the gold"],
            [19395, "We only here to just retrieve"],
            [20486, "what you probably stole"],
            [22091, "Yeah! Yeah! Yeah! Yeah!"],
            [23228, "Yeah! Yeah! Yeah! Yeah!"],
            [24784, "You see steel, sharpen steel"],
            [26068, "when it's time for the go"],
            [27407, "We here to create such"],
            [28300, "a ruckus we all on a roll"],
            [30099, "To every challenge in the eye,"],
            [31361, "we don't play with the soul"],
            [32700, "No matter what you was told,"],
            [33800, "every rat find a hole"],
            [35455, "See it don't matter"],
            [36100, "what you thought"],
            [37000, "(Yeah! Yeah! Yeah!)"],
            [38029, "We takin' everything we want"],
            [39467, "(Whoa! Whoa! Whoa!)"],
            [40600, "Now don't forget it,"],
            [41383, "better know we come to get it"],
            [42791, "And we wit' it and"],
            [43587, "there's nothing better,"],
            [44499, "hope you know to play a sport"],
            [46112, "See it don't matter"],
            [46826, "what you thought"],
            [47686, "(Yeah! Yeah! Yeah!)"],
            [48757, "We takin' everything we want"],
            [50152, "(Whoa! Whoa! Whoa!)"],
            [51384, "Now don't forget it,"],
            [52129, "better know we come to get it"],
            [53545, "And we wit' it and"],
            [54247, "there's nothing better,"],
            [55194, "hope you know to play a sport"],
            [56688, "See all the greatness when"],
            [57660, "we come when the story is told"],
            [59390, "Can't put a timeline"],
            [60123, "on greatness it never gets old"],
            [61962, "Come get the scope when"],
            [62948, "we hot and you not"],
            [64182, "And we pull up and we come in"],
            [65559, "takin' everything you got, ugh"],
            [77969, "See it don't matter"],
            [78600, "what you thought"],
            [79400, "(Yeah! Yeah! Yeah!)"],
            [80600, "We takin' everything we want"],
            [82128, "(Whoa! Whoa! Whoa!)"],
            [83306, "Now don't forget it,"],
            [84008, "better know we come to get it"],
            [85400, "And we wit' it"],
            [86168, "and there's nothing better,"],
            [87072, "hope you know to play a sport"],
            [90200, "(Yeah! Yeah! Yeah!)"],
            [92800, "(Whoa! Whoa! Whoa!)"],
            [95460, "(Yeah! Yeah! Yeah!)"],
            [99169, "No matter what you thought,"],
            [100200, "you better believe we comin'"],
            [101900, "And if you thought"],
            [102500, "that we was playin',"],
            [103300, "let me show you something"],
            [104723, "So then we jump"],
            [105500, "and we swoop"],
            [106157, "and we dodge every bullet"],
            [107465, "It dont matter where they pull"],
            [108500, "up when they try to pull it"],
            [111200, "(Yeah! Yeah! Yeah!)"],
            [113666, "(Whoa! Whoa! Whoa!)"],
            [116853, "(Yeah! Yeah! Yeah!)"],
            [120796, "Better know we on the clock"],
            [122000, "and it's time to go (Yeah!)"],
            [123500, "Everything is tactical,"],
            [124500, "now enjoy the show (Yeah!)"],
            [126237, "Then we skip"],
            [126800, "and we bounce"],
            [127587, "and we hop"],
            [128100, "out of every situation"],
            [129392, "Best believe that"],
            [130212, "it's time to blow"],
            [131300, "See it don't matter"],
            [131900, "what you thought"],
            [132800, "(Yeah! Yeah! Yeah!)"],
            [133986, "We takin' everything we want"],
            [135446, "(Whoa! Whoa! Whoa!)"],
            [136666, "Now don't forget it,"],
            [137300, "better know we come to get it"],
            [138855, "And we wit' it"],
            [139400, "and there's nothing better,"],
            [140485, "hope you know to play a sport"],
            [150000, "Hah! Hah! Hah! Hah!"],
            [152700, "You know the heat melt,"],
            [153300, "better wear your seat belt"],
            [154500, "and strap up"],
            [155369, "You know we get a little crazy"],
            [156300, "every single time we ack up"],
            [157800, "I know that the way you see"],
            [158700, "us doin' it to 'em"],
            [159300, "I think you really,"],
            [159869, "really need to shack up"],
            [160600, "Yeah! Yeah! Yeah! Yeah!"],
            [168100, "Let's go! Let's go!"],
            [169400, "Let's go! Let's go!"],
            [173900, "See it don't matter"],
            [174600, "what you thought"],
            [175400, "(Yeah! Yeah! Yeah!)"],
            [176574, "We takin' everything we want"],
            [178100, "(Whoa! Whoa! Whoa!)"],
            [179300, "Now don't forget it,"],
            [180000, "better know we come to get it"],
            [181300, "And we wit' it"],
            [182000, "and there's nothing better,"],
            [183102, "hope you know to play a sport"],
            [184600, "See it don't matter"],
            [185300, "what you thought"],
            [186258, "(Yeah! Yeah! Yeah!)"],
            [187369, "We takin' everything we want"],
            [188817, "(Whoa! Whoa! Whoa!)"],
            [189900, "Now don't forget it,"],
            [190781, "better know we come to get it"],
            [192000, "And we wit' it"],
            [192852, "and there's nothing better,"],
            [193800, "hope you know to play a sport"]
        ]
    },
    {
        "name": "Italo Brothers - My Life is a Party",
        "lyrics": [
            [1400, "I say hey"],
[2600, "(I say hey)"],
[8381, "New York"],
[9800, "LA"],
[11310, "Berlin"],
[12900, "Say \"Hey!\""],
[14100, "To Tokyo"],
[16104, "Rio"],
[17405, "De Janeiro"],
[18900, "Here we go-go"],
[21045, "Hello,"],
[22449, "hello"],
[23759, "Can you just feel it,"],
[24900, "are you ready to go?"],
[27121, "Hello,"],
[28790, "hello"],
[30198, "Do you receive"],
[31686, "my echo?"],
[32856, "My life is a party,"],
[34905, "my home is the club"],
[36402, "I party like a rock star,"],
[38034, "dance until I drop"],
[39400, "My life is a party,"],
[41200, "my home is the club"],
[42847, "My stage is the dance floor,"],
[44460, "party never stops, stops, stop"],
[46200, "I say \"Hey\","],
[47729, "you say \"Ho\""],
[49299, "Turn it up,"],
[50919, "here we go-o"],
[52540, "I say \"Hey\","],
[54127, "you say \"Ho\""],
[55691, "Spin me 'round"],
[57297, "like a yo-yo"],
[72469, "DC, Paris"],
[75198, "Bel Air"],
[76755, "Say yeah"],
[78172, "To Monaco"],
[80000, "Santo-o"],
[81553, "Domingo,"],
[83091, "here we go, go"],
[84879, "Hello,"],
[86463, "hello"],
[87740, "Can you just feel it,"],
[88928, "are you ready to go?"],
[91100, "Hello,"],
[92800, "hello"],
[94223, "Do you receive"],
[95763, "my echo?"],
[96870, "My life is a party,"],
[98971, "my home is the club"],
[100412, "I party like a rock star,"],
[102021, "dance until I drop"],
[103405, "My life is a party,"],
[105367, "my home is the club"],
[106886, "My stage is the dance floor,"],
[108428, "party never stops, stops, stop"],
[110278, "I say \"Hey\","],
[111644, "you say \"Ho\""],
[113284, "Turn it up,"],
[114930, "here we go-o"],
[116524, "I say \"Hey\","],
[118176, "you say \"Ho\""],
[119700, "Spin me 'round"],
[121309, "like a yo-yo"],
[148300, "My life is a party,"],
[150200, "my home is the club"],
[151700, "I party like a rock star,"],
[153242, "dance until I drop"],
[154623, "My life is a party,"],
[156496, "my home is the club"],
[158063, "My stage is the dance floor,"],
[159617, "party never stops"],
[161169, "Are you ready?"],
[174100, "I say \"Hey\""]
        ]
    }
];

function getEl(id) {
    return document.getElementById(id);
}

/*
* Credits:
*
* UEHEHEH: A huge thanks for their  tech. since It's been incredibly helpful! - oe (wait since when did i say that)
*
* Visuals and Combats Mechanics:
*   - Yurio
*   - Rim
*   - Oe
*   - Brt3726
*
* Testers and Bug Reports:
*   - Laplace/Gowog
*   - Wat
*   - Savior
*   - Zen
*/


let serverID;
const delayWorker = `
let timeouts = {};
let intervals = {};

self.onmessage = (e) => {
const { type, id, delay } = e.data;

if (type === "setTimeout") {
    timeouts[id] = setTimeout(() => {
    self.postMessage({ type: "timeout", id });
    delete timeouts[id];
    }, delay);
}

else if (type === "clearTimeout") {
    if (timeouts[id]) {
    clearTimeout(timeouts[id]);
    delete timeouts[id];
    }
}

else if (type === "setInterval") {
    intervals[id] = setInterval(() => {
    self.postMessage({ type: "interval", id });
    }, delay);
}

else if (type === "clearInterval") {
    if (intervals[id]) {
    clearInterval(intervals[id]);
    delete intervals[id];
    }
}
};
`;

const blob = new Blob([delayWorker], { type: 'application/javascript' });
const worker1 = new Worker(URL.createObjectURL(blob));

let nextId = 0;
const workerList = {};

function workerSetTimeout(fn, delay) {
    const id = nextId++;
    workerList[id] = fn;
    worker1.postMessage({ type: "setTimeout", id, delay });
    return id;
}

function workerClearTimeout(id) {
    worker1.postMessage({ type: "clearTimeout", id });
    delete workerList[id];
}

function workerSetInterval(fn, delay) {
    const id = nextId++;
    workerList[id] = fn;
    worker1.postMessage({ type: "setInterval", id, delay });
    return id;
}

function workerClearInterval(id) {
    worker1.postMessage({ type: "clearInterval", id });
    delete workerList[id];
}

worker1.onmessage = (e) => {
    const { type, id } = e.data;
    if (!workerList[id]) return;

    if (type === "timeout") {
        workerList[id]();
        delete workerList[id];
    } else if (type === "interval") {
        workerList[id]();
    }
};

// CONFIG:
const config = {
    // RENDER:
    maxScreenWidth: 1920,
    maxScreenHeight: 1080,

    // SERVER:
    serverUpdateRate: 9,
    maxPlayers: 40,
    maxPlayersHard: this.maxPlayers + 10,
    collisionDepth: 6,
    minimapRate: 3000,

    // COLLISIONS:
    colGrid: 10,

    // CLIENT:
    clientSendRate: 5,

    // UI:
    healthBarWidth: 50,
    healthBarPad: 4.5,
    iconPadding: 15,
    iconPad: 0.9,
    deathFadeout: 3000,
    crownIconScale: 60,
    crownPad: 35,

    // CHAT:
    chatCountdown: 3000,
    chatCooldown: 500,

    // SANDBOX:
    isSandbox: window.location.hostname == "sandbox.moomoo.io" ? true : false,

    // PLAYER:
    maxAge: 100,
    gatherAngle: Math.PI / 2.6,
    gatherWiggle: 10,
    hitReturnRatio: 0.25,
    hitAngle: Math.PI / 2,
    playerScale: 35,
    playerSpeed: 0.0016,
    playerDecel: 0.993,
    nameY: 34,

    // CUSTOMIZATION:
    skinColors: ["#bf8f54", "#cbb091", "#896c4b",
        "#fadadc", "#ececec", "#c37373", "#4c4c4c", "#ecaff7", "#738cc3",
        "#8bc373"],

    // ANIMALS:
    animalCount: 7,
    aiTurnRandom: 0.06,
    cowNames: ["Sid", "Steph", "Bmoe", "Romn", "Jononthecool", "Fiona", "Vince", "Nathan", "Nick", "Flappy", "Ronald", "Otis", "Pepe", "Mc Donald", "Theo", "Fabz", "Oliver", "Jeff", "Jimmy", "Helena", "Reaper",
        "Ben", "Alan", "Naomi", "XYZ", "Clever", "Jeremy", "Mike", "Destined", "Stallion", "Allison", "Meaty", "Sophia", "Vaja", "Joey", "Pendy", "Murdoch", "Theo", "Jared", "July", "Sonia", "Mel", "Dexter", "Quinn", "Milky"],

    // WEAPONS:
    shieldAngle: Math.PI / 3,
    weaponVariants: [{
        id: 0,
        src: "",
        xp: 0,
        val: 1
    }, {
        id: 1,
        src: "_g",
        xp: 3000,
        val: 1.1
    }, {
        id: 2,
        src: "_d",
        xp: 7000,
        val: 1.18
    }, {
        id: 3,
        src: "_r",
        poison: true,
        xp: 12000,
        val: 1.18
    }],
    fetchVariant: function (player) {
        let tmpXP = player.weaponXP[player.weaponIndex] || 0;
        for (let i = weaponVariants.length - 1; i >= 0; --i) {
            if (tmpXP >= weaponVariants[i].xp) {
                return weaponVariants[i];
            }
        }
    },

    // NATURE:
    resourceTypes: ["wood", "food", "stone", "points"],
    areaCount: 7,
    treesPerArea: 9,
    bushesPerArea: 3,
    totalRocks: 32,
    goldOres: 7,
    riverWidth: 724,
    riverPadding: 114,
    waterCurrent: 0.0011,
    waveSpeed: 0.0001,
    waveMax: 1.3,
    treeScales: [150, 160, 165, 175],
    bushScales: [80, 85, 95],
    rockScales: [80, 85, 90],

    // BIOME DATA:
    snowBiomeTop: 2400,
    snowSpeed: 0.75,

    // DATA:
    maxNameLength: 15,

    // MAP:
    mapScale: 14400,
    mapPingScale: 40,
    mapPingTime: 2200,

    // VOLCANO:
    volcanoScale: 320,
    innerVolcanoScale: 100,
    volcanoAnimalStrength: 2,
    volcanoAnimationDuration: 3200,
    volcanoAggressionRadius: 1440,
    volcanoAggressionPercentage: 0.2,
    volcanoDamagePerSecond: -1,
    volcanoLocationX: 14400 - 440,
    volcanoLocationY: 14400 - 440,
};
window.config = config;

// UIS:
const UIS = {
    ads: {
        adCard: getEl("adCard"),
        adContainer: getEl("ad-container"),
        promoImg: getEl("promoImg"),
        promoImageHolder: getEl("promoImgHolder"),
        wideAdCard: getEl("wideAdCard"),
    },
    buttons: {
        store: getEl("storeButton"),
        alliance: getEl("allianceButton"),
        chat: getEl("chatButton"),
        enterGame: getEl("enterGame"),
        altchaCheckBox: getEl("altcha_checkbox"),
        partyButton: getEl("partyButton"),
        joinB: getEl("joinPartyButton"),
        settingsButton: getEl("settingsButton"),
        settingsButtonTitle: getEl("settingsButton").getElementsByTagName('span')[0],
    },
    resources: {
        food: getEl("foodDisplay"),
        wood: getEl("woodDisplay"),
        stone: getEl("stoneDisplay"),
        score: getEl("scoreDisplay"),
        kill: getEl("killCounter"),
    },
    global: {// i made this since im to lazy to make catagorize for them
        menuText: getEl("desktopInstructions"),
        setupCard: getEl("setupCard"),
        guideCard: getEl("guideCard"),
        gameUI: getEl("gameUI"),
        gameName: getEl("gameName"),
        mainMenu: getEl("mainMenu"),
        storeMenu: getEl("storeMenu"),
        nameInput: getEl("nameInput"),
        gameCanvas: getEl("gameCanvas"),
        gameContext: getEl("gameCanvas").getContext("2d"),
        mapDisplay: getEl("mapDisplay"),
        mapContext: getEl("mapDisplay").getContext("2d"),
        shutdownDisplay: getEl("shutdownDisplay"),
        pingDisplay: getEl("pingDisplay"),
        loadingText: getEl("loadingText"),
        diedText: getEl("diedText"),
        ageText: getEl("ageText"),
        ageBarBody: getEl("ageBarBody"),
        allianceMenu: getEl("allianceMenu"),
        allianceManager: getEl("allianceManager"),
        notificationDisplay: getEl("noticationDisplay"),
        leaderboardData: getEl("leaderboardData"),
        actionBar: getEl("actionBar"),
        playMusic: getEl("playMusic"),
        upgradeCounter: getEl("upgradeCounter"),
        chatBox: getEl("chatBox"),
        altcha: getEl("altcha")
    },
    holder: {
        menuCardHolder: getEl("menuCardHolder"),
        itemInfoHolder: getEl("itemInfoHolder"),
        upgradeHolder: getEl("upgradeHolder"),
        allianceHolder: getEl("allianceHolder"),
        skinColorHolder: getEl("skinColorHolder"),
        storeHolder: getEl("storeHolder"),
        chatHolder: getEl("chatHolder"),
    },
    server: {
        serverBrowser: getEl("serverBrowser"),
        nativeResolutionOption: getEl("nativeResolution"),
        showPingOption: getEl("showPing"),
    },
};
let menuText = UIS.global.menuText;
let setupCard = UIS.global.setupCard;
let guideCard = UIS.global.guideCard;
let gameName = UIS.global.gameName;
let gameUI = UIS.global.gameUI;
let mainMenu = UIS.global.mainMenu;
let storeMenu = UIS.global.storeMenu;
let nameInput = UIS.global.nameInput;
let gameCanvas = UIS.global.gameCanvas;
let gameContext = UIS.global.gameContext;
let mapDisplay = UIS.global.mapDisplay;
let mapContext = UIS.global.mapContext;
let shutdownDisplay = UIS.global.shutdownDisplay;
let pingDisplay = UIS.global.pingDisplay;
let loadingText = UIS.global.loadingText;
let diedText = UIS.global.diedText;
let ageText = UIS.global.ageText;
let ageBarBody = UIS.global.ageBarBody;
let allianceMenu = UIS.global.allianceMenu;
let allianceManager = UIS.global.allianceManager;
let notificationDisplay = UIS.global.notificationDisplay;
let leaderboardData = UIS.global.leaderboardData;
let actionBar = UIS.global.actionBar;
let playMusic = UIS.global.playMusic;
let upgradeCounter = UIS.global.upgradeCounter;
let chatBox = UIS.global.chatBox;
let altcha = UIS.global.altcha;

// BUTTON:
let storeButton = UIS.buttons.store;
let allianceButton = UIS.buttons.alliance;
let chatButton = UIS.buttons.chat;
let enterGameButton = UIS.buttons.enterGame;
let altchaButton = UIS.buttons.altchaCheckBox
let partyButton = UIS.buttons.partyButton;
let joinB = UIS.buttons.joinB;
let settingsButton = UIS.buttons.settingsButton;
let settingsButtonTitle = UIS.buttons.settingsButtonTitle;

chatButton.remove();

// RESOURCE:
let foodDisplay = UIS.resources.food;
let woodDisplay = UIS.resources.wood;
let stoneDisplay = UIS.resources.stone;
let scoreDisplay = UIS.resources.score;
let killCounter = UIS.resources.kill;


// ADS:
let adCard = UIS.ads.adCard;
let adContainer = UIS.ads.adContainer;
let promoImg = UIS.ads.promoImg;
let promoImageHolder = UIS.ads.promoImageHolder;
let wideAdCard = UIS.ads.wideAdCard;
let ads = Object.values(UIS.ads);
promoImg?.remove();
adCard?.remove();
wideAdCard?.remove();

// HOLDER:
let menuCardHolder = UIS.holder.menuCardHolder;
let itemInfoHolder = UIS.holder.itemInfoHolder;
let upgradeHolder = UIS.holder.upgradeHolder;
let allianceHolder = UIS.holder.allianceHolder;
let skinColorHolder = UIS.holder.skinColorHolder;
let storeHolder = UIS.holder.storeHolder;
let chatHolder = UIS.holder.chatHolder;

// SETTING:
let serverBrowser = UIS.server.serverBrowser;
let nativeResolutionOption = UIS.server.nativeResolutionOption;
let showPingOption = UIS.server.showPingOption;

// CTX || CONTEXT:
let mainContext = gameCanvas.getContext("2d");

// GAME UI;
function hover(html) {// sorry me was to lazy to DO THEM BY ONE
    html.style.opacity = '0';
    html.style.transition = 'opacity 0.5s ease, transform 0.3s ease';
    html.style.transform = 'scale(1)';
    html.onmouseover = function () {
        html.style.opacity = '1';
        html.style.transform = 'scale(1.05)';
    };
    html.onmouseout = function () {
        html.style.transform = 'scale(1)';
    };
}
let coolFont = document.createElement('link');
coolFont.href = "https://fonts.googleapis.com/css2?family=Lilita+One&display=swap";
coolFont.rel = "stylesheet";
document.head.appendChild(coolFont);
gameName.innerHTML = "MooMoo";
gameName.style.cssText = `
display: "none";
opacity: 0.85;
text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;
font-size: 100px;
font-family: 'Lilita One', sans-serif;
opacity: 0;
transition: opacity 0.5s ease;
`;
if (altcha) {
    altcha.style.display = 'none';
    let annoyingAltchaStuff = workerSetInterval(() => {
        if (altchaButton) {
            altchaButton.click();
            let verifyStateHTML = altcha.querySelector(".altcha-label span");
            if (verifyStateHTML) {
                let brokenAltcha = verifyStateHTML.textContent.trim() === "Verified" && enterGameButton.classList.contains("disabled")
                if (brokenAltcha) {
                    location.reload();
                }
                if (inGame) {
                    workerClearInterval(annoyingAltchaStuff);
                }
            }
        }
    });
}
promoImageHolder?.append(document.getElementById("skinColorHolder"));
document.getElementById("skinColorHolder").style.cssText = `
        display: flex;
        justify-content: center;
        gap: 10px;
        align-items: center;
        flex-wrap: nowrap;
        padding: 10px;
        background-color: rgba(0, 0, 0, 0.25);
        border-radius: 8px;`;

let serverMenu = document.createElement("div");
serverMenu.id = "serverMenu";
serverMenu.style.cssText = `
        position: fixed;
        top: 240px;
        left: 1250px;
        width: 280px;
        opacity: 0;
        height: auto;
        max-height: 275px;
        overflow-y: auto;
        background-color: rgba(0, 0, 0, 0.45);
        padding: 10px;
        border-radius: 8px;
        color: #fff;
        font-family: Arial, sans-serif;
        z-index: 1000;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        transition: opacity 0.3s ease-in-out;`;
document.body.appendChild(serverMenu);
let buttonContainer = document.createElement("div");
buttonContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 10px;
        margin-bottom: 15px;
        padding: 10px;`;
serverMenu.appendChild(buttonContainer);

let testServerButton = document.createElement("button");
testServerButton.textContent = "Join Test Server";
testServerButton.style.cssText = `
        background-color: #28a745;
        border: none;
        color: white;
        padding: 8px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;`;
testServerButton.addEventListener("click", async () => {
    let servers = await getServers();
    let testServer = servers.filter(server => server.playerCount === 0)
        .sort((a, b) => a.ping - b.ping)[0];

    if (testServer) {
        let newUrl = `${location.protocol}//${location.hostname}/?server=${testServer.region}:${testServer.name}`;
        window.location.href = newUrl;
    } else {
        alert("Wla Pang test server");
    }
});
buttonContainer.appendChild(testServerButton);

let largestServerButton = document.createElement("button");
largestServerButton.textContent = "Join Active Server";
largestServerButton.style.cssText = `
        background-color: #007bff;
        border: none;
        color: white;
        padding: 8px 10px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s;`;
largestServerButton.addEventListener("click", async () => {
    let servers = await getServers();
    let largestServer = servers.sort((a, b) => {
        if (a.playerCount === b.playerCount) return a.ping - b.ping;
        return b.playerCount - a.playerCount;
    })[0];

    if (largestServer) {
        let newUrl = `${location.protocol}//${location.hostname}/?server=${largestServer.region}:${largestServer.name}`;
        window.location.href = newUrl;
    } else {
        alert("wala nga ehh");
    }
});
buttonContainer.appendChild(largestServerButton);

let gameServers = document.createElement("div");
gameServers.id = "game_servers";
serverMenu.appendChild(gameServers);
let style = document.createElement("style");
style.innerHTML = `
        #game_servers::-webkit-scrollbar {
            width: 8px;
        }
        #game_servers::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
        }
        #game_servers::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.4);
            border-radius: 4px;
        }
        #game_servers::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.6);
        }`;
document.head.appendChild(style);
window.regionsName = {
    "eu-west": "Frankfurt",
    gb: "London",
    "us-east": "Miami",
    "us-west": "Silicon Valley",
    au: "Sydney",
    sg: "Singapore",
    saopaulo: "São Paulo"
};
async function getServers() {
    let currentMode = location.host.replace(/\.moomoo\.io/, "");
    let getRequestUrl = () => {
        if (/(sandbox|dev)/.test(currentMode)) {
            return `https://api-${currentMode}.moomoo.io/servers?v=1.26`;
        }
        return "https://api.moomoo.io/servers";
    };
    let response = await fetch(getRequestUrl());
    let servers = await response.json();
    await Promise.all(servers.map(async server => {
        let requestPingUrl = `https://${server.key}.${server.region}.moomoo.io/ping/`;
        let startTime = Date.now();
        try {
            await fetch(requestPingUrl);
            server.ping = Date.now() - startTime;
        } catch (error) {
            server.ping = Infinity;
        }
    }));

    return servers;
}
async function updateServers() {
    let servers = await getServers();
    let serversByRegion = {};
    servers.forEach(server => {
        serversByRegion[server.region] = serversByRegion[server.region] || [];
        serversByRegion[server.region].push(server);
    });

    let sortedServers = [];
    for (let region in serversByRegion) {
        sortedServers = sortedServers.concat(serversByRegion[region]);
    }
    sortedServers.sort((a, b) => {
        if (a.ping === b.ping) return b.playerCount - a.playerCount;
        return a.ping - b.ping;
    });
    let existingBoxes = {};
    gameServers.childNodes.forEach(box => {
        existingBoxes[box.dataset.serverKey] = box;
    });
    sortedServers.forEach(server => {
        let key = `${server.region}:${server.name}`;
        let serverBox = existingBoxes[key];

        if (!serverBox) {
            serverBox = document.createElement("div");
            serverBox.dataset.serverKey = key;
            serverBox.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                background-color: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                border-radius: 8px;
                margin: 3px 0;
                margin-bottom: 16px;
                margin-left: 10px;
                padding: 8px;
            `;
            gameServers.appendChild(serverBox);
        }
        let colorPlc = server.playerCount >= 25 ? "red" : server.playerCount >= 15 ? "orange" : "green";
        let pingColor = server.ping < 150 ? "green" : server.ping < 400 ? "orange" : server.ping < 5000 ? "red" : "black";

        serverBox.innerHTML = `
            ${window.regionsName[server.region] || server.region} ${server.name}
            (<span style="color: ${colorPlc};">${server.playerCount}</span>/${server.playerCapacity})
            <span style="color: ${pingColor};">${server.ping} ms</span>
        `;
        let joinB = serverBox.querySelector("button");
        if (!joinB) {
            joinB = document.createElement("button");
            joinB.textContent = "Join";
            joinB.style.cssText = `
                background-color: #007bff;
                border: none;
                color: white;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.3s;
            `;
            serverBox.appendChild(joinB);
        }
        joinB.onclick = () => {
            let newUrl = `${location.protocol}//${location.hostname}/?server=${server.region}:${server.name}`;
            window.location.href = newUrl;
        };
    });
}

updateServers();
let allServerPingInterval = workerSetInterval(updateServers, 5000);

promoImageHolder && hover(promoImageHolder);
hover(setupCard);
guideCard.remove();
let canvasWebGL = document.createElement("canvas");
canvasWebGL.id = "canvas-webgl";
canvasWebGL.className = "p-canvas-webgl";
mainMenu.appendChild(canvasWebGL);
getEl("canvas-webgl").style.cssText = `
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
            z-index: -1;
        `;

let _instance;
class Plane {
    constructor() {
        this.uniforms = {
            time: { type: 'f', value: 0 },
            ucolor: { type: 'v3', value: new THREE.Vector3(1., 1., 1.) },
            uopacity: { type: 'f', value: 1.0 }
        };
        this.mesh = this.createMesh();
        this.time = 1;
        _instance = this;
    }
    createMesh() {
        return new THREE.Mesh(
            new THREE.PlaneGeometry(169, 169, 169, 169),
            new THREE.RawShaderMaterial({
                uniforms: this.uniforms,
                vertexShader: "#define GLSLIFY 1\nattribute vec3 position;\n\nuniform mat4 projectionMatrix;\nuniform mat4 modelViewMatrix;\nuniform float time;\n\nvarying vec3 vPosition;\n\nmat4 rotateMatrixX(float radian) {\n  return mat4(\n    1.0, 0.0, 0.0, 0.0,\n    0.0, cos(radian), -sin(radian), 0.0,\n    0.0, sin(radian), cos(radian), 0.0,\n    0.0, 0.0, 0.0, 1.0\n  );\n}\n\n//\n// GLSL textureless classic 3D noise \"cnoise\",\n// with an RSL-style periodic variant \"pnoise\".\n// Author:  Stefan Gustavson (stefan.gustavson@liu.se)\n// Version: 2011-10-11\n//\n// Many thanks to Ian McEwan of Ashima Arts for the\n// ideas for permutation and gradient selection.\n//\n// Copyright (c) 2011 Stefan Gustavson. All rights reserved.\n// Distributed under the MIT license. See LICENSE file.\n// https://github.com/ashima/webgl-noise\n//\n\nvec3 mod289(vec3 x)\n{\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\n}\n\nvec4 mod289(vec4 x)\n{\n  return x - floor(x * (1.0 / 289.0)) * 289.0;\n}\n\nvec4 permute(vec4 x)\n{\n  return mod289(((x*34.0)+1.0)*x);\n}\n\nvec4 taylorInvSqrt(vec4 r)\n{\n  return 1.79284291400159 - 0.85373472095314 * r;\n}\n\nvec3 fade(vec3 t) {\n  return t*t*t*(t*(t*6.0-15.0)+10.0);\n}\n\n// Classic Perlin noise\nfloat cnoise(vec3 P)\n{\n  vec3 Pi0 = floor(P); // Integer part for indexing\n  vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1\n  Pi0 = mod289(Pi0);\n  Pi1 = mod289(Pi1);\n  vec3 Pf0 = fract(P); // Fractional part for interpolation\n  vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0\n  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);\n  vec4 iy = vec4(Pi0.yy, Pi1.yy);\n  vec4 iz0 = Pi0.zzzz;\n  vec4 iz1 = Pi1.zzzz;\n\n  vec4 ixy = permute(permute(ix) + iy);\n  vec4 ixy0 = permute(ixy + iz0);\n  vec4 ixy1 = permute(ixy + iz1);\n\n  vec4 gx0 = ixy0 * (1.0 / 7.0);\n  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;\n  gx0 = fract(gx0);\n  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);\n  vec4 sz0 = step(gz0, vec4(0.0));\n  gx0 -= sz0 * (step(0.0, gx0) - 0.5);\n  gy0 -= sz0 * (step(0.0, gy0) - 0.5);\n\n  vec4 gx1 = ixy1 * (1.0 / 7.0);\n  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;\n  gx1 = fract(gx1);\n  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);\n  vec4 sz1 = step(gz1, vec4(0.0));\n  gx1 -= sz1 * (step(0.0, gx1) - 0.5);\n  gy1 -= sz1 * (step(0.0, gy1) - 0.5);\n\n  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);\n  vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);\n  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);\n  vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);\n  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);\n  vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);\n  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);\n  vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);\n\n  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));\n  g000 *= norm0.x;\n  g010 *= norm0.y;\n  g100 *= norm0.z;\n  g110 *= norm0.w;\n  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));\n  g001 *= norm1.x;\n  g011 *= norm1.y;\n  g101 *= norm1.z;\n  g111 *= norm1.w;\n\n  float n000 = dot(g000, Pf0);\n  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));\n  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));\n  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));\n  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));\n  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));\n  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));\n  float n111 = dot(g111, Pf1);\n\n  vec3 fade_xyz = fade(Pf0);\n  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);\n  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);\n  float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);\n  return 2.2 * n_xyz;\n}\n\nvoid main(void) {\n  vec3 updatePosition = (rotateMatrixX(radians(90.0)) * vec4(position, 1.0)).xyz;\n  float sin1 = sin(radians(updatePosition.x / 128.0 * 90.0));\n  vec3 noisePosition = updatePosition + vec3(0.0, 0.0, time * -30.0);\n  float noise1 = cnoise(noisePosition * 0.08);\n  float noise2 = cnoise(noisePosition * 0.06);\n  float noise3 = cnoise(noisePosition * 0.4);\n  vec3 lastPosition = updatePosition + vec3(0.0,\n    noise1 * sin1 * 8.0\n    + noise2 * sin1 * 8.0\n    + noise3 * (abs(sin1) * 2.0 + 0.5)\n    + pow(sin1, 2.0) * 40.0, 0.0);\n\n  vPosition = lastPosition;\n  gl_Position = projectionMatrix * modelViewMatrix * vec4(lastPosition, 1.0);\n}\n",
                fragmentShader: "precision highp float;\n#define GLSLIFY 1\n\nvarying vec3 vPosition;\n\nuniform vec3 ucolor;\n\nuniform float uopacity;\n\nvoid main(void) {\n  float opacity = (96.0 - length(vPosition)) / 256.0 * 0.6;\n gl_FragColor = vec4(ucolor, opacity*uopacity);\n}\n",
                transparent: true
            })
        );
    }
    render(time) {
        this.uniforms.time.value += time * this.time;
    }
}

const canvas = document.getElementById('canvas-webgl');
const renderer = new THREE.WebGLRenderer({
    antialias: false,
    canvas: canvas,
});
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
const clock = new THREE.Clock();

const plane = new Plane();

const resizeWindow = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}
const render = () => {
    plane.render(clock.getDelta());
    renderer.render(scene, camera);
}
let raf;
const renderLoop = () => {
    render();
    raf = requestAnimationFrame(renderLoop);
}
function stopRenderLoop() {
    if (raf) {
        cancelAnimationFrame(raf);
        raf = null;
    }
}
function startRenderLoop() {
    if (!raf) {
        renderLoop();
    }
}

let background = "#0e0e0e";
const init = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(parseInt(background.replace('#', '0x')), 1.0);
    camera.position.set(0, 16, 128);
    camera.lookAt(new THREE.Vector3(0, 28, 0));

    while (scene.children.length > 0) {
        scene.remove(scene.children[0]);
    }
    if (raf) {
        cancelAnimationFrame(raf);
    }
    scene.add(plane.mesh);
    window.addEventListener('resize', () => {
        resizeWindow();
    });
    resizeWindow();
    startRenderLoop();
}

init();

nameInput.style.cssText = `
        width: 350px;
        height: 50px;
        `;
nameInput.placeholder = "Enter Username";
enterGameButton.style.cssText = `
        width: 95px;
        height: 50px;
        margin-left: 20px;
        `;
enterGameButton.innerHTML = 'Play!';
promoImageHolder && (promoImageHolder.style.cssText += `
        width: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        background: rgba(0, 0, 0, 0);
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0px 4px 15px rgba(0, 0, 0, 0);
        `);
setupCard.style.cssText += `
        background: rgba(0, 0, 0, 0.45);
        box-shadow: none;
        display: flex;
        width: 450px;
        height: 50px;
        border-radius: 10px;
        margin-bottom: -20px;
        margin-left: 70px;
        `;

gameName.style.cssText = `
        opacity: 0.85;
        text-shadow: 0 1px 0 #c4c4c4, 0 2px 0 #c4c4c4, 0 3px 0 #c4c4c4, 0 4px 0 #c4c4c4, 0 5px 0 #c4c4c4, 0 6px 0 #c4c4c4, 0 7px 0 #c4c4c4, 0 8px 0 #c4c4c4, 0 9px 0 #c4c4c4;
        font-size: 170px;
        margin-bottom: -25px;
        font-family: 'Lilita One', sans-serif;
        opacity: 0;
        `;
workerSetTimeout(() => {
    gameName.style.opacity = '1';
    setupCard.style.opacity = '1';
    guideCard.style.opacity = '1';
    promoImageHolder && (promoImageHolder.style.opacity = '1');
    serverMenu.style.opacity = '1';
}, 2000);
document.getElementById('loadingText').innerHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>

        .progress-container {
            top: 80%;
            left: 50%;
            transform: translate(-50%, -50%) scale(0.5);
            width: 75%;
            background-color: gray;
            border-radius: 25px;
            overflow: hidden;
            height: 90px;
            position: relative;
        }
        .progress-bar {
            width: 0%;
            margin-top: 5px;
            margin-left: 5px;
            height: 80%;
            background-color: #fff;
            border-radius: 25px;
            animation: loading 1.2s linear forwards;
            position: relative;
        }
        @keyframes loading {
            from { width: 0%; }
            to { width: 100%; }
        }
        .progress-text {
            position: absolute;
            top: 50%;
            font-size: 50px;
            left: 50%;
            transform: translate(-50%, -50%);
            color: black;
            font-weight: bold;
        }
    </style>
</head>
<body>
    <div class="progress-container">
        <div class="progress-bar">
            <div class="progress-text" id="progressText">Loading...</div>
        </div>
    </div>
</body>
</html>
    `;

let newFont = document.createElement("link");
newFont.rel = "stylesheet";
newFont.href = "https://fonts.googleapis.com/css?family=Ubuntu:700";
newFont.type = "text/css";
document.body.append(newFont);

window.oncontextmenu = function () {
    return false;
};

// VISUAL:
config.anotherVisual = false;
config.useWebGl = false;
config.resetRender = false;

// STORAGE:
let canStore = typeof Storage !== "undefined";
function saveVal(name, val) {
    if (canStore) localStorage.setItem(name, val);
}
function deleteVal(name) {
    if (canStore) localStorage.removeItem(name);
}
function getSavedVal(name) {
    if (canStore) return localStorage.getItem(name);
    return null;
}

function loadToggle(id, def = false) {
    const v = localStorage.getItem("feature:" + id);
    return v === null ? def : v === "1";
}
function saveToggle(id, val) {
    localStorage.setItem("feature:" + id, val ? "1" : "0");
}
function loadSliderValue(id, def = 0) {
    const v = localStorage.getItem("slider:" + id);
    return v === null ? def : parseFloat(v);
}
function saveSliderValue(id, val) {
    localStorage.setItem("slider:" + id, val);
}

class HtmlAction {
    constructor(element) {
        this.element = element;
    };
    add(code) {
        if (!this.element) return undefined;
        this.element.innerHTML += code;
    };
    newLine(amount) {
        let result = `<br>`;
        if (amount > 0) {
            result = ``;
            for (let i = 0; i < amount; i++) {
                result += `<br>`;
            }
        }
        this.add(result);
    };
    checkBox(setting) {
        let newCheck = `<input type = "checkbox"`;
        setting.id && (newCheck += ` id = ${setting.id}`);
        setting.style && (newCheck += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newCheck += ` class = ${setting.class}`);
        setting.checked && (newCheck += ` checked`);
        setting.onclick && (newCheck += ` onclick = ${setting.onclick}`);
        newCheck += `>`;
        this.add(newCheck);
    };
    text(setting) {
        let newText = `<input type = "text"`;
        setting.id && (newText += ` id = ${setting.id}`);
        setting.style && (newText += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newText += ` class = ${setting.class}`);
        setting.size && (newText += ` size = ${setting.size}`);
        setting.maxLength && (newText += ` maxLength = ${setting.maxLength}`);
        setting.value && (newText += ` value = ${setting.value}`);
        setting.placeHolder && (newText += ` placeHolder = ${setting.placeHolder.replaceAll(" ", "&nbsp;")}`);
        newText += `>`;
        this.add(newText);
    };
    select(setting) {
        let newSelect = `<select`;
        setting.id && (newSelect += ` id = ${setting.id}`);
        setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newSelect += ` class = ${setting.class}`);
        newSelect += `>`;
        for (let options in setting.option) {
            newSelect += `<option value = ${setting.option[options].id}`
            setting.option[options].selected && (newSelect += ` selected`);
            newSelect += `>${options}</option>`;
        }
        newSelect += `</select>`;
        this.add(newSelect);
    };
    button(setting) {
        let newButton = `<button`;
        setting.id && (newButton += ` id = ${setting.id}`);
        setting.style && (newButton += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newButton += ` class = ${setting.class}`);
        setting.onclick && (newButton += ` onclick = ${setting.onclick}`);
        newButton += `>`;
        setting.innerHTML && (newButton += setting.innerHTML);
        newButton += `</button>`;
        this.add(newButton);
    };
    selectMenu(setting) {
        let newSelect = `<select`;
        if (!setting.id) {
            alert("please put id skid");
            return;
        }
        window[setting.id + "Func"] = function () { };
        setting.id && (newSelect += ` id = ${setting.id}`);
        setting.style && (newSelect += ` style = ${setting.style.replaceAll(" ", "")}`);
        setting.class && (newSelect += ` class = ${setting.class}`);
        newSelect += ` onchange = window.${setting.id + "Func"}()`;
        newSelect += `>`;
        let last;
        let i = 0;
        for (let options in setting.menu) {
            newSelect += `<option value = ${"option_" + options} id = ${"O_" + options}`;
            setting.menu[options] && (newSelect += ` checked`);
            newSelect += ` style = "color: ${setting.menu[options] ? "#000" : "#fff"}; background: ${setting.menu[options] ? "#8ecc51" : "#cc5151"};">${options}</option>`;
            i++;
        }
        newSelect += `</select>`;

        this.add(newSelect);

        i = 0;
        for (let options in setting.menu) {
            window[options + "Func"] = function () {
                setting.menu[options] = getEl("check_" + options).checked ? true : false;
                saveVal(options, setting.menu[options]);

                getEl("O_" + options).style.color = setting.menu[options] ? "#000" : "#fff";
                getEl("O_" + options).style.background = setting.menu[options] ? "#8ecc51" : "#cc5151";

                //getEl(setting.id).style.color = setting.menu[options] ? "#8ecc51" : "#cc5151";

            };
            this.checkBox({
                id: "check_" + options,
                style: `display: ${i == 0 ? "inline-block" : "none"};`,
                class: "checkB",
                onclick: `window.${options + "Func"}()`,
                checked: setting.menu[options]
            });
            i++;
        }

        last = "check_" + getEl(setting.id).value.split("_")[1];
        window[setting.id + "Func"] = function () {
            getEl(last).style.display = "none";
            last = "check_" + getEl(setting.id).value.split("_")[1];
            getEl(last).style.display = "inline-block";

            //getEl(setting.id).style.color = setting.menu[last.split("_")[1]] ? "#8ecc51" : "#fff";

        };
    };
};
class Html {
    constructor() {
        this.element = null;
        this.action = null;
        this.divElement = null;
        this.startDiv = function (setting, func) {

            let newDiv = document.createElement("div");
            setting.id && (newDiv.id = setting.id);
            setting.style && (newDiv.style = setting.style);
            setting.class && (newDiv.className = setting.class);
            this.element.appendChild(newDiv);
            this.divElement = newDiv;

            let addRes = new HtmlAction(newDiv);
            typeof func == "function" && func(addRes);

        };
        this.addDiv = function (setting, func) {

            let newDiv = document.createElement("div");
            setting.id && (newDiv.id = setting.id);
            setting.style && (newDiv.style = setting.style);
            setting.class && (newDiv.className = setting.class);
            setting.appendID && getEl(setting.appendID).appendChild(newDiv);
            this.divElement = newDiv;

            let addRes = new HtmlAction(newDiv);
            typeof func == "function" && func(addRes);

        };
    };
    set(id) {
        this.element = getEl(id);
        this.action = new HtmlAction(this.element);
    };
    resetHTML(text) {
        if (text) {
            this.element.innerHTML = ``;
        } else {
            this.element.innerHTML = ``;
        }
    };
    setStyle(style) {
        this.element.style = style;
    };
    setCSS(style) {
        this.action.add(`<style>` + style + `</style>`);
    };
};

class SongChat {
    constructor() {
        this.songs = daSongs.map(song => ({
            name: song.name,
            //url: song.url,
            audio: null,
            lyrics: song.lyrics,
            index: 0
        }));
        this.playing = false;
        this.sing = true;
        this.currentSong = 0;
        this.lastSendTime = -1000;
        this.currentTime = 0;
        this.updateInterval;
        this.lastUpdate = Date.now();
    }
    singSong(lyrics) {
        sendChat(lyrics, 1);
    }
    convertCurrenttime(seconds) {
        return Math.ceil(seconds * 1000);
    }
    playSong(id) {
        if (this.playing) {
            if (this.currentSong == id) {
                return;
            } else {
                //this.pauseSong();
                workerClearInterval(this.updateInterval);
                this.currentTime = 0;
                this.songs[this.currentSong].index = 0;
            }
        }
        this.currentSong = id;
        let song = this.songs[id];
        /*if (!song.audio) {
            song.audio = new Audio(song.url);
        }
        song.audio.play();
        song.audio.ontimeupdate = () => {
            let array = song.lyrics[song.index];
            if (array) {
                let time = array[0];
                let part = array[1];
                if (this.convertCurrenttime(song.audio.currentTime) >= (time - 200) && song.audio.currentTime - this.lastSendTime > 0.569) {
                    if (this.sing) this.singSong(part);
                    song.index++;
                    this.lastSendTime = song.audio.currentTime;
                }
            }
        }
        song.audio.onended = () => {
            this.playing = false;
            song.index = 0;
            this.lastSendTime = -1000;
        }*/
        this.playing = true;
        this.lastUpdate = Date.now();
        this.updateInterval = workerSetInterval(() => {
            let now = Date.now();
            let delta = now - this.lastUpdate;
            this.lastUpdate = now;
            this.currentTime += delta;
            let array = song.lyrics[song.index];
            if (array) {
                let time = array[0];
                let part = array[1];
                if (this.currentTime >= (time - 200) && this.currentTime - this.lastSendTime > 0.569) {
                    this.singSong(part);
                    song.index++;
                }
            } else {
                this.playing = false;
                song.index = 0;
                this.lastSendTime = -1000;
                clearInterval(this.updateInterval);
                this.currentTime = 0;
            }
        }, 100);
    }
    pauseSong() {
        this.playing = false;
        //this.songs[this.currentSong].audio.pause();
        this.lastSendTime = -1000;
        workerClearInterval(this.updateInterval);
        this.currentTime = 0;
        this.songs[this.currentSong].index = 0;
    }
    resetSong(id) {
        this.songs[id].index = 0;
        //if (this.songs[id].audio) this.songs[id].audio.currentTime = 0;
        this.lastSendTime = -1000;
        workerClearInterval(this.updateInterval);
        this.currentTime = 0;
    }
    resetAll() {
        this.currentTime = 0;
        workerClearInterval(this.updateInterval);
        this.songs.forEach((e) => {
            e.index = 0;
            if (e.audio) e.audio.currentTime = 0;
        });
        this.lastSendTime = -1000;
    }
}

let songChat = new SongChat();


class UI {
    constructor() {
        this.content = '';
    }

    append(html) {
        this.content += html;
    }

    Text(text, size = '16px', color = 'white') {
        this.append(`<span style="font-size: ${size}; color: ${color};">${text}</span>`);
    }

    newLine(num = 1) {
        this.append('<br>'.repeat(num));
    }

    static AppendTo(targetId, uiCallback) {
        const target = document.getElementById(targetId);
        if (target) {
            const htmlui = new UI();
            uiCallback(htmlui);
            target.innerHTML += htmlui.content;
        }
    }

    static InnerHtml(targetId, uiCallback) {
        const target = document.getElementById(targetId);
        if (target) {
            const htmlui = new UI();
            uiCallback(htmlui);
            target.innerHTML = htmlui.content;
        }
    }

    TabContent(tabId, contentCallback) {
        const ui = new UI();
        contentCallback(ui);
        this.append(`
            <div id="${tabId}" class="tab-content">
                ${ui.content}
            </div>
        `);
    }

    static addStyle(id, style) {
        let styleElement = document.getElementById(id);
        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = id;
            document.head.appendChild(styleElement);
        }
        styleElement.textContent = style;
    }

    BoxF(name, description, id, config = {}) {
        const checkedStatus = localStorage.getItem(id) === "true";
        const optionsHtml = config.option
            ? `<select id="${id}-dropdown" class="checkbox-dropdown">
            ${Object.entries(config.options || {})
                .map(([optionName, optionConfig]) =>
                    `<option value="${optionConfig.id}" ${optionConfig.selected ? "selected" : ""}>
                        ${optionName}
                    </option>`).join('')}
        </select>`
            : "";

        const boxHtml = `
    <div id="${id}" class="checkbox-container">
        <label class="checkbox-label">
            <input type="checkbox" ${checkedStatus ? "checked" : ""} class="checkbox-input" />
            <span class="checkbox-name">${name}</span>
            ${optionsHtml}
        </label>
        <p class="checkbox-description">${description}</p>
    </div>
    `;
        this.append(boxHtml);
        workerSetTimeout(() => {
            const checkbox = document.querySelector(`#${id} .checkbox-input`);
            if (checkbox) {
                configs[id] = checkedStatus;
                checkbox.addEventListener("change", (event) => {
                    const isChecked = event.target.checked;
                    localStorage.setItem(id, isChecked);
                    configs[id] = isChecked;
                });
            }
            if (config.option) {
                const dropdown = document.getElementById(`${id}-dropdown`);
                if (dropdown) {
                    dropdown.addEventListener("change", (event) => {
                        const selectedOption = event.target.value;
                        localStorage.setItem(`${id}-selected`, selectedOption);
                        options[id] = selectedOption;
                    });
                    const storedSelected = localStorage.getItem(`${id}-selected`);
                    if (storedSelected) {
                        const selectedOption = dropdown.querySelector(`option[value="${storedSelected}"]`);
                        if (selectedOption) {
                            selectedOption.selected = true;
                            options[id] = storedSelected;
                        }
                    }
                }
            }
        }, 100);
    }



    renderDropdown(options) {
        let dropdownHtml = '<select class="dropdown-menu">';
        for (const [optionName, optionConfig] of Object.entries(options)) {
            const selected = optionConfig.selected ? 'selected' : '';
            dropdownHtml += `<option value="${optionConfig.id}" ${selected}>${optionName}</option>`;
        }
        dropdownHtml += '</select>';
        return dropdownHtml;
    }

    initializeDropdown(boxId, options) {
        const dropdown = document.querySelector(`#${boxId} .dropdown-menu`);
        if (dropdown) {
            dropdown.addEventListener('change', (event) => {
                const selectedOption = event.target.value;
                for (const [name, config] of Object.entries(options)) {
                    config.selected = config.id === selectedOption;
                    localStorage.setItem(config.id, config.selected);
                }
            });
            Object.entries(options).forEach(([name, config]) => {
                const storedSelected = localStorage.getItem(config.id) === "true";
                config.selected = storedSelected;

                const optionElement = dropdown.querySelector(`option[value="${config.id}"]`);
                if (optionElement) {
                    optionElement.selected = storedSelected;
                }
            });
        }
    }

}

let HTML = new Html();

let nightMode = document.createElement("div");
nightMode.id = "nightMode";
document.body.appendChild(nightMode);
HTML.set("nightMode");
HTML.setStyle(`
            display: none;
            position: absolute;
            pointer-events: none;
            background-color: rgb(0, 0, 100);
            opacity: 0;
            top: 0%;
            width: 100%;
            height: 100%;
            animation-duration: 5s;
            animation-name: night2;
            `);
HTML.resetHTML();
HTML.setCSS(`
            @keyframes night1 {
                from {opacity: 0;}
                to {opacity: 0.35;}
            }
            @keyframes night2 {
                from {opacity: 0.35;}
                to {opacity: 0;}
            }
            `);

let menuDiv = document.createElement("div");
menuDiv.id = "menuDiv";
document.body.appendChild(menuDiv);
HTML.set("menuDiv");
HTML.setStyle(`
            position: absolute;
            left: 20px;
            top: 20px;
            display: none;
            `);
HTML.resetHTML();
HTML.setCSS(`
        .leaderboardItem {
    float: left;
    display: inline-block;
    font-size: 13px;
    text-align: center;
    max-width: max-content;
    position: relative;
    left: 50%;
    transform: translateX(-50%);
    text-shadow: -1.1px -1.1px 0 #000, 1.1px -1.1px 0 #000, -1.1px 1.1px 0 #000, 1.1px 1.1px 0 #000;
    font-family: Ubuntu, sans-serif;
    margin-top: 1.2px;
}

            .menuClass{
                color: #fff;
                font-size: 31px;
                text-align: left;
                padding: 10px;
                padding-top: 7px;
                padding-bottom: 5px;
                width: 300px;
                background-color: rgba(0, 0, 0, 0.25);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
            }
            .menuC {
                display: none;
                font-family: "Hammersmith One";
                font-size: 12px;
                max-height: 180px;
                overflow-y: scroll;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            .menuB {
                text-align: center;
                background-color: rgb(25, 25, 25);
                color: #fff;
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                border: 2px solid #000;
                cursor: pointer;
            }
            .menuB:hover {
                border: 2px solid #fff;
            }
            .menuB:active {
                color: rgb(25, 25, 25);
                background-color: rgb(200, 200, 200);
            }
            .customText {
                color: #000;
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                border: 2px solid #000;
            }
            .customText:focus {
                background-color: yellow;
            }
            .checkB {
                position: relative;
                top: 2px;
                accent-color: #888;
                cursor: pointer;
            }
            .Cselect {
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                background-color: rgb(75, 75, 75);
                color: #fff;
                border: 1px solid #000;
            }
            #menuChanger {
                position: absolute;
                right: 10px;
                top: 10px;
                background-color: rgba(0, 0, 0, 0);
                color: #fff;
                border: none;
                cursor: pointer;
            }
            #menuChanger:hover {
                color: #000;
            }
            ::-webkit-scrollbar {
                width: 10px;
            }
            ::-webkit-scrollbar-track {
                opacity: 0;
            }
            ::-webkit-scrollbar-thumb {
                background-color: rgb(25, 25, 25);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
            }
            ::-webkit-scrollbar-thumb:active {
                background-color: rgb(230, 230, 230);
            }
            `);

let menuuss = document.createElement('div');
menuuss.id = 'modmenus';
document.body.appendChild(menuuss);

UI.addStyle('modmenus-styles', `
        #modmenus {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(20, 20, 20, 0.95);
            color: white;
            border-radius: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 16px;
            z-index: 9999;
            visibility: hidden;
            opacity: 0;
            transition: opacity 0.4s ease, transform 0.4s ease, visibility 0.4s;
            width: 720px;
            height: 490px;
            text-align: center;
            box-shadow: 0px 5px 15px rgba(0, 0, 0, 0.7);
            overflow: hidden;
        }

        #modmenus.open {
            visibility: visible;
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }

        #modmenus.closed {
            visibility: hidden;
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.9);
        }

        #modmenus-sidebar {
            position: absolute;
            top: 0;
            left: 0;
            width: 80px;
            height: 100%;
            background-color: rgba(34, 34, 34, 0.95);
            color: white;
            padding: 15px;
            box-sizing: border-box;
            text-align: center;
            border-radius: 20px 0 0 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            opacity: 0;
            animation: slideIn 0.5s forwards;
        }

        #modmenus-sidebar button {
            width: 55px;
            height: 55px;
            background: rgba(68, 68, 68, 0.9);
            color: white;
            border: none;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            transition: transform 0.3s ease, background 0.3s ease;
        }

        #modmenus-sidebar button:hover {
            background: rgba(85, 85, 85, 0.9);
            transform: scale(1.1);
        }

        #modmenus-sidebar button.active {
            background: rgba(102, 102, 102, 0.9);
            font-weight: bold;
        }

        #modmenus-content {
            position: absolute;
            top: 0;
            left: 80px;
            width: 640px;
            height: 100%;
            padding: 20px;
            box-sizing: border-box;
            background-color: rgba(51, 51, 51, 0.95);
            color: white;
            text-align: left;
            overflow-x: auto;
            oveflow-y: none;
            animation: fadeInContent 0.4s ease;
            border-radius: 10px;
            scrollbar-width: none;
            scrollbar-width: thin;
            scrollbar-color: #555 #333;
        }
    #modmenus-content::-webkit-scrollbar {
        height: 8px;
    }

    #modmenus-content::-webkit-scrollbar-thumb {
        background: #555;
        border-radius: 20px;
    }

    #modmenus-content::-webkit-scrollbar-thumb:hover {
        background: #666;
    }

    #modmenus-content::-webkit-scrollbar-track {
        background: #333;
        border-radius: 10px;
    }
    #modmenus-content::-webkit-scrollbar-button {
        display: none;
    }
        .tab-content {
            display: none;
        }

        .tab-content.active {
            display: block;
            animation: fadeIn 0.4s ease;
        }

        .search-bar {
            display: inline-block;
            margin-left: 10px;
        }

        .search-bar input {
            width: 400px;
            height: 30px;
            font-size: 16px;
            border-radius: 15px;
            border: 1px solid #444;
            background-color: #333;
            color: white;
            outline: none;
        }

        .search-bar input:focus {
            border-color: #555;
            background-color: #444;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateX(-100%);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes fadeInContent {
            from {
                opacity: 0;
            }
            to {
                opacity: 1;
            }
        }

        @keyframes fadeIn {
            from {
                opacity: 0;
                transform: translateY(10px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }
    `);

UI.addStyle('checkbox-styles', `
    .checkbox-container {
        display: flex;
        flex-direction: column;
        padding: 10px;
        background-color: rgba(34, 34, 34, 0.85);
        border-radius: 10px;
        margin: 10px 0;
    }

    .checkbox-label {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .checkbox-name {
        font-size: 18px;
        color: white;
    }

    .checkbox-description {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 5px;
    }

    .checkbox-input {
        width: 20px;
        height: 20px;
        accent-color: #4CAF50;
    }
    .checkbox-dropdown {
    margin-left: 10px;
    height: 20px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 20px;
    background-color: rgba(51, 51, 51, 0.95);
    color: white;
    font-size: 12px;
    outline: none;
    transition: border-color 0.3s ease, box-shadow 0.3s ease;
    width: 170px;
    text-align: center;
}

.checkbox-dropdown:hover {
    border-color: rgba(255, 255, 255, 0.5);
}

.checkbox-dropdown:focus {
    border-color: #444;
    box-shadow: 0 0 5px rgba(68, 68, 68, 0.7);
}

.checkbox-dropdown option:checked {
    background-color: #333;
}

.checkbox-dropdown option {
    color: white;
}

`);
UI.InnerHtml('modmenus', (ui) => {
    ui.append(`
            <div id="modmenus-sidebar">
                <button class="tab-btn" data-tab="offensive">⚔️</button>
                <button class="tab-btn" data-tab="defensive">🛡️</button>
                <button class="tab-btn" data-tab="render">👁️</button>
                <button class="tab-btn" data-tab="robot">🤖</button>
                <button class="tab-btn" data-tab="keybind">⌨️</button>
                <button class="tab-btn" data-tab="others">⚙️</button>
            </div>
            <div id="modmenus-content"></div>
        `);
});
/*           //     killChat: true,
    //   autoBuy: false,
    //   alwaysFlipper: false,
    //   autoQonSync: true,
        //// autoQonHighPing: true, // havent implemented
    //  anti1tick: true,
    //  autoPush: true,
    ```` revTick: false, //dont have this in code idk why
    //   revInsta: false,
    //   doSpikeOnReverse: true,
    //  hammerBreakerOptimisation: true,
    // autoPlay: false,
    //  safeWalk: false,
    //   spikeTick: true,
    //   predictTick: true,
    //  autoPlace: true,
    //   autoReplace: true,
    //   autoPrePlace: true,
    //  antiTrap: true,
    // slowOT: false,
    // attackDir: false,
    //   noDir: false,
    //   showDir: true,
    //  autoRespawn: true*/
UI.InnerHtml('modmenus-content', (ui) => {
    const addSearchBar = (dc) => {
        dc.append(`
                <div class="search-bar">
                    <input type="text" placeholder="Search..." class="search-input" />
                </div>
            `);
    };

    ui.TabContent('offensive', (dc) => {
        dc.Text("OFFENSIVE TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.BoxF("Auto Placer", "Places Item For you such as spike and Traps", "autoPlace");
        dc.BoxF("Auto Replacer", "Auto Replace Buildings", "autoReplace");
        dc.BoxF("Preplacer", "Advanced Placing Obj", "autoPrePlace", {
            option: true,
            options: {
                "Spike Tick Type": { id: "spike" },
                "Retrap Type": { id: "retrap", selected: true },
            }
        });
        dc.BoxF("Auto Push", "Pushes enemies to spike when they in trap", "autoPush");
        dc.BoxF("Reverse Insta", "Always reverse insta", "revInsta");
        dc.BoxF("Spike On Reverse", "Place spike when reverse instaing and close to enemy", "doSpikeOnReverse");
        dc.BoxF("Auto Play", "Pathfinds to nearest enemy. Doesnt really work well", "autoPlay");
        dc.BoxF("Spike Tick", "Spike and hit together when enemy break out of trap and also syncs with breaking trap to spike sync people", "spikeTick");
        dc.BoxF("KB Tick", "Knocks back enemy into spike", "predictTick");
        dc.BoxF("Slow One Tick", "Select wall when polearm ticking to slow down", "slowOT");
        dc.BoxF("Turret Combat", "Uses turret when spike ticking", "turretCombat");
        dc.newLine(2);
        /* dc.BoxF("Musket Sync", "Sync with players when you have musket", "secondarySync", {
        input: idk make it cut off at 30 characters,
    });*/
        dc.BoxF("Primary Sync", "Sync with players using this mod with primary", "serverSync");
    });

    ui.TabContent('defensive', (dc) => {
        dc.Text("DEFENSIVE TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.BoxF("Auto buy", "Buys hats and accessories automatically", "autoBuy");
        dc.BoxF("Anti 1 tick", "Forces soldier when detects 1 tick", "anti1tick");
        dc.BoxF("Auto Q on sync", "Heals as fast as possible when you may be synced", "autoQonSync");
        dc.BoxF("Hammer breaker", "Use hammer when breaking", "hammerBreakerOptimisation");
        dc.BoxF("Safe Walk", "Avoids spikes", "safeWalk", {
            option: true,
            options: {
                "Move Away": { id: "move", selected: true },
                "Stop": { id: "stop" }
            }
        });
        dc.BoxF("Anti Trap", "Places traps or spikes behind you when in trap", "antiTrap");
        dc.BoxF("Extra Anti Spike Tick", "Uses knock back prediction and trap health to soldier and heal too. Must have this to survive better", "safeAntiSpikeTick");
        dc.BoxF("Spike Breaker", "Auto break enemy spikes in range", "breakSpikeSwitch");
        dc.BoxF("Trap Breaker", "Auto break enemy traps even if you are not in them", "breakTrapSwitch");
        dc.BoxF("Obstacle Breaker", "Auto break objects near the trap enemy is in", "breakAroundSwitch");
        dc.BoxF("Turret type Breaker", "Auto break enemy turret/tp/blocked in range", "breakTTBSwitch");
        dc.BoxF("Break All", "Auto break all buildings. Note: disables avoid ur own buildings breaker", "breakAllSwitch");
        dc.BoxF("Counter Insta", "Spike gear and hit when enemy hit you", "antiBullType", {
            option: true,
            options: {
                "Predict": { id: "abreload" },
                "Always": { id: "abalway", selected: true },
            }
        });
    });
    ui.TabContent('render', (dc) => {
        dc.Text("VISUAL TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.BoxF("Smoother Camera", "Makes camera move slower", "CAmera");
        dc.BoxF("Render Direction", "Shows real direction", "renderDir", {
            option: true,
            options: {
                "When Auto Aim": { id: "attackDir" },
                "Always": { id: "showDir", selected: true },
                "No Dir": { id: "noDir" }
            }
        });
        dc.BoxF("Render Placers", "Show placing positions", "placeVis");
        dc.BoxF("Become Florr", "Florr.io", "florr");
    });
    ui.TabContent('robot', (dc) => {
        dc.Text("BOTS TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.Text("bots for gays :>")
    });
    ui.TabContent('keybind', (dc) => {
        dc.Text("KEYBINDS TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.Text("z for auto mill, f for trap type, v for spike type, n for mill type, h for turret type, y for stone/sapling");
        dc.newLine(1);
        dc.Text("If auto push or auto play dumb, press shift once to disable for 10 seconds");
        dc.newLine(1);
        dc.newLine(1);
        dc.Text("C for song. It is case sensitive so press shift + c or caps + c. Song chat stuff found in others tab. In order to not get copyrighted, I removed this system. But im leaving in the array stuff for song timings and lyrics. So it will sing without any audio. You will have to make ur own audio files if you want music. If u dont see it singing, thats because in the actual song there is not lyrics in that part yet. Dont press C again as it will stop the singing.");
        dc.newLine(1);
        dc.newLine(1);
        dc.Text("hold t for 1 tick, '.' (period) for boost tick. They are not really worked on so dont expect them to be very good");
        dc.newLine(1);
        dc.Text("hold l for some boost spike I skidded. Btw there is no longer party trolling where u can quad spike and leave to kill people.")
        dc.newLine(1);
        dc.Text("Left click for bull spam, right click for break building, Middle click to bow spam at nearest enemy to mouse")
        dc.newLine(1);
        dc.Text("Scroll up to resync ur bull tick, down to cancel resync")
    });
    ui.TabContent('others', (dc) => {
        dc.Text("OTHERS TAB", "20px", "white");
        addSearchBar(dc);
        dc.newLine(1);
        dc.BoxF("Kill Chat", "Sends message when you kill someone", "killChat");
        dc.BoxF("Weapon Grind", "Auto place turret type item around you", "weaponGrind");
        dc.BoxF("Auto Respawn", "Respawns when you die automatically", "autoRespawn");
        dc.BoxF("Always Flipper", "Equips flipper when in water more", "alwaysFlipper");
        dc.BoxF("Auto Accept", "Adds players into your party asap when they request to join", "autoAccept");
        dc.BoxF("Ping Map", "Pings the map when you press r or click it", "allowPing");
        dc.BoxF("Player Follow", "Follows the targetted player around", "playerFollow");
        dc.BoxF("Trap Animals", "Traps animals automatically", "trapAnimals");
        dc.BoxF("Funni Hats :)", "Changes hat changing when not near players", "hatType", {
            option: true,
            options: {
                "Hat loop": { id: "loop" },
                "Bush gear": { id: "bg", selected: true },
                "Assassion gear": { id: "ag" },
            }
        });
        dc.BoxF("Random loop songs", "Loop through songs randomly. If unchecked, play selected song", "songChat", {
            option: true,
            /* the thing looks like this:
            [
                {name:"Avicii - The Nights", etc, etc},
                {name: "Initial D - Gas Gas Gas", etc}
            ]
            Does not have id in it. Id is the index
            */
            options: songChat.songs.map((song, index) => ({
                [song.name]: { id: index.toString(), selected: index === 0 }
            })).reduce((acc, curr) => ({ ...acc, ...curr }), {})
        });

        /*"Park Chinois": {
            id: "0",
        },
        "Gas Gas Gas": {
            id: "1",
        },
        "Verbatim": {
            id: "2"
        },
        "Dead of night": {
            id: "3"
        },
        "I see a dreamer": {
            id: "4"
        },
        "Sailor Song": {
            id: "5",
        },
        "My ordinary life": {
            id: "6",
        },
        "Dont Stand So Close": {
            id: "7",
        },
        "Everything is awesome": {
            id: "8",
        },
        "Candles on fire": {
            id: "9",
        },
        "Enemy": {
            id: "10",
        },
        "SUS": {
            id: "11",
        },
        "Scopin": {
            id: "12",
        },
        "GIGACHAD": {
            id: "13",
        },
        "Shape of you": {
            id: "14",
        },
        "laplace recommendation": {
            id: "15",
        },
        "The nights": {
            id: "16",
            slected: true
        },
        "Cradles": {
            id: "17",
        },*/
    });
});

let menuChatDiv = document.createElement("div");
menuChatDiv.id = "menuChatDiv";
document.body.appendChild(menuChatDiv);
HTML.set("menuChatDiv");
HTML.setStyle(`
            position: absolute;
            display: block;
            left: 10px;
            top: 10px;
            box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.65);
            `);
HTML.resetHTML();
HTML.setCSS(`
            .chDiv{
                color: #fff;
                padding: 5px;
                width: 400px;
                height: 240px;
                background-color: rgba(0, 0, 0, 0.35);
            }
            .chMainDiv{
                font-family: "Ubuntu";
                font-size: 12px;
                max-height: 195px;
                overflow-y: scroll;
                -webkit-touch-callout: none;
                -webkit-user-select: none;
                -khtml-user-select: none;
                -moz-user-select: none;
                -ms-user-select: none;
                user-select: none;
            }
            .chMainBox{
                position: absolute;
                left: 5px;
                bottom: 10px;
                width: 395px;
                height: 30px;
                background-color: rgb(128, 128, 128, 0.35);
                -webkit-border-radius: 4px;
                -moz-border-radius: 4px;
                border-radius: 4px;
                color: #fff;
                font-family: "Ubuntu";
                font-size: 12px;
                border: none;
                outline: none;
            }
            `);
HTML.startDiv({ id: "mChDiv", class: "chDiv" }, (html) => {
    HTML.addDiv({ id: "mChMain", class: "chMainDiv", appendID: "mChDiv" }, (html) => {
    });
    html.text({ id: "mChBox", class: "chMainBox", placeHolder: `To chat click here or press "Enter" key` });
});

let menuChats = getEl("mChMain");
let menuChatBox = getEl("mChBox");
let menuCBFocus = false;
let menuChCounts = 0;

menuChatBox.value = "";
menuChatBox.addEventListener("focus", () => {
    menuCBFocus = true;
});
menuChatBox.addEventListener("blur", () => {
    menuCBFocus = false;
});

function ChText(name, message, color, noTimer) {
    color = color || "white";
    let autoScroll = (menuChats.scrollTop + menuChats.clientHeight >= menuChats.scrollHeight - 1);

    const container = document.createElement("div");
    container.id = "menuChDisp" + menuChCounts;
    container.style.color = color;

    if (!noTimer) {
        const timeSpan = document.createElement("span");
        timeSpan.style.color = "white";

        const time = new Date();
        const min = String(time.getMinutes()).padStart(2, "0");
        const hour = time.getHours();
        const ampm = hour >= 12 ? "PM" : "AM";

        timeSpan.textContent = `[${hour % 12 || 12}:${min} ${ampm}] `;
        container.appendChild(timeSpan);
    }

    if (name) {
        const nameSpan = document.createElement("span");
        nameSpan.textContent = name + ": ";
        container.appendChild(nameSpan);
    }

    if (message) {
        const msgSpan = document.createElement("span");
        msgSpan.textContent = message;
        container.appendChild(msgSpan);
    }

    getEl("mChMain").appendChild(container);
    if (menuChats.children.length > 2000) {
        menuChats.removeChild(menuChats.children[0]);
    }
    autoScroll && (menuChats.scrollTop = menuChats.scrollHeight);
    menuChCounts++;
}


function resetMenuChText() {
    menuChats.innerHTML = ``;
    menuChCounts = 0;
    ChText("Script", "Thank You for Using this mod, Have fun!", "#0f0", 1);
}
resetMenuChText();
document.body.addEventListener('click', (event) => {
    if (event.target.classList.contains('tab-btn')) {
        const tabName = event.target.dataset.tab;
        document.querySelectorAll('#modmenus-sidebar .tab-btn').forEach((btn) => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-content').forEach((content) => {
            content.classList.remove('active');
        });
        event.target.classList.add('active');
        const selectedContent = document.getElementById(tabName);
        if (selectedContent) {
            selectedContent.classList.add('active');
        }
    }
});
document.body.addEventListener('input', (event) => {
    if (event.target && event.target.classList.contains('search-input')) {
        const searchText = event.target.value.toLowerCase();
        const tabContent = event.target.closest('.tab-content');
        if (tabContent) {
            const textElements = tabContent.querySelectorAll('span');
            textElements.forEach((textElement) => {
                const isVisible = textElement.textContent.toLowerCase().includes(searchText);
                textElement.style.display = isVisible ? '' : 'none';
            });
        }
    }
});
document.body.addEventListener('input', (event) => {
    if (event.target && event.target.classList.contains('search-input')) {
        const searchText = event.target.value.toLowerCase();
        const tabContent = event.target.closest('.tab-content');
        if (tabContent) {
            const boxFContainers = tabContent.querySelectorAll('.checkbox-container');
            boxFContainers.forEach((container) => {
                const nameElement = container.querySelector('.checkbox-name');
                if (nameElement) {
                    const isVisible = nameElement.textContent.toLowerCase().includes(searchText);
                    container.style.display = isVisible ? '' : 'none';
                }
            });
        }
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const defaultTab = document.getElementById('offensive');
    const defaultButton = document.querySelector('#modmenus-sidebar .tab-btn[data-tab="offensive"]');
    if (defaultTab) defaultTab.classList.add('active');
    if (defaultButton) defaultButton.classList.add('active');
});
function isC(id) {// for checking if the ids is checked or not so use it oe
    let checkVal = localStorage.getItem(id) === "true";
    let optionVal = localStorage.getItem(`${id}-selected`);
    return {
        checked: checkVal,
        options: {
            value: optionVal
        }
    };
}
let configs = {};
let options = {};
let WS = undefined;
let socketID = undefined;

let secPacket = 0;
let secMax = 110;
let secTime = 1000;
let firstSend = {
    sec: false
};
let game = {
    tick: 0,
    tickQueue: [],
    tickBase: function (set, tick) {
        if (this.tickQueue[this.tick + tick]) {
            this.tickQueue[this.tick + tick].push(set);
        } else {
            this.tickQueue[this.tick + tick] = [set];
        }
    },
    tickRate: (1000 / config.serverUpdateRate),
    tickSpeed: 0,
    lastTick: performance.now()
};
let projectileTick = [];
let modConsole = [];

let dontSend = false;
let fpsTimer = {
    last: 0,
    time: 0,
    ltime: 0
}
let lastsp = ["cc", 1, "__proto__"];

WebSocket.prototype.nsend = WebSocket.prototype.send;
WebSocket.prototype.send = function (message) {
    if (!WS) {
        WS = this;
        WS.addEventListener("message", function (msg) {
            getMessage(msg);
        });
        WS.addEventListener("close", (event) => {
            window.location.reload();
        });
    }
    if (WS == this) {
        dontSend = false;
        // EXTRACT DATA ARRAY:
        let data = new Uint8Array(message);
        let parsed = msgpack.decode(data);

        let type = parsed[0];
        data = parsed[1];
        /*hmm create party packet = "L" with data of an array with length 1 which is party name with \x00\x00...(8 \x00 s). Replace the ones at the front with the party name.
        hmm accept player join packet = "P" with data of an array with length 2. First item is accepted player sid, second is either 0 or 1 where 0 means decline and 1 means accept
        kick player is packet "Q" with data of the kicked player sid
        join party packet is "b" with data of \x00\x00\x00\x00... (8 \x00). Replace each of the \x00 at the front with the party name.
        when someone wants to join ur party, receives "2" with data thats an array of
        */
        // SEND MESSAGE:
        if (type == "6") {
            let message = data[0];

            if (message) {
                profanityList.forEach((profany) => {
                    let reg = new RegExp(profany, "g");
                    message = message.replace(reg, (match) => {
                        return (message.length == 30 ? match[0].toUpperCase() : (match[0] + "\x00")) + match.slice(1);
                    });
                });

                // FIX CHAT:
                data[0] = message.slice(0, 30);
            }
        } else if (type == "L") {
            // MAKE SAME CLAN:
            data[0] = data[0] + (String.fromCharCode(0).repeat(7));
            data[0] = data[0].slice(0, 7);
        } else if (type == "M") {
            // APPLY CYAN COLOR:
            data[0].name = data[0].name == "" ? "unknown" : data[0].name;
            data[0].moofoll = true;
            data[0].skin = data[0].skin == 10 ? "__proto__" : data[0].skin;
            lastsp = [data[0].name, data[0].moofoll, data[0].skin];
        } else if (type == "D") {
            if ((my.lastDir == data[0]) || [null, undefined].includes(data[0])) {
                dontSend = true;
            } else {
                my.lastDir = data[0];
            }
        } else if (type == "F") {
            if (!data[2]) {
                dontSend = true;
            } else {
                if (![null, undefined].includes(data[1])) {
                    my.lastDir = data[1];
                }
            }
        } else if (type == "K") {
            if (!data[1]) {
                dontSend = true;
            } else {
                if (data[1] == 1) {
                    my.autoGathering = !my.autoGathering;
                }
            }
        } else if (type == "S") {
            if (!data[1]) {
                dontSend = true;
            }
        } else if (type == "9") {
            if (data[1]) {
                if (player.moveDir == data[0]) {
                    dontSend = true;
                } else {
                    player.moveDir = data[0];
                }
            } else {
                dontSend = true;
            }
        } else if (type == "0") {
            if (!data[0] || secPacket > 60) {
                dontSend = true;
            } else {
                sentPingTime = Date.now();
            }
        } else if (type == "P") {
            if (!data[2]) {
                playersJoining.shift();
            } else {
                playersJoining.filter(e => e != data[0])
            }
        } else if (type == "e") {
            if (!data[0]) {
                dontSend = true;
            } else {
                player.moveDir = undefined;
            }
        }
        if (!dontSend) {
            let binary = msgpack.encode([type, data]);
            this.nsend(binary);
            // START COUNT:
            if (!firstSend.sec) {
                firstSend.sec = true;
                workerSetTimeout(() => {
                    firstSend.sec = false;
                    secPacket = 0;
                }, secTime);
            }
            secPacket++;
        }
    } else {
        this.nsend(message);
    }
}

function packet(type) {
    // EXTRACT DATA ARRAY:
    let data = Array.prototype.slice.call(arguments, 1);

    // SEND MESSAGE:
    let binary = msgpack.encode([type, data]);
    WS.send(binary);
}

let packetEvents = {
    A: setInitData,
    // B: disconnect,
    C: setupGame,
    D: addPlayer,
    E: removePlayer,
    a: updatePlayers,
    G: updateLeaderboard,
    H: loadGameObject,
    I: loadAI,
    J: animateAI,
    K: gatherAnimation,
    L: wiggleGameObject,
    M: shootTurret,
    N: updatePlayerValue,
    O: updateHealth,
    P: killPlayer,
    Q: killObject,
    R: killObjects,
    S: updateItemCounts,
    T: updateAge,
    U: updateUpgrades,
    V: updateItems,
    X: addProjectile,
    Y: remProjectile,
    Z: serverShutdownNotice,
    g: addAlliance,
    1: deleteAlliance,
    2: allianceNotification,
    3: setPlayerTeam,
    4: setAlliancePlayers,
    5: updateStoreItems,
    6: receiveChat,
    7: updateMinimap,
    8: showText,
    9: pingMap,
    0: pingSocketResponse,
};

function getMessage(message) {
    let data = new Uint8Array(message.data);
    let parsed = msgpack.decode(data);
    let type = parsed[0];
    data = parsed[1];
    if (type == "io-init") {
        socketID = data[0];
    } else {
        if (packetEvents[type]) {
            packetEvents[type].apply(undefined, data);
            //!["a", "I", "0"].includes(type) && console.log("received", type, data)
        }
    }
}

// MATHS:
Math.lerpAngle = function (value1, value2, amount) {
    let difference = Math.abs(value2 - value1);
    if (difference > Math.PI) {
        if (value1 > value2) {
            value2 += Math.PI * 2;
        } else {
            value1 += Math.PI * 2;
        }
    }
    let value = value2 + ((value1 - value2) * amount);
    if (value >= 0 && value <= Math.PI * 2) return value;
    return value % (Math.PI * 2);
};

// REOUNDED RECTANGLE:
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    if (r < 0)
        r = 0;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
};

// GLOBAL VALUES:

// VOLCANO:
let xof = undefined;
let yof = undefined;
let volcano = {
    animationTime: 0,
    land: null,
    lava: null,
    x: config.volcanoLocationX,
    y: config.volcanoLocationY
};
let debugStop = false;
let kbIndc = {
    mex: 0,
    mey: 0
}

let petals = [];
let allChats = [];

let ais = [];
let players = [];
let alliances = [];
let alliancePlayers = [];
let allianceNotifications = [];
let gameObjects = [];
let nearObjs = [];
let projectiles = [];
let deadPlayers = [];

let player;
let playerSID;
let tmpObj;

let enemy = [];
let nears = [];
let near = {};
let targetPlayer = undefined;
let ping = {
    min: 0,
    max: 0,
    avg: 0
};

let my = {
    healed: false,
    reloaded: false,
    waitHit: 0,
    autoAim: false,
    revAim: false,
    ageInsta: true,
    reSync: false,
    bullTick: true,
    anti0Tick: 0,
    antiSync: false,
    safePrimary: function (tmpObj) {
        return [0, 8].includes(tmpObj.primaryIndex);
    },
    safeSecondary: function (tmpObj) {
        return [10, 11, 14].includes(tmpObj.secondaryIndex);
    },
    lastDir: 0,
    autoPush: false,
    pushData: {},
    autoGathering: false,
    forceStop: false,
}

let testRender = {};

// FIND OBJECTS BY ID/SID:
function findID(tmpObj, tmp) {
    return tmpObj.find((THIS) => THIS.id == tmp);
}

function findSID(tmpObj, tmp) {
    return tmpObj.find((THIS) => THIS.sid == tmp);
}

function findPlayerByID(id) {
    return findID(players, id);
}

function findPlayerBySID(sid) {
    return findSID(players, sid);
}

function findAIBySID(sid) {
    return findSID(ais, sid);
}

function findObjectBySid(sid) {
    return findSID(gameObjects, sid);
}

function findProjectileBySid(sid) {
    return findSID(gameObjects, sid);
}


let screenWidth;
let screenHeight;
let maxScreenWidth = config.maxScreenWidth;
let maxScreenHeight = config.maxScreenHeight;
let pixelDensity = 1;
let delta;
let now;
let lastUpdate = performance.now();
let camX;
let camY;
let tmpDir;
let mouseX = 0;
let mouseY = 0;

let waterMult = 1;
let waterPlus = 0;

let outlineColor = "#525252";
let darkOutlineColor = "#3d3f42";
let outlineWidth = 5.5;

let isNight = true;
let firstSetup = true;
let keys = {};
let moveKeys = {
    87: [0, -1],
    38: [0, -1],
    83: [0, 1],
    40: [0, 1],
    65: [-1, 0],
    37: [-1, 0],
    68: [1, 0],
    39: [1, 0],
};
let attackState = 0;
let inGame = false;

let macro = {};
let mills = {
    place: 0,
    placeSpawnPads: 0,
    old: {
        x: 0,
        y: 0
    },
    spawnDist: 124
};
let lastDir;

let lastLeaderboardData = [];

// ON LOAD:
let inWindow = true;
window.onblur = function () {
    inWindow = false;
};
window.onfocus = function () {
    inWindow = true;
    if (player && player.alive) {
        // resetMoveDir();
    }
};


let placeVisible = [];
let preplaceVisible = [];
let spikeplaceVisible = [];
let profanityList = ["cunt", "whore", "fuck", "shit", "faggot", "nigger",
    "nigga", "dick", "vagina", "minge", "cock", "rape", "cum", "sex",
    "tits", "penis", "clit", "pussy", "meatcurtain", "jizz", "prune",
    "douche", "wanker", "damn", "bitch", "dick", "fag", "bastard"];

/** CLASS CODES */

class Utils {
    constructor() {

        // MATH UTILS:
        let mathABS = Math.abs,
            mathCOS = Math.cos,
            mathSIN = Math.sin,
            mathPOW = Math.pow,
            mathSQRT = Math.sqrt,
            mathATAN2 = Math.atan2,
            mathPI = Math.PI;

        let _this = this;

        // GLOBAL UTILS:
        this.round = function (n, v) {
            return Math.round(n * v) / v;
        };
        this.toRad = function (angle) {
            return angle * (mathPI / 180);
        };
        this.toAng = function (radian) {
            return radian / (mathPI / 180);
        };
        this.randInt = function (min, max) {
            return Math.floor(Math.random() * (max - min)) + min;
        };
        this.randFloat = function (min, max) {
            return Math.random() * (max - min) + min;
        };
        this.collisionDetection = function (obj1, obj2, scale) {
            return mathSQRT((obj1.x - obj2.x) ** 2 + (obj1.y - obj2.y) ** 2) < scale;
        };
        this.lerp = function (value1, value2, amount) {
            return value1 + (value2 - value1) * amount;
        };
        this.decel = function (val, cel) {
            if (val > 0)
                val = Math.max(0, val - cel);
            else if (val < 0)
                val = Math.min(0, val + cel);
            return val;
        };
        this.getDistance = function (x1, y1, x2, y2) {
            return mathSQRT((x2 -= x1) * x2 + (y2 -= y1) * y2);
        };
        this.getDist = function (tmp1, tmp2, type1, type2) {
            let tmpXY1 = {
                x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
            };
            let tmpXY2 = {
                x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
            };
            return mathSQRT((tmpXY2.x -= tmpXY1.x) * tmpXY2.x + (tmpXY2.y -= tmpXY1.y) * tmpXY2.y);
        };
        this.findMiddlePoint = function (tmp1, tmp2, type1, type2) {
            // Helper function to get the correct coordinates
            const getCoords = (obj, type) => {
                switch (type) {
                    case 0: return { x: obj.x, y: obj.y };
                    case 1: return { x: obj.x1, y: obj.y1 };
                    case 2: return { x: obj.x2, y: obj.y2 };
                    case 3: return { x: obj.x3, y: obj.y3 };
                    default: throw new Error("Invalid type");
                }
            };

            const tmpXY1 = getCoords(tmp1, type1);
            const tmpXY2 = getCoords(tmp2, type2);

            return {
                x: (tmpXY1.x + tmpXY2.x) / 2,
                y: (tmpXY1.y + tmpXY2.y) / 2
            };
        };
        this.fgdo = function (a, b) {
            return Math.sqrt(Math.pow((b.y - a.y), 2) + Math.pow((b.x - a.x), 2));
        }
        this.getDirection = function (x1, y1, x2, y2) { //direction of x1,y1 from x2,y2
            return mathATAN2(y1 - y2, x1 - x2);
        };
        this.getDirect = function (tmp1, tmp2, type1, type2) { // direction of tmp1 from tmp2
            let tmpXY1 = {
                x: type1 == 0 ? tmp1.x : type1 == 1 ? tmp1.x1 : type1 == 2 ? tmp1.x2 : type1 == 3 && tmp1.x3,
                y: type1 == 0 ? tmp1.y : type1 == 1 ? tmp1.y1 : type1 == 2 ? tmp1.y2 : type1 == 3 && tmp1.y3,
            };
            let tmpXY2 = {
                x: type2 == 0 ? tmp2.x : type2 == 1 ? tmp2.x1 : type2 == 2 ? tmp2.x2 : type2 == 3 && tmp2.x3,
                y: type2 == 0 ? tmp2.y : type2 == 1 ? tmp2.y1 : type2 == 2 ? tmp2.y2 : type2 == 3 && tmp2.y3,
            };
            return mathATAN2(tmpXY1.y - tmpXY2.y, tmpXY1.x - tmpXY2.x);
        };
        this.getAngleDist = function (a, b) {
            let p = mathABS(b - a) % (mathPI * 2);
            return (p > mathPI ? (mathPI * 2) - p : p);
        };
        this.isNumber = function (n) {
            return (typeof n == "number" && !isNaN(n) && isFinite(n));
        };
        this.isString = function (s) {
            return (s && typeof s == "string");
        };
        this.kFormat = function (num) {
            return num > 999 ? (num / 1000).toFixed(1) + "k" : num;
        };
        this.sFormat = function (num) {
            let fixs = [
                { num: 1e3, string: "k" },
                { num: 1e6, string: "m" },
                { num: 1e9, string: "b" },
                { num: 1e12, string: "q" }
            ].reverse();
            let sp = fixs.find(v => num >= v.num);
            if (!sp) return num;
            return (num / sp.num).toFixed(1) + sp.string;
        };
        this.capitalizeFirst = function (string) {
            return string.charAt(0).toUpperCase() + string.slice(1);
        };
        this.fixTo = function (n, v) {
            return parseFloat(n.toFixed(v));
        };
        this.sortByPoints = function (a, b) {
            return parseFloat(b.points) - parseFloat(a.points);
        };
        this.lineInRect = function (recX, recY, recX2, recY2, x1, y1, x2, y2) {
            let minX = x1;
            let maxX = x2;
            if (x1 > x2) {
                minX = x2;
                maxX = x1;
            }
            if (maxX > recX2)
                maxX = recX2;
            if (minX < recX)
                minX = recX;
            if (minX > maxX)
                return false;
            let minY = y1;
            let maxY = y2;
            let dx = x2 - x1;
            if (Math.abs(dx) > 0.000001) {
                let a = (y2 - y1) / dx;
                let b = y1 - a * x1;
                minY = a * minX + b;
                maxY = a * maxX + b;
            }
            if (minY > maxY) {
                let tmp = maxY;
                maxY = minY;
                minY = tmp;
            }
            if (maxY > recY2)
                maxY = recY2;
            if (minY < recY)
                minY = recY;
            if (minY > maxY)
                return false;
            return true;
        };
        this.containsPoint = function (element, x, y) {
            let bounds = element.getBoundingClientRect();
            let left = bounds.left + window.scrollX;
            let top = bounds.top + window.scrollY;
            let width = bounds.width;
            let height = bounds.height;

            let insideHorizontal = x > left && x < left + width;
            let insideVertical = y > top && y < top + height;
            return insideHorizontal && insideVertical;
        };
        this.mousifyTouchEvent = function (event) {
            let touch = event.changedTouches[0];
            event.screenX = touch.screenX;
            event.screenY = touch.screenY;
            event.clientX = touch.clientX;
            event.clientY = touch.clientY;
            event.pageX = touch.pageX;
            event.pageY = touch.pageY;
        };
        this.hookTouchEvents = function (element, skipPrevent) {
            let preventDefault = !skipPrevent;
            let isHovering = false;
            // let passive = window.Modernizr.passiveeventlisteners ? {passive: true} : false;
            let passive = false;
            element.addEventListener("touchstart", this.checkTrusted(touchStart), passive);
            element.addEventListener("touchmove", this.checkTrusted(touchMove), passive);
            element.addEventListener("touchend", this.checkTrusted(touchEnd), passive);
            element.addEventListener("touchcancel", this.checkTrusted(touchEnd), passive);
            element.addEventListener("touchleave", this.checkTrusted(touchEnd), passive);

            function touchStart(e) {
                _this.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (element.onmouseover)
                    element.onmouseover(e);
                isHovering = true;
            }

            function touchMove(e) {
                _this.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (_this.containsPoint(element, e.pageX, e.pageY)) {
                    if (!isHovering) {
                        if (element.onmouseover)
                            element.onmouseover(e);
                        isHovering = true;
                    }
                } else {
                    if (isHovering) {
                        if (element.onmouseout)
                            element.onmouseout(e);
                        isHovering = false;
                    }
                }
            }

            function touchEnd(e) {
                _this.mousifyTouchEvent(e);
                window.setUsingTouch(true);
                if (preventDefault) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (isHovering) {
                    if (element.onclick)
                        element.onclick(e);
                    if (element.onmouseout)
                        element.onmouseout(e);
                    isHovering = false;
                }
            }
        };
        this.removeAllChildren = function (element) {
            while (element.hasChildNodes()) {
                element.removeChild(element.lastChild);
            }
        };
        this.generateElement = function (config) {
            let element = document.createElement(config.tag || "div");

            function bind(configValue, elementValue) {
                if (config[configValue]) element[elementValue] = config[configValue];
            }
            bind("text", "textContent");
            bind("html", "innerHTML");
            bind("class", "className");
            for (let key in config) {
                switch (key) {
                    case "tag":
                    case "text":
                    case "html":
                    case "class":
                    case "style":
                    case "hookTouch":
                    case "parent":
                    case "children":
                        continue;
                    default:
                        break;
                }
                element[key] = config[key];
            }
            if (element.onclick)
                element.onclick = this.checkTrusted(element.onclick);
            if (element.onmouseover)
                element.onmouseover = this.checkTrusted(element.onmouseover);
            if (element.onmouseout)
                element.onmouseout = this.checkTrusted(element.onmouseout);
            if (config.style) {
                element.style.cssText = config.style;
            }
            if (config.hookTouch) {
                this.hookTouchEvents(element);
            }
            if (config.parent) {
                config.parent.appendChild(element);
            }
            if (config.children) {
                for (let i = 0; i < config.children.length; i++) {
                    element.appendChild(config.children[i]);
                }
            }
            return element;
        };
        this.checkTrusted = function (callback) {
            return function (ev) {
                if (ev && ev instanceof Event && (ev && typeof ev.isTrusted == "boolean" ? ev.isTrusted : true)) {
                    callback(ev);
                } else {
                    //console.error("Event is not trusted.", ev);
                }
            };
        };
        this.randomString = function (length) {
            let text = "";
            let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
            for (let i = 0; i < length; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length));
            }
            return text;
        };
        this.countInArray = function (array, val) {
            let count = 0;
            for (let i = 0; i < array.length; i++) {
                if (array[i] === val) count++;
            }
            return count;
        };
        this.hexToRgb = function (hex) {
            return hex.slice(1).match(/.{1,2}/g).map(g => parseInt(g, 16));
        };
        this.getRgb = function (r, g, b) {
            return [r / 255, g / 255, b / 255].join(", ");
        };
    }
};
class Animtext {
    // ANIMATED TEXT:
    constructor() {
        // INIT:
        this.init = function (x, y, scale, speed, life, text, color) {
            this.x = x;
            this.y = y;
            this.color = color;
            this.scale = scale * 3.5;
            this.weight = 50;
            this.startScale = this.scale * 1.2;
            this.maxScale = 1.5 * scale;
            this.minScale = 0.5 * scale;
            this.scaleSpeed = 0.7;
            this.speed = speed;
            this.speedMax = speed;
            this.life = life;
            this.maxLife = life;
            this.text = text;
            this.movSpeed = speed;
        };

        // UPDATE:
        this.update = function (delta) {
            if (this.life) {
                this.life -= delta;
                if (this.scaleSpeed != -0.35) {
                    this.y -= this.speed * delta;
                    // (this.x += this.speed * delta);
                } else {
                    this.y -= this.speed * delta;
                }
                this.scale -= .8;
                // this.scale > 0.35 && (this.scale = Math.max(this.scale, this.startScale));
                // this.speed < this.speedMax && (this.speed -= this.speedMax * .0075);
                if (this.scale >= this.maxScale) {
                    this.scale = this.maxScale;
                    this.scaleSpeed *= -.5;
                    this.speed = this.speed * .75;
                };
                this.life <= 0 && (this.life = 0)
            };
        };

        // RENDER:
        this.render = function (ctxt, xOff, yOff) {
            ctxt.lineWidth = 10;
            ctxt.strokeStyle = darkOutlineColor; //"black";
            ctxt.fillStyle = this.color;
            ctxt.globalAlpha = 1;
            ctxt.font = this.scale + "px HammerSmith One";
            ctxt.strokeText(this.text, this.x - xOff, this.y - yOff);
            ctxt.fillText(this.text, this.x - xOff, this.y - yOff);
            ctxt.globalAlpha = 1;
        };
    }
};
class Textmanager {
    // TEXT MANAGER:
    constructor() {
        this.texts = [];
        this.stack = [];

        // UPDATE:
        this.update = function (delta, ctxt, xOff, yOff) {
            ctxt.textBaseline = "middle";
            ctxt.textAlign = "center";
            for (let i = 0; i < this.texts.length; ++i) {
                if (this.texts[i].life) {
                    this.texts[i].update(delta);
                    this.texts[i].render(ctxt, xOff, yOff);
                }
            }
        };

        // SHOW TEXT:
        this.showText = function (x, y, scale, speed, life, text, color) {
            let tmpText;
            for (let i = 0; i < this.texts.length; ++i) {
                if (!this.texts[i].life) {
                    tmpText = this.texts[i];
                    break;
                }
            }
            if (!tmpText) {
                tmpText = new Animtext();
                this.texts.push(tmpText);
            }
            tmpText.init(x, y, scale, speed, life, text, color);
        };
    }
}
class GameObject {
    constructor(sid) {
        this.sid = sid;

        // INIT:
        this.init = function (x, y, dir, scale, type, data, owner) {
            data = data || {};
            this.sentTo = {};
            this.gridLocations = [];
            this.active = true;
            this.alive = true;
            this.doUpdate = data.doUpdate;
            this.x = x;
            this.y = y;
            if (config.anotherVisual) {
                this.dir = dir + Math.PI;
            } else {
                this.dir = dir;
            }
            this.lastDir = dir;
            this.xWiggle = 0;
            this.yWiggle = 0;
            this.visScale = scale;
            this.scale = scale;
            this.type = type;
            this.id = data.id;
            this.owner = owner;
            this.name = data.name;
            this.isItem = (this.id != undefined);
            this.group = data.group;
            this.maxHealth = data.health;
            this.health = this.maxHealth;
            this.layer = 2;
            if (this.group != undefined) {
                this.layer = this.group.layer;
            } else if (this.type == 0) {
                this.layer = 3;
            } else if (this.type == 2) {
                this.layer = 0;
            } else if (this.type == 4) {
                this.layer = -1;
            }
            this.colDiv = data.colDiv || 1;
            this.blocker = data.blocker;
            this.ignoreCollision = data.ignoreCollision;
            this.dontGather = data.dontGather;
            this.hideFromEnemy = data.hideFromEnemy;
            this.friction = data.friction;
            this.projDmg = data.projDmg;
            this.dmg = data.dmg;
            this.pDmg = data.pDmg;
            this.pps = data.pps;
            this.zIndex = data.zIndex || 0;
            this.turnSpeed = data.turnSpeed;
            this.req = data.req;
            this.trap = data.trap;
            this.healCol = data.healCol;
            this.teleport = data.teleport;
            this.boostSpeed = data.boostSpeed;
            this.projectile = data.projectile;
            this.shootRange = data.shootRange;
            this.shootRate = data.shootRate;
            this.reloads = this.shootRate;
            this.spawnPoint = data.spawnPoint;
            this.onNear = 0;
            this.breakObj = false;
            this.alpha = data.alpha || 1;
            this.maxAlpha = data.alpha || 1;
            this.damaged = 0;
            this.breakTime = 0;
        };
        // FADE-OUT PROCESS:
        this.startFadeOut = function () {
            this.fadingOut = true;
        };
        // GET HIT:
        this.changeHealth = function (amount, doer) {
            this.health += amount;
            return (this.health <= 0);
        };

        // GET SCALE:
        this.getScale = function (sM = 1, ig) {
            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4) ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
        };

        // VISIBLE TO PLAYER:
        this.visibleToPlayer = function (player) {
            return !(this.hideFromEnemy) || (this.owner && (this.owner == player ||
                (this.owner.team && player.team == this.owner.team)));
        };

        // UPDATE:
        this.update = function (delta) {
            if (this.active) {
                if (this.xWiggle) {
                    this.xWiggle *= Math.pow(0.99, delta);
                }
                if (this.yWiggle) {
                    this.yWiggle *= Math.pow(0.99, delta);
                }

                if (this.turnSpeed && this.dmg) {
                    this.dir += this.turnSpeed * delta;
                }
            } else if (this.fadingOut) {
                if (this.alpha > 0) {
                    this.alpha -= delta;
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.alive = false;
                        this.fadingOut = false;
                    }
                }
            } else {
                if (this.alive) {
                    this.alpha -= delta / (200 / this.maxAlpha);
                    this.visScale += delta / (this.scale / 2.5);
                    if (this.alpha <= 0) {
                        this.alpha = 0;
                        this.alive = false;
                    }
                }
            }
        };

        // CHECK TEAM:
        this.isTeamObject = function (tmpObj) {
            if (this.owner == null || tmpObj.sid == this.owner.sid || tmpObj.sid == player.sid && alliancePlayers.includes(this.owner.sid)) return true;
            let ownerPlayer = findPlayerBySID(this.owner.sid);
            if (ownerPlayer) return ownerPlayer.isTeam(tmpObj);
        };
    }
}

class Items {
    constructor() {
        // ITEM GROUPS:
        this.groups = [{
            id: 0,
            name: "food",
            layer: 0
        }, {
            id: 1,
            name: "walls",
            place: true,
            limit: 30,
            layer: 0
        }, {
            id: 2,
            name: "spikes",
            place: true,
            limit: 15,
            layer: 0
        }, {
            id: 3,
            name: "mill",
            place: true,
            limit: 7,
            layer: 1
        }, {
            id: 4,
            name: "mine",
            place: true,
            limit: 1,
            layer: 0
        }, {
            id: 5,
            name: "trap",
            place: true,
            limit: 6,
            layer: -1
        }, {
            id: 6,
            name: "booster",
            place: true,
            limit: 12,
            layer: -1
        }, {
            id: 7,
            name: "turret",
            place: true,
            limit: 2,
            layer: 1
        }, {
            id: 8,
            name: "watchtower",
            place: true,
            limit: 12,
            layer: 1
        }, {
            id: 9,
            name: "buff",
            place: true,
            limit: 4,
            layer: -1
        }, {
            id: 10,
            name: "spawn",
            place: true,
            limit: 1,
            layer: -1
        }, {
            id: 11,
            name: "sapling",
            place: true,
            limit: 2,
            layer: 0
        }, {
            id: 12,
            name: "blocker",
            place: true,
            limit: 3,
            layer: -1
        }, {
            id: 13,
            name: "teleporter",
            place: true,
            limit: 2,
            layer: -1
        }];

        // PROJECTILES:
        this.projectiles = [{
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 25,
            speed: 1.6,
            scale: 103,
            range: 1000
        }, {
            indx: 1,
            layer: 1,
            dmg: 25,
            speed: 1.5,
            scale: 20,
            range: 600
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 35,
            speed: 2.5,
            scale: 103,
            range: 1200
        }, {
            indx: 0,
            layer: 0,
            src: "arrow_1",
            dmg: 30,
            speed: 2,
            scale: 103,
            range: 1200
        }, {
            indx: 1, //idk what this is
            layer: 1,
            dmg: 16,
            scale: 20
        }, {
            indx: 0,
            layer: 0,
            src: "bullet_1",
            dmg: 50,
            speed: 3.6,
            scale: 160,
            range: 1400
        }];

        // WEAPONS:
        this.weapons = [{
            id: 0,
            type: 0,
            name: "tool hammer",
            desc: "tool for gathering all resources",
            src: "hammer_1",
            length: 140,
            width: 140,
            xOff: -3,
            yOff: 18,
            dmg: 25,
            range: 65,
            gather: 1,
            speed: 300
        }, {
            id: 1,
            type: 0,
            age: 2,
            name: "hand axe",
            desc: "gathers resources at a higher rate",
            src: "axe_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 30,
            spdMult: 1,
            range: 70,
            gather: 2,
            speed: 400
        }, {
            id: 2,
            type: 0,
            age: 8,
            pre: 1,
            name: "great axe",
            desc: "deal more damage and gather more resources",
            src: "great_axe_1",
            length: 140,
            width: 140,
            xOff: -8,
            yOff: 25,
            dmg: 35,
            spdMult: 1,
            range: 75,
            gather: 4,
            speed: 400
        }, {
            id: 3,
            type: 0,
            age: 2,
            name: "short sword",
            desc: "increased attack power but slower move speed",
            src: "sword_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 46,
            dmg: 35,
            spdMult: 0.85,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 4,
            type: 0,
            age: 8,
            pre: 3,
            name: "katana",
            desc: "greater range and damage",
            src: "samurai_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 59,
            dmg: 40,
            spdMult: 0.8,
            range: 118,
            gather: 1,
            speed: 300
        }, {
            id: 5,
            type: 0,
            age: 2,
            name: "polearm",
            desc: "long range melee weapon",
            src: "spear_1",
            iPad: 1.3,
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 45,
            knock: 0.2,
            spdMult: 0.82,
            range: 142,
            gather: 1,
            speed: 700
        }, {
            id: 6,
            type: 0,
            age: 2,
            name: "bat",
            desc: "fast long range melee weapon",
            src: "bat_1",
            iPad: 1.3,
            length: 110,
            width: 180,
            xOff: -8,
            yOff: 53,
            dmg: 20,
            knock: 0.7,
            range: 110,
            gather: 1,
            speed: 300
        }, {
            id: 7,
            type: 0,
            age: 2,
            name: "daggers",
            desc: "really fast short range weapon",
            src: "dagger_1",
            iPad: 0.8,
            length: 110,
            width: 110,
            xOff: 18,
            yOff: 0,
            dmg: 20,
            knock: 0.1,
            range: 65,
            gather: 1,
            hitSlow: 0.1,
            spdMult: 1.13,
            speed: 100
        }, {
            id: 8,
            type: 0,
            age: 2,
            name: "stick",
            desc: "great for gathering but very weak",
            src: "stick_1",
            length: 140,
            width: 140,
            xOff: 3,
            yOff: 24,
            dmg: 1,
            spdMult: 1,
            range: 70,
            gather: 7,
            speed: 400
        }, {
            id: 9,
            type: 1,
            age: 6,
            name: "hunting bow",
            desc: "bow used for ranged combat and hunting",
            src: "bow_1",
            req: ["wood", 4],
            length: 120,
            width: 120,
            xOff: -6,
            yOff: 0,
            Pdmg: 25,
            projectile: 0,
            spdMult: 0.75,
            speed: 600
        }, {
            id: 10,
            type: 1,
            age: 6,
            name: "great hammer",
            desc: "hammer used for destroying structures",
            src: "great_hammer_1",
            length: 140,
            width: 140,
            xOff: -9,
            yOff: 25,
            dmg: 10,
            Pdmg: 10,
            spdMult: 0.88,
            range: 75,
            sDmg: 7.5,
            gather: 1,
            speed: 400
        }, {
            id: 11,
            type: 1,
            age: 6,
            name: "wooden shield",
            desc: "blocks projectiles and reduces melee damage",
            src: "shield_1",
            length: 120,
            width: 120,
            shield: 0.2,
            xOff: 6,
            yOff: 0,
            Pdmg: 0,
            spdMult: 0.7
        }, {
            id: 12,
            type: 1,
            age: 8,
            pre: 9,
            name: "crossbow",
            desc: "deals more damage and has greater range",
            src: "crossbow_1",
            req: ["wood", 5],
            aboveHand: true,
            armS: 0.75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            Pdmg: 35,
            projectile: 2,
            spdMult: 0.7,
            speed: 700
        }, {
            id: 13,
            type: 1,
            age: 9,
            pre: 12,
            name: "repeater crossbow",
            desc: "high firerate crossbow with reduced damage",
            src: "crossbow_2",
            req: ["wood", 10],
            aboveHand: true,
            armS: 0.75,
            length: 120,
            width: 120,
            xOff: -4,
            yOff: 0,
            Pdmg: 30,
            projectile: 3,
            spdMult: 0.7,
            speed: 230
        }, {
            id: 14,
            type: 1,
            age: 6,
            name: "mc grabby",
            desc: "steals resources from enemies",
            src: "grab_1",
            length: 130,
            width: 210,
            xOff: -8,
            yOff: 53,
            dmg: 0,
            Pdmg: 0,
            steal: 250,
            knock: 0.2,
            spdMult: 1.05,
            range: 125,
            gather: 0,
            speed: 700
        }, {
            id: 15,
            type: 1,
            age: 9,
            pre: 12,
            name: "musket",
            desc: "slow firerate but high damage and range",
            src: "musket_1",
            req: ["stone", 10],
            aboveHand: true,
            rec: 0.35,
            armS: 0.6,
            hndS: 0.3,
            hndD: 1.6,
            length: 205,
            width: 205,
            xOff: 25,
            yOff: 0,
            Pdmg: 50,
            projectile: 5,
            hideProjectile: true,
            spdMult: 0.6,
            speed: 1500
        }];

        // ITEMS:
        this.list = [{
            group: this.groups[0],
            name: "apple",
            desc: "restores 20 health when consumed",
            req: ["food", 10],
            consume: function (doer) {
                return doer.changeHealth(20, doer);
            },
            scale: 22,
            holdOffset: 15,
            healing: 20,
            itemID: 0,
            itemAID: 16,
        }, {
            age: 3,
            group: this.groups[0],
            name: "cookie",
            desc: "restores 40 health when consumed",
            req: ["food", 15],
            consume: function (doer) {
                return doer.changeHealth(40, doer);
            },
            scale: 27,
            holdOffset: 15,
            healing: 40,
            itemID: 1,
            itemAID: 17,
        }, {
            age: 7,
            group: this.groups[0],
            name: "cheese",
            desc: "restores 30 health and another 50 over 5 seconds",
            req: ["food", 25],
            consume: function (doer) {
                if (doer.changeHealth(30, doer) || doer.health < 100) {
                    doer.dmgOverTime.dmg = -10;
                    doer.dmgOverTime.doer = doer;
                    doer.dmgOverTime.time = 5;
                    return true;
                }
                return false;
            },
            scale: 27,
            holdOffset: 15,
            healing: 30,
            itemID: 2,
            itemAID: 18,
        }, {
            group: this.groups[1],
            name: "wood wall",
            desc: "provides protection for your village",
            req: ["wood", 10],
            projDmg: true,
            health: 380,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 3,
            itemAID: 19,
        }, {
            age: 3,
            group: this.groups[1],
            name: "stone wall",
            desc: "provides improved protection for your village",
            req: ["stone", 25],
            health: 900,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 4,
            itemAID: 20,
        }, {
            age: 7,
            group: this.groups[1],
            name: "castle wall",
            desc: "provides powerful protection for your village",
            req: ["stone", 35],
            health: 1500,
            scale: 52,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 5,
            itemAID: 21,
        }, {
            group: this.groups[2],
            name: "spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 20, "stone", 5],
            health: 400,
            dmg: 20,
            scale: 49,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 6,
            itemAID: 22,
        }, {
            age: 5,
            group: this.groups[2],
            name: "greater spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 10],
            health: 500,
            dmg: 35,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 7,
            itemAID: 23,
        }, {
            age: 9,
            group: this.groups[2],
            name: "poison spikes",
            desc: "poisons enemies when they touch them",
            req: ["wood", 35, "stone", 15],
            health: 600,
            dmg: 30,
            pDmg: 5,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 8,
            itemAID: 24,
        }, {
            age: 9,
            group: this.groups[2],
            name: "spinning spikes",
            desc: "damages enemies when they touch them",
            req: ["wood", 30, "stone", 20],
            health: 500,
            dmg: 45,
            turnSpeed: 0.003,
            scale: 52,
            spritePadding: -23,
            holdOffset: 8,
            placeOffset: -5,
            itemID: 9,
            itemAID: 25,
        }, {
            group: this.groups[3],
            name: "windmill",
            desc: "generates gold over time",
            req: ["wood", 50, "stone", 10],
            health: 400,
            pps: 1,
            turnSpeed: 0.0016,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 45,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 10,
            itemAID: 26,
        }, {
            age: 5,
            group: this.groups[3],
            name: "faster windmill",
            desc: "generates more gold over time",
            req: ["wood", 60, "stone", 20],
            health: 500,
            pps: 1.5,
            turnSpeed: 0.0025,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 11,
            itemAID: 27,
        }, {
            age: 8,
            group: this.groups[3],
            name: "power mill",
            desc: "generates more gold over time",
            req: ["wood", 100, "stone", 50],
            health: 800,
            pps: 2,
            turnSpeed: 0.005,
            spritePadding: 25,
            iconLineMult: 12,
            scale: 47,
            holdOffset: 20,
            placeOffset: 5,
            itemID: 12,
            itemAID: 28,
        }, {
            age: 5,
            group: this.groups[4],
            type: 2,
            name: "mine",
            desc: "allows you to mine stone",
            req: ["wood", 20, "stone", 100],
            iconLineMult: 12,
            scale: 65,
            holdOffset: 20,
            placeOffset: 0,
            itemID: 13,
            itemAID: 29,
        }, {
            age: 5,
            group: this.groups[11],
            type: 0,
            name: "sapling",
            desc: "allows you to farm wood",
            req: ["wood", 150],
            iconLineMult: 12,
            colDiv: 0.5,
            scale: 110,
            holdOffset: 50,
            placeOffset: -15,
            itemID: 14,
            itemAID: 30,
        }, {
            age: 4,
            group: this.groups[5],
            name: "pit trap",
            desc: "pit that traps enemies if they walk over it",
            req: ["wood", 30, "stone", 30],
            trap: true,
            ignoreCollision: true,
            hideFromEnemy: true,
            health: 500,
            colDiv: 0.2,
            scale: 50,
            holdOffset: 20,
            placeOffset: -5,
            alpha: 0.6,
            itemID: 15,
            itemAID: 31,
        }, {
            age: 4,
            group: this.groups[6],
            name: "boost pad",
            desc: "provides boost when stepped on",
            req: ["stone", 20, "wood", 5],
            ignoreCollision: true,
            boostSpeed: 1.5,
            health: 150,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 16,
            itemAID: 32,
        }, {
            age: 7,
            group: this.groups[7],
            doUpdate: true,
            name: "turret",
            desc: "defensive structure that shoots at enemies",
            req: ["wood", 200, "stone", 150],
            health: 800,
            projectile: 1,
            shootRange: 700,
            shootRate: 2200,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 17,
            itemAID: 33,
        }, {
            age: 7,
            group: this.groups[8],
            name: "platform",
            desc: "platform to shoot over walls and cross over water",
            req: ["wood", 20],
            ignoreCollision: true,
            zIndex: 1,
            health: 300,
            scale: 43,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 18,
            itemAID: 34,
        }, {
            age: 7,
            group: this.groups[9],
            name: "healing pad",
            desc: "standing on it will slowly heal you",
            req: ["wood", 30, "food", 10],
            ignoreCollision: true,
            healCol: 15,
            health: 400,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 19,
            itemAID: 35,
        }, {
            age: 9,
            group: this.groups[10],
            name: "spawn pad",
            desc: "you will spawn here when you die but it will dissapear",
            req: ["wood", 100, "stone", 100],
            health: 400,
            ignoreCollision: true,
            spawnPoint: true,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 20,
            itemAID: 36,
        }, {
            age: 7,
            group: this.groups[12],
            name: "blocker",
            desc: "blocks building in radius",
            req: ["wood", 30, "stone", 25],
            ignoreCollision: true,
            blocker: 300,
            health: 400,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 21,
            itemAID: 37,
        }, {
            age: 7,
            group: this.groups[13],
            name: "teleporter",
            desc: "teleports you to a random point on the map",
            req: ["wood", 60, "stone", 60],
            ignoreCollision: true,
            teleport: true,
            health: 200,
            colDiv: 0.7,
            scale: 45,
            holdOffset: 20,
            placeOffset: -5,
            itemID: 22,
            itemAID: 38
        }];

        // CHECK ITEM ID:
        this.checkItem = {
            index: function (id, myItems) {
                return [0, 1, 2].includes(id) ? 0 :
                    [3, 4, 5].includes(id) ? 1 :
                        [6, 7, 8, 9].includes(id) ? 2 :
                            [10, 11, 12].includes(id) ? 3 :
                                [13, 14].includes(id) ? 5 :
                                    [15, 16].includes(id) ? 4 :
                                        [17, 18, 19, 21, 22].includes(id) ?
                                            [13, 14].includes(myItems) ? 6 :
                                                5 :
                                            id == 20 ?
                                                [13, 14].includes(myItems) ? 7 :
                                                    6 :
                                                undefined;
            }
        }

        // ASSIGN IDS:
        for (let i = 0; i < this.list.length; ++i) {
            this.list[i].id = i;
            if (this.list[i].pre) this.list[i].pre = i - this.list[i].pre;
        }

        // TROLOLOLOL:
        if (typeof window !== "undefined") {
            function shuffle(a) {
                for (let i = a.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [a[i], a[j]] = [a[j], a[i]];
                }
                return a;
            }
            //shuffle(this.list);
        }
    }
}
class Objectmanager {
    constructor(GameObject, gameObjects, UTILS, config) {
        let mathFloor = Math.floor,
            mathABS = Math.abs,
            mathCOS = Math.cos,
            mathSIN = Math.sin,
            mathPOW = Math.pow,
            mathSQRT = Math.sqrt,
            tmpX, tmpY,
            tmpS = config.mapScale / config.colGrid / 10;

        this.ignoreAdd = false;
        this.hitObj = [];
        this.grids = {};

        // DISABLE OBJ:
        this.disableObj = function (obj) {
            obj.active = false;
            obj.breakTime = Date.now();
            obj.startFadeOut();
            this.removeObjGrid(obj);
        };

        this.setObjectGrid = function (obj) {
            const gx = Math.floor(obj.x / tmpS);
            const gy = Math.floor(obj.y / tmpS);

            const key = gx + "_" + gy;

            if (!this.grids[key]) this.grids[key] = [];
            this.grids[key].push(obj);

            obj.gridKey = key;
        };

        // REMOVE OBJECT FROM GRID:
        this.removeObjGrid = function (obj) {
            const key = obj.gridKey;
            if (!key) return;

            const cell = this.grids[key];
            if (!cell) return;

            const i = cell.indexOf(obj);
            if (i !== -1) cell.splice(i, 1);

            obj.gridKey = null;
        };

        this.getGridArrays = function(x, y, r) {
            const minX = Math.floor((x - r) / tmpS);
            const maxX = Math.floor((x + r) / tmpS);
            const minY = Math.floor((y - r) / tmpS);
            const maxY = Math.floor((y + r) / tmpS);

            const result = [];

            for (let gx = minX; gx <= maxX; gx++) {
                for (let gy = minY; gy <= maxY; gy++) {
                    const cell = this.grids[gx + "_" + gy];
                    if (cell) result.push(cell);
                }
            }
            return result;
        }

        // ADD NEW:
        let tmpObj;
        this.add = function (sid, x, y, dir, s, type, data, setSID, owner) {
            tmpObj = findObjectBySid(sid);
            if (!tmpObj) {
                tmpObj = gameObjects.find((tmp) => !tmp.active);
                if (!tmpObj) {
                    tmpObj = new GameObject(sid);
                    gameObjects.push(tmpObj);
                }
            }
            if (setSID) {
                tmpObj.sid = sid;
            }
            tmpObj.init(x, y, dir, s, type, data, owner);
            this.setObjectGrid(tmpObj);
        };

        // DISABLE BY SID:
        this.disableBySid = function (sid) {
            let find = findObjectBySid(sid);
            if (find) {
                this.disableObj(find);
            }
        };

        // REMOVE ALL FROM PLAYER:
        this.removeAllItems = function (sid) {
            gameObjects.filter((tmp) => tmp.active && tmp.owner && tmp.owner.sid == sid).forEach((tmp) => this.disableObj(tmp));
        };

        // CHECK IF PLACABLE:
        this.checkItemLocation = function (x, y, s, sM, indx, ignoreWater) {
            let cantPlace = nearObjs.find((tmp) => UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return true;
        };

        this.preplaceCheck = function (x, y, s, sM, indx, ignoreWater, object) {
            let cantPlace = nearObjs.find((tmp) => tmp.sid != object.sid && UTILS.getDistance(x, y, tmp.x, tmp.y) < s + (tmp.blocker ? tmp.blocker : tmp.getScale(sM, tmp.isItem)));
            if (cantPlace) return false;
            if (!ignoreWater && indx != 18 && y >= config.mapScale / 2 - config.riverWidth / 2 && y <= config.mapScale / 2 + config.riverWidth / 2) return false;
            return UTILS.getDistance(x, y, object.x, object.y) <= s + object.scale;
        };

this.canBeBroken = function (object) {
    if (!inGame || !object || !enemy.length) return;

    const useHammer = autoBreak.useHammer(object);

    const playerWeapon = player.weapons[useHammer ? 1 : 0];
    const isPlayerPrimary = playerWeapon < 9;

    const playerVariant = isPlayerPrimary ? player.primaryVariant : player.secondaryVariant;

    const playerVariantDmg = playerVariant !== undefined ? config.weaponVariants[playerVariant].val : 1;

    const playerReloaded = isPlayerPrimary ? player.primaryReloaded : player.secondaryReloaded;

    // --- ENEMY ---
    let enemyWeapon = 10;
    if (near.secondaryIndex !== undefined && near.primaryIndex !== undefined) {
        enemyWeapon = near.secondaryIndex === 10 && (object.health > items.weapons[near.primaryIndex].dmg || near.primaryIndex === 5) ? near.secondaryIndex : near.primaryIndex;
    }

    const isEnemyPrimary = enemyWeapon < 9;

    const enemyVariant = near.secondaryIndex !== undefined && near.primaryIndex !== undefined ? (isEnemyPrimary ? near.primaryVariant : near.secondaryVariant) : 3;

    const enemyVariantDmg = config.weaponVariants[enemyVariant].val;

    const enemyReloaded = isEnemyPrimary ? near.primaryReloaded : near.secondaryReloaded;

    // --- DAMAGE ---
    const playerDamage = items.weapons[playerWeapon].dmg;
    const enemyDamage = items.weapons[enemyWeapon].dmg;

    const tank = 3.3;
    let damageThreat = 0;

    if (enemyReloaded && this.canHit(near, object, enemyWeapon)) {
        damageThreat += enemyDamage * tank * enemyVariantDmg * (items.weapons[enemyWeapon].sDmg || 1);
    }

    if (playerReloaded && (clicks.right || (autoBreak.active && (autoBreak.priority[0].includes(object) || autoBreak.priority[1].includes(object) || autoBreak.priority[2].includes(object))))) {
        damageThreat += playerDamage * tank * playerVariantDmg * (items.weapons[playerWeapon].sDmg || 1);
    }

    return object.health <= damageThreat;
};

        /*this.hitsToBreak = function (object, who) {
            if (!inGame || !object || !enemy.length || !who) return;

            // Determine player weapon and its variant damage
            let weapon = autoBreak.useHammer(object, who) ? who.weapons[1] : who.weapons[0];
            let variant = who[(weapon < 9 ? "prima" : "seconda") + "ryVariant"];
            let variantDmg = variant != undefined ? config.weaponVariants[variant].val : 1.18;
            let damage = items.weapons[weapon].dmg;

            let tank = 3.3;

            // Calculate hits required for player
            let effectiveDamage = damage * tank * variantDmg * (items.weapons[weapon].sDmg || 1);
            return Math.ceil(object.health / effectiveDamage);
        };*/

        this.canHit = function (player, object, weapon, moreSafe = 0) {
            return UTILS.getDist(player, object, 2, 0) <= items.weapons[weapon].range + object.scale + moreSafe;
        };

        this.checkCollision = function (obj1, obj2, delta = 1) {
            let x1 = obj1.x2 ? obj1.x2 : obj1.x;
            let y1 = obj1.y2 ? obj1.y2 : obj1.y;
            let x2 = obj2.x2 ? obj2.x2 : obj2.x;
            let y2 = obj2.y2 ? obj2.y2 : obj2.y;

            let dx = x1 - x2;
            let dy = y1 - y2;
            let tmpLen = obj1.scale + obj2.scale;
            if (mathABS(dx) <= tmpLen || mathABS(dy) <= tmpLen) {
                tmpLen = obj1.scale + obj2.getScale ? obj2.getScale() : obj2.scale;
                let tmpInt = mathSQRT(dx * dx + dy * dy) - tmpLen;
                if (tmpInt <= 0) {
                    if (!obj2.ignoreCollision) {
                        /*let tmpDir = UTILS.getDirection(x1, y1, x2, y2);
                        let tmpDist = UTILS.getDistance(x1, y1, x2, y2);
                        if (obj2.isPlayer) {
                            tmpInt = tmpInt * -1 / 2;
                            obj1.simX += mathCOS(tmpDir) * tmpInt;
                            obj1.simY += mathSIN(tmpDir) * tmpInt;
                            obj2.simX -= mathCOS(tmpDir) * tmpInt;
                            obj2.simY -= mathSIN(tmpDir) * tmpInt;
                        } else {
                            obj1.simX = obj2.simX + tmpLen * mathCOS(tmpDir);
                            obj1.simY = obj2.simY + tmpLen * mathSIN(tmpDir);
                            obj1.xVel *= 0.75;
                            obj1.yVel *= 0.75;
                        }*/
                        if (obj2.dmg && (obj2.isAI || !obj2.isTeamObject(obj1) || obj2.type == 1 && obj2.y >= 12000)) {
                            obj1.addDamageThreat("others", obj2.dmg);
                            /*let tmpSpd = 1.5 * obj2.weightM||1;
                            obj1.xVel += mathCOS(tmpDir) * tmpSpd;
                            obj1.yVel += mathSIN(tmpDir) * tmpSpd;*/
                            if (obj2.pDmg && obj1.skin != 23) {
                                obj1.poisonCounter = 5;
                            }
                            if (obj1.colDmg && obj2.health) {
                                obj2.health -= obj1.colDmg;
                            }
                        }
                    } else if (obj2.trap && !obj1.noTrap && !obj2.isTeamObject(obj1)) {
                        obj1.lockMove = true;
                        obj2.hideFromEnemy = false;
                        obj1.inTrap = obj2;
                    } else if (obj2.healCol) {
                        obj1.healCol = obj2.healCol;
                    }/* else if (obj2.boostSpeed) {
                        obj1.xVel += delta * obj2.boostSpeed * (obj2.weightM||1) * mathCOS(obj2.dir);
                        obj1.yVel += delta * obj2.boostSpeed * (obj2.weightM||1) * mathSIN(obj2.dir);
                    } else if (obj2.teleport) {
                        obj1.simX = UTILS.randInt(0, config.mapScale);
                        obj1.simY = UTILS.randInt(0, config.mapScale);
                    }*/
                    return true;
                }
            }
            return false;
        }
    }
}
class Projectile {
    constructor(players, ais, objectManager, items, config, UTILS) {

        // INIT:
        this.init = function (indx, x, y, dir, spd, dmg, rng, scl) {
            this.active = true;
            this.tickActive = true;
            this.indx = indx;
            this.startX = x;
            this.startY = y;
            this.x = x;
            this.y = y;
            this.dir = dir;
            this.skipMov = true;
            this.speed = spd;
            this.dmg = dmg;
            this.scale = scl;
            this.range = rng;
            this.x2 = x;
            this.y2 = y;
            this.r2 = rng;
            this.owner = undefined;
        };

        // UPDATE:
        this.update = function (delta) {
            if (this.active) {
                let tmpSpeed = this.speed * delta;
                if (!this.skipMov) {
                    this.x += tmpSpeed * Math.cos(this.dir);
                    this.y += tmpSpeed * Math.sin(this.dir);
                    this.range -= tmpSpeed;
                    if (this.range <= 0) {
                        this.x += this.range * Math.cos(this.dir);
                        this.y += this.range * Math.sin(this.dir);
                        tmpSpeed = 1;
                        this.range = 0;
                        this.active = false;
                    }
                } else {
                    this.skipMov = false;
                }
            }
        };
        this.tickUpdate = function (delta) {
            if (this.tickActive) {
                let tmpSpeed = this.speed * delta;
                if (!this.skipMov) {
                    this.x2 += tmpSpeed * Math.cos(this.dir);
                    this.y2 += tmpSpeed * Math.sin(this.dir);
                    this.r2 -= tmpSpeed;
                    if (this.r2 <= 0) {
                        this.x2 += this.r2 * Math.cos(this.dir);
                        this.y2 += this.r2 * Math.sin(this.dir);
                        tmpSpeed = 1;
                        this.r2 = 0;
                        this.tickActive = false;
                    }
                } else {
                    this.skipMov = false;
                }
            }
        };
    }
};
class Store {
    constructor() {
        // STORE HATS:
        this.hats = [{
            id: 45,
            name: "Shame!",
            dontSell: true,
            price: 0,
            scale: 120,
            desc: "hacks are for winners"
        }, {
            id: 51,
            name: "Moo Cap",
            price: 0,
            scale: 120,
            desc: "coolest mooer around"
        }, {
            id: 50,
            name: "Apple Cap",
            price: 0,
            scale: 120,
            desc: "apple farms remembers"
        }, {
            id: 28,
            name: "Moo Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 29,
            name: "Pig Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 30,
            name: "Fluff Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 36,
            name: "Pandou Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 37,
            name: "Bear Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 38,
            name: "Monkey Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 44,
            name: "Polar Head",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 35,
            name: "Fez Hat",
            price: 0,
            scale: 120,
            desc: "no effect"
        }, {
            id: 42,
            name: "Enigma Hat",
            price: 0,
            scale: 120,
            desc: "join the enigma army"
        }, {
            id: 43,
            name: "Blitz Hat",
            price: 0,
            scale: 120,
            desc: "hey everybody i'm blitz"
        }, {
            id: 49,
            name: "Bob XIII Hat",
            price: 0,
            scale: 120,
            desc: "like and subscribe"
        }, {
            id: 57,
            name: "Pumpkin",
            price: 50,
            scale: 120,
            desc: "Spooooky"
        }, {
            id: 8,
            name: "Bummle Hat",
            price: 100,
            scale: 120,
            desc: "no effect"
        }, {
            id: 2,
            name: "Straw Hat",
            price: 500,
            scale: 120,
            desc: "no effect"
        }, {
            id: 15,
            name: "Winter Cap",
            price: 600,
            scale: 120,
            desc: "allows you to move at normal speed in snow",
            coldM: 1
        }, {
            id: 5,
            name: "Cowboy Hat",
            price: 1000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 4,
            name: "Ranger Hat",
            price: 2000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 18,
            name: "Explorer Hat",
            price: 2000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 31,
            name: "Flipper Hat",
            price: 2500,
            scale: 120,
            desc: "have more control while in water",
            watrImm: true
        }, {
            id: 1,
            name: "Marksman Cap",
            price: 3000,
            scale: 120,
            desc: "increases arrow speed and range",
            aMlt: 1.3
        }, {
            id: 10,
            name: "Bush Gear",
            price: 3000,
            scale: 160,
            desc: "allows you to disguise yourself as a bush"
        }, {
            id: 48,
            name: "Halo",
            price: 3000,
            scale: 120,
            desc: "no effect"
        }, {
            id: 6,
            name: "Soldier Helmet",
            price: 4000,
            scale: 120,
            desc: "reduces damage taken but slows movement",
            spdMult: 0.94,
            dmgMult: 0.75
        }, {
            id: 23,
            name: "Anti Venom Gear",
            price: 4000,
            scale: 120,
            desc: "makes you immune to poison",
            poisonRes: 1
        }, {
            id: 13,
            name: "Medic Gear",
            price: 5000,
            scale: 110,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 9,
            name: "Miners Helmet",
            price: 5000,
            scale: 120,
            desc: "earn 1 extra gold per resource",
            extraGold: 1
        }, {
            id: 32,
            name: "Musketeer Hat",
            price: 5000,
            scale: 120,
            desc: "reduces cost of projectiles",
            projCost: 0.5
        }, {
            id: 7,
            name: "Bull Helmet",
            price: 6000,
            scale: 120,
            desc: "increases damage done but drains health",
            healthRegen: -5,
            dmgMultO: 1.5,
            spdMult: 0.96
        }, {
            id: 22,
            name: "Emp Helmet",
            price: 6000,
            scale: 120,
            desc: "turrets won't attack but you move slower",
            antiTurret: 1,
            spdMult: 0.7
        }, {
            id: 12,
            name: "Booster Hat",
            price: 6000,
            scale: 120,
            desc: "increases your movement speed",
            spdMult: 1.16
        }, {
            id: 26,
            name: "Barbarian Armor",
            price: 8000,
            scale: 120,
            desc: "knocks back enemies that attack you",
            dmgK: 0.6
        }, {
            id: 21,
            name: "Plague Mask",
            price: 10000,
            scale: 120,
            desc: "melee attacks deal poison damage",
            poisonDmg: 5,
            poisonTime: 6
        }, {
            id: 46,
            name: "Bull Mask",
            price: 10000,
            scale: 120,
            desc: "bulls won't target you unless you attack them",
            bullRepel: 1
        }, {
            id: 14,
            name: "Windmill Hat",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "generates points while worn",
            pps: 1.5
        }, {
            id: 11,
            name: "Spike Gear",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "deal damage to players that damage you",
            dmg: 0.45
        }, {
            id: 53,
            name: "Turret Gear",
            topSprite: true,
            price: 10000,
            scale: 120,
            desc: "you become a walking turret",
            turret: {
                proj: 1,
                range: 700,
                rate: 2500
            },
            spdMult: 0.7
        }, {
            id: 20,
            name: "Samurai Armor",
            price: 12000,
            scale: 120,
            desc: "increased attack speed and fire rate",
            atkSpd: 0.78
        }, {
            id: 58,
            name: "Dark Knight",
            price: 12000,
            scale: 120,
            desc: "restores health when you deal damage",
            healD: 0.4
        }, {
            id: 27,
            name: "Scavenger Gear",
            price: 15000,
            scale: 120,
            desc: "earn double points for each kill",
            kScrM: 2
        }, {
            id: 40,
            name: "Tank Gear",
            price: 15000,
            scale: 120,
            desc: "increased damage to buildings but slower movement",
            spdMult: 0.3,
            bDmg: 3.3
        }, {
            id: 52,
            name: "Thief Gear",
            price: 15000,
            scale: 120,
            desc: "steal half of a players gold when you kill them",
            goldSteal: 0.5
        }, {
            id: 55,
            name: "Bloodthirster",
            price: 20000,
            scale: 120,
            desc: "Restore Health when dealing damage. And increased damage",
            healD: 0.25,
            dmgMultO: 1.2,
        }, {
            id: 56,
            name: "Assassin Gear",
            price: 20000,
            scale: 120,
            desc: "Go invisible when not moving. Can't eat. Increased speed",
            noEat: true,
            spdMult: 1.1,
            invisTimer: 1000
        }];

        // STORE ACCESSORIES:
        this.accessories = [{
            id: 12,
            name: "Snowball",
            price: 1000,
            scale: 105,
            xOff: 18,
            desc: "no effect"
        }, {
            id: 9,
            name: "Tree Cape",
            price: 1000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 10,
            name: "Stone Cape",
            price: 1000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 3,
            name: "Cookie Cape",
            price: 1500,
            scale: 90,
            desc: "no effect"
        }, {
            id: 8,
            name: "Cow Cape",
            price: 2000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 11,
            name: "Monkey Tail",
            price: 2000,
            scale: 97,
            xOff: 25,
            desc: "Super speed but reduced damage",
            spdMult: 1.35,
            dmgMultO: 0.2
        }, {
            id: 17,
            name: "Apple Basket",
            price: 3000,
            scale: 80,
            xOff: 12,
            desc: "slowly regenerates health over time",
            healthRegen: 1
        }, {
            id: 6,
            name: "Winter Cape",
            price: 3000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 4,
            name: "Skull Cape",
            price: 4000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 5,
            name: "Dash Cape",
            price: 5000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 2,
            name: "Dragon Cape",
            price: 6000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 1,
            name: "Super Cape",
            price: 8000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 7,
            name: "Troll Cape",
            price: 8000,
            scale: 90,
            desc: "no effect"
        }, {
            id: 14,
            name: "Thorns",
            price: 10000,
            scale: 115,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 15,
            name: "Blockades",
            price: 10000,
            scale: 95,
            xOff: 15,
            desc: "no effect"
        }, {
            id: 20,
            name: "Devils Tail",
            price: 10000,
            scale: 95,
            xOff: 20,
            desc: "no effect"
        }, {
            id: 16,
            name: "Sawblade",
            price: 12000,
            scale: 90,
            spin: true,
            xOff: 0,
            desc: "deal damage to players that damage you",
            dmg: 0.15
        }, {
            id: 13,
            name: "Angel Wings",
            price: 15000,
            scale: 138,
            xOff: 22,
            desc: "slowly regenerates health over time",
            healthRegen: 3
        }, {
            id: 19,
            name: "Shadow Wings",
            price: 15000,
            scale: 138,
            xOff: 22,
            desc: "increased movement speed",
            spdMult: 1.1
        }, {
            id: 18,
            name: "Blood Wings",
            price: 20000,
            scale: 178,
            xOff: 26,
            desc: "restores health when you deal damage",
            healD: 0.2
        }, {
            id: 21,
            name: "Corrupt X Wings",
            price: 20000,
            scale: 178,
            xOff: 26,
            desc: "deal damage to players that damage you",
            dmg: 0.25
        }];
    }
};
class ProjectileManager {
    constructor(Projectile, projectiles, players, ais, objectManager, items, config, UTILS) {
        this.addProjectile = function (x, y, dir, range, speed, indx, layer) {
            let tmpData = items.projectiles[indx];
            let tmpProj;
            for (let i = 0; i < projectiles.length; ++i) {
                if (!projectiles[i].active) {
                    tmpProj = projectiles[i];
                    break;
                }
            }
            if (!tmpProj) {
                tmpProj = new Projectile(players, ais, objectManager, items, config, UTILS);
                tmpProj.sid = projectiles.length;
                projectiles.push(tmpProj);
            }
            tmpProj.init(indx, x, y, dir, speed, tmpData.dmg, range, tmpData.scale);
            tmpProj.layer = layer || tmpData.layer;
            tmpProj.src = tmpData.src;
            return tmpProj;
        };
    }
};
class AiManager {

    // AI MANAGER:
    constructor(ais, AI, players, items, objectManager, config, UTILS, scoreCallback, server) {

        // AI TYPES:
        this.aiTypes = [{
            id: 0,
            src: "cow_1",
            killScore: 150,
            health: 500,
            weightM: 0.8,
            speed: 0.00095,
            turnSpeed: 0.001,
            scale: 72,
            drop: ["food", 50]
        }, {
            id: 1,
            src: "pig_1",
            killScore: 200,
            health: 800,
            weightM: 0.6,
            speed: 0.00085,
            turnSpeed: 0.001,
            scale: 72,
            drop: ["food", 80]
        }, {
            id: 2,
            name: "Fat",
            src: "bull_2",
            hostile: true,
            dmg: 20,
            killScore: 1000,
            health: 1800,
            weightM: 0.5,
            speed: 0.00094,
            turnSpeed: 0.00074,
            scale: 78,
            viewRange: 800,
            chargePlayer: true,
            drop: ["food", 100]
        }, {
            id: 3,
            name: "Fatty",
            src: "bull_1",
            hostile: true,
            dmg: 20,
            killScore: 2000,
            health: 2800,
            weightM: 0.45,
            speed: 0.001,
            turnSpeed: 0.0008,
            scale: 90,
            viewRange: 900,
            chargePlayer: true,
            drop: ["food", 400]
        }, {
            id: 4,
            name: "Woof Woof",
            src: "wolf_1",
            hostile: true,
            dmg: 8,
            killScore: 500,
            health: 300,
            weightM: 0.45,
            speed: 0.001,
            turnSpeed: 0.002,
            scale: 84,
            viewRange: 800,
            chargePlayer: true,
            drop: ["food", 200]
        }, {
            id: 5,
            name: "Ur mOm :>",
            src: "chicken_1",
            dmg: 8,
            killScore: 2000,
            noTrap: true,
            health: 300,
            weightM: 0.2,
            speed: 0.0018,
            turnSpeed: 0.006,
            scale: 70,
            drop: ["food", 100]
        }, {
            id: 6,
            name: "Fat Bitch",
            nameScale: 50,
            src: "enemy",
            hostile: true,
            dontRun: true,
            fixedSpawn: true,
            spawnDelay: 60000,
            noTrap: true,
            colDmg: 100,
            dmg: 40,
            killScore: 8000,
            health: 18000,
            weightM: 0.4,
            speed: 0.0007,
            turnSpeed: 0.01,
            scale: 80,
            spriteMlt: 1.8,
            leapForce: 0.9,
            viewRange: 1000,
            hitRange: 210,
            hitDelay: 1000,
            chargePlayer: true,
            drop: ["food", 100]
        }, {
            id: 7,
            name: "5KKKKK",
            hostile: true,
            nameScale: 35,
            src: "crate_1",
            fixedSpawn: true,
            spawnDelay: 120000,
            colDmg: 200,
            killScore: 5000,
            health: 20000,
            weightM: 0.1,
            speed: 0.0,
            turnSpeed: 0.0,
            scale: 70,
            spriteMlt: 1.0
        }, {
            id: 8,
            name: "WOOFIE",
            src: "wolf_2",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 4,
            spawnDelay: 30000,
            noTrap: true,
            nameScale: 35,
            dmg: 10,
            colDmg: 100,
            killScore: 3000,
            health: 7000,
            weightM: 0.45,
            speed: 0.0015,
            turnSpeed: 0.002,
            scale: 90,
            viewRange: 800,
            chargePlayer: true,
            drop: ["food", 1000]
        }, {
            id: 9,
            name: "💀MOOFIE",
            src: "wolf_2",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 50,
            spawnDelay: 60000,
            noTrap: true,
            nameScale: 35,
            dmg: 12,
            colDmg: 100,
            killScore: 3000,
            health: 9000,
            weightM: 0.45,
            speed: 0.0015,
            turnSpeed: 0.0025,
            scale: 94,
            viewRange: 1440,
            chargePlayer: true,
            drop: ["food", 3000]
        }, {
            id: 10,
            name: "💀Wolf",
            src: "wolf_1",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 50,
            spawnDelay: 30000,
            nameScale: 35,
            dmg: 10,
            killScore: 700,
            health: 500,
            weightM: 0.45,
            speed: 0.00115,
            turnSpeed: 0.0025,
            scale: 88,
            viewRange: 1440,
            chargePlayer: true,
            drop: ["food", 400]
        }, {
            id: 11,
            name: "💀Bully",
            src: "bull_1",
            hostile: true,
            fixedSpawn: true,
            dontRun: true,
            hitScare: 50,
            spawnDelay: 100000,
            nameScale: 35,
            dmg: 20,
            killScore: 5000,
            health: 5000,
            weightM: 0.45,
            speed: 0.0015,
            turnSpeed: 0.0025,
            scale: 94,
            viewRange: 1440,
            chargePlayer: true,
            drop: ["food", 800]
        }];

        // SPAWN AI:
        this.spawn = function (x, y, dir, index) {
            let tmpObj = ais.find((tmp) => !tmp.active);
            if (!tmpObj) {
                tmpObj = new AI(ais.length, objectManager, players, items, UTILS, config, scoreCallback, server);
                ais.push(tmpObj);
            }
            tmpObj.init(x, y, dir, index, this.aiTypes[index]);
            return tmpObj;
        };
    }

};
class AI {
    constructor(sid, objectManager, players, items, UTILS, config, scoreCallback, server) {
        this.sid = sid;
        this.isAI = true;
        this.nameIndex = UTILS.randInt(0, config.cowNames.length - 1);

        // INIT:
        this.init = function (x, y, dir, index, data) {
            this.x = x;
            this.y = y;
            this.startX = data.fixedSpawn ? x : null;
            this.startY = data.fixedSpawn ? y : null;
            this.xVel = 0;
            this.yVel = 0;
            this.zIndex = 0;
            this.dir = dir;
            this.dirPlus = 0;
            this.index = index;
            this.src = data.src;
            if (data.name) this.name = data.name;
            this.weightM = data.weightM;
            this.speed = data.speed;
            this.killScore = data.killScore;
            this.turnSpeed = data.turnSpeed;
            this.scale = data.scale;
            this.maxHealth = data.health;
            this.leapForce = data.leapForce;
            this.health = this.maxHealth;
            this.chargePlayer = data.chargePlayer;
            this.viewRange = data.viewRange;
            this.drop = data.drop;
            this.dmg = data.dmg;
            this.hostile = data.hostile;
            this.dontRun = data.dontRun;
            this.hitRange = data.hitRange;
            this.hitDelay = data.hitDelay;
            this.hitScare = data.hitScare;
            this.spriteMlt = data.spriteMlt;
            this.nameScale = data.nameScale;
            this.colDmg = data.colDmg;
            this.noTrap = data.noTrap;
            this.spawnDelay = data.spawnDelay;
            this.hitWait = 0;
            this.waitCount = 1000;
            this.moveCount = 0;
            this.targetDir = 0;
            this.active = true;
            this.alive = true;
            this.runFrom = null;
            this.chargeTarget = null;
            this.dmgOverTime = {};
            this.inTrap = false;
        };

        let tmpRatio = 0;
        let animIndex = 0;
        this.animate = function (delta) {
            if (this.animTime > 0) {
                this.animTime -= delta;
                if (this.animTime <= 0) {
                    this.animTime = 0;
                    this.dirPlus = 0;
                    tmpRatio = 0;
                    animIndex = 0;
                } else {
                    if (animIndex == 0) {
                        tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                        this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                        if (tmpRatio >= 1) {
                            tmpRatio = 1;
                            animIndex = 1;
                        }
                    } else {
                        tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                        this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                    }
                }
            }
        };

        // ANIMATION:
        this.startAnim = function () {
            this.animTime = this.animSpeed = 600;
            this.targetAngle = Math.PI * 0.8;
            tmpRatio = 0;
            animIndex = 0;
        };

        this.update = function (delta) {
            let closeObjs = [];
            objectManager.getGridArrays(this.x, this.y, this.scale + 100).forEach(arr => {
                arr.forEach(obj => {
                    closeObjs.push(obj);
                });
            });
            let hitObjects = closeObjs.filter(e => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2);
            if (!this.noTrap) {
                let nearTrap = hitObjects.filter(e => e.trap)[0];
                this.inTrap = nearTrap;
                if (nearTrap) nearTrap.hideFromEnemy = false;
                if (configs.trapAnimals && !this.inTrap && UTILS.getDist(tmpObj, player, 2, 2) <= player.scale + this.scale + items.list[player.items[4]]?.scale - 5) {
                    if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
                    place(4, autoPlace.closeToAngle(UTILS.getDirect(tmpObj, player, 2, 2), autoPlace.ranges[4]));
                }
            }
            if (this.colDmg && hitObjects.some(e => e.dmg)) {
                let objectsHit = objectManager.hitObj;
                objectManager.hitObj = [];
                objectsHit.forEach((healthy) => {
                    healthy.health -= this.colDmg;
                });
            }
        }

    };

};

class Petal {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.damage = 10;
        this.health = 10;
        this.maxHealth = this.health;
        this.active = false;
        this.alive = false;
        this.timer = 1500;
        this.time = 0;
        this.damaged = 0;
        this.alpha = 1;
        this.scale = 9;
        this.visScale = this.scale;
    }
};
class addCh {
    constructor(x, y, chat, tmpObj) {
        this.x = x;
        this.y = y;
        this.alpha = 0;
        this.active = true;
        this.alive = false;
        this.chat = chat;
        this.owner = tmpObj;
    };
};
class DeadPlayer {
    constructor(x, y, dir, buildIndex, weaponIndex, weaponVariant, skinColor, scale, name) {
        this.x = x;
        this.y = y;
        this.lastDir = dir;
        this.dir = dir + Math.PI;
        this.buildIndex = buildIndex;
        this.weaponIndex = weaponIndex;
        this.weaponVariant = weaponVariant;
        this.skinColor = skinColor;
        this.scale = scale;
        this.visScale = 0;
        this.name = name;
        this.alpha = 1;
        this.active = true;
        this.animate = function (delta) {
            let d2 = UTILS.getAngleDist(this.lastDir, this.dir);
            if (d2 > 0.01) {
                this.dir += d2 / 20;
            } else {
                this.dir = this.lastDir;
            }
            if (this.visScale < this.scale) {
                this.visScale += delta / (this.scale / 2);
                if (this.visScale >= this.scale) {
                    this.visScale = this.scale;
                }
            }
            this.alpha -= delta / 30000;
            if (this.alpha <= 0) {
                this.alpha = 0;
                this.active = false;
            }
        }
    }
};

// something I made to try to predict player coordinates. Unfortunately I never finished it cuz of school.
class MovementSimulator {
    constructor(player) {
        this.startX = player.x2;
        this.startY = player.y2;
        this.x = this.startX;
        this.y = this.startY;
        this.scale = player.scale;
        this.startSlowMult = player.slowMult;
        this.slowMult = this.startSlowMult;
        this.skinIndex = player.skinIndex;
        this.tailIndex = player.tailIndex;
        this.startxVel = player.xVel;
        this.startyVel = player.yVel;
        this.xVel = this.startxVel;
        this.yVel = this.startyVel;
        this.weaponIndex = player.weaponIndex;
        this.sid = player.sid;
        this.team = player.team;
        this.startTick = game.tick;
        this.tick = this.startTick;
        this.startZ = player.zIndex;
        this.zIndex = this.startZ;
    }
    continueTick(delta, moveDir, firstTick) {
        this.tick++;
        //calculate everything without using any of the starting values
        if (!firstTick) {
            //this thing is only calculated once per tick, and im calculating in player.update so for the first tick here, we dont need to calculate it.
            if (this.slowMult < 1) {
                this.slowMult += 0.0008 * delta;
                if (this.slowMult > 1) {
                    this.slowMult = 1;
                }
            }
        }
            // skinIndex and tailIndex being 0 are not in the array but they have spdMult of 1
        let hat = findID(hats, this.skinIndex) || {};
        let tail = findID(accessories, this.tailIndex) || {};
        let spdMult = (items.weapons[this.weaponIndex].spdMult || 1) * (hat.spdMult || 1) * (tail.spdMult || 1) * (this.y <= config.snowBiomeTop ? (hat.coldM ? 1 : config.snowSpeed) : 1) * this.slowMult;
        if (this.y >= config.mapScale / 2 - config.riverWidth / 2 && this.y <= config.mapScale / 2 + config.riverWidth / 2) {
            if (hat.watrImm) {
                spdMult *= 0.75;
                this.xVel += config.waterCurrent * 0.4 * delta;
            } else {
                spdMult *= 0.33;
                this.xVel += config.waterCurrent * delta;
            }
        }
        let xVel = moveDir != undefined ? Math.cos(moveDir) : 0;
        let yVel = moveDir != undefined ? Math.sin(moveDir) : 0;
        let length = Math.sqrt(xVel * xVel + yVel * yVel);
        if (length != 0) {
            xVel /= length;
            yVel /= length;
        }
        if (xVel) this.xVel += xVel * config.playerSpeed * spdMult * delta;
        if (yVel) this.yVel += yVel * config.playerSpeed * spdMult * delta;
        this.zIndex = 0;
        let tmpSpeed = UTILS.getDistance(0, 0, this.xVel * delta, this.yVel * delta);
        let depth = Math.min(4, Math.max(1, Math.round(tmpSpeed / 40)));
        let tMlt = 1 / depth;
        let gotTrapped = false;
        let gotTp = false;
        let hitSpikes = [];
        for (let i = 0; i < depth; ++i) {
            if (this.xVel) this.x += this.xVel * delta * tMlt;
            if (this.yVel) this.y += this.yVel * delta * tMlt;
            let tmpList = objectManager.getGridArrays(this.x, this.y, this.scale + 100);
            for (let x = 0; x < tmpList.length; ++x) {
                for (let y = 0; y < tmpList[x].length; ++y) {
                    let object = tmpList[x][y];
                    if (tmpList[x][y].active) {
                        let dx = this.x - object.x;
                        let dy = this.y - object.y;
                        let tmpLen = this.scale + object.scale;
                        if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
                            tmpLen = this.scale + object.getScale();
                            let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
                            if (tmpInt <= 0) {
                                if (!object.ignoreCollision) {
                                    let tmpDir = UTILS.getDirection(this.x, this.y, object.x, object.y);
                                    this.x = object.x + tmpLen * Math.cos(tmpDir);
                                    this.y = object.y + tmpLen * Math.sin(tmpDir);
                                    this.xVel *= 0.75;
                                    this.yVel *= 0.75;
                                    if (object.dmg && !object.isTeamObject(this)) {
                                        let tmpSpd = 1.5 * (object.weightM || 1);
                                        this.xVel += tmpSpd * Math.cos(tmpDir);
                                        this.yVel += tmpSpd * Math.sin(tmpDir);
                                        hitSpikes.push(object);
                                    }
                                } else if (object.trap && !object.isTeamObject(this)) {
                                    gotTrapped = true;
                                } else if (object.boostSpeed) {
                                    this.xVel += delta * object.boostSpeed * Math.cos(object.dir);
                                    this.yVel += delta * object.boostSpeed * Math.sin(object.dir);
                                } else if (object.teleport) {
                                    gotTp = true;
                                }
                                if (object.zIndex > this.zIndex) this.zIndex = object.zIndex;
                            }
                        }
                    }
                }
            }
        }
        for (let i = 0; i < nears.length; ++i) {
            let near = nears[i];
            let dx = this.x - near.x;
            let dy = this.y - near.y;
            let tmpLen = this.scale + near.scale;
            if (Math.abs(dx) <= tmpLen || Math.abs(dy) <= tmpLen) {
                tmpLen = this.scale*2;
                let tmpInt = Math.sqrt(dx * dx + dy * dy) - tmpLen;
                if (tmpInt <= 0) {
                    let tmpDir = UTILS.getDirection(this.x, this.y, near.x, near.y)
                    tmpInt = (tmpInt * -1) / 2
                    this.x += tmpInt * Math.cos(tmpDir)
                    this.y += tmpInt * Math.sin(tmpDir)
                    //near.movementSimulator.x -= tmpInt * Math.cos(tmpDir)
                    //near.movementSimulator.y -= tmpInt * Math.sin(tmpDir)
                }
            }
        }
        if (this.xVel) {
            this.xVel *= Math.pow(config.playerDecel, delta);
            if (this.xVel <= 0.01 && this.xVel >= -0.01) this.xVel = 0;
        }
        if (this.yVel) {
            this.yVel *= Math.pow(config.playerDecel, delta);
            if (this.yVel <= 0.01 && this.yVel >= -0.01) this.yVel = 0;
        }

        if (this.x - this.scale < 0) this.x = this.scale;
        else if (this.x + this.scale > config.mapScale) this.x = config.mapScale - this.scale;
        if (this.y - this.scale < 0) this.y = this.scale;
        else if (this.y + this.scale > config.mapScale) this.y = config.mapScale - this.scale;

        return [gotTrapped, gotTp, hitSpikes];
    }
    spikeKB(spike) {
        let x = this.x;
        let y = this.y;
        let xVel = this.xVel;
        let yVel = this.yVel;
        let objX = spike.x;
        let objY = spike.y;
        let objScale = spike.getScale();
    }
    //some testing stuff where I try to predict where I will end up if I move in a certain way. Have not tested this at all so may be very inaccurate
    customMovement() {
        this.continueTick(113, 0, 1);
        this.continueTick(113, Math.PI / 2, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        this.continueTick(113, undefined, 0);
        console.log(this.x, this.y);
    }
}
class Player {
    constructor(id, sid, config, UTILS, projectileManager, objectManager, players, ais, items, hats, accessories, server, scoreCallback, iconCallback) {
        this.id = id;
        this.sid = sid;
        this.tmpScore = 0;
        this.team = null;
        this.latestSkin = 0;
        this.oldSkinIndex = 0;
        this.prevHW;
        this.prevDW;
        this.skinIndex = 0;
        this.latestTail = 0;
        this.oldTailIndex = 0;
        this.tailIndex = 0;
        this.hitTime = 0;
        this.lastHit = 0;
        this.pingPredict = -1;
        this.inWater = false;
        this.tails = {0: 1};
        this.antiTurretSpam = false;
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].price <= 0)
                this.tails[accessories[i].id] = 1;
        }
        this.skins = {0: 1};
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].price <= 0)
                this.skins[hats[i].id] = 1;
        }
        this.points = 0;
        this.dt = 0;
        this.hidden = false;
        this.itemCounts = {};
        this.isPlayer = true;
        this.pps = 0;
        this.moveDir = undefined;
        this.skinRot = 0;
        this.lastPing = 0;
        this.hitSpike = 0;
        this.iconIndex = 0;
        this.skinColor = 0;
        this.dist2 = 0;
        this.aim2 = 0;
        this.chat = {
            message: null,
            count: 0
        };
        //this.backupNobull = true;
        this.healSpeed = 0;

        // SPAWN:
        this.spawn = function (moofoll) {
            this.attacked = false;
            this.death = false;
            this.spinDir = 0;
            this.sync = false;
            this.antiBull = 0;
            //  this.bullTimer = 0;
            this.poisonCounter = 0;
            this.active = true;
            this.alive = true;
            this.lockMove = false;
            this.lockDir = false;
            this.minimapCounter = 0;
            this.chatCountdown = 0;
            this.shameCount = 0;
            this.shameTimer = 0;
            this.sentTo = {};
            this.gathering = 0;
            this.gatherIndex = 0;
            this.shooting = {};
            this.shootIndex = 9;
            this.autoGather = 0;
            this.animTime = 0;
            this.animSpeed = 0;
            this.mouseState = 0;
            this.buildIndex = -1;
            this.weaponIndex = 0;
            this.weaponCode = 0;
            this.weaponVariant = 0;
            this.primaryIndex = undefined;
            this.secondaryIndex = undefined;
            this.dmgOverTime = {};
            this.noMovTimer = 0;
            this.maxXP = 300;
            this.XP = 0;
            this.age = 1;
            this.kills = 0;
            this.upgrAge = 2;
            this.upgradePoints = 0;
            this.x = 0;
            this.y = 0;
            this.x2 = 0;
            this.y2 = 0;
            this.zIndex = 0;
            this.x3 = 0;
            this.y3 = 0;
            this.slowMult = 1;
            this.dir = 0;
            this.dirPlus = 0;
            this.targetAngle = 0;
            this.maxHealth = 100;
            this.health = this.maxHealth;
            this.oldHealth = this.maxHealth;
            this.damaged = 0;
            this.scale = config.playerScale;
            this.speed = config.playerSpeed;
            this.moveDir = undefined;
            this.resetResources(moofoll);
            this.items = [0, 3, 6, 10];
            this.weapons = [0];
            this.shootCount = 0;
            this.weaponXP = [];
            this.reloads = {
                0: 0,
                1: 0,
                2: 0,
                3: 0,
                4: 0,
                5: 0,
                6: 0,
                7: 0,
                8: 0,
                9: 0,
                10: 0,
                11: 0,
                12: 0,
                13: 0,
                14: 0,
                15: 0,
                53: 0,
            };
            this.primaryReloaded = true;
            this.secondaryReloaded = true;
            this.bowThreat = {
                9: 0,
                12: 0,
                13: 0,
                15: 0,
            };
            this.damageSources = {
                primary: 0,
                secondary: 0,
                turret: 0,
                projectile: 0,
                spike: 0,
                DOT: 0,
                counter: 0,
                totalNoSoldier: 0,
                totalSoldier: 0,
                sum: 0
            };
            this.inTrap = undefined;
            this.lastTrap = false;
            this.escaped = false;
            this.empAnti = false;
            this.needTick = 0;
            this.antiTimer = 2;
            this.healCol = 0;
            this.moveDist = 0;
            updateWeaponXPBars();
        };

        // RESET RESOURCES:
        this.resetResources = function (moofoll) {
            for (let i = 0; i < config.resourceTypes.length; ++i) {
                this[config.resourceTypes[i]] = moofoll ? 100 : 0;
            }
        };

        // ADD ITEM:
        this.getItemType = function (id) {
            let findindx = this.items.findIndex((ids) => ids == id);
            if (findindx != -1) {
                return findindx;
            } else {
                return items.checkItem.index(id, this.items);
            }
        };

        // SET DATA:
        this.setData = function (data) {
            this.id = data[0];
            this.sid = data[1];
            this.name = data[2];
            this.x = data[3];
            this.y = data[4];
            this.dir = data[5];
            this.health = data[6];
            this.maxHealth = data[7];
            this.scale = data[8];
            this.skinColor = data[9];
        };

        this.update = function (delta) {
            if (!this.alive) return;
            // MOVE:
            this.noMovTimer += delta;
            if (this.moveDist) this.noMovTimer = 0;
            if (this.slowMult < 1) {
                this.slowMult += 0.0008 * delta;
                if (this.slowMult > 1) {
                    this.slowMult = 1;
                }
            }
            let collideObjects = [];
            objectManager.getGridArrays(this.x, this.y, this.scale + 69).forEach(arr => {
                arr.forEach(obj => {
                    obj.active && collideObjects.push(obj);
                });
            });

            let hitObjects = collideObjects.filter(e => UTILS.getDist(e, this, 0, 2) <= this.scale + e.getScale() + 2);
            let nearTrap = hitObjects.filter(e => e.trap && !e.isTeamObject(this))[0];
            if (nearTrap) nearTrap.hideFromEnemy = false;
            this.lastTrap = this.inTrap;
            this.inTrap = nearTrap;
            this.escaped = !this.inTrap && this.lastTrap;
            if (this.inTrap) {
                this.xVel = 0;
                this.yVel = 0;
            } else {
                this.xVel = (this.x2 - this.oldPos.x2) / delta;
                this.yVel = (this.y2 - this.oldPos.y2) / delta;
                if (this.xVel) {
                    this.xVel *= Math.pow(config.playerDecel, delta);
                    if (this.xVel <= 0.01 && this.xVel >= -0.01) this.xVel = 0;
                }
                if (this.yVel) {
                    this.yVel *= Math.pow(config.playerDecel, delta);
                    if (this.yVel <= 0.01 && this.yVel >= -0.01) this.yVel = 0;
                }
            }
        };

        let tmpRatio = 0;
        let animIndex = 0;
        this.animate = function (delta) {
            if (this.animTime > 0) {
                this.animTime -= delta;
                if (this.animTime <= 0) {
                    this.animTime = 0;
                    this.dirPlus = 0;
                    tmpRatio = 0;
                    animIndex = 0;
                } else {
                    if (animIndex == 0) {
                        tmpRatio += delta / (this.animSpeed * config.hitReturnRatio);
                        this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.min(1, tmpRatio));
                        if (tmpRatio >= 1) {
                            tmpRatio = 1;
                            animIndex = 1;
                        }
                    } else {
                        tmpRatio -= delta / (this.animSpeed * (1 - config.hitReturnRatio));
                        this.dirPlus = UTILS.lerp(0, this.targetAngle, Math.max(0, tmpRatio));
                    }
                }
            }
        };

        // GATHER ANIMATION:
        this.startAnim = function (didHit, index) {
            this.animTime = this.animSpeed = items.weapons[index].speed;
            this.targetAngle = (didHit ? -config.hitAngle : -Math.PI);
            tmpRatio = 0;
            animIndex = 0;
        };

        // CAN SEE:
        this.canSee = function (other) {
            if (!other) return false;
            let dx = Math.abs(other.x - this.x) - other.scale;
            let dy = Math.abs(other.y - this.y) - other.scale;
            return dx <= (config.maxScreenWidth / 2) * 1.3 && dy <= (config.maxScreenHeight / 2) * 1.3;
        };

        // SHAME SYSTEM:
        this.judgeShame = function () {
            if (this.oldHealth < this.health) {
                if (this.hitTime) {
                    let timeSinceHit = Date.now() - this.hitTime;
                    this.hitTime = 0;
                    if (timeSinceHit < 120) {
                        this.shameCount++;
                        if (this.canPredictPing) {
                            this.canPredictPing = false;
                            this.pingPredict = timeSinceHit - ping.min;
                        }
                    } else {
                        this.shameCount = Math.max(0, this.shameCount - 2);
                    }
                }
            } else if (this.oldHealth > this.health) {
                let now = Date.now();
                if (now - this.lastHit > 300 && this.sid != player.sid) {
                    this.canPredictPing = true;
                }
                this.hitTime = now;
                this.lastHit = now;
            }
        };
        this.addShameTimer = function () {
            this.shameCount = 0;
            this.shameTimer = 30;
            let interval = workerSetInterval(() => {
                this.shameTimer--;
                if (this.shameTimer <= 0) {
                    workerClearInterval(interval);
                }
            }, 1000);
        };

        // CHECK TEAM:
        this.isTeam = function (tmpObj) {
            return this.sid == tmpObj.sid || this.sid == player.sid && alliancePlayers.includes(tmpObj.sid) || tmpObj.sid == player.sid && alliancePlayers.includes(this.sid) || this.team != null && tmpObj.team != null && this.team == tmpObj.team;
        };

        this.checkCanInsta = function (nobull) {
            let totally = 0;
            if (this.alive && inGame) {
                let primary = {
                    weapon: this.weapons[0],
                    variant: this.primaryVariant,
                    dmg: this.weapons[0] == undefined ? 0 : items.weapons[this.weapons[0]].dmg,
                };
                let secondary = {
                    weapon: this.weapons[1],
                    variant: this.secondaryVariant,
                    dmg: this.weapons[1] == undefined ? 0 : items.weapons[this.weapons[1]].Pdmg,
                };
                let bull = this.skins[7] && !nobull ? 1.5 : 1;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1;
                if (primary.weapon != undefined && this.primaryReloaded) {
                    totally += primary.dmg * pV * bull;
                }
                if (secondary.weapon != undefined && this.secondaryReloaded) {
                    totally += secondary.dmg;
                }
                if (this.skins[53] && this.reloads[53] <= (player.weapons[1] == 10 ? 0 : game.tickRate) && near.skinIndex != 22) {
                    totally += 25;
                }
                totally *= near.skinIndex == 6 ? 0.75 : 1;
                return totally;
            }
            return 0;
        };

        // UPDATE WEAPON RELOAD:
        this.manageReload = function () {
            if (this.shooting[53]) {
                this.shooting[53] = 0;
                this.reloads[53] = (2500 - game.tickRate);
            } else {
                if (this.reloads[53] > 0) {
                    this.reloads[53] = Math.max(0, this.reloads[53] - game.tickRate);
                }
            }
            if (this.gathering || this.shooting[1]) {
                if (this.gathering) {
                    this.gathering = 0;
                    this.reloads[this.gatherIndex] = (items.weapons[this.gatherIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                    this.attacked = true;
                }
                if (this.shooting[1]) {
                    this.shooting[1] = 0;
                    this.reloads[this.shootIndex] = (items.weapons[this.shootIndex].speed * (this.skinIndex == 20 ? 0.78 : 1));
                    this.attacked = true;
                }
            } else {
                this.attacked = false;
                if (this.buildIndex < 0) {
                    if (this.reloads[this.weaponIndex] > 0) {
                        this.reloads[this.weaponIndex] = Math.max(0, this.reloads[this.weaponIndex] - game.tickRate);
                        if (this.reloads[this.weapons[0]] == 0 && this.reloads[this.weaponIndex] == 0) {
                            this.antiBull++;
                            game.tickBase(() => {
                                this.antiBull = 0;
                            }, 1);
                        }
                    }
                }
            }
            if (this.weaponIndex < 9) {
                this.primaryReloaded = this.reloads[this.weaponIndex] <= game.tickRate * Math.floor(ping.avg / game.tickRate);
            } else {
                this.secondaryReloaded = this.reloads[this.weaponIndex] <= game.tickRate * Math.floor(ping.avg / game.tickRate);
            }
        };

        // FOR ANTI INSTA:
        this.addDamageThreat = function (type, damage) {
            this.damageSources[type] += damage;
            this.damageSources.sum += damage;
            this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, (this.damageSources.secondary + this.damageSources.turret));
            this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
        };
        this.removeDamageThreat = function (type, damage) {
            if (!damage) {
                this.damageSources[type] = 0;
                return;
            }
            let before = this.damageSources[type];
            this.damageSources[type] = Math.max(0, this.damageSources[type] - damage);
            let after = this.damageSources[type];
            let diff = before - after;
            this.damageSources.sum -= diff;
            this.damageSources.totalNoSoldier = this.damageSources.sum - Math.min(this.damageSources.primary, (this.damageSources.secondary + this.damageSources.turret));
            this.damageSources.totalSoldier = this.damageSources.totalNoSoldier * 0.75;
        }

        this.processDamages = function () {
            /* just noting down some stuff:
            plague mask gives poison for 6 ticks
            bull helmet affects great hammer secondary too
            ruby gives poison for 5 ticks
            plague mask + ruby gives poison for 5 ticks
            poison and bull tick happen on the same tick
            */
            nears.forEach((tmpObj) => {
                let primary = {
                    weapon: tmpObj.primaryIndex,
                    variant: tmpObj.primaryVariant,
                    dmg: 0
                }
                let secondary = {
                    weapon: tmpObj.secondaryIndex,
                    variant: tmpObj.secondaryVariant,
                    dmg: 0
                };
                primary.dmg = primary.weapon == undefined ? 45 : items.weapons[primary.weapon].dmg;
                secondary.dmg = primary.weapon == 0 ? 0 : secondary.weapon == undefined ? 50 : items.weapons[secondary.weapon].Pdmg;
                let pV = primary.variant != undefined ? config.weaponVariants[primary.variant].val : 1.18;
                let sV = secondary.variant != undefined ? [9, 12, 13, 15].includes(secondary.weapon) ? 1 : config.weaponVariants[secondary.variant].val : 1;
                if (primary.weapon == undefined || tmpObj.primaryReloaded) {
                    if (tmpObj.tailIndex == 11) {
                        primary.dmg = primary.dmg * pV * (player.skinIndex == 7 ? 1.5 : 1);
                    } else {
                        primary.dmg = primary.dmg * pV * 1.5;
                    }
                } else {
                    primary.dmg = 0;
                }
                this.addDamageThreat("primary", primary.dmg);
                if (secondary.weapon == undefined || tmpObj.secondaryReloaded) {
                    if (secondary.weapon == 10 && tmpObj.tailIndex == 11) {
                        secondary.dmg = secondary.dmg * sV * (player.skinIndex == 7 ? 1.5 : 1);
                    } else {
                        secondary.dmg = secondary.dmg * sV;
                    }
                } else {
                    secondary.dmg = 0;
                }
                this.addDamageThreat("secondary", secondary.dmg);
                if (tmpObj.reloads[53] == 0) {
                    this.addDamageThreat("turret", 25);
                }
                if (this.poisonCounter > 0 && [0, 7, 8].includes((game.tick - my.bullTick) % 9)) {
                    this.addDamageThreat("DOT", 5);
                }
            });
        };
    }
};

// SOME CODES:
function sendUpgrade(index) {
    player.reloads[index] = 0;
    packet("H", index);
}

function storeBuy(id, index) {
    packet("c", 1, id, index);
}

let sent = {
    hat: null,
    tail: null,
    weapon: null
};
function storeEquip(id, index) {
    let nID = player.skins[6] ? 6 : 0;
    if (player.alive && inGame) {
        if (index == 0) {
            if (player.skins[id]) {
                if (sent.hat == null) sent.hat = id;
                if (player.latestSkin != id) {
                    packet("c", 0, id, 0);
                }
            } else {
                if (sent.hat == null) sent.hat = nID;
                if (player.latestSkin != nID) {
                    packet("c", 0, nID, 0);
                }
            }
        } else if (index == 1) {
            if (player.tails[id]) {
                if (sent.tail == null) sent.tail = id;
                if (player.latestTail != id) {
                    packet("c", 0, id, 1);
                }
            } else {
                if (sent.tail == null) sent.tail = 0;
                if (player.latestTail != 0) {
                    packet("c", 0, 0, 1);
                }
            }
        }
    }
}
function selectToBuild(index, wpn) {
    packet("z", index, wpn);
}
function selectWeapon(index, isPlace) {
    if (!isPlace) {
        player.weaponCode = index;
    }
    packet("z", index, 1);
    sent.weapon = index;
}

function sendAutoGather(debug) {
    packet("K", 1, debug ? 2 : 1);
}

function resetMoveDir() {
    packet("e");
}

function sendAtck(id, angle) {
    packet("F", id, angle, 1);
}

function place(id, rad, type, tmpX, tmpY) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        if (id === 0 || (player.alive && inGame && (player.itemCounts[item.group.id] == undefined || player.itemCounts[item.group.id] < (config.isSandbox ? id === 3 || id === 5 ? 299 : 99 : (item.group.limit || 99))))) {
            selectToBuild(player.items[id]);
            sendAtck(1, rad);
            selectWeapon(player.weaponCode, 1);
            if (configs.placeVis) {
                if (!tmpX || !tmpY) {
                    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                    tmpX = player.x2 + tmpS * Math.cos(rad);
                    tmpY = player.y2 + tmpS * Math.sin(rad);
                }
                let targetArray = type ? preplaceVisible : placeVisible;
                targetArray.push({
                    x: tmpX,
                    y: tmpY,
                    name: item.name,
                    scale: item.scale,
                    dir: rad
                });
                workerSetTimeout(() => {
                    targetArray.shift();
                }, 111)
            }
        }
    } catch (e) {
        console.log(e)
    }
}

function checkPlace(id, rad, tmpX, tmpY) {
    try {
        if (id == undefined) return;
        let item = items.list[player.items[id]];
        if (!tmpX || !tmpY) {
            let tmpS = player.scale + item.scale + (item.placeOffset || 0);
            tmpX = player.x2 + tmpS * Math.cos(rad);
            tmpY = player.y2 + tmpS * Math.sin(rad);
        }
        if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false)) {
            place(id, rad, 0, tmpX, tmpY);
        }
    } catch (e) { }
}

// HEALING:
function healthBased() {
    if (player.health == player.maxHealth) return 0;
    if ((player.skinIndex != 45 && player.skinIndex != 56)) {
        return Math.ceil((player.maxHealth - player.health) / items.list[player.items[0]].healing);
    }
    return 0;
}

function getAttacker(damaged) {
    let attackers = nears.filter(tmp => {
        if (tmp.attacked) {
            let index = tmp.weaponIndex;
            let dmg = index > 8 ? items.weapons[index].Pdmg : items.weapons[index].dmg;
            let variant = tmp[(index < 9 ? "prima" : "seconda") + "ryVariant"]
            dmg = dmg * (tmp.skinIndex == 7 ? 1.5 : 1) * (tmp.tailIndex == 11 ? 0.2 : 1) * (config.weaponVariants[variant].val) * (player.skinIndex == 6 ? 0.75 : 1);
            if (Math.abs(damaged - dmg) < 0.000001) {
                if (player.skinIndex != 23) {
                    player.poisonCounter = variant == 3 ? 5 : tmp.skinIndex == 21 ? 6 : player.poisonCounter;
                }
                return true;
            }
        }
        return false;
    });
    return attackers;
}

function healer(extra = 0) {
    for (let i = 0; i < healthBased(); i++) {
        place(0, getAttackDir());
    }
    for (let i = 0; i < extra; i++) {
        place(0, getAttackDir());
    }
}

function predictHeal(howManyCookieToEat) {
    for (let i = 0; i < howManyCookieToEat; i++) {
        place(0, getAttackDir());
    }
}

function antiSyncHealing(timearg) {
    my.antiSync = true;
    let healAnti = workerSetInterval(() => {
        if (player.shameCount < 5) {
            place(0, getAttackDir());
        }
    }, 75);
    workerSetTimeout(() => {
        workerClearInterval(healAnti);
        workerSetTimeout(() => {
            my.antiSync = false;
        }, game.tickRate);
    }, game.tickRate);
}
let loopHats = [28, 29, 30, 36, 37, 38, 44];
let aCounter = 0;

function biomeGear(mover, returns) {
    if (player.inWater) {
        if (returns) return 31;
        storeEquip(31, 0);
    } else {
        if (!configs.hatType || options.hatType == "ag") {
            if (player.y2 <= config.snowBiomeTop) {
                if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15;
                storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 15, 0);
            } else {
                if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12;
                storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : 12, 0);
            }
        } else {
            if (options.hatType == "bg") {
                if (returns) return 10;
                storeEquip(10, 0)
            } else if (options.hatType == "loop") {
                aCounter = (aCounter >= loopHats.length - 1 ? 0 : aCounter + 1);
                if (player.y2 <= config.snowBiomeTop) {
                    if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                    storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                } else {
                    if (returns) return mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter];
                    storeEquip(mover && (player.moveDir == null || player.antiTurretSpam) ? 22 : loopHats[aCounter], 0);
                }
            }
        }
    }
    if (returns) return 0;
}

function woah(mover) {
    storeEquip(mover && player.moveDir == undefined ? 0 : 11, 1);
}

const findPlacementAngle = (id, build) => {
    if (!build) return null;
    const item = items.list[player.items[id]];
    if (!item) return null;
    let closeAngles = autoPlace.closestPossibleAngles(build, id);
    if (closeAngles.length < 2) return null;
    if (!autoPlace.preplaceRanges[id]) autoPlace.calcPreplace(build, id);
    let clampRange = [autoPlace.normalizeArc(closeAngles[0], closeAngles[1])];
    autoPlace.debugRender[60] = clampRange;
    autoPlace.debugRender[80] = autoPlace.preplaceRanges[id];
    let preplaceRanges = autoPlace.intersectRanges(autoPlace.preplaceRanges[id], clampRange);
    autoPlace.debugRender[100] = preplaceRanges;
    if (!preplaceRanges.length) return null;
    if (near.inTrap) { // if enemy in trap
        if (build.sid != near.inTrap.sid) { //if enemy in trap and not preplacing the trap
            let trapAngle = UTILS.getDirect(near.inTrap, player, 0, 2);
            //id should be 2 and it tries to place spike near the trap
            return autoPlace.closeToAngle(trapAngle, preplaceRanges);
        } else if (id == 4) { //if preplacing the trap and retrapping
            //find a angle thats closest to a nearby spike and also can cause the near to stay in the trap. If nothing is gotten, go the the end of this function and just preplace directly on the trap.
            let spike = nearObjs.filter(obj => obj.dmg && obj.isTeamObject(player) && UTILS.getDist(obj, near.inTrap, 0, 0) <= near.inTrap.scale + obj.scale + 69).sort((a, b) => UTILS.getDist(a, near.inTrap, 0, 0) - UTILS.getDist(b, near.inTrap, 0, 0))[0];

            if (spike) { //only if there is a spike nearby
                let playerObject = {
                    x: near.x2,
                    y: near.y2,
                    getScale: function () {
                        return player.scale - item.scale;
                    }
                }
                let closeAngles = autoPlace.closestPossibleAngles(playerObject, id);
                if (closeAngles.length == 2) {
                    let retrapRange = [autoPlace.normalizeArc(closeAngles[0], closeAngles[1])];
                    let intersection = autoPlace.intersectRanges(preplaceRanges, retrapRange);
                    autoPlace.debugRender[120] = retrapRange;
                    autoPlace.debugRender[140] = intersection;
                    return autoPlace.closeToAngle(UTILS.getDirect(spike, player, 0, 2), intersection);
                }
            }
        }
    }
    let buildingAngle = UTILS.getDirect(build, player, 0, 2);
    //if no spike nearby, preplace as close as possible, if enemy not in trap, also come here, basically default place close to the preplacing building
    return autoPlace.closeToAngle(buildingAngle, preplaceRanges);
};
const preplacer = () => {
    if (near.dist2 > 269 || !configs.autoPrePlace) return;
    const replaceable = [];
    for (let i of nearObjs) {
        if (!i.isItem || UTILS.getDist(i, player, 0, 2) > 200 || (i.isTeamObject(player) && i.hideFromEnemy && !autoBreak.priority[1].includes(i))) continue;
        if (objectManager.canBeBroken(i)) {
            replaceable.push(i);
        }
    }
    let found = 0;
    replaceable.forEach((build) => {
        if (found > 2) return;
        let buildId = near.inTrap && !my.autoPush && ((options.autoPrePlace == "spike" && player.primaryReloaded) || build.sid != near.inTrap.sid) ? 2 : 4;
        let angle = findPlacementAngle(buildId, build);
        if (angle === null) return;
        scheduleAction(() => {
            place(buildId, angle, 1);
        }, 3)
        found++;
    });
};

let advHeal = [];

class Traps {
    constructor(UTILS, items) {
        this.replaced = true;
        this.antiTrapped = false;
        this.radObjs = [];
        this.preplaces = [[], []];
        this.testCanPlace = function (id, first = -(Math.PI / 2), repeat = (Math.PI / 2), plus = (Math.PI / 18), radian, loopAll, noOverlap, special) { //id, first, repeat, plus, radian, loopAll, noOverlap, special
            try {
                let item = items.list[player.items[id]];
                let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                let counts = {
                    attempts: 0,
                    placed: 0,
                };
                let tmpObjects = [];
                nearObjs.forEach((p) => {
                    tmpObjects.push({
                        x: p.x,
                        y: p.y,
                        blocker: p.blocker,
                        scale: p.scale,
                        isItem: p.isItem,
                        type: p.type,
                        colDiv: p.colDiv,
                        getScale: function (sM = 1, ig) {
                            return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                        },
                    });
                });
                for (let i = first; (loopAll ? i <= repeat : i < repeat); i += plus) {
                    counts.attempts++;
                    let relAim = radian + i;
                    let tmpX = player.x2 + tmpS * Math.cos(relAim);
                    let tmpY = player.y2 + tmpS * Math.sin(relAim);
                    let cantPlace = tmpObjects.find((tmp) => UTILS.getDistance(tmpX, tmpY, tmp.x, tmp.y) < item.scale + (tmp.blocker ? tmp.blocker : tmp.getScale(0.6, tmp.isItem)));
                    if (cantPlace) continue;
                    if (item.id != 18 && tmpY >= config.mapScale / 2 - config.riverWidth / 2 && tmpY <= config.mapScale / 2 + config.riverWidth / 2) continue;
                    place(id, relAim, 0, tmpX, tmpY);
                    counts.placed++;
                    if (noOverlap) {
                        tmpObjects.push({
                            x: tmpX,
                            y: tmpY,
                            blocker: item.blocker,
                            scale: item.scale,
                            isItem: true,
                            type: null,
                            colDiv: item.colDiv,
                            getScale: function (sM = 1, ig) {
                                return this.scale * ((this.isItem || this.type == 2 || this.type == 3 || this.type == 4)
                                    ? 1 : (0.6 * sM)) * (ig ? 1 : this.colDiv);
                            },
                        });
                    }
                    if (special == 1) {
                        this.preplaces[0].push({
                            x: tmpX,
                            y: tmpY,
                            scale: item.scale,
                        });
                    }
                    if (counts.placed > 0) {
                        if ([1, 2].includes(special) && item.dmg) {
                            if (UTILS.getDist(near, { x: tmpX, y: tmpY }, 2, 0) < player.scale + item.scale && configs.spikeTick) {
                                instaC.canSpikeTick = true;
                            }
                        }
                        if (special == 2 && item.dmg && counts.placed >= 8 && targetPlayer.isTeam(player)) {
                            if (player.isLeader) {
                                packet("Q", targetPlayer.sid)
                            } else {
                                packet("N")
                            }
                        }
                        if (special == 3) {
                            //not working yet
                            autoBreak.priority[2].push({ x: tmpX, y: tmpY, scale: 45, health: 200 });
                        }
                    }
                }
            } catch (err) {
            }
        };
        this.createObj = function (item, direct) {
            let preObj = {
                id: item.id,
                dir: direct,
                scale: item.scale,
                colDiv: item.colDiv,
                //this function mainly for spike/cactus stuff to decrease checks or maybe this is bad for optimisation cuz its not used much?
                getScale: function (sM, ig) { //im keeping the sM here cuz to decrease confusion otherwise doing .getScale(0.6, .isItem) somewhere and .getScale(.isItem) at other places is confusing
                    return this.scale * (ig ? 1 : this.colDiv);
                },
            };

            preObj.x = player.x2 + (player.scale + preObj.scale + (item.placeOffset || 0)) * Math.cos(preObj.dir);
            preObj.y = player.y2 + (player.scale + preObj.scale + (item.placeOffset || 0)) * Math.sin(preObj.dir);
            return preObj;
        }
        this.radCalc = function (obj, direct, item, type) {
            let preObj = this.createObj(item, direct);
            let getScale = obj.getScale(0.6, obj.isItem);

            let dist = UTILS.getDist(obj, preObj, 0, 0);
            let scale = getScale + preObj.scale;

            let angles = [];
            if (dist < scale) {
                let calc = Math.acos(dist / scale);
                let sum = [calc, -calc];

                for (let i = 0; i < sum.length; i++) {
                    let angle = direct + sum[i];
                    preObj = this.createObj(item, angle);

                    let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                    if (nears) continue;

                    let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                    if (renears) continue;

                    let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                    if (canPlace) {
                        angles.push(angle);
                        this.preplaces[1].push(preObj);
                    }
                }

            } else {
                if (type) return [];

                preObj = this.createObj(item, direct);

                let nears = this.preplaces[1].length ? this.preplaces[1].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                if (nears) return [];

                let renears = this.preplaces[0].length ? this.preplaces[0].some(pos => UTILS.getDist(pos, preObj, 0, 0) < pos.scale + preObj.scale) : false;
                if (renears) return [];

                let canPlace = objectManager.checkItemLocation(preObj.x, preObj.y, preObj.scale, 0.6, preObj.id, false);
                if (canPlace) {
                    angles.push(direct);
                    this.preplaces[1].push(preObj);
                }
            }
            return angles;
        };
        this.checkSpikeTick = function () {
            if (!configs.safeAntiSpikeTick || !enemy.length) return false;

            if (near.dist2 <= 200) {
                if (player.escaped || (player.inTrap && objectManager.canBeBroken(player.inTrap))) {
                    if (player.escaped) my.anti0Tick = 2;
                    let damage = [13, 15].includes(near.secondaryIndex) ? 35 : 45;
                    if (!([9, 12, 13, 15].includes(near.secondaryIndex) && near.secondaryReloaded)) {
                        player.addDamageThreat("spike", damage);
                    }
                    player.chat.message = `Break trap tick detected by ${near.sid} ${near.name}`;
                    player.chat.count = 223;
                    game.tickBase(() => {
                        if (!([9, 12, 13, 15].includes(near.secondaryIndex) && near.secondaryReloaded)) {
                            player.addDamageThreat("spike", damage);
                        }
                    }, 1)
                }
            }
            if (near.dist2 <= 200) {
                if (!player.inTrap) {
                    if (near.primaryReloaded) {
                        let spikeSet = new Set(); // Track unique spike sids
                        for (let tmp of nearObjs) {
                            if ((tmp.dmg && tmp.active && !tmp.isTeamObject(player)) || (tmp.type == 1 && tmp.y >= 12000)) {
                                let nea = Math.atan2(player.y2 - near.y2, player.x2 - near.x2);
                                let primaryKB = (items.weapons[near.weapons[0]].knock || 0) * items.weapons[near.weapons[0]].range + player.scale * 2;
                                let secondaryKB = ![undefined, 9, 12, 13, 15].includes(near.weapons[1]) ? (items.weapons[near.weapons[1]].knock || 0) * items.weapons[near.weapons[1]].range + player.scale * 2 : 60;
                                let turretKB = 50;

                                let totalKB = primaryKB + secondaryKB + turretKB;
                                let steps = 24
                                let stepKB = totalKB / steps
                                let skipDistance = 35;

                                for (let i = 1; i <= steps; i++) {
                                    let traveledDist = stepKB * i;
                                    if (traveledDist < skipDistance) continue;

                                    let stepX = player.x2 + (stepKB * i) * Math.cos(nea);
                                    let stepY = player.y2 + (stepKB * i) * Math.sin(nea);

                                    kbIndc.mex = stepX;
                                    kbIndc.mey = stepY;

                                    let distToSpike = UTILS.getDist({ x: stepX, y: stepY }, tmp, 0, 0);

                                    if (distToSpike <= (tmp.getScale() + player.scale * 1.5)) {
                                        spikeSet.add(tmp.sid);
                                    }
                                }
                            }
                        }
                        if (spikeSet.size) {
                            spikeSet.forEach(sid => {
                                player.addDamageThreat("spike", findObjectBySid(sid).dmg || 35);
                            });
                        }
                        if ([3, 4, 5].includes(near.primaryIndex) && spikeSet.size) {
                            my.anti0Tick = 1;
                            player.chat.message = `PaS detected by ${near.sid} ${near.name}`;
                            player.chat.count = 112;
                        }
                    }
                }
            }
        };
        this.protect = function (aim) {
            if (!configs.antiTrap) return;
            this.testCanPlace(4, -(Math.PI / 2), (Math.PI / 2), (Math.PI / 3), aim + Math.PI, true);
            this.testCanPlace(2, -(Math.PI / 3), (Math.PI / 3), (Math.PI / 3), aim + Math.PI, true);
            this.antiTrapped = true;
        };

        this.autoPlace = function (type, id, id2, reasonhaha) {
            if (!enemy.length) return;
            if (!configs.autoPlace) return;

            if (type == 0) {
                // id only

                if (id == undefined) return;

                let itemId = player.items[id];
                if (itemId == undefined) return;

                let item = items.list[itemId];

                let itemId2 = id2 == undefined ? null : player.items[id2];
                let item2 = itemId2 == undefined ? null : items.list[itemId2];

                this.radObjs = nearObjs;
                if (this.radObjs.length) {
                    for (let i = 0; i < this.radObjs.length; i++) {
                        let obj = this.radObjs[i];
                        let direct = UTILS.getDirect(obj, player, 0, 2);
                        let placeAngles = this.radCalc(obj, direct, item);
                        if (placeAngles.length) {
                            for (let i = 0; i < placeAngles.length; i++) {
                                place(id, placeAngles[i]);
                            }
                        } else {
                            if (item2) {
                                let obj = this.radObjs[i];
                                let direct = UTILS.getDirect(obj, player, 0, 2);
                                let placeAngles = this.radCalc(obj, direct, item2);
                                if (placeAngles.length) {
                                    for (let i = 0; i < placeAngles.length; i++) {
                                        place(id2, placeAngles[i]);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    for (let i = 0; i < Math.PI * 2; i += Math.PI / 2) {
                        checkPlace(id, near.aim2 + i);
                    }
                }
            } else if (type == 1) {
                // id and id2
                if (id == undefined) return;

                let itemId = player.items[id];
                if (itemId == undefined) return;

                let item = items.list[itemId];

                //let itemId2 = id2 == undefined ? null : player.items[id2];
                //let item2 = itemId2 == undefined ? null : items.list[itemId2];

                this.radObjs = nearObjs.filter(obj => {
                    if (obj.isTeamObject(player)) {
                        if ((id == 4 ? obj.dmg : obj.trap) /* && obj.isTeamObject(player)*/) {
                            let dist = UTILS.getDist(obj, near, 0, 2);
                            if (dist < 500) {
                                return true;
                            }
                        }
                    }
                });
                if (this.radObjs.length) {
                    for (let i = 0; i < this.radObjs.length; i++) {
                        let obj = this.radObjs[i];
                        let direct = UTILS.getDirect(obj, player, 0, 2);
                        let placeAngles = this.radCalc(obj, direct, item, 1);
                        if (placeAngles.length) {
                            for (let i = 0; i < placeAngles.length; i++) {
                                place(id, placeAngles[i]);
                            }
                        }
                    }
                }
                if (reasonhaha) {
                    this.autoPlace(type, id2, id, false);
                } else {
                    if (type == 1 && this.preplaces[1].length < 1) {
                        this.autoPlace(0, id2, id);
                    }
                }
            }
        };
        this.autoReplace = function (building) {
            if (!enemy.length || near.dist2 > 300 || !configs.autoReplace || this.replaced || configs.weaponGrind) return;
            game.tickBase(() => {
                let breakDist = UTILS.getDist(building, player, 0, 2)
                if (breakDist > 300) return;
                if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
                if (!autoPlace.rangesUpdated[4]) autoPlace.angleRanges(4);
                let breakDir = UTILS.getDirect(building, player, 0, 2);
                let sid = building.sid;
                this.replaced = true;
                if (near.escaped) {
                    if (sid == near.lastTrap.sid && [4, 5].includes(player.weapons[0]) && player.primaryReloaded && !my.autoPush) {
                        return this.testCanPlace(2, -Math.PI / 3, Math.PI / 3, Math.PI / 7.5, near.aim2, true, false, 1)
                    } else {
                        checkPlace(4, near.aim2)
                        checkPlace(4, near.aim2 + Math.PI / 12)
                        checkPlace(4, near.aim2 - Math.PI / 12)
                        place(4, autoPlace.closeToAngle(near.aim2, autoPlace.ranges[4]));
                        // this.testCanPlace(4, near.aim2 - Math.PI/12, near.aim2 + Math.PI/12, Math.PI/12, near.aim2, 1);
                        return;
                    }
                }
                if (near.inTrap && UTILS.getDist(player, near.inTrap, 0, 0) <= 169) {
                    return place(2, autoPlace.closeToAngle(UTILS.getDirect(near.inTrap, player, 0, 2), autoPlace.ranges[2]));
                }
                if (player.escaped && sid == player.lastTrap.sid) {
                    return this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 4, UTILS.randFloat(0, Math.PI * 2), true, false, 1);
                }
                this.testCanPlace(4, 0, Math.PI * 2, Math.PI / 4, breakDir, true, true, 1);
            }, 1);

        };
    }
};

//some autobreaking system I made. It can definitely be improved more.
//some improvements will be making it calculate with predicted player coordinates instead of x2 and y2 as the game calculates movement before attack. NOT x3 y3 cuz those are dumb predictions and very not accurate. But can use the movement simulator instead
class AutoBreaker {
    constructor() {
        this.active = false; // Indicates if the auto-breaker system is active
        this.aim = 0; // Current aim direction
        this.priority = [[], [], [], []]; // Priority lists for target objects
        this.target = null; // Stores the closest current target
    }

    objectsHit(aim) {
        let results = [];
        nearObjs.forEach(e => {
            let dir = UTILS.getDirect(e, player, 0, 2);
            if (e.type == null && UTILS.getDist(player, e, 2, 0) < items.weapons[this.useHammer(e) ? player.weapons[1] : player.weapons[0]].range + e.scale && UTILS.getAngleDist(dir, aim) < Math.PI / 2.6) {
                results.push(e);
            }
        });
        return results; // Return all hittable objects
    }

    getFilteredPriority() {
        const filteredPriority = this.priority.map(list => list.filter(obj => obj.active && UTILS.getDist(obj, player, 0, 2) <= items.weapons[this.useHammer(obj) ? player.weapons[1] : player.weapons[0]].range + obj.scale));
        return filteredPriority;
    }

    calculateAim() {
        const filteredPriority = this.getFilteredPriority();

        // Loop through priority levels from [0] to [3]
        for (let level = 0; level < filteredPriority.length; level++) {
            const targets = filteredPriority[level];

            if (level == 3) {
                if (enemy.length && near.dist2 < 400) {
                    this.active = false;
                    return; // Exit early if the condition is met
                }
            }

            if (targets.length > 0) {
                this.processTargets(targets, level);
                return; // Exit after processing targets
            }
        }

        // If no targets were processed, deactivate
        this.active = false;
    }

    processTargets(targetObjs, level) {
        if (!targetObjs.length) {
            this.active = false;
            this.target = null;
            return; // No targets, no aim
        }

        const checkedAims = new Set(); // To avoid redundant aim checks

        //basically, for multiple objects, we check aim towards each one, and aim between each one. This is enough to find the best angle to hit as many as possible. But doesnt account for if you want to avoid any objects.
        // Handle multiple targets
        if (targetObjs.length > 1) {
            let aimAngles = [];
            // 1. Check pairwise aims (in-between targets)
            for (let i = 0; i < targetObjs.length; i++) {
                for (let j = i + 1; j < targetObjs.length; j++) {
                    const adjust = (angle) => angle < 0 ? angle + 2 * Math.PI : angle;
                    let aim1 = UTILS.getDirect(targetObjs[i], player, 0, 2);
                    let aim2 = UTILS.getDirect(targetObjs[j], player, 0, 2);
                    const aAdjusted = adjust(aim1);
                    const bAdjusted = adjust(aim2);
                    let avg = (aAdjusted + bAdjusted) / 2;
                    let diff = Math.abs(aAdjusted - bAdjusted);
                    if (diff > Math.PI) {
                        avg += Math.PI;
                    }
                    avg = avg % (2 * Math.PI);
                    if (avg > Math.PI) {
                        avg -= 2 * Math.PI;
                    }
                    let aimBetween = avg + 180 * (diff > 180);

                    // Avoid redundant checks
                    if (checkedAims.has(aimBetween)) continue;
                    checkedAims.add(aimBetween);

                    const objectsHit = this.objectsHit(aimBetween);

                    let reward = 0;

                    objectsHit.forEach((obj) => {
                        if (targetObjs.includes(obj)) reward += 100;
                        if (obj.isTeamObject(player)) {
                            if (near.inTrap && obj.sid == near.inTrap.sid) {
                                reward -= level != 3 ? 50 : -50;
                            } else if (obj.dmg || obj.trap) {
                                reward -= level != 3 ? 30 : -50;
                            } else {
                                reward -= level != 3 ? 10 : -50;
                            }
                        } else {
                            if (obj.dmg) {
                                reward += 70;
                            } else if (obj.trap) {
                                reward += 60;
                            } else {
                                reward += 50;
                            }
                        }
                    });
                    aimAngles.push({
                        aim: aimBetween,
                        reward: reward
                    });
                }
            }

            // 2. Check direct aims at each target
            for (let i = 0; i < targetObjs.length; i++) {
                const aimDirect = UTILS.getDirect(targetObjs[i], player, 0, 2);

                // Avoid redundant checks
                if (checkedAims.has(aimDirect)) continue;
                checkedAims.add(aimDirect);

                const objectsHit = this.objectsHit(aimDirect);
                let reward = 0;

                objectsHit.forEach((obj) => {
                    if (targetObjs.includes(obj)) reward += 100;
                    if (obj.isTeamObject(player)) {
                        if (near.inTrap && obj.sid == near.inTrap.sid) {
                            reward -= level != 3 ? 50 : -50;
                        } else if (obj.dmg || obj.trap) {
                            reward -= level != 3 ? 30 : -50;
                        } else {
                            reward -= level != 3 ? 10 : -50;
                        }
                    } else {
                        if (obj.dmg) {
                            reward += 70;
                        } else if (obj.trap) {
                            reward += 60;
                        } else {
                            reward += 50;
                        }
                    }
                });
                aimAngles.push({
                    aim: aimDirect,
                    reward: reward
                });
            }
            this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
            this.target = this.objectsHit(this.aim).sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];
            this.active = true;

            return;
        }

        let aimAngles = [];
        // Check for single target
        //basically check a few angles around the direct aim too to find some angles to avoid hitting ur own stuff
        const target = targetObjs[0];
        const aimDirect = UTILS.getDirect(targetObjs[0], player, 0, 2);
        let objectsHit = this.objectsHit(aimDirect)
        let reward = 0;

        objectsHit.forEach((obj) => {
            if (targetObjs.includes(obj)) reward += 100;
            if (obj.isTeamObject(player)) {
                if (near.inTrap && obj.sid == near.inTrap.sid) {
                    reward -= level != 3 ? 50 : -50;
                } else if (obj.dmg || obj.trap) {
                    reward -= level != 3 ? 30 : -50;
                } else {
                    reward -= level != 3 ? 10 : -50;
                }
            } else {
                reward += 60;
            }
        });
        aimAngles.push({
            aim: aimDirect,
            reward: reward
        });

        const saferAngles = [Math.PI / 2.6 / 3, Math.PI / 2.6 / 2, Math.PI / 2.6 - 0.1];
        for (let saferAngle of saferAngles) {
            const saferAims = [aimDirect - saferAngle, aimDirect + saferAngle];
            for (let saferAim of saferAims) {
                let objectsHit = this.objectsHit(saferAim)
                let reward = 0;

                objectsHit.forEach((obj) => {
                    if (targetObjs.includes(obj)) reward += 100;
                    if (obj.isTeamObject(player)) {
                        if (near.inTrap && obj.sid == near.inTrap.sid) {
                            reward -= level != 3 ? 50 : -50;
                        } else if (obj.dmg || obj.trap) {
                            reward -= level != 3 ? 30 : -50;
                        } else {
                            reward -= level != 3 ? 10 : -50;
                        }
                    } else {
                        reward += 60;
                    }
                });
                aimAngles.push({
                    aim: saferAim,
                    reward: reward
                });
            }
        }
        this.aim = aimAngles.sort((a, b) => b.reward - a.reward)[0].aim;
        this.target = this.objectsHit(this.aim).sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0];
        this.active = true;
        return;
    }

    useHammer(object) {
        if (configs.hammerBreakerOptimisation && player.weapons[1] == 10) {
            if (object) {
                if (object.health > 0 && object.health <= items.weapons[player.weapons[0]].dmg && objectManager.canHit(player, object, player.weapons[0]) && ![5, 8].includes(player.weapons[0])) return false;
            }
            return true;
        }
        return false;
    }
}

//was planning to make some kind of new autoplacer but unfortunately not finished too. This is implemented in preplacer tho for some angle calculations. But not used in any combat related stuff other than that
//uses geometry and stuff to find some closest possible angles. No need to use prediction as placers use x2 and y2 in the game code. But for preplacer since its placing next tick need to use predicted coordinates. (something calculated by movementSimulator that I made will be better than x3 y3)
class AutoPlacer {
    constructor() {
        this.additionalObjs = [];
        this.ranges = {};
        this.rangesUpdated = {};
        this.preplaceRanges = {};
        this.debugRender = {};
    }
    closestPossibleAngles(obj, id) {
        /* the obj given must have the following:
        {
            x: number,
            y: number,
            getScale: function(sM = 1, ig) { return number; } //number is the radius of the item
        }
        */
        let itemId = player.items[id];
        if (itemId == undefined) return;
        let item = items.list[itemId];

        let x = player.x2;
        let y = player.y2;

        let objX = obj.x;
        let objY = obj.y;
        let objScale = obj.getScale(0.6, obj.isItem) + 0.01; //a bit more cuz hitboxes cannot intersect at all I believe and also some rounding stuff when game gives us coords.

        let dx = objX - x;
        let dy = objY - y;

        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > player.scale + objScale + 2 * item.scale + item.placeOffset) {//if object so far away that it wont affect anything, return angle to object
            return [UTILS.getDirection(objX, objY, x, y)];
        }

        const D = player.scale + item.scale + item.placeOffset;
        const E = objScale + item.scale;

        const a = (D * D - E * E + dist * dist) / (2 * dist);
        const h = Math.sqrt(Math.max(0, D * D - a * a));

        const px = x + (a / dist) * dx;
        const py = y + (a / dist) * dy;

        const cx1 = px + (h / dist) * dy;
        const cy1 = py - (h / dist) * dx;

        const cx2 = px - (h / dist) * dy;
        const cy2 = py + (h / dist) * dx;
        return [UTILS.getDirection(cx1, cy1, x, y), UTILS.getDirection(cx2, cy2, x, y)];
    }

    normalizeAngle(a) {
        const twoPi = Math.PI * 2;
        if (a < 0) a += twoPi;
        if (a > twoPi) a -= twoPi;
        return a;
    }
    normalizeArc(start, end) {
        const twoPi = Math.PI * 2;

        // normalize both
        let s = this.normalizeAngle(start);
        let e = this.normalizeAngle(end);

        // compute original clockwise span BEFORE normalization
        let origSpan = (end - start + twoPi) % twoPi;

        // compute new clockwise span AFTER normalization
        let newSpan = (e - s + twoPi) % twoPi;

        // if direction flipped, swap
        if (Math.abs(origSpan - newSpan) > 0.000001) {
            return [e, s];
        }

        return [s, e];
    }

    mergeBlocked(arcs) {
        const twoPi = Math.PI * 2;
        let intervals = [];
        for (let [s, e] of arcs) {
            s = this.normalizeAngle(s);
            e = this.normalizeAngle(e);
            let span = (e - s + twoPi) % twoPi;
            if (span < 0.000001) {
                intervals.push([s, s]);
            } else if (s < e) {
                intervals.push([s, e]);
            } else {
                intervals.push([s, twoPi], [0, e]);
            }
        }
        if (!intervals.length) {
            return [];
        }
        intervals.sort((a, b) => a[0] - b[0]);
        let merged = [intervals[0].slice()];
        for (let i = 1; i < intervals.length; i++) {
            let [s, e] = intervals[i];
            let last = merged[merged.length - 1];
            if (s <= last[1] + 0.000001) {
                last[1] = Math.max(last[1], e);
            } else {
                merged.push([s, e]);
            }
        }
        if (merged.length === 1 && merged[0][0] <= 0.000001 && merged[0][1] >= twoPi - 0.000001) {
            return [[0, twoPi]];
        }
        return merged;
    }
    invertArcs(merged) {
        const twoPi = Math.PI * 2;
        if (merged.length === 0) {
            return [[0, twoPi]];
        }
        let free = [];
        for (let i = 0; i < merged.length; i++) {
            let [s1, e1] = merged[i];
            let gapStart = e1;
            let gapEnd = i < merged.length - 1 ? merged[i + 1][0] : merged[0][0] + twoPi;
            if (gapEnd - gapStart > 0.000001) {
                free.push([this.normalizeAngle(gapStart), this.normalizeAngle(gapEnd)]);
            }
        }
        return free;
    }

    angleRanges(id, additionalObjs = []) {
        const itemId = player.items[id];
        if (itemId == null) return;
        const item = items.list[itemId];
        let rawBlocked = [];
        for (let i = 0; i < nearObjs.length + additionalObjs.length; i++) {
            let obj = i < nearObjs.length ? nearObjs[i] : additionalObjs[i - nearObjs.length];
            if (UTILS.getDist(obj, player, 0, 2) > 200) continue;
            let angles = this.closestPossibleAngles(obj, id);
            if (angles.length != 2) {
                continue;
            }
            let a1 = angles[0];
            let a2 = angles[1];
            const offset = player.scale + item.scale + (item.placeOffset || 0);
            const buildAngle = UTILS.getDirect(obj, player, 0, 2);
            const v1 = objectManager.checkItemLocation(player.x2 + offset * Math.cos(a1), player.y2 + offset * Math.sin(a1), item.scale, 0.6, id, false);
            const v2 = objectManager.checkItemLocation(player.x2 + offset * Math.cos(a2), player.y2 + offset * Math.sin(a2), item.scale, 0.6, id, false)
            if (v1 && v2) {
                rawBlocked.push([a1, a2]);
            } else if (v1 || v2) {
                const valid = v1 ? a1 : a2;
                const invalid = v1 ? a2 : a1;
                const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
                if (cw) {
                    rawBlocked.push([valid, invalid]);
                } else {
                    rawBlocked.push([invalid, valid]);
                }
            } else {
                rawBlocked.push([a1, a2]);
            }
        }
        this.ranges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
        this.rangesUpdated[id] = true;
    }

    calcPreplace(preplaceObject, id) {
        const itemId = player.items[id];
        if (itemId == null) return;
        const item = items.list[itemId];

        let rawBlocked = [];
        for (let obj of nearObjs) {
            if (UTILS.getDist(obj, player, 0, 3) > 200) continue;
            if (obj.sid == preplaceObject.sid) continue;
            let angles = this.closestPossibleAngles(obj, id);
            if (angles.length != 2) {
                continue;
            }
            let a1 = angles[0];
            let a2 = angles[1];
            const offset = player.scale + item.scale + (item.placeOffset || 0);
            const buildAngle = UTILS.getDirect(obj, player, 0, 2);
            const v1 = objectManager.preplaceCheck(player.x3 + offset * Math.cos(a1), player.y3 + offset * Math.sin(a1), item.scale, 0.6, id, false, preplaceObject);
            const v2 = objectManager.preplaceCheck(player.x3 + offset * Math.cos(a2), player.y3 + offset * Math.sin(a2), item.scale, 0.6, id, false, preplaceObject);
            if (v1 && v2) {
                rawBlocked.push([a1, a2]);
            } else if (v1 || v2) {
                const valid = v1 ? a1 : a2;
                const invalid = v1 ? a2 : a1;
                const cw = (buildAngle - valid + Math.PI * 2) % (Math.PI * 2) < (invalid - valid + Math.PI * 2) % (Math.PI * 2);
                if (cw) {
                    rawBlocked.push([valid, invalid]);
                } else {
                    rawBlocked.push([invalid, valid]);
                }
            } else {
                rawBlocked.push([a1, a2]);
            }
        }
        this.preplaceRanges[id] = this.invertArcs(this.mergeBlocked(rawBlocked));
    }

    angleInArc(angle, start, end) {
        // normalized angles assumed
        if (start < end) {
            return angle >= start && angle <= end;
        } else {
            // wrap-around arc
            return angle >= start || angle <= end;
        }
    }

    closeToAngle(angle, ranges) {
        angle = this.normalizeAngle(angle);
        let bestAngle = null;
        let bestDist = Infinity;

        for (let [start, end] of ranges) {
            if (this.angleInArc(angle, start, end)) {
                return angle;
            } else {
                for (let ang of [start, end]) {
                    let dist = UTILS.getAngleDist(ang, angle);
                    if (dist < bestDist) {
                        bestDist = dist;
                        bestAngle = ang;
                    }
                }
            }
        }

        if (bestAngle !== null) {
            return bestAngle;
        }
    }

    intersectRanges(range1, range2) {
        const TWO_PI = Math.PI * 2;
        let result = [];

        // Helper: split a possibly-wrapping arc into non-wrapping parts
        const split = ([s, e]) => {
            if (s <= e) {
                return [[s, e]];
            } else {
                return [
                    [s, TWO_PI],
                    [0, e]
                ];
            }
        };

        for (let r1 of range1) {
            let parts1 = split(r1);

            for (let r2 of range2) {
                let parts2 = split(r2);

                for (let [a1, b1] of parts1) {
                    for (let [a2, b2] of parts2) {
                        let start = Math.max(a1, a2);
                        let end = Math.min(b1, b2);

                        if (start < end) {
                            result.push([start, end]);
                        }
                    }
                }
            }
        }

        return result;
    }
}

let PF = {
    active: false,
    gridSize: 100,
    scale: 1440,
    paths: [],
    attempts: 0,
    finded: false,
};

class CreatePath {
    constructor() {
        this.grid = [];
        this.foundPath = false;
    };
    init(delPos, reFind, type) {
        let goalPos = { x: 0, y: 0 };
        let dists = [];
        let centX = Math.round(player.x3) - (PF.scale / 2);
        let centY = Math.round(player.y3) - (PF.scale / 2);
        let griScale = PF.scale / PF.gridSize;

        let overScale = [griScale - 10, griScale + 10];
        let overPos = [player.scale, config.mapScale - player.scale];

        let reEScale = reFind ? overScale[0] : griScale;

        this.grid = [];
        for (let i = 0; i < PF.gridSize; i++) {
            this.grid[i] = [];
            for (let i2 = 0; i2 < PF.gridSize; i2++) {
                let pos = {
                    x: centX + griScale * i2,
                    y: centY + griScale * i
                };
                if (UTILS.getDist(pos, player, 0, 2) <= player.scale) {
                    this.grid[i][i2] = 0;
                    continue;
                }

                if (type == "auto push") {
                    let tdist = UTILS.getDist(pos, {
                        x: near.x2 - delPos.x,
                        y: near.y2 - delPos.y
                    }, 0, 0);
                    if (tdist <= overScale[1]) {
                        dists.push({ x: i2, y: i, dist: tdist });
                        this.grid[i][i2] = 0;
                        continue;
                    }

                    let dist = UTILS.getDist(pos, near, 0, 2);
                    if (dist <= near.scale + player.scale) {
                        this.grid[i][i2] = 1;
                        continue;
                    }

                    let some = nearObjs.some(obj => {
                        if (!obj.isTeamObject(player) && (obj.dmg || obj.trap)) { //if its a trap or spike in enemy team, avoid them
                            return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                        } else {
                            if (!obj.ignoreCollision || obj.name == "teleporter") { //if they not trap or spike in enemy team and u can collide with them, or if they are teleporter, avoid them
                                return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                            }
                        }
                        return false
                    });
                    if (some) {
                        this.grid[i][i2] = 1;
                    } else {
                        this.grid[i][i2] = 0;
                    }

                } else if (type == "follow") {
                    let tdist = UTILS.getDist(pos, {
                        x: near.x2 - delPos.x,
                        y: near.y2 - delPos.y
                    }, 0, 0);
                    if (tdist <= overScale[1]) {
                        dists.push({ x: i2, y: i, dist: tdist });
                        this.grid[i][i2] = 0;
                        continue;
                    }

                    let some = nearObjs.some(obj => {
                        if (!obj.isTeamObject(player) && (obj.dmg || obj.trap)) { //if its a trap or spike in enemy team, avoid them
                            return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                        } else {
                            if (!obj.ignoreCollision || obj.name == "teleporter") { //if they not trap or spike in enemy team and u can collide with them, or if they are teleporter, avoid them
                                return UTILS.getDist(pos, obj, 0, 0) <= obj.getScale(0.6, obj.isItem) + player.scale;
                            }
                            return false
                        }
                    });
                    if (some) {
                        this.grid[i][i2] = 1;
                    } else {
                        this.grid[i][i2] = 0;
                    }
                }

                if (pos.x < overPos[0] || pos.x > overPos[1] || pos.y < overPos[0] || pos.y > overPos[1]) {
                    this.grid[i][i2] = 1;
                }
            }
        }

        this.foundPath = false;

        if (dists.length) {
            dists.sort((a, b) => a.dist - b.dist);
            goalPos = { x: dists[0].x, y: dists[0].y };
        }

        // Check if start or goal is occupied
        const start = {
            x: Math.round(PF.gridSize / 2),
            y: Math.round(PF.gridSize / 2)
        };
        if (this.grid[start.y][start.x] === 1) {
            return { start: null, goal: null }; // Keep this for valid start checks
        }
        // Check if goal is occupied
        if (this.grid[goalPos.y]?.[goalPos.x] === 1) {
            // Check neighbors of the goal
            const neighbors = this.getPaths(goalPos).filter(pos =>
                pos.x >= 0 && pos.y >= 0 && pos.x < PF.gridSize && pos.y < PF.gridSize
            );

            // Find a free neighbor
            const freeNeighbor = neighbors.find(pos => this.grid[pos.y]?.[pos.x] === 0);

            if (freeNeighbor) {
                goalPos = freeNeighbor; // Update goal to the nearest free cell
            } else {
                return { start: null, goal: null }; // No valid goal or neighbors
            }
        }

        return { start: start, goal: goalPos };
    }
    getPaths(pos) {
        return [{
            x: pos.x + 1,
            y: pos.y
        }, {
            x: pos.x + 1,
            y: pos.y + 1
        }, {
            x: pos.x,
            y: pos.y + 1
        }, {
            x: pos.x - 1,
            y: pos.y + 1
        }, {
            x: pos.x - 1,
            y: pos.y
        }, {
            x: pos.x - 1,
            y: pos.y - 1
        }, {
            x: pos.x,
            y: pos.y - 1
        }, {
            x: pos.x + 1,
            y: pos.y - 1
        }];
    }
    getScore(pos1, pos2) {
        // hahhaha why
        // return sqrt((pos1.x - pos2.x) ** 2 + (pos1.y - pos2.y) ** 2);

        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y);
    }
    calc(delPos, reFind, type) {
        let data = this.init(delPos, reFind, type);
        if (!data.start || !data.goal) {
            return { paths: [], attempts: 0 }; // Return empty if start or goal is invalid
        }

        let start = data.goal;
        let goal = data.start;

        let search = {
            x: start.x,
            y: start.y
        };

        let paths = [{
            x: search.x,
            y: search.y,
            score: this.getScore(search, goal),
            seek: 0,
            hop: 0,
            start: true
        }];

        let searchPaths = this.getPaths(search);

        if (this.grid[start.y][start.x] == 1 || this.grid[goal.y][goal.x] == 1) {
            return { paths: [], attempts: 0 };
        }

        for (let i = 0; i < searchPaths.length; i++) {
            let searchPath = searchPaths[i];

            if (searchPath.x < 0 || searchPath.y < 0 || searchPath.x > PF.gridSize - 1 || searchPath.y > PF.gridSize - 1) {
                continue;
            }

            if (this.grid[searchPath.y][searchPath.x] == 1) continue;

            paths.push({
                x: searchPath.x,
                y: searchPath.y,
                score: this.getScore(searchPath, goal),
                seek: 0,
                hop: 1
            });
        }

        let foundPaths = [];
        let i = 0;
        let startTime = Date.now();
        while (Date.now() - startTime <= 5) {
            if (this.foundPath || search.x == goal.x && search.y == goal.y) {
                if (!this.foundPath) {
                    this.foundPath = true;
                    foundPaths.push({
                        x: player.x2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.x,
                        y: player.y2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.y
                    });
                }

                let found = paths.filter(a => (a.seek == 1 || a.start) && Math.abs(a.x - search.x) <= 1 && Math.abs(a.y - search.y) <= 1).toSorted((a, b) => {
                    return a.hop - b.hop;
                });

                if (found.length > 0) {
                    let nearPath = found[0];

                    search = {
                        x: nearPath.x,
                        y: nearPath.y
                    };
                    nearPath.seek = 2;

                    foundPaths.push({
                        x: player.x2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.x,
                        y: player.y2 - (PF.scale / 2) + (PF.scale / PF.gridSize) * search.y
                    });

                    if (nearPath.start) break;

                } else {
                    break;
                }
            } else {
                let found = paths.filter(a => a.seek == 0).toSorted((a, b) => {
                    return a.score - b.score;
                });

                if (found.length > 0) {
                    let nearPath = found[0];

                    search = {
                        x: nearPath.x,
                        y: nearPath.y
                    };
                    nearPath.seek = 1;

                    searchPaths = this.getPaths(search);

                    let hop = nearPath.hop + 1;
                    for (let i = 0; i < searchPaths.length; i++) {
                        let searchPath = searchPaths[i];

                        if (searchPath.x < 0 || searchPath.y < 0 || searchPath.x > PF.gridSize - 1 || searchPath.y > PF.gridSize - 1) {
                            continue;
                        }

                        if (this.grid[searchPath.y][searchPath.x] == 1) continue;

                        if (paths.some(a => a.x == searchPath.x && a.y == searchPath.y)) continue;

                        paths.push({
                            x: searchPath.x,
                            y: searchPath.y,
                            score: this.getScore(searchPath, goal),
                            seek: 0,
                            hop: hop
                        });
                    }

                } else {
                    break;
                }
            }
            i++;
        }

        return {
            paths: foundPaths,
            attempts: i
        };
    };
};

function isPositionSafe(x, y, options = {}) {
    const {
        checkAllSpikes = false,        // false = only check own/ally spikes, true = check all spikes
        ownSpikeDistance = 83,         // Safe distance from own/ally spikes
        enemySpikeDistance = 103,      // Safe distance from enemy spikes
        checkEnemy = true,             // Whether to check enemy distance
        enemyDistance = 75,            // Safe distance from nearest enemy
    } = options;

    if (x < player.scale || x > config.mapScale - player.scale || y < player.scale || y > config.mapScale - player.scale) return false;

    for (let obj of nearObjs) {
        if (obj.trap || obj.dmg) continue;

        let requiredDistance = obj.scale + 35;
        let distance = UTILS.getDistance(x, y, obj.x, obj.y);

        if (distance < requiredDistance) {
            return false;
        }
    }

    // Get spikes based on filter mode (more strict check for spikes)
    let allSpikes = checkAllSpikes ? nearObjs.filter(object => object.dmg) : nearObjs.filter(object => object.dmg && object.isTeamObject(player));

    // Check distance from spikes with specific distances
    for (let spike of allSpikes) {
        let isMySpike = spike.isTeamObject(player);
        let safeDistance = isMySpike ? ownSpikeDistance : enemySpikeDistance;
        let distance = UTILS.getDistance(x, y, spike.x, spike.y);

        if (distance < safeDistance) {
            return false;
        }
    }

    // Check distance from nearest enemy
    if (checkEnemy) {
        let distance = UTILS.getDistance(x, y, near.x3, near.y3);
        if (distance < enemyDistance) {
            return false;
        }
    }

    return true;
}

function findSafePath(startX, startY, endX, endY, options = {}) {
    const {
        gridSpacing = 35,
        maxRange = 800,
        maxNodes = 300,
        safetyOptions = {}  // Options to pass to isPositionSafe
    } = options;

    // Helper to get grid key
    const getKey = (x, y) => `${Math.round(x / gridSpacing) * gridSpacing},${Math.round(y / gridSpacing) * gridSpacing}`;

    // Helper to get neighbors
    const getNeighbors = (x, y) => {
        let neighbors = [];
        for (let dx = -gridSpacing; dx <= gridSpacing; dx += gridSpacing) {
            for (let dy = -gridSpacing; dy <= gridSpacing; dy += gridSpacing) {
                if (dx === 0 && dy === 0) continue;
                let nx = x + dx;
                let ny = y + dy;
                if (UTILS.getDistance(startX, startY, nx, ny) <= maxRange) {
                    neighbors.push({ x: nx, y: ny });
                }
            }
        }
        return neighbors;
    };

    // A* algorithm
    let openSet = [{ x: startX, y: startY, g: 0, h: UTILS.getDistance(startX, startY, endX, endY), f: 0, parent: null }];
    let closedSet = new Set();
    let allNodes = new Map();

    allNodes.set(getKey(startX, startY), openSet[0]);

    while (openSet.length > 0) {
        // Get node with lowest f score
        openSet.sort((a, b) => a.f - b.f);
        let current = openSet.shift();
        let currentKey = getKey(current.x, current.y);

        // Check if we reached the goal
        if (UTILS.getDistance(current.x, current.y, endX, endY) < gridSpacing * 2) {
            // Reconstruct path
            let path = [];
            let node = current;
            while (node) {
                path.unshift({ x: node.x, y: node.y });
                node = node.parent;
            }
            return path;
        }

        closedSet.add(currentKey);

        // Check neighbors
        let neighbors = getNeighbors(current.x, current.y);
        for (let neighbor of neighbors) {
            let neighborKey = getKey(neighbor.x, neighbor.y);

            if (closedSet.has(neighborKey)) continue;

            // Skip unsafe positions using provided safety options
            if (!isPositionSafe(neighbor.x, neighbor.y, safetyOptions)) continue;

            let g = current.g + UTILS.getDistance(current.x, current.y, neighbor.x, neighbor.y);
            let h = UTILS.getDistance(neighbor.x, neighbor.y, endX, endY);
            let f = g + h;

            let existingNode = allNodes.get(neighborKey);
            if (!existingNode || g < existingNode.g) {
                let newNode = { x: neighbor.x, y: neighbor.y, g, h, f, parent: current };
                allNodes.set(neighborKey, newNode);

                if (!existingNode) {
                    openSet.push(newNode);
                }
            }
        }

        // Prevent infinite loop
        if (closedSet.size > maxNodes) break;
    }

    return null; // No path found
}
/*
        const makeWorker = (fn) => {
            let blobURL = URL.createObjectURL(
                new Blob(["(", fn.toString(), ")()"], {
                    type: "application/javascript",
                })
            );
            let worker = new Worker(blobURL);
            URL.revokeObjectURL(blobURL);
            return worker;
        };

        let worker = makeWorker(function () {
            function getDist(node1, node2) {
                return Math.hypot(node2.x - node1.x, node2.y - node1.y);
            }
            function isOccupied(x, y, builds, near = null) {
                for (const build of builds) {
                    const dist = Math.hypot(build.x - x, build.y - y);
                    const minDist = build.scale + 20;
                    if (dist < minDist) return true;
                }
                if (near) {
                    const dist = Math.hypot(near.x - x, near.y - y);
                    const minDist = 35 * 2;
                    if (dist < minDist) return true;
                }
                return false;
            }
            function astar(start, goal, builds, near, avoidNear = true) {
                const directions = [
                    [0, 1], [1, 1], [1, 0], [1, -1],
                    [0, -1], [-1, -1], [-1, 0], [-1, 1]
                ];

                const openSet = [{ x: start.x, y: start.y, cost: 0, priority: getDist(start, goal), parent: null }];
                const visited = new Set();
                let attempts = 0;
                const maxAttempts = 300;

                while (attempts < maxAttempts) {
                    attempts++;
                    openSet.sort((a, b) => a.priority - b.priority);
                    const current = openSet.shift();

                    const key = `${current.x},${current.y}`;
                    if (visited.has(key)) continue;
                    visited.add(key);

                    if (getDist(current, goal) <= 42) {
                        const path = [];
                        let node = current;
                        while (node) {
                            path.push({ x: node.x, y: node.y });
                            node = node.parent;
                        }
                        return { success: true, path: path.reverse() };
                    }

                    for (const [dx, dy] of directions) {
                        const neighborX = current.x + dx * 35;
                        const neighborY = current.y + dy * 35;
                        if (
                            neighborX < 35 || neighborX > 14400 - 35 ||
                            neighborY < 35 || neighborY > 14400 - 35
                        ) continue;
                        if (isOccupied(neighborX, neighborY, builds, avoidNear ? near : null)) continue;

                        openSet.push({
                            x: neighborX,
                            y: neighborY,
                            cost: current.cost + getDist(current, { x: neighborX, y: neighborY }),
                            priority: current.cost + getDist(current, { x: neighborX, y: neighborY }) + getDist({ x: neighborX, y: neighborY }, goal),
                            parent: current
                        });
                    }
                }
                // Attempt to find the nearest node to the goal if the goal is occupied
                let nearestNode = null;
                let minDist = Infinity;
                visited.forEach((key) => {
                    const [x, y] = key.split(",").map(Number);
                    const dist = getDist({ x, y }, goal);
                    if (dist < minDist) {
                        nearestNode = { x, y, parent: null };
                        minDist = dist;
                    }
                });

                if (nearestNode) {
                    const path = [];
                    let node = nearestNode;
                    while (node) {
                        path.push({ x: node.x, y: node.y });
                        node = node.parent;
                    }
                    return { success: true, path: path.reverse() };
                }
                return { success: false };
            }

            self.onmessage = (ev) => {
                const args = ev.data;
                const [currentNode, targetNode, builds, near, avoidNear] = args;

                let result = astar(currentNode, targetNode, builds, near, avoidNear);

                self.postMessage(result);
            };
        });
        //AUTOPUSH:
        //pathinf

        worker.onmessage = (ev) => {
            if (ev.data.success) {
                const path = ev.data.path;
                if (path.length > 1) {
                    const nextNode = path[1];
                    const currentNode = path[0];
                    const resolveData = {
                        x: nextNode.x - currentNode.x,
                        y: nextNode.y - currentNode.y
                    };
                    PF.active = true;
                    PF.paths = path;
                    if (configs.autoPush) {
                        my.autoPush = true;
                        packet("9", Math.atan2(resolveData.y, resolveData.x), 1);
                    }
                }
            } else {
                PF.active = false;
                PF.paths = [];
                if (UTILS.getDist(player, my.pushData, 2, 2) > 69) {
                    if (my.autoPush) {
                        my.autoPush = false;
                    }
                }
            }
        };*/

let agentTarget = {};

class Instakill {
    constructor() {
        this.wait = false;
        this.can = false;
        this.isTrue = false;
        this.nobull = false;
        this.ticking = false;
        this.canSpikeTick = false;
        this.canMusketSync = false;
        this.startTick = false;
        this.readyTick = false;
        this.canCounter = false;
        this.revTick = false;
        this.syncHit = false;
        this.changeType = function (type) {
            this.wait = false;
            this.isTrue = true;
            my.autoAim = true;
            if (type == "rev") {
                selectWeapon(player.weapons[1]);
                storeEquip(53, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    if (near.dist2 <= 120 && configs.doSpikeOnReverse) place(2, near.aim2);
                    storeEquip(7, 0);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "nobull") {
                selectWeapon(player.weapons[0]);
                storeEquip(6, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    storeEquip((player.reloads[53] == 0 && near.skinIndex != 22) ? 53 : 6, 0);
                    selectWeapon(player.weapons[1]);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
            } else if (type == "normal") {
                selectWeapon(player.weapons[0]);
                storeEquip(7, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    storeEquip((player.reloads[53] == 0 && near.skinIndex != 22) ? 53 : 6, 0);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);
                /*
                selectWeapon(player.weapons[0]);
                storeEquip(7, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    storeEquip((player.reloads[53] == 0 && near.skinIndex != 22) ? 53 : 6, 0);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                }, 1);*/
            } else {
                workerSetTimeout(() => {
                    this.isTrue = false;
                    my.autoAim = false;
                }, 50);
            }
        };
        this.spikeTickType = function (type) {
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0])
            if (type == "rev" && player.reloads[53] == 0) {
                storeEquip(53, 0);
                game.tickBase(() => {
                    storeEquip(7, 0);
                    if (!my.autoGathering) sendAutoGather();
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1)
                }, 1)
            } else {
                storeEquip(7, 0);
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    if (player.reloads[53] == 0 && configs.turretCombat) {
                        storeEquip(53, 0);
                        game.tickBase(() => {
                            this.isTrue = false;
                            my.autoAim = false;
                        }, 1);
                    } else {
                        this.isTrue = false;
                        my.autoAim = false;
                    }
                }, 1);
            }
        };
        this.counterType = function () {
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[0]);
            storeEquip(7, 0);
            storeEquip(21, 1);
            if (!my.autoGathering) sendAutoGather();
            game.tickBase(() => {
                if (player.reloads[53] == 0 && configs.turretCombat) {
                    selectWeapon(player.weapons[0]);
                    storeEquip(53, 0);
                    storeEquip(21, 1);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                    }, 1);
                } else {
                    this.isTrue = false;
                    my.autoAim = false;
                }
            }, 1);
        };
        this.rangeType = function (type) {
            this.isTrue = true;
            my.aimTarget = true;
            if (type == "ageInsta") {
                my.ageInsta = false;
                if (player.items[5] == 18) {
                    traps.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
                }
                packet("9", undefined, 1);
                storeEquip(53, 0);
                game.tickBase(() => {
                    selectWeapon(player.weapons[1]);
                    storeEquip(53, 0);
                    if (!my.autoGathering) sendAutoGather();
                    game.tickBase(() => {
                        sendUpgrade(12);
                        selectWeapon(player.weapons[1]);
                        storeEquip(53, 0);
                        game.tickBase(() => {
                            sendUpgrade(15);
                            selectWeapon(player.weapons[1]);
                            storeEquip(53, 0);
                            game.tickBase(() => {
                                this.isTrue = false;
                                my.aimTarget = false;
                                this.ticking = false;
                            }, 3);
                        }, 1);
                    }, 1);
                }, 2);
            } else {
                selectWeapon(player.weapons[1]);
                if (player.reloads[53] == 0 && near.dist2 <= 700 && near.skinIndex != 22) {
                    storeEquip(53, 0);
                } else {
                    storeEquip(20, 0);
                }
                if (!my.autoGathering) sendAutoGather();
                game.tickBase(() => {
                    this.isTrue = false;
                    my.aimTarget = false;
                }, 1);
            }
        };
        this.musketSync = function () {
            if (player.weapons[1] != 15) return;
            this.isTrue = true;
            my.autoAim = true;
            if (player.items[5] == 18) traps.testCanPlace(5, 0, Math.PI * 2, Math.PI / 3, near.aim2, true);
            storeEquip(53, 0) //equip earlier cuz turret is slower but I dont think this will sync
            selectWeapon(player.weapons[1])
            if (!my.autoGathering) sendAutoGather();
            game.tickBase(() => {
                this.isTrue = false;
                my.autoAim = false;
            }, 1);
        };
        this.oneTickType = function () {
            this.isTrue = true;
            this.ticking = true;
            my.aimTarget = true;
            packet("9", near.aim2, 1);
            game.tickBase(() => {
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                }
                selectWeapon(player.weapons[[9, 10, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                storeEquip(53, 0);
                if ([9, 12, 13, 15].includes(player.weapons[1])) {
                    if (!my.autoGathering) sendAutoGather();
                }
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    storeEquip(7, 0);
                    if (!my.autoGathering) sendAutoGather();
                    packet("9", near.aim2, 1);
                    game.tickBase(() => {
                        this.isTrue = false;
                        this.ticking = false;
                        my.aimTarget = false;
                        this.goTickThem = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            }, 1);
        };
        this.threeOneTickType = function () {
            this.isTrue = true;
            my.autoAim = true;
            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
            storeEquip(11, 1);
            packet("9", targetPlayer.aim2, 1);
            game.tickBase(() => {
                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                storeEquip(53, 0);
                storeEquip(11, 1);
                packet("9", targetPlayer.aim2, 1);
                game.tickBase(() => {
                    selectWeapon(player.weapons[0]);
                    storeEquip(7, 0);
                    storeEquip(19, 1);
                    if (!my.autoGathering) sendAutoGather();
                    packet("9", targetPlayer.aim2, 1);
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.autoAim = false;
                        packet("9", undefined, 1);
                    }, 1);
                }, 1);
            }, 1);
        };
        this.newTickType = function () {
            this.isTrue = true;
            this.ticking = true;
            my.autoAim = true;
            packet("9", near.aim2, 1);
            storeEquip(53, 0);
            game.tickBase(() => {
                my.revAim = false;
                selectWeapon(player.weapons[0]);
                storeEquip(7, 0);
                if (!my.autoGathering) sendAutoGather();
                packet("9", near.aim2, 1);
                game.tickBase(() => {
                    this.isTrue = false;
                    this.ticking = false;
                    my.autoAim = false;
                    this.goTickThem = false;
                    packet("9", undefined, 1);
                }, 1);
            }, 1);
        };
        this.boostTickType = function () {
            this.isTrue = true;
            my.aimTarget = true;
            packet("9", targetPlayer.aim2, 1);
            game.tickBase(() => {
                if (player.weapons[1] == 15) {
                    my.revAim = true;
                }
                selectWeapon(player.weapons[[9, 12, 13, 15].includes(player.weapons[1]) ? 1 : 0]);
                storeEquip(53, 0);
                if ([9, 12, 13, 15].includes(player.weapons[1])) {
                    if (!my.autoGathering) sendAutoGather();
                }
                place(4, targetPlayer.aim2);
                game.tickBase(() => {
                    my.revAim = false;
                    selectWeapon(player.weapons[0]);
                    storeEquip(7, 0);
                    if (!my.autoGathering) sendAutoGather();
                    game.tickBase(() => {
                        this.isTrue = false;
                        my.aimTarget = false;
                        packet("9", undefined, 1);
                        this.goTickThem = false;
                    }, 1);
                }, 1);
            }, 1);
        };
        this.gotoGoal = function (goto, OT) {
            let slowDists = (weeeee) => weeeee * player.scale;
            let goal = {
                a: goto - OT,
                b: goto + OT,
                c: goto - slowDists(1),
                d: goto + slowDists(1),
                e: goto - slowDists(2),
                f: goto + slowDists(2),
                g: goto - slowDists(4),
                h: goto + slowDists(4)
            };
            let bQ = function (wwww, awwww) {
                if (player.inWater && awwww == 0) {
                    storeEquip(31, 0);
                } else {
                    storeEquip(wwww, awwww);
                }
            }
            if (enemy.length) {
                let dst = targetPlayer?.dist2 || near.dist2;
                this.ticking = true;
                if (dst >= goal.a && dst <= goal.b) {
                    bQ(0, 0)
                    if (player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0] || player.buildIndex > -1) {
                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                    }
                    return {
                        dir: undefined,
                        action: 1
                    };
                } else {
                    if (dst < goal.a) {
                        if (dst >= goal.g) {
                            if (dst >= goal.e) {
                                if (dst >= goal.c) {
                                    bQ(40, 0);
                                    bQ(0, 1);
                                    if (configs.slowOT) {
                                        player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                    } else {
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(22, 0);
                                    bQ(0, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                bQ(6, 0);
                                bQ(0, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                        } else {
                            biomeGear(1);
                            bQ(11, 1);
                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                            }
                        }
                        return {
                            dir: targetPlayer.aim2 + Math.PI,
                            action: 0
                        };
                    } else if (dst > goal.b) {
                        if (dst <= goal.h) {
                            if (dst <= goal.f) {
                                if (dst <= goal.d) {
                                    bQ(40, 0);
                                    bQ(0, 1);
                                    if (configs.slowOT) {
                                        player.buildIndex != player.items[1] && selectToBuild(player.items[1]);
                                    } else {
                                        if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                            selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                        }
                                    }
                                } else {
                                    bQ(22, 0);
                                    bQ(0, 1);
                                    if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                        selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                    }
                                }
                            } else {
                                bQ(6, 0);
                                bQ(0, 1);
                                if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                    selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                                }
                            }
                        } else {
                            biomeGear(1);
                            bQ(11, 1);
                            if ((player.weaponIndex != player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]) || player.buildIndex > -1) {
                                selectWeapon(player.weapons[[10, 14].includes(player.weapons[1]) ? 1 : 0]);
                            }
                        }
                        return {
                            dir: targetPlayer.aim2,
                            action: 0
                        };
                    }
                    return {
                        dir: undefined,
                        action: 0
                    };
                }
            } else {
                this.ticking = false
                return {
                    dir: undefined,
                    action: 0
                };
            }
        }
        /** wait 1 tick for better quality */
        this.bowMovement = function () {
            let moveMent = this.gotoGoal(682, 4);
            if (moveMent.action) {
                if (player.reloads[53] == 0 && !this.isTrue) {
                    this.rangeType("ageInsta");
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        }
        this.tickMovement = function () {
            this.ticking = true;
            let moveMent = this.gotoGoal(([10, 14].includes(player.weapons[1]) && player.y2 > config.snowBiomeTop) ? 243 : player.weapons[1] == 15 ? 270 : player.y2 <= config.snowBiomeTop ? [10, 14].includes(player.weapons[1]) ? 233 : 231 : 240, 3);
            if (moveMent.action) {
                if (near.skinIndex != 22 && player.reloads[53] == 0 && !this.isTrue) {
                    this.oneTickType()
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        }
        this.goTickThem = false;
        this.boostTickMovement = function () {
            this.ticking = true;
            let dist = player.weapons[1] == 9 ? 365 : player.weapons[1] == 12 ? 380 : player.weapons[1] == 13 ? 390 : player.weapons[1] == 15 ? 365 : 370;
            let actionDist = player.weapons[1] == 9 ? 2 : player.weapons[1] == 12 ? 1.5 : player.weapons[1] == 13 ? 1.5 : player.weapons[1] == 15 ? 2 : 3;
            let moveMent = this.gotoGoal(dist, actionDist);
            if (moveMent.action) {
                if (player.reloads[53] == 0 && !this.isTrue && player.weapons[1] != 9 || [6].includes((game.tick - my.bullTick) % 9)) {
                    this.boostTickType();
                } else {
                    packet("9", moveMent.dir, 1);
                }
            } else {
                packet("9", moveMent.dir, 1);
            }
        }
        /** wait 1 tick for better quality */
        this.perfCheck = function (pl, nr) {
            if (nr.weaponIndex == 11 && UTILS.getAngleDist(nr.aim2 + Math.PI, nr.d2) <= config.shieldAngle) return false;
            if (![9, 12, 13, 15].includes(player.weapons[1])) return true;
            let pjs = {
                x: nr.x2 + (70 * Math.cos(nr.aim2 + Math.PI)),
                y: nr.y2 + (70 * Math.sin(nr.aim2 + Math.PI))
            };
            if (UTILS.lineInRect(pl.x2 - pl.scale, pl.y2 - pl.scale, pl.x2 + pl.scale, pl.y2 + pl.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                return true;
            }
            let finds = ais.filter(tmp => tmp.visible).find((tmp) => {
                if (UTILS.lineInRect(tmp.x2 - tmp.scale, tmp.y2 - tmp.scale, tmp.x2 + tmp.scale, tmp.y2 + tmp.scale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
            });
            if (finds) return false;
            finds = gameObjects.filter(tmp => tmp.active).find((tmp) => {
                let tmpScale = tmp.getScale();
                if (!tmp.ignoreCollision && UTILS.lineInRect(tmp.x - tmpScale, tmp.y - tmpScale, tmp.x + tmpScale, tmp.y + tmpScale, pjs.x, pjs.y, pjs.x, pjs.y)) {
                    return true;
                }
            });
            if (finds) return false;
            return true;
        }
    }
};

class Autobuy {
    constructor(items) {
        this.items = items; // Array of items to buy [[id, type], ...]
    }

    buyNext() {
        for (const [id, type] of this.items) {
            // Find the item in the appropriate list
            const find = type === 0 ? findID(hats, id) : findID(accessories, id);

            // Check if the item exists and isn't already owned
            const isOwned = type === 0 ? player.skins[id] : player.tails[id];
            if (!find || isOwned) continue; // Skip if not found or already owned

            // Check if the player has enough points to buy the item
            if (player.points >= find.price) {
                //do this in updatPlayers
                game.tickBase(() => {
                    storeBuy(id, type); // Buy the item
                    if (id == 7 && type == 0) my.reSync = true;
                }, 1)
                return; // Stop after attempting to buy one item
            }
            return; // Stop if the item couldn't be bought (not enough points)
        }
    }
}

class Autoupgrade {
    constructor() {
        this.sb = function (upg) {
            upg(3);
            upg(17);
            upg(31);
            upg(23);
            upg(9);
            upg(38);
        };
        this.kh = function (upg) {
            upg(3);
            upg(17);
            upg(31);
            upg(23);
            upg(10);
            upg(38);
            upg(4);
            upg(25);
        };
        this.pb = function (upg) {
            upg(5);
            upg(17);
            upg(32);
            upg(23);
            upg(9);
            upg(38);
        };
        this.ph = function (upg) {
            upg(5);
            upg(17);
            upg(32);
            upg(23);
            upg(10);
            upg(38);
            upg(28);
            upg(25);
        };
        this.db = function (upg) {
            upg(7);
            upg(17);
            upg(31);
            upg(23);
            upg(9);
            upg(34);
        };
        /* old functions */
        this.km = function (upg) {
            upg(7);
            upg(17);
            upg(31);
            upg(23);
            upg(10);
            upg(38);
            upg(4);
            upg(15);
        };
    };
};

class Damages {
    constructor(items) {
        // 0.75 1 1.125 1.5
        this.calcDmg = function (dmg, val) {
            return dmg * val;
        };
        this.getAllDamage = function (dmg) {
            return [this.calcDmg(dmg, 0.75), dmg, this.calcDmg(dmg, 1.125), this.calcDmg(dmg, 1.5)];
        };
        this.weapons = [];
        for (let i = 0; i < items.weapons.length; i++) {
            let wp = items.weapons[i];
            let name = wp.name.split(" ").length <= 1 ? wp.name : (wp.name.split(" ")[0] + "_" + wp.name.split(" ")[1]);
            this.weapons.push(this.getAllDamage(i > 8 ? wp.Pdmg : wp.dmg));
            this[name] = this.weapons[i];
        }
    }
}

/** CLASS CODES */
// jumpscare code warn
let tmpList = [];

// LOADING:
let UTILS = new Utils();
let items = new Items();
let objectManager = new Objectmanager(GameObject, gameObjects, UTILS, config);
let store = new Store();
let hats = store.hats;
let accessories = store.accessories;
let projectileManager = new ProjectileManager(Projectile, projectiles, players, ais, objectManager, items, config, UTILS);
let aiManager = new AiManager(ais, AI, players, items, objectManager, config, UTILS);
let textManager = new Textmanager();

let traps = new Traps(UTILS, items);
let autoBreak = new AutoBreaker();
let autoPlace = new AutoPlacer();
let instaC = new Instakill();
let autoBuy = new Autobuy([[11, 1], [40, 0], [6, 0], [7, 0], [31, 0], [15, 0], [19, 1], [22, 0], [53, 0], [12, 0], [20, 0], [10, 0], [56, 0], [21, 1], [11, 0], [26, 0], [18, 1], [13, 1]])
let autoUpgrade = new Autoupgrade();
let createPath = new CreatePath();

let lastDeath;
let minimapData;
let mapMarker = {};
let mapPings = [];
let tmpPing;

let breakTrackers = [];

let grid = [];

let singCooldown = 0;
let lastSendTime = Date.now();

function sendChat(message, special) {
    if (special) {
        if (Date.now() - singCooldown > 0) {
            packet("6", message);
            lastSendTime = Date.now();
        }
    } else {
        workerSetTimeout(() => {
            packet("6", message);
            lastSendTime = Date.now();
            singCooldown = Date.now() + 2000;
        }, 569 - Date.now() + lastSendTime);
    }
}

function checkProjectileHolder(x, y, dir, range, speed, indx, layer, sid) {
    let weaponIndx = indx == 0 ? 9 : indx == 2 ? 12 : indx == 3 ? 13 : indx == 5 && 15;
    let projOffset = player.scale * 2;
    let projXY = {
        x: indx == 1 ? x : x - projOffset * Math.cos(dir),
        y: indx == 1 ? y : y - projOffset * Math.sin(dir),
    };
    let nearPlayer = players.filter((e) => e.visible && UTILS.getDist(projXY, e, 0, 2) <= e.scale).sort(function (a, b) {
        return UTILS.getDist(projXY, a, 0, 2) - UTILS.getDist(projXY, b, 0, 2);
    })[0];

    if (nearPlayer) {
        if (indx == 1) {
            nearPlayer.shooting[53] = 1;
        } else {
            nearPlayer.shootIndex = weaponIndx;
            nearPlayer.shooting[1] = 1;
        }
        antiProj(nearPlayer, dir, range, speed, indx, weaponIndx);
    } else {
        let nearTurret = nearObjs.filter((e) => UTILS.getDist(projXY, e, 0, 0) <= e.scale).sort((a, b) => {
            return UTILS.getDist(projXY, a, 0, 0) - UTILS.getDist(projXY, b, 0, 0);
        })[0];
    }
}
let musketCount = 0;
let projectile = {
    count: 0,
    dmg: 0
};
function antiProj(tmpObj, dir, range, speed, index, weaponIndex) {
    if (!tmpObj.isTeam(player) && !tmpObj.sid == near.sid) {
        tmpDir = UTILS.getDirect(player, tmpObj, 2, 2);
        if (UTILS.getAngleDist(tmpDir, dir) <= 0.3) {
            if (index == 1) {
                if (tmpObj.sid == near.sid) {
                    projectile.count++;
                    projectile.dmg += items.projectiles[index].dmg;
                }
            } else {
                tmpObj.bowThreat[weaponIndex]++;
                if (index == 5) musketCount++;
                projectile.dmg += items.projectiles[index].dmg;
                projectile.count++;
            }
            workerSetTimeout(() => {
                if (index != 1) tmpObj.bowThreat[weaponIndex]--;
                musketCount--;
                if (projectile.count > 0) {
                    projectile.count--
                    projectile.dmg -= items.projectiles[index].dmg;
                }
            }, range / speed);
            if (tmpObj.bowThreat[9] >= 1 || (tmpObj.bowThreat[12] >= 1)) {
                checkPlace(3, tmpObj.aim2);
                checkPlace(1, tmpObj.aim2);
                my.anti0Tick = 4;
                player.chat.message = `anti bow insta by ${tmpObj.sid} ${tmpObj.name}`;
                player.chat.count = 445;
                predictHeal(1);
            } else {
                if (musketCount >= 2 || projectile.count >= 4) {
                    if (player.weapons[1] == 11) {
                        selectWeapon(player.weapons[1])
                    }
                    checkPlace(3, tmpObj.aim2);
                    checkPlace(1, tmpObj.aim2);
                    my.anti0Tick = 4;
                    player.chat.message = `anti proj sync`;
                    player.chat.count = 445;
                    predictHeal(2);
                }
            }
        }
    }
}

// SHOW ITEM INFO:
function showItemInfo(item, isWeapon, isStoreItem) {
    if (player && item) {
        UTILS.removeAllChildren(itemInfoHolder);
        itemInfoHolder.classList.add("visible");
        UTILS.generateElement({
            id: "itemInfoName",
            text: UTILS.capitalizeFirst(item.name),
            parent: itemInfoHolder
        });
        UTILS.generateElement({
            id: "itemInfoDesc",
            text: item.desc,
            parent: itemInfoHolder
        });
        if (isStoreItem) {

        } else if (isWeapon) {
            UTILS.generateElement({
                class: "itemInfoReq",
                text: !item.type ? "primary" : "secondary",
                parent: itemInfoHolder
            });
        } else {
            for (let i = 0; i < item.req.length; i += 2) {
                UTILS.generateElement({
                    class: "itemInfoReq",
                    html: item.req[i] + "<span class='itemInfoReqVal'> x" + item.req[i + 1] + "</span>",
                    parent: itemInfoHolder
                });
            }
            if (item.group.limit) {
                UTILS.generateElement({
                    class: "itemInfoLmt",
                    text: (player.itemCounts[item.group.id] || 0) + "/" + (config.isSandbox ? 99 : item.group.limit),
                    parent: itemInfoHolder
                });
            }
        }
    } else {
        itemInfoHolder.classList.remove("visible");
    }
}


// RESIZE:
window.addEventListener("resize", UTILS.checkTrusted(resize));

function resize() {
    screenWidth = window.innerWidth;
    screenHeight = window.innerHeight;
    let scaleFillNative = Math.max(screenWidth / maxScreenWidth, screenHeight / maxScreenHeight) * pixelDensity;
    gameCanvas.width = screenWidth * pixelDensity;
    gameCanvas.height = screenHeight * pixelDensity;
    gameCanvas.style.width = screenWidth + "px";
    gameCanvas.style.height = screenHeight + "px";
    mainContext.setTransform(
        scaleFillNative, 0,
        0, scaleFillNative,
        (screenWidth * pixelDensity - (maxScreenWidth * scaleFillNative)) / 2,
        (screenHeight * pixelDensity - (maxScreenHeight * scaleFillNative)) / 2
    );
}
resize();
let touchCountrols = getEl("touch-controls-fullscreen");
// MOUSE INPUT:
touchCountrols.addEventListener("mousemove", gameInput, false);

function gameInput(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
}
let clicks = {
    left: false,
    middle: false,
    right: false,
};
touchCountrols.addEventListener("mousedown", mouseDown, false);

function mouseDown(e) {
    if (attackState != 1) {
        attackState = 1;
        if (e.button == 0) {
            /*if (keys[16]) {
                agentTarget = mousePos;
                testRender = agentTarget;
            }*/
            clicks.left = true;
        } else if (e.button == 1) {
            if (keys[16]) {
                let old = targetPlayer?.sid;
                targetPlayer = players.filter(tmp => tmp.visible && tmp.sid != player.sid).sort((a, b) => UTILS.getDist(mousePos, a, 0, 2) - UTILS.getDist(mousePos, b, 0, 2))[0];
                if (targetPlayer?.sid == old) {
                    targetPlayer = undefined;
                }
            } else {
                clicks.middle = true;
            }
        } else if (e.button == 2) {
            clicks.right = true;
        }
    }
}
touchCountrols.addEventListener("mouseup", UTILS.checkTrusted(mouseUp));

function mouseUp(e) {
    if (attackState != 0) {
        attackState = 0;
        if (e.button == 0) {
            clicks.left = false;
        } else if (e.button == 1) {
            clicks.middle = false;
        } else if (e.button == 2) {
            clicks.right = false;
        }
    }
}
touchCountrols.addEventListener("wheel", wheel, false);

function wheel(e) {
    if (e.deltaY < 0) {
        my.reSync = true;
    } else {
        my.reSync = false;
    }
}
// INPUT UTILS:
function getMoveDir() {
    let dx = 0;
    let dy = 0;
    for (let key in moveKeys) {
        let tmpDir = moveKeys[key];
        dx += !!keys[key] * tmpDir[0];
        dy += !!keys[key] * tmpDir[1];
    }
    return dx == 0 && dy == 0 ? undefined : Math.atan2(dy, dx);
}

function isNearPlayer() {
    return near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8;
}

let mousePos = {};

function getMouseWorldPos() {
    const rect = gameCanvas.getBoundingClientRect();

    // 1. Mouse → canvas pixels (DPI safe)
    const canvasX =
        (mouseX - rect.left) * (gameCanvas.width / rect.width);
    const canvasY =
        (mouseY - rect.top) * (gameCanvas.height / rect.height);

    // 2. Same transform values used in resize()
    const scaleFillNative =
        Math.max(
            screenWidth / maxScreenWidth,
            screenHeight / maxScreenHeight
        ) * pixelDensity;

    const tx = (screenWidth * pixelDensity - maxScreenWidth * scaleFillNative) / 2;
    const ty = (screenHeight * pixelDensity - maxScreenHeight * scaleFillNative) / 2;

    // 3. Invert transform
    const localX = (canvasX - tx) / scaleFillNative;
    const localY = (canvasY - ty) / scaleFillNative;

    // 4. Camera-centered → world
    mousePos = {
        x: camX + localX - maxScreenWidth / 2,
        y: camY + localY - maxScreenHeight / 2
    };
}

function getSafeDir() {// THANK U BRT
    if (!player) return 0;
    if (!player.lockDir) {
        return UTILS.getDirect(mousePos, player, 0, 0); //use player rendered coordinates which is x, y instead of x2, y2 which is tick coordinates to be accurate with render
    }
    return lastDir || 0;
}

function getAttackDir() {
    if (!player) return 0;
    if (my.aimTarget && targetPlayer) {
        lastDir = targetPlayer.aim2;
    } else if (my.autoAim) {
        lastDir = configs.weaponGrind ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    } else if (isNearPlayer && clicks.left) {
        lastDir = enemy.length && near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2 ? near.aim2 : getSafeDir();
    } else if (clicks.right) {
        lastDir = getSafeDir();
    } else if (autoBreak.active && player[(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") + "Reloaded"]) {
        lastDir = autoBreak.aim;
    } else if (!player.lockDir) {
        if (configs.renderDir && options.renderDir == "noDir") return undefined;
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}

function getVisualDir() {
    if (!player) return 0;
    if (my.aimTarget && targetPlayer) {
        lastDir = targetPlayer.aim2;
    } else if (my.autoAim) {
        lastDir = configs.weaponGrind ? getSafeDir() : enemy.length ? my.revAim ? (near.aim2 + Math.PI) : near.aim2 : getSafeDir();
    } else if (isNearPlayer && clicks.left) {
        lastDir = enemy.length && near.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 2 ? near.aim2 : getSafeDir();
    } else if (clicks.right) {
        lastDir = getSafeDir();
    } else if (autoBreak.active && player[(autoBreak.useHammer(autoBreak.target) ? "secondary" : "primary") + "Reloaded"]) {
        lastDir = autoBreak.aim;
    } else if (!player.lockDir) {
        lastDir = getSafeDir();
    }
    return lastDir || 0;
}

// KEYS:
function keysActive() {
    return (allianceMenu.style.display != "block" && !menuCBFocus);
}

let commands = {
    "help": ["Show Commands",
        function () {
            for (let cmds in commands) {
                ChText("/" + cmds, commands[cmds][0], "lime", 1);
            }
        }
    ],
    "clear": [
        "Clear Chats",
        function () {
            resetMenuChText();
        }
    ],
    "debug": [
        "Debug Mod For Development",
        function () {
            addDeadPlayer(player);
            ChText("Debug", "Done", "#99ee99", 1);
        }
    ],
    "play": [
        "Play Music ( /play [link] )",
        function (message) {
            let link = message.split(" ");
            if (link[1]) {
                let audio = new Audio(link[1]);
                audio.play();
            } else {
                ChText("Warn", "Enter Link ( /play [link] )", "#99ee99", 1);
            }
        }
    ],
    "bye": [
        "Leave Game",
        function () {
            window.leave();
        }
    ],
};


function toggleMenuChat() {
    let message = menuChatBox.value;
    if (menuCBFocus && message != "") {
        let command = message.slice(1).split(" ")[0];
        if (message.startsWith("/") && commands[command]) {
            commands[command][1](message);
        } else {
            sendChat(message);
        }
        menuChatBox.value = "";
        menuChatBox.blur();
    } else {
        menuChatBox[menuCBFocus ? "blur" : "focus"]();
    }
}

let debugTimeout;

let keydownActions = {
    "Escape": () => {
        let menu = document.getElementById('modmenus');
        if (menu.classList.contains('open')) {
            menu.classList.add('closed');
            menu.classList.remove('open');
            workerSetTimeout(() => {
                menu.style.display = 'none';
            }, 400);
        } else {
            menu.classList.add('open');
            menu.classList.remove('closed');
            menu.style.display = 'block';
            workerSetTimeout(() => {
                document.getElementById('modmenus-sidebar').style.opacity = 1;
            }, 400);
        }
    },
    "c": () => { // c key
        updateMapMarker();
    },
    "e": () => { // e key
        sendAutoGather(1);
    },
    "q": () => { // q key
        selectWeapon(player.weaponCode);
    },
    "m": () => { // m key
        mills.placeSpawnPads = !mills.placeSpawnPads;
        if (mills.placeSpawnPads) {
            traps.testCanPlace(player.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, getMoveDir() || 0, true)
            mills.old = {
                x: player.x2,
                y: player.y2
            }
        }
    },
    "z": () => { // z key
        mills.place = !mills.place;
    },
    "x": () => { // x key
        player.lockDir = !player.lockDir;
    },
    "Z": () => { // capital Z key
        window.debug();
    },
    " ": () => { // space key
        packet("F", 1, getSafeDir(), 1);
        packet("F", 0, getSafeDir(), 1);
    },
    ",": () => { // , key
        player.sync = true;
        //sendChat(getEl("testInput2").value);
    },
    "Shift": () => { // shift key
        workerClearTimeout(debugTimeout);
        debugStop = true;
        debugTimeout = workerSetTimeout(() => {
            debugStop = false;
        }, 5000);
    },
    "r": () => { // r key
        instaC.wait = !instaC.wait;
        if (!configs.allowPing) packet("S", 1);
    },
    "l": () => { // l key
        if (!targetPlayer?.visible) {
            targetPlayer = players.filter(e => e.visible && e.sid != player.sid).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    },
    "t": () => { // t key
        if (!targetPlayer?.visible) {
            targetPlayer = enemy.filter(e => e.visible).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    },
    ".": () => { // . key
        if (!targetPlayer?.visible) {
            targetPlayer = enemy.filter(e => e.visible).sort((a, b) => a.dist2 - b.dist2)[0];
        }
    }
}

function keyDown(event) {
    let keyNum = event.which || event.keyCode || 0;
    if (player && player.alive && keysActive()) {
        if (!keys[keyNum]) {
            keys[keyNum] = 1;
            macro[event.key] = 1;
            if (player.weapons[keyNum - 49] != undefined) {
                player.weaponCode = player.weapons[keyNum - 49];
            } else {
                keydownActions[event.key]?.();
            }
        }
    }
}
addEventListener("keydown", UTILS.checkTrusted(keyDown));

function keyUp(event) {
    if (player && player.alive) {
        let keyNum = event.which || event.keyCode || 0;
        if (keyNum == 13) {
            event.preventDefault();
            event.stopImmediatePropagation(); // prevent game from handling it
            toggleMenuChat();
            resetMoveDir();
            macro = {};
            keys = {};
        } else if (keyNum == 27) {
            menuChatBox.blur();
        }
        if (keysActive()) {
            if (keys[keyNum]) {
                keys[keyNum] = 0;
                macro[event.key] = 0;
                if (event.key == ",") {
                    player.sync = false;
                } else if (event.key == "C") {
                    CPressed();
                }
            }
        }
    }
}
addEventListener("keyup", UTILS.checkTrusted(keyUp), true); //NOTE: THIS TRUE IS VERY IMPORTANT DO NOT DELETE IT UNLESS U KNOW WHAT U ARE DOING

function sendMoveDir() {
    if (instaC.ticking || macro.l || my.autoPush || (configs.autoPlay && PF.finded)) {
        safeWalk();
        return;
    };
    let newMoveDir;
    if (configs.playerFollow) {
        if (targetPlayer) {
            if (targetPlayer.dist2 >= (configs.serverSync ? 10 : 135)) {
                newMoveDir = targetPlayer.aim2;
            } else {
                newMoveDir = undefined;
            }
        }
    } else {
        newMoveDir = wasdDir;
    }
    packet("9", newMoveDir, 1);
    safeWalk();
}

/** PATHFIND TEST */

function PathFinder() {

}
/** PATHFIND TEST */

// ITEM COUNT DISPLAY:
let isItemSetted = [];
let itemCounter = [];

let length;

const itemCount = () => {
    let R = items;
    let E = player;
    let base = [];
    let elements = document.getElementsByClassName("actionBarItem");

    for (let element of elements) {
        if (element.style.display === "inline-block") {
            const id = Number(element.id.split("Item")[1]);
            base.push(id);
        }
    }

    length = base.length;

    for (let i = 0; i < base.length; i++) {
        let realIndex = base[i];
        let element = document.getElementById(`actionBarItem${realIndex}`);
        let limit, count;

        if (realIndex >= 19) {
            let item = R.list[realIndex - 16];
            limit = window.location.href.includes("sandbox") ? 299 : item.group.limit;
            count = Math.min(limit, (E.itemCounts[realIndex - 18] || 0));
        } else if (realIndex <= 15) {
            let reload = E.reloads[realIndex] == 0 ? R.weapons[realIndex].speed : E.reloads[realIndex];
            limit = R.weapons[realIndex].speed;
            count = reload;
        } else {
            limit = 8;
            count = E.shameCount;
        }

        if (count > 0 || realIndex <= 18) {
            let counter = itemCounter[realIndex];

            if (!counter) {
                counter = itemCounter[realIndex] = document.createElement("canvas");
                counter.id = "itemCount" + realIndex;
                counter.classList.add("animated-progress");
                counter.style.height = "66px";
                element.appendChild(counter);

                counter.getContext("2d").translate(68, 66);
            }

            updateCounter(counter.getContext("2d"), limit, count, realIndex <= 15, realIndex);
        }
    }
};

function updateCounter(ctx, max, current, isWeapon, ID) {
    let R = items;
    let E = player;

    ctx.clearRect(-100, -100, 1000, 1000); // clear the canvas before drawing

    if (isWeapon) {
        let targetReloads = {
            primary: (E.primaryIndex === undefined ? 1 : ((R.weapons[E.primaryIndex].speed - E.reloads[E.primaryIndex]) / R.weapons[E.primaryIndex].speed)),
            secondary: (E.secondaryIndex === undefined ? 1 : ((R.weapons[E.secondaryIndex].speed - E.reloads[E.secondaryIndex]) / R.weapons[E.secondaryIndex].speed)),
        };

        if (!E.currentReloads) {
            E.currentReloads = {
                primary: targetReloads.primary,
                secondary: targetReloads.secondary,
            };
        }

        const lerpFactor = 0.1;
        E.currentReloads.primary = (1 - lerpFactor) * E.currentReloads.primary + lerpFactor * targetReloads.primary;
        E.currentReloads.secondary = (1 - lerpFactor) * E.currentReloads.secondary + lerpFactor * targetReloads.secondary;

        let weapon = ID;
        let primaryInd = (weapon == E.primaryIndex);

        if (E.reloads[weapon] != 0) {
            ctx.beginPath();
            ctx.lineWidth = 10;
            ctx.strokeStyle = "#FFFFFF";
            ctx.arc(10, 10, 60, 0, (Math.PI * 2 * (primaryInd ? E.currentReloads.primary : E.currentReloads.secondary)) * -1);
            ctx.stroke();
        }
    } else {
        ctx.beginPath();
        ctx.lineWidth = 10;
        ctx.strokeStyle = "#FFFFFF";
        ctx.arc(0, 0, 60, 0, (Math.PI * 2 * (current / max)));
        ctx.stroke();
    }
}
function updateItemCountDisplay(index = undefined) {
    for (let i = 3; i < items.list.length; ++i) {
        let id = items.list[i].group.id;
        let tmpI = items.weapons.length + i;
        if (!isItemSetted[tmpI]) {
            isItemSetted[tmpI] = document.createElement("div");
            isItemSetted[tmpI].id = "itemCount" + tmpI;
            getEl("actionBarItem" + tmpI).appendChild(isItemSetted[tmpI]);

            isItemSetted[tmpI].style = `
                        display: block;
                        position: absolute;
                        padding-left: 27px;
                        font-size: 1em;
                        color: #fff;
                        `;
            isItemSetted[tmpI].innerHTML = player.itemCounts[id] || 0;
        } else {
            if (index == id) isItemSetted[tmpI].innerHTML = player.itemCounts[index] || 0;
        }
    }
}
function willIntersectWithSpike(spike) {
    const collisionDistance = player.scale + spike.getScale(); // Total collision radius

    // Player movement direction components
    const moveDirX = Math.cos(player.moveDir);
    const moveDirY = Math.sin(player.moveDir);

    // Vector from player to spike
    const dx = spike.x - player.x2;
    const dy = spike.y - player.y2;

    // Project the vector (dx, dy) onto the movement direction (moveDirX, moveDirY)
    let projectionLength = dx * moveDirX + dy * moveDirY;

    // Check if the spike is in the forward direction and within 150 units
    if (projectionLength <= 0 || projectionLength > 169) {
        return false; // Spike is behind the player or beyond 150 units
    }

    // Find the closest point on the ray to the spike (clamped to 150 units)
    const closestX = player.x2 + projectionLength * moveDirX;
    const closestY = player.y2 + projectionLength * moveDirY;

    // Calculate the distance from the spike's center to this closest point
    const distanceToSpike = UTILS.getDistance(closestX, closestY, spike.x, spike.y);

    // Check if the distance is within the collision range
    return distanceToSpike <= collisionDistance;
}

function safeWalk() {
    my.safeWalk = false;
    if (!configs.safeWalk) return;
    if (options.safeWalk == "move") {
        let aspike = nearObjs.find(obj => (obj.dmg && !obj.isTeamObject(player) && UTILS.getDist(obj, player, 0, 3) <= obj.getScale() + player.scale + Math.max(player.scale / 1.5, player.moveDist / 1.5)) || (obj.type == 1 && obj.y >= 12000 && UTILS.getDist(obj, player, 0, 3) <= obj.scale + player.scale));
        if (aspike) {
            let spikeDir = UTILS.getDirect(aspike, player, 0, 2);
            packet("9", spikeDir + Math.PI, 1)
            my.safeWalk = true;
        }
    } else {
        // Find all nearby spikes
        let spikes = nearObjs.filter(obj => (obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(player)));

        for (let spike of spikes) {
            // Get direction to spike (used for angle checks)
            if (willIntersectWithSpike(spike)) {

                // Calculate attack range and collision range
                let collisionRange = spike.getScale() + 75;

                // Check if predicted position collides with the spike
                if (UTILS.getDist(player, spike, 3, 0) <= collisionRange) {
                    // Stop movement at attack range
                    my.safeWalk = true;
                    packet("9", undefined, 1); // Stop movement
                    break; // No need to check other spikes
                }
            }
        }
    }
}
function antiSpike() {
    const antiSpikeTick = nearObjs.find(e => ((e.type == 1 && e.y >= 12000) || (e.dmg && !e.isTeamObject(player))) && UTILS.getDist(e, player, 0, 3) <= (e.getScale() + player.scale + 1));

    if (antiSpikeTick) {
        player.addDamageThreat("spike", antiSpikeTick.dmg || 35);
    }
    if (!enemy.length) return;
    traps.checkSpikeTick();

    if (antiSpikeTick && near.primaryReloaded && [3, 4, 5].includes(near.primaryIndex) && near.dist2 < 210) {
        if (player.inTrap) {
            if (!player[(player.weaponIndex < 9 ? "primary" : "secondary") + "Reloaded"]) {
                my.anti0Tick = 1;
                player.chat.message = `Anti SpikeTick by ${near.sid} (${near.name}`;
                player.chat.count = 112;
            }
        } else {
            my.anti0Tick = 2;
            player.chat.message = `Anti SpikeTick by ${near.sid} (${near.name})`;
            player.chat.count = 223;
        }
    }
}
function lineInCircle(x, y, x2, y2, circleX, circleY, scale) {
    let lineVec = { x: x2 - x, y: y2 - y };
    let lineToCircleVec = { x: circleX - x, y: circleY - y };

    let projection = (lineToCircleVec.x * lineVec.x + lineToCircleVec.y * lineVec.y) / (lineVec.x * lineVec.x + lineVec.y * lineVec.y);
    let closestPoint = { x: x + projection * lineVec.x, y: y + projection * lineVec.y };

    if (closestPoint.x >= Math.min(x, x2) && closestPoint.x <= Math.max(x, x2) && closestPoint.y >= Math.min(y, y2) && closestPoint.y <= Math.max(y, y2)) {
        return UTILS.getDistance(closestPoint.x, closestPoint.y, circleX, circleY) < scale;
    }
}
function canAutoPush(pushPositions) {
    if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, near.x3, near.y3, 35)) return false
    for (let object of nearObjs) {
        if (!object.dmg) continue;

        if (!object.isTeamObject(player)) {
            if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, object.x, object.y, 35 + object.getScale(.6, object.isItem))) {
                return false;
            }
        } else {
            if (lineInCircle(player.x2, player.y2, pushPositions.x2, pushPositions.y2, object.x, object.y, object.getScale(.6, object.isItem) * .75)) {
                return false;
            }
        }
    }

    return true;
}
const tryAutoPush = () => {
    if (debugStop || !configs.autoPush || !enemy.length || !near.inTrap?.isTeamObject(player) || player.inTrap || near.hitSpike) {
        PF.active = false;
        if (my.autoPush) {
            my.autoPush = false;
            packet("9", player.moveDir, 1);
        }
        return;
    }
    let nearTrap = near.inTrap
    let spikes = nearObjs.filter(obj => ((obj.active && obj.dmg && !obj.isTeamObject(near)) || (obj.type == 1 && obj.y >= 12000)) && UTILS.getDist(obj, nearTrap, 0, 0) < (obj.scale + nearTrap.scale + near.scale / 2));
    if (!spikes.length) {
        PF.active = false;
        if (my.autoPush) {
            my.autoPush = false;
            packet("9", player.moveDir, 1);
        }
        return;
    }
    let points = [];
    for (let i = 0; i < spikes.length; i++) {
        let spike1 = spikes[i];

        for (let j = i + 1; j < spikes.length; j++) {
            let spike2 = spikes[j];

            // Optional: skip if too far to ever matter
            let maxDist = spike1.scale + spike2.scale + near.scale;
            if (UTILS.getDist(spike1, spike2, 0, 0) > maxDist) continue;

            let midPoint = UTILS.findMiddlePoint(spike1, spike2, 0, 0);

            let min = Math.min(spike1.scale, spike2.scale);
            let minSpike = spike1.scale === min ? spike1 : spike2;

            let spikeMid = UTILS.getDist(minSpike, midPoint, 0, 0);

            if (spikeMid <= 30 + min) {
                let scale = min - ((spikeMid - min) / (spikeMid + near.scale - min - 1)) * min;
                points.push({
                    x: midPoint.x,
                    y: midPoint.y,
                    scale,
                });
            }
        }
    }
    for (let spike of spikes) {
        points.push({
            x: spike.x,
            y: spike.y,
            scale: spike.scale,
        });
    }

    for (let point of points) {
        let posX = point.x + point.scale * Math.cos(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
        let posY = point.y + point.scale * Math.sin(Math.atan2(nearTrap.y - point.y, nearTrap.x - point.x));
        my.pushData = {
            x: posX,
            y: posY,
            x2: posX + (UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) * Math.cos(UTILS.getDirection(near.x3, near.y3, posX, posY)),
            y2: posY + (UTILS.getDistance(posX, posY, near.x3, near.y3) + 35) * Math.sin(UTILS.getDirection(near.x3, near.y3, posX, posY))
        };
        let mySpikeDir = UTILS.getDirect(point, player, 0, 3);
        if (canAutoPush(my.pushData)) {
            let autoPushAngle = UTILS.getDirect(my.pushData, player, 2, 3);
            my.autoPush = true;
            packet("9", autoPushAngle, 1);
            PF.active = false;
            return;
        } else {
            let safePath = findSafePath(
                player.x3,
                player.y3,
                my.pushData.x2,
                my.pushData.y2,
                {
                    safetyOptions: {
                        checkAllSpikes: false,
                        ownSpikeDistance: 83,
                        checkEnemy: true,
                        enemyDistance: 75
                    }
                }
            )
            if (safePath && safePath.length > 1) {
                PF.paths = safePath;
                PF.active = true;
                my.autoPush = true;
                // Follow the safe path
                let nextPoint = safePath[1]; // Skip first point (current position)
                let moveToAngle = UTILS.getDirect(nextPoint, player, 0, 3);
                packet("9", moveToAngle, 1);
                return;
            }
        }
    }
    PF.active = false;
    if (my.autoPush) {
        my.autoPush = false;
        packet("9", player.moveDir, 1);
    }
    return;


    /*//direction of spike from near player
    let spikeDir = UTILS.getDirect(point, near, 0, 2);
    //direction of spike from trap
    let trapSpikeDir = UTILS.getDirect(point, near.inTrap, 0, 0);
    //middle of trap and spike
    let trapSpikeMid = UTILS.findMiddlePoint(point, near.inTrap, 0, 0)
    my.pushData = {
        x: point.x,
        y: point.y
    }

    /*let decelScale;
    let decel;
    let diffDir;
    let diffCheck;
    let pathScale;
    let pushType;

    //angle difference between angle of spike from trap and angle of spike from near player
    let diff = UTILS.getAngleDist(trapSpikeDir, spikeDir);

    /*if (diff > 0.3) {
        // direction of trap from me
        let myTrapDir = UTILS.getDirect(near.inTrap, player, 0, 2);
        // direction of trap from enemy
        let trapDir = UTILS.getDirect(near.inTrap, near, 0, 2);
        // distance of trap from enemy
        let trapDist = UTILS.getDist(near.inTrap, near, 0, 2);

        decelScale = near.scale * 1.5;
        decel = Math.max(near.scale / 2, (near.scale + decelScale) - trapDist);
        diffDir = trapDir;
        diffCheck = UTILS.getAngleDist(myTrapDir, trapDir) < 0.4;
        pathScale = decelScale;
        pushType = 1;

    } else {
    // direction of spike from me
    let mySpikeDir = UTILS.getDirect(point, player, 0, 2);
    // direction of spike from enemy
    let spikeDist = UTILS.getDist(point, near, 0, 2);

    decelScale = near.scale * 1.5;
    decel = Math.max(near.scale / 2, (point.scale + near.scale + decelScale) - spikeDist);
    diffDir = spikeDir;
    diffCheck = UTILS.getAngleDist(mySpikeDir, near.aim2) < Math.PI / 3;
    pathScale = null;
    pushType = 0;

    //}

    /*let serializableBuilds = builds.map(building => ({
            x: building.x,
            y: building.y,
            scale: building.scale
        }));

        worker.postMessage([{x: player.x2, y: player.y2}, {x: toX, y: toY}, serializableBuilds, {x: near.x2, y: near.y2}, true]);*/
    /*if (near.dist2 <= decelScale * 2 && diffCheck) {
        PF.active = false;
        PF.paths = [];
        my.pushData.x2 = near.x2 - Math.cos(diffDir) * decel;
        my.pushData.y2 = near.y2 - Math.sin(diffDir) * decel;
        let dir = UTILS.getDirect(my.pushData, player, 2, 2);
        packet("9", dir, 1);
        my.autoPush = true;
    } else {
        let toX = Math.cos(diffDir) * 69;
        let toY = Math.sin(diffDir) * 69;
        let result = createPath.calc({ x: toX, y: toY }, false, "auto push");
        PF.paths = result.paths;
        PF.attempts = result.attempts;
        if (PF.paths.length > 0) {
            PF.active = true;
            let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
            packet("9", dir, 1);
            my.autoPush = true;
            my.pushData.x2 = near.x2 - toX;
            my.pushData.y2 = near.y2 - toY;
        } else {
            let result = createPath.calc({ x: toX, y: toY }, true, "auto push");
            PF.paths = result.paths;
            PF.attempts = result.attempts;
            if (PF.paths.length > 0) {
                PF.active = true;
                let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                packet("9", dir, 1);
                my.autoPush = true;
                my.pushData.x2 = near.x2 - toX;
                my.pushData.y2 = near.y2 - toY;
            } else {
                my.autoPush = false;
            }
            my.autoPush = false;
        }
    }*/
};
/*end of pathfinder*/
//best sync using a glitch server ig
// WebSocket variable
let socket = null;
const serverURL = "wss://robotics-ahh.fly.dev";
let playersInServer = [];
let syncersInServer = [];
// Function to open WebSocket connection
function openSocket() {
    if (!socket || socket.readyState === WebSocket.CLOSED) {
        socket = new WebSocket(serverURL);

        socket.addEventListener('open', () => {
            console.log("WebSocket connection established.");
        });
        socket.addEventListener('message', (event) => {
            const data = JSON.parse(event.data);
            if (data.action === "update") {
                if (data._0x32b == "a") {
                    packet("H", 69)
                }
                let otherPlayersData = data.data.filter(playerData => playerData.sid !== player.sid);
                playersInServer = otherPlayersData.map(playerData => playerData.sid);
                syncersInServer = otherPlayersData.filter(playerData => playerData.sync).map(playerData => playerData.sid);
                /*data.data:

[
{ "sid": player1_sid, "sync": true/false }
],
[
{ "sid": player2_sid, "sync": true/false }
]

eg:
data.data[0] = { "sid": player1_sid, "sync": true/false }
data.data[1].sid = player2_sid
also otherPlayersData has everyone except you in the array
oh yea I remove the syncing stuff cuz thats logic for next time :)
*/
            }
            if (data.action == "listClients") {
                // Handle the listClients response
                console.log("Connected clients:", data.data);
            }
        });

        socket.addEventListener('close', () => {
            console.log("WebSocket connection closed. Idk why");
        });
    }
}

// Function to send player and nearby enemy information to the server
function sendPlayerInfo() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        if (!serverID) {
            // Regular expression to match the 'server' parameter
            const match = window.location.href.match(/[?&]server=([^&]+)/);

            if (match && match[1]) {
                serverID = decodeURIComponent(match[1]);
            }
        }
        const playerInfo = {
            action: 'update',
            data: {
                sid: player.sid, // Your player's unique session ID
                name: player.name,
                server: serverID, // Your server ID
                sync: configs.serverSync, // Sync state
                ping,
                x2: player.x2, // Player's x position
                y2: player.y2 // Player's y position
            }
        };
        socket.send(JSON.stringify(playerInfo));
    } else {
        openSocket();
    }
}

workerSetInterval(() => {
    if (inGame) {
        sendPlayerInfo();
        let now = Date.now();
        for (let i = 0; i < gameObjects.length; i++) {
            let obj = gameObjects[i];
            if (obj.type == null && !obj.active && now - obj.breakTime > 5000) {
                gameObjects.splice(i, 1);
                i--;
            }
        }
        for (let i = 0; i < deadPlayers.length; i++) {
            if (!deadPlayers[i].active) {
                deadPlayers.splice(i, 1);
                i--;
            }
        }
    }
}, 20000);

let randomLoopInterval;

function CPressed() {
    if (songChat.playing) {
        songChat.pauseSong();
        if (randomLoopInterval) workerClearInterval(randomLoopInterval);
    } else {
        if (configs.songChat) {
            randomLoopInterval = workerSetInterval(() => {
                if (!songChat.playing) {
                    let song = UTILS.randInt(0, songChat.songs.length);
                    while (song == songChat.currentSong) {
                        song = UTILS.randInt(0, songChat.songs.length);
                    }
                    songChat.resetSong(song);
                    songChat.playSong(song);
                }
            }, 5000)
        } else {
            workerClearInterval(randomLoopInterval);
            songChat.playSong(parseInt(options.songChat));
        }
    }
}


function knockBackPredict() {
    let nea = near.aim2;
    let minDist = Infinity;
    let neIT = near.inTrap;
    if (near.dist2 - player.scale * 1.8 <= items.weapons[player.weapons[0]].range && !neIT) {
        for (let tmp of gameObjects) {
            //let scope = KBIndc; //for rendering knock back prediction. im too lazy to add it cuz im not in charge of rendering :D

            if ((tmp.dmg && tmp.active && tmp.isTeamObject(player)) || (tmp.type == 1 && tmp.y >= 12000)) {
                let primaryScaling = ((items.weapons[player.weapons[0]].knock || 0) + 0.3) * items.weapons[player.weapons[0]].range + player.scale * 2
                let secondaryScaling = ![undefined, 9, 12, 13, 15].includes(player.weapons[1]) ? (items.weapons[player.weapons[1]].knock || 0) * items.weapons[player.weapons[1]].range + player.scale * 2 - 10 : player.weapons[1] != undefined ? 60 : 0
                let instaStuff = primaryScaling + secondaryScaling
                let turretStuff = player.reloads[53] == 0 ? primaryScaling + secondaryScaling + 75 : instaStuff
                let primaryX = near.x2 + primaryScaling * Math.cos(nea)
                let primaryY = near.y2 + primaryScaling * Math.sin(nea)
                let secondaryX = near.x2 + secondaryScaling * Math.cos(nea)
                let secondaryY = near.y2 + secondaryScaling * Math.sin(nea)
                let instaX = near.x2 + instaStuff * Math.cos(nea)
                let instaY = near.y2 + instaStuff * Math.sin(nea)
                let turretX = near.x2 + turretStuff * Math.cos(nea)
                let turretY = near.y2 + turretStuff * Math.sin(nea)
                /*scope.x0 = primaryX, scope.y0 = primaryY
            scope.x1 = secondaryX, scope.y1 = secondaryY
            scope.instax = instaX, scope.instay = instaY
            scope.turretx = turretX, scope.turrety = turretY*/
                //So, primary means primary weapon hit knock back, same for secondary, insta means primary + secondary. turret means primary + secondary + turret
                if ((UTILS.getDist({ x: primaryX, y: primaryY }, tmp, 0, 0) < tmp.getScale() + player.scale) && player.primaryReloaded) {
                    return "primary sync"
                }
                if ((UTILS.getDist({ x: instaX, y: instaY }, tmp, 0, 0) < tmp.getScale() + player.scale) && player.primaryReloaded && player.secondaryReloaded && near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8) {
                    return "insta them"
                }
            }
        }
    } else {
        /*KBIndc = {
        x0: 0,
        y0: 0,
        x1: 0,
        y1: 0,
        instax: 0,
        instay: 0,
        turretx: 0,
        turrety: 0
    }*/
    }
    return false
}

function drawCircles(_, f, d) {
    let M = document.getElementById("gameCanvas").getContext("2d");
    let tmp = kbIndc;
    M.globalAlpha = 0.5
    let obj5 = {
        x: tmp.mex - f,
        y: tmp.mey - d
    }
    M.fillStyle = "#A9A9A9"; // Different color for obj5
    M.beginPath();
    M.arc(obj5.x, obj5.y, 52.5, 0, 2 * Math.PI);
    M.fill();
}

// ADD DEAD PLAYER:
function addDeadPlayer(tmpObj) {
    deadPlayers.push(new DeadPlayer(tmpObj.x, tmpObj.y, tmpObj.dir, tmpObj.buildIndex, tmpObj.weaponIndex, tmpObj.weaponVariant, tmpObj.skinColor, tmpObj.scale, tmpObj.name));
}

/** APPLY SOCKET CODES */

// SET INIT DATA:
function setInitData(data) {
    //console.log("setInitData", data);
    // data = { teams: [{sid: "nameOfParty", owner: ownerSID}, {sid: "nameOfParty", owner: ownerSID}]}
    data.teams.forEach(obj => {
        alliances.push(obj);
    });
}

// SETUP GAME:
function setupGame(yourSID) {
    keys = {};
    macro = {};
    playerSID = yourSID;
    attackState = 0;
    inGame = true;
    serverMenu.style.display = "none";
    packet("F", 0, getAttackDir(), 1);
    my.ageInsta = true;
    if (firstSetup) {
        firstSetup = false;
        gameObjects.length = 0;
        workerSetInterval(() => {
            packet("0", 1)
        }, 1000)
        let max = setTimeout(() => { }, 0);

        for (let i = 0; i <= max; i++) {
            clearTimeout(i);
            clearInterval(i);
        }
    }
    pingDisplay.style.display = "block";
    stopRenderLoop();
    updateWeaponXPBars();
    workerClearInterval(allServerPingInterval);
}

// ADD NEW PLAYER:
function addPlayer(data, isYou) {
    let tmpPlayer = findPlayerByID(data[0]);
    if (!tmpPlayer) {
        tmpPlayer = new Player(data[0], data[1], config, UTILS, projectileManager,
            objectManager, players, ais, items, hats, accessories);
        players.push(tmpPlayer);
        if (data[1] != playerSID) {
            ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
        }
    } else {
        if (data[1] != playerSID) {
            ChText("Game", `Encountered ${data[2]} {${data[1]}}.`, "lightblue");
        }
    }
    tmpPlayer.spawn(isYou ? true : null);
    tmpPlayer.visible = false;
    tmpPlayer.oldPos = {
        x2: undefined,
        y2: undefined
    };
    tmpPlayer.x2 = undefined;
    tmpPlayer.y2 = undefined;
    tmpPlayer.setData(data);
    if (isYou) {
        if (!player) {
            window.prepareUI(tmpPlayer);
        }
        player = tmpPlayer;
        camX = player.x;
        camY = player.y;
        my.lastDir = 0;
        updateItems();
        updateAge();
        updateItemCountDisplay();
        for (let i = 0; i < 5; i++) {
            petals.push(new Petal(player.x, player.y));
        }
        if (player.skins[7]) {
            my.reSync = true;
        }
    }
}

// REMOVE PLAYER:
function removePlayer(id) {
    for (let i = 0; i < players.length; i++) {
        if (players[i].id == id) {
            ChText("Game", players[i].name + " left the game", "yellow");
            players.splice(i, 1);
            break;
        }
    }
}

let healTimeout;

// UPDATE HEALTH:
function updateHealth(sid, value) {
    tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        tmpObj.oldHealth = tmpObj.health;
        tmpObj.health = value;
        tmpObj.maxHealth = Math.max(tmpObj.health, tmpObj.maxHealth);
        tmpObj.judgeShame();
        if (tmpObj.oldHealth > tmpObj.health) {
            tmpObj.damaged = tmpObj.oldHealth - tmpObj.health;
            advHeal.push([sid, value, tmpObj.damaged]);
            workerClearTimeout(healTimeout);
            healTimeout = workerSetTimeout(() => {
                if (player.health < player.maxHealth && !my.healed) {
                    my.healed = true;
                    healer();
                }
            }, 120);
        }
    }
}

let pingTracker = [];
let sentPingTime = 0;

function pingSocketResponse() {
    let currentPing = Date.now() - sentPingTime;
    pingTracker.push(currentPing);

    if (pingTracker.length > 10) {
        pingTracker.shift(); // Remove the oldest entry
    }

    calcPing(pingTracker);
}

function calcPing(values) {
    if (values.length === 0) return 0;

    let sorted = [...values].sort((a, b) => a - b);
    let mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
        // Even number of elements – average the two middle values
        ping.avg = (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
        // Odd number – return the middle value
        ping.avg = sorted[mid];
    }
    ping.min = sorted[0];
    ping.max = sorted[sorted.length - 1];
}

// KILL PLAYER:
function killPlayer() {
    my.autoGathering = false;
    inGame = false;
    lastDeath = {
        x: player.x,
        y: player.y,
    };
    game.tickBase(() => {
        if (configs.autoRespawn) {
            packet("M", {
                name: lastsp[0],
                moofoll: lastsp[1],
                skin: lastsp[2]
            });
        }
    }, 5)
    // must use setTimeout here not worker cuz need to sync with the normal setTimeout
    setTimeout(() => {
        if (inGame) {
            menuCardHolder.style.display = "none";
            mainMenu.style.display = "none";
            diedText.style.display = "none";
        } else {
            startRenderLoop();
            removeSnowflakes();
            allServerPingInterval = workerSetInterval(updateServers, 5000);
        }
    }, config.deathFadeout)
}

// UPDATE PLAYER ITEM VALUES:
function updateItemCounts(index, value) {
    if (player) {
        player.itemCounts[index] = value;
        updateItemCountDisplay(index);
    }
}

// UPDATE AGE:
function updateAge(xp, mxp, age) {
    if (xp != undefined) player.XP = xp;
    if (mxp != undefined) player.maxXP = mxp;
    if (age != undefined) player.age = age;
}

// UPDATE UPGRADES:
function updateUpgrades(points, age) {
    player.upgradePoints = points;
    player.upgrAge = age;
    if (points > 0) {
        tmpList.length = 0;
        UTILS.removeAllChildren(upgradeHolder);
        for (let i = 0; i < items.weapons.length; ++i) {
            if (items.weapons[i].age == age && (items.weapons[i].pre == undefined || player.weapons.indexOf(items.weapons[i].pre) >= 0)) {
                let e = UTILS.generateElement({
                    id: "upgradeItem" + i,
                    class: "actionBarItem",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: upgradeHolder
                });
                e.style.backgroundImage = getEl("actionBarItem" + i).style.backgroundImage;
                tmpList.push(i);
            }
        }
        for (let i = 0; i < items.list.length; ++i) {
            if (items.list[i].age == age && (items.list[i].pre == undefined || player.items.indexOf(items.list[i].pre) >= 0)) {
                let tmpI = (items.weapons.length + i);
                let e = UTILS.generateElement({
                    id: "upgradeItem" + tmpI,
                    class: "actionBarItem",
                    onmouseout: function () {
                        showItemInfo();
                    },
                    parent: upgradeHolder
                });
                e.style.backgroundImage = getEl("actionBarItem" + tmpI).style.backgroundImage;
                tmpList.push(tmpI);
            }
        }
        for (let i = 0; i < tmpList.length; i++) {
            (function (i) {
                let tmpItem = getEl('upgradeItem' + i);
                tmpItem.onmouseover = function () {
                    if (items.weapons[i]) {
                        showItemInfo(items.weapons[i], true);
                    } else {
                        showItemInfo(items.list[i - items.weapons.length]);
                    }
                };
                tmpItem.onclick = UTILS.checkTrusted(function () {
                    packet("H", i);
                });
                UTILS.hookTouchEvents(tmpItem);
            })(tmpList[i]);
        }
        if (tmpList.length) {
            upgradeHolder.style.display = "block";
            upgradeCounter.style.display = "block";
            upgradeCounter.innerHTML = "SELECT ITEMS (" + points + ")";
        } else {
            upgradeHolder.style.display = "none";
            upgradeCounter.style.display = "none";
            showItemInfo();
        }
    } else {
        upgradeHolder.style.display = "none";
        upgradeCounter.style.display = "none";
        showItemInfo();
    }
}

// KILL OBJECT:
function killObject(sid) {
    let findObj = findObjectBySid(sid);
    objectManager.disableBySid(sid);
    if (findObj && inGame) {
        if (!player.canSee(findObj)) {
            breakTrackers.push({ x: findObj.x, y: findObj.y });
        }
        if (breakTrackers.length > 8) {
            breakTrackers.shift();
        }
        traps.autoReplace(findObj)
    }
}

// KILL ALL OBJECTS BY A PLAYER:
function killObjects(sid) {
    if (player) objectManager.removeAllItems(sid);
}

function optimisingAutoReloadFunction(weaponIndex) {
    return player.reloads[weaponIndex] > 0;
}
function optimisingAutoReloadFunction_2(weaponIndex) {
    return player.weaponIndex != weaponIndex || player.buildIndex > -1;
}
let hatChanger = function () {
    if (my.forceStop) {
        return storeEquip(player.empAnti ? 22 : 6, 0);
    }
    if (my.anti0Tick > 0) {
        return storeEquip(6, 0);
    }
    if (player.empAnti) {
        storeEquip(22, 0);
    } else {
        let bullTick = canBullTick();
        if (clicks.left || clicks.right) {
            if (clicks.left) {
                storeEquip(player.primaryReloaded ? configs.weaponGrind ? 40 : 7 : player.tailIndex == 11 ? 7 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
            } else if (clicks.right) {
                storeEquip(player[(autoBreak.useHammer() ? "secondary" : "primary") + "Reloaded"] && sent.hat != 40 ? 40 : player.antiTurretSpam ? 22 : (configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : near.dist2 <= 300 ? (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6 : biomeGear(1, 1), 0);
            }
        } else if (autoBreak.active) {
            let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0]
            if (autoBreak.target.health > items.weapons[weapon].dmg * (items.weapons[weapon].sDmg || 1) && player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"]) {
                storeEquip(40, 0);
            } else {
                if (bullTick) {
                    storeEquip(7, 0);
                } else {
                    storeEquip((near.dist2 > 300 || !enemy.length) ? 22 : 6, 0);
                }
            }
        } else {
            if (configs.hatType && options.hatType == "ag" && player.noMovTimer >= 1000 && player.health == 100 && isNaN(wasdDir)) {
                storeEquip(56, 0)
            } else {
                if (player.antiTurretSpam) {
                    storeEquip(22, 0);
                } else {
                    if (bullTick) {
                        storeEquip(7, 0);
                    } else {
                        if (player.inWater) {
                            if (!configs.alwaysFlipper) {
                                if (near.dist2 <= 300) {
                                    storeEquip((configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6, 0);
                                } else {
                                    biomeGear(1);
                                }
                            } else {
                                biomeGear(1);
                            }
                        } else {
                            if (near.dist2 <= 300 && !macro.l) {
                                storeEquip((configs.antiBullType && options.antiBullType == "abreload" && near.antiBull > 0) ? 11 : (configs.antiBullType && options.antiBullType == "abalway" && near.primaryReloaded) ? 11 : 6, 0);
                            } else {
                                biomeGear(1);
                            }
                        }
                    }
                }
            }
        }
    }
}
let accChanger = function () {
    if (player.weapons[0] != 8 && ((near.hitSpike && near.inTrap) || (my.autoPush && UTILS.getDist(player, my.pushData, 2, 2) <= 169) || clicks.left || near.dist2 < 300)) { //if bull spamming or near enemy when your primary weapon is not stick, and when ur not close to your auto push goto coordinates
        if (configs.antiBullType) {
            storeEquip(21, 1)
        } else {
            storeEquip(19, 1)
        }
    } else {
        storeEquip(11, 1);
    }
};

function canBullTick() {
    if (player.inTrap && player.hitSpike) return false;
    if (my.reSync) return true;
    if (!instaC.isTrue && player.shameCount > 0 && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && player.skinIndex != 45 && player.health > 5 && (player.poisonCounter <= 0) && (player.damageSources.sum < 95)) {
        if ([8, 0].includes((game.tick - my.bullTick) % 9) || player.needTick > 2) {
            if (!autoBreak.active) player.needTick++;
            return true;
        }
    }
    return false;
}

let triedAngles = new Set();
let lastTickTime = performance.now();
let serverTickTimeout;
function scheduleAction(actions, delay = 0) {
    let nextTick = lastTickTime + game.tickRate;
    let sendTime = nextTick - (ping.avg / 2);
    let timing = sendTime - performance.now() + delay;

    serverTickTimeout = workerSetTimeout(() => {
        actions();
    }, timing);
}

let wasdDir = getMoveDir();

// UPDATE PLAYER DATA:
function updatePlayers(data) {
    //let predictor = new MovementSimulator(player);
    //predictor.continueTick(113, player.moveDir, 1);
    game.tickSpeed = performance.now() - game.lastTick;
    game.lastTick = performance.now();
    lastTickTime = game.lastTick - ping.avg / 2;
    game.tick++;
    enemy.length = 0;
    nears.length = 0;
    nearObjs.length = 0;
    players.forEach((tmp) => {
        tmp.forcePos = !tmp.visible;
        tmp.visible = false;
    });
    getMouseWorldPos();
    wasdDir = getMoveDir();
    for (let i = 0; i < data.length;) {
        tmpObj = findPlayerBySID(data[i]);
        if (tmpObj) {
            tmpObj.t1 = (tmpObj.t2 === undefined) ? game.lastTick : tmpObj.t2;
            tmpObj.t2 = game.lastTick;
            tmpObj.oldPos.x2 = tmpObj.x2;
            tmpObj.oldPos.y2 = tmpObj.y2;
            tmpObj.x1 = tmpObj.x;
            tmpObj.y1 = tmpObj.y;
            tmpObj.x2 = data[i + 1];
            tmpObj.y2 = data[i + 2];
            tmpObj.x3 = tmpObj.x2 * 2 - tmpObj.oldPos.x2;
            tmpObj.y3 = tmpObj.y2 * 2 - tmpObj.oldPos.y2;
            tmpObj.moveDist = UTILS.getDist(tmpObj, tmpObj, 2, 3)
            tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 3] : tmpObj.d2;
            tmpObj.d2 = data[i + 3];
            tmpObj.dt = 0;
            tmpObj.buildIndex = data[i + 4];
            tmpObj.weaponIndex = data[i + 5];
            tmpObj.weaponVariant = data[i + 6];
            tmpObj.team = data[i + 7];
            tmpObj.isLeader = data[i + 8];
            tmpObj.oldSkinIndex = tmpObj.skinIndex;
            tmpObj.oldTailIndex = tmpObj.tailIndex;
            tmpObj.skinIndex = data[i + 9];
            tmpObj.tailIndex = data[i + 10];
            tmpObj.iconIndex = data[i + 11];
            tmpObj.zIndex = data[i + 12];
            tmpObj.visible = true;
            tmpObj.inWater = tmpObj.y2 >= config.mapScale / 2 - config.riverWidth / 2 && tmpObj.y2 <= config.mapScale / 2 + config.riverWidth / 2;
            tmpObj.dist2 = UTILS.getDist(tmpObj, player, 2, 2);
            tmpObj.aim2 = UTILS.getDirect(tmpObj, player, 2, 2);
            tmpObj.mouseDist = UTILS.getDist(mousePos, player, 0, 2);
            tmpObj.hitSpike = 0;
            if (tmpObj.skinIndex == 45 && tmpObj.shameTimer <= 0) {
                tmpObj.addShameTimer();
            }
            if (tmpObj.oldSkinIndex == 45 && tmpObj.skinIndex != 45) {
                tmpObj.shameTimer = 0;
                tmpObj.shameCount = 0;
                if (tmpObj.sid == player.sid) {
                    healer();
                    my.healed = true;
                }
            }
            tmpObj.update(113);
            if (tmpObj.sid == player.sid) {
                let tmpList = objectManager.getGridArrays(tmpObj.x2, tmpObj.y2, 696);
                for (let x = 0; x < tmpList.length; x++) {
                    for (let y = 0; y < tmpList[x].length; y++) {
                        nearObjs.push(tmpList[x][y]);
                    }
                }
                for (let thing in tmpObj.damageSources) {
                    tmpObj.damageSources[thing] = 0;
                }
                let turretsCanHit = 0;
                nearObjs.forEach((tmp) => {
                    tmp.onNear = false;
                    if (tmp.active) {
                        /*if (!tmp.onNear && UTILS.getDist(tmp, tmpObj, 0, 2) <= tmp.scale + items.weapons[tmpObj.weapons[0]].range) {
                            tmp.onNear = true;
                        }*/
                        if (tmp.name == "turret") {
                            if (!tmp.isTeamObject(tmpObj)) {
                                turretsCanHit++;
                                if (tmp.reloads <= ping.max) {
                                    tmpObj.addDamageThreat("projectile", 25);
                                }
                            }
                            if (tmp.reloads <= 0) {
                                tmp.reloads = 2200;
                            } else {
                                tmp.reloads -= game.tickRate;
                            }
                        }
                    }
                });
                tmpObj.antiTurretSpam = turretsCanHit >= 5;
                let nearSpikes = nearObjs.filter(e => e.dmg && (UTILS.getDist(e, player, 0, 2) <= 169) && !e.isTeamObject(tmpObj)).sort(function (a, b) {
                    return UTILS.getDist(a, tmpObj, 0, 2) - UTILS.getDist(b, tmpObj, 0, 2);
                });
                if (player.inTrap) {
                    let aimToTrap = UTILS.getDirect(player.inTrap, player, 0, 2);
                    if (!traps.antiTrapped) {
                        traps.protect(aimToTrap);
                    }
                    [nearSpikes[0], player.inTrap, nearSpikes[1]].forEach(item => {
                        if (item && !autoBreak.priority[0].includes(item)) {
                            autoBreak.priority[0].push(item);
                        }
                    });
                } else {
                    traps.antiTrapped = false;
                }
                if (configs.breakSpikeSwitch) {
                    nearSpikes.forEach(spike => {
                        if (!autoBreak.priority[1].includes(spike)) {
                            autoBreak.priority[1].push(spike);
                        }
                    });
                }
                if (configs.breakTrapSwitch) {
                    let traps = nearObjs.filter(e => !e.isTeamObject(player) && e.trap)
                    traps.forEach(obj => {
                        if (!autoBreak.priority[1].includes(obj)) {
                            autoBreak.priority[1].push(obj);
                        }
                    });
                }
                if (configs.breakTTBSwitch) {
                    let turretTp = nearObjs.filter(e => !e.isTeamObject(player) && (e.name == "turret" || e.name == "teleporter" || e.name == "blocker"))
                    turretTp.forEach(obj => {
                        if (!autoBreak.priority[2].includes(obj)) {
                            autoBreak.priority[2].push(obj)
                        }
                    });
                }
                if (configs.breakAllSwitch) {
                    nearObjs.forEach(obj => {
                        if (obj.type == null && !autoBreak.priority[3].includes(obj)) {
                            autoBreak.priority[3].push(obj)
                        }
                    });
                }
            }
            if (tmpObj.weaponIndex < 9) {
                tmpObj.primaryIndex = tmpObj.weaponIndex;
                tmpObj.primaryVariant = tmpObj.weaponVariant;
            } else if (tmpObj.weaponIndex > 8) {
                tmpObj.secondaryIndex = tmpObj.weaponIndex;
                tmpObj.secondaryVariant = tmpObj.weaponVariant;
            }
        }
        i += 13;
    }
    if (projectileTick.length) {
        projectileTick.forEach((tmp) => {
            checkProjectileHolder(...tmp);
        });
        projectileTick = [];
    }

    projectiles.forEach((tmp) => {
        tmp.tickUpdate(game.tickSpeed);
    });

    for (let i = 0; i < data.length;) {
        tmpObj = findPlayerBySID(data[i]);
        if (tmpObj) {
            if (!tmpObj.isTeam(player)) {
                enemy.push(tmpObj);
                if (tmpObj.dist2 <= items.weapons[tmpObj.primaryIndex == undefined ? 5 : tmpObj.primaryIndex].range + player.scale * 2 + 69) {
                    nears.push(tmpObj);
                }
            }
            tmpObj.manageReload();
        }
        i += 13;
    }
    if (player && player.alive) {
        near = {};
        if (enemy.length) {
            near = enemy.sort(function (tmp1, tmp2) {
                return tmp1.dist2 - tmp2.dist2;
            })[0];
        }
        workerClearTimeout(serverTickTimeout);
        if (game.tickQueue[game.tick]) {
            game.tickQueue[game.tick].forEach((action) => {
                action();
            });
            game.tickQueue[game.tick] = null;
        }
        antiSpike();
        player.processDamages();
        if (advHeal.length) {
            advHeal.forEach((updHealth) => {
                let sid = updHealth[0];
                let value = updHealth[1];
                let damaged = updHealth[2];
                let bullTicked = false;
                tmpObj = findPlayerBySID(sid);

                if (tmpObj.health <= 0) {
                    if (!tmpObj.death) {
                        tmpObj.death = true;
                        if (tmpObj != player) {
                            ChText("", `${tmpObj.name} {${tmpObj.sid}} has died.`, "red");
                        }
                        addDeadPlayer(tmpObj);
                    }
                }
                let nearSpike = nearObjs.find(obj => ((obj.type == 1 && obj.y >= 12000) || (obj.dmg && !obj.isTeamObject(tmpObj))) && UTILS.getDist(obj, tmpObj, 0, 2) <= obj.getScale() + tmpObj.scale + 1);
                if (nearSpike && damaged == (nearSpike.dmg || 35) * (tmpObj.skinIndex == 6 ? 0.75 : 1)) tmpObj.hitSpike = nearSpike.dmg || 35;
                if (damaged == 5 * (tmpObj.skinIndex == 6 ? 0.75 : 1)) {
                    my.bullTick = game.tick;
                    if (tmpObj.sid == player.sid) {
                        tmpObj.needTick = 0;
                        if (my.reSync) {
                            my.reSync = false;
                        }
                        if (tmpObj.skinIndex == 7) {
                            bullTicked = true;
                        } else {
                            tmpObj.poisonCounter--;
                        }
                    }
                }
                if (tmpObj.sid == player.sid) {
                    if (inGame) {
                        let shame = (near.primaryIndex == 5 && [undefined, 9, 12, 13, 15].includes(near.secondaryIndex)) ? 6 : [7, 8].includes(near.primaryIndex) ? 3 : 5;
                        if (tmpObj.hitSpike && (tmpObj.inTrap || tmpObj.lastTrap)) {
                            shame = 7;
                            tmpObj.addDamageThreat("spike", tmpObj.hitSpike);
                        }
                        let attackers = getAttacker(damaged);
                        let maxHealth = player.maxHealth
                        let dmg = maxHealth - player.health;

                        let bullTickDmg = 5;
                        let damageIfSoldier = tmpObj.damageSources.totalSoldier;
                        if (dmg + tmpObj.damageSources.totalNoSoldier >= maxHealth && dmg + damageIfSoldier < maxHealth) {
                            my.forceStop = true;
                        }
                        if (attackers.some(near => [undefined, 9, 12, 13, 15].includes(near.secondaryIndex))) {
                            if ([18.75, 22.5, 25, 26.25, 30, 35, 37.5, 50].includes(damaged) && dmg + damageIfSoldier >= maxHealth) {
                                //they are reverse instaing us
                                if (tmpObj.shameCount < shame) {
                                    healer();
                                    my.healed = true;
                                }
                            } else if (damaged > 39 && damaged < 80 && dmg + damageIfSoldier >= maxHealth) {
                                if (tmpObj.damageSources.turret && game.tick - tmpObj.antiTimer > 1) {
                                    tmpObj.empAnti = true;
                                    tmpObj.antiTimer = game.tick;
                                    tmpObj.removeDamageThreat("turret", 25); //this updates the damageThreat stuff
                                }
                                //btw we updated the damageSources stuff but not the damageIfSoldier variable so need to use tmpObj.damageSources.whatever
                                if (tmpObj.shameCount < shame && (dmg + (tmpObj.empAnti ? tmpObj.damageSources.totalNoSoldier : tmpObj.damageSources.totalSoldier)) >= maxHealth) {
                                    //if we need to fast heal, no point emp antiing
                                    tmpObj.empAnti = false;
                                    healer();
                                    my.healed = true;
                                }
                            } else if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
                                if (tmpObj.shameCount < shame) {
                                    healer();
                                    my.healed = true;
                                }
                            }
                        } else {
                            if (damaged > bullTickDmg && dmg + damageIfSoldier >= maxHealth) {
                                if (tmpObj.shameCount < shame) {
                                    healer();
                                    my.healed = true;
                                }
                            }
                        }
                        if (damaged >= 20 && player.skinIndex == 11 && attackers.length && near.weaponIndex != near.secondaryIndex) instaC.canCounter = true;
                    }
                }
            });
            advHeal = [];
        }
        players.forEach((tmp) => {
            if (!tmp.visible && player != tmp) {
                tmp.reloads = {
                    0: 0,
                    1: 0,
                    2: 0,
                    3: 0,
                    4: 0,
                    5: 0,
                    6: 0,
                    7: 0,
                    8: 0,
                    9: 0,
                    10: 0,
                    11: 0,
                    12: 0,
                    13: 0,
                    14: 0,
                    15: 0,
                    53: 0,
                };
                tmp.primaryReloaded = true;
                tmp.secondaryReloaded = true;
            }
        });
        if (inGame) {
            if (enemy.length) {
                //place first to get the useless aim out
                traps.preplaces[0] = [];
                traps.preplaces[1] = [];
                if (my.autoPush) {
                    if (near.dist2 <= 169) {
                        traps.autoPlace(0, 2, 4);
                    } else if (near.dist2 > 222) {
                        traps.autoPlace(0, 4, 2);
                    }
                } else {
                    if (near.dist2 <= 222) {
                        if (near.inTrap) {
                            traps.autoPlace(0, 2, 4)
                        } else if (near.escaped) {
                            traps.autoPlace(0, 4, 2);
                        } else {
                            traps.autoPlace(1, 2, 4, true);
                        }
                    } else {
                        if (near.dist2 > 269 && near.dist2 < 400) {
                            traps.autoPlace(0, 4, 2);
                        } else if (near.dist2 <= 269) {
                            traps.autoPlace(1, 4, 2, true);
                        }
                    }
                }
                if (!instaC.isTrue && configs.spikeTick && player.weapons[0] != 8 && player.tailIndex != 11) {
                    if (near.inTrap && near.hitSpike) {
                        let nearReload = near.reloads[near.secondaryIndex == 10 ? near.secondaryIndex : near.primaryIndex];
                        if (items.weapons[player.weapons[0]].speed < nearReload || nearReload < ping.min) {
                            instaC.canSpikeTick = true;
                        }
                    }
                }
                if (configs.anti1tick) {
                    //this works even if the second nearest person is one ticking you
                    enemy.forEach((tmpObj) => {
                        if (tmpObj.primaryIndex == 5 && tmpObj.primaryVariant >= 2) {
                            if (tmpObj.dist2 >= 169 && tmpObj.dist2 <= 269) {
                                if (tmpObj.skinIndex == 53) {
                                    my.anti0Tick = 2;
                                    predictHeal(1)
                                    player.chat.message = `Anti 1 tick by ${tmpObj.sid} ${tmpObj.name}`
                                    player.chat.count = 334;
                                }
                            }
                        }
                    })
                }
                //auto q when they havve short sword, katana, polearm
                if (nears.length > 1 && nears.some(tmpObj => [undefined, 3, 4, 5].includes(tmpObj.primaryIndex)) && secPacket < 60) {
                    if (configs.autoQonSync && player.shameCount < 5) {
                        my.anti0Tick = 1;
                        predictHeal(2);
                        player.chat.message = `sync detect test`;
                        player.chat.count = 112;
                    }
                }
                if (configs.serverSync && syncersInServer.length && nears.length) {
                    nears.forEach((tmpObj) => {
                        syncersInServer.forEach((sid) => {
                            if (tmpObj.sid == sid) return;
                            let myDist = tmpObj.dist3;
                            let syncer = findPlayerBySID(sid);
                            if (!syncer) return;
                            let syncerDist = UTILS.getDist(syncer, tmpObj, 3, 3)
                            if (myDist <= player.scale * 1.8 + items.weapons[player.weapons[0]].range && syncerDist <= player.scale * 1.8 + items.weapons[syncer.primaryIndex || 5].range && player.primaryReloaded && syncer.primaryReloaded) {
                                instaC.spikeTickType();
                            }
                        })
                    })
                }
                if (!instaC.isTrue && configs.predictTick && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && !near.inTrap && player.tailIndex != 11) { //OMG KNOCK BACK PREDICTION TO KILL EVERYONE WITH SPIKE SYNC CUZ NO ONE HAS ANTI
                    let spikeSync = knockBackPredict();
                    if (spikeSync == "insta them" && (![9, 12, 13, 15].includes(player.weapons[1]) || near.dist2 <= items.weapons[player.weapons[1]].range + player.scale * 1.8)) {
                        instaC.changeType("rev");
                    }
                    if (spikeSync == "primary sync") {
                        instaC.spikeTickType("rev")
                    }
                    let prehit = nearObjs.filter(tmp => tmp.dmg && tmp.isTeamObject(player) && UTILS.getDist(tmp, near, 0, 3) <= (tmp.scale + near.scale)).sort(function (a, b) {
                        return UTILS.getDist(a, near, 0, 2) - UTILS.getDist(b, near, 0, 2);
                    })[0];
                    if (prehit) {
                        if (near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                            instaC.canSpikeTick = true;
                        }
                    }
                }
                tryAutoPush();
                if (!my.autoPush && !debugStop && !player.inTrap) {
                    if (configs.autoPlay && enemy.length && near.dist2 < PF.scale / 2) {
                        let result = createPath.calc({ x: Math.cos(near.aim2 + Math.PI / 2) * (near.scale * 2), y: Math.sin(near.aim2 + Math.PI / 2) * (near.scale * 2) }, false, "follow");
                        PF.paths = result.paths;
                        PF.attempts = result.attempts;
                        if (PF.paths.length > 0) {
                            PF.finded = true;
                            //  player.lastStop.active = false;
                            let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                            packet("9", dir, 1);
                        } else {
                            result = createPath.calc({ x: 0, y: 0 }, true, "follow");
                            PF.paths = result.paths;
                            PF.attempts = result.attempts;
                            if (PF.paths.length > 0) {
                                PF.finded = true;
                                // player.lastStop.active = false;
                                let dir = UTILS.getDirect(PF.paths[1], player, 0, 2);
                                packet("9", dir, 1);
                            } else {
                                PF.finded = false;
                                packet("9", player.moveDir, 1)
                            }
                        }
                    } else {
                        PF.finded = false;
                    }
                } else {
                    PF.finded = false;
                }
                if (configs.breakAroundSwitch) {
                    if (near.inTrap) {
                        let objs = nearObjs.filter(e => UTILS.getDist(e, near.inTrap, 0, 0) < 200 && !(e.dmg && e.isTeamObject(player)) && e.sid != near.inTrap.sid);
                        objs.forEach(obj => {
                            if (!autoBreak.priority[1].includes(obj)) {
                                autoBreak.priority[1].push(obj);
                            }
                        });
                    }
                }
            } else {
                my.autoPush = false;
                PF.active = false;
                PF.finded = false;
            }
            if (near.dist2 <= items.weapons[player.weapons[1] == 10 ? player.weapons[1] : player.weapons[0]].range + near.scale * 1.8 && instaC.wait && !instaC.isTrue && !my.waitHit && player.primaryReloaded && player.secondaryReloaded && instaC.perfCheck(player, near)) {
                instaC.can = true;
            } else {
                instaC.can = false;
            }
            macro.q && place(0, getAttackDir());
            macro.f && place(4, getSafeDir());
            macro.v && place(2, getSafeDir());
            macro.y && place(5, getSafeDir());
            macro.h && place(player.getItemType(22), getSafeDir());
            macro.n && place(3, getSafeDir());
            if (macro.g) { //this for testing stuff in the future no use rn
                //let angles = autoPlace.closestPossibleAngles(nearObjs.sort((a, b) => UTILS.getDist(a, player, 0, 2) - UTILS.getDist(b, player, 0, 2))[0], 2)
                //place(2, angles[0])
                //autoPlace.debugRender[50] = [angles];
                if (!autoPlace.rangesUpdated[2]) autoPlace.angleRanges(2);
                console.log(autoPlace.ranges[2]);

                autoPlace.debugRender[50] = autoPlace.ranges[2];
            } else {
                autoPlace.debugRender = {};
            }
            if (macro.l) {
                if (targetPlayer) {
                    //if (!configs.hatType || options.hatType != "ag") {
                        packet("9", targetPlayer.aim2, 1);
                        if (targetPlayer.dist2 > 225) {
                            if (player.items[4] == 16) {
                                place(4, targetPlayer.aim2);
                            }
                        } else {
                            const j = (targetPlayer.dist2 <= 75 ? 82.5 : 78.7135) * (Math.PI / 180);
                            for (let e = -1; e <= 1; e++) {
                                checkPlace(2, (targetPlayer.dist2 <= 75 ? targetPlayer.aim2 : targetPlayer.aim2 + Math.PI) + e * j);
                            }
                            if (targetPlayer.dist2 <= 75) {
                                checkPlace(2, targetPlayer.aim2 + Math.PI);
                            }
                        }
                    //}
                }
            }
            sendMoveDir();
            if (mills.place) {
                let item = items.list[player.items[3]];
                if (UTILS.getDist(mills.old, player, 0, 2) >= (item.scale * 2 + 6) && !isNaN(wasdDir)) {
                    let dir = wasdDir + Math.PI;
                    if (macro.f && player.items[4] == 16) {
                        place(3, dir + 1.4);
                        place(3, dir - 1.4);
                    } else {
                        let tmpS = player.scale + item.scale + (items.list[player.items[3]].placeOffset || 0);
                        let tmpX = player.x2 + tmpS * Math.cos(dir);
                        let tmpY = player.y2 + tmpS * Math.sin(dir);
                        let otherAngles = autoPlace.closestPossibleAngles({ x: tmpX, y: tmpY, getScale: function () { return item.scale } }, 3);
                        place(3, dir);
                        place(3, otherAngles[0]);
                        place(3, otherAngles[1]);
                    }
                    mills.old = {
                        x: player.x2,
                        y: player.y2
                    }
                    sendAtck(0, getAttackDir())
                }
            }
            /*
            if (mills.placeSpawnPads) {
                if (UTILS.getDist(mills.old, player, 0, 2) > mills.spawnDist) {
                    traps.testCanPlace(player.getItemType(20), 0, Math.PI * 1.5, Math.PI / 2, UTILS.getDirect(mills.old, player, 0, 2), true)
                    mills.old = {
                        x: player.x2,
                        y: player.y2
                    }
                }
            }*/
            if (mills.placeSpawnPads && !isNaN(wasdDir)) {
                let item = items.list[player.items[player.getItemType(20)]];
                let CanPlace = false;
                for (let angle = -Math.PI / 2; angle <= Math.PI / 2; angle += Math.PI) {
                    let testAngle = wasdDir + angle;
                    let tmpS = player.scale + item.scale + (item.placeOffset || 0);
                    let tmpX = player.x2 + tmpS * Math.cos(testAngle);
                    let tmpY = player.y2 + tmpS * Math.sin(testAngle);
                    if (objectManager.checkItemLocation(tmpX, tmpY, item.scale, 0.6, item.id, false)) {
                        CanPlace = true;
                    }
                }
                if (CanPlace) {
                    traps.testCanPlace(player.getItemType(20), 0, Math.PI * 2, Math.PI / 2, wasdDir)
                }
            }
            if (instaC.can && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && secPacket < 69) {
                instaC.changeType((configs.revInsta || player.weapons[1] == 10) ? "rev" : "normal");
            }
            if (instaC.canCounter && my.anti0Tick <= 0 && secPacket < 69) {
                instaC.canCounter = false;
                if (player.primaryReloaded && !instaC.isTrue) {
                    instaC.counterType();
                }
            }
            if (instaC.canSpikeTick && my.anti0Tick <= 0 && !player.empAnti && !my.forceStop && secPacket < 69) {
                instaC.canSpikeTick = false;
                if (player.primaryReloaded && !instaC.isTrue && near.dist2 <= items.weapons[player.weapons[0]].range + player.scale * 1.8) {
                    instaC.spikeTickType();
                }
            }
            if (instaC.canMusketSync) {
                instaC.canMusketSync = false;
                if (player.secondaryReloaded && !instaC.isTrue) {
                    instaC.musketSync();
                }
            }
            autoBreak.calculateAim();
            if (player.empAnti || my.forceStop) {
                if (my.autoGathering) {
                    sendAutoGather();
                }
            } else {
                if (!clicks.middle && !clicks.left && !clicks.right && !instaC.isTrue && !autoBreak.active && my.autoGathering) {
                    sendAutoGather();
                }
                if (!clicks.middle && (clicks.left || clicks.right) && !instaC.isTrue) {
                    if ((player.weaponIndex != (clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0])) || player.buildIndex > -1) {
                        selectWeapon(clicks.right && autoBreak.useHammer() ? player.weapons[1] : player.weapons[0]);
                    }
                    if (player[(clicks.right && autoBreak.useHammer() ? "secondary" : "primary") + "Reloaded"] && !my.waitHit && !my.autoGathering) {
                        sendAutoGather();
                        my.waitHit = 1;
                        game.tickBase(() => {
                            my.waitHit = 0
                        }, 1)
                    }
                }
                if (autoBreak.active) {
                    if (!clicks.left && !clicks.right && !instaC.isTrue) {
                        let weapon = autoBreak.useHammer(autoBreak.target) ? player.weapons[1] : player.weapons[0];
                        if (player.weaponIndex != weapon || player.buildIndex > -1) {
                            selectWeapon(weapon);
                        }
                        if (player[(weapon < 9 ? "primary" : "secondary") + "Reloaded"] && !my.waitHit && !my.autoGathering) {
                            sendAutoGather();
                            my.waitHit = 1;
                            game.tickBase(() => {
                                my.waitHit = 0;
                            }, 1)
                        }
                    }
                }
            }
            if (clicks.middle && !player.inTrap) {
                if (!instaC.isTrue && player.secondaryReloaded) {
                    if (my.ageInsta && player.weapons[0] != 4 && player.weapons[1] == 9 && player.age >= 9 && enemy.length) {
                        if (!targetPlayer?.visible) {
                            targetPlayer = enemy.sort((a, b) => UTILS.getDist(a, mousePos, 2, 0) - UTILS.getDist(b, mousePos, 2, 0))[0];
                        }
                        instaC.bowMovement();
                    } else {
                        targetPlayer = enemy.sort((a, b) => UTILS.getDist(a, mousePos, 2, 0) - UTILS.getDist(b, mousePos, 2, 0))[0];
                        instaC.rangeType();
                    }
                }
            }
            if (macro.t && !player.inTrap) {
                if (!instaC.isTrue && player.primaryReloaded && (player.weapons[1] != 15 || player.secondaryReloaded) && (player.weapons[0] == 5 || (player.weapons[0] == 4 && player.weapons[1] == 15))) {
                    instaC[getEl("button2").checked ? "newTickMovement" : "tickMovement"]();
                }
            }
            if (!macro.t && !instaC.isTrue && instaC.ticking) {
                instaC.ticking = false;
            }
            if (macro["."] && !player.inTrap) {
                if (!instaC.isTrue && player.primaryReloaded && (![9, 12, 13, 15].includes(player.weapons[1]) || player.secondaryReloaded)) {
                    instaC["boostTickMovement"]();
                }
            }
            if (player.weapons[1] && !clicks.left && !clicks.right && !player.inTrap && !instaC.isTrue && !autoBreak.active) {
                if (player.primaryReloaded && player.secondaryReloaded) {
                    if (!my.reloaded) {
                        my.reloaded = true;
                        let fastSpeed = items.weapons[player.weapons[0]].spdMult < items.weapons[player.weapons[1]].spdMult ? 1 : 0;
                        if (player.weaponIndex != player.weapons[fastSpeed] || player.buildIndex > -1) {
                            selectWeapon(player.weapons[fastSpeed]);
                        }
                    }
                } else {
                    my.reloaded = false;
                    if (optimisingAutoReloadFunction(player.weapons[0])) {
                        if (optimisingAutoReloadFunction_2(player.weapons[0])) {
                            selectWeapon(player.weapons[0]);
                        }
                    } else if (optimisingAutoReloadFunction(player.weapons[1])) {
                        if (optimisingAutoReloadFunction_2(player.weapons[1])) {
                            selectWeapon(player.weapons[1]);
                        }
                    }
                }
            }
            if (storeMenu.style.display != "block" && !instaC.isTrue && !instaC.ticking) {
                hatChanger();
                accChanger();
            }
            if (configs.autoPrePlace) {
                autoPlace.preplaceRanges = {};
                preplacer();
            }
            if (playersJoining.length && game.tick % 10 == 0 && configs.autoAccept) {
                packet("P", playersJoining[0], 1)
                UTILS.removeAllChildren(notificationDisplay)
            }
            instaC.syncHit = false;
            autoBreak.priority = [[], [], [], []];
            my.anti0Tick--;
            if (configs.weaponGrind) {
                traps.testCanPlace(player.getItemType(22), 0, Math.PI * 2, Math.PI / 2, 0, false, true, 3)
            }
            traps.replaced = false;
        }
    }
    if (textManager.stack.length) {
        let stacks = [];
        let notstacks = [];
        let num = 0;
        let num2 = 0;
        let pos = {
            x: null,
            y: null
        };
        let pos2 = {
            x: null,
            y: null
        }
        textManager.stack.forEach((text) => {
            if (text.value >= 0) {
                if (num == 0) pos = {
                    x: text.x,
                    y: text.y
                };
                num += Math.abs(text.value);
            } else {
                if (num2 == 0) pos2 = {
                    x: text.x,
                    y: text.y
                };
                num2 += Math.abs(text.value);
            }
        });
        if (num2 > 0) {
            textManager.showText(pos2.x, pos2.y, Math.max(45, Math.min(50, num2)), 0.18, 500, num2, "#8ecc51");
        }
        if (num > 0) {
            textManager.showText(pos.x, pos.y, Math.max(45, Math.min(50, num)), 0.18, 500, num, "#fff");
        }
        textManager.stack = [];
    }
}

// UPDATE LEADERBOARD:
let leaderboardElement = document.getElementById('leaderboard');
let textNode = leaderboardElement.firstChild;
if (textNode.nodeType === 3 && textNode.textContent === 'Leaderboard') {
    leaderboardElement.removeChild(textNode);
}
function updateLeaderboard(data) {
    lastLeaderboardData = data;
    UTILS.removeAllChildren(leaderboardData);
    let tmpC = 1;
    let maxScore = data[2];

    for (let i = 0; i < data.length; i += 3) {
        (function (i) {
            let score = data[i + 2];
            let percentage = (score / maxScore) * 100;

            let leaderHolder = document.createElement("div");
            leaderHolder.className = "leaderHolder";
            leaderHolder.style = `
                background-color: rgba(0, 0, 0, 0.45);
                height: 20px;
                border-radius: 5px;
                margin-bottom: 5px;
            `;
            leaderboardData.appendChild(leaderHolder);
            let sid = data[i]

            let leaderboardItem = document.createElement("div");
            leaderboardItem.className = "leaderboardItem";
            leaderboardItem.style = `
                color: ${sid == player.sid ? "#fffb95" : syncersInServer.includes(sid) ? "#FF0000" : playersInServer.includes(sid) ? "#00ff00" : "#fff"};
            `;
            leaderboardItem.textContent = `${data[i + 1]}: ${UTILS.sFormat(score) || "0"}`;
            leaderHolder.appendChild(leaderboardItem);

            let leaderProsBar = document.createElement("div");
            leaderProsBar.id = `leaderProsBar-${data[i]}`;
            leaderProsBar.className = "leaderProgressBar";
            leaderProsBar.style = `
                margin-bottom: 5px;
                display: block;
                height: 20px;
                border-radius: 5px;
                background-color: #94e484;
                width: ${percentage}% ;
                transition: width 0.5s ease-in-out;
            `;
            leaderHolder.appendChild(leaderProsBar);
            if (leaderProsBar.style.width) {
                let currentWidth = parseFloat(leaderProsBar.style.width);
                let newWidth = `${percentage}%`;
                leaderProsBar.style.width = newWidth;
            } else {
                leaderProsBar.style.width = `${percentage}%`;
            }
        })(i);
        tmpC++;
    }
}

// LOAD GAME OBJECT:
function loadGameObject(data) {
    for (let i = 0; i < data.length;) {
        objectManager.add(data[i], data[i + 1], data[i + 2], data[i + 3], data[i + 4],
            data[i + 5], items.list[data[i + 6]], true, (data[i + 7] >= 0 ? {
                sid: data[i + 7]
            } : null));
        // sid, x, y, dir, s, type, data, setSID, owner
        /*let dist = UTILS.getDist({
                x: data[i + 1],
                y: data[i + 2]
            }, player, 0, 2);
            let aim = UTILS.getDirect({
                x: data[i + 1],
                y: data[i + 2]
            }, player, 0, 2);
            find = findObjectBySid(data[i]);
            if (data[i + 6] == 15) {
                if (find && !find.isTeamObject(player)) {
                    if (dist <= 100) {
                        traps.dist = dist;
                        traps.aim = aim;
                        traps.protect(aim);
                    }
                }
            }*/
        i += 8;
    }
}

// ADD AI:
let lastDist = null;
let lastAgentDir = null;
function normCoord(val) {
    return (val / 14400) - 1; // transforms 0..14400 -> -1..1
}
let skinCounter = {
    11: 0.45,
}
let tailCounter = {
    16: 0.15,
    21: 0.25
}

let lastTick = 0;

function getCounter(skinIndex, tailIndex) {
    const skin = skinCounter[skinIndex];
    const tail = tailCounter[tailIndex];

    if (skin != null && tail != null) return skin + tail;
    if (skin != null) return skin + 0.25;
    if (tail != null) return tail + 0.45;
    return 0.45;
}

function loadAI(data) {
    if (!my.healed && player.health < player.maxHealth) {
        if (player.empAnti && sent.hat != 22) {
            player.addDamageThreat("turret", 25);
        }
        if (my.autoGathering) {
            nears.forEach((e) => {
                if (UTILS.getAngleDist(getAttackDir(), e.aim2) <= config.gatherAngle && e.dist2 <= items.weapons[player.weaponIndex].range + player.scale * 1.8) {
                    player.addDamageThreat("counter", items.weapons[sent.weapon||player.weaponIndex].dmg * (sent.hat == 7 ? 1.5 : 1) * (sent.tail == 11 ? 0.2 : 1) * getCounter(e.skinIndex, e.tailIndex));
                }
            })
            /*if (damageThreat >= player.maxHealth && player.damageSources.counter) {
                sendAutoGather();
                player.removeDamageThreat("counter");
            }*/
        }
        let damageThreat = (sent.hat == 6 ? player.damageSources.totalSoldier : player.damageSources.totalNoSoldier);
        if (player.health <= damageThreat && player.shameCount <= 5) {
            healer();
            my.healed = true;
        }
    }
    for (let i = 0; i < ais.length; ++i) {
        ais[i].forcePos = !ais[i].visible;
        ais[i].visible = false;
    }
    if (data) {
        let tmpTime = performance.now();
        for (let i = 0; i < data.length;) {
            tmpObj = findAIBySID(data[i]);
            if (tmpObj) {
                tmpObj.index = data[i + 1];
                tmpObj.t1 = (tmpObj.t2 === undefined) ? tmpTime : tmpObj.t2;
                tmpObj.t2 = tmpTime;
                tmpObj.x1 = tmpObj.x;
                tmpObj.y1 = tmpObj.y;
                tmpObj.x2 = data[i + 2];
                tmpObj.y2 = data[i + 3];
                tmpObj.d1 = (tmpObj.d2 === undefined) ? data[i + 4] : tmpObj.d2;
                tmpObj.d2 = data[i + 4];
                tmpObj.health = data[i + 5];
                tmpObj.dt = 0;
                tmpObj.visible = true;
            } else {
                tmpObj = aiManager.spawn(data[i + 2], data[i + 3], data[i + 4], data[i + 1]);
                tmpObj.x2 = tmpObj.x;
                tmpObj.y2 = tmpObj.y;
                tmpObj.d2 = tmpObj.dir;
                tmpObj.health = data[i + 5];
                if (!aiManager.aiTypes[data[i + 1]].name) tmpObj.name = config.cowNames[data[i + 6]];
                tmpObj.forcePos = true;
                tmpObj.sid = data[i];
                tmpObj.visible = true;
            }
            tmpObj.update();
            i += 7;
        }
    }
    if (!macro.q && !macro.f && !macro.v && !macro.h && !macro.n) {
        packet("D", getAttackDir());
    }
    player.empAnti = false;
    autoPlace.rangesUpdated = {};
    sent = { hat: null, tail: null, weapon: null };
    my.forceStop = false;
    my.healed = false;
}


// ANIMATE AI:
function animateAI(sid) {
    tmpObj = findAIBySID(sid);
    if (tmpObj) {
        tmpObj.startAnim();
        let tmpObjects = objectManager.hitObj;
        if (tmpObjects.length) {
            objectManager.hitObj = [];
            let dmg = tmpObj.dmg * 5;
            game.tickBase(() => {
                tmpObjects.forEach((healthy) => {
                    healthy.health -= dmg;
                });
            }, 1);
        }
    }
}

// GATHER ANIMATION:
function gatherAnimation(sid, didHit, index) {
    let tmpObj = findPlayerBySID(sid);
    if (tmpObj) {
        tmpObj.startAnim(didHit, index);
        tmpObj.gatherIndex = index;
        tmpObj.gathering = 1;
        tmpObj.noMovTimer = 0;
        if (didHit) {
            let tmpObjects = objectManager.hitObj;
            objectManager.hitObj = [];
            let weaponXP = (items.weapons[index].gather || 1) + 4;
            game.tickBase(() => {
                let val = items.weapons[index].dmg * (config.weaponVariants[tmpObj[(index < 9 ? "prima" : "seconda") + "ryVariant"]].val) * (items.weapons[index].sDmg || 1) * (tmpObj.skinIndex == 40 ? 3.3 : 1);
                tmpObjects.forEach((healthy) => {
                    if (healthy.health) {
                        healthy.health -= val;
                    } else if (healthy.type == 3 && tmpObj.sid == player.sid) {
                        player.weaponXP[index] = (player.weaponXP[index] || 0) + weaponXP;
                        updateWeaponXPBars();
                    }
                });
            }, 1);
        }
    }
}

// WIGGLE GAME OBJECT:
function wiggleGameObject(dir, sid) {
    tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir);
        //tmpObj.damaged = Math.min(255, tmpObj.damaged + 60);
        objectManager.hitObj.push(tmpObj);
    }
}

// SHOOT TURRET:
function shootTurret(sid, dir) {
    tmpObj = findObjectBySid(sid);
    if (tmpObj) {
        if (config.anotherVisual) {
            tmpObj.lastDir = dir;
        } else {
            tmpObj.dir = dir;
        }
        tmpObj.xWiggle += config.gatherWiggle * Math.cos(dir + Math.PI);
        tmpObj.yWiggle += config.gatherWiggle * Math.sin(dir + Math.PI);
        tmpObj.reloads = tmpObj.shootRate;
    }
}

// UPDATE PLAYER VALUE:
function updatePlayerValue(index, value, updateView) {
    if (player) {
        let diff = value - player[index];
        player[index] = value;
        if (index == "points") {
            if (configs.autoBuy) {
                autoBuy.buyNext();
            }
        } else if (index == "kills") {
            if (configs.killChat) {
                sendChat("Wackky-Backky v4.20");
            }
        } else {
            if (diff > 0) {
                game.tickBase(() => {
                    player.weaponXP[player.weaponIndex] = (player.weaponXP[player.weaponIndex] || 0) + diff;
                    updateWeaponXPBars();
                }, 1)
            }
            player[index] = value;
        }
    }
}

// ACTION BAR:
function updateItems(data, wpn) {
    if (data) {
        if (wpn) {
            player.weapons = data;
            player.primaryIndex = player.weapons[0];
            player.secondaryIndex = player.weapons[1];
            if (!instaC.isTrue) {
                selectWeapon((player.weaponIndex < 9 || [9, 12, 13, 15].includes(player.secondaryIndex)) ? player.primaryIndex : player.secondaryIndex);
            }
        } else {
            player.items = data;
        }
    }
    for (let i = 0; i < items.list.length; i++) {
        let tmpI = items.weapons.length + i;
        getEl("actionBarItem" + tmpI).style.display = player.items.indexOf(items.list[i].id) >= 0 ? "inline-block" : "none";
    }
    for (let i = 0; i < items.weapons.length; i++) {
        getEl("actionBarItem" + i).style.display = player.weapons[items.weapons[i].type] == items.weapons[i].id ? "inline-block" : "none";
    }
}

// ADD PROJECTILE:
function addProjectile(x, y, dir, range, speed, indx, layer, sid) {
    projectileManager.addProjectile(x, y, dir, range, speed, indx, layer).sid = sid;
    projectileTick.push(Array.prototype.slice.call(arguments));
}

// REMOVE PROJECTILE:
function remProjectile(sid, range) {
    for (let i = 0; i < projectiles.length; ++i) {
        if (projectiles[i].sid == sid) {
            projectiles[i].range = range;
            projectiles[i].r2 = range;
            let tmpObjects = objectManager.hitObj;
            objectManager.hitObj = [];
            game.tickBase(() => {
                let val = projectiles[i].dmg;
                tmpObjects.forEach((healthy) => {
                    if (healthy.projDmg) {
                        healthy.health -= val;
                    }
                });
            }, 1);
        }
    }
}

function serverShutdownNotice(time) {
    shutdownDisplay.innerHTML = `Server restarting in ${time}s`
}
// a new party is created
function addAlliance(data) {
    //console.log("addAlliance", data);
    // data = {sid: "nameOfParty", owner: sidOfOwner}
    // note nameOfParty will be 7 letters long, with blank bytes at the end if name is less than 7 letters
    alliances.push(data);
}

// a party is deleted
function deleteAlliance(sid) {
    //console.log("deleteAlliance", sid);
    alliances = alliances.filter(e => e.sid != sid);
}

let playersJoining = [];
let lastAcceptTime = 0;
// SHOW ALLIANCE MENU:
function allianceNotification(sid, name) {
    playersJoining.push(sid);
}

function setPlayerTeam(team, isOwner) {
    //console.log("setPlayerTeam", team, isOwner);
    if (player) {
        player.team = team;
        player.isOwner = isOwner;
        if (team == null || team == undefined) {
            alliancePlayers.length = 0;
        }
    }
}

function setAlliancePlayers(data) {
    // data = [sid1, name1, sid2, name2, ...]
    //console.log("setAlliancePlayers", data);
    alliancePlayers.length = 0;
    for (let i = 0; i < data.length; i += 2) {
        alliancePlayers.push(data[i])
    }
}

// STORE MENU:
function updateStoreItems(type, id, index) {
    if (index) {
        if (!type) {
            player.tails[id] = 1;
        } else {
            player.latestTail = id;
        }
    } else {
        if (!type) {
            player.skins[id] = 1
        } else {
            player.latestSkin = id;
        }
    }
}

// SEND MESSAGE:
function receiveChat(sid, message) {
    let tmpPlayer = findPlayerBySID(sid);
    if (tmpPlayer) {
        ChText(`${tmpPlayer.name} {${tmpPlayer.sid}}`, message, tmpPlayer == player || (tmpPlayer.team && tmpPlayer.team == player.team) ? "#8ecc51" : "#fff");
        tmpPlayer.chatMessage = message;
        tmpPlayer.chatCountdown = config.chatCountdown;
        /*if (tmpPlayer.team == player.team && message == getEl("testInput2").value) {
            instaC.canMusketSync = true;
        }*/
    }
}

// MINIMAP:
function updateMinimap(data) {
    minimapData = data;
}

// SHOW ANIM TEXT:
function showText(x, y, value, type) {
    textManager.showText(x, y, 50, 0.18, 500, Math.abs(value), (value >= 0) ? "#fff" : "#8ecc51");
}
function showSettingText(life, setting) {
    textManager.showText(player.x, player.y, player.scale, 0.1, life, setting, "#fff");
}


// RENDER LEAF:
function renderLeaf(x, y, l, r, ctxt) {
    let endX = x + (l * Math.cos(r));
    let endY = y + (l * Math.sin(r));
    let width = l * 0.4;
    ctxt.moveTo(x, y);
    ctxt.beginPath();
    ctxt.quadraticCurveTo(((x + endX) / 2) + (width * Math.cos(r + Math.PI / 2)),
        ((y + endY) / 2) + (width * Math.sin(r + Math.PI / 2)), endX, endY);
    ctxt.quadraticCurveTo(((x + endX) / 2) - (width * Math.cos(r + Math.PI / 2)),
        ((y + endY) / 2) - (width * Math.sin(r + Math.PI / 2)), x, y);
    ctxt.closePath();
    ctxt.fill();
    ctxt.stroke();
}
/*
            if (configs.autoPlay || my.autoPush) {
        mainContext.globalAlpha = 1;
        for (let i = 0; i < PF.paths.length; i++) {
            let path = PF.paths[i];

            let posX = path.x - xOffset;
            let posY = path.y - yOffset;

            mainContext.beginPath();
            mainContext.fillStyle = `rgb(${(i + 1) / PF.paths.length * 85}, ${(i + 1) / PF.paths.length * 127.5}, ${(i + 1) / PF.paths.length * 225})`;
            mainContext.arc(posX, posY, 10, 0, Math.PI*2);
            mainContext.fill();
        }
    }
    */
function renderPathFinder(ctx, offset) {
    try {
        if (PF.active) {
            ctx.lineWidth = 6;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.strokeStyle = "#00ffff";
            ctx.moveTo(player.x - offset.x, player.y - offset.y);
            for (let i = 0; i < PF.paths.length; i++) {
                let path = PF.paths[i];
                if (path) {
                    ctx.lineTo(path.x - offset.x, path.y - offset.y);
                }
            }
            ctx.stroke();
            if (my.pushData) {
                ctx.lineWidth = 6;
                ctx.beginPath();
                ctx.strokeStyle = "#fff";
                ctx.moveTo(PF.paths[PF.paths.length - 1].x - offset.x, PF.paths[PF.paths.length - 1].y - offset.y);
                ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
                ctx.stroke();
            }
        } else if (my.autoPush) {
            ctx.lineWidth = 6;
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.strokeStyle = "#fff";
            ctx.moveTo(player.x - offset.x, player.y - offset.y);
            ctx.lineTo(my.pushData.x2 - offset.x, my.pushData.y2 - offset.y);
            ctx.lineTo(my.pushData.x - offset.x, my.pushData.y - offset.y);
            ctx.stroke();
        } else if (PF.finded) {
            ctx.globalAlpha = 1;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.strokeStyle = "#00ffff";
            ctx.moveTo(player.x - offset.x, player.y - offset.y);
            for (let i = 0; i < PF.paths.length; i++) {
                let path = PF.paths[i];
                if (path) {
                    ctx.lineTo(path.x - offset.x, path.y - offset.y);
                }
            }
            ctx.stroke();
        }
    } catch (e) {
        console.error(e)
    };
}

// RENDER CIRCLE:
function renderCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) tmpContext.fill();
    if (!dontStroke) tmpContext.stroke();
}

function renderHealthCircle(x, y, scale, tmpContext, dontStroke, dontFill) {
    tmpContext = tmpContext || mainContext;
    tmpContext.beginPath();
    tmpContext.arc(x, y, scale, 0, 2 * Math.PI);
    if (!dontFill) tmpContext.fill();
    if (!dontStroke) tmpContext.stroke();
}

// RENDER STAR SHAPE:
function renderStar(ctxt, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    let x, y;
    let step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer);
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outer;
        y = Math.sin(rot) * outer;
        ctxt.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * inner;
        y = Math.sin(rot) * inner;
        ctxt.lineTo(x, y);
        rot += step;
    }
    ctxt.lineTo(0, -outer);
    ctxt.closePath();
}

function renderHealthStar(ctxt, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    let x, y;
    let step = Math.PI / spikes;
    ctxt.beginPath();
    ctxt.moveTo(0, -outer);
    for (let i = 0; i < spikes; i++) {
        x = Math.cos(rot) * outer;
        y = Math.sin(rot) * outer;
        ctxt.lineTo(x, y);
        rot += step;
        x = Math.cos(rot) * inner;
        y = Math.sin(rot) * inner;
        ctxt.lineTo(x, y);
        rot += step;
    }
    ctxt.lineTo(0, -outer);
    ctxt.closePath();
}

// RENDER RECTANGLE:
function renderRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
    if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
}

function renderHealthRect(x, y, w, h, ctxt, dontStroke, dontFill) {
    if (!dontFill) ctxt.fillRect(x - (w / 2), y - (h / 2), w, h);
    if (!dontStroke) ctxt.strokeRect(x - (w / 2), y - (h / 2), w, h);
}

// RENDER RECTCIRCLE:
function renderRectCircle(x, y, s, sw, seg, ctxt, dontStroke, dontFill) {
    ctxt.save();
    ctxt.translate(x, y);
    seg = Math.ceil(seg / 2);
    for (let i = 0; i < seg; i++) {
        renderRect(0, 0, s * 2, sw, ctxt, dontStroke, dontFill);
        ctxt.rotate(Math.PI / seg);
    }
    ctxt.restore();
}

// RENDER BLOB:
function renderBlob(ctxt, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    let x, y;
    let step = Math.PI / spikes;
    let tmpOuter;
    ctxt.beginPath();
    ctxt.moveTo(0, -inner);
    for (let i = 0; i < spikes; i++) {
        tmpOuter = UTILS.randInt(outer + 0.9, outer * 1.2);
        ctxt.quadraticCurveTo(Math.cos(rot + step) * tmpOuter, Math.sin(rot + step) * tmpOuter,
            Math.cos(rot + (step * 2)) * inner, Math.sin(rot + (step * 2)) * inner);
        rot += step * 2;
    }
    ctxt.lineTo(0, -inner);
    ctxt.closePath();
}

// RENDER TRIANGLE:
function renderTriangle(s, ctx) {
    ctx = ctx || mainContext;
    let h = s * (Math.sqrt(3) / 2);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(-s / 2, h / 2);
    ctx.lineTo(s / 2, h / 2);
    ctx.lineTo(0, -h / 2);
    ctx.fill();
    ctx.closePath();
}

// RENDER POLYGON:
function renderPolygon(mainContext, sides, diameter) {
    let lineWidth = mainContext.lineWidth || 0;
    let radius = diameter / 2;
    mainContext.beginPath();
    let angles = (Math.PI * 2) / sides;

    for (let index = 0; index < sides; index++) {
        let x = radius + (radius - lineWidth / 2) * Math.cos(angles * index);
        let y = radius + (radius - lineWidth / 2) * Math.sin(angles * index);
        mainContext.lineTo(x, y);
    }

    mainContext.closePath();
}

// PREPARE MENU BACKGROUND:
function prepareMenuBackground() {
    /*let tmpMid = config.mapScale / 2;
    objectManager.add(0, tmpMid, tmpMid + 200, 0, config.treeScales[3], 0);
    objectManager.add(1, tmpMid, tmpMid - 480, 0, config.treeScales[3], 0);
    objectManager.add(2, tmpMid + 300, tmpMid + 450, 0, config.treeScales[3], 0);
    objectManager.add(3, tmpMid - 950, tmpMid - 130, 0, config.treeScales[2], 0);
    objectManager.add(4, tmpMid - 750, tmpMid - 400, 0, config.treeScales[3], 0);
    objectManager.add(5, tmpMid - 700, tmpMid + 400, 0, config.treeScales[2], 0);
    objectManager.add(6, tmpMid + 800, tmpMid - 200, 0, config.treeScales[3], 0);
    objectManager.add(7, tmpMid - 260, tmpMid + 340, 0, config.bushScales[3], 1);
    objectManager.add(8, tmpMid + 760, tmpMid + 310, 0, config.bushScales[3], 1);
    objectManager.add(9, tmpMid - 800, tmpMid + 100, 0, config.bushScales[3], 1);
    objectManager.add(10, tmpMid - 800, tmpMid + 300, 0, items.list[4].scale, items.list[4].id, items.list[10]);
    objectManager.add(11, tmpMid + 650, tmpMid - 390, 0, items.list[4].scale, items.list[4].id, items.list[10]);
    objectManager.add(12, tmpMid - 400, tmpMid - 450, 0, config.rockScales[2], 2);*/
}
const speed = 35;

// RENDER PLAYERS:
function renderDeadPlayers(xOffset, yOffset) {
    mainContext.fillStyle = "#91b2db";
    deadPlayers.filter(dead => dead.active).forEach((dead) => {
        dead.animate(delta);

        mainContext.globalAlpha = dead.alpha;
        mainContext.strokeStyle = outlineColor;

        mainContext.save();
        mainContext.translate(dead.x - xOffset, dead.y - yOffset);

        // RENDER PLAYER:
        mainContext.rotate(dead.dir);
        mainContext.scale(dead.visScale / dead.scale, dead.visScale / dead.scale);
        renderDeadPlayer(dead, mainContext);
        mainContext.restore();

        mainContext.font = "20px Ubuntu";
        let tmpSize = mainContext.measureText("imagine using fixed mod L");
        let tmpH = 60;
        let tmpW = tmpSize.width + 10;
        mainContext.textBaseline = "middle";
        mainContext.textAlign = "center";

        mainContext.fillStyle = "#ccc";
        mainContext.strokeStyle = "#999";
        mainContext.roundRect(dead.x - xOffset - (tmpW / 2), dead.y - yOffset - (tmpH / 2) + (dead.scale * 1.5), tmpW, tmpH, 6);
        mainContext.fill();
        mainContext.stroke();

        mainContext.fillStyle = "#fff";
        mainContext.strokeStyle = "#000";
        mainContext.strokeText("disney", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
        mainContext.fillText("fixed", dead.x - xOffset, dead.y + (dead.scale * 1.5) - yOffset);
        mainContext.strokeText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);
        mainContext.fillText(dead.name, dead.x - xOffset, dead.y + (dead.scale * 1.5) + 20 - yOffset);

        // same color in bundle
        mainContext.fillStyle = "#91b2db";

    });
}
// RENDER PLAYERS:
function renderPlayers(xOffset, yOffset, zIndex) {
    mainContext.globalAlpha = 1;
    mainContext.fillStyle = "#91b2db";
    for (let i = 0; i < players.length; ++i) {
        tmpObj = players[i];
        if (tmpObj.zIndex == zIndex) {
            tmpObj.animate(delta);
            if (tmpObj.visible) {
                tmpObj.skinRot += (0.002 * delta);
                tmpDir = (!options.renderDir == "showDir" && tmpObj.sid == player.sid) ? options.renderDir == "attackDir" ? getVisualDir() : getSafeDir() : (tmpObj.dir || 0);
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);

                // RENDER PLAYER:
                mainContext.rotate(tmpDir + tmpObj.dirPlus);
                renderPlayer(tmpObj, mainContext);
                mainContext.restore();
            }
        }
    }
}

// RENDER DEAD PLAYER:
function renderDeadPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";
    let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
    let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
    let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

    // WEAPON BELLOW HANDS:
    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // HANDS:
    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
    renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
        (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

    // WEAPON ABOVE HANDS:
    if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // BUILD ITEM:
    if (obj.buildIndex >= 0) {
        let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
    }

    // BODY:
    renderCircle(0, 0, obj.scale, ctxt);

    ctxt.lineWidth = 2;
    ctxt.fillStyle = "#555";
    ctxt.font = "35px Hammersmith One";
    ctxt.textBaseline = "middle";
    ctxt.textAlign = "center";

    ctxt.fillText("(", 20, 5);

    ctxt.rotate(Math.PI / 2);
    ctxt.font = "30px Hammersmith One";
    ctxt.fillText("X", -15, 15 / 2);
    ctxt.fillText("D", 15, 15 / 2);

}

// RENDER PLAYER:
function renderPlayer(obj, ctxt) {
    ctxt = ctxt || mainContext;
    ctxt.lineWidth = outlineWidth;
    ctxt.lineJoin = "miter";
    let handAngle = (Math.PI / 4) * (items.weapons[obj.weaponIndex].armS || 1);
    let oHandAngle = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndS || 1) : 1;
    let oHandDist = (obj.buildIndex < 0) ? (items.weapons[obj.weaponIndex].hndD || 1) : 1;

    let katanaMusket = (obj == players && obj.weapons[0] == 3 && obj.weapons[1] == 15);

    // TAIL/CAPE:
    if (obj.tailIndex > 0) {
        renderTail(obj.tailIndex, ctxt, obj);
    }

    // WEAPON BELLOW HANDS:
    if (obj.buildIndex < 0 && !items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[katanaMusket ? 4 : obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // HANDS:
    ctxt.fillStyle = config.skinColors[obj.skinColor];
    renderCircle(obj.scale * Math.cos(handAngle), (obj.scale * Math.sin(handAngle)), 14);
    renderCircle((obj.scale * oHandDist) * Math.cos(-handAngle * oHandAngle),
        (obj.scale * oHandDist) * Math.sin(-handAngle * oHandAngle), 14);

    // WEAPON ABOVE HANDS:
    if (obj.buildIndex < 0 && items.weapons[obj.weaponIndex].aboveHand) {
        renderTool(items.weapons[obj.weaponIndex], config.weaponVariants[obj.weaponVariant].src, obj.scale, 0, ctxt);
        if (items.weapons[obj.weaponIndex].projectile != undefined && !items.weapons[obj.weaponIndex].hideProjectile) {
            renderProjectile(obj.scale, 0,
                items.projectiles[items.weapons[obj.weaponIndex].projectile], mainContext);
        }
    }

    // BUILD ITEM:
    if (obj.buildIndex >= 0) {
        let tmpSprite = getItemSprite(items.list[obj.buildIndex]);
        ctxt.drawImage(tmpSprite, obj.scale - items.list[obj.buildIndex].holdOffset, -tmpSprite.width / 2);
    }

    // BODY:
    renderCircle(0, 0, obj.scale, ctxt);

    // SKIN:
    if (obj.skinIndex > 0) {
        ctxt.rotate(Math.PI / 2);
        renderSkin(obj.skinIndex, ctxt, null, obj);
    }
}

// RENDER SKINS:
let skinSprites = {};
let skinPointers = {};
let tmpSkin;
function renderSkin(index, ctxt, parentSkin, owner) {
    tmpSkin = skinSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/hats/hat_" + index + ".png";
        skinSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let tmpObj = parentSkin || skinPointers[index];
    if (!tmpObj) {
        for (let i = 0; i < hats.length; ++i) {
            if (hats[i].id == index) {
                tmpObj = hats[i];
                break;
            }
        }
        skinPointers[index] = tmpObj;
    }
    if (tmpSkin.isLoaded)
        ctxt.drawImage(tmpSkin, -tmpObj.scale / 2, -tmpObj.scale / 2, tmpObj.scale, tmpObj.scale);
    if (!parentSkin && tmpObj.topSprite) {
        ctxt.save();
        ctxt.rotate(owner.skinRot);
        renderSkin(index + "_top", ctxt, tmpObj, owner);
        ctxt.restore();
    }
}

// RENDER TAIL:
let accessSprites = {};
let accessPointers = {};
function renderTail(index, ctxt, owner) {
    tmpSkin = accessSprites[index];
    if (!tmpSkin) {
        let tmpImage = new Image();
        tmpImage.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImage.src = "https://moomoo.io/img/accessories/access_" + index + ".png";
        accessSprites[index] = tmpImage;
        tmpSkin = tmpImage;
    }
    let tmpObj = accessPointers[index];
    if (!tmpObj) {
        for (let i = 0; i < accessories.length; ++i) {
            if (accessories[i].id == index) {
                tmpObj = accessories[i];
                break;
            }
        }
        accessPointers[index] = tmpObj;
    }
    if (tmpSkin.isLoaded) {
        ctxt.save();
        ctxt.translate(-20 - (tmpObj.xOff || 0), 0);
        if (tmpObj.spin)
            ctxt.rotate(owner.skinRot);
        ctxt.drawImage(tmpSkin, -(tmpObj.scale / 2), -(tmpObj.scale / 2), tmpObj.scale, tmpObj.scale);
        ctxt.restore();
    }
}

// RENDER TOOL:
let toolSprites = {};
function renderTool(obj, variant, x, y, ctxt) {
    let tmpSrc = obj.src + (variant || "");
    let tmpSprite = toolSprites[tmpSrc];
    if (!tmpSprite) {
        tmpSprite = new Image();
        tmpSprite.onload = function () {
            this.isLoaded = true;
        }
        tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
        toolSprites[tmpSrc] = tmpSprite;
    }
    if (tmpSprite.isLoaded)
        ctxt.drawImage(tmpSprite, x + obj.xOff - (obj.length / 2), y + obj.yOff - (obj.width / 2), obj.length, obj.width);
}

// RENDER PROJECTILES:
function renderProjectiles(layer, xOffset, yOffset) {
    for (let i = 0; i < projectiles.length; i++) {
        tmpObj = projectiles[i];
        if (tmpObj.active && tmpObj.layer == layer) {
            tmpObj.update(delta);
            if (tmpObj.active && isOnScreen(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.scale)) {
                mainContext.save();
                mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
                mainContext.rotate(tmpObj.dir);
                renderProjectile(0, 0, tmpObj, mainContext, 1);
                mainContext.restore();
            }
        }
    };
}

// RENDER PROJECTILE:
let projectileSprites = {};
function renderProjectile(x, y, obj, ctxt, debug) {
    if (obj.src) {
        let tmpSrc = items.projectiles[obj.indx].src;
        let tmpSprite = projectileSprites[tmpSrc];
        if (!tmpSprite) {
            tmpSprite = new Image();
            tmpSprite.onload = function () {
                this.isLoaded = true;
            }
            tmpSprite.src = "https://moomoo.io/img/weapons/" + tmpSrc + ".png";
            projectileSprites[tmpSrc] = tmpSprite;
        }
        if (tmpSprite.isLoaded)
            ctxt.drawImage(tmpSprite, x - (obj.scale / 2), y - (obj.scale / 2), obj.scale, obj.scale);
    } else if (obj.indx == 1) {
        ctxt.fillStyle = "#939393";
        renderCircle(x, y, obj.scale, ctxt);
    }
}

// RENDER AI:
let aiSprites = {};
function renderAI(obj, ctxt) {
    let tmpIndx = obj.index;
    let tmpSprite = aiSprites[tmpIndx];
    if (!tmpSprite) {
        let tmpImg = new Image();
        tmpImg.onload = function () {
            this.isLoaded = true;
            this.onload = null;
        };
        tmpImg.src = "https://moomoo.io/img/animals/" + obj.src + ".png";
        tmpSprite = tmpImg;
        aiSprites[tmpIndx] = tmpSprite;
    }
    if (tmpSprite.isLoaded) {
        let tmpScale = obj.scale * 1.2 * (obj.spriteMlt || 1);
        ctxt.drawImage(tmpSprite, -tmpScale, -tmpScale, tmpScale * 2, tmpScale * 2);
    }
}

// RENDER WATER BODIES:
function renderWaterBodies(xOffset, yOffset, ctxt, padding) {

    // MIDDLE RIVER:
    let tmpW = config.riverWidth + padding;
    let tmpY = (config.mapScale / 2) - yOffset - (tmpW / 2);
    if (tmpY < maxScreenHeight && tmpY + tmpW > 0) {
        ctxt.fillRect(0, tmpY, maxScreenWidth, tmpW);
    }
}

// RENDER GAME OBJECTS:
let gameObjectSprites = {};
function getResSprite(obj) {
    let biomeID = (obj.y >= config.mapScale - config.snowBiomeTop) ? 2 : ((obj.y <= config.snowBiomeTop) ? 1 : 0);
    let tmpIndex = (obj.type + "_" + obj.scale + "_" + biomeID);
    let tmpSprite = gameObjectSprites[tmpIndex];
    if (!tmpSprite) {
        let blurScale = 15;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = (obj.scale * 2.1) + outlineWidth;
        let tmpContext = tmpCanvas.getContext('2d');
        tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
        tmpContext.rotate(UTILS.randFloat(0, Math.PI));
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        if (isNight) {
            tmpContext.shadowBlur = blurScale;
            tmpContext.shadowColor = `rgba(0, 0, 0, ${obj.alpha})`;
        }
        if (obj.type == 0) {
            let tmpScale;
            let tmpCount = UTILS.randInt(5, 7);
            tmpContext.globalAlpha = isNight ? 0.6 : 0.8;
            for (let i = 0; i < 2; ++i) {
                tmpScale = tmpObj.scale * (!i ? 1 : 0.5);
                renderStar(tmpContext, tmpCount, tmpScale, tmpScale * 0.7);
                tmpContext.fillStyle = !biomeID ? (!i ? "#9ebf57" : "#b4db62") : (!i ? "#e3f1f4" : "#fff");
                tmpContext.fill();
                if (!i) {
                    tmpContext.stroke();
                    tmpContext.shadowBlur = null;
                    tmpContext.shadowColor = null;
                    tmpContext.globalAlpha = 1;
                }
            }
        } else if (obj.type == 1) {
            if (biomeID == 2) {
                tmpContext.fillStyle = "#606060";
                renderStar(tmpContext, 6, obj.scale * 0.3, obj.scale * 0.71);
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = "#89a54c";
                renderCircle(0, 0, obj.scale * 0.55, tmpContext);
                tmpContext.fillStyle = "#a5c65b";
                renderCircle(0, 0, obj.scale * 0.3, tmpContext, true);
            } else {
                renderBlob(tmpContext, 6, tmpObj.scale, tmpObj.scale * 0.7);
                tmpContext.fillStyle = biomeID ? "#e3f1f4" : "#89a54c";
                tmpContext.fill();
                tmpContext.stroke();

                //tmpContext.shadowBlur = null;
                //tmpContext.shadowColor = null;

                tmpContext.fillStyle = biomeID ? "#6a64af" : "#c15555";
                let tmpRange;
                let berries = 4;
                let rotVal = (Math.PI * 2) / berries;
                for (let i = 0; i < berries; ++i) {
                    tmpRange = UTILS.randInt(tmpObj.scale / 3.5, tmpObj.scale / 2.3);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(10, 12), tmpContext);
                }
            }
        } else if (obj.type == 2 || obj.type == 3) {
            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#938d77" : "#939393") : "#e0c655";
            renderStar(tmpContext, 3, obj.scale, obj.scale);
            tmpContext.fill();
            tmpContext.stroke();

            tmpContext.shadowBlur = null;
            tmpContext.shadowColor = null;

            tmpContext.fillStyle = (obj.type == 2) ? (biomeID == 2 ? "#b2ab90" : "#bcbcbc") : "#ebdca3";
            renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        gameObjectSprites[tmpIndex] = tmpSprite;
    }
    return tmpSprite;
}

// GET ITEM SPRITE:
let itemSprites = [];
function getItemSprite(obj, asIcon) {
    let tmpSprite = itemSprites[obj.id];
    if (!tmpSprite || asIcon) {
        let blurScale = !asIcon && isNight ? 15 : 0;
        let tmpCanvas = document.createElement("canvas");
        let reScale = obj.scale;
        tmpCanvas.width = tmpCanvas.height = (reScale * 2.5) + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
        if (config.useWebGl) {
            let gl = tmpCanvas.getContext("webgl");
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);

            let buffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

            function render(vs, fs, vertice, type) {

                let vShader = gl.createShader(gl.VERTEX_SHADER);
                gl.shaderSource(vShader, vs);
                gl.compileShader(vShader);
                gl.getShaderParameter(vShader, gl.COMPILE_STATUS);

                let fShader = gl.createShader(gl.FRAGMENT_SHADER);
                gl.shaderSource(fShader, fs);
                gl.compileShader(fShader);
                gl.getShaderParameter(fShader, gl.COMPILE_STATUS);

                let program = gl.createProgram();
                gl.attachShader(program, vShader);
                gl.attachShader(program, fShader);
                gl.linkProgram(program);
                gl.getProgramParameter(program, gl.LINK_STATUS);
                gl.useProgram(program);

                let vertex = gl.getAttribLocation(program, "vertex");
                gl.enableVertexAttribArray(vertex);
                gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);

                let vertices = vertice.length / 2;
                gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertice), gl.DYNAMIC_DRAW);
                gl.drawArrays(type, 0, vertices);
            }

            let max = 100;
            for (let i = 0; i < max; i++) {
                let radian = (Math.PI * (i / (max / 2)));
                render(`
                            precision mediump float;
                            attribute vec2 vertex;
                            void main(void) {
                                gl_Position = vec4(vertex, 0, 1);
                            }
                            `, `
                            precision mediump float;
                            void main(void) {
                                gl_FragColor = vec4(${UTILS.getRgb(...UTILS.hexToRgb("#fff"))}, 1);
                            }
                            `, [
                    0 + (Math.cos(radian) * 0.5), 0 + (Math.sin(radian) * 0.5),
                    0, 0,
                ], gl.LINE_LOOP);
            }
        } else {
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.rotate(asIcon ? 0 : (Math.PI / 2));
            tmpContext.strokeStyle = outlineColor;
            tmpContext.lineWidth = outlineWidth * (asIcon ? (tmpCanvas.width / 81) : 1);
            if (isNight && !asIcon) {
                tmpContext.shadowBlur = blurScale;
                tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(obj.name == "pit trap" ? 0.6 : 0.3, obj.alpha)})`;
            }
            if (obj.name == "apple") {
                tmpContext.fillStyle = "#c15555";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#89a54c";
                let leafDir = -(Math.PI / 2);
                renderLeaf(reScale * Math.cos(leafDir), reScale * Math.sin(leafDir),
                    25, leafDir + Math.PI / 2, tmpContext);
            } else if (obj.name == "cookie") {
                tmpContext.fillStyle = "#cca861";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#937c4b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(reScale / 2.5, reScale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "cheese") {
                tmpContext.fillStyle = "#f4f3ac";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#c3c28b";
                let chips = 4;
                let rotVal = (Math.PI * 2) / chips;
                let tmpRange;
                for (let i = 0; i < chips; ++i) {
                    tmpRange = UTILS.randInt(reScale / 2.5, reScale / 1.7);
                    renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                        UTILS.randInt(4, 5), tmpContext, true);
                }
            } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
                    "#a5974c" : "#939393";
                let sides = (obj.name == "castle wall") ? 4 : 3;
                renderStar(tmpContext, sides, reScale * 1.1, reScale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
                    "#c9b758" : "#bcbcbc";
                renderStar(tmpContext, sides, reScale * 0.65, reScale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
                obj.name == "spinning spikes") {
                tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
                let tmpScale = (reScale * 0.6);
                renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, reScale, tmpScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, tmpScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderCircle(0, 0, tmpScale / 2, tmpContext, true);
            } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fillStyle = "#c9b758";
                renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale * 0.5, tmpContext);
            } else if (obj.name == "mine") {
                tmpContext.fillStyle = "#939393";
                renderStar(tmpContext, 3, reScale, reScale);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#bcbcbc";
                renderStar(tmpContext, 3, reScale * 0.55, reScale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "sapling") {
                for (let i = 0; i < 2; ++i) {
                    let tmpScale = reScale * (!i ? 1 : 0.5);
                    renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
                    tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
                    tmpContext.fill();
                    if (!i) tmpContext.stroke();
                }
            } else if (obj.name == "pit trap") {
                tmpContext.fillStyle = "#a5974c";
                renderStar(tmpContext, 3, reScale * 1.1, reScale * 1.1);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = outlineColor;
                renderStar(tmpContext, 3, reScale * 0.65, reScale * 0.65);
                tmpContext.fill();
            } else if (obj.name == "boost pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#dbd97d";
                renderTriangle(reScale * 1, tmpContext);
            } else if (obj.name == "turret") {
                tmpContext.fillStyle = "#a5974c";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#939393";
                let tmpLen = 50;
                renderRect(0, -tmpLen / 2, reScale * 0.9, tmpLen, tmpContext);
                renderCircle(0, 0, reScale * 0.6, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
            } else if (obj.name == "platform") {
                tmpContext.fillStyle = "#cebd5f";
                let tmpCount = 4;
                let tmpS = reScale * 2;
                let tmpW = tmpS / tmpCount;
                let tmpX = -(reScale / 2);
                for (let i = 0; i < tmpCount; ++i) {
                    renderRect(tmpX - (tmpW / 2), 0, tmpW, reScale * 2, tmpContext);
                    tmpContext.fill();
                    tmpContext.stroke();
                    tmpX += tmpS / tmpCount;
                }
            } else if (obj.name == "healing pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, reScale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "spawn pad") {
                tmpContext.fillStyle = "#7e7f82";
                renderRect(0, 0, reScale * 2, reScale * 2, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.fillStyle = "#71aad6";
                renderCircle(0, 0, reScale * 0.6, tmpContext);
            } else if (obj.name == "blocker") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#db6e6e";
                renderRectCircle(0, 0, reScale * 0.65, 20, 4, tmpContext, true);
            } else if (obj.name == "teleporter") {
                tmpContext.fillStyle = "#7e7f82";
                renderCircle(0, 0, reScale, tmpContext);
                tmpContext.fill();
                tmpContext.stroke();
                tmpContext.rotate(Math.PI / 4);
                tmpContext.fillStyle = "#d76edb";
                renderCircle(0, 0, reScale * 0.5, tmpContext, true);
            }
        }
        tmpSprite = tmpCanvas;
        if (!asIcon)
            itemSprites[obj.id] = tmpSprite;
    }
    return tmpSprite;
}

function getItemSprite2(obj, tmpX, tmpY) {
    let tmpContext = mainContext;
    let reScale = (obj.name == "windmill" ? items.list[4].scale : obj.scale);
    tmpContext.save();
    tmpContext.translate(tmpX, tmpY);
    tmpContext.rotate(obj.dir);
    tmpContext.strokeStyle = outlineColor;
    tmpContext.lineWidth = outlineWidth;
    if (obj.name == "apple") {
        tmpContext.fillStyle = "#c15555";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#89a54c";
        let leafDir = -(Math.PI / 2);
        renderLeaf(obj.scale * Math.cos(leafDir), obj.scale * Math.sin(leafDir),
            25, leafDir + Math.PI / 2, tmpContext);
    } else if (obj.name == "cookie") {
        tmpContext.fillStyle = "#cca861";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#937c4b";
        let chips = 4;
        let rotVal = (Math.PI * 2) / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                UTILS.randInt(4, 5), tmpContext, true);
        }
    } else if (obj.name == "cheese") {
        tmpContext.fillStyle = "#f4f3ac";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fillStyle = "#c3c28b";
        let chips = 4;
        let rotVal = (Math.PI * 2) / chips;
        let tmpRange;
        for (let i = 0; i < chips; ++i) {
            tmpRange = UTILS.randInt(obj.scale / 2.5, obj.scale / 1.7);
            renderCircle(tmpRange * Math.cos(rotVal * i), tmpRange * Math.sin(rotVal * i),
                UTILS.randInt(4, 5), tmpContext, true);
        }
    } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
        tmpContext.fillStyle = (obj.name == "castle wall") ? "#83898e" : (obj.name == "wood wall") ?
            "#a5974c" : "#939393";
        let sides = (obj.name == "castle wall") ? 4 : 3;
        renderStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = (obj.name == "castle wall") ? "#9da4aa" : (obj.name == "wood wall") ?
            "#c9b758" : "#bcbcbc";
        renderStar(tmpContext, sides, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" ||
        obj.name == "spinning spikes") {
        tmpContext.fillStyle = (obj.name == "poison spikes") ? "#7b935d" : "#939393";
        let tmpScale = (obj.scale * 0.6);
        renderStar(tmpContext, (obj.name == "spikes") ? 5 : 6, obj.scale, tmpScale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, tmpScale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderCircle(0, 0, tmpScale / 2, tmpContext, true);
    } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, reScale, tmpContext);
        tmpContext.fillStyle = "#c9b758";
        renderRectCircle(0, 0, reScale * 1.5, 29, 4, tmpContext);
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, reScale * 0.5, tmpContext);
    } else if (obj.name == "mine") {
        tmpContext.fillStyle = "#939393";
        renderStar(tmpContext, 3, obj.scale, obj.scale);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#bcbcbc";
        renderStar(tmpContext, 3, obj.scale * 0.55, obj.scale * 0.65);
        tmpContext.fill();
    } else if (obj.name == "sapling") {
        for (let i = 0; i < 2; ++i) {
            let tmpScale = obj.scale * (!i ? 1 : 0.5);
            renderStar(tmpContext, 7, tmpScale, tmpScale * 0.7);
            tmpContext.fillStyle = (!i ? "#9ebf57" : "#b4db62");
            tmpContext.fill();
            if (!i) tmpContext.stroke();
        }
    } else if (obj.name == "pit trap") {
        tmpContext.fillStyle = "#a5974c";
        renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = outlineColor;
        renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
        tmpContext.fill();
    } else if (obj.name == "boost pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#dbd97d";
        renderTriangle(obj.scale * 1, tmpContext);
    } else if (obj.name == "turret") {
        tmpContext.fillStyle = "#a5974c";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#939393";
        let tmpLen = 50;
        renderRect(0, -tmpLen / 2, obj.scale * 0.9, tmpLen, tmpContext);
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
    } else if (obj.name == "platform") {
        tmpContext.fillStyle = "#cebd5f";
        let tmpCount = 4;
        let tmpS = obj.scale * 2;
        let tmpW = tmpS / tmpCount;
        let tmpX = -(obj.scale / 2);
        for (let i = 0; i < tmpCount; ++i) {
            renderRect(tmpX - (tmpW / 2), 0, tmpW, obj.scale * 2, tmpContext);
            tmpContext.fill();
            tmpContext.stroke();
            tmpX += tmpS / tmpCount;
        }
    } else if (obj.name == "healing pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (obj.name == "spawn pad") {
        tmpContext.fillStyle = "#7e7f82";
        renderRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.fillStyle = "#71aad6";
        renderCircle(0, 0, obj.scale * 0.6, tmpContext);
    } else if (obj.name == "blocker") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#db6e6e";
        renderRectCircle(0, 0, obj.scale * 0.65, 20, 4, tmpContext, true);
    } else if (obj.name == "teleporter") {
        tmpContext.fillStyle = "#7e7f82";
        renderCircle(0, 0, obj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
        tmpContext.rotate(Math.PI / 4);
        tmpContext.fillStyle = "#d76edb";
        renderCircle(0, 0, obj.scale * 0.5, tmpContext, true);
    }
    tmpContext.restore();
}

let objSprites = [];
function getObjSprite(obj) {
    let tmpSprite = objSprites[obj.id];
    if (!tmpSprite) {
        let blurScale = isNight ? 15 : 0;
        let tmpCanvas = document.createElement("canvas");
        tmpCanvas.width = tmpCanvas.height = obj.scale * 2.5 + outlineWidth + (items.list[obj.id].spritePadding || 0) + blurScale;
        let tmpContext = tmpCanvas.getContext("2d");
        tmpContext.translate(tmpCanvas.width / 2, tmpCanvas.height / 2);
        tmpContext.rotate(Math.PI / 2);
        tmpContext.strokeStyle = outlineColor;
        tmpContext.lineWidth = outlineWidth;
        if (isNight) {
            tmpContext.shadowBlur = blurScale;
            tmpContext.shadowColor = `rgba(0, 0, 0, ${Math.min(0.3, obj.alpha)})`;
        }
        if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
            tmpContext.fillStyle = obj.name == "poison spikes" ? "#7b935d" : "#939393";
            let tmpScale = obj.scale * 0.6;
            renderStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#a5974c";
            renderCircle(0, 0, tmpScale, tmpContext);
            tmpContext.fillStyle = "#cc5151";
            renderCircle(0, 0, tmpScale / 2, tmpContext, true);
        } else if (obj.name == "pit trap") {
            tmpContext.fillStyle = "#a5974c";
            renderStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
            tmpContext.fill();
            tmpContext.stroke();
            tmpContext.fillStyle = "#cc5151";
            renderStar(tmpContext, 3, obj.scale * 0.65, obj.scale * 0.65);
            tmpContext.fill();
        }
        tmpSprite = tmpCanvas;
        objSprites[obj.id] = tmpSprite;
    }
    return tmpSprite;
}

// GET MARK SPRITE:
function getMarkSprite(obj, tmpContext, tmpX, tmpY, preplc) {
    tmpContext.lineWidth = outlineWidth;
    tmpContext.globalAlpha = 1;
    tmpContext.strokeStyle = outlineColor;
    tmpContext.save();
    tmpContext.translate(tmpX, tmpY);
    tmpContext.rotate(obj.dir);
    if (preplc) {
        tmpContext.globalAlpha = 0.6;
        tmpContext.fillStyle = "rgba(0, 255, 255, 0.6)";
        renderCircle(0, 0, tmpObj.scale, tmpContext);
        tmpContext.fill();
        tmpContext.stroke();
    } else if (obj.name == "wood wall" || obj.name == "stone wall" || obj.name == "castle wall") {
        let sides = obj.name == "castle wall" ? 4 : 3;
        renderHealthStar(tmpContext, sides, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.stroke();
    } else if (obj.name == "spikes" || obj.name == "greater spikes" || obj.name == "poison spikes" || obj.name == "spinning spikes") {
        let tmpScale = obj.scale * 0.6;
        renderHealthStar(tmpContext, obj.name == "spikes" ? 5 : 6, obj.scale, tmpScale);
        tmpContext.stroke();
    } else if (obj.name == "windmill" || obj.name == "faster windmill" || obj.name == "power mill") {
        renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
    } else if (obj.name == "mine") {
        renderHealthStar(tmpContext, 3, obj.scale, obj.scale);
        tmpContext.stroke();
    } else if (obj.name == "sapling") {
        let tmpScale = obj.scale * 0.7;
        renderHealthStar(tmpContext, 7, obj.scale, tmpScale);
        tmpContext.stroke();
    } else if (obj.name == "pit trap") {
        renderHealthStar(tmpContext, 3, obj.scale * 1.1, obj.scale * 1.1);
        tmpContext.stroke();
    } else if (obj.name == "boost pad") {
        renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
    } else if (obj.name == "turret") {
        renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
    } else if (obj.name == "platform") {
        renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
    } else if (obj.name == "healing pad") {
        renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
    } else if (obj.name == "spawn pad") {
        renderHealthRect(0, 0, obj.scale * 2, obj.scale * 2, tmpContext, false, true);
    } else if (obj.name == "blocker") {
        renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
    } else if (obj.name == "teleporter") {
        renderHealthCircle(0, 0, obj.scale, tmpContext, false, true);
    }
    tmpContext.restore();
}
//renderCircle(tmpObj.x - xOffset, tmpObj.y - yOffset, tmpObj.getScale(0.6, true), mainContext, false, true);

// OBJECT ON SCREEN:
function isOnScreen(x, y, s) {
    return (x + s >= 0 && x - s <= maxScreenWidth && y + s >= 0 && (y,
        s,
        maxScreenHeight));
}


function createVolcano() {
    let volcanoDimension = config.volcanoScale * 2;
    let landCanvas = document.createElement("canvas");
    landCanvas.width = volcanoDimension;
    landCanvas.height = volcanoDimension;
    let landContext = landCanvas.getContext("2d");
    landContext.strokeStyle = "#3e3e3e";
    landContext.lineWidth = 5.5 * 2;
    landContext.fillStyle = "#7f7f7f";
    renderPolygon(landContext, 10, volcanoDimension);
    landContext.fill();
    landContext.stroke();
    volcano.land = landCanvas;

    let lavaCanvas = document.createElement("canvas");
    let lavaDimension = config.innerVolcanoScale * 2;
    lavaCanvas.width = lavaDimension;
    lavaCanvas.height = lavaDimension;

    let lavaContext = lavaCanvas.getContext("2d");
    lavaContext.strokeStyle = "#525252";
    lavaContext.lineWidth = 5.5 * 1.6;
    lavaContext.fillStyle = "#f54e16";
    lavaContext.strokeStyle = "#f56f16";

    renderPolygon(lavaContext, 10, lavaDimension);
    lavaContext.fill();
    lavaContext.stroke();
    volcano.lava = lavaCanvas;
}
createVolcano();
function renderVolcano() {
    let XOffset = xof
    let YOffset = yof
    volcano.animationTime += delta;
    volcano.animationTime %= config.volcanoAnimationDuration;
    let halfAnimationDuration = config.volcanoAnimationDuration / 2;
    let lavaScaleFactor = 1.7 + .3 * (Math.abs(halfAnimationDuration - volcano.animationTime) / halfAnimationDuration);
    let finalLavaScale = config.innerVolcanoScale * lavaScaleFactor;
    mainContext.drawImage(volcano.land, volcano.x - config.volcanoScale - XOffset, volcano.y - config.volcanoScale - YOffset, config.volcanoScale * 2, config.volcanoScale * 2);
    mainContext.drawImage(volcano.lava, volcano.x - finalLavaScale - XOffset, volcano.y - finalLavaScale - YOffset, finalLavaScale * 2, finalLavaScale * 2);
}

// RENDER GAME OBJECTS:
function renderGameObjects(layer, xOffset, yOffset) {
    let tmpSprite;
    let tmpX;
    let tmpY;
    gameObjects.forEach((tmp) => {
        tmpObj = tmp;
        if (tmpObj.alive) {
            tmpX = tmpObj.x + tmpObj.xWiggle - xOffset;
            tmpY = tmpObj.y + tmpObj.yWiggle - yOffset;
            if (layer == 0) {
                tmpObj.update(delta);
            }
            mainContext.globalAlpha = tmpObj.alpha;
            if (tmpObj.layer == layer && isOnScreen(tmpX, tmpY, tmpObj.scale + (tmpObj.blocker || 0))) {
                if (tmpObj.isItem) {
                    if ((tmpObj.dmg || tmpObj.trap) && !tmpObj.isTeamObject(player)) {
                        tmpSprite = getObjSprite(tmpObj);
                    } else {
                        tmpSprite = getItemSprite(tmpObj);
                    }

                    mainContext.save();
                    mainContext.translate(tmpX, tmpY);
                    mainContext.rotate(tmpObj.dir);
                    if (!tmpObj.active) {
                        mainContext.scale(tmpObj.visScale / tmpObj.scale, tmpObj.visScale / tmpObj.scale);
                    }
                    if (!tmpObj.hideFromEnemy) {
                        mainContext.globalAlpha = 1
                    }
                    if (tmpObj.reloads <= 0) {
                        mainContext.globalAlpha = 0.2;
                    }
                    /* if (autoBreak.objectsHit(getAttackDir()).includes(tmpObj)) {
                        mainContext.globalAlpha = 0.1
                    }*/
                    //mainContext.globalAlpha = autoBreak.objectsHit(getAttackDir()).includes(tmpObj) ? 0.1 : 1;
                    mainContext.drawImage(tmpSprite, -(tmpSprite.width / 2), -(tmpSprite.height / 2));

                    if (tmpObj.blocker) {
                        mainContext.strokeStyle = "#db6e6e";
                        mainContext.globalAlpha = 0.3;
                        mainContext.lineWidth = 6;
                        renderCircle(0, 0, tmpObj.blocker, mainContext, false, true);
                    }
                    mainContext.restore();
                } else {
                    if (tmpObj.type == 4) {
                        renderVolcano();
                    } else {
                        tmpSprite = getResSprite(tmpObj);
                        mainContext.drawImage(tmpSprite, tmpX - (tmpSprite.width / 2), tmpY - (tmpSprite.height / 2));
                    }
                }
            }
            if (layer == 3) {
                if (tmpObj.health < tmpObj.maxHealth) {
                    // HEALTH HOLDER:
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(tmpX - config.healthBarWidth / 2 - config.healthBarPad, tmpY - config.healthBarPad, config.healthBarWidth + config.healthBarPad * 2, 17, 8);
                    mainContext.fill();

                    // HEALTH BAR:
                    mainContext.fillStyle = tmpObj.isTeamObject(player) ? "#8ecc51" : "#cc5151";
                    mainContext.roundRect(tmpX - config.healthBarWidth / 2, tmpY, config.healthBarWidth * (tmpObj.health / tmpObj.maxHealth), 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                }
            }
        }
    });

    // PLACE VISIBLE:
    if (layer == 0) {
        if (placeVisible.length) {
            placeVisible.forEach((places) => {
                tmpX = places.x - xOffset;
                tmpY = places.y - yOffset;
                markObject(places, tmpX, tmpY);
            });
        }
        if (preplaceVisible.length) {
            preplaceVisible.forEach((places) => {
                tmpX = places.x - xOffset
                tmpY = places.y - yOffset
                markPreplace(places, tmpX, tmpY)
            });
        }
    }
}
function markObject(tmpObj, tmpX, tmpY) {
    getMarkSprite(tmpObj, mainContext, tmpX, tmpY);
}
function markPreplace(tmpObj, tmpX, tmpY) {
    if (tmpObj.name == "pit trap") {
        yen(mainContext, tmpX, tmpY);
    } else {
        anotherYen(mainContext, tmpX, tmpY);
    }
}
function yen(context, x, y) {
    context.fillStyle = "rgba(0, 255, 255, 0.4)";
    context.beginPath();
    context.arc(x, y, 55, 0, Math.PI * 2); // Adjust the circle size
    context.fill();
    context.closePath();
}
function anotherYen(context, x, y) {
    context.fillStyle = "rgba(255, 0, 0, 0.4)";
    context.beginPath();
    context.arc(x, y, 55, 0, Math.PI * 2); // Adjust the circle size
    context.fill();
    context.closePath();
}
// RENDER MINIMAP:
class MapPing {
    constructor(color, scale) {
        this.init = function (x, y) {
            this.scale = 0;
            this.x = x;
            this.y = y;
            this.active = true;
        };
        this.update = function (ctxt, delta) {
            if (this.active) {
                this.scale += 0.05 * delta;
                if (this.scale >= scale) {
                    this.active = false;
                } else {
                    ctxt.globalAlpha = (1 - Math.max(0, this.scale / scale));
                    ctxt.beginPath();
                    ctxt.arc((this.x / config.mapScale) * mapDisplay.width, (this.y / config.mapScale)
                        * mapDisplay.width, this.scale, 0, 2 * Math.PI);
                    ctxt.stroke();
                }
            }
        };
        this.color = color;
    }
}
function pingMap(x, y) {
    tmpPing = mapPings.find(pings => !pings.active);
    if (!tmpPing) {
        tmpPing = new MapPing("#fff", config.mapPingScale);
        mapPings.push(tmpPing);
    }
    tmpPing.init(x, y);
}
function updateMapMarker() {
    mapMarker.x = player.x;
    mapMarker.y = player.y;
}
function renderMinimap(delta) {
    if (player && player.alive) {
        mapContext.clearRect(0, 0, mapDisplay.width, mapDisplay.height);

        // RENDER PINGS:
        mapContext.lineWidth = 4;
        for (let i = 0; i < mapPings.length; ++i) {
            tmpPing = mapPings[i];
            mapContext.strokeStyle = tmpPing.color;
            tmpPing.update(mapContext, delta);
        }

        // RENDER BREAK TRACKS:
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#ff0000";
        if (breakTrackers.length) {
            mapContext.fillStyle = "#abcdef";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            for (let i = 0; i < breakTrackers.length;) {
                mapContext.fillText("!", (breakTrackers[i].x / config.mapScale) * mapDisplay.width,
                    (breakTrackers[i].y / config.mapScale) * mapDisplay.height);
                i += 2;
            }
        }

        // RENDER PLAYERS:
        mapContext.globalAlpha = 1;
        mapContext.fillStyle = "#fff";
        renderCircle((player.x / config.mapScale) * mapDisplay.width,
            (player.y / config.mapScale) * mapDisplay.height, 7, mapContext, true);
        mapContext.fillStyle = "rgba(255,255,255,0.35)";
        if (player.team && minimapData) {
            for (let i = 0; i < minimapData.length;) {
                renderCircle((minimapData[i] / config.mapScale) * mapDisplay.width,
                    (minimapData[i + 1] / config.mapScale) * mapDisplay.height, 7, mapContext, true);
                i += 2;
            }
        }



        // DEATH LOCATION:
        if (lastDeath) {
            mapContext.fillStyle = "#fc5553";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (lastDeath.x / config.mapScale) * mapDisplay.width,
                (lastDeath.y / config.mapScale) * mapDisplay.height);
        }

        // MAP MARKER:
        if (mapMarker) {
            mapContext.fillStyle = "#fff";
            mapContext.font = "34px Hammersmith One";
            mapContext.textBaseline = "middle";
            mapContext.textAlign = "center";
            mapContext.fillText("x", (mapMarker.x / config.mapScale) * mapDisplay.width,
                (mapMarker.y / config.mapScale) * mapDisplay.height);
        }
    }
}

let crossHair = "https://upload.wikimedia.org/wikipedia/commons/9/95/Crosshairs_Red.svg";
let crossHairSprites;
let iconSprites = {};
let icons = ["crown", "skull"];
function loadIcons() {
    for (let i = 0; i < icons.length; ++i) {
        let tmpSprite = new Image();
        tmpSprite.onload = function () {
            this.isLoaded = true;
        };
        tmpSprite.src = "./../img/icons/" + icons[i] + ".png";
        iconSprites[icons[i]] = tmpSprite;
    }
    let tmpSprite = new Image();
    tmpSprite.onload = function () {
        this.isLoaded = true;
    };
    tmpSprite.src = crossHair;
    crossHairSprites = tmpSprite;
    /*
    for (let i = 0; i < crossHairs.length; ++i) {
        let tmpSprite = new Image();
        tmpSprite.onload = function() {
            this.isLoaded = true;
        };
        tmpSprite.src = crossHairs[i];
        crossHairSprites[i] = tmpSprite;
    }*/
}
loadIcons();

function seePoint(point) {
    let deltaX = Math.abs(point.x - player.x) - point.scale;
    let deltaY = Math.abs(point.y - player.y) - point.scale;
    let maxVisibleWidth = maxScreenWidth / 2 * 1.3;
    let maxVisibleHeight = maxScreenHeight / 2 * 1.3;
    return deltaX <= maxVisibleWidth && deltaY <= maxVisibleHeight;
}
// COASTLINE MAKER:
function ShorePath(startX, startY, endX, distance, float) {
    this.startX = startX
    this.startY = startY
    this.endX = endX
    this.distance = distance
    this.float = float

    this.amountPaths = Math.ceil(this.endX / this.distance)

    this.path = new Map()

    this.generate = function () {
        for (let i = 1; i <= this.amountPaths; i += 1) {
            const offsetY = i % 2 === 0 ? this.distance : 0
            const x = this.startX + this.distance * (i - 1)
            const randomOffsetY = Math.floor(Math.random() * (45 - 10)) + 10
            const y = this.startY + ((this.float === "down" ? offsetY : -offsetY) + (i % 2 === 0 ? (Math.random() < .55 ? randomOffsetY : -randomOffsetY) : 0))

            this.path.set(i, [x, y, offsetY, randomOffsetY])
        }
    }

    this.render = function (color, xOffset, yOffset) {
        const path = Array.from(this.path.values())
        if (!player?.active || !player?.alive) return

        for (let i = 1; i < path.length; i++) {
            const oldPoint = path[i - 1]
            const currentPoint = path[i]

            if (!seePoint({
                x: oldPoint[0],
                y: oldPoint[1],
                scale: 10
            })) continue

            if (!seePoint({
                x: currentPoint[0],
                y: currentPoint[1],
                scale: 10
            })) continue

            const pointOffset = this.distance / 2
            const sidePoint1 = [oldPoint[0] - pointOffset / 2, oldPoint[1] + (oldPoint[2] === 0 ? pointOffset : -pointOffset)]
            const sidePoint2 = [currentPoint[0] + pointOffset * 1.15, currentPoint[1] + pointOffset * 1.2]
            const sidePoint3 = [currentPoint[0] + pointOffset * 1.35, currentPoint[1] - pointOffset * 1.15]
            const sidePoint4 = [currentPoint[0] - pointOffset * 1.35, currentPoint[1] + pointOffset * 1.15]

            mainContext.save()
            mainContext.fillStyle = color
            mainContext.lineCap = "round"
            mainContext.lineJoin = "round"
            mainContext.beginPath()
            mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset)
            mainContext.lineTo(oldPoint[0] + this.distance * 2 - xOffset, this.startY - yOffset)
            mainContext.lineTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset)
            mainContext.fill()
            mainContext.beginPath()
            mainContext.moveTo(oldPoint[0] - xOffset, oldPoint[1] - yOffset)
            mainContext.bezierCurveTo(
                sidePoint1[0] - xOffset, sidePoint1[1] - yOffset,
                sidePoint2[0] - xOffset, sidePoint2[1] - yOffset,
                currentPoint[0] + (currentPoint[3] >= 10 ? 3.5 : 1) - xOffset, currentPoint[1] - yOffset
            )
            mainContext.fill()
            mainContext.beginPath()
            mainContext.moveTo(currentPoint[0] - xOffset, currentPoint[1] - yOffset)
            mainContext.bezierCurveTo(
                sidePoint2[0] - xOffset, sidePoint2[1] - yOffset,
                sidePoint3[0] - xOffset, sidePoint3[1] - yOffset,
                currentPoint[0] + this.distance * 2 - xOffset, this.startY - yOffset
            )
            mainContext.fill()
            mainContext.restore()
        }
    }

    return this.generate()
}

const snowPath = new ShorePath(-maxScreenWidth, config.snowBiomeTop - 1, config.mapScale + maxScreenWidth * 2, 50, "down")
const desertPath = new ShorePath(-maxScreenWidth, config.mapScale - config.snowBiomeTop + 1, config.mapScale + maxScreenWidth * 2, 50, "up")


let removeSnowflakes = () => {
    let snowflakes = document.querySelectorAll('.snowflake');
    snowflakes.forEach(snowflake => snowflake.remove());
};

let createSnowflake = function () {
    let snowflake = document.createElement("div");
    snowflake.className = "snowflake";
    snowflake.style = `
        position: absolute;
        width: 10px;
        height: 10px;
        background: #fff;
        border-radius: 50%;
        z-index: 9998;
        opacity: ${Math.random()};
        left: ${Math.random() * 100}vw;
        animation: fall ${Math.random() * 3 + 2}s linear infinite;
    `;

    snowflake.addEventListener("animationiteration", function () {
        snowflake.style.left = `${Math.random() * 100}vw`;
        snowflake.style.opacity = Math.random();
    });

    return snowflake;
};

let styleSnowflakes = document.createElement("style");
styleSnowflakes.textContent = `
    @keyframes fall {
        0% { transform: translateY(-10vh); opacity: 1; }
        100% { transform: translateY(110vh); opacity: 0; }
    }
    .fast-fall { animation-duration: ${Math.random() * 1 + 1}s; }
`;
document.head.appendChild(styleSnowflakes);

let snowflakeContainer = document.createElement("div");
snowflakeContainer.style = `
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 9998;
    display: none;
`;
document.body.appendChild(snowflakeContainer);
for (let i = 0; i < 55; i++) {
    let snowflake = createSnowflake();
    if (Math.random() > 0.7) {
        snowflake.classList.add("fast-fall");
    }
    snowflakeContainer.appendChild(snowflake);
}


// UPDATE GAME:
let nightModeState = { // Ueh logic of making beutiful stars
    isEnabled: false,
    overlay: { opacity: 0, r: 0, g: 0, b: 0 },
    starField: []
};

let starSpawnTimer = 0;

let renderShapes = (mainContext, delta, offsetX, offsetY) => {
    nightModeState.overlay.opacity = nightModeState.isEnabled
        ? Math.min(0.5, nightModeState.overlay.opacity + 0.001)
        : Math.max(0, nightModeState.overlay.opacity - 0.001);

    if (nightModeState.overlay.opacity > 0) {
        if (nightModeState.overlay.opacity > 0.3 && starSpawnTimer > 300) {
            starSpawnTimer = 0;
            let starCount = UTILS.randInt(3, 5);
            for (let i = 0; i < starCount; i++) {
                let scaleMultiplier = UTILS.randFloat(1, 3);
                nightModeState.starField.push({
                    scaleMultiplier,
                    posX: (offsetX * scaleMultiplier) + UTILS.randFloat(0, maxScreenWidth),
                    posY: (offsetY * scaleMultiplier) + UTILS.randFloat(0, maxScreenHeight),
                    size: UTILS.randFloat(2, 6),
                    transparency: 0,
                    visible: true,
                    brightening: true,
                    color: `rgb(255, 255, ${UTILS.randInt(0, 255)})`
                });
            }
        } else {
            starSpawnTimer += delta;
        }
    }

    nightModeState.starField = nightModeState.starField.filter(star => star.visible);

    for (let i = 0; i < nightModeState.starField.length; i++) {
        let star = nightModeState.starField[i];

        if (star.brightening) {
            star.transparency = Math.min(1, star.transparency + 0.02);
            if (star.transparency >= 1) star.brightening = false;
        } else {
            star.transparency = Math.max(0, star.transparency - 0.02);
            if (star.transparency <= 0) star.visible = false;
        }

        let renderStar = (mainContext, size) => {
            mainContext.beginPath();
            mainContext.moveTo(0, -size);
            for (let i = 1; i < 8; i++) {
                let angle = Math.PI / 4 * i;
                let radius = i % 2 === 0 ? size : size / 2;
                mainContext.lineTo(Math.sin(angle) * radius, -Math.cos(angle) * radius);
            }
            mainContext.closePath();
        };

        mainContext.save();
        mainContext.globalAlpha = star.transparency;
        mainContext.translate(star.posX - (offsetX * star.scaleMultiplier), star.posY - (offsetY * star.scaleMultiplier));
        mainContext.scale(star.size, star.size);
        renderStar(mainContext, 3);
        mainContext.fillStyle = star.color;
        mainContext.fill();
        mainContext.restore();
    }
};

let nightState = 1;
let nightStateTime = Date.now();

function toggleDay_NightMode() {
    nightModeState.isEnabled = !nightModeState.isEnabled;

    if (nightModeState.isEnabled) {
        nightMode.style.animationName = "night1";
        nightMode.style.opacity = 0.35;
        nightMode.style.display = "block";
    } else {
        nightMode.style.animationName = "night2";
        nightMode.style.opacity = 0;
        workerSetTimeout(() => {
            nightMode.style.display = "none";
        }, 1000 * parseFloat(nightMode.style.animationDuration));
    }
}

let changeDays = workerSetInterval(() => {
    if (!nightStateTime || Date.now() - nightStateTime >= 240000) {
        nightState = !nightState;
        nightStateTime = Date.now();
        toggleDay_NightMode();
    }
}, 1000);

window.toggleNight = function () {
    workerClearTimeout(changeDays);
    toggleDay_NightMode();
    nightState = !nightState;
    nightStateTime = Date.now();
};

function updateGame() {
    itemCount();
    if (config.resetRender) {
        config.resetRender = false;
        mainContext.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        mainContext.beginPath();
    }
    let original1 = {
        width: 1920,
        height: 1080
    }
    if (configs.CAmera) {
        if (player) {
            let width, targetScreenHeight;
            let smoothness = 0.1;
            let pullFactor = 0;
            let targetX = player.x;
            let targetY = player.y;
            if (enemy.length) {
                if (near.dist2 <= 650) {
                    pullFactor = (650 - near.dist2) / 650
                    targetX = player.x2 + (near.x2 - player.x2) * pullFactor;
                    targetY = player.y2 + (near.y2 - player.y2) * pullFactor;
                }
            }
            width = original1.width;
            targetScreenHeight = original1.height;
            if (pullFactor === 0) {
                width *= 1.2;
                targetScreenHeight *= 1.4;
            }
            camX = (camX * 24 + targetX) / 25;
            camY = (camY * 24 + targetY) / 25;
            camX = Math.max(540, Math.min(13840, camX));
            camY = Math.max(200, Math.min(14240, camY));
            maxScreenWidth += (width - maxScreenWidth) * smoothness;
            maxScreenHeight += (targetScreenHeight - maxScreenHeight) * smoothness;
            resize();
        } else {
            maxScreenWidth = config.maxScreenWidth;
            maxScreenHeight = config.maxScreenHeight;
            camX = Math.max(540, Math.min(13840, config.mapScale / 2));
            camY = Math.max(200, Math.min(14240, config.mapScale / 2));
            resize();
        }
    } else {
        if (player) {
            let tmpDist = UTILS.getDistance(camX, camY, player.x, player.y);
            let tmpDir = UTILS.getDirection(player.x, player.y, camX, camY);
            let camSpd = Math.min(tmpDist * 0.01 * delta, tmpDist);
            if (tmpDist > 0.05) {
                camX += camSpd * Math.cos(tmpDir);
                camY += camSpd * Math.sin(tmpDir);
            } else {
                camX = player.x;
                camY = player.y;
            }
        } else {
            camX = config.mapScale / 2 + config.riverWidth;
            camY = config.mapScale / 2;
        }
    }
    // INTERPOLATE PLAYERS AND AI:
    let lastTime = now - (1000 / config.serverUpdateRate);
    let tmpDiff;
    for (let i = 0; i < players.length + ais.length; ++i) {
        tmpObj = players[i] || ais[i - players.length];
        if (tmpObj && tmpObj.visible) {
            if (tmpObj.forcePos) {
                tmpObj.x = tmpObj.x2;
                tmpObj.y = tmpObj.y2;
                tmpObj.dir = tmpObj.d2;
            } else {
                let total = tmpObj.t2 - tmpObj.t1;
                let fraction = lastTime - tmpObj.t1;
                let ratio = (fraction / total);
                let rate = 170;
                tmpObj.dt += delta;
                let tmpRate = Math.min(1.7, tmpObj.dt / rate);
                tmpDiff = (tmpObj.x2 - tmpObj.x1);
                tmpObj.x = tmpObj.x1 + (tmpDiff * tmpRate);
                tmpDiff = (tmpObj.y2 - tmpObj.y1);
                tmpObj.y = tmpObj.y1 + (tmpDiff * tmpRate);
                tmpObj.dir = Math.lerpAngle(tmpObj.d2, tmpObj.d1, Math.min(1.2, ratio));
            }
        }
    }
    // SNOW MAUHAHA:

    if (player && player.y < config.snowBiomeTop) {
        snowflakeContainer.style.display = "block";
        let snowing = snowflakeContainer.querySelectorAll('.snowflake').length;
        if (snowing < 55) {
            let snowS = createSnowflake();
            if (Math.random() > 0.7) {
                snowS.classList.add("fast-fall");
            }
            snowflakeContainer.appendChild(snowS);
        }
    } else {
        removeSnowflakes();
        snowflakeContainer.style.display = "none";
    }
    // RENDER CORDS:
    let xOffset = camX - (maxScreenWidth / 2);
    let yOffset = camY - (maxScreenHeight / 2);

    xof = xOffset;
    yof = yOffset;

    // RENDER BACKGROUND:
    if (config.snowBiomeTop - yOffset <= 0 && config.mapScale - config.snowBiomeTop - yOffset >= maxScreenHeight) {
        mainContext.fillStyle = "#b6db66";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.mapScale - config.snowBiomeTop - yOffset <= 0) {
        mainContext.fillStyle = "#dbc666";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.snowBiomeTop - yOffset >= maxScreenHeight) {
        mainContext.fillStyle = "#fff";
        mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);
    } else if (config.snowBiomeTop - yOffset >= 0) {
        mainContext.fillStyle = "#fff";
        mainContext.fillRect(0, 0, maxScreenWidth, config.snowBiomeTop - yOffset);
        mainContext.fillStyle = "#b6db66";
        mainContext.fillRect(0, config.snowBiomeTop - yOffset, maxScreenWidth, maxScreenHeight - (config.snowBiomeTop - yOffset));
        snowPath.render("#fff", xOffset, yOffset);
    } else {
        mainContext.fillStyle = "#b6db66";
        mainContext.fillRect(0, 0, maxScreenWidth, (config.mapScale - config.snowBiomeTop - yOffset));
        mainContext.fillStyle = "#dbc666";
        mainContext.fillRect(0, (config.mapScale - config.snowBiomeTop - yOffset), maxScreenWidth, maxScreenHeight - (config.mapScale - config.snowBiomeTop - yOffset));
        desertPath.render("#b6db66", xOffset, yOffset);
    }

    // RENDER WATER AREAS:
    if (!firstSetup) {
        waterMult += waterPlus * config.waveSpeed * delta;
        if (waterMult >= config.waveMax) {
            waterMult = config.waveMax;
            waterPlus = -1;
        } else if (waterMult <= 1) {
            waterMult = waterPlus = 1;
        }
        mainContext.globalAlpha = 1;
        mainContext.fillStyle = "#dbc666";
        renderWaterBodies(xOffset, yOffset, mainContext, config.riverPadding);
        mainContext.fillStyle = "#91b2db";
        renderWaterBodies(xOffset, yOffset, mainContext, (waterMult - 1) * 250);
    }

    if (player) {
        // DEATH LOCATION:
        if (lastDeath) {
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#fc5553";
            mainContext.font = "100px Hammersmith One";
            mainContext.textBaseline = "middle";
            mainContext.textAlign = "center";
            mainContext.fillText("x", lastDeath.x - xOffset, lastDeath.y - yOffset);
        }
    }

    // RENDER DEAD PLAYERS:
    mainContext.globalAlpha = 1;
    mainContext.strokeStyle = outlineColor;
    renderDeadPlayers(xOffset, yOffset);

    // RENDER BOTTOM LAYER:
    mainContext.globalAlpha = 1;
    mainContext.strokeStyle = outlineColor;
    renderGameObjects(-1, xOffset, yOffset);

    // RENDER PROJECTILES:
    mainContext.globalAlpha = 1;
    mainContext.lineWidth = outlineWidth;
    renderProjectiles(0, xOffset, yOffset);

    // RENDER PLAYERS:
    renderPlayers(xOffset, yOffset, 0);

    // RENDER AI:
    mainContext.globalAlpha = 1;
    for (let i = 0; i < ais.length; ++i) {
        tmpObj = ais[i];
        if (tmpObj.active && tmpObj.visible) {
            tmpObj.animate(delta);
            mainContext.save();
            mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset);
            mainContext.rotate(tmpObj.dir + tmpObj.dirPlus - (Math.PI / 2));
            renderAI(tmpObj, mainContext);
            mainContext.restore();
        }
    }

    // RENDER GAME OBJECTS (LAYERED):
    renderGameObjects(0, xOffset, yOffset);
    renderProjectiles(1, xOffset, yOffset);
    renderGameObjects(1, xOffset, yOffset);
    renderPlayers(xOffset, yOffset, 1);
    renderGameObjects(2, xOffset, yOffset);
    renderGameObjects(3, xOffset, yOffset);

    // MAP BOUNDARIES:
    mainContext.fillStyle = "#000";
    mainContext.globalAlpha = 0.09;
    if (xOffset <= 0) {
        mainContext.fillRect(0, 0, -xOffset, maxScreenHeight);
    } if (config.mapScale - xOffset <= maxScreenWidth) {
        let tmpY = Math.max(0, -yOffset);
        mainContext.fillRect(config.mapScale - xOffset, tmpY, maxScreenWidth - (config.mapScale - xOffset), maxScreenHeight - tmpY);
    } if (yOffset <= 0) {
        mainContext.fillRect(-xOffset, 0, maxScreenWidth + xOffset, -yOffset);
    } if (config.mapScale - yOffset <= maxScreenHeight) {
        let tmpX = Math.max(0, -xOffset);
        let tmpMin = 0;
        if (config.mapScale - xOffset <= maxScreenWidth) {
            tmpMin = maxScreenWidth - (config.mapScale - xOffset);
        }
        mainContext.fillRect(tmpX, config.mapScale - yOffset,
            (maxScreenWidth - tmpX) - tmpMin, maxScreenHeight - (config.mapScale - yOffset));
    }


    // RENDER DAY/NIGHT TIME:
    mainContext.globalAlpha = 1;
    mainContext.fillStyle = "rgba(0, 0, 70, 0.35)";
    mainContext.fillRect(0, 0, maxScreenWidth, maxScreenHeight);

    // RENDER PLAYER AND AI UI:
    mainContext.strokeStyle = darkOutlineColor;
    mainContext.globalAlpha = 1;
    for (let i = 0; i < players.length + ais.length; ++i) {
        tmpObj = players[i] || ais[i - players.length];
        if (tmpObj.visible) {
            mainContext.strokeStyle = darkOutlineColor;

            // NAME AND HEALTH:
            if (tmpObj.skinIndex != 10 || (tmpObj.team && tmpObj.team == player.team)) {
                let tmpText = (tmpObj.team ? "[" + tmpObj.team + "] " : "") + (tmpObj.name || "") + (tmpObj.isPlayer ? " {" + tmpObj.sid + "}" : "");
                if (tmpText != "") {
                    mainContext.font = (tmpObj.nameScale || 30) + "px Hammersmith One";
                    mainContext.fillStyle = tmpObj.isPlayer ? syncersInServer.includes(tmpObj.sid) ? "#FF0000" : playersInServer.includes(tmpObj.sid) ? "#00ff00" : "#fff" : "#fff";
                    mainContext.textBaseline = "middle";
                    mainContext.textAlign = "center";
                    mainContext.lineWidth = (tmpObj.nameScale ? 11 : 8);
                    mainContext.lineJoin = "round";
                    mainContext.strokeText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    mainContext.fillText(tmpText, tmpObj.x - xOffset, (tmpObj.y - yOffset - tmpObj.scale) - config.nameY);
                    if (tmpObj.isLeader && iconSprites["crown"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) - (mainContext.measureText(tmpText).width / 2) - config.crownPad;
                        mainContext.drawImage(iconSprites["crown"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                            - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.iconIndex == 1 && iconSprites["skull"].isLoaded) {
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - (tmpS / 2) + (mainContext.measureText(tmpText).width / 2) + config.crownPad;
                        mainContext.drawImage(iconSprites["skull"], tmpX, (tmpObj.y - yOffset - tmpObj.scale)
                            - config.nameY - (tmpS / 2) - 5, tmpS, tmpS);
                    }
                    if (tmpObj.isPlayer && instaC.wait && near.sid == tmpObj.sid && enemy.length) {
                        let tmpS = tmpObj.scale * 2.2;
                        mainContext.drawImage(crossHairSprites, tmpObj.x - xOffset - tmpS / 2, tmpObj.y - yOffset - tmpS / 2, tmpS, tmpS);
                    }
                    if (tmpObj.isPlayer && tmpObj.sid == targetPlayer?.sid) {
                        let tmpS = tmpObj.scale * 2.2;
                        let angle = performance.now() * 0.002;
                        mainContext.save();
                        mainContext.translate(tmpObj.x - xOffset, tmpObj.y - yOffset); // move origin to center
                        mainContext.rotate(angle);                                    // rotate around center
                        mainContext.drawImage(crossHairSprites, -tmpS / 2, -tmpS / 2, tmpS, tmpS); // draw centered
                        mainContext.restore();
                    }
                }
                if (tmpObj.health > 0) {
                    let curr = tmpObj.prevHW || ((config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth));
                    mainContext.fillStyle = darkOutlineColor;
                    mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth - config.healthBarPad, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY, (config.healthBarWidth * 2) + (config.healthBarPad * 2), 17, 8);
                    mainContext.fill();
                    let thw = (config.healthBarWidth * 2) * (tmpObj.health / tmpObj.maxHealth);
                    if (tmpObj.prevHW !== undefined) {
                        tmpObj.prevDW = tmpObj.prevDW || tmpObj.prevHW;
                        tmpObj.prevDW += (thw - tmpObj.prevDW) * 0.03; // uh the damage animation
                    }
                    curr += (thw - curr) * 0.2;
                    tmpObj.prevHW = curr;
                    mainContext.fillStyle = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team)) ? "#FF6666" : "#FFFF66";
                    mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, tmpObj.prevDW, 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                    mainContext.fillStyle = (tmpObj.sid == player.sid || (tmpObj.team && tmpObj.team == player.team)) ? "#8ecc51" : "#cc5151";
                    mainContext.roundRect(tmpObj.x - xOffset - config.healthBarWidth, (tmpObj.y - yOffset + tmpObj.scale) + config.nameY + config.healthBarPad, curr, 17 - config.healthBarPad * 2, 7);
                    mainContext.fill();
                    if (tmpObj.isPlayer) {

                        mainContext.globalAlpha = 1;

                        // UNDER TEXT:
                        mainContext.globalAlpha = 1;
                        mainContext.font = "20px Hammersmith One";
                        mainContext.fillStyle = "#fff";
                        mainContext.strokeStyle = darkOutlineColor;
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = 8;
                        mainContext.lineJoin = "round";
                        let text = [];
                        if (tmpObj.sid == player.sid) {
                            text = [player.health, UTILS.fixTo(tmpObj.damageSources.totalSoldier, 2), UTILS.fixTo(tmpObj.damageSources.totalNoSoldier, 2)];
                            mainContext.strokeText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                            mainContext.fillText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                        } else {
                            text = [tmpObj.primaryIndex, (tmpObj.secondaryIndex || 0), tmpObj.pingPredict];
                            mainContext.strokeText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                            mainContext.fillText("[" + text.join(",") + "]", tmpObj.x - xOffset, tmpObj.y - yOffset + tmpObj.scale + config.nameY + 13.5 * 2);
                        }

                        // SHAME COUNT:
                        mainContext.globalAlpha = 1;
                        mainContext.font = "30px Hammersmith One";
                        mainContext.fillStyle = "#fff";
                        mainContext.strokeStyle = darkOutlineColor;
                        mainContext.textBaseline = "middle";
                        mainContext.textAlign = "center";
                        mainContext.lineWidth = 8;
                        mainContext.lineJoin = "round";
                        let tmpS = config.crownIconScale;
                        let tmpX = tmpObj.x - xOffset - tmpS / 2 + mainContext.measureText(tmpText).width / 2 + config.crownPad + (tmpObj.iconIndex == 1 ? 30 * 2.75 : 30);
                        mainContext.strokeText(tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                        mainContext.fillText(tmpObj.skinIndex == 45 && tmpObj.shameTimer > 0 ? tmpObj.shameTimer : tmpObj.shameCount, tmpX, tmpObj.y - yOffset - tmpObj.scale - config.nameY);
                        if (tmpObj.sid == player.sid) {
                            for (let radius in autoPlace.debugRender) {
                                autoPlace.debugRender[radius].forEach(range => {
                                    let startAngle = range[0];
                                    let endAngle = range[1];
                                    let r = parseInt(radius);
                                    mainContext.beginPath();
                                    mainContext.strokeStyle = "#FF0000";
                                    mainContext.lineWidth = 4;
                                    mainContext.arc(tmpObj.x - xOffset, tmpObj.y - yOffset, r, startAngle, endAngle);
                                    mainContext.stroke();
                                });
                            };
                        }

                        // PLAYER TRACER:
                        if (!tmpObj.isTeam(player)) {
                            let center = {
                                x: screenWidth / 2,
                                y: screenHeight / 2,
                            };
                            let alpha = Math.min(1, (UTILS.getDistance(0, 0, player.x - tmpObj.x, (player.y - tmpObj.y) * (16 / 9)) * 100) / (config.maxScreenHeight / 2) / center.y);
                            let dist = center.y * alpha;
                            let tmpX = dist * Math.cos(UTILS.getDirect(tmpObj, player, 0, 0));
                            let tmpY = dist * Math.sin(UTILS.getDirect(tmpObj, player, 0, 0));
                            mainContext.save();
                            mainContext.translate((player.x - xOffset) + tmpX, (player.y - yOffset) + tmpY);
                            mainContext.rotate(tmpObj.aim2 + Math.PI / 2);
                            let by = 255 - (tmpObj.sid * 2);
                            mainContext.fillStyle = `rgb(${by}, ${by}, ${by})`;
                            mainContext.globalAlpha = alpha;
                            let renderTracer = function (s, ctx) {
                                ctx = ctx || mainContext;
                                let h = s * (Math.sqrt(3) / 2);
                                ctx.beginPath();
                                ctx.moveTo(0, -h / 1.5);
                                ctx.lineTo(-s / 2, h / 2);
                                ctx.lineTo(s / 2, h / 2);
                                ctx.lineTo(0, -h / 1.5);
                                ctx.fill();
                                ctx.closePath();
                            }
                            renderTracer(25, mainContext);
                            mainContext.restore();
                        }

                        /*   if (getEl("predictType").value == "pre2") {
                                mainContext.lineWidth = 3;
                                mainContext.strokeStyle = "#cc5151";
                                mainContext.globalAlpha = 1;
                                mainContext.beginPath();
                                let render = {
                                    x: tmpObj.x2 - xOffset,
                                    y: tmpObj.y2 - yOffset
                                };
                                mainContext.moveTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                                mainContext.lineTo(render.x, render.y);
                                mainContext.stroke();
                            } else if (getEl("predictType").value == "pre3") {
                                mainContext.lineWidth = 3;
                                mainContext.strokeStyle = "#cc5151";
                                mainContext.globalAlpha = 1;
                                mainContext.beginPath();
                                let render = {
                                    x: tmpObj.x3 - xOffset,
                                    y: tmpObj.y3 - yOffset
                                };
                                mainContext.moveTo(tmpObj.x - xOffset, tmpObj.y - yOffset);
                                mainContext.lineTo(render.x, render.y);
                                mainContext.stroke();
                            }*/

                    }
                }
            }
        }
    }

    if (player) {

        // AUTOPUSH LINE:

        renderPathFinder(mainContext, { x: xOffset, y: yOffset })
        if (player.alive) {
            drawCircles(tmpObj, xOffset, yOffset)
            mainContext.globalAlpha = 1;
            mainContext.fillStyle = "#fff";
            mainContext.strokeStyle = "#000";
            renderCircle(my.pushData.x2 - xOffset, my.pushData.y2 - yOffset, 20);
            if (testRender.x) {
                renderCircle(testRender.x - xOffset, testRender.y - yOffset, 20);
            }
        }

        // FUNNY:
        if (petals.length && configs.florr) {

            player.spinDir += 2.5 / 60;
            let maxRad = 0;
            if (clicks.left) {
                maxRad = 100;
            } else if (clicks.right) {
                maxRad = 15;
            } else {
                maxRad = 40;
            }
            maxRad += player.scale;

            petals.forEach((petal, i) => {
                if (petal.active) {
                    let petalRad = (Math.PI * (i / (petals.length / 2)));
                    let pl = {
                        x: player.x + (maxRad * Math.cos(player.spinDir + petalRad)),
                        y: player.y + (maxRad * Math.sin(player.spinDir + petalRad))
                    };
                    let angle = UTILS.getDirect(pl, petal, 0, 0);
                    let dist = UTILS.getDist(pl, petal, 0, 0);
                    petal.x += (dist / 7) * Math.cos(angle);
                    petal.y += (dist / 7) * Math.sin(angle);

                    players.filter((tmp) => tmp.visible && tmp != player).forEach((tmp) => {
                        let angle = UTILS.getDirect(petal, tmp, 0, 0);
                        let dist = UTILS.getDist(petal, tmp, 0, 0);
                        let sc = petal.scale + tmp.scale;
                        if (dist <= sc) {
                            let tD = dist - sc;
                            let diff = -tD;
                            petal.x += diff * Math.cos(angle);
                            petal.y += diff * Math.sin(angle);
                            petal.health -= 10;
                            petal.damaged += 125;
                            if (petal.health <= 0) {
                                petal.active = false;
                            }
                        }
                    });

                } else {
                    petal.time += delta;

                    if (petal.alive) {
                        petal.alpha -= delta / 200;
                        petal.visScale += delta / (petal.scale * 2);
                        if (petal.alpha <= 0) {
                            petal.alpha = 0;
                            petal.alive = false;
                        }
                    }

                    if (petal.time >= petal.timer) {
                        petal.time = 0;
                        petal.active = true;
                        petal.alive = true;
                        petal.x = player.x;
                        petal.y = player.y;
                        petal.health = petal.maxHealth;
                        petal.damaged = 0;
                        petal.alpha = 1;
                        petal.visScale = petal.scale;
                    }
                }

                if (petal.alive) {

                    let cD = function (r, g, b, dmg) {
                        return "rgb(" + `${Math.min(255, r + Math.floor(dmg))}, ${Math.max(0, g - Math.floor(dmg))}, ${Math.max(0, b - Math.floor(dmg))}` + ")";
                    }

                    mainContext.globalAlpha = petal.alpha;
                    mainContext.lineWidth = 3;
                    mainContext.fillStyle = cD(255, 255, 255, petal.damaged);
                    mainContext.strokeStyle = cD(200, 200, 200, petal.damaged);
                    mainContext.beginPath();
                    mainContext.arc(petal.x - xOffset, petal.y - yOffset, petal.visScale, 0, Math.PI * 2);
                    mainContext.fill();
                    mainContext.stroke();

                    petal.damaged = Math.max(0, petal.damaged - (delta / 2));

                }

            });
        }

    }

    mainContext.globalAlpha = 1;

    // RENDER ANIM TEXTS:
    textManager.update(delta, mainContext, xOffset, yOffset);

    // RENDER CHAT MESSAGES:
    for (let i = 0; i < players.length; ++i) {
        tmpObj = players[i];
        if (tmpObj.visible) {
            if (tmpObj.chatCountdown > 0) {
                tmpObj.chatCountdown -= delta;
                if (tmpObj.chatCountdown <= 0)
                    tmpObj.chatCountdown = 0;
                mainContext.font = "32px Hammersmith One";
                let tmpSize = mainContext.measureText(tmpObj.chatMessage);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                let tmpX = tmpObj.x - xOffset;
                let tmpY = tmpObj.y - tmpObj.scale - yOffset - 90;
                let tmpH = 47;
                let tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#fff";
                mainContext.fillText(tmpObj.chatMessage, tmpX, tmpY);
            }
            if (tmpObj.chat.count > 0) {
                tmpObj.chat.count -= delta;
                if (tmpObj.chat.count <= 0)
                    tmpObj.chat.count = 0;
                mainContext.font = "32px Hammersmith One";
                let tmpSize = mainContext.measureText(tmpObj.chat.message);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                let tmpX = tmpObj.x - xOffset;
                let tmpY = tmpObj.y - tmpObj.scale - yOffset + (90 * 2);
                let tmpH = 47;
                let tmpW = tmpSize.width + 17;
                mainContext.fillStyle = "rgba(0,0,0,0.2)";
                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.fill();
                mainContext.fillStyle = "#ffffff99";
                mainContext.fillText(tmpObj.chat.message, tmpX, tmpY);
            } else {
                tmpObj.chat.count = 0;
            }
        }
    }

    if (allChats.length) {
        allChats.filter(ch => ch.active).forEach((ch) => {
            if (!ch.alive) {
                if (ch.alpha <= 1) {
                    ch.alpha += delta / 250;
                    if (ch.alpha >= 1) {
                        ch.alpha = 1;
                        ch.alive = true;
                    }
                }
            } else {
                ch.alpha -= delta / 5000;
                if (ch.alpha <= 0) {
                    ch.alpha = 0;
                    ch.active = false;
                }
            }
            if (ch.active) {
                mainContext.font = "20px Ubuntu";
                let tmpSize = mainContext.measureText(ch.chat);
                mainContext.textBaseline = "middle";
                mainContext.textAlign = "center";
                let tmpX = ch.x - xOffset;
                let tmpY = ch.y - yOffset - 90;
                let tmpH = 40;
                let tmpW = tmpSize.width + 15;

                mainContext.globalAlpha = ch.alpha;

                mainContext.fillStyle = ch.owner.isTeam(player) ? "#8ecc51" : "#cc5151";
                mainContext.strokeStyle = "rgb(25, 25, 25)";
                mainContext.strokeText(ch.owner.name, tmpX, tmpY - 45);
                mainContext.fillText(ch.owner.name, tmpX, tmpY - 45);

                mainContext.lineWidth = 5;
                mainContext.fillStyle = "#ccc";
                mainContext.strokeStyle = "rgb(25, 25, 25)";

                mainContext.roundRect(tmpX - tmpW / 2, tmpY - tmpH / 2, tmpW, tmpH, 6);
                mainContext.stroke();
                mainContext.fill();

                mainContext.fillStyle = "#fff";
                mainContext.strokeStyle = "#000";
                mainContext.strokeText(ch.chat, tmpX, tmpY);
                mainContext.fillText(ch.chat, tmpX, tmpY);
                ch.y -= delta / 100;
            }
        });

    }
    renderShapes(mainContext, delta, xOffset, yOffset)

    mainContext.globalAlpha = 1;

    // RENDER MINIMAP:
    renderMinimap(delta);
}
window.requestAnimFrame = function () {
    return null;
}
window.rAF = (function () {
    return window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function (callback) {
            workerSetTimeout(callback, 1000 / 60);
        };
})();

// UPDATE & ANIMATE:
function doUpdate() {
    now = performance.now();
    delta = now - lastUpdate;
    lastUpdate = now;

    let timer = performance.now();
    let diff = timer - fpsTimer.last;
    if (diff >= 1000) {

        fpsTimer.ltime = fpsTimer.time * (1000 / diff);

        fpsTimer.last = timer;
        fpsTimer.time = 0;
    }
    fpsTimer.time++;
    pingDisplay.innerHTML = `Ping: ${pingTracker[pingTracker.length - 1]} FPS: ${UTILS.round(fpsTimer.ltime, 10)} Packets: ${secPacket}`
    updateGame();
    rAF(doUpdate);
}
prepareMenuBackground();
doUpdate();

window.debug = function () {
    workerClearTimeout(debugTimeout)
    PF.paths.length = 0;
    my.waitHit = 0;
    my.autoAim = false;
    instaC.isTrue = false;
    autoBreak.active = false;
    my.anti0Tick = 0;
    player.antiTimer = 2;
    my.bullTick = 0;
    my.reSync = true;
    itemSprites.length = 0;
    objSprites.length = 0;
    gameObjectSprites.length = 0;
    debugStop = true;
    debugTimeout = workerSetTimeout(() => {
        debugStop = false
    }, 5000);
    game.tick = 0;
    petals.length = 0;
    for (let i = 0; i < 5; i++) {
        petals.push(new Petal(player.x, player.y));
    }
    config.resetRender = true;
    placeVisible.length = 0;
    preplaceVisible.length = 0;
    console.clear()
    console.log(alliancePlayers, alliances)
};

window.toggleVisual = function () {
    config.anotherVisual = !config.anotherVisual;
    gameObjects.forEach((tmp) => {
        if (tmp.active) {
            tmp.dir = tmp.lastDir;
        }
    });
};
function addWeaponXPBar(parentEl) {
    let barWrap = document.createElement("div");
    barWrap.style.cssText = `
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5px;
    background: rgba(0,0,0,0.35);
    border-radius: 3px;
    overflow: hidden;
    `;

    let bar = document.createElement("div");
    bar.style.cssText = `
    height: 100%;
    width: 0%;
    transition: width 0.15s linear;
    `;

    barWrap.appendChild(bar);
    parentEl.appendChild(barWrap);

    return bar;
}
function getWeaponXPPercent(xp) {
    if (xp < 3000) return xp / 3000;
    if (xp < 7000) return xp / 7000;
    if (xp < 12000) return xp / 12000;
    return 1;
}
function updateWeaponXPBars() {
    for (let i = 0; i < items.weapons.length; i++) {
        let el = getEl("actionBarItem" + i);
        if (!el) continue;
        let bar = el._xpBar;
        if (!bar) continue;

        let xp = player.weaponXP[i] || 0;
        let pct = getWeaponXPPercent(xp);
        bar.style.width = (pct * 100) + "%";
        bar.style.backgroundColor = xp < 3000 ? "#f7cf45" : xp < 7000 ? "#6d92cd" : "#be5455";
    }
}
window.prepareUI = function (tmpObj) {
    resize();
    // ACTION BAR:
    UTILS.removeAllChildren(actionBar);
    for (let i = 0; i < (items.weapons.length + items.list.length); ++i) {
        (function (i) {
            UTILS.generateElement({
                id: "actionBarItem" + i,
                class: "actionBarItem",
                style: "display:none",
                onmouseout: function () {
                    showItemInfo();
                },
                parent: actionBar
            });
        })(i);
    }
    for (let i = 0; i < (items.list.length + items.weapons.length); ++i) {
        (function (i) {
            let tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = tmpCanvas.height = 66;
            let tmpContext = tmpCanvas.getContext("2d");
            tmpContext.translate((tmpCanvas.width / 2), (tmpCanvas.height / 2));
            tmpContext.imageSmoothingEnabled = false;
            tmpContext.webkitImageSmoothingEnabled = false;
            tmpContext.mozImageSmoothingEnabled = false;
            if (items.weapons[i]) {
                tmpContext.rotate((Math.PI / 4) + Math.PI);
                let tmpSprite = new Image();
                toolSprites[items.weapons[i].src] = tmpSprite;
                tmpSprite.onload = function () {
                    this.isLoaded = true;
                    let tmpPad = 1 / (this.height / this.width);
                    let tmpMlt = (items.weapons[i].iPad || 1);
                    tmpContext.drawImage(this, -(tmpCanvas.width * tmpMlt * config.iconPad * tmpPad) / 2, -(tmpCanvas.height * tmpMlt * config.iconPad) / 2,
                        tmpCanvas.width * tmpMlt * tmpPad * config.iconPad, tmpCanvas.height * tmpMlt * config.iconPad);
                    tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                    tmpContext.globalCompositeOperation = "source-atop";
                    tmpContext.fillRect(-tmpCanvas.width / 2, -tmpCanvas.height / 2, tmpCanvas.width, tmpCanvas.height);
                    getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                };
                tmpSprite.src = "./../img/weapons/" + items.weapons[i].src + ".png";
                let tmpUnit = getEl('actionBarItem' + i);
                tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    showItemInfo(items.weapons[i], true);
                });
                tmpUnit.onclick = UTILS.checkTrusted(function () {
                    selectWeapon(tmpObj.weapons[items.weapons[i].type]);
                });
                UTILS.hookTouchEvents(tmpUnit);
                tmpUnit.style.position = "relative";
                let bar = addWeaponXPBar(tmpUnit)
                tmpUnit._xpBar = bar;
            } else {
                let tmpSprite = getItemSprite(items.list[i - items.weapons.length], true);
                let tmpScale = Math.min(tmpCanvas.width - config.iconPadding, tmpSprite.width);
                tmpContext.globalAlpha = 1;
                tmpContext.drawImage(tmpSprite, -tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                tmpContext.fillStyle = "rgba(0, 0, 70, 0.1)";
                tmpContext.globalCompositeOperation = "source-atop";
                tmpContext.fillRect(-tmpScale / 2, -tmpScale / 2, tmpScale, tmpScale);
                getEl('actionBarItem' + i).style.backgroundImage = "url(" + tmpCanvas.toDataURL() + ")";
                let tmpUnit = getEl('actionBarItem' + i);
                tmpUnit.onmouseover = UTILS.checkTrusted(function () {
                    showItemInfo(items.list[i - items.weapons.length]);
                });
                tmpUnit.onclick = UTILS.checkTrusted(function () {
                    selectToBuild(tmpObj.items[tmpObj.getItemType(i - items.weapons.length)]);
                });
                UTILS.hookTouchEvents(tmpUnit);
            }
        })(i);
    }
};
window.toggleNight();