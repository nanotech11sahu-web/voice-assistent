import { Portfolio } from '../models';
export default {
  name: 'get_portfolio', description: 'Get our real portfolio sites, optionally filtered by category or prospect business type.',
  parameters: { type: 'object', properties: { category: { type: 'string' } } },
  async handler(a: any) {
    const c = (a.category || '').trim();
    let docs = await Portfolio.find().lean();
    if (c) { const r = docs.filter((d: any) => [d.category, ...(d.relevantFor || [])].join(' ').toLowerCase().includes(c.toLowerCase())); if (r.length) docs = r; }
    // URLs intentionally omitted: the agent must only say spoken names.
    return docs.map((d: any) => ({ name: d.name, spokenName: d.spokenName, category: d.category, description: d.shortDescription, highlights: d.highlights, note: d.note }));
  },
};
