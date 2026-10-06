export class ExportLoadError extends Error {
  constructor(cause) {
    super('Could not load the export tools.', { cause });
    this.name = 'ExportLoadError';
  }
}

const loaded = new Map();

async function loadFreshExporter(format) {
  const base = new URL(import.meta.env.BASE_URL, document.baseURI);
  const response = await fetch(new URL('export-manifest.json', base), { cache: 'no-store' });
  if (!response.ok) throw new Error('Export manifest unavailable.');
  const manifest = await response.json();
  // Never run a different deployment's entry module inside the open app.
  // Export bundles can import shared code from that entry, including its UI.
  const currentApp = document.querySelector('script[type="module"][src]')?.src;
  if (!manifest['index.html']?.file || new URL(manifest['index.html'].file, base).href !== currentApp) {
    throw new Error('The app has been updated. Refresh to load the matching export tools.');
  }
  const file = manifest[format === 'pdf' ? 'src/pdf.js' : 'src/workbook.js']?.file;
  if (typeof file !== 'string' || !/^assets\/[\w.-]+\.js$/.test(file)) throw new Error('Invalid export manifest.');
  const url = new URL(file, base);
  // Safari can cache a failed module request across page reloads. Give this
  // bounded retry a new URL; no browser data or app storage needs to be cleared.
  url.searchParams.set('retry', crypto.randomUUID());
  const module = await import(/* @vite-ignore */ url.href);
  const exporter = module[format === 'pdf' ? 'exportPdf' : 'exportWorkbook'];
  if (typeof exporter !== 'function') throw new Error('Export tools unavailable.');
  return exporter;
}

export async function loadExporter(format) {
  if (loaded.has(format)) return loaded.get(format);
  let exporter;
  try {
    exporter = format === 'pdf'
      ? (await import('./pdf.js')).exportPdf
      : (await import('./workbook.js')).exportWorkbook;
  } catch {
    try {
      exporter = await loadFreshExporter(format);
    } catch (error) {
      // Keep generation errors separate: refreshing cannot fix invalid data.
      throw new ExportLoadError(error);
    }
  }
  loaded.set(format, exporter);
  return exporter;
}
