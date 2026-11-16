export interface Session {
  id: string; send: (o: any) => void; history: any[]; transcript: { role: string; text: string; turn?: number }[];
  abort?: AbortController; turn: number; seq: number; leadId?: any; phone?: string; language: string; voice: string;
  prospectName?: string; facts?: Record<string, string>; prospectNameAsHeard?: string; startedAt: Date; ended: boolean;
  objections: Set<string>; flags: { sendLinksRequested: boolean; quoteRequested: boolean; doNotCall: boolean; callbackTime?: string };
}
