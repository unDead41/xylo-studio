const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const {studio}=require('./helpers/studio.cjs');
const html=fs.readFileSync('index.html','utf8');
const instruments=[
 {id:'snare',prefix:'snare',name:'Dram Sisi',choose:'chooseSnare',actions:['hit','rim']},
 {id:'bass_drum',prefix:'bass',name:'Dram Bes',choose:'chooseBassDrum',actions:['hit','soft']},
 {id:'cymbals',prefix:'cym',name:'Simbal',choose:'chooseCymbals',actions:['crash','soft']},
 {id:'triangle',prefix:'tri',name:'Segi Tiga',choose:'chooseTriangle',actions:['open','muted']}
];
const plain=value=>JSON.parse(JSON.stringify(value));
function block(id){const box={};vm.runInNewContext(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1],box);return box;}
const click=(s,id)=>s.ids.get(id).fire('click');
const key=async(s,k)=>{await s.dispatch('keydown',{key:k});await s.dispatch('keyup',{key:k});};
const read=(s,id)=>JSON.parse(s.saved.get('e-instru-percussion-v1:'+id));
async function open(instrument,options={}){const s=studio({percussion:true,chooser:true,variant:null,...options});assert.ok(s.ids.get(instrument.choose),'Real chooser card is required');await click(s,instrument.choose);return s;}
async function record(s,i){await click(s,i.prefix+'Record');s.setNow(1234.125);await key(s,'f');s.setNow(1689.625);await key(s,'j');await click(s,i.prefix+'Stop');}

for(const i of instruments){
 test(i.name+' capture and export preserve exact action identity and raw evidence through edits, tempo and Reset',()=>{
  const C=block('percussion-core').PercussionCore,t=C.createTake(i.id,90);
  C.capture(t,i.actions[0],1234.125);C.capture(t,i.actions[1],1689.625);
  assert.deepEqual(plain(t.raw_capture.map(e=>[e.action,e.raw_ms])),[[i.actions[0],0],[i.actions[1],455.5]]);
  const raw=JSON.stringify(t.raw_capture),edited=C.editEvent(t,1,i.actions[0],500),faster=C.setTempo(edited,180);
  assert.equal(faster.events[1].at_ms,250);assert.equal(JSON.stringify(faster.raw_capture),raw);
  assert.deepEqual(plain(C.importTake(JSON.stringify(faster))),plain(faster));assert.match(C.csv(faster),new RegExp(i.id+',1,'+i.actions[0]+',250,'+i.actions[1]+',455\\.5'));
  assert.throws(()=>C.capture(t,'metronome',2000));assert.doesNotMatch(JSON.stringify(t),/midi|pitch/);
 });
 test(i.name+' opens empty, records from real zones and shortcuts, then returns to its own Game workspace',async()=>{
  const s=await open(i);assert.equal(s.ids.get(i.id+'View').hidden,false);assert.equal(s.ids.get(i.prefix+'Count').textContent,'0');assert.equal(s.oscillators.length,0);
  await click(s,i.prefix+'Record');s.setNow(1234.125);await s.ids.get(i.prefix+'Primary').fire('pointerdown',{pointerType:'touch'});await s.ids.get(i.prefix+'Primary').fire('click',{detail:1});s.setNow(1689.625);await key(s,'j');await s.dispatch('keydown',{key:'j',repeat:true});await click(s,i.prefix+'Stop');
  assert.deepEqual(read(s,i.id).events.map(e=>[e.action,e.raw_ms]),[[i.actions[0],0],[i.actions[1],455.5]]);
  const before=JSON.stringify(read(s,i.id));await click(s,'gameModeBtn');assert.equal(s.ids.get(i.id+'View').hidden,true);await click(s,'studioModeBtn');assert.equal(s.ids.get(i.id+'View').hidden,false);assert.equal(JSON.stringify(read(s,i.id)),before);assert.equal(s.activeIntervals(),0);
 });
 test(i.name+' examples, metronome and trace audition never enter recording; replay retains complete sound tails',async()=>{
  const s=await open(i);for(const kind of ['basic','alternate','offbeat','march']){s.ids.get(i.prefix+'Pattern').value=kind;await click(s,i.prefix+'Example');s.advance(1600);await click(s,i.prefix+'Stop');assert.equal(s.ids.get(i.prefix+'Count').textContent,'0');}
  await record(s,i);const before=JSON.stringify(read(s,i.id));s.ids.get(i.prefix+'Metro').checked=true;await s.ids.get(i.prefix+'Metro').fire('change');s.advance(1500);await click(s,i.prefix+'Stop');await click(s,i.prefix+'Replay');s.advance(800);assert.equal(s.ids.get(i.prefix+'Stop').disabled,false);s.advance(1800);assert.equal(s.activeIntervals(),0);
  await s.ids.get(i.prefix+'Trace').children[0].fire('click');s.advance(1400);assert.equal(JSON.stringify(read(s,i.id)),before);assert.equal(s.activeIntervals(),0);
 });
 test(i.name+' editing/tempo/Reset keep raw evidence and exported/imported identity isolated',async()=>{
  const s=await open(i);await record(s,i);const raw=JSON.stringify(read(s,i.id).raw_capture);
  let row=s.ids.get(i.prefix+'Rows').children[0];row.querySelector('select').value=i.actions[1];await row.querySelector('select').fire('change');row=s.ids.get(i.prefix+'Rows').children[0];row.querySelector('input').value='125';await row.querySelector('input').fire('change');
  s.ids.get(i.prefix+'Tempo').value=160;await s.ids.get(i.prefix+'Tempo').fire('input');await click(s,i.prefix+'Reset');assert.equal(read(s,i.id).events[0].at_ms,125);assert.equal(JSON.stringify(read(s,i.id).raw_capture),raw);
  await click(s,i.prefix+'ExportJson');assert.deepEqual(JSON.parse(await s.blobs.at(-1).text()),read(s,i.id));await click(s,i.prefix+'ExportCsv');assert.match(await s.blobs.at(-1).text(),new RegExp(i.id+',0,'+i.actions[1]));
  const before=JSON.stringify(read(s,i.id));s.ids.get(i.prefix+'ImportText').value=JSON.stringify(s.P.createTake('tamborin'));await click(s,i.prefix+'ImportBtn');assert.equal(s.ids.get(i.prefix+'ImportError').hidden,false);assert.equal(JSON.stringify(read(s,i.id)),before);
 });
 test(i.name+' navigation, blur and delayed audio activation cannot leave hidden sounds or timers running',async()=>{
  for(const boundary of ['back','blur','visibilitychange','pagehide']){const s=await open(i);await record(s,i);const before=JSON.stringify(read(s,i.id));await click(s,i.prefix+'Example');s.advance(200);if(boundary==='back')await click(s,i.prefix+'Back');else if(boundary==='visibilitychange'){s.document.hidden=true;await s.dispatch(boundary);}else await s.windowEvent(boundary);const n=s.oscillators.length;s.advance(5000);assert.equal(s.oscillators.length,n);assert.equal(s.activeIntervals(),0);assert.equal(JSON.stringify(read(s,i.id)),before);}
  const s=await open(i,{audioState:'suspended',deferResume:true});const pending=click(s,i.prefix+'Example');await s.settle();await click(s,i.prefix+'Back');s.resumeAudio();await pending;await s.settle();assert.equal(s.oscillators.length,0);assert.equal(s.activeIntervals(),0);
 });
}

test('all eight instruments keep independent workspaces across switching and reload',async()=>{
 const s=studio({percussion:true,chooser:true,variant:null});const snapshots={};
 for(const i of instruments){await click(s,i.choose);await record(s,i);snapshots[i.id]=read(s,i.id);await click(s,i.prefix+'Back');}
 await click(s,'chooseTamborin');await click(s,'percRecord');await key(s,'g');await click(s,'percStop');snapshots.tamborin=read(s,'tamborin');await click(s,'percBack');
 await click(s,'chooseKompang');await click(s,'kompRecord');await key(s,'f');await click(s,'kompStop');snapshots.kompang=read(s,'kompang');await click(s,'kompBack');
 const restored=studio({percussion:true,chooser:true,variant:null,storage:Object.fromEntries(s.saved)});
 for(const i of instruments){await click(restored,i.choose);await click(restored,i.prefix+'ExportJson');assert.deepEqual(JSON.parse(await restored.blobs.at(-1).text()),snapshots[i.id]);await click(restored,i.prefix+'Back');}
 for(const id of ['tamborin','kompang'])assert.deepEqual(read(restored,id),snapshots[id]);
 await click(restored,'chooseRecorder');assert.equal(restored.ids.get('studioHeading').textContent,'Rekoder Soprano');await click(restored,'changeInstrumentBtn');await click(restored,'chooseXylophone');assert.equal(restored.C.PRESETS.length,10);
});

test('school band has eight real cards, unique IDs and valid native control references without runtime downloads',()=>{
 // Library strings can contain HTML examples; only parsed document markup owns
 // native ID references. Source execution is verified separately by auth tests.
 const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const chooser=html.match(/<section id="instrumentChooser"[\s\S]*?<\/section>/)[0];assert.equal((chooser.match(/class="instrument-choice"/g)||[]).length,8);
 const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of markup.matchAll(/\b(?:for|aria-labelledby|aria-describedby)="([^"]+)"/g))for(const id of match[1].split(/\s+/))assert.ok(ids.includes(id),'Missing '+id);
 assert.doesNotMatch(html,/<script\b[^>]*src=/);for(const i of instruments)for(const suffix of ['Primary','Secondary'])assert.match(html,new RegExp('id="'+i.prefix+suffix+'"[^>]*role="button"[^>]*tabindex="0"'));
});

function audio(){
 const nodes=[],sources=[];const p=()=>({value:0,events:[],setValueAtTime(v,t){this.events.push([v,t]);},exponentialRampToValueAtTime(v,t){this.events.push([v,t]);}});
 function n(kind){const v={kind,connected:false,gain:p(),frequency:p(),Q:p(),connect(){this.connected=true;},disconnect(){this.connected=false;},start(t){this.startAt=t;},stop(){this.stopped=true;}};nodes.push(v);return v;}
 const context={currentTime:1,sampleRate:48000,destination:{},createGain:()=>n('gain'),createOscillator(){const x=n('osc');sources.push(x);return x;},createBufferSource(){const x=n('noise');sources.push(x);return x;},createBiquadFilter:()=>n('filter'),createBuffer:(_,length)=>({getChannelData:()=>new Float32Array(length)})};
 return{context,nodes,sources,A:block('percussion-audio').PercussionAudio};
}
for(const i of instruments)test(i.name+' generates distinct action envelopes and releases every audio node',()=>{
 const summaries=[];for(const action of i.actions){const a=audio();assert.equal(typeof a.A[i.id],'function');const voice=a.A[i.id](a.context,action,2);assert.ok(a.sources.length>0);assert.ok(a.sources.every(s=>s.startAt>=2));summaries.push([voice.endAt,a.nodes.filter(n=>n.kind==='gain').map(n=>n.gain.events)]);for(const source of a.sources)source.onended?.();assert.equal(a.nodes.some(n=>n.connected),false);voice.cancel();assert.equal(a.nodes.some(n=>n.connected),false);}
 assert.notDeepEqual(summaries[0],summaries[1]);const invalid=audio();assert.throws(()=>invalid.A[i.id](invalid.context,'foreign'));assert.equal(invalid.nodes.length,0);
});
