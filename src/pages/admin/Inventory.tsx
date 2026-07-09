import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

interface ImportedRow {
  code: string;
  name: string;
  description: string;
  price: number;
  quantity_was: number;
}

interface InventoryRow extends ImportedRow {
  quantity_became: number | null;
  diff: number | null;
  found: boolean;
}

const pickField = (row: any, keys: string[]): any => {
  for (const k of Object.keys(row)) {
    const norm = String(k).trim().toLowerCase();
    if (keys.some((kk) => norm === kk || norm.includes(kk))) return row[k];
  }
  return undefined;
};

const Inventory = () => {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [fileName, setFileName] = useState('');

  const handleFile = async (file: File) => {
    setLoading(true);
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const imported: ImportedRow[] = raw
        .map((r) => {
          const code = String(pickField(r, ['code', 'كود', 'الكود']) ?? '').trim();
          const name = String(pickField(r, ['name', 'اسم', 'الاسم']) ?? '').trim();
          const description = String(pickField(r, ['description', 'وصف', 'الوصف']) ?? '').trim();
          const priceRaw = pickField(r, ['price', 'سعر', 'السعر']);
          const qtyRaw = pickField(r, ['quantity', 'كمية', 'الكمية', 'مخزون', 'المخزون']);
          const price = Number(String(priceRaw).toString().replace(/[^\d.-]/g, '')) || 0;
          const quantity_was = Number(String(qtyRaw).toString().replace(/[^\d.-]/g, '')) || 0;
          return { code, name, description, price, quantity_was };
        })
        .filter((r) => r.code);

      if (imported.length === 0) {
        toast.error('لم يتم العثور على منتجات في الملف');
        setLoading(false);
        return;
      }

      const codes = imported.map((r) => r.code);
      const { data: products, error } = await supabase
        .from('products')
        .select('code, stock_quantity')
        .in('code', codes);
      if (error) throw error;

      const stockMap = new Map<string, number>();
      (products || []).forEach((p: any) => stockMap.set(p.code, p.stock_quantity));

      const result: InventoryRow[] = imported.map((r) => {
        const became = stockMap.has(r.code) ? Number(stockMap.get(r.code)) : null;
        return {
          ...r,
          quantity_became: became,
          diff: became === null ? null : became - r.quantity_was,
          found: stockMap.has(r.code),
        };
      });

      setRows(result);
      toast.success(`تم تحميل ${result.length} منتج`);
    } catch (e: any) {
      console.error(e);
      toast.error('خطأ في قراءة الملف: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const s = search.trim().toLowerCase();
    return rows.filter(
      (r) => r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s),
    );
  }, [rows, search]);

  const totals = useMemo(() => {
    const was = rows.reduce((s, r) => s + r.quantity_was, 0);
    const became = rows.reduce((s, r) => s + (r.quantity_became ?? 0), 0);
    const sold = rows.reduce((s, r) => s + Math.max(0, (r.quantity_was - (r.quantity_became ?? r.quantity_was))), 0);
    const value = rows.reduce((s, r) => s + r.price * (r.quantity_became ?? 0), 0);
    return { was, became, sold, value };
  }, [rows]);

  const exportResult = () => {
    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(
      rows.map((r) => ({
        'الكود': r.code,
        'الاسم': r.name,
        'الوصف': r.description,
        'السعر': r.price,
        'الكمية كانت': r.quantity_was,
        'الكمية أصبحت': r.quantity_became ?? 'غير موجود',
        'الفرق': r.diff ?? '',
        'المباع': r.diff !== null && r.diff < 0 ? Math.abs(r.diff) : 0,
      })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الجرد');
    XLSX.writeFile(wb, `الجرد-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">الجرد</h1>
          <p className="text-muted-foreground text-sm mt-1">
            استيراد ملف Excel لمقارنة المخزون قبل وبعد الطلبات
          </p>
        </div>
        <div className="flex gap-2">
          <label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />
            <Button asChild disabled={loading}>
              <span className="cursor-pointer">
                <Upload className="ml-2 h-4 w-4" />
                {loading ? 'جاري التحميل...' : 'رفع ملف Excel'}
              </span>
            </Button>
          </label>
          {rows.length > 0 && (
            <Button variant="outline" onClick={exportResult}>
              <Download className="ml-2 h-4 w-4" />
              تصدير النتيجة
            </Button>
          )}
        </div>
      </div>

      {fileName && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4" /> {fileName}
        </p>
      )}

      {rows.length === 0 && !loading && (
        <Card className="p-8 text-center border-dashed">
          <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium mb-1">لا يوجد ملف مُحمّل</p>
          <p className="text-sm text-muted-foreground">
            الأعمدة المطلوبة: الكود، الاسم، الوصف، السعر، الكمية
          </p>
        </Card>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">إجمالي كانت</p>
              <p className="text-xl font-bold">{totals.was}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">إجمالي أصبحت</p>
              <p className="text-xl font-bold">{totals.became}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">المباع</p>
              <p className="text-xl font-bold text-primary">{totals.sold}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">قيمة المخزون الحالي</p>
              <p className="text-xl font-bold">{totals.value.toFixed(0)} ج.م</p>
            </Card>
          </div>

          <Input
            placeholder="بحث بالكود أو الاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          <Card className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الكود</TableHead>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-right">السعر</TableHead>
                  <TableHead className="text-right">كانت</TableHead>
                  <TableHead className="text-right">أصبحت</TableHead>
                  <TableHead className="text-right">الفرق</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r, i) => {
                  const diffColor =
                    r.diff === null
                      ? 'text-muted-foreground'
                      : r.diff < 0
                      ? 'text-primary font-bold'
                      : r.diff > 0
                      ? 'text-green-600 font-bold'
                      : 'text-muted-foreground';
                  return (
                    <TableRow key={i} className={!r.found ? 'bg-destructive/5' : ''}>
                      <TableCell className="font-mono">{r.code}</TableCell>
                      <TableCell>{r.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.description}</TableCell>
                      <TableCell>{r.price}</TableCell>
                      <TableCell>{r.quantity_was}</TableCell>
                      <TableCell>
                        {r.quantity_became === null ? (
                          <span className="text-destructive text-xs">غير موجود</span>
                        ) : (
                          r.quantity_became
                        )}
                      </TableCell>
                      <TableCell className={diffColor}>
                        {r.diff === null ? '—' : r.diff > 0 ? `+${r.diff}` : r.diff}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
};

export default Inventory;
