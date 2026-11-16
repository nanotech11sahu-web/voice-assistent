import { Lead } from '../models';
import { phoneKey } from './helpers';
export default {
  name: 'get_lead_by_phone', description: 'Look up an existing lead by phone. If found, confirm the name with the prospect before using it.',
  parameters: { type: 'object', properties: { phone: { type: 'string' } }, required: ['phone'] },
  async handler(a: any, { session }: any) {
    const k = phoneKey(a.phone); if (k.length < 10) return { error: 'invalid phone' };
    const l: any = await Lead.findOne({ phoneKey: k }).lean();
    if (!l) return { found: false };
    session.leadId = l._id;
    return { found: true, name: l.name, businessName: l.businessName, businessType: l.businessType, city: l.city, status: l.status, doNotCall: l.doNotCall };
  },
};
