# Nayandeep AI voice calling agent (test system)

Browser mic + speaker "phone call" with an AI sales agent. Grok (xAI) for the brain, Chrome Web Speech for STT, free Edge voices for TTS, MongoDB for records. Testing only.

## Setup
Requires Node 18+, MongoDB running locally (or Atlas URI), Chrome, and a Grok key.

```
cd backend
cp .env.example .env      # set GROK_API_KEY
npm i
npm run seed              # idempotent; never touches requirements or call_logs
npm run start:dev         # http://localhost:3000 , websocket at /ws

cd ../frontend
npm i
npm run dev               # http://localhost:5173
```
Use headphones: speakers can leak into the mic and trigger barge-in.

## Env vars (backend/.env)
| Var | Meaning |
|---|---|
| GROK_API_KEY | xAI key (backend only, never logged or sent to the browser) |
| GROK_MODEL | default `grok-3-mini` |
| MONGODB_URI | Mongo connection string |
| PORT | default 3000 |
| DEFAULT_VOICE | default `en-IN-PrabhatNeural` |

Identity, services and voices live in `backend/src/config.ts`. Frontend can point elsewhere with `VITE_WS_URL` and `VITE_API_URL`.

## How it works
`call.server.ts` handles the websocket: greeting on connect, streaming Grok, tool loop, sentence splitting (`tts.ts`), parallel TTS with ordered sending, barge-in (`interrupt` aborts the Grok stream and drops pending audio), and a final summary saved to `call_logs` even on hang-up. The saved name is injected into the system prompt every turn (`prompt.ts`). STT is behind the `STT` interface in `frontend/src/stt.ts` so faster-whisper can replace it later.

## How to add a tool
1. Create `backend/src/tools/my_tool.ts` exporting `{ name, description, parameters (JSON schema), handler(args, { session }) }`. Validate inputs, return small JSON. For writes, use `clean()` from `helpers.ts` so empty values never overwrite.
2. Import it and add it to the `ALL` array in `backend/src/tools/index.ts`.
3. Mention when to use it in `backend/src/prompt.ts`.

## Roleplay tests (check the Mongo collections afterwards)
| # | Scenario | Expected behaviour | Expected DB |
|---|---|---|---|
| 1 | Interested shop owner: give name, say you run a shop in Betul with no website, answer requirement questions | Asks name first, saves it, asks about business, mentions PMC Yellow Pages, asks one requirement at a time | `leads` has name, business, city; `requirements` filled progressively; `call_logs` interest hot/warm, next step set |
| 2 | Price objection: "how much will it cost?" / "too expensive" | No numbers; says a quote follows after understanding needs; offers free consultation | `quoteRequested: true`; `objectionsRaised` includes `price` |
| 3 | "I'm only on Instagram" | Empathy, website is your own place on Google, soft next step | `objectionsRaised` includes `instagram_whatsapp_only` |
| 4 | "Not interested, don't call again" | Polite goodbye, call ends by itself | `leads.doNotCall: true`, status `not_interested`; `call_logs.outcome: do_not_call` |
| 5 | Hindi: pick Hindi, speak Hindi/Hinglish | Replies in Hindi, uses "ji" after the name | Same records as #1 |
| 6 | Refuse name: "why do you need my name?" | "No problem", continues without the name | `finalName` empty; no invented name |
| 7 | Correct the name mid-call: "Actually it's Rohit, not Rahul" | Calls `save_lead_details` again, uses Rohit afterwards | `leads.name: Rohit`; `prospectNameAsHeard` keeps first version, `finalName: Rohit` |

Seeded sample leads (fake numbers `+91 90000 00001-3`, the third has no name): type the number into "Prospect phone" to test the lookup flow.

## Notes
- Portfolio descriptions in `seed.ts` carry `// TODO: verify description`; edit and re-run `npm run seed`.
- Not tested end to end with a live Grok key or microphone in my environment: both packages compile and the frontend builds, but run through the 7 scenarios yourself first.
