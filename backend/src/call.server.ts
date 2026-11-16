import { WebSocketServer } from 'ws';
import OpenAI from 'openai';
import { randomUUID } from 'crypto';
import { cfg, VOICES, AGENT_NAME } from './config';
import { buildPrompt } from './prompt';
import { toolSpecs, runTool } from './tools';
import { synth, warmUp, speechClean, Splitter } from './tts';
import { Session } from './session';

const llm = new OpenAI({ apiKey: cfg.grokKey || 'missing', baseURL: process.env.LLM_BASE_URL || 'https://api.x.ai/v1' });
const GREET = `(The call just connected. Say exactly this and nothing else: "Hi, this is ${AGENT_NAME}, an AI assistant. We help businesses get their own website. May I know who I'm speaking with?")`;
const SILENT = '(The prospect has been silent for about 8 seconds. Say one short check-in line.)';
const FALLBACK = { 'en-IN': 'Sorry, I had a small problem, could you say that again?', 'hi-IN': 'Maaf kijiye, thodi problem ho gayi, kya aap dobara bol sakte hain?' };

// Keep last ~20 messages but never start on a tool/assistant-tool fragment.
function trimmed(h: any[]) {
  let t = h.slice(-12);
  while (t.length && t[0].role !== 'user') t = t.slice(1);
  return t;
}

async function runTurn(s: Session, hidden?: string, retried = false): Promise<void> {
  s.abort?.abort(); // a new turn always cancels the previous one
  const ac = new AbortController(); s.abort = ac; const turn = ++s.turn;
  if (hidden) s.history.push({ role: 'user', content: hidden });
  const sp = new Splitter(); let spoken = ''; let chain: Promise<void> = Promise.resolve();

  // AUDIO ORDERING: synthesis starts immediately (parallel), but sending is chained so clips go out in order.
  const speak = (raw: string) => {
    const text = speechClean(raw); if (!text) return;
    const audio = synth(text, s.voice).catch((e) => { console.error('tts failed:', e.message); return null; });
    const prev = chain;
    chain = (async () => {
      await prev; const buf = await audio; if (ac.signal.aborted) return;
      spoken += text + ' ';
      const last = s.transcript[s.transcript.length - 1];
      if (last?.role === 'assistant' && last.turn === turn) last.text += ' ' + text; else s.transcript.push({ role: 'assistant', text, turn });
      s.send({ type: 'ai_text', turn, text });
      s.send({ type: 'audio', turn, seq: s.seq++, data: buf ? buf.toString('base64') : null });
    })();
  };

  try {
    s.send({ type: 'status', value: 'thinking' });
    for (let round = 0; round < 5; round++) {
      const stream: AsyncIterable<any> = await (llm.chat.completions.create as any).call(llm.chat.completions, {
        model: cfg.model, tools: s.phone ? toolSpecs : toolSpecs.filter((t) => t.function.name !== 'get_lead_by_phone'), stream: true, ...(cfg.model.includes('gpt-oss') ? { reasoning_effort: 'low' } : {}) as any,
        messages: [{ role: 'system', content: buildPrompt(s) }, ...trimmed(s.history)],
      }, { signal: ac.signal });
      let content = ''; const calls: any[] = [];
      for await (const chunk of stream) {
        const d: any = chunk.choices[0]?.delta; if (!d) continue;
        if (d.content) { content += d.content; sp.push(d.content).forEach(speak); }
        for (const tc of d.tool_calls || []) {
          const c = (calls[tc.index] ||= { id: '', name: '', args: '' });
          if (tc.id) c.id = tc.id; if (tc.function?.name) c.name += tc.function.name; if (tc.function?.arguments) c.args += tc.function.arguments;
        }
      }
      sp.flush().forEach(speak); // speak any text said before a tool call
      if (!calls.length) { if (content) s.history.push({ role: 'assistant', content }); break; }
      s.history.push({ role: 'assistant', content: content || null, tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args || '{}' } })) });
      for (const c of calls) {
        const result = await runTool(c.name, c.args, { session: s });
        s.send({ type: 'tool', name: c.name, args: c.args, result });
        s.history.push({ role: 'tool', tool_call_id: c.id, content: result });
      }
    }
    await chain;
    if (!ac.signal.aborted) { s.send({ type: 'turn_done', turn }); if (s.flags.doNotCall) s.send({ type: 'hangup' }); }
  } catch (e: any) {
    if (ac.signal.aborted) { // barge-in: remember only what was actually spoken
      if (spoken.trim()) s.history.push({ role: 'assistant', content: spoken.trim() }); return;
    }
    console.error('turn failed:', e?.message); // never log the key
    if (!retried && /validation failed|tool call/i.test(e?.message || '')) return runTurn(s, undefined, true); // model glitched on a tool name: try once more
    speak(FALLBACK[s.language] || FALLBACK['en-IN']); await chain; s.send({ type: 'turn_done', turn });
  }
}

async function finalize(s: Session) {
  if (s.ended) return; s.ended = true; s.abort?.abort();
  let sum: any = {};
  const hasUser = s.transcript.some((t) => t.role === 'user');
  try {
    if (hasUser) {
      const text = s.transcript.map((t) => `${t.role === 'user' ? 'Prospect' : 'Agent'}: ${t.text}`).join('\n');
      const r = await llm.chat.completions.create({ model: cfg.model, messages: [
        { role: 'system', content: 'Return ONLY JSON, no markdown: {"summary":string (2-3 sentences),"prospectInterestLevel":"hot"|"warm"|"cold","objectionsRaised":string[],"nextStep":string,"outcome":string,"sendLinksRequested":boolean}' },
        { role: 'user', content: text }] });
      sum = JSON.parse((r.choices[0].message.content || '{}').replace(/```json|```/g, '').trim());
    } else sum = { summary: 'Call ended before the prospect spoke.', outcome: 'no_conversation' };
  } catch (e: any) { console.error('summary failed:', e?.message); sum = { summary: 'Summary generation failed; see transcript.' }; }
  try { await runTool('end_call_summary', JSON.stringify(sum), { session: s }); } catch (e: any) { console.error('log save failed:', e?.message); }
  s.send({ type: 'ended' });
}

export function attachCallServer(httpServer: any) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (ws) => {
    let s: Session | null = null;
    ws.on('message', async (raw) => {
      let m: any; try { m = JSON.parse(raw.toString()); } catch { return; }
      if (m.type === 'start' && !s) {
        const language = m.language in VOICES ? m.language : 'en-IN';
        s = { id: randomUUID(), send: (o) => ws.readyState === 1 && ws.send(JSON.stringify(o)), history: [], transcript: [], turn: 0, seq: 0,
          phone: m.phone || undefined, language, voice: m.voice || (language === 'hi-IN' ? VOICES['hi-IN'].female : cfg.defaultVoice),
          startedAt: new Date(), ended: false, objections: new Set(), flags: { sendLinksRequested: false, quoteRequested: false, doNotCall: false } };
        warmUp(s.voice); s.send({ type: 'ready' }); runTurn(s, GREET); // the AI speaks first
      } else if (!s) return;
      else if (m.type === 'user_text' && m.text) { s.transcript.push({ role: 'user', text: m.text }); s.history.push({ role: 'user', content: m.text }); runTurn(s); }
      else if (m.type === 'interrupt') { s.abort?.abort(); s.send({ type: 'cleared' }); } // BARGE-IN
      else if (m.type === 'silence') runTurn(s, SILENT);
      else if (m.type === 'end') { await finalize(s); ws.close(); }
    });
    ws.on('close', () => s && finalize(s)); // hang-up mid-call still saves the log
  });
}
