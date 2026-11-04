const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function core(){
 const match=html.match(/<script id="percussion-core">([\s\S]*?)<\/script>/);
 assert.ok(match,'The real standalone HTML must contain the reusable percussion core.');
 const box={};vm.createContext(box);vm.runInContext(match[1],box);return box.PercussionCore;
}
function recorded(C){const take=C.createTake();C.capture(take,'tap',4300);C.capture(take,'shake',5043);return take;}

test('percussion identity has no MIDI or pitch substitutes',()=>{
 const C=core(),take=C.createTake();
 assert.equal(take.instrument,'tamborin');assert.equal(take.schema,'e-instru-percussion-take/v1');
 assert.deepEqual(plain(C.INSTRUMENTS.tamborin.actions),['tap','shake']);
 assert.equal(take.sound_source,'digital_synthesis');assert.deepEqual(plain(take.events),[]);
 assert.deepEqual(plain(take.raw_capture),[]);assert.equal(C.validate(take).length,0);
 assert.throws(()=>C.createTake('not-an-instrument'));
});
test('first input becomes exact zero and both action types retain absolute intervals',()=>{
 const C=core(),take=recorded(C);
 assert.deepEqual(plain(take.events.map(e=>[e.action,e.at_ms,e.raw_ms])),[['tap',0,0],['shake',743,743]]);
 assert.deepEqual(plain(take.raw_capture.map(e=>[e.action,e.raw_ms,e.source])),[['tap',0,'manual'],['shake',743,'manual']]);
 assert.equal(JSON.stringify(take).includes('4300'),false);
 assert.equal(JSON.stringify(take).includes('midi'),false);assert.equal(JSON.stringify(take).includes('pitch'),false);
});
test('tempo retimes the editable score while preserving raw capture and original tempo',()=>{
 const C=core(),take=recorded(C),before=JSON.stringify(take.raw_capture),next=C.setTempo(take,160);
 assert.equal(next.bpm,160);assert.equal(next.capture_bpm,80);assert.equal(next.events[1].at_ms,371.5);
 assert.equal(next.events[1].raw_ms,743);assert.equal(JSON.stringify(next.raw_capture),before);
 assert.equal(take.bpm,80);assert.equal(take.events[1].at_ms,743);
 const reset=C.setTempo(next,next.capture_bpm);assert.equal(reset.events[1].at_ms,743);assert.equal(reset.events.length,2);
});
test('an edited action and onset cannot overwrite original evidence',()=>{
 const C=core(),take=recorded(C),next=C.editEvent(take,1,'tap',900);
 assert.equal(next.events[1].action,'tap');assert.equal(next.events[1].at_ms,900);assert.equal(next.events[1].raw_ms,743);
 assert.equal(next.raw_capture[1].action,'shake');assert.equal(next.raw_capture[1].raw_ms,743);
 const faster=C.setTempo(next,160),reset=C.setTempo(faster,80);
 assert.equal(reset.events[1].at_ms,900);assert.equal(reset.events[1].action,'tap');assert.equal(take.events[1].action,'shake');
});
test('chronological editing keeps stable event identities across reordering',()=>{
 const C=core(),take=recorded(C);C.capture(take,'tap',5800);
 const next=C.editEvent(take,0,'shake',1000);
 assert.deepEqual(plain(next.events.map(e=>e.at_ms)),[743,1000,1500]);
 assert.deepEqual(plain(next.events.map(e=>e.id)),[1,0,2]);assert.equal(next.raw_capture[0].raw_ms,0);
 assert.equal(C.validate(next).length,0);
});
test('capture rejects non-manual actions and invalid clocks without changing an existing take',()=>{
 const C=core(),take=recorded(C),before=JSON.stringify(take);
 for(const [action,stamp]of [['metronome',5800],['tap',NaN],['tap',Infinity],['tap',-1],['tap',5000]])assert.throws(()=>C.capture(take,action,stamp));
 assert.equal(JSON.stringify(take),before);
});
test('capture enforces 512 inputs and the 180 second raw duration',()=>{
 const C=core(),take=C.createTake();for(let i=0;i<C.LIMIT;i++)C.capture(take,i%2?'shake':'tap',i);
 assert.equal(take.events.length,512);assert.throws(()=>C.capture(take,'tap',512));assert.equal(take.events.length,512);
 const timed=C.createTake();C.capture(timed,'tap',1000);C.capture(timed,'shake',181000);
 assert.equal(timed.events[1].raw_ms,180000);assert.throws(()=>C.capture(timed,'tap',181001));
});
test('tempo and edit bounds reject non-finite values and keep source data unchanged',()=>{
 const C=core(),take=recorded(C),before=JSON.stringify(take);
 for(const bpm of [0,39,201,NaN,Infinity,80.5])assert.throws(()=>C.setTempo(take,bpm));
 for(const ms of [-1,180001,NaN,Infinity])assert.throws(()=>C.editEvent(take,0,'tap',ms));
 assert.throws(()=>C.editEvent(take,20,'tap',0));assert.throws(()=>C.editEvent(take,0,'C4',0));
 assert.equal(JSON.stringify(take),before);assert.equal(C.setTempo(take,40).bpm,40);assert.equal(C.setTempo(take,200).bpm,200);
});
test('percussion JSON and CSV roundtrip actions, edited timing and raw evidence separately',()=>{
 const C=core(),take=C.editEvent(recorded(C),1,'tap',900),restored=C.importTake(JSON.stringify(take)),csv=C.csv(restored);
 assert.deepEqual(plain(restored),plain(take));assert.match(csv,/instrument,event_id,action,onset_ms,raw_action,raw_ms/);
 assert.match(csv,/tamborin,1,tap,900,shake,743,80,80,digital_synthesis/);
 assert.doesNotMatch(csv,/midi|pitch/i);assert.doesNotThrow(()=>C.importTake(JSON.stringify(C.createTake())));
});
test('import rejects forged identities, evidence, pitch fields and invalid timing',()=>{
 const C=core(),take=recorded(C);
 for(const mutate of [t=>t.schema='xylo-studio-take/v2',t=>t.instrument='compang',t=>t.events[0].midi=60,t=>t.events[0].action='C4',t=>t.raw_capture[0].raw_ms=1,t=>t.raw_capture[1].raw_ms=-1,t=>t.events[1].raw_ms=744,t=>t.events[1].id=0,t=>t.events[1].at_ms=180001,t=>t.capture_bpm=201,t=>t.sound_source='recorded_audio']){
  const bad=plain(take);mutate(bad);assert.throws(()=>C.importTake(JSON.stringify(bad)));
 }
 assert.throws(()=>C.importTake('{"schema":"e-instru-percussion-take/v1"}'));assert.throws(()=>C.importTake('null'));assert.throws(()=>C.importTake('malformed'));
});

function clock(C){
 let now=1000,nextId=0;const timers=new Map(),calls=[];let ended=0;
 const scheduler=C.createScheduler({now:()=>now,setTimer:fn=>{const id=++nextId;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id),schedule:(event,at)=>{const call={event:plain(event),at,cancelled:false};calls.push(call);return()=>call.cancelled=true;},onEnd:()=>ended++});
 return{scheduler,timers,calls,get ended(){return ended;},advance(ms){now+=ms;for(const fn of [...timers.values()])fn();},get now(){return now;}};
}
test('lookahead scheduler uses the supplied absolute clock and exact input offsets',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[{action:'tap',at_ms:0},{action:'shake',at_ms:743}],durationMs:1300,bpm:80});
 assert.equal(c.scheduler.running,true);assert.equal(c.timers.size,1);assert.equal(c.calls.length,1);assert.equal(c.calls[0].at,1050);
 c.advance(700);assert.equal(c.calls.length,2);assert.equal(c.calls[1].at,1793);
 c.advance(50);assert.equal(c.calls.length,2);assert.equal(c.scheduler.elapsedMs,700);
});
test('metronome has its own event type and never changes a recorded take',()=>{
 const C=core(),take=recorded(C),before=JSON.stringify(take),c=clock(C);
 c.scheduler.start({events:take.events,durationMs:3100,bpm:80,metronome:true});
 for(let i=0;i<32;i++)c.advance(100);
 assert.equal(JSON.stringify(take),before);
 assert.deepEqual(c.calls.filter(x=>x.event.action==='metronome').map(x=>x.at),[1050,1800,2550,3300,4050]);
 assert.deepEqual(c.calls.filter(x=>x.event.action==='metronome').map(x=>x.event.accent),[true,false,false,false,true]);
 assert.equal(c.calls.filter(x=>['tap','shake'].includes(x.event.action)).length,2);
});
test('stop cancels every queued voice and ignores callbacks captured by a previous session',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[{action:'tap',at_ms:0},{action:'shake',at_ms:750}],durationMs:2000,bpm:80,metronome:true});
 const stale=[...c.timers.values()][0];c.scheduler.stop();const n=c.calls.length;
 assert.equal(c.timers.size,0);assert.equal(c.scheduler.running,false);assert.equal(c.calls.every(x=>x.cancelled),true);
 c.advance(1000);stale();assert.equal(c.calls.length,n);assert.equal(c.ended,0);
 c.scheduler.start({events:[{action:'shake',at_ms:0}],durationMs:900,bpm:80});const afterRestart=c.calls.length;stale();assert.equal(c.calls.length,afterRestart);
});
test('automatic completion clears scheduling and calls onEnd exactly once',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[{action:'tap',at_ms:0}],durationMs:1000,bpm:80});
 const stale=[...c.timers.values()][0];c.advance(1050);stale();
 assert.equal(c.scheduler.running,false);assert.equal(c.timers.size,0);assert.equal(c.ended,1);assert.equal(c.calls.every(x=>x.cancelled),true);
});
test('metronome can run alone for a recording without manufacturing user input',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[],durationMs:Infinity,bpm:200,metronome:true});
 c.advance(250);assert.equal(c.calls.length,2);assert.equal(c.calls.every(x=>x.event.action==='metronome'),true);
 c.scheduler.stop();assert.equal(c.timers.size,0);
});
test('suspended or delayed callbacks do not burst missed metronome beats',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[],durationMs:6000,bpm:80,metronome:true});c.advance(3000);
 assert.equal(c.calls.length,2);assert.equal(c.calls[1].at,4050);c.scheduler.stop();
});
test('invalid scheduler input cannot leak an earlier session or start a timer',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[],durationMs:Infinity,bpm:80,metronome:true});
 assert.throws(()=>c.scheduler.start({events:[{action:'tap',at_ms:NaN}],durationMs:1000,bpm:80}));
 assert.equal(c.scheduler.running,false);assert.equal(c.timers.size,0);assert.equal(c.calls.every(x=>x.cancelled),true);
});

test('scheduler allows a short sound tail after the final 180 second input',()=>{
 const C=core(),c=clock(C);c.scheduler.start({events:[{action:'shake',at_ms:180000}],durationMs:180650,bpm:80});c.advance(180050);assert.equal(c.calls.length,1);assert.equal(c.calls[0].cancelled,false);c.advance(650);assert.equal(c.calls[0].cancelled,true);assert.equal(c.scheduler.running,false);
});
test('finished metronome voice cancellations are released during long running sessions',()=>{
 const C=core();let now=1000,cancelled=0;const fn=()=>cancelled++;fn.endAtMs=1100;
 const scheduler=C.createScheduler({now:()=>now,schedule:()=>fn,setTimer:()=>1,clearTimer(){}});scheduler.start({events:[],durationMs:Infinity,bpm:40,metronome:true});now=1200;scheduler.tick();assert.equal(cancelled,1);scheduler.stop();assert.equal(cancelled,1);
});
