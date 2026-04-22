import { useEffect, useState } from 'react';
import { useNavigate, Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { Package, ShoppingCart, Users, BarChart3, LogOut, Wallet, SearchCode, FileText, ImagePlus, Menu, X, Bell, UserCog, Settings as SettingsIcon, TrendingDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import screamLogo from '@/assets/scream-logo.jpeg';
import { VersionProvider } from '@/contexts/VersionContext';
import VersionSelector from '@/components/VersionSelector';
import { isAdmin, getStaffSession, PermissionKey } from '@/lib/permissions';

interface NavItem {
  path: string;
  label: string;
  icon: any;
  permission: PermissionKey | 'admin';
}

const navItems: NavItem[] = [
  { path: '/admin/dashboard', label: 'الإحصائيات', icon: BarChart3, permission: 'admin' },
  { path: '/admin/dashboard/products', label: 'المنتجات', icon: Package, permission: 'products' },
  { path: '/admin/dashboard/orders', label: 'الطلبات', icon: ShoppingCart, permission: 'orders' },
  { path: '/admin/dashboard/customers', label: 'العملاء', icon: Users, permission: 'customers' },
  { path: '/admin/dashboard/deposits', label: 'العربون', icon: Wallet, permission: 'deposits' },
  { path: '/admin/dashboard/search-by-code', label: 'البحث بالكود', icon: SearchCode, permission: 'search-by-code' },
  { path: '/admin/dashboard/customer-extra-info', label: 'معلومات إضافية', icon: FileText, permission: 'customer-extra-info' },
  { path: '/admin/dashboard/product-images', label: 'صور المنتجات', icon: ImagePlus, permission: 'product-images' },
  { path: '/admin/dashboard/stock-alerts', label: 'تنبيهات المخزون', icon: Bell, permission: 'stock-alerts' },
  { path: '/admin/dashboard/staff', label: 'الموظفين', icon: UserCog, permission: 'admin' },
  { path: '/admin/dashboard/settings', label: 'الإعدادات', icon: SettingsIcon, permission: 'admin' },
  { path: '/admin/dashboard/sales-control', label: 'التحكم في البيع', icon: TrendingDown, permission: 'admin' },
];

const AdminDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [authChecked, setAuthChecked] = useState(false);
  const [admin, setAdmin] = useState(false);
  const [staffPerms, setStaffPerms] = useState<PermissionKey[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const isA = isAdmin();
    const staff = getStaffSession();
    if (!isA && !staff) {
      navigate('/admin');
      return;
    }
    if (isA) {
      setAdmin(true);
    } else if (staff) {
      setStaffPerms(staff.permissions);
      if (staff.permissions.length === 0) {
        navigate('/');
        return;
      }
    }
    setAuthChecked(true);
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('bubbles_admin');
    sessionStorage.removeItem('bubbles_staff');
    navigate('/admin');
  };

  if (!authChecked) return null;

  const visibleNav = navItems.filter((item) => {
    if (item.permission === 'admin') return admin;
    return admin || staffPerms.includes(item.permission);
  });

  // If staff lands on the index route, redirect to first allowed page
  if (!admin && location.pathname === '/admin/dashboard' && staffPerms.length > 0) {
    return <Navigate to={`/admin/dashboard/${staffPerms[0]}`} replace />;
  }

  return (
    <VersionProvider>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar Toggle Button */}
        <Button
          variant="ghost"
          size="icon"
          className="fixed top-3 right-3 z-50 lg:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside className={`
          fixed lg:sticky top-0 h-screen z-40
          bg-card border-l border-border flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 translate-x-full lg:w-16 lg:translate-x-0'}
          overflow-hidden
        `}>
          <div className="p-4 border-b border-border min-w-[256px] lg:min-w-0">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3">
                <img src={screamLogo} alt="Scream" className="h-10 w-10 rounded-full flex-shrink-0 object-contain bg-white" />
                {sidebarOpen && <span className="font-bold gradient-text whitespace-nowrap">لوحة التحكم</span>}
              </Link>
              <Button
                variant="ghost"
                size="icon"
                className="hidden lg:flex flex-shrink-0"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                {sidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {sidebarOpen && <VersionSelector />}
          
          <nav className="flex-1 p-4 space-y-2 min-w-[256px] lg:min-w-0 overflow-y-auto">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => {
                    if (window.innerWidth < 1024) setSidebarOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-baby'
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                  title={!sidebarOpen ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {sidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-border min-w-[256px] lg:min-w-0">
            <Button
              variant="ghost"
              onClick={handleLogout}
              className={`w-full gap-3 text-destructive hover:text-destructive hover:bg-destructive/10 ${sidebarOpen ? 'justify-start' : 'justify-center'}`}
              title={!sidebarOpen ? 'تسجيل الخروج' : undefined}
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              {sidebarOpen && <span>تسجيل الخروج</span>}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </VersionProvider>
  );
};

export default AdminDashboard;