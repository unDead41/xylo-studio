const {test}=require('node:test');const assert=require('node:assert/strict');const {studio}=require('./helpers/studio.cjs');
const key='e-instru-percussion-v1:tamborin';
async function recorded(){const s=studio({percussion:true});await s.ids.get('chooseTamborin').fire('click');await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown',{pointerId:1});s.advance(750);await s.ids.get('percShake').fire('pointerdown',{pointerId:2});await s.ids.get('percStop').fire('click');return s;}
test('Reset restores capture tempo even after valid edits at the duration boundary',async()=>{
 const s=await recorded();s.ids.get('percTempo').value='200';await s.ids.get('percTempo').fire('input');const raw=JSON.stringify(JSON.parse(s.saved.get(key)).raw_capture);const field=s.ids.get('percRows').children[1].querySelector('input');field.value='180000';await field.fire('change');await s.ids.get('percReset').fire('click');const take=JSON.parse(s.saved.get(key));assert.equal(take.bpm,80);assert.equal(take.events[1].at_ms,180000);assert.equal(JSON.stringify(take.raw_capture),raw);
});
test('trace auditions release completed sounds without needing Stop',async()=>{
 const s=await recorded();await s.ids.get('percTrace').children[0].fire('click');s.advance(1000);assert.equal(s.ids.get('percStop').disabled,true);await s.ids.get('percTrace').children[1].fire('click');s.advance(1000);assert.equal(s.ids.get('percStop').disabled,true);
});
