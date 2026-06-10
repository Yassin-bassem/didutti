import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

const VERSION_SCOPED_TABLES = [
  'products',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'stock_alerts',
] as const;

const GLOBAL_TABLES = ['staff_members', 'app_settings'] as const;

export interface BackupManifest {
  generated_at: string;
  app: string;
  schema_version: number;
  versions: { id: string; name: string }[];
  version_scoped_tables: string[];
  global_tables: string[];
}

async function fetchAll(table: string, filter?: { col: string; val: string }) {
  let q = supabase.from(table as any).select('*');
  if (filter) q = q.eq(filter.col, filter.val);
  const { data, error } = await q;
  if (error) throw new Error(`Failed reading ${table}: ${error.message}`);
  return data || [];
}

function sanitize(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

export async function buildBackupZip(): Promise<Blob> {
  const zip = new JSZip();

  const { data: versions, error: vErr } = await supabase
    .from('versions')
    .select('*')
    .order('created_at', { ascending: true });
  if (vErr) throw new Error('Failed reading versions: ' + vErr.message);

  zip.file('versions.json', JSON.stringify(versions || [], null, 2));

  for (const t of GLOBAL_TABLES) {
    const rows = await fetchAll(t);
    zip.file(`global/${t}.json`, JSON.stringify(rows, null, 2));
  }

  const versionsFolder = zip.folder('versions')!;
  for (const v of versions || []) {
    const folderName = `${sanitize(v.name)}__${v.id}`;
    const folder = versionsFolder.folder(folderName)!;
    folder.file('version.json', JSON.stringify(v, null, 2));
    for (const t of VERSION_SCOPED_TABLES) {
      const rows = await fetchAll(t, { col: 'version_id', val: v.id });
      folder.file(`${t}.json`, JSON.stringify(rows, null, 2));
    }
  }

  const manifest: BackupManifest = {
    generated_at: new Date().toISOString(),
    app: 'didutti-kids',
    schema_version: 1,
    versions: (versions || []).map((v: any) => ({ id: v.id, name: v.name })),
    version_scoped_tables: [...VERSION_SCOPED_TABLES],
    global_tables: [...GLOBAL_TABLES],
  };
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));
  zip.file(
    'README.txt',
    `Didutti Kids backup
Generated: ${manifest.generated_at}

Structure:
  manifest.json          - backup metadata
  versions.json          - list of all versions
  global/                - tables not scoped to a version (app_settings, staff_members)
  versions/<name>__<id>/ - one folder per version, containing:
      version.json
      products.json
      customers.json
      orders.json
      order_items.json
      deposits.json
      expenses.json
      stock_alerts.json

To restore: open Admin > Backup & Restore, upload either the full ZIP
or any single JSON file from inside it. Rows are upserted by id so
existing rows with the same id are overwritten.
`,
  );

  return zip.generateAsync({ type: 'blob' });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function backupFilename() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `didutti-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.zip`;
}

// Restore --------------------------------------------------------------

// Order is important due to foreign keys.
const RESTORE_ORDER = [
  'versions',
  'staff_members',
  'app_settings',
  'products',
  'customers',
  'orders',
  'order_items',
  'deposits',
  'expenses',
  'stock_alerts',
] as const;

type TableName = (typeof RESTORE_ORDER)[number];

export interface RestoreResult {
  table: string;
  count: number;
  error?: string;
}

async function upsertRows(table: TableName, rows: any[]): Promise<RestoreResult> {
  if (!rows.length) return { table, count: 0 };
  // chunk to avoid payload limits
  const chunk = 500;
  let total = 0;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const onConflict =
      table === 'app_settings' ? 'key' : 'id';
    const { error } = await supabase
      .from(table as any)
      .upsert(slice, { onConflict });
    if (error) return { table, count: total, error: error.message };
    total += slice.length;
  }
  return { table, count: total };
}

/** Restore from a full backup ZIP. */
export async function restoreFromZip(file: File): Promise<RestoreResult[]> {
  const zip = await JSZip.loadAsync(file);
  const buckets: Record<string, any[]> = {};
  for (const t of RESTORE_ORDER) buckets[t] = [];

  // versions.json
  const vFile = zip.file('versions.json');
  if (vFile) buckets.versions.push(...JSON.parse(await vFile.async('string')));

  // global tables
  for (const t of GLOBAL_TABLES) {
    const f = zip.file(`global/${t}.json`);
    if (f) buckets[t].push(...JSON.parse(await f.async('string')));
  }

  // per-version tables
  const versionFolders = new Set<string>();
  zip.folder('versions')?.forEach((relPath) => {
    const top = relPath.split('/')[0];
    if (top) versionFolders.add(top);
  });
  for (const folder of versionFolders) {
    for (const t of VERSION_SCOPED_TABLES) {
      const f = zip.file(`versions/${folder}/${t}.json`);
      if (f) buckets[t].push(...JSON.parse(await f.async('string')));
    }
    const vf = zip.file(`versions/${folder}/version.json`);
    if (vf) {
      const v = JSON.parse(await vf.async('string'));
      if (!buckets.versions.find((x: any) => x.id === v.id)) buckets.versions.push(v);
    }
  }

  const results: RestoreResult[] = [];
  for (const t of RESTORE_ORDER) {
    const r = await upsertRows(t, buckets[t]);
    results.push(r);
  }
  return results;
}

/** Restore from a single JSON file. Table inferred from filename. */
export async function restoreFromJson(file: File): Promise<RestoreResult[]> {
  const text = await file.text();
  const rows = JSON.parse(text);
  if (!Array.isArray(rows)) throw new Error('JSON file must contain an array of rows');
  const base = file.name.replace(/\.json$/i, '');
  const guess = (RESTORE_ORDER as readonly string[]).find((t) => base.endsWith(t));
  if (!guess) throw new Error(`Cannot infer table from filename "${file.name}"`);
  return [await upsertRows(guess as TableName, rows)];
}
