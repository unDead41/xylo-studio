const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const base=path.resolve(__dirname,'..');
const plain=value=>JSON.parse(JSON.stringify(value));

// Real project model, persistence and shell with boundary DOM/audio doubles.
// These checks do not measure native focus layout or physical audio latency.
function fixture({saved=new Map(),failWrites=false,deferAudio=false}={}){
 const ids=new Map(),documentListeners=new Map(),windowListeners=new Map(),timers=new Map(),changes=[];
 let timerId=0,uuid=0;
 const doc={hidden:false,activeElement:null};
 class Element{
  constructor(tag='div'){this.tagName=tag.toUpperCase();this.attrs={};this.listeners=new Map();this.hidden=false;this.open=false;this.checked=false;this.disabled=false;this.value='';this.textContent='';this.className='';this.tabIndex=0;this.isConnected=true;this.ownerDocument=doc;this.parentElement=null;this.classList={toggle:(name,on)=>{const values=new Set(this.className.split(/\s+/).filter(Boolean));if(on)values.add(name);else values.delete(name);this.className=[...values].join(' ');},contains:name=>this.className.split(/\s+/).includes(name)};}
  setAttribute(name,value){this.attrs[name]=String(value);if(name==='id'){this.id=String(value);ids.set(this.id,this);}if(name==='class')this.className=String(value);if(name==='value')this.value=String(value);if(name==='tabindex')this.tabIndex=Number(value);}
  getAttribute(name){return this.attrs[name]??null;}
  removeAttribute(name){delete this.attrs[name];}
  addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
  async fire(name,extra={}){const event={target:this,key:'',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of this.listeners.get(name)||[])await fn(event);return event;}
  closest(selector){for(let node=this;node;node=node.parentElement){for(const part of selector.split(',')){const s=part.trim();if(s.startsWith('[role=')){if(node.getAttribute('role')===s.match(/"([^"]+)"/)[1])return node;}else if(s==='[contenteditable]'){if(node.getAttribute('contenteditable')!==null)return node;}else if(node.tagName.toLowerCase()===s)return node;}}return null;}
  focus(){doc.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;for(const fn of this.listeners.get('close')||[])fn({target:this});}
 }
 const markup=fs.readFileSync(path.join(base,'studio-pro/shell.html'),'utf8');
 for(const match of markup.matchAll(/<([a-z][a-z0-9]*)\b[^>]*\bid="([^"]+)"[^>]*>/gi)){
  const element=new Element(match[1]);
  for(const attr of match[0].matchAll(/\b([a-z-]+)="([^"]*)"/gi))element.setAttribute(attr[1],attr[2]);
  element.hidden=/\shidden(?:\s|>)/.test(match[0]);element.disabled=/\sdisabled(?:\s|>)/.test(match[0]);
 }
 const body=new Element('body');doc.activeElement=body;
 Object.assign(doc,{getElementById:id=>ids.get(id)||null,querySelector:selector=>selector==='dialog[open]'?[...ids.values()].find(element=>element.tagName==='DIALOG'&&element.open)||null:null,
  addEventListener(name,fn){if(!documentListeners.has(name))documentListeners.set(name,[]);documentListeners.get(name).push(fn);},
  dispatchEvent(event){if(event.type==='prostudio:change')changes.push(plain(event.detail));for(const fn of documentListeners.get(event.type)||[])fn(event);return true;}});
 const storage={getItem:key=>saved.get(key)??null,setItem(key,value){if(failWrites){const error=new Error('quota');error.name='QuotaExceededError';throw error;}saved.set(key,value);}};
 const engine={state:'idle',position:0,plays:[],pauses:0,stops:0,pending:[],project:null,epoch:0};
 const handles={arranger:{renders:0,render(){this.renders++;},setPlayhead(tick){this.tick=tick;}},mixer:{render(){},setLevel(level){this.level=level;}},projects:{render(){}}};
 const window={document:doc,localStorage:storage,crypto:{randomUUID:()=>`shell-test-${++uuid}`},
  addEventListener(name,fn){if(!windowListeners.has(name))windowListeners.set(name,[]);windowListeners.get(name).push(fn);},removeEventListener(){},
  ProStudioAudio:{createEngine(callbacks){
   engine.emit=(state,message='')=>{engine.state=state;callbacks.onState(state,message);};
   engine.update=project=>{engine.project=plain(project);return true;};
   engine.play=async(project,startTick)=>{engine.project=plain(project);engine.plays.push({project:plain(project),startTick});if(startTick!==undefined)engine.position=startTick;const epoch=++engine.epoch;engine.emit('pending');if(deferAudio)await new Promise(resolve=>engine.pending.push(resolve));if(epoch!==engine.epoch)return false;engine.emit('playing');return true;};
   engine.pause=()=>{engine.pauses++;engine.epoch++;engine.emit('paused');callbacks.onPosition(engine.position);return engine.position;};
   engine.stop=()=>{engine.stops++;engine.epoch++;engine.position=0;engine.emit('idle');callbacks.onPosition(0);return 0;};
   engine.seek=tick=>{engine.position=engine.project.loop.enabled&&tick>=engine.project.loop.endTick?engine.project.loop.startTick:tick;engine.emit('paused');callbacks.onPosition(engine.position);return engine.position;};
   engine.getState=()=>engine.state;engine.getPosition=()=>engine.position;engine.setMetronome=value=>{engine.metronome=value;};engine.audition=()=>true;
   engine.complete=()=>{engine.position=engine.project.lengthBars*96;callbacks.onPosition(engine.position);engine.emit('idle','Playback selesai.');};return engine;
  }},
  ProStudioArranger:{mount:()=>handles.arranger},ProStudioMixer:{mount:()=>handles.mixer}
 };
 const box={window,document:doc,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),console};
 vm.createContext(box);
 for(const file of ['core.js','projects.js'])vm.runInContext(fs.readFileSync(path.join(base,'studio-pro',file),'utf8'),box,{filename:file});
 window.ProStudioProjectPanel={mount:()=>handles.projects};
 vm.runInContext(fs.readFileSync(path.join(base,'studio-pro/shell.js'),'utf8'),box,{filename:'shell.js'});
 const dispatch=async(name,extra={})=>{const event={target:body,key:'',defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};for(const fn of documentListeners.get(name)||[])await fn(event);return event;};
 return {app:window.ProStudioApp,C:window.ProStudioCore,ids,engine,doc,changes,saved,handles,body,Element,dispatch,
  async windowEvent(name){for(const fn of windowListeners.get(name)||[])await fn({});},
  timers:()=>timers.size,flush(){const entries=[...timers];timers.clear();for(const[,fn]of entries)fn();},async resume(){for(const resolve of engine.pending.splice(0))resolve();for(let i=0;i<5;i++)await Promise.resolve();}};
}

function take(){return {schema:'xylo-studio-take/v2',instrument_id:'xylophone',title:'Dua not',bpm:100,ppq:24,end_tick:48,
 events:[{midi:60,onset_tick:0,duration_tick:24,raw_ms:0},{midi:64,onset_tick:24,duration_tick:24,raw_ms:600}],raw_capture:[{midi:60,raw_ms:0},{midi:64,raw_ms:600}]};}

test('legacy import reports success without opening the shell and rejects unknown input atomically',()=>{
 const s=fixture(),source=take();
 assert.equal(s.app.isActive(),false);assert.equal(s.ids.get('proView').hidden,true);
 assert.equal(s.app.importTake(source),true);assert.equal(s.app.isActive(),false);
 const project=s.app.getProject();assert.equal(project.tracks.length,1);assert.equal(s.app.getSelectedTrackId(),project.tracks[0].id);
 assert.deepEqual(plain(project.tracks[0].sourceTake),source);
 const before=JSON.stringify(project),unknown=take();unknown.events[0].midi=null;
 assert.equal(s.app.importTake(unknown),false);assert.equal(JSON.stringify(s.app.getProject()),before);
 assert.match(s.ids.get('proStatus').textContent,/Semak not/);
 project.tracks[0].name='mutated outside';assert.notEqual(s.app.getProject().tracks[0].name,project.tracks[0].name);
});

test('shared edits validate before committing and grouped mixer changes undo as one action',async()=>{
 const s=fixture();s.app.importTake(take());s.app.enter();const id=s.app.getSelectedTrackId();
 assert.equal(s.app.mutate(project=>s.C.updateTrack(project,id,{volume:.6}),'Tahap',{historyGroup:'mix:1',merge:true}),true);
 assert.equal(s.app.mutate(project=>s.C.updateTrack(project,id,{volume:.4}),'Tahap',{historyGroup:'mix:1',merge:true}),true);
 await s.ids.get('proUndo').fire('click');assert.equal(s.app.getProject().tracks[0].volume,.8);
 await s.ids.get('proRedo').fire('click');assert.equal(s.app.getProject().tracks[0].volume,.4);
 const before=JSON.stringify(s.app.getProject());assert.equal(s.app.mutate(project=>{project.bpm=201;}),false);
 assert.equal(JSON.stringify(s.app.getProject()),before);assert.equal(s.engine.project.bpm,100);
 assert.ok(s.changes.every(change=>change.project.schema==='e-instru-project/v1'));
});

test('add-track controls select each new instrument and show the eight-track limit',async()=>{
 const s=fixture();s.app.enter();
 for(const instrument of Object.keys(s.C.INSTRUMENTS)){
  s.ids.get('proInstrument').value=instrument;await s.ids.get('proAddTrack').fire('click');
  assert.equal(s.app.getSelectedTrackId(),s.app.getProject().tracks.at(-1).id);
  assert.equal(s.app.getProject().tracks.at(-1).instrumentId,instrument);
 }
 assert.equal(s.ids.get('proAddTrack').disabled,true);assert.equal(s.ids.get('proInstrument').disabled,true);assert.equal(s.ids.get('proEmpty').hidden,true);
 assert.equal(s.app.importTake(take()),false);assert.equal(s.app.getProject().tracks.length,8);assert.match(s.ids.get('proStatus').textContent,/8 trek/);
});

test('autosave debounces edits, flushes on leave and restores the active project',()=>{
 const saved=new Map(),s=fixture({saved});s.app.enter();s.app.importTake(take());
 s.app.mutate(project=>{project.title='Latihan kelas';},'Nama');s.app.mutate(project=>{project.bpm=112;},'Tempo');
 assert.equal(saved.size,0);assert.equal(s.timers(),1);s.app.leave();assert.equal(s.timers(),0);
 const restored=fixture({saved});assert.equal(restored.app.getProject().title,'Latihan kelas');assert.equal(restored.app.getProject().bpm,112);
 assert.equal(restored.app.getProject().tracks.length,1);assert.match(restored.ids.get('proSaveStatus').textContent,/dimuatkan/);
});

test('quota and corrupted storage remain visible and never discard the working project or corrupt bytes',()=>{
 const s=fixture({failWrites:true});s.app.enter();s.app.importTake(take());s.flush();
 assert.equal(s.app.getProject().tracks.length,1);assert.match(s.ids.get('proSaveStatus').textContent,/penuh/);assert.ok(s.ids.get('proSaveStatus').classList.contains('is-error'));
 const saved=new Map([['e-instru-pro-projects/v1','{bad data}']]),bad=fixture({saved});bad.app.enter();bad.app.importTake(take());bad.flush();
 assert.equal(saved.get('e-instru-pro-projects/v1'),'{bad data}');assert.match(bad.ids.get('proSaveStatus').textContent,/rosak/);
});

test('replacement cancels a previous autosave rather than resurrecting a deleted active project',()=>{
 const s=fixture();s.app.importTake(take());s.app.enter();s.flush();const id=s.app.getProject().id;
 s.app.mutate(project=>{project.title='Pending edit';});assert.equal(s.app.getStore().remove(id),true);
 const next=s.C.createProject({id:'new-empty'});assert.equal(s.app.replaceProject(next),true);s.flush();
 assert.equal(s.app.getStore().load(id),null);assert.equal(s.app.getStore().getActiveId(),'new-empty');
});

test('transport shortcuts are scoped to active canvas focus and native confirmation restores focus',async()=>{
 const s=fixture();s.app.importTake(take());
 await s.dispatch('keydown',{key:' ',code:'Space'});assert.equal(s.engine.plays.length,0);s.app.enter();
 for(const target of [s.ids.get('proBpm'),s.ids.get('proPlay')]){const event=await s.dispatch('keydown',{target,key:' ',code:'Space'});assert.equal(event.defaultPrevented,false);}
 const edited=new s.Element('div');edited.setAttribute('contenteditable','true');await s.dispatch('keydown',{target:edited,key:' ',code:'Space'});assert.equal(s.engine.plays.length,0);
 const returnTo=s.ids.get('proAddTrack');returnTo.focus();let confirmed=0;
 assert.equal(s.app.confirm({title:'Padam?',message:'Semak projek.',onConfirm:()=>confirmed++}),true);
 assert.equal(s.doc.activeElement,s.ids.get('proConfirmCancel'));await s.dispatch('keydown',{key:' ',code:'Space'});assert.equal(s.engine.plays.length,0);
 await s.ids.get('proConfirmDialog').fire('cancel');assert.equal(confirmed,0);assert.equal(s.doc.activeElement,returnTo);
 await s.dispatch('keydown',{key:' ',code:'Space'});assert.equal(s.engine.state,'playing');
 await s.dispatch('keydown',{key:' ',code:'Space'});assert.equal(s.engine.state,'paused');
 const before=s.app.getProject().tracks.length;const inputUndo=await s.dispatch('keydown',{target:s.ids.get('proProjectTitle'),key:'z',ctrlKey:true});assert.equal(inputUndo.defaultPrevented,false);assert.equal(s.app.getProject().tracks.length,before);
 const undo=await s.dispatch('keydown',{key:'z',metaKey:true});assert.equal(undo.defaultPrevented,true);assert.equal(s.app.getProject().tracks.length,0);
 await s.dispatch('keydown',{key:'Z',metaKey:true,shiftKey:true});assert.equal(s.app.getProject().tracks.length,1);
});

test('native tab keys move selection and loop cursor follows the engine seek result',async()=>{
 const s=fixture();s.app.enter();
 const key=await s.ids.get('proTabArrangement').fire('keydown',{key:'ArrowLeft'});assert.equal(key.defaultPrevented,true);
 assert.equal(s.ids.get('proTabProjects').getAttribute('aria-selected'),'true');assert.equal(s.ids.get('proPanelArrangement').hidden,true);assert.equal(s.ids.get('proPanelProjects').hidden,false);
 await s.ids.get('proTabProjects').fire('keydown',{key:'Home'});assert.equal(s.ids.get('proTabArrangement').tabIndex,0);
 for(const[id,value]of [['proLoopStart','3'],['proLoopEnd','6']]){s.ids.get(id).value=value;await s.ids.get(id).fire('change');}
 s.ids.get('proLoopEnabled').checked=true;await s.ids.get('proLoopEnabled').fire('change');
 s.ids.get('proCursor').value='650';await s.ids.get('proCursor').fire('input');
 assert.equal(s.engine.position,192);assert.equal(s.ids.get('proPosition').textContent,'03:1:00');assert.equal(s.ids.get('proCursor').value,'192');
 s.ids.get('proBpm').value='40.5';await s.ids.get('proBpm').fire('change');assert.equal(s.app.getProject().bpm,100);assert.equal(s.ids.get('proBpm').getAttribute('aria-invalid'),'true');
 s.ids.get('proBpm').value='200';await s.ids.get('proBpm').fire('change');assert.equal(s.app.getProject().bpm,200);assert.equal(s.ids.get('proBpm').getAttribute('aria-invalid'),null);
});

test('blur cancels pending audio, leave stops, and completed playback restarts from zero',async()=>{
 const s=fixture({deferAudio:true});s.app.importTake(take());s.app.enter();
 await s.dispatch('keydown',{key:' ',code:'Space'});assert.equal(s.engine.state,'pending');
 await s.windowEvent('blur');assert.equal(s.engine.state,'paused');await s.resume();assert.equal(s.engine.state,'paused');
 s.app.leave();assert.equal(s.engine.state,'idle');assert.equal(s.app.isActive(),false);assert.equal(s.ids.get('proView').hidden,true);
 const complete=fixture();complete.app.importTake(take());complete.app.enter();await complete.ids.get('proPlay').fire('click');complete.engine.complete();
 assert.equal(complete.ids.get('proPosition').textContent,'01:1:00');assert.equal(complete.ids.get('proStatus').classList.contains('is-error'),false);
 await complete.ids.get('proPlay').fire('click');assert.equal(complete.engine.plays.at(-1).startTick,0);
 complete.doc.hidden=true;await complete.dispatch('visibilitychange');assert.equal(complete.engine.state,'paused');assert.equal(complete.timers(),0);
});
