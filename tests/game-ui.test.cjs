const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');
const make=()=>studio({game:true,variant:null});
const el=(s,id)=>s.ids.get(id),click=(s,id)=>el(s,id).fire('click');
async function enter(s){await click(s,'gameModeBtn');}
async function start(s){await enter(s);await click(s,'gameStartBtn');await s.settle();}
async function choose(s,id,value){el(s,id).value=value;await el(s,id).fire('change');}
async function hit(s,lane){await s.dispatch('keydown',{key:['A','S','D','F'][lane],repeat:false});await s.dispatch('keyup',{key:['A','S','D','F'][lane]});}
async function perfect(s,id=2,variant='short',level='medium'){
 await enter(s);await choose(s,'gameSong',String(id));await choose(s,'gameVariant',variant);await choose(s,'gameDifficulty',level);await click(s,'gameStartBtn');
 const chart=s.G.chart(s.C.preset(id,4,variant),level),a=s.contexts.at(-1),origin=a.currentTime+chart.travel;
 for(const n of chart.notes){a.currentTime=origin+n.at;await hit(s,n.lane);}a.currentTime=origin+chart.duration;s.advance(25);return chart;
}
test('game offers ten songs, both lengths and real song-based difficulty BPM without changing Studio',async()=>{
 const s=make(),title=el(s,'takeTitle').value,notes=el(s,'statNotes').textContent;
 await enter(s);assert.equal(el(s,'gameSong').children.length,10);assert.equal(el(s,'studioView').hidden,true);assert.equal(el(s,'gameView').hidden,false);
 await choose(s,'gameSong','131');await choose(s,'gameVariant','long');await choose(s,'gameDifficulty','easy');assert.equal(el(s,'gameBpm').textContent,'54');assert.equal(el(s,'gameDuration').textContent,'56.7s');assert.equal(el(s,'gameNoteCount').textContent,'50');
 await choose(s,'gameDifficulty','hard');assert.equal(el(s,'gameBpm').textContent,'97');await click(s,'studioModeBtn');assert.equal(el(s,'studioView').hidden,false);assert.equal(el(s,'takeTitle').value,title);assert.equal(el(s,'statNotes').textContent,notes);
});
test('countdown ignores input, key repeat/hold awards once and Studio does not sound a second voice',async()=>{
 const s=make();await start(s);await hit(s,2);assert.equal(el(s,'gameScore').textContent,'0');assert.equal(s.oscillators.length,0);s.advance(3025);
 await s.dispatch('keydown',{key:'D',repeat:false});assert.equal(el(s,'gameScore').textContent,'100');assert.equal(s.oscillators.length,2);
 await s.dispatch('keydown',{key:'D',repeat:true});await s.dispatch('keydown',{key:'D',repeat:false});assert.equal(el(s,'gameScore').textContent,'100');assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');assert.equal(s.oscillators.length,2);
 await s.dispatch('keyup',{key:'D'});await hit(s,2);assert.equal(el(s,'gameHealthValue').textContent,'92 / 100');assert.equal(el(s,'gameScore').textContent,'100');
 s.advance(725);await hit(s,1);assert.equal(el(s,'gameHealthValue').textContent,'95 / 100');assert.equal(el(s,'gameScore').textContent,'200');
});
test('misses end at zero life, unlock settings and show actual judgments',async()=>{
 const s=make();await start(s);s.advance(9500);assert.equal(el(s,'gameHealthValue').textContent,'0 / 100');assert.equal(el(s,'gameResult').hidden,false);assert.equal(el(s,'gameMiss').textContent,'7');assert.equal(el(s,'gameDifficulty').disabled,false);assert.equal(el(s,'gamePauseBtn').disabled,true);assert.equal(s.oscillators.length,0);
});
test('perfect long game sounds exact extended MIDI once per tile and persists its separate best',async()=>{
 const s=make(),chart=await perfect(s,131,'long','hard');assert.equal(el(s,'gameExcellent').textContent,'50');assert.equal(el(s,'gameMiss').textContent,'0');assert.equal(el(s,'gameAccuracy').textContent,'100%');assert.equal(el(s,'gameResult').hidden,false);assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');
 const voices=s.oscillators.filter((_,i)=>i%2===0);assert.equal(voices.length,chart.notes.length);for(const [i,n]of chart.notes.entries())assert.ok(Math.abs(voices[i].frequency.value-s.C.freq(n.midi))<.001);
 assert.equal(el(s,'gameProgress').value,100);assert.equal(el(s,'gameProgress').textContent,'100%');const record=JSON.parse(s.saved.get('xylo-game-best-v1'));assert.ok(record['131:long:hard:97:v1']>0);assert.equal(el(s,'statNotes').textContent,'52');
 const reloaded=studio({game:true,variant:null,storage:Object.fromEntries(s.saved)});assert.equal(el(reloaded,'gameBest').textContent,el(s,'gameScore').textContent);
});
test('pause and hidden-tab hold preserve progress, then two-beat resume prevents phantom misses',async()=>{
 const s=make();await start(s);s.advance(3025);await hit(s,2);const score=el(s,'gameScore').textContent;s.document.hidden=true;await s.dispatch('visibilitychange');assert.equal(el(s,'gamePauseBtn').textContent,'Sambung');
 s.advance(60000);assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');assert.equal(el(s,'gameScore').textContent,score);assert.equal(el(s,'gameTime').textContent,'0.0 / 12.0s');
 s.document.hidden=false;await click(s,'gamePauseBtn');s.advance(1000);await hit(s,1);assert.equal(el(s,'gameScore').textContent,score);s.advance(1200);await hit(s,1);assert.equal(el(s,'gameScore').textContent,'200');assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');
});
test('Reset and leaving mode cancel pending audio startup and keep the existing custom take',async()=>{
 const base=make(),t=base.C.fromTaps([{midi:60,raw_ms:0},{midi:62,raw_ms:743}],80,12,2,4),s=studio({game:true,variant:null,legacy:t});await enter(s);
 const pending=click(s,'gameStartBtn');await click(s,'gameResetBtn');await pending;s.advance(5000);assert.equal(el(s,'gameScore').textContent,'0');assert.equal(el(s,'gameStartLabel').textContent,'Mula permainan');assert.equal(s.oscillators.length,0);
 const again=click(s,'gameStartBtn');await click(s,'studioModeBtn');await again;s.advance(5000);assert.equal(el(s,'gameView').hidden,true);assert.equal(el(s,'statNotes').textContent,'2');assert.equal(el(s,'eventRows').children[1].children[4].textContent,'743.0ms input');
});
test('switching from pending Studio playback cancels it and game settings lock for a run',async()=>{
 const s=make(),pending=click(s,'playBtn');await enter(s);await pending;s.advance(500);assert.equal(s.oscillators.length,0);await click(s,'gameStartBtn');assert.equal(el(s,'gameDifficulty').disabled,true);s.advance(3050);await hit(s,2);assert.equal(s.oscillators.length,2);await click(s,'gameResetBtn');assert.equal(el(s,'gameDifficulty').disabled,false);assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');
});
test('pointer input deduplicates a held pointer and exact note audio is awarded once',async()=>{
 const s=make();await start(s);s.advance(3025);const pad=el(s,'gamePads').children[2];await pad.fire('pointerdown',{pointerId:8});await pad.fire('pointerdown',{pointerId:8});assert.equal(el(s,'gameScore').textContent,'100');assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');assert.equal(s.oscillators.length,2);
 await s.dispatch('pointerup',{pointerId:8});await pad.fire('pointerdown',{pointerId:9});assert.equal(el(s,'gameHealthValue').textContent,'92 / 100');
});
test('suspended audio pauses safely, and restored invalid settings/records cannot break Studio',async()=>{
 const s=make();await start(s);s.contexts[0].state='suspended';s.advance(100);assert.equal(el(s,'gamePauseBtn').textContent,'Sambung');assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');await click(s,'gamePauseBtn');s.advance(100);assert.equal(el(s,'gamePauseBtn').textContent,'Jeda');
 const bad=studio({game:true,storage:{'xylo-game-settings-v1':'{"song":999,"variant":"long","level":"__proto__"}','xylo-game-best-v1':'{"2:short:medium:80:v1":-50}'}});assert.equal(el(bad,'gameBpm').textContent,'80');assert.equal(el(bad,'gameBest').textContent,'0');
});
test('arena pause control supports mobile pause/resume and disappears after Reset',async()=>{
 const s=make();await start(s);assert.equal(el(s,'gameArenaPauseBtn').hidden,false);await click(s,'gameArenaPauseBtn');assert.equal(el(s,'gameArenaPauseBtn').textContent,'Sambung');s.advance(30000);assert.equal(el(s,'gameHealthValue').textContent,'100 / 100');await click(s,'gameArenaPauseBtn');assert.equal(el(s,'gamePauseBtn').textContent,'Jeda');await click(s,'gameResetBtn');assert.equal(el(s,'gameArenaPauseBtn').hidden,true);
});
