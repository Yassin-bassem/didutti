import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
// @ts-ignore - no types
import { ArabicShaper } from 'arabic-persian-reshaper';
import amiriRegularUrl from '@/assets/fonts/Amiri-Regular.ttf?url';
import amiriBoldUrl from '@/assets/fonts/Amiri-Bold.ttf?url';
import logoImage from '@/assets/didutti-logo.jpg';

let cachedRegular: string | null = null;
let cachedBold: string | null = null;
let cachedLogo: string | null = null;

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function ensureFonts() {
  if (!cachedRegular) cachedRegular = await fetchAsBase64(amiriRegularUrl);
  if (!cachedBold) cachedBold = await fetchAsBase64(amiriBoldUrl);
}

async function ensureLogo(): Promise<string | null> {
  if (cachedLogo) return cachedLogo;
  try {
    const res = await fetch(logoImage);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        cachedLogo = reader.result as string;
        resolve(cachedLogo);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

// Shape Arabic text for jsPDF. Since jsPDF has no bidi engine, we:
// 1) Split the string into Arabic and non-Arabic (Latin/digits/punct) runs
// 2) Shape each Arabic run with the reshaper, then reverse it (visual RTL)
// 3) Reverse the sequence of runs so the whole line reads right-to-left
// 4) Digits inside numbers keep their LTR order
function ar(text: string | number | null | undefined): string {
  if (text === null || text === undefined) return '';
  const s = String(text);
  if (!/[\u0600-\u06FF]/.test(s)) return s;

  const reverseStr = (str: string) => str.split('').reverse().join('');
  // Tokenize: Arabic run | Latin/number run | whitespace | other
  const tokenRe = /([\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+)|([A-Za-z0-9]+(?:[.,][0-9]+)*)|(\s+)|([^\s])/g;
  const runs: { type: 'ar' | 'latin' | 'space' | 'other'; text: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(s)) !== null) {
    if (m[1]) {
      let shaped = m[1];
      try { shaped = ArabicShaper.convertArabic(m[1]); } catch {}
      runs.push({ type: 'ar', text: reverseStr(shaped) });
    } else if (m[2]) {
      runs.push({ type: 'latin', text: m[2] });
    } else if (m[3]) {
      runs.push({ type: 'space', text: m[3] });
    } else if (m[4]) {
      runs.push({ type: 'other', text: m[4] });
    }
  }
  return runs.reverse().map(r => r.text).join('');
}

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

export async function downloadInvoicePDF(data: InvoiceData): Promise<void> {
  await ensureFonts();
  const logoDataUrl = await ensureLogo();

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  // Register Amiri font
  doc.addFileToVFS('Amiri-Regular.ttf', cachedRegular!);
  doc.addFont('Amiri-Regular.ttf', 'Amiri', 'normal');
  doc.addFileToVFS('Amiri-Bold.ttf', cachedBold!);
  doc.addFont('Amiri-Bold.ttf', 'Amiri', 'bold');
  doc.setFont('Amiri', 'normal');


  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 12;

  // Header — logo top-right, brand text centered
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'JPEG', pageWidth - marginX - 30, 8, 30, 18, undefined, 'FAST');
    } catch {}
  }

  doc.setFont('Amiri', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 42, 94);
  doc.text("DIDUTTI KID'S", pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(ar(`فاتورة رقم ${data.order_number}`), pageWidth / 2, 27, { align: 'center' });

  if (data.order_type === 'gift') {
    doc.setFontSize(12);
    doc.setTextColor(157, 23, 77);
    doc.text(ar('🎁 هذه الفاتورة هدية'), pageWidth / 2, 35, { align: 'center' });
  } else if (data.order_type === 'piece') {
    doc.setFontSize(11);
    doc.setTextColor(30, 64, 175);
    doc.text(ar('بيع بالقطعة'), pageWidth / 2, 35, { align: 'center' });
  }

  // Customer info block — right-aligned
  let y = 46;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  const rightX = pageWidth - marginX;
  const infoLine = (label: string, value: string) => {
    doc.setFont('Amiri', 'bold');
    doc.text(ar(label), rightX, y, { align: 'right' });
    const labelWidth = doc.getTextWidth(ar(label));
    doc.setFont('Amiri', 'normal');
    doc.text(ar(value), rightX - labelWidth - 2, y, { align: 'right' });
    y += 6;
  };

  infoLine('العميل: ', data.customer_name);
  if (data.shop_name) infoLine('المحل: ', data.shop_name);
  infoLine('الهاتف: ', data.phone);
  if (data.address) infoLine('العنوان: ', data.address);
  infoLine('التاريخ: ', new Date(data.created_at).toLocaleDateString('ar-EG'));
  if (data.extra_info) infoLine('ملاحظات: ', data.extra_info);

  // Products table — columns right-to-left visually
  const head = [[
    ar('الكود'),
    ar('المنتج'),
    ar('السعر'),
    ar('الكمية'),
    ar('الإجمالي'),
  ]];

  const body = data.items.map((it) => [
    String(it.product_code),
    ar(it.product_name),
    ar(`${it.price} ج.م`),
    String(it.displayQuantity),
    ar(`${it.itemTotal.toFixed(2)} ج.م`),
  ]);

  autoTable(doc, {
    head,
    body,
    startY: y + 2,
    margin: { left: marginX, right: marginX },
    styles: {
      font: 'Amiri',
      fontStyle: 'normal',
      fontSize: 10,
      halign: 'right',
      cellPadding: 2.5,
      textColor: [0, 0, 0],
      lineColor: [200, 200, 200],
      lineWidth: 0.2,
    },
    headStyles: {
      font: 'Amiri',
      fontStyle: 'bold',
      fillColor: [30, 42, 94],
      textColor: [255, 255, 255],
      halign: 'right',
    },
    columnStyles: {
      0: { cellWidth: 22 },
      2: { cellWidth: 22 },
      3: { cellWidth: 18 },
      4: { cellWidth: 30 },
    },
  });

  // Totals — right-aligned under the table
  // @ts-ignore - lastAutoTable is added by plugin
  let ty = (doc as any).lastAutoTable.finalY + 8;
  doc.setFont('Amiri', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);

  const totalLine = (text: string, bold = false, color: [number, number, number] = [0, 0, 0], size = 11) => {
    doc.setFont('Amiri', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(ar(text), rightX, ty, { align: 'right' });
    ty += size * 0.55 + 2;
  };

  if (data.order_type === 'gift') {
    totalLine(`الإجمالي الفرعي: ${data.subtotal.toFixed(2)} ج.م`);
    totalLine(`خصم الهدية: -${data.subtotal.toFixed(2)} ج.م`, true, [157, 23, 77]);
    totalLine('المطلوب: 0.00 ج.م 🎁 (هدية)', true, [157, 23, 77], 14);
  } else {
    totalLine(`الإجمالي الفرعي: ${data.subtotal.toFixed(2)} ج.م`);
    if (data.discountAmount > 0) {
      const label = data.discount_type === 'percent'
        ? `الخصم (${data.discount}%): -${data.discountAmount.toFixed(2)} ج.م`
        : `الخصم: -${data.discountAmount.toFixed(2)} ج.م`;
      totalLine(label);
    }
    if (data.deposit_amount > 0) {
      totalLine(`العربون (${data.deposit_method || ''}): -${data.deposit_amount.toFixed(2)} ج.م`);
    }
    totalLine(`المطلوب: ${data.total.toFixed(2)} ج.م`, true, [30, 42, 94], 14);
  }

  doc.save(`invoice-${data.order_number}.pdf`);
}
