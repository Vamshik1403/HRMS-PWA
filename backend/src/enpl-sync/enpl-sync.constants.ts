export const ENPL_ERP_BASE_DEFAULT = 'https://enplerp.electrohelps.in/backend';

export const ENPL_COMPANY_NAMES = new Set([
  'electrohelps networks pvt ltd',
  'electohelps networks pvt ltd',
  'electohelps',
  'electrohelps networks',
  'ehs networks',
]);

export const ENPL_ENTITY = {
  customer: 'customer',
  site: 'site',
  task: 'task',
} as const;

export type EnplEntityType = (typeof ENPL_ENTITY)[keyof typeof ENPL_ENTITY];
