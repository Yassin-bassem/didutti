const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

function esc(text: any): string {
  if (text === null || text === undefined) return '';
  return String(text).replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function buildOrderMessage(p: any): string {
  const { orderNumber, customerName, shopName, phone, address, items, subtotal, total, depositAmount, depositMethod, extraInfo, lowStockProducts, staffName } = p;
  let m = `🧸 *طلب جديد \\#${orderNumber}*\n\n`;
  if (staffName) m += `👷 *بواسطة موظف:* ${esc(staffName)}\n`;
  m += `👤 *العميل:* ${esc(customerName)}\n`;
  if (shopName) m += `🏪 *المحل:* ${esc(shopName)}\n`;
  m += `📞 *الهاتف:* ${esc(phone)}\n`;
  if (address) m += `📍 *العنوان:* ${esc(address)}\n`;
  if (extraInfo) m += `📝 *ملاحظات:* ${esc(extraInfo)}\n`;
  m += `\n━━━━━━━━━━━━━━━━\n📦 *المنتجات:*\n\n`;
  if (Array.isArray(items)) {
    items.forEach((item: any, i: number) => {
      m += `${i + 1}\\. ${esc(item.name)}\n`;
      m += `   الكود: ${esc(item.code)}\n`;
      m += `   الكمية: ${item.quantity}\n`;
      m += `   السعر: ${item.price} ج\\.م\n\n`;
    });
  }
  m += `━━━━━━━━━━━━━━━━\n💰 *الإجمالي:* ${subtotal} ج\\.م\n`;
  if (depositAmount > 0) {
    const ml = depositMethod === 'instapay' ? 'InstaPay' : depositMethod === 'vodafone_cash' ? 'فودافون كاش' : 'كاش';
    m += `💵 *العربون \\(${esc(ml)}\\):* ${depositAmount} ج\\.م\n`;
  }
  m += `✅ *المطلوب:* ${total} ج\\.م`;
  if (Array.isArray(lowStockProducts) && lowStockProducts.length > 0) {
    m += `\n\n🚨🚨 *تنبيه نقص المخزون* 🚨🚨\n\n`;
    lowStockProducts.forEach((pr: any) => {
      const e = pr.remaining <= 0 ? '🔴' : '🟡';
      const t = pr.remaining <= 0 ? 'نفذ من المخزون' : `متبقي ${pr.remaining} قطعة فقط`;
      m += `${e} ${esc(pr.code)} \\- ${esc(pr.name)}: *${esc(t)}*\n`;
    });
  }
  return m;
}

function buildProductAddedMessage(p: any): string {
  let m = `🆕 *تم إضافة منتج جديد*\n\n`;
  m += `🔖 *الكود:* ${esc(p.code)}\n`;
  m += `📛 *الاسم:* ${esc(p.name)}\n`;
  if (p.description) m += `📝 *الوصف:* ${esc(p.description)}\n`;
  m += `💰 *السعر:* ${esc(p.price)} ج\\.م\n`;
  m += `📦 *المخزون:* ${esc(p.stock_quantity)}\n`;
  if (p.low_stock_threshold !== undefined) m += `⚠️ *حد التنبيه:* ${esc(p.low_stock_threshold)}\n`;
  if (p.versionName) m += `🗂️ *الإصدار:* ${esc(p.versionName)}\n`;
  return m;
}

function buildProductDeletedMessage(p: any): string {
  let m = `🗑️ *تم حذف منتج*\n\n`;
  m += `🔖 *الكود:* ${esc(p.code)}\n`;
  m += `📛 *الاسم:* ${esc(p.name)}\n`;
  if (p.price !== undefined) m += `💰 *السعر:* ${esc(p.price)} ج\\.م\n`;
  if (p.stock_quantity !== undefined) m += `📦 *المخزون وقت الحذف:* ${esc(p.stock_quantity)}\n`;
  if (p.versionName) m += `🗂️ *الإصدار:* ${esc(p.versionName)}\n`;
  return m;
}

function buildProductUpdatedMessage(p: any): string {
  let m = `✏️ *تم تعديل منتج*\n\n`;
  m += `🔖 *الكود:* ${esc(p.code)}\n`;
  m += `📛 *الاسم:* ${esc(p.name)}\n\n`;
  m += `*التغييرات:*\n`;
  if (Array.isArray(p.changes) && p.changes.length > 0) {
    p.changes.forEach((c: any) => {
      m += `• ${esc(c.field)}: ${esc(c.from)} ← ${esc(c.to)}\n`;
    });
  } else {
    m += `_لا تغييرات_\n`;
  }
  return m;
}

function buildOrderEditedMessage(p: any): string {
  let m = `✏️ *تم تعديل الطلب \\#${esc(p.orderNumber)}*\n\n`;
  m += `👤 *العميل:* ${esc(p.customerName)}\n\n`;
  m += `*التغييرات:*\n`;
  if (Array.isArray(p.changes) && p.changes.length > 0) {
    p.changes.forEach((c: any) => {
      m += `• ${esc(c.field)}: ${esc(c.from)} ← ${esc(c.to)}\n`;
    });
  } else {
    m += `_لا تغييرات_\n`;
  }
  return m;
}

function buildDailySummaryMessage(p: any): string {
  let m = `📊 *الملخص اليومي* \\- ${esc(p.date)}\n\n`;
  m += `🧾 *عدد الطلبات:* ${esc(p.ordersCount)}\n`;
  m += `💰 *إجمالي المبيعات:* ${esc(p.totalSales)} ج\\.م\n`;
  m += `✅ *إجمالي المحصّل:* ${esc(p.totalCollected)} ج\\.م\n`;
  if (p.deposits) {
    m += `\n*الإيداعات:*\n`;
    m += `💵 كاش: ${esc(p.deposits.cash || 0)} ج\\.م\n`;
    m += `📱 InstaPay: ${esc(p.deposits.instapay || 0)} ج\\.م\n`;
    m += `📲 فودافون كاش: ${esc(p.deposits.vodafone_cash || 0)} ج\\.م\n`;
  }
  if (p.expenses !== undefined) m += `\n💸 *المصروفات:* ${esc(p.expenses)} ج\\.م\n`;
  if (p.versionName) m += `\n🗂️ *الإصدار:* ${esc(p.versionName)}\n`;
  return m;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
    const TELEGRAM_CHAT_ID = Deno.env.get('TELEGRAM_CHAT_ID');
    if (!TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
    if (!TELEGRAM_CHAT_ID) throw new Error('TELEGRAM_CHAT_ID is not configured');

    const payload = await req.json();
    const type = payload.type || 'order';

    let message = '';
    switch (type) {
      case 'product_added': message = buildProductAddedMessage(payload); break;
      case 'product_deleted': message = buildProductDeletedMessage(payload); break;
      case 'product_updated': message = buildProductUpdatedMessage(payload); break;
      case 'order_edited': message = buildOrderEditedMessage(payload); break;
      case 'daily_summary': message = buildDailySummaryMessage(payload); break;
      case 'order':
      default:
        message = buildOrderMessage(payload);
    }

    // Support multiple chat IDs (comma/space/newline separated) + optional TELEGRAM_CHAT_ID_2
    const extra = Deno.env.get('TELEGRAM_CHAT_ID_2') || '';
    const chatIds = `${TELEGRAM_CHAT_ID},${extra}`
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const results = await Promise.all(chatIds.map(async (chatId) => {
      const r = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'MarkdownV2' }),
      });
      const body = await r.json();
      if (!r.ok) console.error(`Telegram error for ${chatId}:`, body);
      return { chatId, ok: r.ok, body };
    }));

    const anyFailed = results.some((x) => !x.ok);
    if (anyFailed && results.every((x) => !x.ok)) {
      throw new Error(`Telegram API error: ${JSON.stringify(results)}`);
    }

    return new Response(JSON.stringify({ success: true, sentTo: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
