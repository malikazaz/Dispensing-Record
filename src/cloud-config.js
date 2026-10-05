export function validateCloudConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('Invalid online settings.');
  if (!config.url && !config.publishableKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url || '')) throw new Error('Invalid online project address.');
  const key = config.publishableKey || '';
  if (typeof key !== 'string') throw new Error('Invalid publishable key.');
  if (!key.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; } catch { /* rejected below */ }
    if (role !== 'anon') throw new Error('Use a Supabase publishable key, never an administrator key.');
  }
  return { url: config.url, publishableKey: key, passwordResetEnabled: config.passwordResetEnabled === true };
}
