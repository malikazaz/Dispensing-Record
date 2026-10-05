import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultKey, blankEntry, calculate, parseRate, summarise, validateEntry, validateState, initialState, GROUPS } from '../src/model.js';
const key=defaultKey();
const entry=(data={})=>({...blankEntry(),id:'test-record',date:'2026-10-05',number:'001234',name:'Test customer',types:['SV'],...data});

test('Polaroid plus Elite earns 5 euros for a first set',()=>assert.equal(calculate(entry({addons:['Polaroid','Elite']}),key).cents,500));
test('all supplied first and second set add-on rates',()=>{
  const first=[150,300,400,500,300,400,500,200,500,100,200,250,200];
  const second=[200,350,400,500,300,400,500,200,500,100,200,250,200];
  GROUPS.addons.forEach((addon,i)=>{
    assert.equal(calculate(entry({addons:[addon]}),key).cents,first[i],addon);
    assert.equal(calculate(entry({addons:[addon],set:'second'}),key).cents,second[i],`${addon} 2nd`);
  });
});
test('paper frame columns add 1.50, 3 and 3 euros',()=>{
  for(const [type,cents]of [['160',150],['190',300],['240',300]])assert.equal(calculate(entry({types:['SV',type],addons:['Elite']}),key).cents,cents+200);
});
test('unpriced table columns are zero-bonus markers',()=>{
  for(const type of ['SV','BIF','Vari','241','Other','RE','70','95','130'])assert.equal(calculate(entry({types:[type]}),key).cents,0);
});

test('241 awards only the highest-priced frame while retaining add-on bonuses',()=>{
  for (const set of ['first','second']) {
    const result=calculate(entry({set,types:['241','160','190']}),key);
    assert.equal(result.cents,300);
    assert.equal(result.parts.some(part=>part.label==='160'),false);
    assert.equal(calculate(entry({set,types:['241','240','190','160'],addons:['Tint']}),key).cents,400);
  }
  assert.equal(calculate(entry({types:['160','190']}),key).cents,450);
  assert.equal(calculate(entry({types:['241','160']}),key).cents,150);
});

test('241 selects by frame price, including with custom or missing bonus rates',()=>{
  const custom=defaultKey();
  custom.rates['types:160'].first=900;
  assert.equal(calculate(entry({types:['241','160','190']}),custom).cents,300);
  custom.rates['types:160'].first=null;
  assert.equal(calculate(entry({types:['241','160','190']}),custom).cents,300);
  custom.rates['types:190'].first=null;
  assert.equal(calculate(entry({types:['241','160','190']}),custom).cents,null);
});
test('Golden Ticket ADDS 1 euro per add-on, including combined add-ons once',()=>{
  assert.equal(calculate(entry({addons:['Polaroid','Elite'],offers:['Golden Ticket']}),key).cents,700);
  assert.equal(calculate(entry({addons:['Polaroid 1.6'],offers:['Golden Ticket']}),key).cents,500);
});
test('basic second pair SV uses the supplied 3 euro rate',()=>assert.equal(calculate(entry({set:'second',offers:['2nd pair SV']}),key).cents,300));
test('any add-ons under second-pair SV automatically produce exactly 5 euros',()=>{
  for(const addons of [['Tint'],['Polaroid','Reaction','Tint'],GROUPS.addons.filter(addon=>!['Elite','Tailormade','Supereader'].includes(addon))]){
    assert.equal(calculate(entry({set:'second',addons,offers:['2nd pair SV']}),key).cents,500);
  }
});
test('explicit flat offer replaces base, frames and add-ons, not 3+5',()=>{
  const result=calculate(entry({set:'second',types:['SV','190'],addons:['Polaroid','Reaction','Tint'],offers:['2nd pair SV','2nd-pair add-ons']}),key);
  assert.equal(result.cents,500);assert.deepEqual(result.parts,[{label:'2nd-pair add-ons',cents:500}]);
});
test('second-pair flat offer does not apply to varifocal add-ons',()=>assert.equal(calculate(entry({set:'second',types:['Vari'],addons:['Elite'],offers:['2nd-pair add-ons']}),key).cents,null));
test('3rd pair adds 2 euros to the selected bonus and requires 241',()=>{
  assert.equal(calculate(entry({types:['241'],addons:['Tint'],offers:['3rd pair half-price combined with 2-4-1']}),key).cents,300);
  assert.equal(calculate(entry({offers:['3rd pair half-price combined with 2-4-1']}),key).cents,null);
});
test('invalid offer prerequisites stay pending',()=>{
  for(const data of [
    {offers:['2nd pair SV']},
    {set:'second',types:['Vari'],offers:['2nd pair SV']},
    {set:'second',offers:['2nd-pair add-ons']},
    {offers:['Golden Ticket']},
    {set:'second',types:['SV','241'],offers:['2nd pair SV','3rd pair half-price combined with 2-4-1']},
  ])assert.equal(calculate(entry(data),key).cents,null);
});
test('unconfirmed and missing rates are not zero and are excluded from total',()=>{
  const custom=defaultKey();custom.rates['addons:Tint'].first=null;
  const rows=[entry({addons:['Tint']}),entry({id:'other',addons:['Elite']})];
  assert.deepEqual(summarise(rows,custom),{cents:200,pending:1});
  custom.confirmed=false;assert.deepEqual(summarise(rows,custom),{cents:0,pending:2});
});
test('overridden add-on amounts do not block a flat bonus when unknown',()=>{
  const custom=defaultKey();custom.rates['addons:Tint'].second=null;
  assert.equal(calculate(entry({set:'second',addons:['Tint'],offers:['2nd pair SV']}),custom).cents,500);
});
test('rate edits recalculate and integer cents avoid rounding drift',()=>{
  const custom=defaultKey();custom.rates['addons:Elite'].first=10;
  assert.equal(summarise(Array.from({length:10},()=>entry({addons:['Elite']})),custom).cents,100);
  assert.equal(parseRate('3.50'),350);assert.equal(parseRate(''),null);assert.equal(parseRate('0'),0);
  for(const invalid of ['-1','NaN','3.555','1e3','10001'])assert.throws(()=>parseRate(invalid));
});
test('validation preserves leading-zero IDs and rejects invalid dates or selections',()=>{
  assert.doesNotThrow(()=>validateEntry(entry()));
  for(const data of [{date:'2026-02-30'},{date:'not-date'},{name:' '},{number:''},{types:[]},{types:['INVALID']},{addons:['Tint','Tint']},{set:'third'}])assert.throws(()=>validateEntry(entry(data)));
});
test('backup schema rejects duplicates, invalid money, altered rules and unsupported versions',()=>{
  const state=initialState();state.entries=[entry()];assert.doesNotThrow(()=>validateState(state));
  assert.throws(()=>validateState({...state,version:2}));assert.throws(()=>validateState({...state,entries:[entry(),entry()]}));
  const copy=structuredClone(state);copy.key.rates['addons:Elite'].first=-100;assert.throws(()=>validateState(copy));
  copy.key.rates['addons:Elite'].first=200;copy.key.rates['addons:Elite'].mode='code';assert.throws(()=>validateState(copy));
});
