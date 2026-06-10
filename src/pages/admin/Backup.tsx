import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Upload, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import {
  buildBackupZip,
  downloadBlob,
  backupFilename,
  restoreFromZip,
  restoreFromJson,
  RestoreResult,
} from '@/lib/backup';

const Backup = () => {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [results, setResults] = useState<RestoreResult[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await buildBackupZip();
      downloadBlob(blob, backupFilename());
      toast.success('تم تحميل النسخة الاحتياطية');
    } catch (e: any) {
      toast.error('فشل التحميل: ' + e.message);
    } finally {
      setDownloading(false);
    }
  };

  const handleRestore = async (file: File) => {
    const isZip = /\.zip$/i.test(file.name);
    const isJson = /\.json$/i.test(file.name);
    if (!isZip && !isJson) {
      toast.error('يجب أن يكون الملف ZIP أو JSON');
      return;
    }
    if (
      !confirm(
        'سيتم استعادة البيانات والكتابة فوق أي سجلات موجودة بنفس المعرف. هل أنت متأكد؟',
      )
    )
      return;
    try {
      setRestoring(true);
      setResults([]);
      const res = isZip ? await restoreFromZip(file) : await restoreFromJson(file);
      setResults(res);
      const errors = res.filter((r) => r.error);
      if (errors.length === 0) toast.success('تمت الاستعادة بنجاح');
      else toast.error(`تمت الاستعادة مع ${errors.length} أخطاء`);
    } catch (e: any) {
      toast.error('فشل الاستعادة: ' + e.message);
    } finally {
      setRestoring(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold gradient-text">النسخ الاحتياطي والاستعادة</h1>
        <p className="text-muted-foreground mt-1">
          قم بتحميل نسخة كاملة من بيانات الموقع أو استعادتها من ملف.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" /> تحميل نسخة احتياطية كاملة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            يتم إنشاء ملف ZIP يحتوي على مجلد لكل نسخة (Version) وداخله ملف JSON منفصل
            لكل نوع بيانات (المنتجات، الطلبات، العملاء، العربون، المصاريف، تنبيهات
            المخزون، تفاصيل الطلبات)، بالإضافة إلى الموظفين والإعدادات والـ manifest.
          </p>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> جاري التحضير...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" /> تحميل النسخة الآن
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" /> استعادة البيانات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            ارفع ملف النسخة الاحتياطية (ZIP) لاستعادة كل البيانات، أو ارفع ملف JSON
            واحد فقط (مثل <code>orders.json</code>) لاستعادة نوع بيانات بعينه. يتم
            تحديث السجلات الموجودة بنفس المعرف.
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleRestore(f);
              }}
              disabled={restoring}
              className="block text-sm"
            />
            {restoring && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {results.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <h3 className="font-semibold">نتيجة الاستعادة:</h3>
              {results.map((r) => (
                <div key={r.table} className="flex items-center gap-2 text-sm">
                  {r.error ? (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                  <span className="font-mono">{r.table}</span>
                  <span className="text-muted-foreground">— {r.count} صف</span>
                  {r.error && (
                    <span className="text-destructive">— {r.error}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>التحميل التلقائي اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            عند فتح لوحة التحكم من جهاز كمبيوتر أو لاب توب (وليس الهاتف)، يتم تحميل
            نسخة احتياطية تلقائياً مرة واحدة فقط في اليوم.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Backup;
