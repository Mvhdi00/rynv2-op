# The Pod Support Unit

The YoRHa companion in `YoRHa_System.user.js`: a flight unit that follows you,
paints a targeting laser, talks out loud in Arabic or English, listens on the
microphone, remembers you between sessions, tells you where to go, finds players
by name, and flies off on its own to go and look.

It reads the game's chat box, and on request it will play the game for you and
keep score of what worked.

Open it with **Y**. Hold **C** to talk to it. Press **K** to hand it the game.
Type `.something` in the game's own chat to reach it from there. It works with no
API key at all — and with a free one it holds a conversation.

![The unit, every variant and state](pod-preview-unit.png)
![The terminal, English and Arabic](pod-preview-panel.png)

Both images are generated from the shipping code by `node tools/preview-pod.js`
— nothing in them is a mockup.

---

## دليل سريع بالعربي

| تسوي إيش | كيف |
|---|---|
| تفتح البود | زر **Y** |
| تكلمه بصوتك | اضغط مطوّل على **C**، تكلّم، اترك الزر |
| تغيّر اللغة | زر **ع / EN** في رأس النافذة، أو اكتب `/lang ar` |
| تلغي الصوت | زر **VOX** في رأس النافذة، أو اكتب `/voice off` |
| تخليه يحفظ شي عنك | `/remember أنا ألعب بالبوليرم` |
| تشوف ذاكرته | زر **MEM** |
| تمسح الذاكرة | `/forget`، أو زر **WIPE MEMORY** في الإعدادات |
| تشغّل الذكاء الاصطناعي **مجاناً** | Settings › Visuals › **Pod AI** → المزوّد **Google Gemini** + مفتاح مجاني من `aistudio.google.com/apikey` |
| تدوّر على لاعب | `/find اسمه` — يعلّم موقعه على الشاشة |
| تخليه يستطلع | `/recon شمال` — ينفصل عنك، يطير، يمسح، ويرجع |
| يقول لك وين تروح | `/go` أو اسأله "وين أروح" — يعطيك اتجاه ومسافة وسبب، ويعلّم النقطة |
| تشوف لوحة السيرفر | `/board` |
| تكلمه من **شات اللعبة** | اكتب في شات اللعبة `.` وبعدها سؤالك — مثال `.وين أروح` |
| تخليه **يلعب بدالك** | زر **K**، أو اكتب `/pilot`، أو قل له "العب بدالي" |
| تسترجع التحكم | حرّك بـ WASD أو اضغط الماوس — يتوقف فوراً ويرجع لك |
| تشوف وش تعلّم | `/learned` |

اللغة اللي تختارها تنطبق على كل شي: كلامه المكتوب، صوته، والمايك اللي يسمعك فيه.

---

## The unit

`podDrawBody` draws a Pod 042 chassis, not a circle with fins: a slab body with
a collar, a single large lens whose iris tracks your aim, two side flaps that
slide out and flare when you swing, a hook over the top, and a nozzle that
washes thrust when the unit moves. It banks into its turns, bobs when it holds
station, and puts a scan ring around itself while it is thinking or listening.

Four units, in the NieR palettes:

| Unit | Look |
|---|---|
| **042** | Bone white, ink trim, pale lens — 2B's pod |
| **153** | Warmer grey, amber lens — 9S's pod |
| **A2** | Black chassis, red optic |
| **P-33** | The machine-lifeform palette: rust and cyan |

The laser is two layers: a dashed guide that is always on, so you can read your
facing at a glance, and a bright core beam that only fires while you are
actually swinging. It ends in a YoRHa reticle — four corner brackets and a
segmented ring that tightens on lock.

None of this touches game state. The unit never sends a packet, so it is advice
and atmosphere, never an action.

## Language

One setting, `podLang` (`auto` / `en` / `ar`), drives everything: the local
call-outs, the panel chrome, the voice that speaks, the language the microphone
transcribes, and the instruction the model is given. On `ar` the panel flips to
RTL, including the corner bevel.

Every string the unit can say is written twice — `POD_STR` for the chrome, and
paired English/Arabic arrays for each call-out. `tools/test-pod.js` fails the
build if one table gains a key the other does not have, so a language can never
half-apply.

## Voice

Speech is `window.speechSynthesis`; no key and no network.

- **VOX** in the header, `podVoice`, or `/voice off` — the master mute.
- `podVoiceCallouts` — keeps replies spoken but silences the battlefield
  chatter. This is usually the setting you actually want.
- Speed, pitch and volume sliders. Pitch defaults to 85%, which is what makes it
  read as a machine rather than a narrator.
- A voice picker listing what your browser actually has, matching voices for the
  chosen language first. Chrome populates that list asynchronously, so an empty
  list refills itself on `voiceschanged`.

While a reply streams in, each completed sentence is spoken as it lands rather
than waiting for the whole answer — the first chunk cuts off whatever was being
said, the rest queue behind it.

## Microphone

Hold **C** (`keyPodTalk`) to talk. Push-to-talk rather than an always-open
recogniser: one phrase per press, closed on release. Interim transcription
appears in the input box as you speak; the final transcript is sent as if you
had typed it. The recogniser's language follows `podLang`, and speech output is
cancelled while the microphone is open so the unit never transcribes itself.

Push-to-talk is bound outside the game's key state machine, so it works while
you are dead, in a menu, or driving a bot, and it is ignored while you are
typing in any text field.

## Memory

`localStorage` under `yorha_pod_memory_v2`, in three layers:

- **Facts** — up to 40 durable notes, each tagged. Added by you with
  `/remember …`, or by the model calling its `remember` tool when you tell it
  something worth keeping.
- **Profile and statistics** — sessions played, lifetime kills, best streak,
  deaths.
- **History** — the last 16 conversation turns, replayed into the next session
  so the unit picks up where you left it.

All three are compacted into an `[OPERATOR RECORDS]` block on every AI request,
which is what makes the unit sound like it knows you. Open the drawer with
**MEM** to read or delete individual records; `/forget` or **WIPE MEMORY** in
settings clears the lot. Turning `podMemory` off suppresses the brief entirely.

Because the store is on your machine and nowhere else, wiping it is the whole
of forgetting.

## The AI link — five providers, three of them free

Off by default. Turn on **Pod AI**, pick a provider and paste its key in
Settings › Visuals › Pod AI, and typed or spoken input is answered by a model
instead of the local matcher. Combat call-outs stay local — a network round trip
cannot narrate a fight.

| Provider | Cost | Key from | Notes |
|---|---|---|---|
| **Google Gemini** (default) | **Free tier, no card** | `aistudio.google.com/apikey` | Best Arabic of the free three. The recommended starting point. |
| **Groq** | **Free tier** | `console.groq.com/keys` | Fastest first token by a wide margin. |
| **OpenRouter** | **Free models** | `openrouter.ai/keys` | Use a model id ending in `:free`. |
| **Ollama** | **Free, local, offline** | none | Run `OLLAMA_ORIGINS=* ollama serve`. No quota, no key, nothing leaves your machine. |
| **Anthropic Claude** | Paid | `console.anthropic.com` | Best quality if you are already paying. |

`PodLink` reduces all five to one call — system prompt, message list, tool list,
streamed text, tool calls out. Groq, OpenRouter and Ollama all speak the OpenAI
chat shape and share an adapter; Gemini and Anthropic each have their own.

- Every request is **streamed**, so the reply types itself into the panel and
  starts being spoken before it has finished arriving.
- **Nine tools**: `remember` and `recall` for memory, `scan` for a close reading
  of the ground, `find_player` to locate someone by name, `recommend_move` to
  get a real destination with a reason, `recon` to physically send the unit out,
  `pilot` and `set_plan` to drive the autopilot, and `say_in_game_chat` to speak
  publicly. Tool calls are wired into every provider's native format — Anthropic
  `tool_use`, OpenAI `tool_calls`, Gemini `functionCall` — and each call runs
  exactly once per round regardless of how many wire shapes it is rendered into.
- On Anthropic, assistant turns replay verbatim with thinking blocks and
  signatures intact, because stripping them is what breaks the next request, and
  server-side `fallbacks: "default"` rescues a policy decline on a sibling model.
- **Any hard failure surfaces the provider's own message and then answers
  locally**, so a bad key looks like a bad key rather than silence. There is a
  **TEST CONNECTION** button that does a real round trip and reports what came
  back.

Keys are stored in your browser's settings, never written into the file.

**Which to pick:** start with **Gemini** — free, no card, good Arabic. Switch to
**Groq** if you want the lowest latency in a fight. Use **Ollama** if you would
rather nothing left your machine at all.

## Not repeating itself

The old pod picked at random from a handful of lines on a cooldown, so it looped
within a minute. Three mechanisms replace that, and all three are needed:

1. **A shuffle deck per topic.** Lines are drawn without replacement — a topic
   with eight lines gives eight different ones before any repeat, and the
   reshuffle never puts the last-used line back at the front.
2. **Templates.** Every line takes live values — bearing, distance, name,
   health, count — so the same template reads differently each time.
3. **A novelty guard over the rendered sentence.** If the unit already said this
   exact sentence recently it stays quiet, which catches the case where the deck
   and the numbers happen to line up.

Over that sits a **chatter budget**: idle observations are capped at three a
minute, advice at six, and genuine alerts are never rationed. And the brain is
driven by *changes in state* rather than by a timer — the health warning fires
on the way down, not every tick.

The bank carries ~30 topics in both languages, in the YoRHa register: the
clipped prefixes, the flat affect, and the deadpan asides ("Query: why do humans
build walls around food?"). `tools/test-pod-ui.js` fails the build if a topic
exists in one language and not the other, or if a template's slots differ
between the two.

## Telling you where to go

`PodTactics` produces a **directive**: a real point on the map with a bearing, a
distance and a reason, marked on your screen — a diamond where it is when it is
on screen, an edge arrow with a range readout when it is not.

| Goal | What it finds |
|---|---|
| `farm` | The densest cluster of whatever resource you are shortest on |
| `retreat` | The compass octant carrying the least threat, excluding the border |
| `base` | A cluster of enemy-owned structures — someone's base |
| `centre` | Open ground, when nothing else applies |

Clusters are found by counting neighbours rather than bucketing into a grid: a
grid is cheaper but splits any cluster that straddles a cell boundary, which is
exactly the tight cluster you most want to find.

So the unit says *"Proposal: move north-east, 700 units. Dense stone in that
sector."* rather than *"gather resources"* — and the point is there to walk to.

## Finding people, and going to look

moomoo only tells the client about entities near your own view, so a literal
"scan the whole server" is not something any client-side mod can do honestly.
What it can do is **remember**, and read the one server-wide feed it has.

- **The contact archive.** Every player that enters sensor range is logged with
  a position and a timestamp, kept for ten minutes.
- **The leaderboard**, read straight off the HUD. That is server-wide — it names
  players you have never seen.

So `/find <name>` has three honest answers: a **live** contact with a bearing and
distance; an **archived** last-known position *with its age stated*; or "present
on the leaderboard at rank N, never in sensor range, no position". It never
invents a position.

`/recon <direction>` sends the unit itself out. It detaches from your shoulder,
flies, sweeps, and comes back — and while it is away it is genuinely not beside
you, the targeting laser is replaced by a sweep ring, and its report is built
from live contacts plus the archive with each stale record's age attached.

## Talking to it through the game's chat box

Three separate switches, because they have very different consequences.

| Switch | What it does |
|---|---|
| **Reach the pod from game chat** (on) | A line starting with `.` — or `pod …` / `بود …` — goes to the pod instead of the server. `.where do I go` works from the game's own chat box. |
| **Route ALL my chat to the pod** (off) | Every line you type goes to the pod and **nothing reaches the server**. |
| **Pod reads other players' chat** (on) | The last few lines of server chat are carried into the pod's briefing, so it knows who threatened you — and it calls out when someone says your name. |
| **Pod may reply in PUBLIC chat** (off) | The pod's answers go back out where everyone can read them. |
| **…and reply when someone names you** (off) | It answers unprompted when named. |

Public output is off by default and stays deliberately conservative: 30
characters (all the game carries), one line per 2.6 seconds, the YoRHa prefix
stripped, and battlefield call-outs never go out — that would be spam, and
servers mute for it. The `say_in_game_chat` tool refuses outright unless you
have turned the switch on.

## Letting it play for you

**K** hands the game over. The banner across the top of the screen says who is
driving the whole time it is on — an autopilot you cannot see is one you forget
about. **Any movement key or mouse click takes control straight back** and it
resumes a couple of seconds after you stop.

The split that makes this work: a language model cannot run a combat loop, so it
does not try.

- **The pilot** is a local state machine running at tick speed with seven goals —
  `farm`, `fight`, `flee`, `build`, `heal`, `upgrade`, `explore`. It reuses the
  client's own tested machinery: the pathfinder for movement, `place()` for
  building, `heal()` for food, the same age-upgrade path the bots follow.
- **The director** is the model, called every 15 seconds (adjustable), which
  picks the goal for the next few seconds through the `set_plan` tool — a coach
  calling a play, not moving the players. The pilot never waits on it; if the
  link is down it keeps flying on local policy.
- **Safety rules are not up for debate.** Low health picks `heal`, low health
  with an enemy picks `flee`, three or more hostiles picks `flee`, an unspent
  upgrade point gets spent. The model can only choose among what the situation
  already allows.

### What "learns" actually means

Every stretch of play under one goal is an **episode**, scored on what really
happened:

```
score = kills×40 + resources/25 + healthΔ×0.5 + ageΔ×20 − (died ? 60 : 0)
        normalised per ten seconds
```

Scores are kept per **goal and situation** (`fight@clear`, `fight@heavy`,
`farm@light` …), persisted to `localStorage`, and used two ways: the local policy
picks the best-rated eligible goal — with a 15% exploration rate so a goal that
started badly can recover — and the whole table is handed to the director in
every briefing, so the model is choosing from *your* results rather than from
what sounds good.

`/learned` prints the table. **RESET LEARNING** in settings clears it.

This is a contextual bandit over its own outcomes. It is real learning and it
genuinely improves with play — but it is not model training, and episodes under
four seconds are discarded as noise rather than counted.

## Commands

Typed in the panel, in the game's chat box behind `.`, or spoken — in either
language.

| Command | Does |
|---|---|
| `/pilot [on\|off]` | Hand the game to the pod, or take it back |
| `/learned` | What its record says works |
| `/chat <text>` | Say one line in public game chat |
| `/find <name>` | Locate a player; marks them on screen |
| `/recon [dir\|name]` | Send the unit out to sweep |
| `/go [farm\|retreat\|base\|centre]` | Get a destination, marked |
| `/board` | The server leaderboard |
| `/voice [on\|off]` | Mute or unmute; no argument toggles |
| `/lang [ar\|en]` | Switch language; no argument toggles |
| `/mic` | Toggle the microphone |
| `/remember <text>` | Store a fact |
| `/forget` | Wipe all memory |
| `/memory` | Open the memory drawer |
| `/mark` | Clear the current waypoint |
| `/clear` | Clear the conversation log |
| `/help` | Topic list |

Without the AI link the local matcher still answers `status`, `threat`, `where`,
`farm`, `base`, `build`, `scan`, `board`, `memory`, and "where is X" in either
script — every one of those answers is built from live state, so the pod is
genuinely useful with no key at all.

## Settings

Settings › **Visuals**, under three cards:

- **Pod Support Unit** — enable, unit, size, language, memory, both keybinds,
  and **WIPE MEMORY**.
- **Pod Voice** — voice on/off, call-outs, microphone, voice picker, speed,
  pitch, volume, and **SPEAK TEST LINE** (which speaks even while muted, since
  that is the point of a test button).
- **Pod Chat** — the three game-chat switches, the prefix, and the two
  public-output switches.
- **Pod Pilot** — the keybind, whether the AI directs it, how often it is asked,
  **SHOW RECORD** and **RESET LEARNING**.
- **Pod AI** — the link toggle, the provider, a key box per provider, a model
  override, **TEST CONNECTION**, and **RESET CHAT HISTORY**.

## Verification

```sh
node --check YoRHa_System.user.js
node tools/test-pod.js       # language tables, memory store, SSE parser
node tools/test-pod-ui.js    # needs: npm i --no-save jsdom
node tools/preview-pod.js    # needs: npm i --no-save playwright
```

`test-pod.js` (50 assertions) and `test-pod-ui.js` (254 assertions) both extract
the real blocks out of the userscript and run them under mocks — they test what
ships, not a copy. Between them they cover:

- the streaming pump against split frames, CRLF, fragmented tool JSON, thinking
  deltas, refusals, malformed frames and HTTP errors;
- the memory store's caps, persistence, reload and corrupt-storage handling;
- the panel's construction, typewriter, RTL flip and memory drawer, and that the
  closed panel cannot swallow a click meant for the game;
- the voice and microphone switches, including that muting actually silences;
- **the anti-repetition engine** — deck exhaustion, reshuffle behaviour, long-run
  distribution, the novelty guard, the chatter budget, template rendering, and
  that a burst of ticks on an unchanged world produces no duplicate line;
- **the world layer** — contact logging, live vs. stale vs. roster lookup,
  leaderboard parsing, cluster detection, waypoint marking;
- **recon** — launch, refusal to double-launch, outbound, sweep, report, return;
- **all three wire formats** — Anthropic, Gemini and OpenAI-compatible — each
  with a full tool round trip, plus that a tool runs exactly once per call and
  that a provider with no key never fires a request;
- **the game-chat bridge** — prefix matching, custom prefixes, route-all,
  pass-through, listening, the rate limit, the 30-character clip, and that the
  public-chat tool refuses without consent;
- **the autopilot** — every safety rule, the human override, that a hidden pod
  cannot fly, steering into the real pathfinder, swings sent only on change,
  heal/build/upgrade going through the client's own primitives, episode scoring,
  the learned table persisting across a reload, and that the policy actually
  follows what worked while still exploring.

### What could not be verified here

The Gemini endpoint was checked live and behaves as the code expects (the exact
streaming URL, and an invalid key coming back as `error.message`, which is what
the panel surfaces). **Groq and OpenRouter are blocked by the egress policy of
the environment this was built in**, so their adapters are covered by the wire
format tests above but were never run against the live services. Ollama is local
and equally unverified from here. If one of them misbehaves, **TEST CONNECTION**
will print the provider's own error.
