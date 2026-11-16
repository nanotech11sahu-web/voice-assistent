import 'dotenv/config';
// Edit identity here.
export const COMPANY_NAME = 'Nayandeep';
export const AGENT_NAME = 'Nayandeep';
export const SERVICES = [
  'business websites', 'business directory and listing platforms', 'e-commerce websites',
  'landing pages', 'website redesign', 'SEO-ready and mobile-friendly design', 'CMS and admin panels',
];
export const VOICES = {
  'en-IN': { male: 'en-IN-PrabhatNeural', female: 'en-IN-NeerjaExpressiveNeural' },
  'hi-IN': { male: 'hi-IN-MadhurNeural', female: 'hi-IN-SwaraNeural' },
};
export const cfg = {
  grokKey: process.env.GROK_API_KEY || '',
  model: process.env.GROK_MODEL || 'grok-3-mini', // never hardcode the model elsewhere
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/nayandeep_voice',
  port: Number(process.env.PORT) || 3000,
  defaultVoice: process.env.DEFAULT_VOICE || 'en-IN-NeerjaExpressiveNeural',
};
