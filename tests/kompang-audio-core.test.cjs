const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function block(id){const box={};vm.createContext(box);vm.runInContext(html.match(new RegExp('<script id="'+id+'">([\\s\\S]*?)<\\/script>'))[1],box);return box;}
function recorded(){const C=block('percussion-core').PercussionCore,take=C.createTake('kompang',90);C.capture(take,'center',1234.25);C.capture(take,'edge',1611.75);return{C,take};}

test('Kompang is unpitched and permits only center and edge manual inputs',()=>{
 const C=block('percussion-core').PercussionCore;
 assert.ok(C.INSTRUMENTS.kompang,'Kompang must be registered in the real unpitched core');
 assert.deepEqual(plain(C.INSTRUMENTS.kompang.actions),['center','edge']);
 const take=C.createTake('kompang');assert.equal(take.instrument,'kompang');assert.equal(take.sound_source,'digital_synthesis');
 for(const action of ['tap','shake','metronome','C4'])assert.throws(()=>C.capture(take,action,1000));
 assert.equal(take.events.length,0);assert.doesNotMatch(JSON.stringify(take),/midi|pitch/i);
});
test('Kompang keeps center and edge raw input identity through tempo and score edits',()=>{
 const {C,take}=recorded(),before=JSON.stringify(take.raw_capture);
 assert.deepEqual(plain(take.events.map(e=>[e.action,e.raw_ms])),[['center',0],['edge',377.5]]);
 const edited=C.editEvent(take,1,'center',450),faster=C.setTempo(edited,180);
 assert.equal(faster.events[1].at_ms,225);assert.equal(faster.events[1].action,'center');
 assert.equal(faster.events[1].raw_ms,377.5);assert.equal(JSON.stringify(faster.raw_capture),before);
 assert.ok(Object.isFrozen(faster.raw_capture));assert.ok(Object.isFrozen(faster.raw_capture[0]));
});
test('Kompang JSON and CSV retain instrument and separate original versus edited action timing',()=>{
 const {C,take}=recorded(),edited=C.editEvent(take,1,'center',450),restored=C.importTake(JSON.stringify(edited));
 assert.deepEqual(plain(restored),plain(edited));
 assert.match(C.csv(restored),/kompang,1,center,450,edge,377\.5,90,90,digital_synthesis/);
 const forged=plain(take);forged.instrument='tamborin';assert.throws(()=>C.importTake(JSON.stringify(forged)));
 const invalid=plain(take);invalid.raw_capture[1].action='shake';assert.throws(()=>C.importTake(JSON.stringify(invalid)));
});

function audio(){
 const sources=[],nodes=[],buffers=[];
 const param=()=>({value:0,events:[],setValueAtTime(value,at){this.events.push(['set',value,at]);},exponentialRampToValueAtTime(value,at){this.events.push(['ramp',value,at]);}});
 function node(kind){const n={kind,connected:false,disconnects:0,connect(){this.connected=true;},disconnect(){this.connected=false;this.disconnects++;},gain:param(),frequency:param(),start(at){this.startAt=at;},stop(at){this.stops??=[];this.stops.push(at);}};nodes.push(n);return n;}
 const context={currentTime:1,sampleRate:48000,destination:{},createGain:()=>node('gain'),createOscillator(){const n=node('osc');sources.push(n);return n;},createBufferSource(){const n=node('noise');sources.push(n);return n;},createBiquadFilter:()=>node('filter'),createBuffer(channels,length,rate){const data=new Float32Array(length),b={channels,length,rate,getChannelData:()=>data};buffers.push(b);return b;}};
 return{context,sources,nodes,buffers,A:block('percussion-audio').PercussionAudio};
}
function voice(action,at=1,accent=false){const a=audio();assert.equal(typeof a.A.kompang,'function','Kompang needs its own synthesis adapter');a.voice=a.A.kompang(a.context,action,at,accent);return a;}
test('Kompang center has lower modes and a longer decay than the sharp edge graph',()=>{
 const center=voice('center'),edge=voice('edge');
 const frequencies=a=>a.sources.filter(n=>n.kind==='osc').map(n=>n.frequency.events[0][1]);
 assert.ok(Math.min(...frequencies(center))<Math.min(...frequencies(edge)));
 assert.ok(center.voice.endAt>edge.voice.endAt+.12,'Center should resonate longer than edge');
 const filters=a=>a.nodes.filter(n=>n.kind==='filter').map(n=>[n.type,n.frequency.value,n.frequency.events]);
 assert.notDeepEqual(filters(center),filters(edge),'The textures must differ in filtering, not only volume');
 assert.ok(center.buffers.some(b=>b.getChannelData(0).some(x=>x!==0)));
 assert.ok(edge.buffers.some(b=>b.getChannelData(0).some(x=>x!==0)));
});
for(const action of ['center','edge','metronome'])test('Kompang '+action+' graph ends cleanly and cancellation is idempotent',()=>{
 const a=voice(action,2);assert.ok(a.sources.length>0);assert.ok(a.sources.every(n=>n.startAt>=2));
 for(const source of a.sources)source.onended?.();assert.equal(a.nodes.some(n=>n.connected),false);
 const count=a.nodes.map(n=>n.disconnects);a.voice.cancel();assert.deepEqual(a.nodes.map(n=>n.disconnects),count);
 const pending=voice(action,3);pending.voice.cancel();assert.ok(pending.sources.every(n=>n.stops.includes(undefined)));assert.equal(pending.nodes.some(n=>n.connected),false);
});
test('Kompang rejects foreign actions before allocating any audio graph',()=>{
 const a=audio();assert.equal(typeof a.A.kompang,'function');
 for(const action of ['tap','shake','other'])assert.throws(()=>a.A.kompang(a.context,action,1));
 assert.equal(a.nodes.length,0);assert.equal(a.sources.length,0);
});
