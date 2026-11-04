const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
const key='e-instru-percussion-v1:tamborin';
const read=s=>JSON.parse(s.saved.get(key));
async function open(options={}){const s=studio({percussion:true,...options});await s.ids.get('chooseTamborin').fire('click');return s;}
test('Tamborin starts empty, enters and returns through the real selector',async()=>{
 const s=await open();assert.equal(s.ids.get('tamborinView').hidden,false);assert.equal(s.ids.get('studioView').hidden,true);assert.equal(s.ids.get('percCount').textContent,'0');assert.match(s.ids.get('percTrace').textContent,/Belum ada/);assert.equal(s.ids.get('percReplay').disabled,true);await s.ids.get('percBack').fire('click');assert.equal(s.ids.get('instrumentChooser').hidden,false);assert.equal(s.ids.get('tamborinView').hidden,true);
});
test('manual recording stores actual actions and zero-based raw time; demo and metronome never enter it',async()=>{
 const s=await open();await s.ids.get('percExample').fire('click');s.advance(800);await s.ids.get('percStop').fire('click');assert.equal(s.ids.get('percCount').textContent,'0');s.ids.get('percMetro').checked=true;await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown',{pointerId:1});s.advance(475);await s.ids.get('percShake').fire('pointerdown',{pointerId:2});await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>[e.action,e.raw_ms]),[['tap',0],['shake',475]]);assert.equal(read(s).raw_capture.length,2);const before=JSON.stringify(read(s));await s.ids.get('percReplay').fire('click');s.advance(1500);assert.equal(JSON.stringify(read(s)),before);
});
test('keyboard ignores held keys, typing, modifiers and native Space clicks',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.dispatch('keydown',{key:' ',code:'Space'});await s.dispatch('keydown',{key:' ',code:'Space',repeat:true});await s.dispatch('keydown',{key:'g',repeat:true});await s.dispatch('keyup',{key:' ',code:'Space'});await s.dispatch('keydown',{key:'g',target:{tagName:'INPUT'}});await s.dispatch('keydown',{key:'g',target:{tagName:'DIV',isContentEditable:true}});await s.dispatch('keydown',{key:'g',ctrlKey:true});await s.dispatch('keydown',{key:'g'});await s.dispatch('keyup',{key:'g'});await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>e.action),['tap','shake']);
});
test('tempo and Reset keep recorded evidence and edited actions intact',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percSurface').fire('pointerdown',{pointerId:1});s.advance(350);await s.ids.get('percShake').fire('pointerdown',{pointerId:2});assert.equal(s.ids.get('percTempo').disabled,true);await s.ids.get('percStop').fire('click');const raw=JSON.stringify(read(s).raw_capture);s.ids.get('percTempo').value='160';await s.ids.get('percTempo').fire('input');assert.equal(read(s).bpm,160);assert.equal(JSON.stringify(read(s).raw_capture),raw);await s.ids.get('percReset').fire('click');assert.equal(s.ids.get('percTempo').value,80);assert.equal(JSON.stringify(read(s).raw_capture),raw);assert.equal(read(s).events.length,2);assert.equal(s.ids.get('percMetro').checked,false);
});
test('Stop cancels a pending audio activation before any delayed voice can play',async()=>{
 const s=await open();const pending=s.ids.get('percExample').fire('click');await s.ids.get('percStop').fire('click');await pending;await s.settle();s.advance(2000);assert.equal(s.oscillators.length,0);assert.equal(s.ids.get('percStop').disabled,true);
});
test('navigation and page changes cancel percussion but preserve both instrument recordings',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown',{pointerId:1});await s.ids.get('percBack').fire('click');const own=JSON.stringify(read(s));await s.ids.get('chooseXylophone').fire('click');assert.equal(s.ids.get('studioView').hidden,false);assert.equal(s.ids.get('statNotes').textContent,'13');await s.ids.get('changeInstrumentBtn').fire('click');await s.ids.get('chooseTamborin').fire('click');assert.equal(JSON.stringify(read(s)),own);await s.ids.get('percExample').fire('click');s.document.hidden=true;await s.dispatch('visibilitychange');assert.equal(s.ids.get('percStop').disabled,true);await s.windowEvent('pagehide');assert.equal(JSON.stringify(read(s)),own);
});
test('storage errors leave the performed take available for playback/export',async()=>{
 const s=await open({storageError:true});await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown',{pointerId:3});await s.ids.get('percStop').fire('click');assert.equal(s.ids.get('percReplay').disabled,false);assert.equal(s.ids.get('percExportJson').disabled,false);assert.equal(s.saved.has(key),false);assert.match(s.ids.get('percSave').textContent,/tidak tersedia/);await s.ids.get('percExportJson').fire('click');assert.equal(s.downloads.length,1);assert.deepEqual(JSON.parse(await s.blobs.at(-1).text()).events.map(e=>[e.action,e.raw_ms]),[['tap',0]]);
});

test('pointerdown followed by the normal mouse click records exactly one action',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');
 for(const id of ['percSurface','percTap','percShake']){await s.ids.get(id).fire('pointerdown',{pointerId:1});await s.ids.get(id).fire('click',{detail:1});}
 await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>e.action),['tap','tap','shake']);
});
test('Space on transport controls retains native button behavior and editable fields ignore both shortcuts',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');
 const space=await s.dispatch('keydown',{key:' ',target:s.ids.get('percStop')});assert.equal(space.defaultPrevented,false);
 for(const tagName of ['INPUT','TEXTAREA','SELECT'])for(const key of [' ','g'])await s.dispatch('keydown',{key,target:{tagName}});
 await s.dispatch('keydown',{key:' ',target:s.ids.get('percSurface')});await s.dispatch('keyup',{key:' '});await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>e.action),['tap']);
});
test('Enter on the focused surface suppresses native click and held Enter does not record twice',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');const el=s.ids.get('percSurface');
 const event=await el.fire('keydown',{key:'Enter'});assert.equal(event.defaultPrevented,true);await el.fire('keydown',{key:'Enter',repeat:true});await s.dispatch('keyup',{key:'Enter'});await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>e.action),['tap']);
});
test('edited percussion actions and onsets survive tempo changes and Reset with raw evidence unchanged',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown');s.advance(350);await s.ids.get('percShake').fire('pointerdown');await s.ids.get('percStop').fire('click');const evidence=JSON.stringify(read(s).raw_capture);
 let first=s.ids.get('percRows').children[0];first.querySelector('select').value='shake';await first.querySelector('select').fire('change');first=s.ids.get('percRows').children[0];first.querySelector('input').value='125';await first.querySelector('input').fire('change');
 s.ids.get('percTempo').value='160';await s.ids.get('percTempo').fire('input');await s.ids.get('percReset').fire('click');assert.deepEqual(read(s).events.map(e=>[e.action,e.at_ms]),[['shake',125],['shake',350]]);assert.equal(JSON.stringify(read(s).raw_capture),evidence);
});
test('invalid tempo inputs leave current score and evidence intact while both boundaries remain playable',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown');s.advance(400);await s.ids.get('percShake').fire('pointerdown');await s.ids.get('percStop').fire('click');const evidence=JSON.stringify(read(s).raw_capture);
 for(const value of ['39','201','NaN','40.5']){s.ids.get('percTempo').value=value;await s.ids.get('percTempo').fire('input');assert.equal(read(s).bpm,80);assert.equal(JSON.stringify(read(s).raw_capture),evidence);}
 for(const bpm of [40,200]){s.ids.get('percTempo').value=String(bpm);await s.ids.get('percTempo').fire('input');assert.equal(read(s).bpm,bpm);await s.ids.get('percReplay').fire('click');assert.equal(s.ids.get('percStop').disabled,false);await s.ids.get('percStop').fire('click');assert.equal(JSON.stringify(read(s).raw_capture),evidence);}
});
test('enabling and disabling metronome during recording cannot create or alter user actions',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown');s.ids.get('percMetro').checked=true;await s.ids.get('percMetro').fire('change');s.advance(1500);assert.equal(read(s).events.length,1);s.ids.get('percMetro').checked=false;await s.ids.get('percMetro').fire('change');await s.ids.get('percShake').fire('pointerdown');await s.ids.get('percStop').fire('click');assert.deepEqual(read(s).events.map(e=>[e.action,e.raw_ms]),[['tap',0],['shake',1500]]);assert.equal(s.activeIntervals(),0);
});
test('a manual hit awaiting a suspended AudioContext cannot sound after Stop',async()=>{
 const s=await open({audioState:'suspended',deferResume:true});await s.ids.get('percTap').fire('pointerdown');assert.equal(s.ids.get('percStop').disabled,false,'Henti must be usable while audio activation is pending');await s.ids.get('percStop').fire('click');s.resumeAudio();await s.settle();assert.equal(s.oscillators.length,0);assert.equal(s.ids.get('percCount').textContent,'0');assert.equal(s.activeIntervals(),0);
});
test('recording is bounded to 180 seconds without deleting its already captured actions',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown');s.advance(180025);assert.equal(s.ids.get('percStop').disabled,true);assert.deepEqual(read(s).events.map(e=>[e.action,e.raw_ms]),[['tap',0]]);assert.equal(s.ids.get('percReplay').disabled,false);assert.equal(s.activeIntervals(),0);
});

test('Henti remains usable while standalone metronome waits for suspended audio activation',async()=>{
 const s=await open({audioState:'suspended',deferResume:true});s.ids.get('percMetro').checked=true;const pending=s.ids.get('percMetro').fire('change');await s.settle();assert.equal(s.ids.get('percStop').disabled,false,'Henti must be usable while metronome audio activation is pending');await s.ids.get('percStop').fire('click');s.resumeAudio();await pending;await s.settle();s.advance(1000);assert.equal(s.oscillators.length,0);assert.equal(s.activeIntervals(),0);
});

test('trace audition releases its voice and returns Henti to idle after the sound tail',async()=>{
 const s=await open();await s.ids.get('percRecord').fire('click');await s.ids.get('percTap').fire('pointerdown');await s.ids.get('percStop').fire('click');const count=s.oscillators.length;await s.ids.get('percTrace').children[0].fire('click');await s.settle();assert.ok(s.oscillators.length>count);s.advance(1000);assert.equal(s.ids.get('percStop').disabled,true);assert.equal(s.activeIntervals(),0);assert.equal(read(s).events.length,1);
});
