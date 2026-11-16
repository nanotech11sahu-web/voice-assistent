import { Lead } from '../models';
import { clean, ensureLead, emitCaptured, phoneKey } from './helpers';
// Models sometimes pass placeholders like "Unknown"; never store those.
const real = (v: any) => (typeof v === 'string' && v.trim() && !/^(unknown|unknown\?|n\/?a|none|null|undefined|not known|not provided|\?+)$/i.test(v.trim())) ? v.trim() : undefined;
export default {
  name: 'save_lead_details',
  description: 'Save lead info. Call IMMEDIATELY when the prospect says their name, and again if they correct it. Only pass fields you know.',
  parameters: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string' }, businessName: { type: 'string' },
    businessType: { type: 'string' }, city: { type: 'string' } } },
  async handler(a: any, { session }: any) {
    // GROUNDING: a value must actually have been said by the prospect (stops the model inventing business names etc.).
    const said = (session.transcript || []).filter((x: any) => x.role === 'user').map((x: any) => x.text).join(' ').toLowerCase();
    const grounded = (v: any) => { const r = real(v); if (!r) return undefined; const toks = r.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 2); return !toks.length || toks.some((w) => said.includes(w)) ? r : undefined; };
    const f: any = clean({ name: grounded(a.name), phone: real(a.phone), businessName: grounded(a.businessName), businessType: real(a.businessType), city: grounded(a.city) });
    if (!Object.keys(f).length) return { error: 'nothing to save' };
    if (f.phone) { f.phoneKey = phoneKey(f.phone); session.phone = f.phone; }
    // Merge by phone if we got one for the first time, otherwise update the current lead.
    if (f.phoneKey && !session.leadId) {
      const l: any = await Lead.findOneAndUpdate({ phoneKey: f.phoneKey }, { $set: f }, { upsert: true, new: true });
      session.leadId = l._id;
    } else { const id = await ensureLead(session); await Lead.updateOne({ _id: id }, { $set: f }); }
    if (f.name) { session.prospectName = f.name; session.prospectNameAsHeard ||= f.name; }
    session.facts = { ...(session.facts || {}), ...Object.fromEntries(Object.entries(f).filter(([k]) => ['businessName', 'businessType', 'city'].includes(k)) as any) };
    await emitCaptured(session);
    return { saved: Object.keys(f) };
  },
};
