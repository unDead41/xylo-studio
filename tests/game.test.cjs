const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(fs.existsSync('dist/index.html')?'dist/index.html':'index.html','utf8'),box={};vm.createContext(box);
for(const id of ['xylo-core','xylo-game-core']){
 const script=html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'));
 assert.ok(script,'actual inline '+id+' must exist');vm.runInContext(script[1],box);
}
const C=box.XyloCore,G=box.XyloGameCore;
const chart=(variant='short',level='medium')=>G.chart(C.preset(2,4,variant),level);
const run=()=>new G.Run(chart());

test('all 60 game charts preserve actual score pitches, onsets, rests and duration at three tempos',()=>{
 for(const p of C.PRESETS)for(const variant of ['short','long'])for(const level of ['easy','medium','hard']){
  const t=C.preset(p.id,4,variant),before=JSON.stringify(t),g=G.chart(t,level),notes=t.events.filter(e=>e.midi>0);
  assert.equal(g.bpm,Math.round(t.bpm*G.LEVELS[level].rate));assert.equal(g.notes.length,notes.length);
  assert.deepEqual(Array.from(g.notes,e=>e.midi),Array.from(notes,e=>e.midi));
  for(const [i,e]of notes.entries()){assert.ok(Math.abs(g.notes[i].at-e.onset_tick*60/(g.bpm*24))<1e-10);assert.ok(g.notes[i].lane>=0&&g.notes[i].lane<4);}
  assert.ok(Math.abs(g.duration-t.end_tick*60/(g.bpm*24))<1e-10);assert.equal(JSON.stringify(t),before);
 }
});
test('difficulty changes tempo only and real extended pitches never fold into eight virtual bars',()=>{
 assert.deepEqual(Array.from(['easy','medium','hard'],l=>chart('short',l).bpm),[60,80,108]);
 const g=G.chart(C.preset(132,4,'long'),'hard');assert.ok(g.notes.some(e=>e.midi===77));
 for(const l of ['easy','medium','hard'])assert.equal(G.chart(C.preset(131,4,'long'),l).notes.find(e=>e.midi===70).midi,70);
});
test('Excellent and Good use inclusive fixed windows and score/health/combos are explicit',()=>{
 const r=run();r.health=80;const n=r.chart.notes[0];assert.equal(r.tap(n.lane,n.at+.07).kind,'excellent');assert.equal(r.health,83);assert.equal(r.score,100);assert.equal(r.combo,1);
 const n2=r.chart.notes[1];assert.equal(r.tap(n2.lane,n2.at+.15).kind,'good');assert.equal(r.health,83);assert.equal(r.score,160);assert.equal(r.combo,2);
});
test('miss is applied once, wrong lane costs health and a held/double input cannot award twice',()=>{
 const r=run();r.advance(.151);assert.equal(r.miss,1);assert.equal(r.health,85);r.advance(.4);assert.equal(r.miss,1);
 const n=r.chart.notes[1];assert.equal(r.tap((n.lane+1)%4,n.at).kind,'wrong');assert.equal(r.health,77);assert.equal(r.combo,0);
 assert.equal(r.tap(n.lane,n.at).kind,'excellent');const score=r.score;assert.equal(r.tap(n.lane,n.at).kind,'wrong');assert.equal(r.score,score);assert.equal(r.excellent,1);
});
test('countdown, stale input and terminal states cannot mutate score or life',()=>{
 const r=run();assert.equal(r.tap(0,-.001),null);r.advance(.2);const hp=r.health;assert.equal(r.tap(0,.1),null);assert.equal(r.health,hp);
 r.advance(100);assert.equal(r.state,'failed');assert.equal(r.health,0);const report=JSON.stringify(r.report());assert.equal(r.tap(0,101),null);r.advance(200);assert.equal(JSON.stringify(r.report()),report);
});
test('perfect run completes after score tail with deterministic combo bonus and maximum health',()=>{
 const r=run();for(const n of r.chart.notes)assert.equal(r.tap(n.lane,n.at).kind,'excellent');assert.equal(r.state,'running');r.advance(r.chart.duration);assert.equal(r.state,'completed');assert.equal(r.health,100);assert.equal(r.maxCombo,13);assert.equal(r.score,1330);assert.equal(r.report().accuracy,100);assert.equal(r.miss,0);
});
test('long song rests stay silent and generate no miss; no drift over whole chart',()=>{
 for(const id of [6,131,132,133,134]){const r=new G.Run(G.chart(C.preset(id,4,'long'),'easy'));for(const n of r.chart.notes)r.tap(n.lane,n.at);r.advance(r.chart.duration);assert.equal(r.state,'completed');assert.equal(r.miss,0);assert.equal(r.excellent,r.chart.notes.length);}
});
test('judgment history is bounded by score and invalid configuration fails clearly',()=>{
 assert.throws(()=>G.chart(C.preset(2), 'impossible'));assert.throws(()=>G.chart({...C.preset(2),bpm:NaN},'easy'));assert.throws(()=>G.chart({...C.preset(2),events:[{midi:null,onset_tick:0,duration_tick:24}]},'medium'));
 const r=run();for(let i=0;i<100;i++)r.tap(3,.2+i*.001);assert.ok(r.health>=0);assert.ok(r.score>=0);assert.equal(r.judged.length,r.chart.notes.length);
});
