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
