const {test}=require('node:test'),assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
for(const [own,foreign,button,count,tap]of [
 ['kompang','tamborin','chooseKompang','kompCount','kompTap'],
 ['tamborin','kompang','chooseTamborin','percCount','percTap']
])test(own+' rejects a foreign saved instrument without aborting navigation or overwriting its evidence',async()=>{
 const setup=studio({percussion:true}),take=setup.P.createTake(foreign);setup.P.capture(take,foreign==='tamborin'?'tap':'center',1000);
 const evidence=JSON.stringify(take),key='e-instru-percussion-v1:'+own;
 const s=studio({percussion:true,storage:{[key]:evidence}});
 await s.ids.get(button).fire('click');assert.equal(s.ids.get(count).textContent,'0');assert.equal(s.saved.get(key),evidence);
 await s.ids.get(tap).fire('pointerdown');await s.settle();assert.equal(s.ids.get(count).textContent,'0');assert.equal(s.saved.get(key),evidence);
 assert.match(s.ids.get(own==='kompang'?'kompSave':'percSave').textContent,/tidak dapat dibaca/);
});
