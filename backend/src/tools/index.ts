// Registry. To add a tool: create tools/<name>.ts exporting {name, description, parameters, handler}, then add it to ALL below.
import get_portfolio from './get_portfolio'; import get_services from './get_services'; import search_faqs from './search_faqs';
import get_objection_help from './get_objection_help'; import get_lead_by_phone from './get_lead_by_phone';
import save_lead_details from './save_lead_details'; import save_requirements from './save_requirements';
import schedule_callback from './schedule_callback'; import mark_do_not_call from './mark_do_not_call'; import end_call_summary from './end_call_summary';

export const ALL: any[] = [get_portfolio, get_services, search_faqs, get_objection_help, get_lead_by_phone,
  save_lead_details, save_requirements, schedule_callback, mark_do_not_call, end_call_summary];
export const toolSpecs = ALL.filter((t) => !t.internal).map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));

export async function runTool(name: string, rawArgs: string, ctx: any): Promise<string> {
  const t = ALL.find((x) => x.name === name);
  if (!t) return JSON.stringify({ error: 'unknown tool' });
  try { return JSON.stringify(await t.handler(JSON.parse(rawArgs || '{}'), ctx)).slice(0, 4000); }
  catch (e: any) { return JSON.stringify({ error: 'tool failed', detail: String(e?.message || e).slice(0, 200) }); }
}
