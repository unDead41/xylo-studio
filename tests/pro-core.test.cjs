const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../studio-pro/core.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function core(){const box={};vm.createContext(box);vm.runInContext(source,box);return box.ProStudioCore;}
function legacy(id){
 const match=html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'));
 assert.ok(match,'The integration fixture must be the actual legacy inline core.');
 const box={};vm.createContext(box);vm.runInContext(match[1],box);return id==='xylo-core'?box.XyloCore:box.PercussionCore;
}
function freeze(value){if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function withTrack(C,id='xylophone',options={}){return C.addTrack(C.createProject(options),id);}
function withEvent(C,id='xylophone',event={},options={}){const project=withTrack(C,id,options);return C.addEvent(project,project.tracks[0].id,event);}

test('professional core has eight explicit instrument descriptors and no host dependencies',()=>{
 const C=core();assert.equal(C.SCHEMA,'e-instru-project/v1');assert.equal(C.PPQ,24);assert.equal(C.BAR_TICKS,96);
 assert.equal(C.MAX_TRACKS,8);assert.equal(C.MAX_EVENTS,512);assert.equal(C.MAX_BARS,32);
 assert.deepEqual(Object.keys(C.INSTRUMENTS),['xylophone','recorder','tamborin','kompang','snare','bass_drum','cymbals','triangle']);
 assert.equal(C.INSTRUMENTS.recorder.minMidi,72);assert.equal(C.INSTRUMENTS.recorder.maxMidi,98);
 assert.equal(C.INSTRUMENTS.xylophone.maxMidi,127);assert.equal(C.INSTRUMENTS.tamborin.defaultMidi,null);
 assert.deepEqual(plain(C.INSTRUMENTS.kompang.actions),['center','edge']);
 assert.ok(Object.isFrozen(C));assert.ok(Object.isFrozen(C.INSTRUMENTS.snare.actions));
 const window={};vm.runInNewContext(source,{window});assert.ok(window.ProStudioCore);
});

test('empty projects are valid, independent and configurable with unique identity',()=>{
 const C=core(),a=C.createProject(),b=C.createProject();
 assert.deepEqual(plain(C.validate(a)),[]);assert.notEqual(a.id,b.id);assert.deepEqual(plain(a.tracks),[]);
 assert.equal(a.bpm,100);assert.equal(a.lengthBars,8);assert.equal(a.master.volume,.8);
 assert.deepEqual(plain(a.loop),{enabled:false,startTick:0,endTick:768});
 const options=freeze({id:'custom-project',title:'Lagu kelas',bpm:80,lengthBars:4,loop:{enabled:true,endTick:96},master:{volume:.4}});
 const p=C.createProject(options);assert.equal(p.id,'custom-project');assert.equal(p.loop.startTick,0);assert.equal(p.master.volume,.4);
 assert.throws(()=>C.createProject({bpm:39}),/Tempo/);assert.throws(()=>C.createProject({unknown:true}),/Medan/);
 p.master.volume=.1;assert.equal(a.master.volume,.8);
});

test('validation reports malformed project structures without throwing',()=>{
 const C=core();
 for(const value of [null,undefined,[],true,0,'{}'])assert.ok(C.validate(value).length);
 const original=withEvent(C,'recorder');
 const cases=[
  p=>p.schema='other',p=>p.id='',p=>p.title=' ',p=>p.bpm=80.5,p=>p.bpm=201,
  p=>p.lengthBars=3,p=>p.lengthBars=33,p=>p.loop=null,p=>p.loop.enabled=1,
  p=>p.loop.startTick=p.loop.endTick,p=>p.loop.endTick=769,p=>p.master.volume=Infinity,
  p=>p.tracks=null,p=>p.tracks[0].name='',p=>p.tracks[0].instrumentId='constructor',
  p=>p.tracks[0].volume=1.1,p=>p.tracks[0].pan=-1.1,p=>p.tracks[0].reverb=NaN,
  p=>p.tracks[0].delay=-.01,p=>p.tracks[0].muted=0,p=>p.tracks[0].solo='false',
  p=>p.tracks[0].events=null,p=>p.tracks[0].events[0]=null,
  p=>p.tracks[0].events[0].midi=71,p=>p.tracks[0].events[0].midi=99,
  p=>p.tracks[0].events[0].action='hit',p=>p.tracks[0].events[0].tick=-1,
  p=>p.tracks[0].events[0].tick=768,p=>p.tracks[0].events[0].durationTick=0,
  p=>p.tracks[0].events[0].durationTick=769,p=>p.tracks[0].events[0].velocity=-.1,
  p=>p.tracks[0].events[0].velocity=Infinity,p=>p.tracks[0].sourceTake={schema:'other',events:[]}
 ];
 for(const mutate of cases){const p=plain(original);mutate(p);assert.ok(C.validate(p).length,mutate.toString());}
 const cyclic=plain(original);cyclic.self=cyclic;assert.match(C.validate(cyclic).join('\n'),/dirinya sendiri/);
 const binary=plain(original);binary.raw_audio='data:audio/wav;base64,AAAA';assert.match(C.validate(binary).join('\n'),/Audio mentah/);
 assert.deepEqual(plain(C.validate(original)),[]);
});

test('track, event and project mutations preserve frozen input and stable event identities',()=>{
 const C=core(),base=freeze(C.createProject({lengthBars:4})),added=C.addTrack(base,'xylophone'),id=added.tracks[0].id;
 let project=C.addEvent(freeze(added),id,{tick:24,midi:67,durationTick:12,velocity:.5});
 const eventId=project.tracks[0].events[0].id;
 project=C.addEvent(freeze(project),id,{tick:0,midi:60});
 assert.deepEqual(plain(project.tracks[0].events.map(e=>e.tick)),[0,24]);
 project=C.updateEvent(freeze(project),id,eventId,{tick:1,midi:69});
 assert.equal(project.tracks[0].events[1].id,eventId);assert.equal(project.tracks[0].events[1].midi,69);
 project=C.updateTrack(freeze(project),id,{name:'Melodi',volume:.3,pan:-.5,muted:true,solo:true,reverb:.4,delay:.2});
 assert.equal(project.tracks[0].name,'Melodi');assert.equal(project.tracks[0].delay,.2);
 project=C.updateProject(freeze(project),{title:'Susunan kelas',bpm:160,lengthBars:6,master:{volume:.6},loop:{enabled:true,startTick:96}});
 assert.equal(project.lengthBars,6);assert.equal(project.loop.endTick,576);assert.equal(project.loop.startTick,96);assert.equal(project.bpm,160);
 assert.equal(base.tracks.length,0);assert.equal(added.tracks[0].events.length,0);
 const removed=C.removeEvent(freeze(project),id,eventId);assert.equal(removed.tracks[0].events.length,1);
 const empty=C.removeTrack(freeze(removed),id);assert.deepEqual(plain(empty.tracks),[]);
 for(const call of [()=>C.updateTrack(project,'missing',{}),()=>C.removeEvent(project,id,'missing'),()=>C.removeTrack(project,'missing'),()=>C.updateEvent(project,id,eventId,{id:'replacement'}),()=>C.updateTrack(project,id,{events:[]}),()=>C.updateProject(project,{id:'replacement'})])assert.throws(call);
 assert.equal(project.tracks[0].events[1].id,eventId);
});

test('all percussion defaults and edits use actions without fabricated MIDI pitch',()=>{
 const C=core();
 for(const id of ['tamborin','kompang','snare','bass_drum','cymbals','triangle']){
  let p=withEvent(C,id);const track=p.tracks[0],event=track.events[0];
  assert.equal(event.midi,null);assert.equal(event.action,C.INSTRUMENTS[id].actions[0]);
  p=C.updateEvent(p,track.id,event.id,{action:C.INSTRUMENTS[id].actions[1]});assert.equal(C.validate(p).length,0);
  assert.throws(()=>C.updateEvent(p,track.id,event.id,{midi:60}));
  assert.throws(()=>C.updateEvent(p,track.id,event.id,{action:'other'}));
  assert.throws(()=>C.addEvent(p,track.id,{midi:NaN}));
  assert.throws(()=>C.addEvent(p,track.id,{midi:Infinity}));
  assert.throws(()=>C.transposeTrack(p,track.id,12),/melodi/);
 }
 const x=withEvent(C);assert.throws(()=>C.updateEvent(x,x.tracks[0].id,x.tracks[0].events[0].id,{midi:0}));
});

test('duplicates remap all event identities and preserve independent source evidence',()=>{
 const C=core(),X=legacy('xylo-core'),take=X.fromTaps([{midi:60,raw_ms:0},{midi:62,raw_ms:750}],80);
 const p=freeze(C.importTake(C.createProject(),take)),copied=C.duplicateTrack(p,p.tracks[0].id);
 assert.equal(copied.tracks.length,2);assert.notEqual(copied.tracks[0].id,copied.tracks[1].id);
 assert.notEqual(copied.tracks[0].events[0].id,copied.tracks[1].events[0].id);
 assert.deepEqual(plain(copied.tracks[1].sourceTake),plain(take));
 assert.ok(Object.isFrozen(copied.tracks[1].sourceTake.raw_capture[0]));
 copied.tracks[1].events[0].midi=69;assert.equal(copied.tracks[0].events[0].midi,60);assert.equal(p.tracks.length,1);
 const bad=plain(copied);bad.tracks[1].events[0].id=bad.tracks[0].events[0].id;assert.match(C.validate(bad).join('\n'),/unik/);
 bad.tracks[1].id=bad.tracks[0].id;assert.match(C.validate(bad).join('\n'),/Identiti trek/);
});

test('track and event limits reject overflow without changing valid data',()=>{
 const C=core();let p=C.createProject({lengthBars:4});
 for(const id of Object.keys(C.INSTRUMENTS))p=C.addTrack(p,id);
 assert.equal(p.tracks.length,8);assert.throws(()=>C.addTrack(p,'xylophone'),/8 trek/);assert.throws(()=>C.duplicateTrack(p,p.tracks[0].id),/8 trek/);
 const full=plain(withTrack(C,'xylophone',{lengthBars:4}));
 full.tracks[0].events=Array.from({length:512},(_,i)=>({id:'event-'+i,tick:i%384,durationTick:1,midi:60,action:null,velocity:1}));
 assert.equal(C.validate(full).length,0);const before=JSON.stringify(full);
 assert.throws(()=>C.addEvent(full,full.tracks[0].id),/512/);assert.equal(JSON.stringify(full),before);
 full.tracks[0].events.push({...full.tracks[0].events[0],id:'overflow'});assert.match(C.validate(full).join('\n'),/512/);
});

test('quantization has adjustable strength, preserves gates and bounds the final onset',()=>{
 const C=core();let p=withEvent(C,'xylophone',{tick:8,durationTick:12},{lengthBars:4}),id=p.tracks[0].id;
 p=C.addEvent(p,id,{tick:380,durationTick:4});const before=JSON.stringify(p);
 const half=C.quantizeTrack(freeze(p),id,12,.5);assert.equal(half.tracks[0].events[0].tick,10);
 const full=C.quantizeTrack(p,id,12);assert.equal(full.tracks[0].events[0].tick,12);assert.equal(full.tracks[0].events[0].durationTick,12);
 assert.equal(full.tracks[0].events[1].tick,380);assert.equal(full.tracks[0].events[1].durationTick,4);
 assert.equal(JSON.stringify(C.quantizeTrack(p,id,12,0)),before);assert.equal(JSON.stringify(p),before);
 for(const [grid,strength]of [[0,1],[1.5,1],[385,1],[6,-.1],[6,1.1],[6,NaN]])assert.throws(()=>C.quantizeTrack(p,id,grid,strength));
});

test('transpose validates the resulting instrument range and length changes retain bounded events',()=>{
 const C=core(),p=withEvent(C,'recorder',{midi:72,durationTick:24},{lengthBars:8}),id=p.tracks[0].id,before=JSON.stringify(p);
 const transposed=C.transposeTrack(freeze(p),id,12);assert.equal(transposed.tracks[0].events[0].midi,84);
 assert.throws(()=>C.transposeTrack(p,id,-1),/72–98/);assert.throws(()=>C.transposeTrack(p,id,.5),/semiton/);assert.equal(JSON.stringify(p),before);
 const tail=C.updateEvent(p,id,p.tracks[0].events[0].id,{tick:740});assert.throws(()=>C.updateProject(tail,{lengthBars:4}),/panjang projek/);
 const short=C.updateProject(p,{lengthBars:4});assert.equal(short.loop.endTick,384);
 assert.throws(()=>C.updateTrack(p,id,{instrumentId:'tamborin'}),/perkusi/);
});

test('legacy pitched v1/v2 imports retain provenance and adopt tempo only for an empty arrangement',()=>{
 const C=core(),X=legacy('xylo-core'),take=X.preset(2),before=JSON.stringify(take);
 const empty=freeze(C.createProject({lengthBars:4})),p=C.importTake(empty,take),track=p.tracks[0];
 assert.equal(p.bpm,80);assert.equal(track.instrumentId,'xylophone');assert.equal(track.events.length,take.events.length);
 assert.deepEqual(plain(track.events.map(e=>[e.tick,e.durationTick,e.midi,e.action])),plain(take.events.map(e=>[e.onset_tick,e.duration_tick,e.midi,null])));
 assert.deepEqual(plain(track.sourceTake),plain(take));assert.equal(track.sourceTake.reference_verified,false);
 assert.equal(JSON.stringify(take),before);assert.equal(empty.bpm,100);assert.equal(empty.tracks.length,0);
 const faster=C.updateProject(p,{bpm:140}),layered=C.importTake(faster,JSON.stringify(take));assert.equal(layered.bpm,140);assert.equal(layered.tracks.length,2);
 const v1=plain(take);v1.schema='xylo-studio-take/v1';delete v1.instrument_id;
 assert.equal(C.importTake(C.createProject(),v1).tracks[0].instrumentId,'xylophone');
 const legacyInstrument=plain(take);delete legacyInstrument.instrument_id;legacyInstrument.instrument='xylophone';
 assert.equal(C.importTake(C.createProject(),legacyInstrument).tracks[0].instrumentId,'xylophone');
});

test('all ten actual catalog arrangements import in both lengths without changing legacy source data',()=>{
 const C=core(),X=legacy('xylo-core');assert.equal(X.PRESETS.length,10);
 for(const preset of X.PRESETS)for(const variant of ['short','long']){
  const take=X.preset(preset.id,4,variant),evidence=JSON.stringify(take),p=C.importTake(C.createProject({lengthBars:4}),take);
  assert.equal(C.validate(p).length,0,preset.title+' '+variant);assert.ok(p.lengthBars<=32);
  assert.deepEqual(plain(p.tracks[0].events.map(e=>[e.tick,e.durationTick,e.midi])),plain(take.events.filter(e=>e.midi!==0).map(e=>[e.onset_tick,e.duration_tick,e.midi])));
  assert.equal(JSON.stringify(p.tracks[0].sourceTake),evidence);assert.equal(JSON.stringify(take),evidence);
 }
 const pitched=C.importTake(C.createProject(),X.empty(80));assert.equal(pitched.tracks.length,1);assert.equal(pitched.tracks[0].events.length,0);
 const P=legacy('percussion-core'),percussion=C.importTake(C.createProject(),P.createTake());assert.equal(percussion.tracks.length,1);assert.equal(percussion.tracks[0].events.length,0);
});

test('recorder gates and raw release evidence survive quantization, transpose, mixer and JSON roundtrip',()=>{
 const C=core(),X=legacy('xylo-core');
 const take=X.fromTaps([{midi:72,raw_ms:1000,raw_duration_ms:600,release_ms:1600},{midi:74,raw_ms:1750,raw_duration_ms:300,release_ms:2050}],80,12,2,5,'recorder');
 const evidence=JSON.stringify(take);let p=C.importTake(C.createProject(),take),track=p.tracks[0];
 assert.equal(track.events[0].durationTick,take.events[0].gate_tick);assert.notEqual(track.events[0].durationTick,take.events[0].duration_tick);
 p=C.quantizeTrack(p,track.id,24);p=C.transposeTrack(p,track.id,2);p=C.updateTrack(p,track.id,{pan:1,reverb:.5});p=C.updateProject(p,{bpm:160});
 const restored=C.projectFromJSON(C.exportProject(p));assert.deepEqual(plain(restored),plain(p));
 assert.equal(JSON.stringify(restored.tracks[0].sourceTake),evidence);assert.ok(Object.isFrozen(restored.tracks[0].sourceTake));
 assert.equal(restored.tracks[0].sourceTake.raw_capture[1].release_ms,1050);assert.equal(restored.tracks[0].sourceTake.capture_bpm,80);
});

test('legacy rests remain silent while source duration can extend to the full 32 bars',()=>{
 const C=core(),X=legacy('xylo-core'),take=X.preset(2);
 take.events[1].midi=0;let p=C.importTake(C.createProject({lengthBars:4}),take);
 assert.equal(p.tracks[0].events.length,take.events.length-1);assert.equal(p.tracks[0].sourceTake.events[1].midi,0);
 const long=X.empty(100);long.events=[{midi:60,onset_tick:0,duration_tick:3072,raw_ms:null}];long.end_tick=3072;
 p=C.importTake(C.createProject({lengthBars:4}),long);assert.equal(p.lengthBars,32);assert.equal(p.loop.endTick,3072);
 long.events[0].duration_tick=3073;long.end_tick=3073;const original=C.createProject();
 assert.throws(()=>C.importTake(original,long),/32 bar/);assert.equal(original.tracks.length,0);
});

test('actual edited percussion captures map score milliseconds to beats and preserve raw action evidence',()=>{
 const C=core(),P=legacy('percussion-core'),take=P.createTake('kompang',80);
 P.capture(take,'center',4300);P.capture(take,'edge',5043);
 const edited=P.setTempo(P.editEvent(take,1,'center',900),160),before=JSON.stringify(edited);
 let p=C.importTake(C.createProject(),edited),track=p.tracks[0];
 assert.equal(p.bpm,160);assert.deepEqual(plain(track.events.map(e=>[e.tick,e.action,e.midi,e.durationTick])),[[0,'center',null,6],[29,'center',null,6]]);
 assert.equal(track.sourceTake.raw_capture[1].action,'edge');assert.equal(track.sourceTake.raw_capture[1].raw_ms,743);
 p=C.quantizeTrack(p,track.id,6);assert.equal(p.tracks[0].events[1].tick,30);assert.equal(JSON.stringify(p.tracks[0].sourceTake),before);
 const layered=C.importTake(withTrack(C,'xylophone',{bpm:100}),edited);assert.equal(layered.bpm,100);assert.equal(layered.tracks[1].events[1].tick,29);
 for(const id of Object.keys(P.INSTRUMENTS)){
  const source=P.createTake(id,80);P.capture(source,P.INSTRUMENTS[id].actions[1],5000);
  assert.equal(C.importTake(C.createProject(),source).tracks[0].events[0].action,P.INSTRUMENTS[id].actions[1]);
 }
 assert.equal(JSON.stringify(edited),before);
});

test('source import rejects unknown pitches, unreviewed estimates, forged percussion evidence and raw audio',()=>{
 const C=core(),X=legacy('xylo-core'),P=legacy('percussion-core'),take=X.fromTaps([{midi:60,raw_ms:0}],80);
 const original=C.createProject(),before=JSON.stringify(original);
 for(const mutate of [t=>t.schema='other',t=>t.ppq=48,t=>t.bpm=NaN,t=>t.events[0].midi=null,t=>t.events[0].duration_tick=0,t=>t.events[0].gate_tick=0,t=>t.events[0].onset_tick=-1,t=>t.events[0].velocity=2,t=>t.raw_audio='AAAA']){
  const bad=plain(take);mutate(bad);assert.throws(()=>C.importTake(original,bad),mutate.toString());
 }
 const wrongEnd=plain(take);wrongEnd.end_tick++;assert.throws(()=>C.importTake(original,wrongEnd),/Akhir/);
 const savedSource=C.importTake(original,take),forgedProject=plain(savedSource);forgedProject.tracks[0].sourceTake.end_tick++;
 assert.throws(()=>C.projectFromJSON(JSON.stringify(forgedProject)),/Bukti rakaman sumber/);
 const estimate=X.fromTaps([{midi:60,raw_ms:0,source:'microphone_estimate',reviewed:false}],80);
 assert.throws(()=>C.importTake(original,estimate),/Semak/);
 estimate.events[0].reviewed=true;assert.equal(C.importTake(original,estimate).tracks.length,1);
 const perc=P.createTake();P.capture(perc,'tap',1000);P.capture(perc,'shake',1750);
 for(const mutate of [t=>t.events[1].raw_ms=751,t=>t.events[1].action='hit',t=>t.events[1].midi=60,t=>t.raw_capture[0].raw_ms=1,t=>t.events[1].id=0,t=>t.raw_capture[1].action='C4',t=>t.sound_source='recorded_audio']){
  const bad=plain(perc);mutate(bad);assert.throws(()=>C.importTake(original,bad),mutate.toString());
 }
 assert.equal(JSON.stringify(original),before);assert.throws(()=>C.importTake(original,'not JSON'),/JSON rakaman/);
});

test('project JSON and CSV carry mixer identity and escaped exact score timing',()=>{
 const C=core();let p=withEvent(C,'tamborin',{tick:24,durationTick:12,action:'shake',velocity:.45},{title:'Lagu, "kelas"',bpm:120});
 p=C.updateTrack(p,p.tracks[0].id,{name:'Trek, "satu"',pan:-.75,volume:.6,reverb:.2,delay:.4,muted:false,solo:true});
 const encoded=C.exportProject(p),restored=C.projectFromJSON(encoded);assert.deepEqual(plain(restored),plain(p));
 const csv=C.csv(p);assert.match(csv,/"project_id","project_title","bpm"/);assert.match(csv,/"Lagu, ""kelas"""/);assert.match(csv,/"Trek, ""satu"""/);
 assert.match(csv,/"24","12","500\.000","250\.000","","shake","0\.45"/);assert.equal(csv.split('\r\n').length,2);
 assert.throws(()=>C.projectFromJSON('malformed'),/JSON projek/);assert.throws(()=>C.projectFromJSON('null'),/Data projek/);
 const bad=plain(p);bad.tracks[0].events[0].tick=10000;assert.throws(()=>C.exportProject(bad),/panjang projek/);
 const noAudio=plain(p);noAudio.tracks[0].sourceTake={schema:'xylo-studio-take/v2',events:[],raw_capture:[],audioBuffer:[1,2]};assert.throws(()=>C.projectFromJSON(JSON.stringify(noAudio)),/Audio mentah/);
 restored.tracks[0].events[0].action='tap';assert.equal(p.tracks[0].events[0].action,'shake');
});

test('undo and redo isolate snapshots, discard abandoned futures, and coalesce mixer edits safely',()=>{
 const C=core(),initial=withTrack(C),id=initial.tracks[0].id,history=C.createHistory(freeze(initial),3);
 assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),false);
 let p=C.updateTrack(initial,id,{volume:.6});const committed=history.commit(p);assert.equal(history.canUndo(),true);
 committed.tracks[0].volume=.01;p.tracks[0].volume=.02;assert.equal(history.get().tracks[0].volume,.6);
 const read=history.get();read.title='Tamper';assert.equal(history.get().title,initial.title);
 p=C.updateTrack(history.get(),id,{volume:.5});history.commit(p,{replaceLast:true});
 assert.equal(history.undo().tracks[0].volume,.8);assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),true);
 assert.equal(history.redo().tracks[0].volume,.5);
 history.commit(history.get());assert.equal(history.undo().tracks[0].volume,.8);
 history.commit(C.updateTrack(history.get(),id,{pan:.7}));assert.equal(history.canRedo(),false);assert.equal(history.get().tracks[0].pan,.7);
 assert.throws(()=>history.commit({...history.get(),bpm:0}),/Tempo/);assert.equal(history.get().tracks[0].pan,.7);
 const blank=C.createHistory(initial);blank.commit(C.updateTrack(initial,id,{volume:.1}),{replaceLast:true});assert.equal(blank.undo().tracks[0].volume,.8);
 const branch=C.createHistory(initial);branch.commit(C.updateTrack(initial,id,{volume:.6}));branch.commit(C.updateTrack(branch.get(),id,{volume:.4}));
 branch.undo();branch.commit(C.updateTrack(branch.get(),id,{volume:.2}),{replaceLast:true});assert.equal(branch.undo().tracks[0].volume,.6);assert.equal(branch.canRedo(),true);
});

test('history bounds undo depth and preserves source evidence through repeated traversal',()=>{
 const C=core(),X=legacy('xylo-core'),initial=C.importTake(C.createProject(),X.preset(7)),history=C.createHistory(initial,2),evidence=JSON.stringify(initial.tracks[0].sourceTake);
 for(let bpm=101;bpm<=105;bpm++)history.commit(C.updateProject(history.get(),{bpm}));
 assert.equal(history.undo().bpm,104);assert.equal(history.undo().bpm,103);assert.equal(history.canUndo(),false);
 assert.equal(history.redo().bpm,104);assert.equal(history.redo().bpm,105);assert.equal(history.canRedo(),false);
 assert.equal(JSON.stringify(history.get().tracks[0].sourceTake),evidence);
 for(const limit of [0,1.5,1001,NaN])assert.throws(()=>C.createHistory(initial,limit));
});

test('bar copying owns onsets, preserves complete cross-bar gates and returns portable independent score values',()=>{
 const C=core();let p=withEvent(C,'recorder',{tick:90,durationTick:30,midi:72},{lengthBars:4}),id=p.tracks[0].id;
 p=C.addEvent(p,id,{tick:96,durationTick:100,midi:74,velocity:.45});
 p=C.addEvent(p,id,{tick:191,durationTick:40,midi:76});p=C.addEvent(p,id,{tick:192,midi:77});
 const before=JSON.stringify(p),clip=C.copyBar(freeze(p),id,1);
 assert.equal(C.BAR_SCHEMA,'e-instru-bar/v1');assert.equal(clip.schema,C.BAR_SCHEMA);assert.equal(clip.instrumentId,'recorder');
 assert.deepEqual(plain(clip.source),{projectId:p.id,trackId:id,barIndex:1});
 assert.deepEqual(plain(clip.events),[
  {tick:0,durationTick:100,midi:74,action:null,velocity:.45},
  {tick:95,durationTick:40,midi:76,action:null,velocity:.8}
 ]);
 assert.ok(clip.events.every(event=>!('id'in event)&&!('raw_capture'in event)&&!('sourceTake'in event)));
 clip.events[0].midi=80;clip.source.projectId='other';assert.equal(JSON.stringify(p),before);
 assert.deepEqual(plain(C.copyBar(p,id,3).events),[]);
 assert.deepEqual(plain(C.copyBar(p,id,0).events.map(event=>[event.tick,event.durationTick])),[[90,30]]);
});

test('portable bar paste layers notes with fresh globally unique IDs and keeps source gates exact',()=>{
 const C=core();let source=withEvent(C,'recorder',{tick:0,durationTick:120,midi:72},{lengthBars:4}),sourceId=source.tracks[0].id;
 source=C.addEvent(source,sourceId,{tick:24,durationTick:24,midi:74,velocity:.3});
 const clip=freeze(plain(C.copyBar(source,sourceId,0))),clipBefore=JSON.stringify(clip);
 let target=withEvent(C,'recorder',{tick:200,durationTick:6,midi:79},{lengthBars:4}),id=target.tracks[0].id;
 target=C.addTrack(target,'xylophone');target=C.addEvent(target,target.tracks[1].id,{id:id+'-event-2',tick:0});
 const before=JSON.stringify(target),oldIds=new Set(target.tracks.flatMap(track=>track.events.map(event=>event.id))),next=C.pasteBar(freeze(target),id,2,clip);
 assert.deepEqual(plain(next.tracks[0].events.map(event=>[event.tick,event.durationTick,event.midi,event.velocity])),[[192,120,72,.8],[200,6,79,.8],[216,24,74,.3]]);
 const added=next.tracks[0].events.filter(event=>!oldIds.has(event.id));assert.equal(added.length,2);
 assert.equal(new Set(next.tracks.flatMap(track=>track.events.map(event=>event.id))).size,4);
 assert.equal(C.validate(next).length,0);assert.equal(JSON.stringify(target),before);assert.equal(JSON.stringify(clip),clipBefore);
 assert.equal('sourceTake'in next.tracks[0],false);assert.equal('raw_capture'in next.tracks[0],false);
 added[0].midi=76;assert.equal(clip.events[0].midi,72);assert.equal(source.tracks[0].events[0].midi,72);
});

test('replacement and clear affect only selected-bar onsets and preserve incoming tails from other bars',()=>{
 const C=core();let p=withEvent(C,'xylophone',{tick:90,durationTick:24},{lengthBars:4}),id=p.tracks[0].id;
 p=C.addEvent(p,id,{tick:96,midi:62});p=C.addEvent(p,id,{tick:191,midi:64});p=C.addEvent(p,id,{tick:192,midi:65});
 const oldIds=new Set(p.tracks[0].events.map(event=>event.id)),clipboard=freeze({schema:C.BAR_SCHEMA,instrumentId:'xylophone',events:[{tick:12,durationTick:18,midi:67,action:null,velocity:.6}]}),before=JSON.stringify(p);
 const layer=C.pasteBar(freeze(p),id,1,clipboard);assert.deepEqual(plain(layer.tracks[0].events.map(event=>event.tick)),[90,96,108,191,192]);
 const replace=C.pasteBar(p,id,1,clipboard,{replace:true});assert.deepEqual(plain(replace.tracks[0].events.map(event=>event.tick)),[90,108,192]);
 assert.equal(replace.tracks[0].events[0].durationTick,24);assert.ok(!oldIds.has(replace.tracks[0].events[1].id));
 const cleared=C.clearBar(p,id,1);assert.deepEqual(plain(cleared.tracks[0].events.map(event=>event.tick)),[90,192]);
 assert.deepEqual(plain(cleared.tracks[0].events.map(event=>event.id)),[p.tracks[0].events[0].id,p.tracks[0].events[3].id]);
 assert.equal(JSON.stringify(p),before);
});

test('empty clipboard preserves layering and clears only through explicit replacement',()=>{
 const C=core();let p=withEvent(C,'tamborin',{tick:0},{lengthBars:4}),id=p.tracks[0].id;
 p=C.addEvent(p,id,{tick:96,action:'shake'});const clip=C.copyBar(p,id,3),before=JSON.stringify(p);
 const layered=C.pasteBar(freeze(p),id,0,freeze(clip));assert.notEqual(layered,p);assert.equal(JSON.stringify(layered),before);
 const replaced=C.pasteBar(p,id,0,clip,{replace:true});assert.deepEqual(plain(replaced.tracks[0].events.map(event=>event.tick)),[96]);
 assert.equal(C.copyBar(replaced,id,0).events.length,0);
 const alreadyEmpty=C.clearBar(p,id,2);assert.notEqual(alreadyEmpty,p);assert.equal(JSON.stringify(alreadyEmpty),before);
 const unordered=plain(p);unordered.tracks[0].events.reverse();const orderBefore=JSON.stringify(unordered);
 assert.equal(C.validate(unordered).length,0);assert.equal(JSON.stringify(C.pasteBar(unordered,id,0,clip)),orderBefore);
 const history=C.createHistory(p);history.commit(C.clearBar(p,id,0));history.undo();
 history.commit(C.pasteBar(history.get(),id,0,clip));assert.equal(history.canUndo(),false);assert.equal(history.canRedo(),true);
 assert.throws(()=>C.pasteBar(p,id,0,clip,{replace:'true'}),/Pilihan tampalan/);
 assert.throws(()=>C.pasteBar(p,id,0,clip,{replace:false,other:true}),/Medan/);
 assert.throws(()=>C.pasteBar(p,id,0,clip,null),/Medan/);
 assert.equal(JSON.stringify(p),before);
});

test('bar compatibility is exact for all eight instruments with named percussion and no fabricated pitches',()=>{
 const C=core();
 for(const instrumentId of Object.keys(C.INSTRUMENTS)){
  const p=withEvent(C,instrumentId),id=p.tracks[0].id,clip=C.copyBar(p,id,0),next=C.pasteBar(freeze(p),id,1,freeze(clip));
  assert.equal(next.tracks[0].events.length,2);assert.equal(next.tracks[0].events[1].tick,96);assert.equal(C.validate(next).length,0);
  assert.equal(next.tracks[0].events[1].midi,p.tracks[0].events[0].midi);assert.equal(next.tracks[0].events[1].action,p.tracks[0].events[0].action);
  if(!C.INSTRUMENTS[instrumentId].pitched)assert.equal(next.tracks[0].events[1].midi,null);
  for(const other of Object.keys(C.INSTRUMENTS).filter(value=>value!==instrumentId)){
   const target=withTrack(C,other),targetId=target.tracks[0].id;
   assert.throws(()=>C.pasteBar(target,targetId,0,clip),/tidak serasi/,instrumentId+' to '+other);
  }
 }
 const x=withEvent(C,'xylophone',{midi:72}),r=withTrack(C,'recorder');
 assert.throws(()=>C.pasteBar(r,r.tracks[0].id,0,C.copyBar(x,x.tracks[0].id,0)),/tidak serasi/);
});

test('paste rejects project-end overflow atomically and supports an exact final tick without shortening gates',()=>{
 const C=core();let p=withEvent(C,'recorder',{tick:300,durationTick:6},{lengthBars:4}),id=p.tracks[0].id;
 const clipboard={schema:C.BAR_SCHEMA,instrumentId:'recorder',events:[{tick:0,durationTick:120,midi:72,action:null,velocity:.8}]},before=JSON.stringify(p);
 assert.throws(()=>C.pasteBar(freeze(p),id,3,clipboard),/melebihi akhir projek/);
 assert.throws(()=>C.pasteBar(p,id,3,clipboard,{replace:true}),/melebihi akhir projek/);assert.equal(JSON.stringify(p),before);
 const fits=C.pasteBar(p,id,2,clipboard);assert.equal(fits.tracks[0].events[0].durationTick,120);assert.equal(fits.tracks[0].events[0].tick,192);
 const final={schema:C.BAR_SCHEMA,instrumentId:'recorder',events:[{tick:95,durationTick:1,midi:98,action:null,velocity:0}]};
 const end=C.pasteBar(p,id,3,final);assert.equal(end.tracks[0].events.at(-1).tick,383);assert.equal(end.tracks[0].events.at(-1).durationTick,1);
 final.events[0].durationTick=2;assert.throws(()=>C.pasteBar(p,id,3,final),/melebihi akhir projek/);
});

test('bar clipboard input rejects invalid JSON shapes, editable values and unbounded or forged source fields',()=>{
 const C=core(),p=withEvent(C,'xylophone'),id=p.tracks[0].id,original=plain(C.copyBar(p,id,0)),before=JSON.stringify(p);
 for(const value of [null,undefined,[],true,42,'{}'])assert.throws(()=>C.pasteBar(p,id,0,value),{name:'Error'});
 const cases=[
  clip=>clip.schema='other',clip=>delete clip.schema,clip=>delete clip.instrumentId,clip=>clip.instrumentId='constructor',
  clip=>clip.events=null,clip=>delete clip.events,clip=>clip.events=[null],clip=>clip.events=new Array(1),
  clip=>clip.events[0].id='fake-id',clip=>clip.raw_capture=[],clip=>clip.sourceTake={},clip=>clip.raw_audio='AAAA',
  clip=>clip.events[0].tick=-1,clip=>clip.events[0].tick=96,clip=>clip.events[0].tick=.5,clip=>clip.events[0].tick=NaN,
  clip=>clip.events[0].durationTick=0,clip=>clip.events[0].durationTick=3073,
  clip=>{clip.events[0].tick=95;clip.events[0].durationTick=3072;},
  clip=>clip.events[0].midi=0,clip=>clip.events[0].midi=128,clip=>clip.events[0].midi='60',clip=>clip.events[0].action='tap',
  clip=>clip.events[0].velocity=-.1,clip=>clip.events[0].velocity=1.1,clip=>clip.events[0].velocity=NaN,clip=>clip.events[0].velocity=Infinity,
  clip=>delete clip.events[0].velocity,clip=>clip.source=null,clip=>clip.source='original',
  clip=>clip.source.projectId='x'.repeat(101),clip=>clip.source.trackId=' ',clip=>clip.source.barIndex=-1,clip=>clip.source.barIndex=32,
  clip=>clip.source.barIndex='0',clip=>delete clip.source.projectId,clip=>clip.source.raw_capture=[],clip=>clip.source.audioBuffer=[1,2],
  clip=>clip.events[0].source={raw_ms:0},clip=>clip.events[0].durationTick=BigInt(6),clip=>clip.source.projectId=()=>1
 ];
 for(const mutate of cases){const bad=plain(original);mutate(bad);assert.throws(()=>C.pasteBar(p,id,0,bad),{name:'Error'},mutate.toString());}
 const cyclic=plain(original);cyclic.source.projectId=cyclic;assert.throws(()=>C.pasteBar(p,id,0,cyclic),/dirinya sendiri/);
 const huge=plain(original);huge.events=Array.from({length:513},()=>plain(original.events[0]));assert.throws(()=>C.pasteBar(p,id,0,huge),/512/);
 const perc=withEvent(C,'tamborin'),percussion=plain(C.copyBar(perc,perc.tracks[0].id,0));
 for(const mutate of [clip=>clip.events[0].midi=NaN,clip=>clip.events[0].midi=60,clip=>clip.events[0].action='other']){
  const bad=plain(percussion);mutate(bad);assert.throws(()=>C.pasteBar(perc,perc.tracks[0].id,0,bad));
 }
 assert.equal(JSON.stringify(p),before);
});

test('bar operations validate zero-based bar and track selection without changing the project',()=>{
 const C=core(),p=withEvent(C,'xylophone',{}, {lengthBars:4}),id=p.tracks[0].id,clip=C.copyBar(p,id,0),before=JSON.stringify(p);
 for(const barIndex of [-1,4,32,1.5,NaN,Infinity,'0',null,undefined])for(const operation of [()=>C.copyBar(p,id,barIndex),()=>C.pasteBar(p,id,barIndex,clip),()=>C.clearBar(p,id,barIndex)])assert.throws(operation,/Bar mesti/);
 for(const operation of [()=>C.copyBar(p,'missing',0),()=>C.pasteBar(p,'missing',0,clip),()=>C.clearBar(p,'missing',0)])assert.throws(operation,/Trek tidak ditemui/);
 assert.equal(JSON.stringify(p),before);
});

test('bar pasting enforces the post-replacement event limit and rejects overflow before clearing',()=>{
 const C=core(),p=plain(withTrack(C,'xylophone',{lengthBars:4})),id=p.tracks[0].id;
 p.tracks[0].events=Array.from({length:512},(_,index)=>({id:'full-'+index,tick:index%96,durationTick:1,midi:60,action:null,velocity:.8}));
 const clip=C.copyBar(p,id,0),single={schema:C.BAR_SCHEMA,instrumentId:'xylophone',events:[clip.events[0]]},before=JSON.stringify(p);
 assert.throws(()=>C.pasteBar(freeze(p),id,1,single),/512/);assert.equal(JSON.stringify(p),before);
 const replaced=C.pasteBar(p,id,0,freeze(clip),{replace:true});assert.equal(replaced.tracks[0].events.length,512);
 const oldIds=new Set(p.tracks[0].events.map(event=>event.id));assert.ok(replaced.tracks[0].events.every(event=>!oldIds.has(event.id)));
 assert.equal(new Set(replaced.tracks[0].events.map(event=>event.id)).size,512);assert.equal(C.validate(replaced).length,0);
 assert.throws(()=>C.pasteBar(p,id,1,clip,{replace:true}),/512/);assert.equal(JSON.stringify(p),before);
});

test('valid maximum-length imported track IDs support fresh event and bar identities without overflow',()=>{
 const C=core(),p=plain(withTrack(C)),longId='track-'+'a'.repeat(94);assert.equal(longId.length,100);
 p.tracks[0].id=longId;assert.equal(C.validate(p).length,0);
 const added=C.addEvent(freeze(p),longId,{tick:0}),clip=C.copyBar(added,longId,0),pasted=C.pasteBar(added,longId,1,clip);
 assert.equal(pasted.tracks[0].events.length,2);assert.ok(pasted.tracks[0].events.every(event=>event.id.length<=100));
 assert.notEqual(pasted.tracks[0].events[0].id,pasted.tracks[0].events[1].id);assert.equal(C.validate(pasted).length,0);
});

test('bar edits, quantization and undo/redo keep original recorder input evidence unchanged',()=>{
 const C=core(),X=legacy('xylo-core'),take=X.fromTaps([{midi:72,raw_ms:1000,raw_duration_ms:600,release_ms:1600},{midi:74,raw_ms:1750,raw_duration_ms:300,release_ms:2050}],80,12,2,5,'recorder');
 const initial=C.importTake(C.createProject(),take),id=initial.tracks[0].id,evidence=JSON.stringify(initial.tracks[0].sourceTake),history=C.createHistory(freeze(initial)),clip=freeze(C.copyBar(initial,id,0));
 history.commit(C.pasteBar(history.get(),id,1,clip));assert.equal(history.get().tracks[0].events.length,4);
 history.commit(C.clearBar(history.get(),id,0));assert.equal(history.get().tracks[0].events.length,2);
 const quantized=C.quantizeTrack(history.get(),id,48,.5);history.commit(quantized);assert.equal(C.validate(history.get()).length,0);
 assert.equal(JSON.stringify(history.get().tracks[0].sourceTake),evidence);assert.ok(Object.isFrozen(history.get().tracks[0].sourceTake.raw_capture[0]));
 while(history.canUndo()){const state=history.undo();assert.equal(JSON.stringify(state.tracks[0].sourceTake),evidence);assert.equal(C.validate(state).length,0);}
 assert.deepEqual(plain(history.get()),plain(initial));
 while(history.canRedo()){const state=history.redo();assert.equal(JSON.stringify(state.tracks[0].sourceTake),evidence);assert.equal(C.validate(state).length,0);}
 assert.deepEqual(plain(history.get()),plain(quantized));assert.equal('raw_capture'in clip,false);
});
