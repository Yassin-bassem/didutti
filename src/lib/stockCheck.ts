import { supabase } from '@/integrations/supabase/client';
import { fetchAppSettings } from '@/hooks/useAppSettings';
import { CartItem, getDescriptionMultiplier } from '@/contexts/CartContext';

export interface StockCheckResult {
  allowed: boolean;
  reason?: string;
  currentStock?: number;
}

/**
 * Validates whether the user is allowed to add `addQuantity` units of `productId`
 * to a cart that already contains `cartItems`, based on the configured sales mode.
 * Returns { allowed: false, reason } when the action must be blocked.
 */
export const checkStockForAdd = async (
  productId: string,
  productDescription: string,
  addQuantity: number,
  cartItems: CartItem[],
): Promise<StockCheckResult> => {
  const settings = await fetchAppSettings();
  if (settings.sales_mode === 'unlimited') {
    return { allowed: true };
  }

  const { data: product } = await supabase
    .from('products')
    .select('stock_quantity, name')
    .eq('id', productId)
    .maybeSingle();

  if (!product) return { allowed: true };

  const multiplier = getDescriptionMultiplier(productDescription);
  const inCart = cartItems
    .filter((it) => it.productId === productId)
    .reduce((sum, it) => sum + it.quantity * getDescriptionMultiplier(it.description), 0);

  const piecesAfterAdd = inCart + addQuantity * multiplier;
  // Stock value after the order would be confirmed
  const projectedStock = product.stock_quantity - piecesAfterAdd;

  if (settings.sales_mode === 'stop_at_zero') {
    if (product.stock_quantity <= 0 || projectedStock < 0) {
      return {
        allowed: false,
        reason: `المنتج "${product.name}" نفد من المخزون ولا يمكن بيعه`,
        currentStock: product.stock_quantity,
      };
    }
  } else if (settings.sales_mode === 'allow_negative') {
    const limit = parseInt(settings.sales_negative_limit, 10) || 0;
    if (projectedStock < -limit) {
      return {
        allowed: false,
        reason: `لا يمكن البيع: الحد المسموح هو -${limit} قطعة من "${product.name}"`,
        currentStock: product.stock_quantity,
      };
    }
  }

  return { allowed: true, currentStock: product.stock_quantity };
};