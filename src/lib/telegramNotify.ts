import { supabase } from '@/integrations/supabase/client';

export type TelegramPayload = Record<string, any> & { type: string };

export async function notifyTelegram(payload: TelegramPayload): Promise<void> {
  try {
    await supabase.functions.invoke('send-telegram-notification', { body: payload });
  } catch (e) {
    console.error('Telegram notification failed:', e);
  }
}

export function diffObjects(
  oldObj: Record<string, any>,
  newObj: Record<string, any>,
  labels: Record<string, string>
): { field: string; from: any; to: any }[] {
  const changes: { field: string; from: any; to: any }[] = [];
  for (const key of Object.keys(labels)) {
    const a = oldObj?.[key];
    const b = newObj?.[key];
    const same = (a ?? '') === (b ?? '') || (Number(a) === Number(b) && !isNaN(Number(a)));
    if (!same) {
      changes.push({
        field: labels[key],
        from: a === null || a === undefined || a === '' ? '—' : a,
        to: b === null || b === undefined || b === '' ? '—' : b,
      });
    }
  }
  return changes;
}
