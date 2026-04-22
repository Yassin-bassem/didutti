import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Lock, CreditCard, Smartphone, Save, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { fetchAppSettings, updateAppSetting, AppSettings } from '@/hooks/useAppSettings';

const Settings = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [form, setForm] = useState<AppSettings>({
    admin_password: '',
    instapay_link: '',
    instapay_label: '',
    vodafone_number: '',
  });

  useEffect(() => {
    (async () => {
      const s = await fetchAppSettings();
      setForm(s);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!form.admin_password.trim()) {
      toast.error('كلمة مرور الأدمن لا يمكن أن تكون فارغة');
      return;
    }
    if (!form.instapay_link.trim()) {
      toast.error('رابط InstaPay مطلوب');
      return;
    }
    if (!/^\d{10,15}$/.test(form.vodafone_number.replace(/\D/g, ''))) {
      toast.error('رقم فودافون كاش غير صحيح');
      return;
    }

    setSaving(true);
    const errors = await Promise.all([
      updateAppSetting('admin_password', form.admin_password.trim()),
      updateAppSetting('instapay_link', form.instapay_link.trim()),
      updateAppSetting('instapay_label', form.instapay_label.trim()),
      updateAppSetting('vodafone_number', form.vodafone_number.trim()),
    ]);
    setSaving(false);

    if (errors.some(Boolean)) {
      toast.error('فشل في حفظ بعض الإعدادات');
    } else {
      toast.success('تم حفظ الإعدادات بنجاح');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <SettingsIcon className="h-6 w-6" />
        الإعدادات
      </h1>

      {/* Admin password */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock className="h-5 w-5 text-primary" />
            كلمة مرور لوحة التحكم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>كلمة المرور الجديدة</Label>
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              value={form.admin_password}
              onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
              dir="ltr"
              className="pl-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            عند الحفظ، استخدم كلمة المرور الجديدة في تسجيل الدخول التالي.
          </p>
        </CardContent>
      </Card>

      {/* InstaPay */}
      <Card className="border-2 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-blue-700">
            <CreditCard className="h-5 w-5" />
            InstaPay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>الرابط</Label>
            <Input
              value={form.instapay_link}
              onChange={(e) => setForm({ ...form, instapay_link: e.target.value })}
              dir="ltr"
              placeholder="https://ipn.eg/..."
            />
          </div>
          <div>
            <Label>المعرف (يظهر تحت الرابط)</Label>
            <Input
              value={form.instapay_label}
              onChange={(e) => setForm({ ...form, instapay_label: e.target.value })}
              dir="ltr"
              placeholder="username@instapay"
            />
          </div>
        </CardContent>
      </Card>

      {/* Vodafone */}
      <Card className="border-2 border-red-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg text-red-700">
            <Smartphone className="h-5 w-5" />
            فودافون كاش
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label>رقم فودافون كاش</Label>
          <Input
            value={form.vodafone_number}
            onChange={(e) => setForm({ ...form, vodafone_number: e.target.value.replace(/\D/g, '') })}
            dir="ltr"
            inputMode="numeric"
            placeholder="010xxxxxxxx"
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2 py-6 text-lg font-bold">
        <Save className="h-5 w-5" />
        {saving ? 'جاري الحفظ...' : 'حفظ كل الإعدادات'}
      </Button>
    </div>
  );
};

export default Settings;