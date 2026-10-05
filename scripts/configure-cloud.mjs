import { writeFile } from 'node:fs/promises';
import { validateCloudConfig } from '../src/cloud-config.js';

const destination = process.argv[2] || 'dist';
if (!['dist', 'public'].includes(destination)) throw new Error('Choose dist or public as the configuration destination.');
const config = {
  url: (process.env.SUPABASE_URL || '').trim().replace(/\/$/, ''),
  publishableKey: (process.env.SUPABASE_PUBLISHABLE_KEY || '').trim(),
  passwordResetEnabled: process.env.SUPABASE_PASSWORD_RESET_ENABLED === 'true',
};
validateCloudConfig(config); // Refuse privileged keys before writing any file.
await writeFile(new URL(`../${destination}/cloud-config.json`, import.meta.url), JSON.stringify(config) + '\n');
console.log(config.url ? 'Public online-save settings configured.' : 'Online saving is not configured; local saving remains available.');
