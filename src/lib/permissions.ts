export type PermissionKey =
  | 'products'
  | 'orders'
  | 'customers'
  | 'deposits'
  | 'search-by-code'
  | 'customer-extra-info'
  | 'product-images'
  | 'stock-alerts'
  | 'piece-sale';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  products: 'المنتجات',
  orders: 'الطلبات',
  customers: 'العملاء',
  deposits: 'العربون',
  'search-by-code': 'البحث بالكود',
  'customer-extra-info': 'معلومات إضافية',
  'product-images': 'صور المنتجات',
  'stock-alerts': 'تنبيهات المخزون',
  'piece-sale': 'بيع بالقطعة',
};

export const ALL_PERMISSIONS = Object.keys(PERMISSION_LABELS) as PermissionKey[];

export interface StaffSession {
  id: string;
  name: string;
  permissions: PermissionKey[];
}

export const getStaffSession = (): StaffSession | null => {
  const raw = sessionStorage.getItem('bubbles_staff');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return {
      id: parsed.id,
      name: parsed.name,
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
    };
  } catch {
    return null;
  }
};

export const isAdmin = (): boolean =>
  sessionStorage.getItem('bubbles_admin') === 'true';

export const hasPermission = (perm: PermissionKey): boolean => {
  if (isAdmin()) return true;
  const staff = getStaffSession();
  return !!staff && staff.permissions.includes(perm);
};
