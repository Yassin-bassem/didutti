import { useEffect, useState } from 'react';
import { Eye, Edit2, Trash2, FileText, Search, ShoppingCart, Plus, Copy, Gift, Download } from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import logoImage from '@/assets/didutti-logo.jpg';
import { useVersion } from '@/contexts/VersionContext';
import { notifyTelegram, diffObjects } from '@/lib/telegramNotify';

interface OrderItem {
  id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_description: string | null;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  order_number: number;
  customer_name: string;
  shop_name: string | null;
  phone: string;
  address: string | null;
  delivery_date: string | null;
  shipping_company: string | null;
  deposit_method: string | null;
  deposit_amount: number;
  discount: number;
  discount_type: string | null;
  subtotal: number;
  total: number;
  status: string;
  created_at: string;
  extra_info: string | null;
  staff_member_id: string | null;
  staff_member_name: string | null;
  order_type?: string | null;
  items?: OrderItem[];
}

const statusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  cancelled: 'ملغي',
};

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};
const orderTypeCardClass = (t?: string | null): string => {
  if (t === 'gift') return 'bg-pink-50 border-pink-200';
  if (t === 'piece') return 'bg-blue-50 border-blue-200';
  return '';
};

const orderTypeLabel = (t?: string | null): { label: string; cls: string } | null => {
  if (t === 'gift') return { label: '🎁 هدية', cls: 'bg-pink-100 text-pink-800' };
  if (t === 'piece') return { label: '✂️ بيع بالقطعة', cls: 'bg-blue-100 text-blue-800' };
  return null;
};

// Helper to get description multiplier (e.g., "250/10" => 10)
const getDescriptionMultiplier = (description: string | null): number => {
  if (!description) return 1;
  const match = description.match(/(\d+)\/(\d+)/);
  if (match) {
    return parseInt(match[2]);
  }
  return 1;
};

// Calculate item total with description multiplier
const calculateItemTotal = (item: OrderItem): number => {
  const multiplier = getDescriptionMultiplier(item.product_description);
  return item.price * item.quantity * multiplier;
};

// Calculate actual discount amount based on type
const getDiscountAmount = (order: { discount: number; discount_type: string | null; }, subtotal: number): number => {
  const discount = order.discount || 0;
  if (!discount) return 0;
  if (order.discount_type === 'percent') {
    return (subtotal * discount) / 100;
  }
  return discount;
};

const Orders = () => {
  const { activeVersion } = useVersion();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [originalOrder, setOriginalOrder] = useState<Order | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [addProductCode, setAddProductCode] = useState('');
  const [duplicateCustomer, setDuplicateCustomer] = useState({
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

  useEffect(() => {
    if (activeVersion) {
      loadOrders();

      const channel = supabase
        .channel('orders-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
          loadOrders();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeVersion]);

  const loadOrders = async () => {
    if (!activeVersion) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('version_id', activeVersion.id)
      .order('order_number', { ascending: false });

    if (error) {
      toast.error('فشل في تحميل الطلبات');
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const loadOrderItems = async (orderId: string) => {
    const { data } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);
    return data || [];
  };

  const handleView = async (order: Order) => {
    const items = await loadOrderItems(order.id);
    setSelectedOrder({ ...order, items });
    setViewDialogOpen(true);
  };

  const handleEdit = async (order: Order) => {
    const items = await loadOrderItems(order.id);
    const full = { ...order, items };
    setSelectedOrder(full);
    setOriginalOrder(JSON.parse(JSON.stringify(full)));
    setEditDialogOpen(true);
  };

  const handleDuplicate = async (order: Order) => {
    const items = await loadOrderItems(order.id);
    setSelectedOrder({ ...order, items });
    setDuplicateCustomer({
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
    setDuplicateDialogOpen(true);
  };

  const handleCreateDuplicateOrder = async () => {
    if (!selectedOrder || !selectedOrder.items || !duplicateCustomer.customer_name || !duplicateCustomer.phone) {
      toast.error('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }

    if (!activeVersion) {
      toast.error('لا توجد نسخة نشطة');
      return;
    }

    // Calculate subtotal
    const subtotal = selectedOrder.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const total = subtotal - (duplicateCustomer.deposit_amount || 0);

    // Get next order number for this version
    const { data: nextOrderNum } = await supabase.rpc('get_next_order_number', { p_version_id: activeVersion.id });
    const orderNumber = nextOrderNum || 1;

    // Create new order
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_name: duplicateCustomer.customer_name,
        phone: duplicateCustomer.phone,
        shop_name: duplicateCustomer.shop_name || null,
        address: duplicateCustomer.address || null,
        delivery_date: duplicateCustomer.delivery_date || null,
        shipping_company: duplicateCustomer.shipping_company || null,
        deposit_method: duplicateCustomer.deposit_method || null,
        deposit_amount: duplicateCustomer.deposit_amount || 0,
        extra_info: duplicateCustomer.extra_info || null,
        subtotal,
        total,
        status: 'pending',
        version_id: activeVersion.id,
        order_number: orderNumber,
      })
      .select()
      .single();

    if (orderError || !newOrder) {
      toast.error('فشل في إنشاء الطلب');
      return;
    }

    // Insert order items (this will trigger stock deduction via the trigger)
    const orderItemsToInsert = selectedOrder.items.map(item => ({
      order_id: newOrder.id,
      product_id: item.product_id,
      product_code: item.product_code,
      product_name: item.product_name,
      product_description: item.product_description,
      price: item.price,
      quantity: item.quantity,
      version_id: activeVersion.id,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsToInsert);

    if (itemsError) {
      toast.error('فشل في إضافة المنتجات للطلب');
      // Delete the order if items failed
      await supabase.from('orders').delete().eq('id', newOrder.id);
      return;
    }

    toast.success(`تم إنشاء طلب جديد رقم #${newOrder.order_number}`);
    setDuplicateDialogOpen(false);
    loadOrders();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

    // Get full order for telegram notification
    const orderToDelete = orders.find(o => o.id === id);

    // First get order items to restore stock
    const items = await loadOrderItems(id);
    
    // Restore stock for all items
    for (const item of items) {
      const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
      if (product) {
        await supabase.from('products').update({
          stock_quantity: product.stock_quantity + item.quantity
        }).eq('id', item.product_id);
      }
    }

    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) {
      toast.error('فشل في حذف الطلب');
    } else {
      // Reset order number sequence to continue from max existing order number
      await supabase.rpc('reset_order_number_sequence');
      toast.success('تم حذف الطلب');

      if (orderToDelete) {
        notifyTelegram({
          type: 'order_deleted',
          orderNumber: orderToDelete.order_number,
          customerName: orderToDelete.customer_name,
          shopName: orderToDelete.shop_name,
          phone: orderToDelete.phone,
          address: orderToDelete.address,
          subtotal: orderToDelete.subtotal,
          total: orderToDelete.total,
          depositAmount: orderToDelete.deposit_amount,
          depositMethod: orderToDelete.deposit_method,
          items: items.map((it: any) => ({
            name: it.product_name,
            code: it.product_code,
            quantity: it.quantity,
            price: it.price,
          })),
        });
      }

      loadOrders();
    }
  };

  const handleMakeGift = async (order: Order) => {
    if (order.order_type === 'gift') {
      if (!confirm('هذا الطلب هدية بالفعل. هل تريد إعادته إلى طلب عادي؟')) return;
      const { error } = await (supabase as any)
        .from('orders')
        .update({ order_type: 'normal' })
        .eq('id', order.id);
      if (error) return toast.error('فشل في التحديث');
      toast.success('تم إرجاع الطلب لطلب عادي');
      loadOrders();
      return;
    }
    if (!confirm('تحويل هذا الطلب إلى هدية؟ سيتم تصفير الإجمالي والعربون.')) return;
    const { error } = await (supabase as any)
      .from('orders')
      .update({
        order_type: 'gift',
        subtotal: 0,
        total: 0,
        deposit_amount: 0,
        deposit_method: null,
        discount: 0,
      })
      .eq('id', order.id);
    if (error) return toast.error('فشل في تحويل الطلب');
    await supabase.from('deposits').delete().eq('order_id', order.id);
    toast.success('تم تحويل الطلب إلى هدية 🎁');
    notifyTelegram({
      type: 'order_edited',
      orderNumber: order.order_number,
      customerName: order.customer_name,
      changes: [{ field: 'نوع الطلب', from: 'عادي', to: 'هدية 🎁 (الإجمالي = 0)' }],
    });
    loadOrders();
  };

  const handleStatusChange = async (order: Order, newStatus: string) => {
    if (newStatus === order.status) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', order.id);
    if (error) {
      toast.error('فشل في تحديث الحالة');
      return;
    }
    toast.success(`تم تحديث الحالة إلى: ${statusLabels[newStatus] || newStatus}`);
    notifyTelegram({
      type: 'order_edited',
      orderNumber: order.order_number,
      customerName: order.customer_name,
      changes: [{ field: 'الحالة', from: statusLabels[order.status] || order.status, to: statusLabels[newStatus] || newStatus }],
    });
    loadOrders();
  };




  const handleAddProductToOrder = async () => {
    if (!selectedOrder || !addProductCode.trim() || !activeVersion) return;

    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('code', addProductCode.trim())
      .eq('version_id', activeVersion.id)
      .maybeSingle();

    if (productError || !product) {
      toast.error('المنتج غير موجود');
      return;
    }

    // Deduct stock
    await supabase.from('products').update({
      stock_quantity: product.stock_quantity - 1
    }).eq('id', product.id);

    const { error } = await supabase.from('order_items').insert({
      order_id: selectedOrder.id,
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      product_description: product.description,
      price: product.price,
      quantity: 1,
      version_id: activeVersion.id,
    });

    if (error) {
      toast.error('فشل في إضافة المنتج');
      // Restore stock on failure
      await supabase.from('products').update({
        stock_quantity: product.stock_quantity
      }).eq('id', product.id);
    } else {
      toast.success('تم إضافة المنتج');
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      setAddProductCode('');
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount - getDiscountAmount(selectedOrder, newSubtotal),
      }).eq('id', selectedOrder.id);

      notifyTelegram({
        type: 'order_edited',
        orderNumber: selectedOrder.order_number,
        customerName: selectedOrder.customer_name,
        changes: [{ field: 'إضافة منتج', from: '—', to: `${product.code} - ${product.name} (كمية 1)` }],
      });

      loadOrders();
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!selectedOrder) return;

    // Get item to restore stock
    const itemToRemove = selectedOrder.items?.find(i => i.id === itemId);
    
    const { error } = await supabase.from('order_items').delete().eq('id', itemId);
    if (error) {
      toast.error('فشل في حذف المنتج');
    } else {
      // Restore stock
      if (itemToRemove) {
        const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', itemToRemove.product_id).single();
        if (product) {
          await supabase.from('products').update({
            stock_quantity: product.stock_quantity + itemToRemove.quantity
          }).eq('id', itemToRemove.product_id);
        }
      }
      
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount - getDiscountAmount(selectedOrder, newSubtotal),
      }).eq('id', selectedOrder.id);

      if (itemToRemove) {
        notifyTelegram({
          type: 'order_edited',
          orderNumber: selectedOrder.order_number,
          customerName: selectedOrder.customer_name,
          changes: [{ field: 'حذف منتج', from: `${itemToRemove.product_code} - ${itemToRemove.product_name} (كمية ${itemToRemove.quantity})`, to: '—' }],
        });
      }

      loadOrders();
    }
  };

  const handleUpdateItemQuantity = async (itemId: string, quantity: number) => {
    if (!selectedOrder || quantity < 1) return;

    // Get current item to calculate stock difference
    const currentItem = selectedOrder.items?.find(i => i.id === itemId);
    if (!currentItem) return;
    
    const quantityDiff = quantity - currentItem.quantity;
    
    // Update stock (negative diff means more items, so deduct; positive means fewer items, so restore)
    const { data: product } = await supabase.from('products').select('stock_quantity').eq('id', currentItem.product_id).single();
    if (product) {
      await supabase.from('products').update({
        stock_quantity: product.stock_quantity - quantityDiff
      }).eq('id', currentItem.product_id);
    }

    const { error } = await supabase.from('order_items').update({ quantity }).eq('id', itemId);
    if (error) {
      toast.error('فشل في تحديث الكمية');
      // Restore stock on failure
      if (product) {
        await supabase.from('products').update({
          stock_quantity: product.stock_quantity
        }).eq('id', currentItem.product_id);
      }
    } else {
      const items = await loadOrderItems(selectedOrder.id);
      setSelectedOrder({ ...selectedOrder, items });
      
      // Update order totals with description multiplier
      const newSubtotal = items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
      await supabase.from('orders').update({
        subtotal: newSubtotal,
        total: newSubtotal - selectedOrder.deposit_amount - getDiscountAmount(selectedOrder, newSubtotal),
      }).eq('id', selectedOrder.id);

      if (quantityDiff !== 0) {
        notifyTelegram({
          type: 'order_edited',
          orderNumber: selectedOrder.order_number,
          customerName: selectedOrder.customer_name,
          changes: [{ field: `كمية ${currentItem.product_code} - ${currentItem.product_name}`, from: currentItem.quantity, to: quantity }],
        });
      }

      loadOrders();
    }
  };

  const getLogoBase64 = (): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.onerror = () => resolve('');
      img.src = logoImage;
    });
  };

  const generateInvoice = async (order: Order) => {
    if (!order.items) return;

    const logoBase64 = await getLogoBase64();

    // Calculate totals with description multiplier
    const calculatedSubtotal = order.items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
    const orderDiscount = getDiscountAmount(order, calculatedSubtotal);
    const calculatedTotal = calculatedSubtotal - order.deposit_amount - orderDiscount;

    const invoiceHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة رقم ${order.order_number}</title>
        <style>
          body { font-family: 'Cairo', Arial, sans-serif; padding: 20px; direction: rtl; }
          .header { text-align: center; margin-bottom: 30px; }
          .header img { width: 150px; height: auto; object-fit: contain; margin-bottom: 10px; }
          .header h1 { color: #1e2a5e; margin: 0; }
          .header p { color: #7c4daf; }
          .info { margin-bottom: 20px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
          th { background: #1e2a5e; color: white; }
          .totals { text-align: left; }
          .totals p { margin: 5px 0; }
          .totals .total { font-size: 1.2em; font-weight: bold; color: #1e2a5e; }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoBase64 ? `<img src="${logoBase64}" alt="DIDUTTI KID'S Logo" />` : ''}
          <h1>DIDUTTI KID'S</h1>
          <h2>فاتورة رقم ${order.order_number}</h2>
          ${order.order_type === 'gift' ? `<div style="display:inline-block;margin-top:8px;padding:8px 18px;background:#fce7f3;color:#9d174d;border:2px dashed #ec4899;border-radius:8px;font-size:1.2em;font-weight:bold;">🎁 هذه الفاتورة هدية</div>` : ''}
          ${order.order_type === 'piece' ? `<div style="display:inline-block;margin-top:8px;padding:6px 14px;background:#dbeafe;color:#1e40af;border-radius:8px;font-weight:bold;">✂️ بيع بالقطعة</div>` : ''}
        </div>
        <div class="info">
          <p><strong>العميل:</strong> ${order.customer_name}</p>
          ${order.shop_name ? `<p><strong>المحل:</strong> ${order.shop_name}</p>` : ''}
          <p><strong>الهاتف:</strong> ${order.phone}</p>
          ${order.address ? `<p><strong>العنوان:</strong> ${order.address}</p>` : ''}
          <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-EG')}</p>
          ${order.extra_info ? `<p><strong>ملاحظات:</strong> ${order.extra_info}</p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>الكود</th>
              <th>المنتج</th>
              <th>السعر</th>
              <th>الكمية</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${[...order.items].sort((a, b) => a.product_code.localeCompare(b.product_code, undefined, { numeric: true })).map(item => {
              // Parse description for quantity calculation (e.g., "200/20" means pack of 20)
              let displayQuantity = item.quantity;
              const multiplier = getDescriptionMultiplier(item.product_description);
              if (multiplier > 1) {
                displayQuantity = item.quantity * multiplier;
              }
              const itemTotal = calculateItemTotal(item);
              return `
                <tr>
                  <td>${item.product_code}</td>
                  <td>${item.product_name}</td>
                  <td>${item.price} ج.م</td>
                  <td>${displayQuantity}</td>
                  <td>${itemTotal.toFixed(2)} ج.م</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        <div class="totals">
          ${order.order_type === 'gift' ? `
            <p>الإجمالي الفرعي: ${calculatedSubtotal.toFixed(2)} ج.م</p>
            <p style="color:#9d174d;font-weight:bold;">خصم الهدية: -${calculatedSubtotal.toFixed(2)} ج.م</p>
            <p class="total" style="color:#9d174d;">المطلوب: 0.00 ج.م 🎁 (هدية)</p>
          ` : `
            <p>الإجمالي الفرعي: ${calculatedSubtotal.toFixed(2)} ج.م</p>
            ${orderDiscount > 0 ? `<p>الخصم${order.discount_type === 'percent' ? ` (${order.discount}%)` : ''}: -${orderDiscount.toFixed(2)} ج.م</p>` : ''}
            ${order.deposit_amount > 0 ? `<p>العربون (${order.deposit_method}): -${order.deposit_amount.toFixed(2)} ج.م</p>` : ''}
            <p class="total">المطلوب: ${calculatedTotal.toFixed(2)} ج.م</p>
          `}
        </div>
      </body>
      </html>
    `;

    const isMobile = /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (!isMobile) {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
        setTimeout(() => {
          printWindow.print();
        }, 500);
        return;
      }
    }

    // Mobile: inject print/close buttons into the HTML and open as a full-page overlay
    const mobileHtml = invoiceHtml.replace('</body>', `
      <div style="position:fixed;bottom:0;left:0;right:0;display:flex;gap:10px;padding:12px;background:#fff;border-top:2px solid #000;z-index:10000;justify-content:center;">
        <button onclick="window.print()" style="flex:1;max-width:200px;padding:12px;font-size:16px;font-weight:bold;background:#2563eb;color:#fff;border:none;border-radius:8px;cursor:pointer;">🖨️ طباعة</button>
        <button onclick="document.getElementById('mobile-invoice-overlay').remove()" style="flex:1;max-width:200px;padding:12px;font-size:16px;font-weight:bold;background:#ef4444;color:#fff;border:none;border-radius:8px;cursor:pointer;">✕ إغلاق</button>
      </div>
    </body>`);

    const blob = new Blob([mobileHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    // Open in a new tab — works on most mobile browsers
    const newTab = window.open(url, '_blank');
    if (!newTab) {
      // If popup blocked, use location redirect
      window.location.href = url;
    }
    // Clean up blob URL after a delay
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (!searchCode) return true;
    return (
      o.order_number.toString().includes(searchCode) ||
      o.phone.includes(searchCode) ||
      o.customer_name.toLowerCase().includes(searchCode.toLowerCase()) ||
      (o.shop_name && o.shop_name.toLowerCase().includes(searchCode.toLowerCase()))
    );
  });

  const statusCounts = orders.reduce<Record<string, number>>((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});


  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">الطلبات</h1>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث برقم الطلب أو الهاتف أو الاسم أو المحل..."
            value={searchCode}
            onChange={(e) => setSearchCode(e.target.value)}
            className="pr-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'pending', label: statusLabels.pending },
            { key: 'confirmed', label: statusLabels.confirmed },
            { key: 'shipped', label: statusLabels.shipped },
            { key: 'delivered', label: statusLabels.delivered },
            { key: 'cancelled', label: statusLabels.cancelled },
          ].map((s) => {
            const count = s.key === 'all' ? orders.length : (statusCounts[s.key] || 0);
            const active = statusFilter === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                {s.label} <span className="opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      </div>


      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : filteredOrders.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center py-12">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">لا توجد طلبات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const typeBadge = orderTypeLabel(order.order_type);
            return (
            <Card key={order.id} className={`hover:shadow-baby transition-shadow ${orderTypeCardClass(order.order_type)}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-3xl font-bold text-primary">#{order.order_number}</div>
                    <div>
                      <p className="font-bold">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.phone}</p>
                      <div className="flex gap-1 flex-wrap mt-1">
                        {order.staff_member_name ? (
                          <Badge className="bg-purple-100 text-purple-800">
                            👷 موظف: {order.staff_member_name}
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800">
                            👤 عميل
                          </Badge>
                        )}
                        {typeBadge && <Badge className={typeBadge.cls}>{typeBadge.label}</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusChange(order, e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className={`text-xs font-semibold rounded-full px-3 py-1 border-0 focus:ring-2 focus:ring-primary cursor-pointer ${statusColors[order.status] || 'bg-muted'}`}
                        dir="rtl"
                      >
                        {Object.entries(statusLabels).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                      <p className="text-lg font-bold text-primary mt-1">{order.total.toFixed(2)} ج.م</p>
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                      <Button size="sm" variant="outline" onClick={() => handleView(order)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleEdit(order)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDuplicate(order)} title="نسخ الطلب">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={order.order_type === 'gift' ? 'bg-pink-100 text-pink-700' : 'text-pink-600'}
                        onClick={() => handleMakeGift(order)}
                        title={order.order_type === 'gift' ? 'إلغاء الهدية' : 'تحويل إلى هدية'}
                      >
                        <Gift className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={async () => {
                        const items = await loadOrderItems(order.id);
                        generateInvoice({ ...order, items });
                      }}>
                        <FileText className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => handleDelete(order.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* View Order Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>طلب رقم #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>العميل:</strong> {selectedOrder.customer_name}</div>
                <div><strong>الهاتف:</strong> {selectedOrder.phone}</div>
                {selectedOrder.shop_name && <div><strong>المحل:</strong> {selectedOrder.shop_name}</div>}
                {selectedOrder.address && <div><strong>العنوان:</strong> {selectedOrder.address}</div>}
                {selectedOrder.delivery_date && <div><strong>تاريخ التسليم:</strong> {selectedOrder.delivery_date}</div>}
                {selectedOrder.shipping_company && <div><strong>شركة الشحن:</strong> {selectedOrder.shipping_company}</div>}
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-right">المنتج</th>
                      <th className="p-3 text-right">السعر</th>
                      <th className="p-3 text-right">الكمية</th>
                      <th className="p-3 text-right">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items?.map((item) => {
                      const itemTotal = calculateItemTotal(item);
                      return (
                        <tr key={item.id} className="border-t">
                          <td className="p-3">
                            <p className="font-medium">{item.product_name}</p>
                            <p className="text-xs text-muted-foreground">#{item.product_code}</p>
                          </td>
                          <td className="p-3">{item.price} ج.م</td>
                          <td className="p-3">{item.quantity}</td>
                          <td className="p-3">{itemTotal.toFixed(2)} ج.م</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="text-left space-y-1">
                {(() => {
                  const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                  const calcDiscountAmt = getDiscountAmount(selectedOrder, calcSubtotal);
                  const calcTotal = calcSubtotal - selectedOrder.deposit_amount - calcDiscountAmt;
                  return (
                    <>
                      <p>الإجمالي الفرعي: {calcSubtotal.toFixed(2)} ج.م</p>
                      {calcDiscountAmt > 0 && (
                        <p className="text-orange-600">الخصم{selectedOrder.discount_type === 'percent' ? ` (${selectedOrder.discount}%)` : ''}: -{calcDiscountAmt.toFixed(2)} ج.م</p>
                      )}
                      {selectedOrder.deposit_amount > 0 && (
                        <p className="text-secondary">العربون: -{selectedOrder.deposit_amount.toFixed(2)} ج.م</p>
                      )}
                      <p className="text-xl font-bold text-primary">المطلوب: {calcTotal.toFixed(2)} ج.م</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Duplicate Order Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>نسخ طلب رقم #{selectedOrder?.order_number} لعميل جديد</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* New Customer Information */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">معلومات العميل الجديد</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">اسم العميل *</label>
                    <Input
                      value={duplicateCustomer.customer_name}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, customer_name: e.target.value })}
                      placeholder="أدخل اسم العميل"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">رقم الهاتف *</label>
                    <Input
                      value={duplicateCustomer.phone}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, phone: e.target.value })}
                      placeholder="أدخل رقم الهاتف"
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">اسم المحل</label>
                    <Input
                      value={duplicateCustomer.shop_name}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, shop_name: e.target.value })}
                      placeholder="أدخل اسم المحل"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">العنوان</label>
                    <Input
                      value={duplicateCustomer.address}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, address: e.target.value })}
                      placeholder="أدخل العنوان"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">تاريخ التسليم</label>
                    <Input
                      type="date"
                      value={duplicateCustomer.delivery_date}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, delivery_date: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">شركة الشحن</label>
                    <Input
                      value={duplicateCustomer.shipping_company}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, shipping_company: e.target.value })}
                      placeholder="أدخل شركة الشحن"
                    />
                  </div>
                </div>
              </div>

              {/* Deposit Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">معلومات العربون</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">طريقة الدفع</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={duplicateCustomer.deposit_method}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, deposit_method: e.target.value })}
                    >
                      <option value="">بدون عربون</option>
                      <option value="cash">كاش</option>
                      <option value="instapay">انستاباي</option>
                      <option value="vodafone_cash">فودافون كاش</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">قيمة العربون</label>
                    <Input
                      type="number"
                      min="0"
                      value={duplicateCustomer.deposit_amount}
                      onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, deposit_amount: parseFloat(e.target.value) || 0 })}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground">ملاحظات إضافية</label>
                  <Input
                    value={duplicateCustomer.extra_info}
                    onChange={(e) => setDuplicateCustomer({ ...duplicateCustomer, extra_info: e.target.value })}
                    placeholder="أي ملاحظات إضافية"
                  />
                </div>
              </div>

              {/* Products Preview */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">المنتجات (من الطلب الأصلي)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-right">المنتج</th>
                        <th className="p-3 text-right">السعر</th>
                        <th className="p-3 text-right">الكمية</th>
                        <th className="p-3 text-right">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item) => {
                        const itemTotal = calculateItemTotal(item);
                        return (
                          <tr key={item.id} className="border-t">
                            <td className="p-3">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">#{item.product_code}</p>
                            </td>
                            <td className="p-3">{item.price} ج.م</td>
                            <td className="p-3">{item.quantity}</td>
                            <td className="p-3">{itemTotal.toFixed(2)} ج.م</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="text-left space-y-1 border-t pt-4">
                {(() => {
                  const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                  const calcTotal = calcSubtotal - (duplicateCustomer.deposit_amount || 0);
                  return (
                    <>
                      <p>الإجمالي الفرعي: {calcSubtotal.toFixed(2)} ج.م</p>
                      {duplicateCustomer.deposit_amount > 0 && (
                        <p className="text-secondary">العربون: -{duplicateCustomer.deposit_amount.toFixed(2)} ج.م</p>
                      )}
                      <p className="text-xl font-bold text-primary">المطلوب: {calcTotal.toFixed(2)} ج.م</p>
                    </>
                  );
                })()}
              </div>

              <Button onClick={handleCreateDuplicateOrder} className="w-full gap-2">
                <Copy className="h-4 w-4" />
                إنشاء طلب جديد
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل طلب رقم #{selectedOrder?.order_number}</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Customer Information Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">معلومات العميل</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">اسم العميل</label>
                    <Input
                      value={selectedOrder.customer_name}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, customer_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">رقم الهاتف</label>
                    <Input
                      value={selectedOrder.phone}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, phone: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">اسم المحل</label>
                    <Input
                      value={selectedOrder.shop_name || ''}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, shop_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">العنوان</label>
                    <Input
                      value={selectedOrder.address || ''}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, address: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">تاريخ التسليم</label>
                    <Input
                      type="date"
                      value={selectedOrder.delivery_date || ''}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, delivery_date: e.target.value })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">شركة الشحن</label>
                    <Input
                      value={selectedOrder.shipping_company || ''}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, shipping_company: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Deposit Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">معلومات العربون</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground">طريقة الدفع</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={selectedOrder.deposit_method || ''}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, deposit_method: e.target.value || null })}
                    >
                      <option value="">بدون عربون</option>
                      <option value="cash">كاش</option>
                      <option value="instapay">انستاباي</option>
                      <option value="vodafone_cash">فودافون كاش</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">قيمة العربون</label>
                    <Input
                      type="number"
                      min="0"
                      value={selectedOrder.deposit_amount}
                      onChange={(e) => setSelectedOrder({ ...selectedOrder, deposit_amount: parseFloat(e.target.value) || 0 })}
                      dir="ltr"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">الخصم</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        min="0"
                        value={selectedOrder.discount || 0}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, discount: parseFloat(e.target.value) || 0 })}
                        dir="ltr"
                        className="flex-1"
                      />
                      <select
                        className="flex h-10 rounded-md border border-input bg-background px-2 py-2 text-sm ring-offset-background"
                        value={selectedOrder.discount_type || 'amount'}
                        onChange={(e) => setSelectedOrder({ ...selectedOrder, discount_type: e.target.value })}
                      >
                        <option value="amount">مبلغ</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={async () => {
                    const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                    const calcTotal = calcSubtotal - selectedOrder.deposit_amount - getDiscountAmount(selectedOrder, calcSubtotal);
                    
                    const { error } = await supabase.from('orders').update({
                      customer_name: selectedOrder.customer_name,
                      phone: selectedOrder.phone,
                      shop_name: selectedOrder.shop_name,
                      address: selectedOrder.address,
                      delivery_date: selectedOrder.delivery_date,
                      shipping_company: selectedOrder.shipping_company,
                      deposit_method: selectedOrder.deposit_method,
                      deposit_amount: selectedOrder.deposit_amount,
                      discount: selectedOrder.discount || 0,
                      discount_type: selectedOrder.discount_type || 'amount',
                      total: calcTotal,
                    }).eq('id', selectedOrder.id);

                    if (error) {
                      toast.error('فشل في حفظ التعديلات');
                    } else {
                      // Update the deposits table as well
                      // First, check if a deposit exists for this order
                      const { data: existingDeposit } = await supabase
                        .from('deposits')
                        .select('id')
                        .eq('order_id', selectedOrder.id)
                        .maybeSingle();

                      if (selectedOrder.deposit_amount > 0 && selectedOrder.deposit_method) {
                        if (existingDeposit) {
                          // Update existing deposit
                          await supabase.from('deposits').update({
                            amount: selectedOrder.deposit_amount,
                            method: selectedOrder.deposit_method,
                            customer_name: selectedOrder.customer_name,
                          }).eq('order_id', selectedOrder.id);
                        } else {
                          // Create new deposit - need to get version_id from the order
                          const { data: orderVersion } = await supabase
                            .from('orders')
                            .select('version_id')
                            .eq('id', selectedOrder.id)
                            .single();
                          
                          if (orderVersion) {
                            await supabase.from('deposits').insert({
                              order_id: selectedOrder.id,
                              order_number: selectedOrder.order_number,
                              customer_name: selectedOrder.customer_name,
                              amount: selectedOrder.deposit_amount,
                              method: selectedOrder.deposit_method,
                              version_id: orderVersion.version_id,
                            });
                          }
                        }
                      } else if (existingDeposit) {
                        // Remove deposit if amount is 0 or no method selected
                        await supabase.from('deposits').delete().eq('order_id', selectedOrder.id);
                      }

                      toast.success('تم حفظ التعديلات');

                      // Telegram diff notification
                      if (originalOrder) {
                        const labels: Record<string, string> = {
                          customer_name: 'اسم العميل',
                          phone: 'الهاتف',
                          shop_name: 'المحل',
                          address: 'العنوان',
                          delivery_date: 'تاريخ التسليم',
                          shipping_company: 'شركة الشحن',
                          deposit_method: 'طريقة العربون',
                          deposit_amount: 'مبلغ العربون',
                          discount: 'الخصم',
                          discount_type: 'نوع الخصم',
                        };
                        const changes = diffObjects(originalOrder as any, selectedOrder as any, labels);
                        if (Math.abs((originalOrder as any).total - calcTotal) > 0.001) {
                          changes.push({ field: 'الإجمالي المطلوب', from: (originalOrder as any).total, to: calcTotal });
                        }
                        if (changes.length > 0) {
                          notifyTelegram({
                            type: 'order_edited',
                            orderNumber: selectedOrder.order_number,
                            customerName: selectedOrder.customer_name,
                            changes,
                          });
                          setOriginalOrder({ ...selectedOrder, total: calcTotal } as any);
                        }
                      }

                      loadOrders();
                    }
                  }}
                >
                  حفظ معلومات العميل والعربون والخصم
                </Button>
              </div>

              {/* Products Section */}
              <div className="border rounded-lg p-4 space-y-4">
                <h3 className="font-bold text-lg border-b pb-2">المنتجات</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="أدخل كود المنتج"
                    value={addProductCode}
                    onChange={(e) => setAddProductCode(e.target.value)}
                    dir="ltr"
                  />
                  <Button onClick={handleAddProductToOrder} className="gap-2">
                    <Plus className="h-4 w-4" />
                    إضافة
                  </Button>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-right">المنتج</th>
                        <th className="p-3 text-right">السعر</th>
                        <th className="p-3 text-right">الكمية</th>
                        <th className="p-3 text-right">الإجمالي</th>
                        <th className="p-3 text-right">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.items?.map((item) => {
                        const itemTotal = calculateItemTotal(item);
                        return (
                          <tr key={item.id} className="border-t">
                            <td className="p-3">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-muted-foreground">#{item.product_code}</p>
                            </td>
                            <td className="p-3">{item.price} ج.م</td>
                            <td className="p-3">
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleUpdateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-20"
                                dir="ltr"
                              />
                            </td>
                            <td className="p-3 font-bold">{itemTotal.toFixed(2)} ج.م</td>
                            <td className="p-3">
                              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => handleRemoveItem(item.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="text-left space-y-1 border-t pt-4">
                {(() => {
                  const calcSubtotal = selectedOrder.items?.reduce((sum, item) => sum + calculateItemTotal(item), 0) || 0;
                  const calcDiscountAmt = getDiscountAmount(selectedOrder, calcSubtotal);
                  const calcTotal = calcSubtotal - selectedOrder.deposit_amount - calcDiscountAmt;
                  return (
                    <>
                      <p>الإجمالي الفرعي: {calcSubtotal.toFixed(2)} ج.م</p>
                      {calcDiscountAmt > 0 && (
                        <p className="text-orange-600">الخصم{selectedOrder.discount_type === 'percent' ? ` (${selectedOrder.discount}%)` : ''}: -{calcDiscountAmt.toFixed(2)} ج.م</p>
                      )}
                      {selectedOrder.deposit_amount > 0 && (
                        <p className="text-secondary">العربون: -{selectedOrder.deposit_amount.toFixed(2)} ج.م</p>
                      )}
                      <p className="text-xl font-bold text-primary">المطلوب: {calcTotal.toFixed(2)} ج.م</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Orders;
