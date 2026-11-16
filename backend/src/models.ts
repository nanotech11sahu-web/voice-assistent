import { Schema, model, models } from 'mongoose';
const mk = (name: string, def: any, coll: string) =>
  (models[name] as any) || model(name, new Schema(def, { timestamps: true }), coll);

export const Portfolio = mk('Portfolio', { name: String, url: String, spokenName: String, category: String,
  shortDescription: String, highlights: [String], note: String, relevantFor: [String] }, 'portfolio');
export const Service = mk('Service', { name: String, description: String }, 'services');
export const Faq = mk('Faq', { question: String, answer: String, keywords: [String] }, 'faqs');
export const Objection = mk('Objection', { type: String, empathyLine: String, keyPoint: String, softNextStep: String }, 'objections');
export const Lead = mk('Lead', { name: String, phone: String, phoneKey: String, businessName: String, businessType: String,
  city: String, status: { type: String, default: 'new' }, doNotCall: { type: Boolean, default: false },
  callbackAt: String, callbackNote: String }, 'leads');
export const Requirement = mk('Requirement', { leadId: Schema.Types.ObjectId, callId: String, businessType: String, goals: String,
  websiteType: String, pagesFeatures: [String], languages: [String], hasLogo: Boolean, hasContent: Boolean, hasDomain: Boolean,
  hasHosting: Boolean, referenceSites: [String], budgetRange: String, timeline: String, decisionMaker: String, notes: String,
  quoteRequested: Boolean }, 'requirements');
export const CallLog = mk('CallLog', { leadId: Schema.Types.ObjectId, startedAt: Date, endedAt: Date, durationSec: Number,
  fullTranscript: [{ role: String, text: String }], prospectNameAsHeard: String, finalName: String, summary: String,
  prospectInterestLevel: String, objectionsRaised: [String], nextStep: String, callbackTime: String,
  sendLinksRequested: Boolean, outcome: String }, 'call_logs');
