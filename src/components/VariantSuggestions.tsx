import { useEffect, useState } from 'react';
import { Plus, Minus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import ProductImage from '@/components/ProductImage';
import { checkStockForAdd } from '@/lib/stockCheck';

interface Variant {
  id: string;
  code: string;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  stock_quantity: number;
}

interface Props {
  scannedCode: string | null;
  onClose: () => void;
}

// Extract base code by stripping trailing "-N" suffix
const getBaseCode = (code: string): string => {
  const m = code.match(/^(.*)-\d+$/);
  return m ? m[1] : code;
};

const VariantSuggestions = ({ scannedCode, onClose }: Props) => {
  const { addItem, items } = useCart();
  const [variants, setVariants] = useState<Variant[]>([]);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!scannedCode) {
      setVariants([]);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const base = getBaseCode(scannedCode);
        const { data: activeVersion } = await supabase
          .from('versions')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();

        let q = supabase
          .from('products')
          .select('*')
          .or(`code.eq.${base},code.like.${base}-%`)
          .neq('code', scannedCode);

        if (activeVersion) q = q.eq('version_id', activeVersion.id);

        const { data, error } = await q;
        if (error) throw error;
        const list = (data || []) as Variant[];
        // Sort by code naturally
        list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
        setVariants(list);
        const initial: Record<string, number> = {};
        list.forEach((v) => (initial[v.id] = 1));
        setQtys(initial);
      } catch (e) {
        console.error('Variants load error:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [scannedCode]);

  const open = !!scannedCode && (loading || variants.length > 0);

  const updateQty = (id: string, delta: number) => {
    setQtys((prev) => ({ ...prev, [id]: Math.max(1, (prev[id] || 1) + delta) }));
  };

  const handleAdd = async (v: Variant) => {
    const qty = qtys[v.id] || 1;
    const check = await checkStockForAdd(v.id, v.description || '', qty, items);
    if (!check.allowed) {
      toast.error(check.reason || 'لا يمكن إضافة هذا المنتج');
      return;
    }
    addItem(
      {
        productId: v.id,
        code: v.code,
        name: v.name,
        description: v.description || '',
        price: v.price,
        imageUrl: v.image_url || undefined,
      },
      qty,
    );
    toast.success(`تمت إضافة "${v.name}" (${qty}) للسلة`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="gradient-text">ألوان / مقاسات أخرى متاحة</span>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              تم إضافة <span className="font-bold text-primary" dir="ltr">{scannedCode}</span> للسلة. تذكير بالخيارات الأخرى من نفس المنتج:
            </p>
            {variants.map((v) => (
              <div
                key={v.id}
                className="flex gap-3 items-center border-2 border-primary/15 rounded-xl p-3 bg-card"
              >
                <ProductImage imageUrl={v.image_url} alt={v.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground" dir="ltr">#{v.code}</p>
                  <p className="font-bold text-sm truncate">{v.name}</p>
                  <p className="text-sm text-primary font-bold">{v.price} ج.م</p>
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(v.id, -1)}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-7 text-center text-sm font-bold">{qtys[v.id] || 1}</span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => updateQty(v.id, 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs gap-1 bg-secondary hover:bg-secondary/90"
                    onClick={() => handleAdd(v)}
                  >
                    <Plus className="h-3 w-3" />
                    إضافة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default VariantSuggestions;
