import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
// One warm connection per voice, reused for every sentence (saves ~1s of connect time per sentence).
// Synthesis on a connection is serialised; a failed/stale connection is rebuilt and the sentence retried once.
const pool = new Map<string, { tts: any; ready: Promise<void>; chain: Promise<any> }>();
function open(voice: string) {
  const tts = new MsEdgeTTS();
  const ready = tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3).then(() => {});
  ready.catch(() => pool.delete(voice));
  const e = { tts, ready, chain: Promise.resolve() as Promise<any> }; pool.set(voice, e); return e;
}
function run(e: { tts: any }, text: string): Promise<Buffer> {
  const r: any = e.tts.toStream(text, { rate: process.env.TTS_RATE || '+20%', pitch: process.env.TTS_PITCH || '+4%' }); const stream = r.audioStream ?? r; const chunks: Buffer[] = [];
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('tts timeout')), 12000);
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => { clearTimeout(t); res(Buffer.concat(chunks)); });
    stream.on('error', (err: any) => { clearTimeout(t); rej(err instanceof Error ? err : new Error(String(err?.message || err || 'tts error'))); });
  });
}
export function warmUp(voice: string) { if (!pool.has(voice)) open(voice); }
export async function synth(text: string, voice: string): Promise<Buffer> {
  let e = pool.get(voice) || open(voice);
  const job = e.chain.then(async () => {
    try { await e.ready; return await run(e, text); }
    catch { pool.delete(voice); e = open(voice); await e.ready; return await run(e, text); }
  });
  e.chain = job.catch(() => {}); return job;
}
// Strip things that should never be spoken.
export const speechClean = (t: string) =>
  t.replace(/https?:\/\/\S+/g, '').replace(/[*_#`>~]/g, '').replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();

// Sentence splitting for streaming: emit a sentence only when punctuation is followed by whitespace
// (so "2.5" isn't split) and merge very short ones ("Okay.") into the next to avoid choppy audio.
export class Splitter {
  private buf = ''; private carry = '';
  push(t: string): string[] {
    this.buf += t; const out: string[] = []; const re = /([^.!?।\n]+[.!?।]+)\s+/g; let m: RegExpExecArray | null; let last = 0;
    while ((m = re.exec(this.buf))) { this.carry += (this.carry ? ' ' : '') + m[1].trim(); last = re.lastIndex; if (this.carry.length >= 20) { out.push(this.carry); this.carry = ''; } }
    this.buf = this.buf.slice(last); return out;
  }
  flush(): string[] { const rest = [this.carry, this.buf.trim()].filter(Boolean).join(' '); this.buf = this.carry = ''; return rest ? [rest] : []; }
}
