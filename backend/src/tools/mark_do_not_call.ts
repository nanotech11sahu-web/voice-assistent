import { Lead } from '../models';
import { ensureLead, emitCaptured } from './helpers';
export default {
  name: 'mark_do_not_call', description: 'Prospect is not interested / asked not to be called again. Call it, say a polite goodbye, the call then ends.',
  parameters: { type: 'object', properties: {} },
  async handler(_a: any, { session }: any) {
    const id = await ensureLead(session);
    await Lead.updateOne({ _id: id }, { $set: { doNotCall: true, status: 'not_interested' } });
    session.flags.doNotCall = true; await emitCaptured(session);
    return { doNotCall: true };
  },
};
