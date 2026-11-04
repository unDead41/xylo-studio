const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
const pitchedKey='xylo-studio-v2',percussionKey='e-instru-percussion-v1:tamborin';
const make=options=>studio({percussion:true,chooser:true,variant:null,...options});
const click=(s,id)=>s.ids.get(id).fire('click');
const pitched=s=>JSON.parse(s.saved.get(pitchedKey));
const percussion=s=>JSON.parse(s.saved.get(percussionKey));
async function enterRecorder(s){await click(s,'chooseRecorder');assert.equal(s.ids.get('studioHeading').textContent,'Rekoder Soprano');}
async function recordRecorder(s){
 await enterRecorder(s);await click(s,'recordBtn');await s.dispatch('keydown',{key:'a'});s.advance(500);await s.dispatch('keyup',{key:'a'});s.advance(250);await s.dispatch('keydown',{key:'s'});s.advance(250);await s.dispatch('keyup',{key:'s'});await click(s,'stopBtn');
}
async function enterTamborinFromPitched(s){await click(s,'changeInstrumentBtn');assert.equal(s.ids.get('instrumentChooser').hidden,false);await click(s,'chooseTamborin');assert.equal(s.ids.get('tamborinView').hidden,false);}

test('recorder title, edited gate and raw onset/release evidence survive Tamborin and Xylophone workspaces',async()=>{
 const s=make();await recordRecorder(s);s.ids.get('takeTitle').value='Latihan rekoder kelas';await s.ids.get('takeTitle').fire('change');
 await s.ids.get('eventRows').children[0].querySelector('button').fire('click');s.ids.get('editPitch').value='72';s.ids.get('editTick').value='0';s.ids.get('editGate').value='20';await s.ids.get('editForm').fire('submit');
 const expected=pitched(s).take;assert.equal(expected.events[0].gate_tick,20);assert.equal(expected.raw_capture[0].raw_duration_ms,500);assert.equal(expected.raw_capture[1].raw_ms,750);
 await enterTamborinFromPitched(s);await click(s,'percRecord');await s.ids.get('percTap').fire('pointerdown');s.advance(375);await s.ids.get('percShake').fire('pointerdown');await click(s,'percStop');const tamborinBefore=percussion(s);
 await click(s,'percBack');await click(s,'chooseXylophone');assert.equal(s.ids.get('studioHeading').textContent,'Xylophone');s.ids.get('takeTitle').value='Lagu Xylophone kelas';await s.ids.get('takeTitle').fire('change');
 await click(s,'changeInstrumentBtn');await click(s,'chooseRecorder');assert.deepEqual(pitched(s).take,expected);assert.equal(s.ids.get('takeTitle').value,'Latihan rekoder kelas');
 await enterTamborinFromPitched(s);assert.deepEqual(percussion(s),tamborinBefore);await click(s,'percBack');await click(s,'chooseXylophone');assert.equal(s.ids.get('takeTitle').value,'Lagu Xylophone kelas');assert.deepEqual(pitched(s).instruments.recorder.take,expected);
});

test('Tamborin Space/G input cannot sound hidden recorder pads or write pitched recording events',async()=>{
 const s=make();await recordRecorder(s);const recorderBefore=pitched(s).take;await enterTamborinFromPitched(s);await click(s,'percRecord');const voicesBefore=s.oscillators.length;
 await s.dispatch('keydown',{key:' '});await s.dispatch('keyup',{key:' '});s.advance(250);await s.dispatch('keydown',{key:'g'});await s.dispatch('keyup',{key:'g'});await s.settle();await click(s,'percStop');
 assert.deepEqual(percussion(s).events.map(e=>[e.action,e.raw_ms]),[['tap',0],['shake',250]]);assert.deepEqual(pitched(s).take,recorderBefore);
 const recorderHz=[72,74,76,77,79,81,83,84].flatMap(midi=>[1,2,3].map(partial=>s.C.freq(midi)*partial));assert.ok(s.oscillators.slice(voicesBefore).every(voice=>!voice.frequency||!recorderHz.some(hz=>Math.abs(voice.frequency.value-hz)<.001)));
});

test('Tamborin Space/G input cannot activate hidden Xylophone bars',async()=>{
 const s=make();await click(s,'chooseXylophone');const before=pitched(s).take;await enterTamborinFromPitched(s);const voicesBefore=s.oscillators.length;await s.dispatch('keydown',{key:' '});await s.dispatch('keyup',{key:' '});await s.dispatch('keydown',{key:'g'});await s.dispatch('keyup',{key:'g'});await s.settle();
 const xylophoneHz=[60,62,64,65,67,69,71,72].flatMap(midi=>[1,3].map(partial=>s.C.freq(midi)*partial));assert.ok(s.oscillators.slice(voicesBefore).every(voice=>!voice.frequency||!xylophoneHz.some(hz=>Math.abs(voice.frequency.value-hz)<.001)));assert.deepEqual(pitched(s).take,before);assert.equal(s.ids.get('studioView').hidden,true);
});

test('Tamborin to Game to Studio restores Tamborin and stops the completed game scheduler',async()=>{
 const s=make();await click(s,'chooseTamborin');await click(s,'percRecord');await s.ids.get('percTap').fire('pointerdown');await click(s,'percStop');const before=percussion(s);
 await click(s,'gameModeBtn');assert.equal(s.ids.get('tamborinView').hidden,true);assert.equal(s.ids.get('gameView').hidden,false);await click(s,'gameStartBtn');s.advance(300);assert.ok(s.activeIntervals()>0);
 await click(s,'studioModeBtn');assert.equal(s.ids.get('tamborinView').hidden,false);assert.equal(s.ids.get('gameView').hidden,true);assert.equal(s.ids.get('studioView').hidden,true);assert.equal(s.activeIntervals(),0);assert.deepEqual(percussion(s),before);
 const voices=s.oscillators.length;s.advance(5000);assert.equal(s.oscillators.length,voices);assert.equal(s.ids.get('gameResult').hidden,true);
});

test('returning from Game through Studio to the chooser leaves no scheduled game or percussion work',async()=>{
 const s=make();await click(s,'chooseTamborin');await click(s,'percExample');await click(s,'gameModeBtn');await click(s,'gameStartBtn');s.advance(400);await click(s,'studioModeBtn');await click(s,'percBack');assert.equal(s.ids.get('instrumentChooser').hidden,false);assert.equal(s.ids.get('gameView').hidden,true);assert.equal(s.ids.get('tamborinView').hidden,true);assert.equal(s.activeIntervals(),0);
 const count=s.oscillators.length;s.advance(20000);assert.equal(s.oscillators.length,count);assert.equal(s.ids.get('percStop').disabled,true);
});

test('switching to Tamborin cancels a pending recorder voice before AudioContext resumes',async()=>{
 const s=make({audioState:'suspended',deferResume:true});await enterRecorder(s);await s.ids.get('recorderPads').children[0].fire('pointerdown',{pointerId:7});await enterTamborinFromPitched(s);s.resumeAudio();await s.settle();s.advance(500);assert.equal(s.oscillators.length,0);assert.equal(s.ids.get('recorderPads').children[0].getAttribute('aria-pressed'),'false');
 await s.dispatch('keydown',{key:'g'});await s.dispatch('keyup',{key:'g'});await s.settle();assert.ok(s.oscillators.length>0);assert.equal(s.ids.get('tamborinView').hidden,false);await click(s,'percBack');await click(s,'chooseRecorder');assert.equal(s.ids.get('studioHeading').textContent,'Rekoder Soprano');
});
