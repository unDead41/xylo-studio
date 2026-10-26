const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(fs.existsSync('dist/index.html')?'dist/index.html':'index.html','utf8').match(/<script id="xylo-core">([\s\S]*?)<\/script>/)[1],box);const C=box.XyloCore;
test('ten long arrangements have named form sections, exact tick timing and honest provenance',()=>{
 assert.equal(C.LONG_PRESETS.length,10);
 for(const p of C.PRESETS){const short=C.preset(p.id),long=C.preset(p.id,4,'long');assert.equal(long.score_variant,'long');assert.equal(C.validate(long).length,0,p.title);assert.ok(C.durationMs(long)>30000&&C.durationMs(long)<=180000,p.title);assert.ok(C.durationMs(long)>C.durationMs(short)*2,p.title);assert.ok(long.events.length>short.events.length,p.title);assert.ok(long.sections.length>=4,p.title);assert.equal(long.reference_timestamp,null);assert.equal(long.reference_verified,false);assert.equal(long.source_firmware_commit,null);let end=0;for(const e of long.events){assert.equal(e.onset_tick,end);end+=e.duration_tick;}assert.equal(end,long.end_tick);assert.match(long.arrangement_note,/belum disahkan/);}
});
test('extended pitches and rests survive transposition and JSON without octave folding',()=>{
 const birthday=C.preset(131,4,'long'),sleeping=C.preset(6,4,'long');assert.ok(birthday.events.some(e=>e.midi===70));assert.ok(sleeping.events.some(e=>e.midi===55));assert.equal(C.noteInfo(70).label,'Bb4');
 for(const t of [birthday,sleeping]){assert.ok(t.events.some(e=>e.midi===0));for(const octave of [3,4,5]){const r=C.transpose(t,octave),loaded=C.importTake(JSON.stringify(r));assert.equal(C.validate(loaded).length,0);assert.equal(loaded.score_variant,'long');assert.equal(loaded.sections.length,t.sections.length);assert.equal(loaded.events.filter(e=>e.midi===0).length,t.events.filter(e=>e.midi===0).length);assert.equal(loaded.reference_verified,false);}}
});
test('browser long playback/export limits remain separate from actual Uno limits',()=>{
 for(const p of C.PRESETS){const t=C.preset(p.id,4,'long');assert.equal(C.validate(t).length,0);assert.ok(C.validate(t,true).some(e=>/Uno/.test(e)));assert.throws(()=>C.cpp(t),/Uno/);assert.ok(C.csv(t).includes('duration_tick'));assert.equal(C.importTake(JSON.stringify(t)).events.length,t.events.length);}
 assert.equal(C.LIMIT,512);assert.equal(C.MAX_DURATION_MS,180000);const t=C.preset(2,4,'long');t.events=Array.from({length:513},(_,i)=>({midi:60,onset_tick:i*6,duration_tick:6,raw_ms:null}));t.end_tick=513*6;assert.ok(C.validate(t).some(e=>/512/.test(e)));const tooLong=C.preset(2);tooLong.events=[{midi:60,onset_tick:0,duration_tick:6000}];tooLong.end_tick=6000;assert.ok(C.validate(tooLong).some(e=>/180/.test(e)));
});
test('legacy short takes remain readable and unknown variants fail clearly',()=>{
 const old=C.preset(2);old.schema='xylo-studio-take/v1';delete old.score_variant;const t=C.importTake(JSON.stringify(old));assert.equal(t.events.length,13);assert.equal(t.score_variant,'short');assert.throws(()=>C.preset(2,4,'missing'));const bad=C.preset(2,4,'long');bad.events[0].midi=128;assert.throws(()=>C.importTake(JSON.stringify(bad)));
});
