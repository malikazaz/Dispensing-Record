import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { initialState } from '../src/model.js';

test('database policies isolate accounts, deny anonymous access and enforce revisions', async () => {
  const db = new PGlite();
  const one = '11111111-1111-4111-8111-111111111111';
  const two = '22222222-2222-4222-8222-222222222222';
  const outsider = '33333333-3333-4333-8333-333333333333';
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema public, auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;`);
    await db.exec(await readFile(new URL('../supabase/migrations/202610050001_private_records.sql', import.meta.url), 'utf8'));
    for (const id of [one, two, outsider]) await db.query('insert into auth.users values ($1)', [id]);
    for (const id of [one, two]) await db.query('insert into public.dispensing_members values ($1)', [id]);
    const asUser = async (id, fn) => {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);
      try { return await fn(); } finally { await db.exec('reset role'); }
    };
    await asUser(one, () => db.query('insert into public.dispensing_documents values ($1,1,$2)', [one, initialState()]));
    await asUser(two, async () => {
      assert.equal((await db.query('select * from public.dispensing_documents')).rows.length, 0);
      assert.equal((await db.query('select * from public.dispensing_members')).rows.length, 1);
      assert.equal((await db.query('update public.dispensing_documents set version=2 where user_id=$1 returning *', [one])).rows.length, 0);
      await assert.rejects(db.query('insert into public.dispensing_documents values ($1,1,$2)', [one, initialState()]));
      await assert.rejects(db.query('insert into public.dispensing_members values ($1)', [outsider]));
    });
    await asUser(outsider, async () => {
      assert.equal((await db.query('select * from public.dispensing_members')).rows.length, 0);
      await assert.rejects(db.query('insert into public.dispensing_documents values ($1,1,$2)', [outsider, initialState()]));
    });
    await asUser(one, async () => {
      assert.equal((await db.query('select * from public.dispensing_documents')).rows.length, 1);
      await assert.rejects(db.query('update public.dispensing_documents set version=9'));
      assert.equal((await db.query('update public.dispensing_documents set version=2 where version=1 returning *')).rows.length, 1);
      assert.equal((await db.query('update public.dispensing_documents set version=2 where version=1 returning *')).rows.length, 0);
      await assert.rejects(db.query('delete from public.dispensing_documents'));
    });
    await db.exec('set role anon');
    await assert.rejects(db.query('select * from public.dispensing_documents'));
    await assert.rejects(db.query('select * from public.dispensing_members'));
    await db.exec('reset role');
  } finally { await db.close(); }
});
