const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {studio}=require('./helpers/studio.cjs');

test('digital exports expose exactly JSON and CSV in the real HTML',async()=>{
 const html=fs.readFileSync('index.html','utf8');
 const formats=[...html.matchAll(/data-format="([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(formats,['json','csv']);
 const s=studio({variant:null});
 await s.ids.get('exportBtn').fire('click');
 s.ids.get('exportPassword').value='demo41';
 await s.ids.get('exportPasswordForm').fire('submit');
 assert.equal(s.ids.get('exportTabs').children.length,2);
 for(const button of s.ids.get('exportTabs').children){
  await button.fire('click');
  assert.equal(s.ids.get('downloadBtn').disabled,false);
  await s.ids.get('downloadBtn').fire('click');
 }
 assert.equal(s.downloads.length,2);
});

test('recordings and catalog expose a self-contained digital data contract',()=>{
 const s=studio();
 assert.equal(typeof s.C.cpp,'undefined');
 assert.equal(s.C.UNO_LIMIT,undefined);
 for(const variant of ['short','long'])for(const p of s.C.PRESETS){
  const take=s.C.preset(p.id,4,variant);
  assert.equal(Object.hasOwn(take,'source_firmware_commit'),false);
  assert.equal(Object.hasOwn(take,'hardware_verified'),false);
  assert.equal(s.C.validate(take).length,0);
  assert.equal(s.C.importTake(JSON.stringify(take)).events.length,take.events.length);
 }
});
