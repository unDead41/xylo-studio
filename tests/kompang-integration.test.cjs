const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
const KEY='e-instru-percussion-v1:kompang',TAMB='e-instru-percussion-v1:tamborin',PITCHED='xylo-studio-v2';
const click=(s,id)=>s.ids.get(id).fire('click');
const take=(s,key=KEY)=>JSON.parse(s.saved.get(key));
const make=options=>studio({percussion:true,chooser:true,variant:null,...options});
async function open(options){const s=make(options);assert.ok(s.ids.has('kompangView'),'Playable Kompang needs its own real view');await click(s,'chooseKompang');return s;}
async function recordTwo(s){await click(s,'kompRecord');await s.ids.get('kompCenter').fire('pointerdown',{pointerId:1});s.advance(375);await s.ids.get('kompEdge').fire('pointerdown',{pointerId:2});await click(s,'kompStop');}
async function key(s,value,extra={}){const e=await s.dispatch('keydown',{key:value,...extra});await s.dispatch('keyup',{key:value,...extra});return e;}

test('Kompang enters empty through the fourth card and returns through its own Back control',async()=>{
 const s=await open();assert.equal(s.ids.get('kompangView').hidden,false);assert.equal(s.ids.get('tamborinView').hidden,true);assert.equal(s.ids.get('studioView').hidden,true);assert.equal(s.ids.get('kompCount').textContent,'0');assert.match(s.ids.get('kompTrace').textContent,/Belum ada/);assert.equal(s.ids.get('kompReplay').disabled,true);assert.equal(s.oscillators.length,0);
 await click(s,'kompBack');assert.equal(s.ids.get('instrumentChooser').hidden,false);assert.equal(s.ids.get('kompangView').hidden,true);assert.equal(s.activeIntervals(),0);
});

test('center and edge zones preserve Kompang identity and fractional raw input intervals without duplicate mouse clicks',async()=>{
 const s=await open();await click(s,'kompRecord');s.setNow(1072.125);await s.ids.get('kompCenter').fire('pointerdown',{pointerId:3});await s.ids.get('kompCenter').fire('click',{detail:1});s.setNow(1489.625);await s.ids.get('kompEdge').fire('pointerdown',{pointerId:4,pointerType:'touch'});await s.ids.get('kompEdge').fire('click',{detail:1});await click(s,'kompStop');
 const t=take(s);assert.equal(t.instrument,'kompang');assert.equal(t.schema,'e-instru-percussion-take/v1');assert.equal(t.sound_source,'digital_synthesis');assert.deepEqual(t.events.map(e=>[e.action,e.raw_ms]),[['center',0],['edge',417.5]]);assert.deepEqual(t.raw_capture.map(e=>[e.action,e.raw_ms]),[['center',0],['edge',417.5]]);assert.equal(JSON.stringify(t).includes('midi'),false);assert.equal(s.saved.has(TAMB),false);
 assert.deepEqual(s.ids.get('kompTrace').children.map(el=>[el.dataset.action,el.getAttribute('data-secondary')]),[['center','false'],['edge','true']]);
});

test('F and J shortcuts reject repeat, held keys, typing, modifiers, composition and open dialogs',async()=>{
 const s=await open();await click(s,'kompRecord');await s.dispatch('keydown',{key:'f'});await s.dispatch('keydown',{key:'f'});await s.dispatch('keydown',{key:'f',repeat:true});await s.dispatch('keyup',{key:'f'});
 for(const tagName of ['INPUT','TEXTAREA','SELECT'])for(const value of ['f','j'])await key(s,value,{target:{tagName}});
 for(const extra of [{ctrlKey:true},{metaKey:true},{altKey:true},{isComposing:true},{target:{tagName:'DIV',isContentEditable:true}}])for(const value of ['f','j'])await key(s,value,extra);
 s.ids.get('kompReplaceDialog').showModal();await key(s,'j');s.ids.get('kompReplaceDialog').close();await key(s,'J');await key(s,'g');await key(s,' ');await click(s,'kompStop');assert.deepEqual(take(s).events.map(e=>e.action),['center','edge']);
});

test('focused zones and action buttons use Space/Enter once and transport Space keeps native behavior',async()=>{
 const s=await open();await click(s,'kompRecord');
 for(const [id,value]of [['kompCenter',' '],['kompEdge','Enter'],['kompTap','Enter'],['kompShake',' ']]){const el=s.ids.get(id),e=await el.fire('keydown',{key:value});assert.equal(e.defaultPrevented,true);await el.fire('keydown',{key:value,repeat:true});await s.dispatch('keyup',{key:value});}
 const e=await s.dispatch('keydown',{key:' ',target:s.ids.get('kompStop')});assert.equal(e.defaultPrevented,false);await click(s,'kompStop');assert.deepEqual(take(s).events.map(e=>e.action),['center','edge','center','edge']);
});

test('standalone examples and metronome do not manufacture input; replay and trace keep both action types',async()=>{
 const s=await open();for(const kind of ['basic','alternate','offbeat','march']){s.ids.get('kompPattern').value=kind;await click(s,'kompExample');s.advance(800);await click(s,'kompStop');assert.equal(s.ids.get('kompCount').textContent,'0');}
 s.ids.get('kompMetro').checked=true;await s.ids.get('kompMetro').fire('change');s.advance(800);await click(s,'kompStop');assert.equal(s.ids.get('kompCount').textContent,'0');await recordTwo(s);const before=JSON.stringify(take(s));
 await click(s,'kompReplay');s.advance(200);assert.equal(s.ids.get('kompTrace').children[0].getAttribute('aria-current'),'true');s.advance(375);assert.equal(s.ids.get('kompTrace').children[1].getAttribute('aria-current'),'true');await click(s,'kompStop');
 await s.ids.get('kompTrace').children[1].fire('click');await s.settle();s.advance(1000);assert.equal(JSON.stringify(take(s)),before);assert.equal(s.activeIntervals(),0);
});

test('recording locks tempo and metronome remains outside exact manual input evidence',async()=>{
 const s=await open();await click(s,'kompRecord');await key(s,'f');assert.equal(s.ids.get('kompTempo').disabled,true);s.ids.get('kompTempo').value='160';await s.ids.get('kompTempo').fire('input');assert.equal(take(s).bpm,80);
 s.ids.get('kompMetro').checked=true;await s.ids.get('kompMetro').fire('change');s.advance(1500);await key(s,'j');s.ids.get('kompMetro').checked=false;await s.ids.get('kompMetro').fire('change');await click(s,'kompStop');assert.deepEqual(take(s).raw_capture.map(e=>[e.action,e.raw_ms]),[['center',0],['edge',1500]]);assert.equal(s.activeIntervals(),0);
});

test('edited Kompang actions and times survive tempo and Reset while raw evidence remains immutable',async()=>{
 const s=await open();await recordTwo(s);const raw=JSON.stringify(take(s).raw_capture);let row=s.ids.get('kompRows').children[0];row.querySelector('select').value='edge';await row.querySelector('select').fire('change');row=s.ids.get('kompRows').children[0];row.querySelector('input').value='125';await row.querySelector('input').fire('change');
 s.ids.get('kompTempo').value='160';await s.ids.get('kompTempo').fire('input');assert.equal(take(s).events[0].at_ms,62.5);await click(s,'kompReset');assert.deepEqual(take(s).events.map(e=>[e.action,e.at_ms]),[['edge',125],['edge',375]]);assert.equal(take(s).bpm,80);assert.equal(JSON.stringify(take(s).raw_capture),raw);assert.equal(s.ids.get('kompMetro').checked,false);
});

test('Kompang JSON and CSV exports retain instrument/actions/evidence and reject a Tamborin import',async()=>{
 const s=await open();await recordTwo(s);await click(s,'kompExportJson');const json=JSON.parse(await s.blobs.at(-1).text());assert.equal(json.instrument,'kompang');assert.deepEqual(json.events.map(e=>e.action),['center','edge']);assert.equal(s.downloads.at(-1).filename,'kompang-rakaman.json');
 await click(s,'kompExportCsv');const csv=await s.blobs.at(-1).text();assert.match(csv,/kompang,0,center,0,center,0/);assert.match(csv,/kompang,1,edge,375,edge,375/);const before=JSON.stringify(take(s));s.ids.get('kompImportText').value=JSON.stringify(s.P.createTake('tamborin'));await click(s,'kompImportBtn');assert.equal(s.ids.get('kompImportError').hidden,false);assert.equal(JSON.stringify(take(s)),before);
});

test('reloading restores independent Kompang and Tamborin evidence from their own storage keys',async()=>{
 const first=await open();await recordTwo(first);first.ids.get('kompTitle').value='Rentak kompang kelas';await first.ids.get('kompTitle').fire('change');const expected=take(first);await click(first,'kompBack');await click(first,'chooseTamborin');await click(first,'percRecord');await key(first,'g');await click(first,'percStop');const tamborin=take(first,TAMB);
 const second=await open({storage:Object.fromEntries(first.saved)});assert.equal(second.ids.get('kompTitle').value,'Rentak kompang kelas');assert.equal(second.ids.get('kompCount').textContent,'2');await click(second,'kompExportJson');assert.deepEqual(JSON.parse(await second.blobs.at(-1).text()),expected);await click(second,'kompBack');await click(second,'chooseTamborin');await click(second,'percExportJson');assert.deepEqual(JSON.parse(await second.blobs.at(-1).text()),tamborin);
});

test('repeated switches preserve independent Tamborin, Kompang and held-recorder recordings without duplicate listeners',async()=>{
 const s=make();await click(s,'chooseRecorder');await click(s,'recordBtn');await s.dispatch('keydown',{key:'a'});s.advance(500);await s.dispatch('keyup',{key:'a'});await click(s,'stopBtn');s.ids.get('takeTitle').value='Rekoder kelas';await s.ids.get('takeTitle').fire('change');const recorder=take(s,PITCHED).take;
 await click(s,'changeInstrumentBtn');await click(s,'chooseTamborin');await click(s,'percRecord');await s.ids.get('percTap').fire('pointerdown');s.advance(250);await s.ids.get('percShake').fire('pointerdown');await click(s,'percStop');const tamborin=take(s,TAMB);await click(s,'percBack');await click(s,'chooseKompang');await recordTwo(s);const kompang=take(s);
 for(let i=0;i<4;i++){await click(s,'kompBack');await click(s,'chooseTamborin');assert.deepEqual(take(s,TAMB),tamborin);await click(s,'percBack');await click(s,'chooseRecorder');assert.deepEqual(take(s,PITCHED).take,recorder);assert.equal(s.ids.get('takeTitle').value,'Rekoder kelas');await click(s,'changeInstrumentBtn');await click(s,'chooseXylophone');assert.equal(s.C.PRESETS.length,10);await click(s,'changeInstrumentBtn');await click(s,'chooseKompang');assert.deepEqual(take(s),kompang);}
 await click(s,'kompRecord');await click(s,'kompConfirmRecord');await key(s,'f');await key(s,'j');await click(s,'kompStop');assert.deepEqual(take(s).events.map(e=>e.action),['center','edge']);assert.deepEqual(take(s,TAMB),tamborin);assert.deepEqual(take(s,PITCHED).instruments.recorder.take,recorder);
});

test('leaving Kompang cancels active examples/metronome and hidden F/J cannot change any take',async()=>{
 const s=await open();await recordTwo(s);const before=JSON.stringify(take(s));s.ids.get('kompMetro').checked=true;await click(s,'kompExample');s.advance(400);await click(s,'kompBack');assert.equal(s.activeIntervals(),0);const count=s.oscillators.length;await key(s,'f');await key(s,'j');await s.ids.get('kompCenter').fire('pointerdown');await s.ids.get('kompEdge').fire('keydown',{key:'Enter'});s.advance(5000);assert.equal(s.oscillators.length,count);assert.equal(JSON.stringify(take(s)),before);assert.equal(s.ids.get('kompStop').disabled,true);
});

test('leaving Kompang invalidates manual and example activation awaiting a suspended AudioContext',async()=>{
 for(const control of ['kompTap','kompExample']){const s=await open({audioState:'suspended',deferResume:true});const pending=control==='kompTap'?s.ids.get(control).fire('pointerdown'):click(s,control);await s.settle();await click(s,'kompBack');s.resumeAudio();await pending;await s.settle();s.advance(1000);assert.equal(s.oscillators.length,0);assert.equal(s.activeIntervals(),0);}
});

test('Kompang to Game to Studio restores Kompang and stops all game/percussion scheduling',async()=>{
 const s=await open();await recordTwo(s);const before=JSON.stringify(take(s));await click(s,'kompExample');await click(s,'gameModeBtn');assert.equal(s.ids.get('kompangView').hidden,true);assert.equal(s.ids.get('gameView').hidden,false);await click(s,'gameStartBtn');s.advance(500);await click(s,'studioModeBtn');assert.equal(s.ids.get('kompangView').hidden,false);assert.equal(s.ids.get('tamborinView').hidden,true);assert.equal(s.ids.get('gameView').hidden,true);assert.equal(s.ids.get('studioView').hidden,true);assert.equal(JSON.stringify(take(s)),before);assert.equal(s.activeIntervals(),0);const count=s.oscillators.length;s.advance(10000);assert.equal(s.oscillators.length,count);
});

test('blur, visibility loss and pagehide cancel Kompang sessions but retain performed input',async()=>{
 for(const lifecycle of ['blur','visibilitychange','pagehide']){const s=await open();await recordTwo(s);const before=JSON.stringify(take(s));s.ids.get('kompMetro').checked=true;await s.ids.get('kompMetro').fire('change');await click(s,'kompReplay');if(lifecycle==='visibilitychange'){s.document.hidden=true;await s.dispatch(lifecycle);}else await s.windowEvent(lifecycle);assert.equal(s.ids.get('kompStop').disabled,true);assert.equal(s.activeIntervals(),0);assert.equal(JSON.stringify(take(s)),before);}
});
