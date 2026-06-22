import { useState } from 'react';
import { Plus, Trash2, Save, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface PieceItem {
  product_id: string;
  code: string;
  name: string;
  price: number;
  quantity: number;
  stock_quantity: number;
}

const PieceSale = () => {
  const { activeVersion } = useVersion();
  const [codeInput, setCodeInput] = useState('');
  const [qtyInput, setQtyInput] = useState<number>(1);
  const [items, setItems] = useState<PieceItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [customer, setCustomer] = useState({
    customer_name: '',
    phone: '',
    shop_name: '',
    address: '',
    delivery_date: '',
    shipping_company: '',
    deposit_method: '',
    deposit_amount: 0,
    extra_info: '',
  });

  const subtotal = items.reduce((s, it) => s + it.price * it.quantity, 0);
  const total = Math.max(0, subtotal - (customer.deposit_amount || 0));

  const handleAdd = async () => {
    if (!activeVersion) return;
    const code = codeInput.trim();
    const qty = Number(qtyInput) || 0;
    if (!code) return toast.error('أدخل كود المنتج');
    if (qty < 1) return toast.error('الكمية غير صحيحة');

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('code', code)
      .eq('version_id', activeVersion.id)
      .maybeSingle();

    if (error || !product) return toast.error('المنتج غير موجود');

    setItems((prev) => {
      const existing = prev.find((p) => p.product_id === product.id);
      if (existing) {
        return prev.map((p) =>
          p.product_id === product.id ? { ...p, quantity: p.quantity + qty } : p
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          code: product.code,
          name: product.name,
          price: Number(product.price),
          quantity: qty,
          stock_quantity: product.stock_quantity,
        },
      ];
    });
    setCodeInput('');
    setQtyInput(1);
  };

  const updateQty = (id: string, q: number) => {
    if (q < 1) return;
    setItems((prev) => prev.map((p) => (p.product_id === id ? { ...p, quantity: q } : p)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((p) => p.product_id !== id));
  };

  const handleSave = async () => {
    if (!activeVersion) return;
    if (items.length === 0) return toast.error('أضف منتج واحد على الأقل');
    if (!customer.customer_name || !customer.phone) {
      return toast.error('أدخل اسم العميل ورقم الهاتف');
    }
    setSaving(true);
    try {
      const { data: nextOrderNum } = await supabase.rpc('get_next_order_number', {
        p_version_id: activeVersion.id,
      });
      const orderNumber = nextOrderNum || 1;

      const { data: newOrder, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: customer.customer_name,
          phone: customer.phone,
          shop_name: customer.shop_name || null,
          address: customer.address || null,
          delivery_date: customer.delivery_date || null,
          shipping_company: customer.shipping_company || null,
          deposit_method: customer.deposit_method || null,
          deposit_amount: customer.deposit_amount || 0,
          extra_info: customer.extra_info || null,
          subtotal,
          total,
          status: 'pending',
          version_id: activeVersion.id,
          order_number: orderNumber,
          order_type: 'piece',
        } as any)
        .select()
        .single();

      if (orderError || !newOrder) throw orderError || new Error('order failed');

      // product_description = null => trigger uses multiplier 1 (sell exact pieces)
      const itemsRows = items.map((it) => ({
        order_id: newOrder.id,
        product_id: it.product_id,
        product_code: it.code,
        product_name: it.name,
        product_description: null,
        price: it.price,
        quantity: it.quantity,
        version_id: activeVersion.id,
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsRows);
      if (itemsError) {
        await supabase.from('orders').delete().eq('id', newOrder.id);
        throw itemsError;
      }

      toast.success(`تم حفظ طلب بيع بالقطعة رقم #${orderNumber}`);
      setItems([]);
      setCustomer({
        customer_name: '',
        phone: '',
        shop_name: '',
        address: '',
        delivery_date: '',
        shipping_company: '',
        deposit_method: '',
        deposit_amount: 0,
        extra_info: '',
      });
    } catch (e: any) {
      toast.error(e.message || 'فشل في حفظ الطلب');
    } finally {
      setSaving(false);
    }
  };

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Scissors className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">بيع بالقطعة</h1>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2">
            <div>
              <Label>كود المنتج</Label>
              <Input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                dir="ltr"
                placeholder="مثال: 123"
              />
            </div>
            <div>
              <Label>الكمية (قطع)</Label>
              <Input
                type="number"
                min={1}
                value={qtyInput}
                onChange={(e) => setQtyInput(parseInt(e.target.value) || 1)}
                dir="ltr"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAdd} className="gap-2 w-full">
                <Plus className="h-4 w-4" /> إضافة
              </Button>
            </div>
          </div>

          {items.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-right">الكود</th>
                    <th className="p-2 text-right">المنتج</th>
                    <th className="p-2 text-right">سعر القطعة</th>
                    <th className="p-2 text-right">الكمية</th>
                    <th className="p-2 text-right">الإجمالي</th>
                    <th className="p-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.product_id} className="border-t">
                      <td className="p-2" dir="ltr">{it.code}</td>
                      <td className="p-2">{it.name}</td>
                      <td className="p-2">{it.price} ج.م</td>
                      <td className="p-2">
                        <Input
                          type="number"
                          min={1}
                          value={it.quantity}
                          onChange={(e) => updateQty(it.product_id, parseInt(e.target.value) || 1)}
                          className="w-20"
                          dir="ltr"
                        />
                      </td>
                      <td className="p-2 font-bold">{(it.price * it.quantity).toFixed(2)} ج.م</td>
                      <td className="p-2">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeItem(it.product_id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h2 className="font-bold border-b pb-2">معلومات العميل</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>اسم العميل *</Label>
              <Input value={customer.customer_name} onChange={(e) => setCustomer({ ...customer, customer_name: e.target.value })} />
            </div>
            <div>
              <Label>رقم الهاتف *</Label>
              <Input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>اسم المحل</Label>
              <Input value={customer.shop_name} onChange={(e) => setCustomer({ ...customer, shop_name: e.target.value })} />
            </div>
            <div>
              <Label>العنوان</Label>
              <Input value={customer.address} onChange={(e) => setCustomer({ ...customer, address: e.target.value })} />
            </div>
            <div>
              <Label>تاريخ التسليم</Label>
              <Input type="date" value={customer.delivery_date} onChange={(e) => setCustomer({ ...customer, delivery_date: e.target.value })} dir="ltr" />
            </div>
            <div>
              <Label>شركة الشحن</Label>
              <Input value={customer.shipping_company} onChange={(e) => setCustomer({ ...customer, shipping_company: e.target.value })} />
            </div>
            <div>
              <Label>طريقة العربون</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={customer.deposit_method}
                onChange={(e) => setCustomer({ ...customer, deposit_method: e.target.value })}
              >
                <option value="">بدون عربون</option>
                <option value="cash">كاش</option>
                <option value="instapay">انستاباي</option>
                <option value="vodafone_cash">فودافون كاش</option>
              </select>
            </div>
            <div>
              <Label>قيمة العربون</Label>
              <Input
                type="number"
                min={0}
                value={customer.deposit_amount}
                onChange={(e) => setCustomer({ ...customer, deposit_amount: parseFloat(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>ملاحظات</Label>
              <Input value={customer.extra_info} onChange={(e) => setCustomer({ ...customer, extra_info: e.target.value })} />
            </div>
          </div>

          <div className="border-t pt-3 space-y-1 text-left">
            <p>الإجمالي الفرعي: {subtotal.toFixed(2)} ج.م</p>
            {customer.deposit_amount > 0 && (
              <p className="text-secondary">العربون: -{customer.deposit_amount.toFixed(2)} ج.م</p>
            )}
            <p className="text-xl font-bold text-primary">المطلوب: {total.toFixed(2)} ج.م</p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            <Save className="h-4 w-4" />
            {saving ? 'جاري الحفظ...' : 'حفظ الطلب'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PieceSale;
