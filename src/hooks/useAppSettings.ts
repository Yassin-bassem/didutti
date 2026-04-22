import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AppSettings {
  admin_password: string;
  instapay_link: string;
  instapay_label: string;
  vodafone_number: string;
}

const DEFAULTS: AppSettings = {
  admin_password: '2580',
  instapay_link: 'https://ipn.eg/S/diagc/instapay/92UO1b',
  instapay_label: 'diagc@instapay',
  vodafone_number: '01098795115',
};

export const fetchAppSettings = async (): Promise<AppSettings> => {
  const { data } = await supabase.from('app_settings').select('key, value');
  const out: AppSettings = { ...DEFAULTS };
  (data || []).forEach((row: { key: string; value: string }) => {
    if (row.key in out) {
      (out as any)[row.key] = row.value;
    }
  });
  return out;
};

export const updateAppSetting = async (key: keyof AppSettings, value: string) => {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error;
};

export const useAppSettings = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const reload = async () => {
    setLoading(true);
    const s = await fetchAppSettings();
    setSettings(s);
    setLoading(false);
  };

  useEffect(() => {
    reload();
  }, []);

  return { settings, loading, reload };
};