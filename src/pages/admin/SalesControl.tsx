import { useEffect, useState } from 'react';
import { TrendingDown, Save, Ban, Infinity as InfinityIcon, MinusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { fetchAppSettings, updateAppSetting, AppSettings } from '@/hooks/useAppSettings';

const SalesControl = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<AppSettings['sales_mode']>('unlimited');
  const [limit, setLimit] = useState('20');

  useEffect(() => {
    (async () => {
      const s = await fetchAppSettings();
      setMode(s.sales_mode);
      setLimit(s.sales_negative_limit);
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (mode === 'allow_negative') {
      const n = parseInt(limit, 10);
      if (isNaN(n) || n < 0) {
        toast.error('أدخل رقم صحيح موجب للحد');
        return;
      }
    }
    setSaving(true);
    const errors = await Promise.all([
      updateAppSetting('sales_mode', mode),
      updateAppSetting('sales_negative_limit', limit),
    ]);
    setSaving(false);
    if (errors.some(Boolean)) {
      toast.error('فشل في الحفظ');
    } else {
      toast.success('تم حفظ إعدادات البيع');
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <TrendingDown className="h-6 w-6" />
        التحكم في البيع
      </h1>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg">سياسة البيع حسب المخزون</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as AppSettings['sales_mode'])} className="space-y-3">
            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'unlimited' ? 'border-primary bg-primary/5' : 'border-border'}`}>
              <RadioGroupItem value="unlimited" id="unlimited" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-bold">
                  <InfinityIcon className="h-4 w-4 text-primary" />
                  بيع بدون حدود
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  يمكن البيع دائماً بغض النظر عن المخزون. لن يتم إيقاف أي طلب.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'stop_at_zero' ? 'border-destructive bg-destructive/5' : 'border-border'}`}>
              <RadioGroupItem value="stop_at_zero" id="stop_at_zero" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-bold">
                  <Ban className="h-4 w-4 text-destructive" />
                  إيقاف البيع عند نفاذ المخزون (0)
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  لا يمكن إضافة المنتج للسلة إذا كان المخزون = 0 أو إذا كانت الكمية ستتجاوز المتاح.
                </p>
              </div>
            </label>

            <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${mode === 'allow_negative' ? 'border-amber-500 bg-amber-500/10' : 'border-border'}`}>
              <RadioGroupItem value="allow_negative" id="allow_negative" className="mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 font-bold">
                  <MinusCircle className="h-4 w-4 text-amber-600" />
                  السماح بالبيع حتى حد سالب
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  يمكن البيع حتى يصل المخزون إلى الحد السالب أدناه (مثلاً -20 قطعة).
                </p>
                {mode === 'allow_negative' && (
                  <div className="mt-3 flex items-center gap-2">
                    <Label className="whitespace-nowrap">الحد السالب: -</Label>
                    <Input
                      type="number"
                      min="0"
                      value={limit}
                      onChange={(e) => setLimit(e.target.value.replace(/\D/g, ''))}
                      dir="ltr"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">قطعة</span>
                  </div>
                )}
              </div>
            </label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2 py-6 text-lg font-bold">
        <Save className="h-5 w-5" />
        {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
      </Button>
    </div>
  );
};

export default SalesControl;