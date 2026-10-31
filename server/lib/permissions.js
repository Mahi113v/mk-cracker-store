// Every access key that the company admin can give to a staff user
const GROUPS = [
  { group: 'Dashboard', items: [['dashboard.view', 'View dashboard']] },
  { group: 'Products', items: [['products.view', 'View products'], ['products.manage', 'Add / edit / delete products']] },
  { group: 'Categories & Brands', items: [['categories.manage', 'Manage categories & brands']] },
  { group: 'Stock', items: [['stock.view', 'View stock'], ['stock.manage', 'Stock in / out / adjustment'], ['stock.history', 'View stock history']] },
  { group: 'Orders', items: [['orders.view', 'View orders'], ['orders.manage', 'Verify / deliver / cancel orders']] },
  { group: 'Reports', items: [['reports.view', 'Sales & stock reports']] },
  { group: 'Users', items: [['users.manage', 'Manage customers']] },
  { group: 'Settings', items: [['settings.manage', 'Store settings & payment']] },
  { group: 'Quick Buy', items: [['discount.change', 'Change discount in Quick Buy']] },
];
const ALL = GROUPS.flatMap((g) => g.items.map((i) => i[0]));

const PRESETS = {
  manager: ['dashboard.view', 'products.view', 'products.manage', 'categories.manage', 'stock.view', 'stock.manage', 'stock.history', 'orders.view', 'orders.manage', 'reports.view', 'discount.change'],
  stock_keeper: ['dashboard.view', 'products.view', 'stock.view', 'stock.manage', 'stock.history'],
  sales: ['dashboard.view', 'orders.view', 'orders.manage', 'reports.view', 'discount.change'],
  viewer: ['dashboard.view', 'products.view', 'stock.view', 'orders.view', 'reports.view'],
};

const effective = (u) => {
  if (u.role === 'company_admin') return ALL;
  if (u.role !== 'staff') return [];
  try { return (JSON.parse(u.permissions || '[]') || []).filter((p) => ALL.includes(p)); } catch { return []; }
};

module.exports = { GROUPS, ALL, PRESETS, effective };
