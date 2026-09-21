import { useState } from 'react';
import { Search, ShoppingBag, Scissors, PackageCheck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useVersion } from '@/contexts/VersionContext';

interface OrderWithProduct {
  order_id: string;
  order_number: number;
  customer_name: string;
  phone: string;
  quantity: number;
  multiplier: number;
  pieces: number;
  price: number;
  total: number;
  created_at: string;
  status: string;
  product_description: string | null;
  order_type: string;
}

// Extract multiplier from description (e.g., "850/5" returns 5)
const getDescriptionMultiplier = (description: string | null | undefined): number => {
  if (!description) return 1;
  const match = description.match(/\/(\d+)/);
  return match ? parseInt(match[1], 10) : 1;
};

const SearchByCode = () => {
  const { activeVersion } = useVersion();
  const [searchCode, setSearchCode] = useState('');
  const [orders, setOrders] = useState<OrderWithProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [productName, setProductName] = useState('');
  const [productDescription, setProductDescription] = useState<string | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(0);

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      toast.error('الرجاء إدخال كود المنتج');
      return;
    }

    if (!activeVersion) {
      toast.error('يرجى اختيار نسخة أولاً');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // Get product name, description and stock
      const { data: product } = await supabase
        .from('products')
        .select('name, description, stock_quantity')
        .eq('code', searchCode.trim())
        .eq('version_id', activeVersion.id)
        .maybeSingle();

      setProductName(product?.name || searchCode.trim());
      setProductDescription(product?.description || null);
      setStockQuantity(product?.stock_quantity || 0);

      // Get all order items with this product code for this version
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          order_id,
          quantity,
          price,
          product_name,
          product_description
        `)
        .eq('product_code', searchCode.trim())
        .eq('version_id', activeVersion.id);

      if (error) throw error;

      if (!orderItems || orderItems.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // Get order details for each order item
      const orderIds = [...new Set(orderItems.map(item => item.order_id))];
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, phone, created_at, status, order_type')
        .in('id', orderIds)
        .eq('version_id', activeVersion.id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;

      // Combine order items with order details
      const combinedData: OrderWithProduct[] = orderItems.map(item => {
        const order = ordersData?.find(o => o.id === item.order_id);
        const orderType = order?.order_type || 'normal';
        const isPieceOrder = orderType === 'piece';

        // For piece orders, quantity is directly piece count and multiplier is 1
        const itemMultiplier = isPieceOrder ? 1 : getDescriptionMultiplier(item.product_description || product?.description);
        const piecesCount = isPieceOrder ? item.quantity : item.quantity * itemMultiplier;
        const itemTotal = isPieceOrder ? item.quantity * item.price : item.quantity * itemMultiplier * item.price;

        return {
          order_id: item.order_id,
          order_number: order?.order_number || 0,
          customer_name: order?.customer_name || '',
          phone: order?.phone || '',
          quantity: item.quantity,
          multiplier: itemMultiplier,
          pieces: piecesCount,
          price: item.price,
          total: itemTotal,
          created_at: order?.created_at || '',
          status: order?.status || '',
          product_description: item.product_description,
          order_type: orderType,
        };
      }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setOrders(combinedData);
      if (product?.name) {
        setProductName(product.name);
      }
    } catch (error) {
      console.error('Error searching:', error);
      toast.error('حدث خطأ أثناء البحث');
    } finally {
      setLoading(false);
    }
  };

  // Separate normal orders and piece orders
  const normalOrders = orders.filter(o => o.order_type !== 'piece');
  const pieceOrders = orders.filter(o => o.order_type === 'piece');

  // Normal orders calculations
  const normalQuantitySold = normalOrders.reduce((sum, order) => sum + order.quantity, 0);
  const normalPiecesSold = normalOrders.reduce((sum, order) => sum + order.pieces, 0);
  const normalSalesTotal = normalOrders.reduce((sum, order) => sum + order.total, 0);

  // Piece orders calculations (quantity IS pieces)
  const pieceQuantitySold = pieceOrders.reduce((sum, order) => sum + order.pieces, 0);
  const pieceSalesTotal = pieceOrders.reduce((sum, order) => sum + order.total, 0);

  // Grand totals
  const grandTotalPieces = normalPiecesSold + pieceQuantitySold;
  const grandTotalSales = normalSalesTotal + pieceSalesTotal;

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'قيد الانتظار';
      case 'confirmed': return 'مؤكد';
      case 'shipped': return 'تم الشحن';
      case 'delivered': return 'تم التوصيل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600';
      case 'confirmed': return 'text-blue-600';
      case 'shipped': return 'text-purple-600';
      case 'delivered': return 'text-green-600';
      case 'cancelled': return 'text-red-600';
      default: return '';
    }
  };

  const renderNormalOrdersTable = () => (
    <Card className="border-t-4 border-t-primary shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-primary" />
          <CardTitle className="text-lg font-bold">الطلبات العادية ({normalOrders.length})</CardTitle>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            {normalQuantitySold} طلب / سيريه
          </Badge>
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            {normalPiecesSold} قطعة
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {normalSalesTotal.toFixed(2)} ج.م
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {normalOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            لا توجد طلبات عادية تحتوي على هذا الكود
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">رقم الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">الكمية (بالطلب/السيريه)</TableHead>
                <TableHead className="text-right">إجمالي القطع</TableHead>
                <TableHead className="text-right">السعر</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {normalOrders.map((order, index) => (
                <TableRow key={`normal-${order.order_id}-${index}`}>
                  <TableCell className="font-medium">#{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{order.phone}</TableCell>
                  <TableCell>{order.quantity}</TableCell>
                  <TableCell className="text-blue-600 font-medium">{order.pieces}</TableCell>
                  <TableCell>{order.price.toFixed(2)} ج.م</TableCell>
                  <TableCell className="font-medium">{order.total.toFixed(2)} ج.م</TableCell>
                  <TableCell className={getStatusColor(order.status)}>
                    {getStatusText(order.status)}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString('ar-EG')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  const renderPieceOrdersTable = () => (
    <Card className="border-t-4 border-t-blue-500 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2 bg-blue-50/50">
        <div className="flex items-center gap-2">
          <Scissors className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg font-bold text-blue-900">طلبات البيع بالقطعة ({pieceOrders.length})</CardTitle>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
            {pieceQuantitySold} قطعة
          </Badge>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            {pieceSalesTotal.toFixed(2)} ج.م
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {pieceOrders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            لا توجد طلبات بيع بالقطعة تحتوي على هذا الكود
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-blue-50/30">
                <TableHead className="text-right">رقم الطلب</TableHead>
                <TableHead className="text-right">العميل</TableHead>
                <TableHead className="text-right">الهاتف</TableHead>
                <TableHead className="text-right">عدد القطع</TableHead>
                <TableHead className="text-right">سعر القطعة</TableHead>
                <TableHead className="text-right">الإجمالي</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">التاريخ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pieceOrders.map((order, index) => (
                <TableRow key={`piece-${order.order_id}-${index}`} className="hover:bg-blue-50/20">
                  <TableCell className="font-medium">#{order.order_number}</TableCell>
                  <TableCell>{order.customer_name}</TableCell>
                  <TableCell dir="ltr" className="text-right">{order.phone}</TableCell>
                  <TableCell className="text-blue-700 font-bold">{order.pieces} قطعة</TableCell>
                  <TableCell>{order.price.toFixed(2)} ج.م</TableCell>
                  <TableCell className="font-medium text-green-700">{order.total.toFixed(2)} ج.م</TableCell>
                  <TableCell className={getStatusColor(order.status)}>
                    {getStatusText(order.status)}
                  </TableCell>
                  <TableCell>
                    {new Date(order.created_at).toLocaleDateString('ar-EG')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );

  if (!activeVersion) {
    return <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">البحث بالكود</h1>

      {/* Search Box */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input
              placeholder="أدخل كود المنتج..."
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
            />
            <Button onClick={handleSearch} disabled={loading}>
              <Search className="h-4 w-4 ml-2" />
              {loading ? 'جاري البحث...' : 'بحث'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {searched && (
        <>
          {/* Summary Cards */}
          {orders.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">اسم المنتج</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{productName}</p>
                  {productDescription && (
                    <p className="text-sm text-muted-foreground mt-1">{productDescription}</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">المخزون المتاح</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-orange-600">{stockQuantity}</p>
                  <p className="text-sm text-muted-foreground">قطعة بالخزينة</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">الطلبات العادية</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-primary">{normalPiecesSold} قطعة</p>
                  <p className="text-sm text-muted-foreground">
                    {normalQuantitySold} طلب/علبة ({normalSalesTotal.toFixed(2)} ج.م)
                  </p>
                </CardContent>
              </Card>

              <Card className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-800">البيع بالقطعة</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-blue-600">{pieceQuantitySold} قطعة</p>
                  <p className="text-sm text-muted-foreground">
                    {pieceOrders.length} طلبات ({pieceSalesTotal.toFixed(2)} ج.م)
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-muted-foreground">إجمالي القطع والمبيعات</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">{grandTotalPieces} قطعة</p>
                  <p className="text-sm text-muted-foreground">{grandTotalSales.toFixed(2)} ج.م</p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Results Tables / Tabs */}
          <Tabs defaultValue="all" className="w-full space-y-4">
            <TabsList className="grid w-full grid-cols-3 max-w-md">
              <TabsTrigger value="all" className="gap-2">
                <PackageCheck className="h-4 w-4" />
                عرض الكل ({orders.length})
              </TabsTrigger>
              <TabsTrigger value="normal" className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                الطلبات العادية ({normalOrders.length})
              </TabsTrigger>
              <TabsTrigger value="piece" className="gap-2">
                <Scissors className="h-4 w-4" />
                البيع بالقطعة ({pieceOrders.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {renderNormalOrdersTable()}
              {renderPieceOrdersTable()}
            </TabsContent>

            <TabsContent value="normal">
              {renderNormalOrdersTable()}
            </TabsContent>

            <TabsContent value="piece">
              {renderPieceOrdersTable()}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default SearchByCode;

