import { createClient } from '@supabase/supabase-js';
import { validateCloudConfig } from './cloud-config.js';

export async function loadCloudConfig() {
  // A separate public config lets CI test local mode without real credentials.
  // Only a publishable/anon key belongs here; database RLS enforces access.
  const response = await fetch(new URL('cloud-config.json', document.baseURI), { cache: 'no-store' });
  if (!response.ok) throw new Error('Online settings could not be loaded. Reload to retry.');
  const config = await response.json();
  return validateCloudConfig(config);
}

export function createCloudClient(config) {
  return createClient(config.url, config.publishableKey, {
    auth: { storageKey: 'dispensing-record:auth:v1', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: (url, options = {}) => fetch(url, {
      ...options,
      signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000),
    }) },
  });
}

export function cloudAdapter(client) {
  return {
    async load(owner) {
      // A missing allow-list entry must not look like an empty account.
      const permission = await client.from('dispensing_members').select('user_id').eq('user_id', owner).maybeSingle();
      if (permission.error) throw new Error('Online saving is unavailable. Check the connection or ask the account owner to resume/check the database.');
      if (!permission.data) throw new Error('This account has not been given access to the dispensing app.');
      const { data, error } = await client.from('dispensing_documents').select('payload,version').eq('user_id', owner).maybeSingle();
      if (error) throw new Error('Could not load the online records. Your device copy has been kept.');
      return data;
    },
    async write(owner, payload, version) {
      const table = client.from('dispensing_documents');
      const request = version === 0
        ? table.insert({ user_id: owner, payload, version: 1 })
        : table.update({ payload, version: version + 1 }).eq('user_id', owner).eq('version', version);
      const { data, error } = await request.select('payload,version').maybeSingle();
      if (error?.code === '23505') return null;
      if (error) throw new Error('Not saved online yet. Your changes are saved on this device; try Sync now when the connection returns.');
      return data;
    },
  };
}
