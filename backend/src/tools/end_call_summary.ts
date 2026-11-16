import { CallLog, Lead } from '../models';
// Internal: called by the backend at call end, never exposed to the LLM.
export default {
  name: 'end_call_summary', internal: true, description: '', parameters: { type: 'object', properties: {} },
  async handler(a: any, { session: s }: any) {
    const ended = new Date();
    const log = await CallLog.create({
      leadId: s.leadId, startedAt: s.startedAt, endedAt: ended, durationSec: Math.round((+ended - +s.startedAt) / 1000),
      fullTranscript: s.transcript.map((t: any) => ({ role: t.role, text: t.text })),
      prospectNameAsHeard: s.prospectNameAsHeard, finalName: s.prospectName, summary: a.summary || '',
      prospectInterestLevel: ['hot', 'warm', 'cold'].includes(a.prospectInterestLevel) ? a.prospectInterestLevel : 'cold',
      objectionsRaised: [...new Set([...(a.objectionsRaised || []), ...s.objections])], nextStep: a.nextStep || '',
      callbackTime: s.flags.callbackTime, sendLinksRequested: !!(a.sendLinksRequested || s.flags.sendLinksRequested),
      outcome: s.flags.doNotCall ? 'do_not_call' : a.outcome || 'unknown',
    });
    if (s.leadId && !s.flags.doNotCall && a.prospectInterestLevel === 'hot') await Lead.updateOne({ _id: s.leadId }, { $set: { status: 'interested' } });
    else if (s.leadId) await Lead.updateOne({ _id: s.leadId, status: 'new' }, { $set: { status: 'contacted' } });
    return { id: log._id };
  },
};
