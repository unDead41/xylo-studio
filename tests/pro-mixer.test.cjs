const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const mixerSource=fs.readFileSync(path.join(__dirname,'../studio-pro/mixer.js'),'utf8');
const coreSource=fs.readFileSync(path.join(__dirname,'../studio-pro/core.js'),'utf8');

// The fixture exercises the actual component and validated core through a
// small DOM/shared-app boundary.
// It does not model native pointer geometry or measure physical audio.
function fixture({empty=false,reject=false}={}){
 class Target{
  constructor(){this.listeners=new Map();}
  addEventListener(type,fn){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(fn);}
  removeEventListener(type,fn){this.listeners.get(type)?.delete(fn);}
  fire(type,extra={}){for(const fn of [...(this.listeners.get(type)||[])])fn({type,target:this,...extra});}
 }
 const document=new Target();document.activeElement=null;
 class Element extends Target{
  constructor(tag){super();this.tagName=tag.toUpperCase();this.ownerDocument=document;this.children=[];this.parentNode=null;this.dataset={};this.attrs={};this.className='';this._text='';this.value='';this.hidden=false;this.disabled=false;
   this.classList={toggle:(token,on)=>{const classes=new Set(this.className.split(/\s+/).filter(Boolean));if(on)classes.add(token);else classes.delete(token);this.className=[...classes].join(' ');}};
  }
  set textContent(value){this._text=String(value);for(const child of this.children)child.parentNode=null;this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join('');}
  append(...nodes){for(const node of nodes)this.insertBefore(node,null);}
  insertBefore(node,reference){if(node===reference)return;node.remove();const index=reference===null?this.children.length:this.children.indexOf(reference);this.children.splice(index,0,node);node.parentNode=this;}
  remove(){if(this.parentNode){const siblings=this.parentNode.children;siblings.splice(siblings.indexOf(this),1);this.parentNode=null;}}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(name,value){this.attrs[name]=String(value);}
  getAttribute(name){return this.attrs[name]??null;}
  removeAttribute(name){delete this.attrs[name];}
  focus(){document.activeElement=this;this.fire('focus');}
 }
 document.createElement=tag=>new Element(tag);
 const container=new Element('div');
 const copy=value=>JSON.parse(JSON.stringify(value));
 const window={document};
 vm.runInNewContext(coreSource,{window,console});
 const core=window.ProStudioCore;
 const track=(id,name,instrumentId)=>({id,name,instrumentId,volume:.8,pan:0,muted:false,solo:false,reverb:0,delay:0,events:[{id:'note-'+id,tick:0,durationTick:24,midi:72,action:null,velocity:.8}]});
 let project=core.createProject({id:'test-project',title:'Mixer test',tracks:empty?[]:[track('track-a','Melodi','xylophone'),track('track-b','Rekoder','recorder')]});
 let selectedId=project.tracks[0]?.id??null;
 const mutations=[],announcements=[];
 const app={
  getProject:()=>copy(project),getSelectedTrackId:()=>selectedId,
  selectTrack(id){selectedId=id;document.fire('prostudio:selection',{detail:{trackId:id}});},
  mutate(transform,label,options){if(reject)return false;const before=copy(project);project=transform(copy(project));mutations.push({label,options,before,after:copy(project)});document.fire('prostudio:change',{detail:{project:copy(project)}});return true;},
  announce:message=>announcements.push(message)
 };
 vm.runInNewContext(mixerSource,{window,console});
 const mixer=window.ProStudioMixer.mount(container,app);
 function all(predicate,node=container){const result=[];if(predicate(node))result.push(node);for(const child of node.children)result.push(...all(predicate,child));return result;}
 const labelled=name=>all(node=>node.getAttribute('aria-label')===name)[0];
 const range=name=>labelled(name);
 const output=input=>all(node=>node.tagName==='OUTPUT'&&node.getAttribute('for')===input.id)[0];
 const input=(control,value,extra={})=>{control.value=String(value);control.fire('input',extra);};
 return{mixer,container,document,app,mutations,announcements,all,labelled,range,output,input,get project(){return copy(project);},replace(next){project=copy(next);document.fire('prostudio:change');},get selectedId(){return selectedId;}};
}

test('native volume and pan controls persist precise values without rebuilding a focused range',()=>{
 const s=fixture(),volume=s.range('Tahap Melodi'),pan=s.range('Pan Melodi');
 volume.focus();volume.fire('pointerdown');
 s.input(volume,.73);s.input(volume,.41);
 assert.equal(s.project.tracks[0].volume,.41);
 assert.equal(s.output(volume).textContent,'41%');
 assert.equal(volume.getAttribute('aria-valuetext'),'41%');
 assert.equal(s.range('Tahap Melodi'),volume);
 assert.equal(s.document.activeElement,volume);
 assert.equal(s.mutations[0].options.historyGroup,s.mutations[1].options.historyGroup);
 volume.fire('change');volume.fire('pointerdown');s.input(volume,.62);volume.fire('change');
 assert.notEqual(s.mutations[1].options.historyGroup,s.mutations[2].options.historyGroup);
 assert.match(s.announcements.at(-1),/62%/);
 s.input(pan,-.35);pan.fire('change');
 assert.equal(s.project.tracks[0].pan,-.35);
 assert.equal(s.output(pan).textContent,'Kiri 35%');
 s.input(pan,0);pan.fire('change');assert.equal(s.output(pan).textContent,'Tengah');
 assert.equal(s.project.tracks[0].events[0].tick,0);
});

test('Bisu and Solo reflect persisted state and retain independent text and pressed semantics',()=>{
 const s=fixture(),mute=s.labelled('Bisu Melodi'),solo=s.labelled('Solo Rekoder');
 mute.fire('click');assert.equal(s.project.tracks[0].muted,true);assert.equal(mute.getAttribute('aria-pressed'),'true');assert.equal(mute.textContent,'Bisu aktif');
 solo.fire('click');assert.equal(s.project.tracks[1].solo,true);assert.equal(solo.getAttribute('aria-pressed'),'true');assert.equal(solo.textContent,'Solo aktif');
 mute.fire('click');assert.equal(s.project.tracks[0].muted,false);
 assert.match(s.container.textContent,/Senyap: trek lain dalam Solo/);
 solo.fire('click');assert.equal(s.project.tracks[1].solo,false);assert.match(s.container.textContent,/Dalam adunan/);
});

test('selecting a track retargets stable effect controls and reset affects only that track',()=>{
 const s=fixture(),reverb=s.range('Reverb Melodi');
 s.input(reverb,.26);reverb.fire('change');
 s.labelled('Pilih trek Rekoder').fire('click');
 assert.equal(s.selectedId,'track-b');assert.equal(s.range('Reverb Rekoder'),reverb);assert.equal(reverb.value,'0');
 s.input(reverb,.48);reverb.fire('change');
 const delay=s.range('Delay Rekoder');s.input(delay,.31);delay.fire('change');
 assert.equal(s.project.tracks[0].reverb,.26);assert.equal(s.project.tracks[1].reverb,.48);assert.equal(s.project.tracks[1].delay,.31);
 s.labelled('Reset Reverb dan Delay Rekoder').fire('click');
 assert.equal(s.project.tracks[0].reverb,.26);assert.equal(s.project.tracks[1].reverb,0);assert.equal(s.project.tracks[1].delay,0);
 assert.equal(s.output(reverb).textContent,'0%');assert.equal(s.labelled('Reset Reverb dan Delay Rekoder').disabled,true);
 assert.equal(s.all(node=>node.tagName==='DETAILS').length,1);
});

test('master controls save volume while meter changes only from engine values',()=>{
 const s=fixture(),master=s.range('Tahap utama'),meter=s.all(node=>node.tagName==='METER')[0];
 assert.equal(meter.value,0);s.input(master,.57);master.fire('change');assert.equal(s.project.master.volume,.57);assert.equal(meter.value,0);
 s.mixer.setLevel(.37);assert.equal(meter.value,.37);assert.equal(meter.getAttribute('aria-valuetext'),'Tahap output 37 peratus');
 s.mixer.render();assert.equal(meter.value,.37);
 s.mixer.setLevel(NaN);assert.equal(meter.value,0);s.mixer.setLevel(4);assert.equal(meter.value,1);s.mixer.setLevel(-2);assert.equal(meter.value,0);
 assert.match(s.container.textContent,/Tahap output/);
 assert.match(s.container.textContent,/Tahap isyarat projek. Kelantangan pembesar suara dilaras pada peranti/);
});

test('empty projects disable effects and replacement/deletion maintains control identity and focus',()=>{
 const empty=fixture({empty:true});assert.equal(empty.range('Reverb').disabled,true);assert.match(empty.container.textContent,/Belum ada trek/);
 const s=fixture(),oldVolume=s.range('Tahap Melodi'),secondVolume=s.range('Tahap Rekoder');oldVolume.focus();
 const next=s.project;next.tracks.shift();s.replace(next);
 assert.equal(s.range('Tahap Rekoder'),secondVolume);
 assert.equal(s.document.activeElement,s.labelled('Pilih trek Rekoder'));
 const again=s.project;again.tracks.push({...again.tracks[0],id:'track-c',name:'Baru',events:[]});s.replace(again);
 const ids=s.all(node=>node.tagName==='INPUT').map(node=>node.id);assert.equal(new Set(ids).size,ids.length);
 assert.equal(oldVolume.listeners.get('input').size,0);
});

test('rejected changes restore the persisted value and dispose removes shared listeners',()=>{
 const s=fixture({reject:true}),volume=s.range('Tahap Melodi');
 s.input(volume,.24);assert.equal(s.project.tracks[0].volume,.8);assert.equal(volume.value,'0.8');assert.equal(s.output(volume).textContent,'80%');
 s.mixer.dispose();s.mixer.dispose();assert.equal(s.container.children.length,0);
 assert.equal(s.document.listeners.get('prostudio:change').size,0);assert.equal(s.document.listeners.get('prostudio:selection').size,0);assert.equal(s.document.listeners.get('pointerup').size,0);
 volume.fire('input');s.mixer.render();s.mixer.setLevel(.9);assert.equal(s.container.children.length,0);assert.equal(s.mutations.length,0);
});

test('custom track names opt out of translation while mixer controls remain translatable',()=>{
 const s=fixture(),next=s.project;next.tracks[0].name='Rakam';next.tracks[1].name='Henti';s.replace(next);
 const names=s.all(node=>node.className==='pm-track-name');
 assert.deepEqual(names.map(node=>node.textContent),['Rakam','Henti']);
 assert.ok(names.every(node=>node.getAttribute('data-i18n-ignore')===''));
 const selectedName=s.all(node=>node.className==='pm-effects-track')[0];
 assert.equal(selectedName.textContent,'Rakam');assert.equal(selectedName.getAttribute('data-i18n-ignore'),'');
 assert.equal(s.labelled('Pilih trek Rakam').getAttribute('data-i18n-ignore'),null);
 assert.equal(s.labelled('Bisu Rakam').getAttribute('data-i18n-ignore'),null);
 assert.equal(s.range('Reverb Rakam').getAttribute('data-i18n-ignore'),null);
 assert.ok(s.all(node=>node.className==='pm-instrument').every(node=>node.getAttribute('data-i18n-ignore')===null));
 s.labelled('Pilih trek Henti').fire('click');assert.equal(selectedName.textContent,'Henti');
 const empty=s.project;empty.tracks=[];s.replace(empty);
 assert.equal(selectedName.getAttribute('data-i18n-ignore'),null);assert.equal(selectedName.textContent,'Pilih trek selepas menambah instrumen.');
});
