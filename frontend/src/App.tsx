import { useEffect, useRef, useState } from 'react';
import { WhisperSTT } from './stt';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const VOICES: Record<string, { id: string; label: string }[]> = {
  'en-IN': [{ id: 'en-IN-NeerjaExpressiveNeural', label: 'Neerja Expressive (female, sweeter)' }, { id: 'en-IN-NeerjaNeural', label: 'Neerja (female)' }, { id: 'en-IN-PrabhatNeural', label: 'Prabhat (male)' }],
  'hi-IN': [{ id: 'hi-IN-SwaraNeural', label: 'Swara (female)' }, { id: 'hi-IN-MadhurNeural', label: 'Madhur (male)' }],
};
type Status = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking';
const LABEL: Record<Status, string> = { idle: 'Not in a call', connecting: 'Connecting', listening: 'Listening', thinking: 'Thinking', speaking: 'Speaking' };

export default function App() {
  const [page, setPage] = useState<'call' | 'history'>('call');
  const [status, setStatus] = useState<Status>('idle');
  const [lang, setLang] = useState('en-IN'); const [voice, setVoice] = useState(VOICES['en-IN'][0].id); const [phone, setPhone] = useState(''); const [phones, setPhones] = useState(false); const headphones = useRef(false);
  const [lines, setLines] = useState<{ role: string; text: string; turn?: number }[]>([]);
  const [captured, setCaptured] = useState<any>({}); const [tools, setTools] = useState<any[]>([]);
  const [heard, setHeard] = useState(''); const [error, setError] = useState(''); const [calls, setCalls] = useState<any[]>([]);
  const ws = useRef<WebSocket | null>(null); const stt = useRef(new WhisperSTT());
  const queue = useRef<any[]>([]); const playing = useRef(false); const audio = useRef<HTMLAudioElement | null>(null);
  const turnDone = useRef(true); const ignoring = useRef(false); const hangup = useRef(false); const inCall = useRef(false);
  const micStream = useRef<MediaStream | null>(null); const vadTimer = useRef<any>(null); const aiSaid = useRef(''); const lastPlayEnd = useRef(0); const interimSince = useRef(0); const silenceTimer = useRef<any>(null); const silenceSent = useRef(false);
  const send = (o: any) => ws.current?.readyState === 1 && ws.current.send(JSON.stringify(o));

  const clearSilence = () => clearTimeout(silenceTimer.current);
  const armSilence = () => { // one check-in per silence
    clearSilence(); if (silenceSent.current || !inCall.current) return;
    silenceTimer.current = setTimeout(() => { silenceSent.current = true; turnDone.current = false; setStatus('thinking'); send({ type: 'silence' }); }, 8000);
  };
  const idleNow = () => {
    if (hangup.current) return endCall();
    setStatus('listening'); armSilence();
  };
  const playNext = () => {
    if (playing.current) return;
    const item = queue.current.shift();
    if (!item) { if (turnDone.current && inCall.current) { setTimeout(() => { if (inCall.current && !playing.current) stt.current.resume(); }, 250); idleNow(); } return; }
    if (!item.data) return playNext();
    clearSilence(); playing.current = true; setStatus('speaking'); if (!headphones.current) stt.current.pause();
    const a = new Audio('data:audio/mpeg;base64,' + item.data); audio.current = a;
    a.onended = a.onerror = () => { playing.current = false; lastPlayEnd.current = Date.now(); playNext(); };
    a.play().catch(() => { playing.current = false; playNext(); });
  };
  const stopPlayback = () => { queue.current = []; audio.current?.pause(); playing.current = false; if (!headphones.current) setTimeout(() => inCall.current && stt.current.resume(), 250); };

  const bargeIn = () => { interimSince.current = 0; lastPlayEnd.current = 0; stopPlayback(); ignoring.current = true; send({ type: 'interrupt' }); stt.current.resume(); };
  const stopVad = () => {};
  const onServer = (m: any) => {
    if (m.type === 'ai_text') { aiSaid.current = (aiSaid.current + ' ' + m.text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ')).replace(/\s+/g, ' ').slice(-800); setLines((l) => { const last = l[l.length - 1];
      return last?.role === 'ai' && last.turn === m.turn ? [...l.slice(0, -1), { ...last, text: last.text + ' ' + m.text }] : [...l, { role: 'ai', text: m.text, turn: m.turn }]; }); }
    else if (m.type === 'audio') { if (ignoring.current) return; queue.current.push(m); playNext(); }
    else if (m.type === 'status') setStatus(m.value);
    else if (m.type === 'turn_done') { turnDone.current = true; if (!playing.current && !queue.current.length) { setTimeout(() => { if (inCall.current && !playing.current) stt.current.resume(); }, 250); idleNow(); } }
    else if (m.type === 'cleared') ignoring.current = false;
    else if (m.type === 'tool') setTools((t) => [{ name: m.name, args: m.args, result: m.result }, ...t]);
    else if (m.type === 'captured') setCaptured(m);
    else if (m.type === 'hangup') hangup.current = true;
    else if (m.type === 'ended') { setStatus('idle'); }
  };

  const startCall = async () => {
    setError(''); setLines([]); setTools([]); setCaptured({});
    if (!stt.current.supported()) return setError('This browser cannot access the microphone. Please use Google Chrome.');
    setStatus('connecting'); inCall.current = true; hangup.current = false; turnDone.current = false; silenceSent.current = false; ignoring.current = false;
    const sock = new WebSocket(WS_URL); ws.current = sock;
    sock.onopen = () => {
      sock.send(JSON.stringify({ type: 'start', language: lang, voice, phone: phone.trim() || undefined }));
      stt.current.start(lang, {
        onInterim: (text) => { setHeard(text); if (text) { silenceSent.current = false; clearSilence(); } },
        isPlaying: () => playing.current || queue.current.length > 0,
        onBarge: () => bargeIn(),
        bargeLevel: () => (headphones.current ? 0.05 : 0.12),
        transcribe: async (wav, language) => { const r = await fetch(API + '/transcribe?lang=' + language, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: wav }); if (!r.ok) throw new Error('stt'); return (await r.json()).text || ''; },
        onFinal: (text) => {
          // ECHO GUARD: ignore text heard while the AI is talking (or just after), it is the speaker leaking into the mic
          const w = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').split(/\s+/).filter(Boolean);
          const aiBusy = playing.current || queue.current.length > 0 || Date.now() - lastPlayEnd.current < 300;
                    const common = w.filter((x) => aiSaid.current.includes(' ' + x + ' ')).length;
          if (aiBusy || (w.length >= 4 && (aiSaid.current.includes(w.join(' ')) || common / w.length >= 0.8))) return;
          setHeard(''); silenceSent.current = false; clearSilence(); stopPlayback();
          setLines((l) => [...l, { role: 'user', text }]); turnDone.current = false; setStatus('thinking'); send({ type: 'user_text', text });
        },
        onError: (c) => { if (c === 'mic-denied') { setError('Microphone access was denied. Allow it in browser settings.'); endCall(); } else if (c !== 'transcribe') setError('Speech recognition error: ' + c); },
      });
    };
    sock.onmessage = (e) => onServer(JSON.parse(e.data));
    sock.onerror = () => setError('Cannot reach the backend. Is it running on ' + WS_URL + '?');
    sock.onclose = () => { inCall.current = false; stopVad(); stt.current.stop(); stopPlayback(); clearSilence(); setStatus('idle'); };
  };
  function endCall() { inCall.current = false; stopVad(); stt.current.stop(); stopPlayback(); clearSilence(); send({ type: 'end' }); setStatus('idle'); }
  useEffect(() => () => { ws.current?.close(); stt.current.stop(); }, []);
  useEffect(() => { if (page === 'history') fetch(API + '/calls').then((r) => r.json()).then(setCalls).catch(() => setError('Could not load call history.')); }, [page]);

  const lead = captured.lead || {}; const req = captured.requirements || {};
  const reqRows = Object.entries(req).filter(([k, v]) => !['_id', '__v', 'leadId', 'callId', 'createdAt', 'updatedAt'].includes(k) && v !== '' && !(Array.isArray(v) && !v.length));
  const inACall = status !== 'idle';

  return (<div className="app">
    <header><h1>Nayandeep voice agent</h1>
      <nav><button className={page === 'call' ? 'on' : ''} onClick={() => setPage('call')}>Call</button>
        <button className={page === 'history' ? 'on' : ''} onClick={() => setPage('history')}>Call history</button></nav></header>
    {error && <p className="err" role="alert">{error}</p>}
    {page === 'call' ? (<main className="grid">
      <section className="stage">
        <div className="controls">
          <select disabled={inACall} value={lang} onChange={(e) => { setLang(e.target.value); setVoice(VOICES[e.target.value][0].id); }}>
            <option value="en-IN">English (India)</option><option value="hi-IN">Hindi</option></select>
          <select disabled={inACall} value={voice} onChange={(e) => setVoice(e.target.value)}>{VOICES[lang].map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
          <input disabled={inACall} placeholder="Prospect phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} />
          {inACall ? <button className="end" onClick={endCall}>End call</button> : <button className="start" onClick={startCall}>Start call</button>}
        </div>
        <div className={'status s-' + status}><span className="dot" />{LABEL[status]}{heard && status === 'listening' ? <span className="muted"> · hearing: {heard}</span> : null}</div>
        <label className="hint"><input type="checkbox" checked={phones} onChange={(e) => { setPhones(e.target.checked); headphones.current = e.target.checked; }} /> I'm wearing headphones (best quality). You can interrupt the AI by speaking either way. Chrome only.</label>
        <div className="transcript">{lines.length === 0 && <p className="empty">Press Start call. Nayandeep speaks first and asks your name.</p>}
          {lines.map((l, i) => <p key={i} className={l.role}><b>{l.role === 'ai' ? 'Nayandeep' : 'You'}</b>{l.text}</p>)}</div>
      </section>
      <aside>
        <div className="panel"><h2>Captured</h2>
          <div className="name">{captured.name || <span className="muted">Name not captured yet</span>}</div>
          <dl>{['phone', 'businessName', 'businessType', 'city', 'status'].map((k) => lead[k] ? <div key={k}><dt>{k}</dt><dd>{lead[k]}</dd></div> : null)}
            {reqRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}
            {captured.flags?.callbackTime && <div><dt>callback</dt><dd>{captured.flags.callbackTime}</dd></div>}
            {captured.flags?.doNotCall && <div><dt>doNotCall</dt><dd>true</dd></div>}</dl></div>
        <div className="panel"><h2>Tool calls</h2>{tools.length === 0 && <p className="muted">None yet</p>}
          {tools.map((t, i) => <details key={i}><summary>{t.name}</summary><pre>{t.args}{'\n→ '}{t.result}</pre></details>)}</div>
      </aside></main>
    ) : (<main className="history">{calls.length === 0 && <p className="empty">No calls recorded yet.</p>}
      {calls.map((c) => <article key={c._id}><div className="row"><h3>{c.finalName || c.leadId?.name || 'Unknown caller'}</h3>
        <span className={'chip ' + c.prospectInterestLevel}>{c.prospectInterestLevel}</span></div>
        <p>{c.summary}</p><p className="muted">Next step: {c.nextStep || 'none'} · {new Date(c.startedAt).toLocaleString()} · {c.durationSec}s · {c.outcome}</p></article>)}</main>)}
  </div>);
}
