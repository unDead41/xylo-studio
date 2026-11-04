const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
const plain=x=>JSON.parse(JSON.stringify(x));
test('soprano pads sound C5 to C6 and Baroque F is cross fingered',()=>{
 const {C}=studio();assert.ok(C.INSTRUMENTS?.recorder);
 assert.deepEqual(plain(C.instrumentNotes('recorder').map(n=>n.midi)),[72,74,76,77,79,81,83,84]);
 assert.deepEqual(plain(C.fingering(77)),[1,1,1,1,1,0,1,1]);
 assert.deepEqual(plain(C.fingering(84)),[1,0,1,0,0,0,0,0]);
 assert.equal(C.fingering(70),null);
});
test('legacy takes and raw evidence round trip as xylophone',()=>{
 const {C}=studio(),old=C.fromTaps([{midi:60,raw_ms:0},{midi:62,raw_ms:750}]);delete old.instrument_id;
 const t=C.importTake(JSON.stringify(old));assert.equal(t.instrument_id,'xylophone');assert.deepEqual(plain(t.events),plain(old.events));
});
test('held recorder notes retain release evidence separately from onset grid',()=>{
 const {C}=studio(),t=C.fromTaps([{midi:72,raw_ms:100,raw_duration_ms:420,release_ms:520},{midi:74,raw_ms:850,raw_duration_ms:260,release_ms:1110}],80,12,2,5,'recorder');
 assert.equal(t.instrument_id,'recorder');assert.equal(t.events[0].gate_tick,13);
 assert.equal(t.events[0].duration_tick,24);assert.equal(t.raw_capture[0].release_ms,420);
 const before=plain(t.raw_capture),q=C.requantize(t,24);assert.deepEqual(plain(q.raw_capture),before);
 assert.deepEqual(plain(C.importTake(JSON.stringify(t)).raw_capture),before);
 assert.match(C.csv(t),/instrument_id/);assert.match(C.csv(t),/raw_duration_ms/);
});
test('recorder range check identifies every unplayable pitch without changing score',()=>{
 const {C}=studio(),t=C.preset(6,5,'long','recorder'),before=JSON.stringify(t.events);
 assert.deepEqual(plain(C.unsupportedPitches(t,'recorder')),[67]);
 assert.equal(JSON.stringify(t.events),before);
 assert.deepEqual(plain(C.unsupportedPitches(C.preset(131,5,'long','recorder'),'recorder')),[]);
});
test('recordings, edits and instrument identities survive round trips through chooser',async()=>{
 const s=studio(),pick=s.ids.get('chooseRecorder');assert.ok(pick);await pick.fire('click');
 assert.equal(s.ids.get('instrumentHeading').textContent,'Rekoder Soprano anda');
 s.ids.get('takeTitle').value='Latihan rekoder';await s.ids.get('takeTitle').fire('change');
 await s.ids.get('changeInstrumentBtn').fire('click');await s.ids.get('chooseXylophone').fire('click');
 assert.notEqual(s.ids.get('takeTitle').value,'Latihan rekoder');
 await s.ids.get('changeInstrumentBtn').fire('click');await pick.fire('click');assert.equal(s.ids.get('takeTitle').value,'Latihan rekoder');
 const saved=JSON.parse(s.saved.get('xylo-studio-v2'));assert.equal(saved.instruments.recorder.take.instrument_id,'recorder');
 assert.equal(s.ids.get('micBtn').disabled,true);
});
test('release before asynchronous audio startup prevents a stale held note',async()=>{
 const s=studio({chooser:true});await s.ids.get('chooseRecorder').fire('click');const pad=s.ids.get('recorderPads').children[0];
 const pending=pad.fire('pointerdown',{pointerId:10});await pad.fire('pointercancel',{pointerId:10});await pending;await s.settle();assert.equal(s.oscillators.length,0);assert.equal(pad.getAttribute('aria-pressed'),'false');
});
test('held keyboard input records one gate and stops on blur or instrument change',async()=>{
 const s=studio({chooser:true});await s.ids.get('chooseRecorder').fire('click');await s.ids.get('recordBtn').fire('click');
 await s.dispatch('keydown',{key:'a'});await s.dispatch('keydown',{key:'a',repeat:true});s.setNow(1500);await s.dispatch('keyup',{key:'a'});await s.ids.get('stopBtn').fire('click');
 let t=JSON.parse(s.saved.get('xylo-studio-v2')).take;assert.equal(t.events.length,1);assert.equal(t.raw_capture[0].raw_duration_ms,500);assert.equal(t.events[0].gate_tick,16);
 await s.dispatch('keydown',{key:'s'});await s.settle();assert.equal(s.ids.get('recorderPads').children[1].getAttribute('aria-pressed'),'true');await s.dispatchWindow('blur');assert.equal(s.ids.get('recorderPads').children[1].getAttribute('aria-pressed'),'false');assert.ok(s.oscillators.every(x=>x.stopCalled));
 await s.dispatch('keydown',{key:'d'});await s.ids.get('changeInstrumentBtn').fire('click');await s.ids.get('chooseXylophone').fire('click');await s.settle();assert.ok(s.oscillators.every(x=>x.stopCalled));
});
test('out of range catalog playback is disabled, while extension pitches remain available',async()=>{
 const s=studio({chooser:true});await s.ids.get('chooseRecorder').fire('click');await s.ids.get('songGrid').children.find(b=>b.dataset.song==='6').fire('click');assert.equal(s.ids.get('playBtn').disabled,true);assert.match(s.ids.get('recorderRangeWarning').textContent,/G4/);
 await s.ids.get('songGrid').children.find(b=>b.dataset.song==='131').fire('click');assert.equal(s.ids.get('playBtn').disabled,false);assert.ok(s.ids.get('extendedPads').children.some(b=>b.dataset.midi==='82'));
});
test('invalid gate or instrument metadata is rejected instead of dropped on import',()=>{
 const {C}=studio(),t=C.fromTaps([{midi:72,raw_ms:0,raw_duration_ms:500}],80,12,2,5,'recorder');t.events[0].gate_tick=-1;assert.throws(()=>C.importTake(JSON.stringify(t)),/Tempoh/);delete t.events[0].gate_tick;t.instrument_id='unknown';assert.throws(()=>C.importTake(JSON.stringify(t)),/Instrumen/);
});
test('a held note extending beyond the following onset is not cut off by score end',()=>{
 const {C}=studio(),t=C.fromTaps([{midi:72,raw_ms:0,raw_duration_ms:5000},{midi:74,raw_ms:750,raw_duration_ms:200}],80,12,2,5,'recorder');assert.ok(t.end_tick>=160);assert.equal(C.validate(t).length,0);
});
test('reloading an empty recorder take preserves the other instrument recording',async()=>{
 const initial=studio(),xylo=initial.C.fromTaps([{midi:60,raw_ms:0},{midi:62,raw_ms:743}]);xylo.title='KEEP XYLO TAKE';
 const first=studio({variant:null,chooser:true,storage:{'xylo-studio-v2':JSON.stringify({take:xylo,lastCustom:xylo})}});
 await first.ids.get('chooseRecorder').fire('click');await first.ids.get('recordBtn').fire('click');await first.ids.get('stopBtn').fire('click');
 const envelope=first.saved.get('xylo-studio-v2'),again=studio({variant:null,chooser:true,storage:{'xylo-studio-v2':envelope}});
 await again.ids.get('chooseXylophone').fire('click');assert.equal(again.ids.get('takeTitle').value,'KEEP XYLO TAKE');
 const restored=JSON.parse(again.saved.get('xylo-studio-v2'));assert.deepEqual(plain(restored.take.raw_capture),plain(xylo.raw_capture));assert.equal(restored.instruments.recorder.take.events.length,0);assert.equal(restored.instruments.recorder.take.instrument_id,'recorder');
});
test('a malformed active envelope does not overwrite a separately valid saved workspace',async()=>{
 const {C}=studio(),xylo=C.fromTaps([{midi:60,raw_ms:0},{midi:62,raw_ms:743}]);xylo.title='RECOVER VALID WORKSPACE';
 const s=studio({variant:null,chooser:true,storage:{'xylo-studio-v2':JSON.stringify({take:{schema:'invalid',events:[]},instruments:{xylophone:{take:xylo,lastCustom:xylo,selectedVariant:'long'}}})}});
 await s.ids.get('chooseXylophone').fire('click');assert.equal(s.ids.get('takeTitle').value,'RECOVER VALID WORKSPACE');assert.equal(JSON.parse(s.saved.get('xylo-studio-v2')).take.events.length,2);
});
async function auditionStudio(){const base=studio(),take=base.C.fromTaps([{midi:72,raw_ms:0,raw_duration_ms:5000}],80,12,2,5,'recorder');const s=studio({variant:null,chooser:true,storage:{'xylo-studio-v2':JSON.stringify({take})}});await s.ids.get('chooseRecorder').fire('click');await s.ids.get('timeline').querySelectorAll('.event')[0].fire('click');await s.settle();return s;}
test('a sustained timeline audition exposes a working Stop control',async()=>{
 const s=await auditionStudio();assert.equal(s.ids.get('stopBtn').disabled,false);await s.ids.get('stopBtn').fire('click');assert.equal(s.ids.get('stopBtn').disabled,true);assert.ok(s.oscillators.every(o=>o.stopped===undefined));
});
test('starting a recording cancels the preceding sustained audition',async()=>{
 const s=await auditionStudio(),prior=s.oscillators.slice();await s.ids.get('recordBtn').fire('click');assert.ok(prior.every(o=>o.stopped===undefined));assert.equal(s.ids.get('statNotes').textContent,'0');
});
test('starting score playback cancels the preceding sustained audition',async()=>{
 const s=await auditionStudio(),prior=s.oscillators.slice();await s.ids.get('playBtn').fire('click');assert.ok(prior.every(o=>o.stopped===undefined));assert.equal(s.ids.get('playLabel').textContent,'Henti score');
});
