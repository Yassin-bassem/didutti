import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

const Inventory = () => {
  const [loading, setLoading] = useState(false);
  const [lastCount, setLastCount] = useState<number | null>(null);

  const downloadSheet = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('code, name, description, price, stock_quantity')
        .order('code', { ascending: true });
      if (error) throw error;

      const rows = (data || []).map((p: any) => ({
        'الكود': p.code ?? '',
        'الاسم': p.name ?? '',
        'الوصف': p.description ?? '',
        'السعر': p.price ?? 0,
        'الكمية كانت': p.stock_quantity ?? 0,
        'الكمية أصبحت': '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 14 },
        { wch: 30 },
        { wch: 24 },
        { wch: 10 },
        { wch: 14 },
        { wch: 14 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الجرد');
      XLSX.writeFile(wb, `الجرد-${new Date().toISOString().slice(0, 10)}.xlsx`);

      setLastCount(rows.length);
      toast.success(`تم تحميل ملف الجرد (${rows.length} منتج)`);
    } catch (e: any) {
      console.error(e);
      toast.error('خطأ في إنشاء الملف: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold">الجرد</h1>
        <p className="text-muted-foreground text-sm mt-1">
          تحميل ملف Excel يحتوي على جميع المنتجات مع الكمية الحالية لعمل الجرد
        </p>
      </div>

      <Card className="p-8 text-center border-dashed">
        <FileSpreadsheet className="h-14 w-14 mx-auto text-primary mb-4" />
        <h2 className="text-lg font-semibold mb-2">ملف الجرد</h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
          الأعمدة: الكود، الاسم، الوصف، السعر، الكمية كانت (الحالية)، الكمية أصبحت (تُملأ يدوياً بعد الجرد)
        </p>
        <Button size="lg" onClick={downloadSheet} disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري التحضير...
            </>
          ) : (
            <>
              <Download className="ml-2 h-4 w-4" />
              تحميل ملف الجرد
            </>
          )}
        </Button>
        {lastCount !== null && !loading && (
          <p className="text-xs text-muted-foreground mt-4">
            آخر تحميل: {lastCount} منتج
          </p>
        )}
      </Card>
    </div>
  );
};

export default Inventory;
