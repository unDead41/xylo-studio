(function(root){
'use strict';

// The professional arrangement is a separate score. Imported takes remain
// immutable evidence; timing edits below never rewrite their input clocks.
const SCHEMA='e-instru-project/v1',BAR_SCHEMA='e-instru-bar/v1',PPQ=24,BAR_TICKS=96,MAX_TRACKS=8,MAX_EVENTS=512,MAX_BARS=32;
const MAX_JSON_SIZE=4*1024*1024,MAX_CAPTURE_MS=180000;
function descriptor(id,label,minMidi,maxMidi,defaultMidi,actions,actionLabels){
 return Object.freeze({id,label,kind:minMidi===null?'percussion':'pitched',pitched:minMidi!==null,
  minMidi,maxMidi,defaultMidi,actions:Object.freeze(actions||[]),actionLabels:Object.freeze(actionLabels||{})});
}
const INSTRUMENTS=Object.freeze({
 xylophone:descriptor('xylophone','Xylophone',1,127,60),
 recorder:descriptor('recorder','Rekoder Soprano',72,98,72),
 tamborin:descriptor('tamborin','Tamborin',null,null,null,['tap','shake'],{tap:'Ketuk',shake:'Goncang'}),
 kompang:descriptor('kompang','Kompang',null,null,null,['center','edge'],{center:'Tengah',edge:'Tepi'}),
 snare:descriptor('snare','Dram Sisi',null,null,null,['hit','rim'],{hit:'Ketuk kulit',rim:'Ketuk rim'}),
 bass_drum:descriptor('bass_drum','Dram Bes',null,null,null,['hit','soft'],{hit:'Ketuk kuat',soft:'Ketuk lembut'}),
 cymbals:descriptor('cymbals','Simbal',null,null,null,['crash','soft'],{crash:'Laga kuat',soft:'Laga lembut'}),
 triangle:descriptor('triangle','Segi Tiga',null,null,null,['open','muted'],{open:'Ketuk terbuka',muted:'Ketuk tertahan'})
});
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const range=(value,min,max)=>finite(value)&&value>=min&&value<=max;
const integer=(value,min,max)=>Number.isInteger(value)&&value>=min&&value<=max;
const text=(value,max)=>typeof value==='string'&&value.trim().length>0&&value.length<=max&&!/[\u0000-\u001f\u007f]/.test(value);
const instrument=id=>typeof id==='string'&&own(INSTRUMENTS,id)?INSTRUMENTS[id]:null;
const byTick=(a,b)=>a.tick-b.tick;
function fail(message){throw Error(message);}
function freeze(value){
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const child of Object.values(value))freeze(child);
  Object.freeze(value);
 }
 return value;
}
function freezeEvidence(project){
 if(object(project)&&Array.isArray(project.tracks))for(const track of project.tracks)if(object(track)&&track.sourceTake!==undefined)freeze(track.sourceTake);
 return project;
}
function clone(value){
 try{
  const encoded=JSON.stringify(value);
  if(encoded===undefined)fail('Data projek tidak dapat disalin.');
  return freezeEvidence(JSON.parse(encoded));
 }catch(error){fail('Data projek tidak dapat disalin sebagai JSON.');}
}

// Keep imported metadata JSON-only, bounded and free from raw audio payloads.
// Legacy take evidence (including raw_capture and provenance) otherwise passes
// through byte-for-byte at the JSON value level.
function jsonProblems(value){
 const errors=[],ancestors=new Set();let nodes=0;
 function visit(item,depth){
  if(++nodes>250000){errors.push('Data projek terlalu besar.');return;}
  if(depth>64){errors.push('Struktur projek terlalu dalam.');return;}
  if(item===null||typeof item==='string'||typeof item==='boolean')return;
  if(typeof item==='number'){if(!Number.isFinite(item))errors.push('Nombor projek mesti terhingga.');return;}
  if(typeof item!=='object'){errors.push('Projek hanya menerima data JSON.');return;}
  if(ancestors.has(item)){errors.push('Data projek tidak boleh merujuk dirinya sendiri.');return;}
  if(!Array.isArray(item)&&Object.prototype.toString.call(item)!=='[object Object]'){errors.push('Projek hanya menerima data JSON.');return;}
  ancestors.add(item);
  for(const key of Object.keys(item)){
   const normalized=key.toLowerCase().replace(/[_-]/g,'');
   if(/^(?:rawaudio|audiodata|audiobuffer|audiobase64|recordedaudio|pcm|samples|wav|mp3)$/.test(normalized))errors.push('Audio mentah tidak disimpan dalam projek digital.');
   visit(item[key],depth+1);
   if(nodes>250000)break;
  }
  ancestors.delete(item);
 }
 visit(value,0);return [...new Set(errors)];
}
function validate(project){
 if(!object(project))return ['Data projek tidak sah.'];
 const errors=jsonProblems(project);
 if(project.schema!==SCHEMA)errors.push('Format projek tidak dikenali.');
 if(!text(project.id,100))errors.push('Identiti projek mesti 1–100 aksara.');
 if(!text(project.title,100))errors.push('Tajuk projek mesti 1–100 aksara.');
 if(!integer(project.bpm,40,200))errors.push('Tempo mesti integer 40–200 BPM.');
 if(!integer(project.lengthBars,4,MAX_BARS))errors.push('Panjang projek mesti 4–32 bar.');
 const end=integer(project.lengthBars,4,MAX_BARS)?project.lengthBars*BAR_TICKS:MAX_BARS*BAR_TICKS;
 if(!object(project.loop)||typeof project.loop.enabled!=='boolean'||!integer(project.loop.startTick,0,end-1)||!integer(project.loop.endTick,1,end)||project.loop.endTick<=project.loop.startTick)errors.push('Gelung mesti mempunyai mula dan akhir yang sah dalam projek.');
 if(!object(project.master)||!range(project.master.volume,0,1))errors.push('Kelantangan induk mesti dalam julat 0–1.');
 if(!Array.isArray(project.tracks))return [...new Set([...errors,'Senarai trek diperlukan.'])];
 if(project.tracks.length>MAX_TRACKS)errors.push('Maksimum 8 trek bagi satu projek.');
 const trackIds=new Set(),eventIds=new Set();
 for(const track of project.tracks){
  if(!object(track)){errors.push('Data trek tidak sah.');continue;}
  if(!text(track.id,100)||trackIds.has(track.id))errors.push('Identiti trek mesti sah dan unik.');
  trackIds.add(track.id);
  if(!text(track.name,60))errors.push('Nama trek mesti 1–60 aksara.');
  const definition=instrument(track.instrumentId);
  if(!definition)errors.push('Instrumen trek tidak dikenali.');
  if(!range(track.volume,0,1)||!range(track.pan,-1,1)||!range(track.reverb,0,1)||!range(track.delay,0,1))errors.push('Tetapan mixer trek berada di luar julat.');
  if(typeof track.muted!=='boolean'||typeof track.solo!=='boolean')errors.push('Keadaan senyap dan solo mesti sah.');
  if(track.sourceTake!==undefined)try{readTake(track.sourceTake);}catch(error){errors.push('Bukti rakaman sumber tidak sah: '+error.message);}
  if(!Array.isArray(track.events)){errors.push('Senarai event trek diperlukan.');continue;}
  if(track.events.length>MAX_EVENTS)errors.push('Maksimum 512 event bagi satu trek.');
  for(const event of track.events){
   if(!object(event)){errors.push('Data event tidak sah.');continue;}
   if(!text(event.id,100)||eventIds.has(event.id))errors.push('Identiti event mesti sah dan unik dalam projek.');
   eventIds.add(event.id);
   if(!integer(event.tick,0,end-1)||!integer(event.durationTick,1,end)||event.tick+event.durationTick>end)errors.push('Event mesti berada sepenuhnya dalam panjang projek.');
   if(!range(event.velocity,0,1))errors.push('Kekuatan event mesti dalam julat 0–1.');
   if(definition?.pitched){
    if(!integer(event.midi,definition.minMidi,definition.maxMidi)||event.action!==null)errors.push(definition.id==='recorder'?'Not rekoder mesti MIDI 72–98 tanpa tindakan perkusi.':'Not melodi mesti MIDI 1–127 tanpa tindakan perkusi.');
   }else if(definition&&(event.midi!==null||!definition.actions.includes(event.action)))errors.push('Event perkusi mesti menggunakan tindakan instrumen tanpa pitch MIDI.');
  }
 }
 return [...new Set(errors)];
}
function checked(project){const errors=validate(project);if(errors.length)fail(errors.join('\n'));return project;}
function keys(patch,allowed,label){
 if(!object(patch)||Object.keys(patch).some(key=>!allowed.includes(key)))fail('Medan '+label+' tidak sah.');
 return patch;
}
function trackAt(project,id){const index=project.tracks.findIndex(track=>track.id===id);if(index<0)fail('Trek tidak ditemui.');return index;}
function eventAt(track,id){const index=track.events.findIndex(event=>event.id===id);if(index<0)fail('Event tidak ditemui.');return index;}
function nextId(prefix,ids){let count=1;while(ids.has(prefix+count))count++;return prefix+count;}
function trackId(project){return nextId('track-',new Set(project.tracks.map(track=>track.id)));}
// Track IDs may use the full 100-character schema allowance. Leave room for
// the event suffix while retaining project-wide collision checks.
function eventPrefix(id){return id.slice(0,84)+'-event-';}
function eventId(project,id){return nextId(eventPrefix(id),new Set(project.tracks.flatMap(track=>track.events.map(event=>event.id))));}
let sequence=0;
function projectId(){
 sequence++;
 if(root.crypto&&typeof root.crypto.randomUUID==='function')return 'project-'+root.crypto.randomUUID();
 return 'project-'+Date.now().toString(36)+'-'+sequence.toString(36)+'-'+Math.random().toString(36).slice(2,10);
}
function createProject(options={}){
 keys(options,['id','title','bpm','lengthBars','loop','master','tracks'],'projek baharu');
 const lengthBars=options.lengthBars===undefined?8:options.lengthBars;
 if(options.loop!==undefined)keys(options.loop,['enabled','startTick','endTick'],'gelung');
 if(options.master!==undefined)keys(options.master,['volume'],'induk');
 return clone(checked({schema:SCHEMA,id:options.id===undefined?projectId():options.id,title:'Projek baharu',bpm:100,lengthBars,
  ...options,loop:{enabled:false,startTick:0,endTick:lengthBars*BAR_TICKS,...options.loop},master:{volume:.8,...options.master},tracks:options.tracks===undefined?[]:options.tracks}));
}
function updateProject(project,patch){
 checked(project);keys(patch,['title','bpm','lengthBars','loop','master'],'projek');
 if(patch.loop!==undefined)keys(patch.loop,['enabled','startTick','endTick'],'gelung');
 if(patch.master!==undefined)keys(patch.master,['volume'],'induk');
 const next=clone(project),oldEnd=project.lengthBars*BAR_TICKS;
 for(const field of ['title','bpm','lengthBars'])if(own(patch,field))next[field]=patch[field];
 if(patch.lengthBars!==undefined&&next.loop.endTick===oldEnd)next.loop.endTick=next.lengthBars*BAR_TICKS;
 if(patch.loop!==undefined)Object.assign(next.loop,patch.loop);
 if(patch.master!==undefined)Object.assign(next.master,patch.master);
 return checked(next);
}
function addTrack(project,instrumentId){
 checked(project);const definition=instrument(instrumentId);
 if(!definition)fail('Pilih instrumen yang sah.');
 if(project.tracks.length>=MAX_TRACKS)fail('Maksimum 8 trek bagi satu projek.');
 const next=clone(project);
 next.tracks.push({id:trackId(next),name:definition.label,instrumentId,volume:.8,pan:0,muted:false,solo:false,reverb:0,delay:0,events:[]});
 return checked(next);
}
function updateTrack(project,id,patch){
 checked(project);keys(patch,['name','instrumentId','volume','pan','muted','solo','reverb','delay'],'trek');
 const index=trackAt(project,id),next=clone(project);
 Object.assign(next.tracks[index],patch);return checked(next);
}
function removeTrack(project,id){
 checked(project);const index=trackAt(project,id),next=clone(project);
 next.tracks.splice(index,1);return checked(next);
}
function duplicateTrack(project,id){
 checked(project);const index=trackAt(project,id);
 if(project.tracks.length>=MAX_TRACKS)fail('Maksimum 8 trek bagi satu projek.');
 const next=clone(project),duplicate=clone(next.tracks[index]);
 duplicate.id=trackId(next);duplicate.name=(duplicate.name.slice(0,52)+' salinan').slice(0,60);
 const used=new Set(next.tracks.flatMap(track=>track.events.map(event=>event.id)));
 for(const event of duplicate.events){event.id=nextId(eventPrefix(duplicate.id),used);used.add(event.id);}
 if(duplicate.sourceTake!==undefined)freeze(duplicate.sourceTake);
 next.tracks.splice(index+1,0,duplicate);return checked(next);
}
function addEvent(project,id,partial={}){
 checked(project);keys(partial,['id','tick','durationTick','midi','action','velocity'],'event');
 const index=trackAt(project,id),track=project.tracks[index],definition=instrument(track.instrumentId);
 if(track.events.length>=MAX_EVENTS)fail('Maksimum 512 event bagi satu trek.');
 const event={id:eventId(project,id),tick:0,durationTick:6,midi:definition.defaultMidi,action:definition.pitched?null:definition.actions[0],velocity:.8,...partial};
 const next=clone(project);next.tracks[index].events.push(event);next.tracks[index].events.sort(byTick);
 return checked(next);
}
function updateEvent(project,id,eventIdValue,patch){
 checked(project);keys(patch,['tick','durationTick','midi','action','velocity'],'event');
 const index=trackAt(project,id),eventIndex=eventAt(project.tracks[index],eventIdValue),next=clone(project);
 Object.assign(next.tracks[index].events[eventIndex],patch);next.tracks[index].events.sort(byTick);return checked(next);
}
function removeEvent(project,id,eventIdValue){
 checked(project);const index=trackAt(project,id),eventIndex=eventAt(project.tracks[index],eventIdValue),next=clone(project);
 next.tracks[index].events.splice(eventIndex,1);return checked(next);
}
function barStart(project,barIndex){
 if(!integer(barIndex,0,project.lengthBars-1))fail('Bar mesti dalam julat projek.');
 return barIndex*BAR_TICKS;
}
function inBar(event,start){return event.tick>=start&&event.tick<start+BAR_TICKS;}
function copyBar(project,id,barIndex){
 checked(project);const index=trackAt(project,id),start=barStart(project,barIndex),track=project.tracks[index];
 // A bar owns note onsets, not the tails of notes started in earlier bars.
 // Keep full gates and only copy edited score values; raw evidence stays put.
 return {schema:BAR_SCHEMA,instrumentId:track.instrumentId,events:track.events.filter(event=>inBar(event,start)).map(event=>({
  tick:event.tick-start,durationTick:event.durationTick,midi:event.midi,action:event.action,velocity:event.velocity
 })).sort(byTick),source:{projectId:project.id,trackId:track.id,barIndex}};
}
function checkedBarClipboard(clipboard){
 keys(clipboard,['schema','instrumentId','events','source'],'papan klip bar');
 if(!own(clipboard,'schema')||clipboard.schema!==BAR_SCHEMA)fail('Format papan klip bar tidak dikenali.');
 const definition=own(clipboard,'instrumentId')&&instrument(clipboard.instrumentId);
 if(!definition||!own(clipboard,'events')||!Array.isArray(clipboard.events))fail('Data papan klip bar tidak sah.');
 if(clipboard.events.length>MAX_EVENTS)fail('Maksimum 512 event bagi satu trek.');
 const problems=jsonProblems(clipboard);if(problems.length)fail(problems.join('\n'));
 if(own(clipboard,'source')){
  const source=keys(clipboard.source,['projectId','trackId','barIndex'],'sumber papan klip bar');
  if(!own(source,'projectId')||!text(source.projectId,100)||!own(source,'trackId')||!text(source.trackId,100)||!own(source,'barIndex')||!integer(source.barIndex,0,MAX_BARS-1))fail('Sumber papan klip bar tidak sah.');
 }
 for(const event of clipboard.events){
  keys(event,['tick','durationTick','midi','action','velocity'],'event papan klip bar');
  if(['tick','durationTick','midi','action','velocity'].some(field=>!own(event,field))||!integer(event.tick,0,BAR_TICKS-1)||!integer(event.durationTick,1,MAX_BARS*BAR_TICKS)||event.tick+event.durationTick>MAX_BARS*BAR_TICKS)fail('Masa event papan klip bar tidak sah.');
  if(!range(event.velocity,0,1))fail('Kekuatan event mesti dalam julat 0–1.');
  if(definition.pitched){
   if(!integer(event.midi,definition.minMidi,definition.maxMidi)||event.action!==null)fail(definition.id==='recorder'?'Not rekoder mesti MIDI 72–98 tanpa tindakan perkusi.':'Not melodi mesti MIDI 1–127 tanpa tindakan perkusi.');
  }else if(event.midi!==null||!definition.actions.includes(event.action))fail('Event perkusi mesti menggunakan tindakan instrumen tanpa pitch MIDI.');
 }
 return clipboard;
}
function pasteBar(project,id,barIndex,clipboard,options={}){
 checked(project);const index=trackAt(project,id),start=barStart(project,barIndex),track=project.tracks[index];
 checkedBarClipboard(clipboard);keys(options,['replace'],'tampalan bar');
 if(options.replace!==undefined&&typeof options.replace!=='boolean')fail('Pilihan tampalan bar tidak sah.');
 if(clipboard.instrumentId!==track.instrumentId)fail('Instrumen papan klip bar tidak serasi dengan trek.');
 const kept=options.replace?track.events.filter(event=>!inBar(event,start)):track.events;
 if(kept.length+clipboard.events.length>MAX_EVENTS)fail('Maksimum 512 event bagi satu trek.');
 if(clipboard.events.some(event=>start+event.tick+event.durationTick>project.lengthBars*BAR_TICKS))fail('Tempoh tampalan melebihi akhir projek. Panjangkan projek atau pilih bar lebih awal.');
 const next=clone(project),target=next.tracks[index];
 target.events=options.replace?target.events.filter(event=>!inBar(event,start)):target.events;
 if(clipboard.events.length===0)return checked(next);
 // Include IDs removed by replacement as well, so pasted events never inherit
 // an identity from the project that the caller passed to this operation.
 const used=new Set(project.tracks.flatMap(item=>item.events.map(event=>event.id)));
 for(const event of clipboard.events){
  const freshId=nextId(eventPrefix(id),used);used.add(freshId);
  target.events.push({id:freshId,tick:start+event.tick,durationTick:event.durationTick,midi:event.midi,action:event.action,velocity:event.velocity});
 }
 target.events.sort(byTick);return checked(next);
}
function clearBar(project,id,barIndex){
 checked(project);const index=trackAt(project,id),start=barStart(project,barIndex),next=clone(project);
 next.tracks[index].events=next.tracks[index].events.filter(event=>!inBar(event,start));return checked(next);
}
function quantizeTrack(project,id,gridTick=6,strength=1){
 checked(project);const index=trackAt(project,id),end=project.lengthBars*BAR_TICKS;
 if(!integer(gridTick,1,end)||!range(strength,0,1))fail('Grid dan kekuatan kuantisasi tidak sah.');
 const next=clone(project);
 for(const event of next.tracks[index].events){
  const snapped=Math.round(event.tick/gridTick)*gridTick;
  event.tick=Math.max(0,Math.min(end-event.durationTick,Math.round(event.tick+(snapped-event.tick)*strength)));
 }
 next.tracks[index].events.sort(byTick);return checked(next);
}
function transposeTrack(project,id,semitones){
 checked(project);const index=trackAt(project,id),definition=instrument(project.tracks[index].instrumentId);
 if(!definition.pitched)fail('Transposisi hanya untuk trek melodi.');
 if(!integer(semitones,-127,127))fail('Transposisi mesti bilangan semiton bulat dalam julat −127 hingga 127.');
 const next=clone(project);for(const event of next.tracks[index].events)event.midi+=semitones;
 return checked(next);
}

function parseJSON(encoded,label,size=MAX_JSON_SIZE){
 if(typeof encoded!=='string'||encoded.length>size)fail('Saiz fail '+label+' tidak sah.');
 try{return JSON.parse(encoded);}catch(error){fail('Fail JSON '+label+' tidak sah.');}
}
function sourceMs(value){return range(value,0,MAX_CAPTURE_MS);}
function readTake(value){
 const take=typeof value==='string'?parseJSON(value,'rakaman',524288):value;
 if(!object(take)||!Array.isArray(take.events)||take.events.length>MAX_EVENTS)fail('Data rakaman sumber tidak sah.');
 const problems=jsonProblems(take);if(problems.length)fail(problems.join('\n'));
 if(!integer(take.bpm,40,200))fail('Tempo rakaman sumber mesti integer 40–200 BPM.');
 if(take.raw_capture!==undefined&&(!Array.isArray(take.raw_capture)||take.raw_capture.length>MAX_EVENTS))fail('Bukti input asal tidak sah.');
 if(take.capture_bpm!==undefined&&!integer(take.capture_bpm,40,200))fail('Tempo tangkapan sumber tidak sah.');
 let definition,events=[],endTick=0;
 if(['xylo-studio-take/v1','xylo-studio-take/v2'].includes(take.schema)){
  const id=take.instrument_id||take.instrument||'xylophone';definition=instrument(id);
  if(!definition?.pitched||take.ppq!==PPQ)fail('Instrumen atau PPQ rakaman melodi tidak disokong.');
  if(!integer(take.end_tick,0,65535))fail('Akhir rakaman melodi tidak sah.');
  let previous=null;
  for(const event of take.events){
   if(!object(event)||!integer(event.onset_tick,0,65535)||!integer(event.duration_tick,1,65535)||(previous===null?event.onset_tick!==0:event.onset_tick!==previous.onset_tick+previous.duration_tick))fail('Masa not sumber tidak sah.');
   previous=event;
   if(event.raw_ms!==undefined&&event.raw_ms!==null&&!sourceMs(event.raw_ms))fail('Masa input asal tidak sah.');
   if(event.gate_tick!==undefined&&!integer(event.gate_tick,1,65535))fail('Tempoh tahan not sumber tidak sah.');
   if(event.raw_duration_ms!==undefined&&!sourceMs(event.raw_duration_ms)||event.release_ms!==undefined&&!sourceMs(event.release_ms))fail('Tempoh input asal tidak sah.');
   if(event.midi===null)fail('Semak not sumber yang belum diketahui sebelum mengimport.');
   if(!integer(event.midi,0,127))fail('Pitch not sumber tidak sah.');
   const duration=event.gate_tick===undefined?event.duration_tick:event.gate_tick;
   endTick=Math.max(endTick,event.onset_tick+duration,event.onset_tick+event.duration_tick);
   // MIDI 0 is a rest in legacy scores, never a sounding project event.
   if(event.midi===0)continue;
   if(!integer(event.midi,definition.minMidi,definition.maxMidi))fail('Not sumber di luar julat instrumen.');
   if(event.estimated===true&&event.reviewed!==true||event.source==='microphone_estimate'&&event.reviewed!==true||take.source==='microphone_estimate'&&event.reviewed!==true)fail('Semak dan sahkan not anggaran mikrofon sebelum mengimport.');
   events.push({tick:event.onset_tick,durationTick:duration,midi:event.midi,action:null,velocity:event.velocity===undefined?.8:event.velocity});
  }
  if(previous===null?take.end_tick!==0:take.end_tick!==previous.onset_tick+previous.duration_tick||take.end_tick<endTick)fail('Akhir rakaman sumber tidak meliputi semua not.');
  endTick=Math.max(endTick,take.end_tick);
  if(take.end_tick*60000/(take.bpm*PPQ)>MAX_CAPTURE_MS)fail('Rakaman sumber melebihi 180 saat.');
  for(const raw of take.raw_capture||[])if(!object(raw)||!sourceMs(raw.raw_ms))fail('Bukti input asal tidak sah.');
 }else if(take.schema==='e-instru-percussion-take/v1'){
  definition=instrument(take.instrument);
  if(!definition||definition.pitched||take.sound_source!=='digital_synthesis'||!integer(take.capture_bpm,40,200)||!Array.isArray(take.raw_capture))fail('Rakaman perkusi sumber tidak disokong.');
  const rawById=new Map();let previous=-1;
  for(const raw of take.raw_capture){
   if(!object(raw)||!integer(raw.id,0,MAX_EVENTS-1)||rawById.has(raw.id)||!definition.actions.includes(raw.action)||raw.source!=='manual'||!sourceMs(raw.raw_ms)||raw.raw_ms<previous||(rawById.size===0&&raw.raw_ms!==0)||'midi'in raw||'pitch'in raw)fail('Bukti input perkusi asal tidak sah.');
   rawById.set(raw.id,raw);previous=raw.raw_ms;
  }
  previous=-1;const ids=new Set();
  for(const event of take.events){
   if(!object(event)||!integer(event.id,0,MAX_EVENTS-1)||ids.has(event.id)||!definition.actions.includes(event.action)||event.source!=='manual'||!sourceMs(event.at_ms)||event.at_ms<previous||!sourceMs(event.raw_ms)||event.raw_ms!==rawById.get(event.id)?.raw_ms||'midi'in event||'pitch'in event)fail('Ketukan perkusi sumber tidak sah.');
   ids.add(event.id);previous=event.at_ms;
   const tick=Math.round(event.at_ms*take.bpm*PPQ/60000);
   events.push({tick,durationTick:6,midi:null,action:event.action,velocity:event.velocity===undefined?.8:event.velocity});
   endTick=Math.max(endTick,tick+6);
  }
 }else fail('Format rakaman sumber tidak dikenali.');
 return {take,definition,events,endTick};
}
function importTake(project,take){
 checked(project);if(project.tracks.length>=MAX_TRACKS)fail('Maksimum 8 trek bagi satu projek.');
 const source=readTake(take);
 if(source.endTick>MAX_BARS*BAR_TICKS)fail('Rakaman sumber melebihi panjang maksimum 32 bar.');
 let next=clone(project);
 if(next.tracks.length===0)next=updateProject(next,{bpm:source.take.bpm});
 const needed=Math.max(next.lengthBars,Math.ceil(source.endTick/BAR_TICKS),4);
 if(needed!==next.lengthBars)next=updateProject(next,{lengthBars:needed});
 next=addTrack(next,source.definition.id);
 const track=next.tracks[next.tracks.length-1];
 track.name=typeof source.take.title==='string'&&source.take.title.trim()?source.take.title.trim().slice(0,60):source.definition.label;
 track.sourceTake=freeze(clone(source.take));
 for(const event of source.events)track.events.push({...event,id:eventId(next,track.id)});
 track.events.sort(byTick);return checked(next);
}
function projectFromJSON(encoded){return clone(checked(parseJSON(encoded,'projek')));}
function exportProject(project){
 checked(project);const encoded=JSON.stringify(project,null,2);
 if(encoded.length>MAX_JSON_SIZE)fail('Fail projek melebihi had 4 MiB.');
 return encoded;
}
function csv(project){
 checked(project);
 const rows=[['project_id','project_title','bpm','length_bars','track_id','track_name','instrument_id','event_id','tick','duration_tick','onset_ms','duration_ms','midi','action','velocity','volume','pan','muted','solo','reverb','delay','source_schema']];
 const tickMs=60000/(project.bpm*PPQ);
 for(const track of project.tracks)for(const event of track.events)rows.push([project.id,project.title,project.bpm,project.lengthBars,track.id,track.name,track.instrumentId,event.id,event.tick,event.durationTick,(event.tick*tickMs).toFixed(3),(event.durationTick*tickMs).toFixed(3),event.midi??'',event.action??'',event.velocity,track.volume,track.pan,track.muted,track.solo,track.reverb,track.delay,track.sourceTake?.schema||'']);
 return rows.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(',')).join('\r\n');
}
function createHistory(initial,limit=60){
 checked(initial);if(!integer(limit,1,1000))fail('Had sejarah mesti integer 1–1000.');
 let states=[clone(initial)],cursor=0;
 const get=()=>clone(states[cursor]);
 function commit(project,options={}){
  checked(project);keys(options,['replaceLast'],'sejarah');
  if(options.replaceLast!==undefined&&typeof options.replaceLast!=='boolean')fail('Pilihan sejarah tidak sah.');
  if(JSON.stringify(project)===JSON.stringify(states[cursor]))return get();
  const hadFuture=cursor<states.length-1;states=states.slice(0,cursor+1);
  if(options.replaceLast===true&&cursor>0&&!hadFuture)states[cursor]=clone(project);
  else{states.push(clone(project));cursor++;}
  if(states.length>limit+1){const removed=states.length-(limit+1);states.splice(0,removed);cursor-=removed;}
  return get();
 }
 return Object.freeze({get,commit,undo(){if(cursor>0)cursor--;return get();},redo(){if(cursor<states.length-1)cursor++;return get();},canUndo:()=>cursor>0,canRedo:()=>cursor<states.length-1});
}
root.ProStudioCore=Object.freeze({SCHEMA,BAR_SCHEMA,PPQ,BAR_TICKS,MAX_TRACKS,MAX_EVENTS,MAX_BARS,INSTRUMENTS,
 createProject,validate,clone,updateProject,addTrack,updateTrack,removeTrack,duplicateTrack,addEvent,updateEvent,removeEvent,
 copyBar,pasteBar,clearBar,quantizeTrack,transposeTrack,importTake,projectFromJSON,exportProject,csv,createHistory});
})(typeof window!=='undefined'?window:globalThis);
