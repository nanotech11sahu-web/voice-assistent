import { Faq } from '../models';
export default {
  name: 'search_faqs', description: 'Search FAQs (timeline, mobile, hosting, SEO, support, process...). No prices exist here.',
  parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  async handler(a: any) {
    const words = String(a.query || '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    if (!words.length) return { error: 'query required' };
    const rx = new RegExp(words.join('|'), 'i');
    const docs = await Faq.find({ $or: [{ question: rx }, { answer: rx }, { keywords: rx }] }).limit(3).lean();
    return docs.length ? docs.map((d: any) => ({ q: d.question, a: d.answer })) : { note: 'No match. Say you will check and the owner will follow up.' };
  },
};
