import { Service } from '../models';
export default { name: 'get_services', description: 'List the services Nayandeep offers.', parameters: { type: 'object', properties: {} },
  async handler() { return (await Service.find().lean()).map((s: any) => ({ name: s.name, description: s.description })); } };
