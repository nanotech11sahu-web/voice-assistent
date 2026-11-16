import mongoose from 'mongoose';
import { cfg } from './config';
import { Portfolio, Service, Faq, Objection, Lead } from './models';

const portfolio = [
  // TODO: verify description
  { name: 'ConnectBhai', url: 'https://staging.connectbhai.com', spokenName: 'connect bhai', category: 'platform', shortDescription: 'A platform built by us that connects people and businesses.', highlights: [], note: 'currently a staging site', relevantFor: ['startup', 'platform', 'general business'] },
  // TODO: verify description
  { name: 'PMC Yellow Pages', url: 'https://pmcyellowpages.com', spokenName: 'P M C yellow pages', category: 'business directory', shortDescription: 'An online business directory for Odisha where local businesses get listed and customers can find them.', highlights: [], relevantFor: ['shop', 'retail', 'service provider', 'local business', 'clinic', 'coaching', 'restaurant'] },
  // TODO: verify description
  { name: 'Madamsaab', url: 'https://madamsaab.com', spokenName: 'madam saab', category: 'website', shortDescription: 'A website built by us for the Madamsaab brand.', highlights: [], relevantFor: ['brand', 'general business', 'boutique', 'fashion'] },
  // TODO: verify description
  { name: 'LikeMe', url: 'https://likeme.co.in', spokenName: 'like me dot co dot in', category: 'website', shortDescription: 'A website built by us for the LikeMe brand.', highlights: [], relevantFor: ['brand', 'general business', 'personal brand'] },
];
const services = [
  ['Business websites', 'Professional websites that present your business, services and contact details.'],
  ['Business directory and listing platforms', 'Directory sites where many businesses can be listed and found.'],
  ['E-commerce websites', 'Online stores where customers can browse products and place orders.'],
  ['Landing pages', 'Focused single pages for a campaign, offer or launch.'],
  ['Website redesign', 'A fresh look and better structure for an existing website.'],
  ['SEO-ready and mobile-friendly design', 'Sites built to be found on Google and to work well on phones.'],
  ['CMS and admin panels', 'An easy admin area so you can update content yourself.'],
].map(([name, description]) => ({ name, description }));
const faqs = [
  ['How long does it take?', 'It depends on the scope. After we understand your needs we can give a realistic timeline.', ['time', 'long', 'days', 'timeline']],
  ['Will it work on mobile?', 'Yes, every website we build works well on phones, tablets and computers.', ['mobile', 'phone', 'responsive']],
  ['Do you help with domain and hosting?', 'Yes, we can guide you with choosing a domain and setting up hosting.', ['domain', 'hosting', 'server']],
  ['Can I update the content myself?', 'Yes, we can add an admin panel so you can change text, photos and products yourself.', ['update', 'edit', 'admin', 'content']],
  ['Is basic SEO included?', 'Yes, we build sites SEO-ready so Google can understand and list them properly.', ['seo', 'google', 'ranking']],
  ['Do you give support after launch?', 'Yes, we stay available after launch for support and small changes.', ['support', 'after', 'maintenance']],
  ['What do you need from me?', 'Mostly your logo, content, photos and ideas. If you do not have them, we can help you figure it out.', ['need', 'logo', 'photos', 'content']],
  ['Can you redo my old website?', 'Yes, we do website redesigns and improvements.', ['old', 'redo', 'redesign', 'existing']],
  ['Can I see your earlier work?', 'Yes, we can share examples from our portfolio, and send links on WhatsApp or SMS.', ['work', 'portfolio', 'examples', 'samples']],
  ['How does the process work?', 'We discuss your needs, design, build, you review, and then we launch.', ['process', 'steps', 'how']],
  ['How much does it cost?', 'It depends on your requirements. A quote will follow after we understand your needs.', ['price', 'cost', 'charges', 'rate', 'quote']],
].map(([question, answer, keywords]) => ({ question, answer, keywords }));
const objections = [
  ['price', 'I understand, budget matters for every business.', 'The cost depends on what you actually need, and we can start small and grow later.', 'How about a free consultation so we can scope it to your budget?'],
  ['instagram_whatsapp_only', 'Instagram and WhatsApp are great, many businesses start there.', 'A website is your own place that shows up on Google, builds trust, and does not depend on one app.', 'Shall I send you a couple of examples so you can see the difference?'],
  ['no_time', 'Totally understand, you must be busy.', 'We handle the work. We only need a short chat to understand your requirements.', 'Can I call you back at a time that suits you?'],
  ['not_needed', 'Fair enough, thanks for being honest.', 'Customers usually search on Google or check a number before they visit or buy, a website helps you show up there.', 'Can I ask how new customers find you today?'],
  ['will_think', 'Of course, take your time.', 'There is no pressure at all.', 'Can I send you some examples and call back at a time you choose?'],
  ['ask_partner', 'That makes sense, it is a joint decision.', 'It is easier when everyone hears the same details together.', 'Would you like to include your partner in a short call?'],
  ['already_have_website', 'Good, that is already a strong start.', 'We can improve or redesign it so it brings in more enquiries and looks better on phones.', 'What do you not like about your current website?'],
].map(([type, empathyLine, keyPoint, softNextStep]) => ({ type, empathyLine, keyPoint, softNextStep }));
const leads = [
  { name: 'Rajesh Verma', phone: '+91 90000 00001', businessName: 'Verma General Store', businessType: 'shop', city: 'Betul' },
  { name: 'Dr. Smita Mohanty', phone: '+91 90000 00002', businessName: 'Mohanty Dental Clinic', businessType: 'clinic', city: 'Bhubaneswar' },
  { phone: '+91 90000 00003' }, // no name: tests ask-name-first
].map((l: any) => ({ ...l, phoneKey: l.phone.replace(/\D/g, '').slice(-10), status: 'new', doNotCall: false }));

(async () => {
  await mongoose.connect(cfg.mongo);
  if (process.argv.includes('--if-empty') && (await Portfolio.countDocuments()) > 0) { console.log('Seed data already present, skipping.'); await mongoose.disconnect(); return; }
  // requirements and call_logs are runtime data: never touched here.
  for (const [M, d] of [[Portfolio, portfolio], [Service, services], [Faq, faqs], [Objection, objections], [Lead, leads]] as any) {
    await M.deleteMany({}); await M.insertMany(d);
  }
  console.log('Seeded portfolio, services, faqs, objections, leads.');
  await mongoose.disconnect();
})();
