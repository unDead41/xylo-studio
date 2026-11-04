const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {studio}=require('./helpers/studio.cjs');

const instruments=[
 {id:'tamborin',prefix:'perc',choose:'chooseTamborin',primary:'percTap',secondary:'percShake'},
 {id:'kompang',prefix:'komp',choose:'chooseKompang',primary:'kompCenter',secondary:'kompEdge'},
 {id:'snare',prefix:'snare',choose:'chooseSnare',primary:'snarePrimary',secondary:'snareSecondary'},
 {id:'bass_drum',prefix:'bass',choose:'chooseBassDrum',primary:'bassPrimary',secondary:'bassSecondary'},
 {id:'cymbals',prefix:'cym',choose:'chooseCymbals',primary:'cymPrimary',secondary:'cymSecondary'},
 {id:'triangle',prefix:'tri',choose:'chooseTriangle',primary:'triPrimary',secondary:'triSecondary'}
];
const click=(s,id)=>s.ids.get(id).fire('click');
const hit=(s,id)=>s.ids.get(id).fire('pointerdown');
const take=(s,i)=>JSON.parse(s.saved.get('e-instru-percussion-v1:'+i.id));
async function open(i,options={}){
 const s=studio({percussion:true,chooser:true,variant:null,...options});
 await click(s,i.choose);
 return s;
}
async function recordTwo(s,i){
 await click(s,i.prefix+'Record');
 await hit(s,i.primary);
 s.advance(375);
 await hit(s,i.secondary);
 await click(s,i.prefix+'Stop');
}

for(const i of instruments){
 test(i.id+' clearly separates free play, armed capture, recording and replay',async()=>{
  const s=await open(i),el=suffix=>s.ids.get(i.prefix+suffix);
  assert.equal(el('SessionState').dataset.state,'idle');
  assert.match(el('TraceHint').textContent,/main bebas belum dirakam/i);
  await click(s,i.prefix+'Example');
  assert.equal(el('SessionState').dataset.state,'example');
  assert.match(el('TraceHint').textContent,/Contoh dua bar/);
  assert.equal(el('Count').textContent,'0');
  await click(s,i.prefix+'Stop');
  await click(s,i.prefix+'Record');
  assert.equal(el('SessionState').dataset.state,'armed');
  assert.equal(el('RecordBadge').textContent,'Bersedia');
  assert.equal(el('EmptyTitle').textContent,'Menunggu ketukan pertama');
  assert.match(el('EmptyHint').textContent,/0\.00s/);
  assert.equal(el('Tempo').disabled,true);
  s.advance(1000);
  await hit(s,i.primary);
  assert.equal(el('SessionState').dataset.state,'recording');
  assert.equal(el('RecordBadge').textContent,'Merakam');
  assert.equal(el('Empty').hidden,true);
  assert.equal(take(s,i).raw_capture[0].raw_ms,0);
  const instruction=el('Status').textContent;
  s.advance(500);
  assert.match(el('SessionState').textContent,/0\.5s/);
  assert.equal(el('Status').textContent,instruction,'The live status must not announce every timer tick');
  await hit(s,i.secondary);
  await click(s,i.prefix+'Stop');
  assert.equal(el('SessionState').dataset.state,'idle');
  assert.equal(el('RecordBadge').textContent,'Rakaman sendiri');
  const before=JSON.stringify(take(s,i));
  await click(s,i.prefix+'Replay');
  assert.equal(el('SessionState').dataset.state,'replay');
  assert.match(el('TraceHint').textContent,/Jejak rakaman anda/);
  s.advance(2500);
  assert.equal(el('SessionState').dataset.state,'idle');
  assert.equal(JSON.stringify(take(s,i)),before);
 });

 test(i.id+' starts a separate temporary practice trace and restores its unchanged take on replay',async()=>{
  const s=await open(i),el=suffix=>s.ids.get(i.prefix+suffix);
  await recordTwo(s,i);
  const before=JSON.stringify(take(s,i));
  assert.equal(el('Trace').children.length,2);
  s.advance(1000);
  await hit(s,i.secondary);
  assert.equal(el('Trace').children.length,1,'A new free-play origin cannot be appended to the saved trace');
  assert.match(el('TraceHint').textContent,/main bebas sementara/);
  assert.match(el('Trace').children[0].getAttribute('aria-label'),/0\.000 saat/);
  assert.equal(el('Count').textContent,'2');
  assert.equal(JSON.stringify(take(s,i)),before,'Practice must not change saved events or raw capture');
  s.advance(250);
  await hit(s,i.primary);
  assert.equal(el('Trace').children.length,2);
  assert.match(el('Trace').children[1].getAttribute('aria-label'),/0\.250 saat/);
  await click(s,i.prefix+'Stop');
  s.advance(250);
  await hit(s,i.primary);
  assert.equal(el('Trace').children.length,1,'Henti begins a new temporary practice sequence');
  assert.match(el('Trace').children[0].getAttribute('aria-label'),/0\.000 saat/);
  await click(s,i.prefix+'Stop');
  await click(s,i.prefix+'Replay');
  assert.equal(el('Trace').children.length,2);
  assert.match(el('Trace').children[1].getAttribute('aria-label'),/0\.375 saat/);
  assert.equal(JSON.stringify(take(s,i)),before);
  await click(s,i.prefix+'Stop');
  await click(s,i.prefix+'ExportJson');
  assert.equal(JSON.stringify(JSON.parse(await s.blobs.at(-1).text())),before);
 });
}

test('pending percussion audio and standalone metronome have truthful states and cancel safely',async()=>{
 const i=instruments[1],s=await open(i,{audioState:'suspended',deferResume:true});
 const pending=click(s,'kompExample');
 await s.settle();
 assert.equal(s.ids.get('kompSessionState').dataset.state,'pending');
 assert.equal(s.ids.get('kompStop').disabled,false);
 await click(s,'kompStop');
 s.resumeAudio();
 await pending;
 await s.settle();
 assert.equal(s.ids.get('kompSessionState').dataset.state,'idle');
 assert.equal(s.oscillators.length,0);
 assert.equal(s.activeIntervals(),0);
 s.ids.get('kompMetro').checked=true;
 await s.ids.get('kompMetro').fire('change');
 assert.equal(s.ids.get('kompSessionState').dataset.state,'metronome');
 await click(s,'kompStop');
 assert.equal(s.ids.get('kompSessionState').dataset.state,'idle');
 assert.equal(s.ids.get('kompCount').textContent,'0');
});

test('all percussion transports keep readable Henti text and described trace content',()=>{
 const html=fs.readFileSync('index.html','utf8');
 for(const i of instruments){
  assert.match(html,new RegExp('<button id="'+i.prefix+'Stop"[^>]*>[\\s\\S]*?</svg>Henti</button>'));
  assert.match(html,new RegExp('<div id="'+i.prefix+'Trace"[^>]*aria-describedby="'+i.prefix+'TraceHint"'));
 }
});
