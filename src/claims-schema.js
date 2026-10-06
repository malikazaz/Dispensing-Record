const canonical = value => JSON.stringify(value,function(_,v){return v && typeof v==='object' && !Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v;});
const same = (a,b) => canonical(a)===canonical(b);
export function validateClaims(state, validateEntry) {
  if (state.key.claims===undefined) return;
  const claims=state.key.claims, ids=new Set(), reserved=new Set();
  if (!Array.isArray(claims) || claims.length>10000) throw new Error('Invalid claim history.');
  const entries=new Map(state.entries.map(entry=>[entry.id,entry]));
  for (const claim of claims) {
    if (!claim || typeof claim.id!=='string' || !/^[\w-]{1,80}$/.test(claim.id) || ids.has(claim.id) || typeof claim.name!=='string' || !claim.name.trim() || claim.name.length>80 || !['draft','submitted','cancelled','void'].includes(claim.status) || !['EUR','GBP'].includes(claim.currency) || !Array.isArray(claim.rows) || !claim.rows.length || claim.rows.length>10000) throw new Error('Invalid claim.');
    ids.add(claim.id);
    if (!Array.isArray(claim.history) || !claim.history.length || claim.history.length>3 || claim.history.some(event=>!event || !['created','submitted','cancelled','void'].includes(event.action) || typeof event.at!=='string' || !/^\d{4}-\d\d-\d\dT/.test(event.at) || !Number.isFinite(Date.parse(event.at)))) throw new Error('Invalid claim history dates.');
    const actions=claim.history.map(event=>event.action).join(',');
    if (actions!==({draft:'created',submitted:'created,submitted',cancelled:'created,cancelled',void:'created,submitted,void'})[claim.status]) throw new Error('Invalid claim status history.');
    let total=0;const rowIds=new Set();
    for (const row of claim.rows) {
      validateEntry(row.entry);
      if (typeof row.entry.id!=='string' || !/^[\w-]{1,80}$/.test(row.entry.id) || rowIds.has(row.entry.id) || !Number.isSafeInteger(row.cents) || row.cents<0 || row.cents>1000000000 || typeof row.details!=='string' || row.details.length>20000) throw new Error('Invalid saved claim record.');
      rowIds.add(row.entry.id);total+=row.cents;
      if (['draft','submitted'].includes(claim.status)) {
        if (reserved.has(row.entry.id)) throw new Error('A record cannot belong to two active claims.');
        reserved.add(row.entry.id);
        if (!same(entries.get(row.entry.id),row.entry)) throw new Error('A claimed record changed or was removed. Refresh all open app tabs before syncing; release its claim before editing.');
      }
    }
    if (claim.total!==total || !Number.isSafeInteger(total)) throw new Error('Invalid claim total.');
  }
}
