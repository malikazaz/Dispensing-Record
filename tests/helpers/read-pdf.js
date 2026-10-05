import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

export async function readPdf(buffer) {
  const task = getDocument({data:Uint8Array.from(buffer),useSystemFonts:false});
  try {
    const pdf = await task.promise, pages = [];
    for (let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push({text:content.items.map(item=>item.str).join(' '),items:content.items,view:page.view});
    }
    return pages;
  } finally { await task.destroy(); }
}
