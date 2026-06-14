import { useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import { checkStockForAdd } from '@/lib/stockCheck';
import Header from '@/components/Header';
import QRScanner from '@/components/QRScanner';
import CartPreview from '@/components/CartPreview';
import ProductSearch from '@/components/ProductSearch';
import VariantSuggestions from '@/components/VariantSuggestions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageCircle, FileEdit } from 'lucide-react';

const Index = () => {
  const { addItem, extraInfo, setExtraInfo, items } = useCart();
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const handleQRScan = useCallback(async (code: string) => {
    try {
      // Get active version first
      const { data: activeVersion } = await supabase
        .from('versions')
        .select('id')
        .eq('is_active', true)
        .maybeSingle();

      let query = supabase
        .from('products')
        .select('*')
        .eq('code', code);

      if (activeVersion) {
        query = query.eq('version_id', activeVersion.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      if (data) {
        const check = await checkStockForAdd(data.id, data.description || '', 1, items);
        if (!check.allowed) {
          toast.error(check.reason || 'لا يمكن إضافة هذا المنتج');
          return;
        }
        addItem({
          productId: data.id,
          code: data.code,
          name: data.name,
          description: data.description || '',
          price: data.price,
          imageUrl: data.image_url || undefined,
        });
        toast.success(`تمت إضافة "${data.name}" للسلة`);
        setScannedCode(code);
      } else {
        toast.error('المنتج غير موجود');
      }
    } catch (err) {
      console.error('QR scan error:', err);
      toast.error('حدث خطأ في قراءة المنتج');
    }
  }, [addItem, items]);

  return (
    <div className="min-h-screen bg-background paper">
      <Header />

      <main className="container py-10 space-y-10 max-w-3xl">
        {/* Editorial Masthead */}
        <section className="slide-up border-y border-foreground/15 py-8">
          <div className="flex items-baseline justify-between mb-4">
            <span className="eyebrow">Volume I · مرحباً</span>
            <span className="eyebrow">№ 2026</span>
          </div>
          <h1 className="font-display text-5xl md:text-6xl font-black leading-[0.95] tracking-tight text-primary">
            مرحباً بك<br />
            <span className="italic font-light text-secondary">في </span>
            DiDutti<span className="text-secondary">.</span>
          </h1>
          <p className="mt-5 text-base text-muted-foreground max-w-md leading-relaxed">
            امسح كود المنتج أو ابحث بالكود لإضافته إلى السلة — تجربة تسوّق مُنتقاة بعناية لأطفالك.
          </p>
        </section>

        {/* QR Scanner — Primary */}
        <section className="slide-up space-y-3" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-3">
            <span className="eyebrow">01 · المسح</span>
            <div className="rule flex-1" />
          </div>
          <QRScanner onScan={handleQRScan} />
        </section>

        {/* Cart Preview */}
        <section className="slide-up space-y-3" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-3">
            <span className="eyebrow">02 · السلة</span>
            <div className="rule flex-1" />
          </div>
          <CartPreview />
        </section>

        {/* Extra Info */}
        <section className="slide-up space-y-3" style={{ animationDelay: '0.15s' }}>
          <div className="flex items-center gap-3">
            <span className="eyebrow">03 · ملاحظات</span>
            <div className="rule flex-1" />
          </div>
          <Card className="border border-foreground/15 rounded-none shadow-none bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="font-display text-xl flex items-center gap-2 text-primary">
                <FileEdit className="h-4 w-4 text-secondary" strokeWidth={2.25} />
                معلومات إضافية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="extraInfo" className="text-muted-foreground text-xs mb-2 block uppercase tracking-wider">
                أضف ملاحظات تُرفق بالفاتورة
              </Label>
              <Input
                id="extraInfo"
                placeholder="ملاحظات إضافية..."
                value={extraInfo}
                onChange={(e) => setExtraInfo(e.target.value)}
                className="rounded-none border-foreground/20 focus-visible:ring-0 focus-visible:border-primary"
              />
            </CardContent>
          </Card>
        </section>

        {/* Product Search */}
        <section className="slide-up space-y-3" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-center gap-3">
            <span className="eyebrow">04 · البحث</span>
            <div className="rule flex-1" />
          </div>
          <div className="border border-foreground/15 bg-card p-5">
            <h2 className="font-display text-xl font-bold mb-4 text-primary">
              البحث بكود المنتج
            </h2>
            <ProductSearch />
          </div>
        </section>

        {/* Credit */}
        <section className="slide-up pt-4" style={{ animationDelay: '0.25s' }}>
          <Button
            variant="outline"
            className="w-full py-5 rounded-none border border-foreground/20 bg-transparent hover:bg-primary hover:text-primary-foreground hover:border-primary text-foreground font-sans-alt uppercase tracking-[0.2em] text-xs"
            onClick={() => window.open('https://wa.me/201033110143', '_blank')}
          >
            <MessageCircle className="h-4 w-4 ml-2" strokeWidth={2.25} />
            made by yassin bassem
          </Button>
        </section>

        {/* Editorial colophon */}
        <footer className="pt-8 mt-8 border-t border-foreground/15 flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-sans-alt">
          <span>DiDutti Kid's</span>
          <span className="text-secondary">●</span>
          <span>MMXXVI</span>
        </footer>
      </main>
    </div>
  );
};

export default Index;
