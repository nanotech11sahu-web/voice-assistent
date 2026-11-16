import { Lead, Requirement } from '../models';
import { Session } from '../session';
export const clean = (o: any) => Object.fromEntries(Object.entries(o).filter(([, v]) =>
  v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)));
export const phoneKey = (p?: string) => (p || '').replace(/\D/g, '').slice(-10);
// Creates an anonymous lead if we have no id yet (e.g. caller hasn't given a phone).
export async function ensureLead(s: Session) {
  if (s.leadId) return s.leadId;
  const key = phoneKey(s.phone);
  const lead = key ? await Lead.findOneAndUpdate({ phoneKey: key }, { $setOnInsert: { phone: s.phone, phoneKey: key } }, { upsert: true, new: true })
                   : await Lead.create({});
  s.leadId = lead._id; return lead._id;
}
export async function emitCaptured(s: Session) {
  const lead = s.leadId ? await Lead.findById(s.leadId).lean() : null;
  const requirements = s.leadId ? await Requirement.findOne({ leadId: s.leadId, callId: s.id }).lean() : null;
  s.send({ type: 'captured', name: s.prospectName, lead, requirements, flags: s.flags });
}
