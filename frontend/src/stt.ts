// Speech-to-text: captures mic audio with echo cancellation, detects when you start/stop talking (VAD),
// and sends each utterance to the backend (Groq Whisper) for transcription. Also detects barge-in.
export interface STT {
  supported(): boolean;
  start(lang: string, h: Handlers): void;
  stop(): void;
  pause(): void;
  resume(): void;
}
export interface Handlers {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(code: string): void;
  isPlaying(): boolean;            // is the AI audio playing right now
  onBarge(): void;
  bargeLevel?(): number;           // mic level needed to interrupt the AI                  // user started talking over the AI
  transcribe(wav: Blob, lang: string): Promise<string>;
}

function encodeWav(chunks: Float32Array[], inRate: number): Blob {
  let n = 0; for (const c of chunks) n += c.length;
  const all = new Float32Array(n); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  const outRate = 16000, ratio = inRate / outRate, len = Math.floor(n / ratio);
  const pcm = new Int16Array(len);
  for (let i = 0; i < len; i++) { // average samples in each window = cheap low-pass downsample
    const a = Math.floor(i * ratio), b = Math.min(n, Math.floor((i + 1) * ratio)); let s = 0; for (let j = a; j < b; j++) s += all[j];
    const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
  }
  const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
  const w = (p: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
  dv.setUint16(22, 1, true); dv.setUint32(24, outRate, true); dv.setUint32(28, outRate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, pcm.length * 2, true); new Int16Array(buf, 44).set(pcm);
  return new Blob([buf], { type: 'audio/wav' });
}

export class WhisperSTT implements STT {
  private stream: MediaStream | null = null; private ctx: AudioContext | null = null; private node: ScriptProcessorNode | null = null;
  private running = false;
  supported() { return !!(navigator.mediaDevices?.getUserMedia && (window as any).AudioContext); }
  async start(lang: string, h: Handlers) {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    } catch { h.onError('mic-denied'); return; }
    this.running = true;
    const ctx = new AudioContext(); this.ctx = ctx; const src = ctx.createMediaStreamSource(this.stream);
    const node = ctx.createScriptProcessor(2048, 1, 1); this.node = node;
    const mute = ctx.createGain(); mute.gain.value = 0; src.connect(node); node.connect(mute); mute.connect(ctx.destination);
    const rate = ctx.sampleRate; const frameMs = (2048 / rate) * 1000;
    let floor = 0.01, preroll: Float32Array[] = [], rec: Float32Array[] | null = null, loud = 0, quiet = 0, recMs = 0, aiLoud = 0, lastPlay = 0;
    const maxPre = Math.ceil(500 / frameMs);
    node.onaudioprocess = (e) => {
      if (!this.running) return;
      const x = new Float32Array(e.inputBuffer.getChannelData(0)); let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; const rms = Math.sqrt(s / x.length);
      const playing = h.isPlaying(); if (playing) lastPlay = Date.now();
      if (playing) { // AI is talking: only watch for a real interruption
        if (rms > Math.max(h.bargeLevel?.() ?? 0.05, floor * 4)) aiLoud += frameMs; else aiLoud = Math.max(0, aiLoud - frameMs / 2);
        if (aiLoud >= 400 && !rec) { aiLoud = 0; h.onBarge(); rec = [...preroll]; recMs = 0; quiet = 0; }
        preroll.push(x); if (preroll.length > maxPre) preroll.shift();
        if (!rec) return;
      } else aiLoud = 0;
      const thr = Math.max(0.02, floor * 3);
      if (!rec) {
        if (Date.now() - lastPlay < 350) return; // let the tail of the AI audio die out
        floor = floor * 0.97 + rms * 0.03;
        preroll.push(x); if (preroll.length > maxPre) preroll.shift();
        if (rms > thr) loud += frameMs; else loud = 0;
        if (loud >= 120) { rec = [...preroll]; recMs = 0; quiet = 0; loud = 0; h.onInterim('…'); }
        return;
      }
      rec.push(x); recMs += frameMs; if (rms > thr * 0.7) quiet = 0; else quiet += frameMs;
      if (quiet >= 650 || recMs > 25000) { // utterance finished
        const chunks = rec; rec = null; preroll = []; const dur = recMs - quiet;
        if (dur < 350) { h.onInterim(''); return; }
        h.onInterim('…');
        h.transcribe(encodeWav(chunks, rate), lang).then((t) => { t = (t || '').trim(); if (t) h.onFinal(t); else h.onInterim(''); })
          .catch(() => { h.onInterim(''); h.onError('transcribe'); });
      }
    };
  }
  stop() { this.running = false; try { this.node?.disconnect(); } catch {} try { this.ctx?.close(); } catch {} this.stream?.getTracks().forEach((t) => t.stop()); this.stream = null; this.ctx = null; this.node = null; }
  pause() {} resume() {} // not needed: echo cancellation + only listening for interruptions while the AI speaks
}
