import { Requirement, Lead } from '../models';
import { clean, ensureLead, emitCaptured } from './helpers';
const S = { type: 'string' }, B = { type: 'boolean' }, A = { type: 'array', items: { type: 'string' } };
export default {
  name: 'save_requirements', description: 'Save website requirements learned so far. Call progressively. Only pass new fields.',
  parameters: { type: 'object', properties: { businessType: S, goals: S, websiteType: S, pagesFeatures: A, languages: A, hasLogo: B, hasContent: B,
    hasDomain: B, hasHosting: B, referenceSites: A, budgetRange: S, timeline: S, decisionMaker: S, notes: S, quoteRequested: B } },
  async handler(a: any, { session }: any) {
    const f: any = clean(a);
    for (const k of ['hasLogo', 'hasContent', 'hasDomain', 'hasHosting', 'quoteRequested']) if (typeof a[k] === 'boolean') f[k] = a[k];
    if (!Object.keys(f).length) return { error: 'nothing to save' };
    const leadId = await ensureLead(session);
    const arrays: any = {}; for (const k of ['pagesFeatures', 'languages', 'referenceSites']) if (f[k]) { arrays[k] = { $each: f[k] }; delete f[k]; }
    const upd: any = { $set: f, $setOnInsert: { leadId, callId: session.id } };
    if (Object.keys(arrays).length) upd.$addToSet = arrays; // arrays merge, never overwrite
    await Requirement.findOneAndUpdate({ leadId, callId: session.id }, upd, { upsert: true });
    if (f.quoteRequested) session.flags.quoteRequested = true;
    await Lead.updateOne({ _id: leadId, status: 'new' }, { $set: { status: 'interested' } });
    await emitCaptured(session);
    return { saved: [...Object.keys(f), ...Object.keys(arrays)] };
  },
};
