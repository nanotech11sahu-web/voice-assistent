import { Lead } from '../models';
import { ensureLead, emitCaptured } from './helpers';
export default {
  name: 'schedule_callback', description: 'Save a callback time the prospect asked for.',
  parameters: { type: 'object', properties: { datetime: { type: 'string', description: 'As the prospect said it, e.g. "tomorrow 5 pm"' }, note: { type: 'string' } }, required: ['datetime'] },
  async handler(a: any, { session }: any) {
    if (!a.datetime) return { error: 'datetime required' };
    const id = await ensureLead(session);
    await Lead.updateOne({ _id: id }, { $set: { status: 'callback', callbackAt: a.datetime, callbackNote: a.note || '' } });
    session.flags.callbackTime = a.datetime; await emitCaptured(session);
    return { scheduled: a.datetime };
  },
};
