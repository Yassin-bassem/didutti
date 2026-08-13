import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import logoImage from '@/assets/didutti-logo.jpg';

export interface InvoiceItem {
  product_code: string;
  product_name: string;
  product_description?: string | null;
  price: number;
  quantity: number;
}

export interface InvoiceData {
  order_number: number | string;
  customer_name: string;
  shop_name?: string | null;
  phone: string;
  address?: string | null;
  extra_info?: string | null;
  staff_member_name?: string | null;
  created_at: string;
  order_type?: string | null;
  deposit_amount: number;
  deposit_method?: string | null;
  discount?: number | null;
  discount_type?: string | null;
  items: Array<InvoiceItem & { displayQuantity: number; itemTotal: number }>;
  subtotal: number;
  discountAmount: number;
  total: number;
}

let cachedLogo: string | null = null;
async function ensureLogo(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  const res = await fetch(logoImage);
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => { cachedLogo = reader.result as string; resolve(cachedLogo!); };
    reader.readAsDataURL(blob);
  });
}

async function ensureCairoFont(): Promise<void> {
  const id = 'cairo-font-invoice';
  if (document.getElementById(id)) {
    await (document as any).fonts?.ready;
    return;
  }
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
  document.head.appendChild(link);
  await new Promise((r) => setTimeout(r, 400));
  try { await (document as any).fonts?.load('700 20px Cairo'); } catch {}
  try { await (document as any).fonts?.ready; } catch {}
}

function buildInvoiceHTML(data: InvoiceData, logoDataUrl: string): string {
  const fmt = (n: number) => `${n.toFixed(2)} ج.م`;
  const dateStr = new Date(data.created_at).toLocaleDateString('ar-EG');
  const isGift = data.order_type === 'gift';
  const isPiece = data.order_type === 'piece';

  const itemsRows = data.items.map((it) => `
    <tr>
      <td style="border:1px solid #d1d5db;padding:8px;text-align:center;">${it.product_code}</td>
      <td style="border:1px solid #d1d5db;padding:8px;text-align:right;">${it.product_name}</td>
      <td style="border:1px solid #d1d5db;padding:8px;text-align:center;">${it.price} ج.م</td>
      <td style="border:1px solid #d1d5db;padding:8px;text-align:center;">${it.displayQuantity}</td>
      <td style="border:1px solid #d1d5db;padding:8px;text-align:center;">${fmt(it.itemTotal)}</td>
    </tr>
  `).join('');

  const totals = isGift
    ? `
      <div style="display:flex;justify-content:space-between;padding:6px 0;"><span>الإجمالي الفرعي:</span><span>${fmt(data.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:6px 0;color:#9d174d;"><span>خصم الهدية:</span><span>-${fmt(data.subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:20px;font-weight:700;color:#9d174d;border-top:2px solid #9d174d;margin-top:6px;"><span>المطلوب:</span><span>0.00 ج.م 🎁 (هدية)</span></div>
    `
    : `
      <div style="display:flex;justify-content:space-between;padding:6px 0;"><span>الإجمالي الفرعي:</span><span>${fmt(data.subtotal)}</span></div>
      ${data.discountAmount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;color:#b91c1c;"><span>الخصم${data.discount_type === 'percent' ? ` (${data.discount}%)` : ''}:</span><span>-${fmt(data.discountAmount)}</span></div>` : ''}
      ${data.deposit_amount > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;"><span>العربون (${data.deposit_method || ''}):</span><span>-${fmt(data.deposit_amount)}</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:20px;font-weight:700;color:#1e2a5e;border-top:2px solid #1e2a5e;margin-top:6px;"><span>المطلوب:</span><span>${fmt(data.total)}</span></div>
    `;

  return `
    <div dir="rtl" style="font-family:'Cairo',sans-serif;padding:32px;width:794px;background:#fff;color:#111827;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e2a5e;padding-bottom:16px;margin-bottom:20px;">
        <img src="${logoDataUrl}" style="height:70px;width:auto;" crossorigin="anonymous" />
        <div style="text-align:center;">
          <h1 style="margin:0;font-size:28px;font-weight:700;color:#1e2a5e;">DIDUTTI KID'S</h1>
          <p style="margin:6px 0 0;font-size:18px;font-weight:600;">فاتورة رقم ${data.order_number}</p>
          ${isGift ? `<p style="margin:6px 0 0;color:#9d174d;font-weight:700;">🎁 هذه الفاتورة هدية</p>` : ''}
          ${isPiece ? `<p style="margin:6px 0 0;color:#1e40af;font-weight:600;">بيع بالقطعة</p>` : ''}
        </div>
        <div style="width:70px;"></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:20px;font-size:14px;">
        <div><strong>العميل:</strong> ${data.customer_name}</div>
        ${data.shop_name ? `<div><strong>المحل:</strong> ${data.shop_name}</div>` : '<div></div>'}
        <div><strong>الهاتف:</strong> ${data.phone}</div>
        <div><strong>التاريخ:</strong> ${dateStr}</div>
        ${data.staff_member_name ? `<div><strong>الموظف:</strong> ${data.staff_member_name}</div>` : ''}
        ${data.address ? `<div style="grid-column:1/-1;"><strong>العنوان:</strong> ${data.address}</div>` : ''}
        ${data.extra_info ? `<div style="grid-column:1/-1;"><strong>ملاحظات:</strong> ${data.extra_info}</div>` : ''}
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
        <thead>
          <tr style="background:#1e2a5e;color:#fff;">
            <th style="border:1px solid #1e2a5e;padding:10px;">الكود</th>
            <th style="border:1px solid #1e2a5e;padding:10px;">المنتج</th>
            <th style="border:1px solid #1e2a5e;padding:10px;">السعر</th>
            <th style="border:1px solid #1e2a5e;padding:10px;">الكمية</th>
            <th style="border:1px solid #1e2a5e;padding:10px;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>

      <div style="margin-right:auto;width:60%;font-size:14px;">${totals}</div>

      <p style="text-align:center;margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;">شكراً لتعاملكم مع DIDUTTI KID'S</p>
    </div>
  `;
}

export async function downloadInvoicePDF(data: InvoiceData): Promise<void> {
  const logoDataUrl = await ensureLogo();
  await ensureCairoFont();

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;z-index:-1;';
  const inner = document.createElement('div');
  inner.innerHTML = buildInvoiceHTML(data, logoDataUrl);
  wrapper.appendChild(inner);
  document.body.appendChild(wrapper);

  // wait for logo image to load
  const img = inner.querySelector('img');
  if (img && !(img as HTMLImageElement).complete) {
    await new Promise((r) => { (img as HTMLImageElement).onload = r; (img as HTMLImageElement).onerror = r; });
  }
  await new Promise((r) => setTimeout(r, 150));

  try {
    const target = inner.firstElementChild as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = 0;
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    pdf.save(`invoice-${data.order_number}.pdf`);
  } finally {
    document.body.removeChild(wrapper);
  }
}
