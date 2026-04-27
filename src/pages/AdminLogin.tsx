import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import brandLogo from '@/assets/didutti-logo.jpg';
import { fetchAppSettings } from '@/hooks/useAppSettings';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginMode, setLoginMode] = useState<'admin' | 'staff'>('admin');
  const [staffName, setStaffName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (loginMode === 'admin') {
      setLoading(true);
      const settings = await fetchAppSettings();
      setLoading(false);
      if (password === settings.admin_password) {
        sessionStorage.setItem('bubbles_admin', 'true');
        sessionStorage.removeItem('bubbles_staff');
        toast.success('تم تسجيل الدخول بنجاح');
        navigate('/admin/dashboard');
      } else {
        toast.error('كلمة المرور غير صحيحة');
      }
    } else {
      // Staff login
      setLoading(true);
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .eq('password', password)
        .eq('is_active', true);

      setLoading(false);

      if (error || !data || data.length === 0) {
        toast.error('كلمة المرور غير صحيحة أو الحساب غير نشط');
        return;
      }

      const staffMember = data[0];
      const permissions = Array.isArray((staffMember as any).permissions)
        ? (staffMember as any).permissions
        : [];
      sessionStorage.setItem('bubbles_staff', JSON.stringify({
        id: staffMember.id,
        name: staffMember.name,
        permissions,
      }));
      sessionStorage.removeItem('bubbles_admin');
      toast.success(`مرحباً ${staffMember.name}`);
      // If staff has dashboard permissions, send them to the first one; otherwise to home
      if (permissions.length > 0) {
        navigate(`/admin/dashboard/${permissions[0]}`);
      } else {
        navigate('/');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-baby-blue-light via-background to-baby-pink-light p-4">
      <Card className="w-full max-w-md border-2 border-primary/20 shadow-baby-lg">
        <CardHeader className="text-center space-y-4">
          <img
            src={brandLogo}
            alt="DIDUTTI KID'S"
            className="w-24 h-24 mx-auto rounded-full shadow-baby float-animation object-contain bg-white p-2"
          />
          <CardTitle className="text-2xl gradient-text">
            {loginMode === 'admin' ? 'لوحة التحكم' : 'تسجيل دخول الموظفين'}
          </CardTitle>
          {/* Toggle between admin and staff */}
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant={loginMode === 'admin' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setLoginMode('admin'); setPassword(''); }}
            >
              <Lock className="h-4 w-4 ml-1" />
              أدمن
            </Button>
            <Button
              type="button"
              variant={loginMode === 'staff' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setLoginMode('staff'); setPassword(''); }}
            >
              <Users className="h-4 w-4 ml-1" />
              موظف
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="h-4 w-4 text-muted-foreground" />
                كلمة المرور {loginMode === 'staff' ? '(4 أرقام)' : ''}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    if (loginMode === 'staff') {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setPassword(val);
                    } else {
                      setPassword(e.target.value);
                    }
                  }}
                  placeholder={loginMode === 'staff' ? 'أدخل الـ 4 أرقام' : 'أدخل كلمة المرور'}
                  className="pl-10"
                  dir="ltr"
                  inputMode={loginMode === 'staff' ? 'numeric' : undefined}
                  maxLength={loginMode === 'staff' ? 4 : undefined}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-6 text-lg font-bold bg-gradient-to-l from-primary to-secondary"
            >
              {loading ? 'جاري الدخول...' : 'دخول'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
