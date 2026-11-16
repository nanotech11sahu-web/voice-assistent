import { Objection } from '../models';
const TYPES = ['price', 'instagram_whatsapp_only', 'no_time', 'not_needed', 'will_think', 'ask_partner', 'already_have_website'];
export default {
  name: 'get_objection_help', description: 'Guidance for handling a prospect objection.',
  parameters: { type: 'object', properties: { objectionType: { type: 'string', enum: TYPES } }, required: ['objectionType'] },
  async handler(a: any, { session }: any) {
    if (!TYPES.includes(a.objectionType)) return { error: 'unknown objectionType', allowed: TYPES };
    session.objections.add(a.objectionType);
    const o: any = await Objection.findOne({ type: a.objectionType }).lean();
    return o ? { empathyLine: o.empathyLine, keyPoint: o.keyPoint, softNextStep: o.softNextStep } : { error: 'not found' };
  },
};
