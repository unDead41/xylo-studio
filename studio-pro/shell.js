(function(){'use strict';
const C=window.ProStudioCore,root=document.getElementById('proView');
if(!C||!root)return;
const $=id=>document.getElementById(id),BAR=C.BAR_TICKS||96,PPQ=C.PPQ||24;
const tabs=[['proTabArrangement','proPanelArrangement'],['proTabMixer','proPanelMixer'],['proTabProjects','proPanelProjects']];
let active=false,project=C.createProject(),history,selectedTrackId=null,position=0,playbackState='idle';
let engine,arranger,mixer,projectPanel,store,saveTimer=null,dirty=false,saveFailed=false,group=null,confirmAction=null,confirmFocus=null;

function dispatch(name,detail){document.dispatchEvent(new CustomEvent('prostudio:'+name,{detail}));}
function announce(message,error=false){$('proStatus').textContent=String(message||'');$('proStatus').classList.toggle('is-error',!!error);}
function storageStatus(message,meta={}){
 saveFailed=meta.level==='error';
 $('proSaveStatus').textContent=String(message||'');
 $('proSaveStatus').classList.toggle('is-error',saveFailed);
}
try{
 store=window.ProStudioProjects?.createStore({onStatus:storageStatus});
 if(store){const id=store.getActiveId(),saved=id&&store.load(id);if(saved&&!C.validate(saved).length){project=C.clone(saved);if(!saveFailed)storageStatus('Projek terakhir dimuatkan dari pelayar.');}}
}catch(error){storageStatus('Simpanan pelayar tidak tersedia. Eksport JSON untuk menyimpan projek.',{level:'error'});}
history=C.createHistory(project);
selectedTrackId=project.tracks[0]?.id||null;

function currentProject(){return C.clone(project);}
function normalizeSelection(){
 const before=selectedTrackId;
 if(!project.tracks.some(track=>track.id===selectedTrackId))selectedTrackId=project.tracks[0]?.id||null;
 if(before!==selectedTrackId)dispatch('selection',{trackId:selectedTrackId});
}
function canEdit(){return !document.querySelector('dialog[open]');}
function renderControls(){
 const hasEvents=project.tracks.some(track=>track.events.length);
 $('proPlay').disabled=!hasEvents||playbackState==='playing'||playbackState==='pending';
 $('proPlay').textContent=playbackState==='paused'?'▶ Sambung':'▶ Main';
 $('proPause').disabled=playbackState!=='playing'&&playbackState!=='pending';
 $('proUndo').disabled=!history.canUndo();$('proRedo').disabled=!history.canRedo();
 $('proTransportState').textContent=({idle:'Sedia',pending:'Membuka audio…',playing:'Sedang main',paused:'Dijeda',disposed:'Audio ditutup'})[playbackState]||'Sedia';
 $('proAddTrack').disabled=project.tracks.length>=8;
 $('proInstrument').disabled=project.tracks.length>=8;
 $('proAddTrack').title=project.tracks.length>=8?'Had 8 trek telah dicapai.':'Tambah instrumen yang dipilih';
}
function renderPosition(tick){
 position=Math.max(0,Math.min(project.lengthBars*BAR-1,Math.floor(Number(tick)||0)));
 const bar=Math.floor(position/BAR)+1,beat=Math.floor(position% BAR/PPQ)+1,part=position%PPQ;
 $('proPosition').textContent=String(bar).padStart(2,'0')+':'+beat+':'+String(part).padStart(2,'0');
 $('proCursor').value=String(position);
 $('proCursor').setAttribute('aria-valuetext','Bar '+bar+', beat '+beat+', tick '+part);
 arranger?.setPlayhead?.(position);
 dispatch('position',{tick:position});
}
function renderShell(){
 const values={proProjectTitle:project.title,proBpm:project.bpm,proLength:project.lengthBars,proLoopStart:Math.floor(project.loop.startTick/BAR)+1,proLoopEnd:Math.ceil(project.loop.endTick/BAR)};
 for(const[id,value]of Object.entries(values)){const input=$(id);if(document.activeElement!==input){input.value=String(value);input.removeAttribute('aria-invalid');}}
 $('proLoopEnabled').checked=project.loop.enabled;
 $('proLoopStart').max=String(project.lengthBars);$('proLoopEnd').max=String(project.lengthBars);
 $('proCursor').max=String(project.lengthBars*BAR-1);
 $('proTrackSummary').textContent=project.tracks.length+' / 8 trek';
 $('proTimingMeta').textContent=project.lengthBars+' bar · '+(project.loop.enabled?'Ulang bar '+(Math.floor(project.loop.startTick/BAR)+1)+'–'+Math.ceil(project.loop.endTick/BAR):'Ulangan dimatikan');
 $('proEmpty').hidden=project.tracks.length>0;
 renderControls();renderPosition(position);
}
function queueSave(){
 dirty=true;
 if(saveTimer!==null)clearTimeout(saveTimer);
 if(!saveFailed)storageStatus('Menyimpan…');
 saveTimer=setTimeout(()=>{saveTimer=null;flushSave();},650);
}
function flushSave(){
 if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;}
 if(!dirty)return true;
 if(!store){storageStatus('Simpanan pelayar tidak tersedia. Eksport JSON untuk menyimpan projek.',{level:'error'});return false;}
 try{
  const saved=store.save(currentProject());
  if(!saved){storageStatus(store.getStatus?.().message||'Projek belum disimpan. Eksport JSON melalui tab Projek.',{level:'error'});return false;}
  if(!store.setActiveId(project.id)){storageStatus(store.getStatus?.().message||'Projek aktif belum disimpan. Eksport JSON melalui tab Projek.',{level:'error'});return false;}
  dirty=false;
  storageStatus('Disimpan dalam pelayar.');
  return true;
 }catch(error){storageStatus('Projek belum disimpan. Eksport JSON melalui tab Projek.',{level:'error'});return false;}
}
function changed(label){
 normalizeSelection();
 engine?.update(project);
 renderShell();queueSave();
 dispatch('change',{project:currentProject(),label:String(label||'Projek dikemas kini')});
}
function mutate(transform,label,options={}){
 try{
  const draft=currentProject(),result=transform(draft),next=result===undefined?draft:result,errors=C.validate(next);
  if(errors.length)throw Error(errors[0]);
  if(JSON.stringify(next)===JSON.stringify(project))return true;
  const now=Date.now(),key=options.historyGroup||null;
  const replaceLast=!!(options.merge&&key&&group?.key===key&&now-group.at<=600);
  project=history.commit(C.clone(next),{replaceLast});
  group=options.merge&&key?{key,at:now}:null;
  changed(label);
  return true;
 }catch(error){announce(error.message||'Perubahan tidak dapat digunakan.',true);return false;}
}
function replaceProject(next,label='Projek dimuatkan'){
 try{
  const errors=C.validate(next);if(errors.length)throw Error(errors[0]);
  if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null;}
  engine?.stop();project=C.clone(next);history=C.createHistory(project);group=null;selectedTrackId=project.tracks[0]?.id||null;position=0;
  dispatch('selection',{trackId:selectedTrackId});
  changed(label);announce(label);return true;
 }catch(error){announce(error.message||'Projek tidak sah.',true);return false;}
}
function selectTrack(id){
 if(id!==null&&!project.tracks.some(track=>track.id===id))return false;
 if(selectedTrackId!==id){selectedTrackId=id;dispatch('selection',{trackId:id});}
 return true;
}
function undo(){
 if(!history.canUndo())return;group=null;project=history.undo();changed('Perubahan diundur');announce('Perubahan diundur.');
}
function redo(){
 if(!history.canRedo())return;group=null;project=history.redo();changed('Perubahan diulang');announce('Perubahan diulang.');
}
function setTab(index,focus=false){
 for(let i=0;i<tabs.length;i++){
  const[tab,panel]=tabs[i];$(tab).setAttribute('aria-selected',String(i===index));$(tab).tabIndex=i===index?0:-1;$(panel).hidden=i!==index;
 }
 if(focus)$(tabs[index][0]).focus();
 if(index===0)arranger?.render?.();if(index===1)mixer?.render?.();if(index===2)projectPanel?.render?.();
}
async function play(){
 if(!active||!canEdit()||!engine)return false;
 if(!project.tracks.some(track=>track.events.length)){announce('Isi beberapa langkah dalam Susunan dahulu.');return false;}
 try{return await engine.play(project,playbackState==='paused'?undefined:position);}
 catch(error){announce(error.message||'Audio tidak dapat dimainkan.',true);return false;}
}
function pause(message){engine?.pause();if(message)announce(message);}
function stop(){engine?.stop();renderPosition(0);}
function confirmChange({title='Sahkan perubahan',message='',confirmLabel='Teruskan',onConfirm}={}){
 if(!active||!canEdit()||typeof onConfirm!=='function')return false;
 const dialog=$('proConfirmDialog');
 $('proConfirmTitle').textContent=title;$('proConfirmMessage').textContent=message;$('proConfirmAccept').textContent=confirmLabel;
 confirmAction=onConfirm;confirmFocus=document.activeElement;
 dialog.showModal();$('proConfirmCancel').focus();return true;
}
function lifecyclePause(){
 if(!active)return;
 const wasPlaying=playbackState==='playing'||playbackState==='pending';
 if(playbackState==='idle')engine?.stop();else engine?.pause();
 if(wasPlaying)announce('Main semula dijeda. Tekan Sambung apabila bersedia.');
}

window.ProStudioApp={
 enter(){
  active=true;root.hidden=false;engine?.update(project);renderShell();
  arranger?.render?.();mixer?.render?.();projectPanel?.render?.();
  if(!store?.load(project.id)&&!dirty)queueSave();
  return true;
 },
 leave(){
  active=false;engine?.stop();
  if($('proConfirmDialog').open)$('proConfirmDialog').close();
  flushSave();root.hidden=true;return true;
 },
 getProject:currentProject,getSelectedTrackId:()=>selectedTrackId,selectTrack,mutate,replaceProject,announce,
 audition(track,event){if(!active||!canEdit()||!engine)return false;return engine.audition(track,event);},
 getStore:()=>store,confirm:confirmChange,
 importTake(take){
  const before=new Set(project.tracks.map(track=>track.id));
  if(!mutate(draft=>C.importTake(draft,take),'Rakaman ditambah sebagai trek'))return false;
  const imported=project.tracks.find(track=>!before.has(track.id));if(imported)selectTrack(imported.id);
  setTab(0);announce('Rakaman ditambah ke Studio Pro. Masa input asal dikekalkan.');return true;
 },
 isActive:()=>active
};

if(window.ProStudioAudio){
 engine=window.ProStudioAudio.createEngine({
  onPosition:renderPosition,
  onState(state,message){playbackState=state;if(state==='idle'&&engine?.getPosition()>=project.lengthBars*BAR)renderPosition(0);renderControls();dispatch('transport',{state});if(message)announce(message);},
  onMeter(level){mixer?.setLevel?.(level);dispatch('meter',{level});}
 });
 engine.update(project);
}else announce('Enjin audio tidak tersedia.',true);
const app=window.ProStudioApp;
arranger=window.ProStudioArranger?.mount($('proArrangement'),app);
mixer=window.ProStudioMixer?.mount($('proMixer'),app);
projectPanel=window.ProStudioProjectPanel?.mount($('proProjects'),app);

$('proPlay').addEventListener('click',play);
$('proPause').addEventListener('click',()=>pause('Main semula dijeda.'));
$('proStop').addEventListener('click',()=>{stop();announce('Main semula dihentikan.');});
$('proUndo').addEventListener('click',undo);$('proRedo').addEventListener('click',redo);
$('proProjectTitle').addEventListener('change',()=>{
 const value=$('proProjectTitle').value.trim();
 if(!value){$('proProjectTitle').value=project.title;announce('Nama projek tidak boleh kosong.',true);return;}
 mutate(draft=>C.updateProject(draft,{title:value}),'Nama projek diubah');
});
function numericEdit(id,min,max,apply){
 $(id).addEventListener('change',()=>{
  const input=$(id),value=Number(input.value),valid=input.value.trim()!==''&&Number.isInteger(value)&&value>=min&&value<=(typeof max==='function'?max():max);
  input.removeAttribute('aria-invalid');
  if(!valid){input.setAttribute('aria-invalid','true');announce('Masukkan nombor bulat '+min+' hingga '+(typeof max==='function'?max():max)+'.',true);return;}
  const ok=apply(value);if(!ok)input.setAttribute('aria-invalid','true');
 });
}
numericEdit('proBpm',40,200,value=>mutate(draft=>C.updateProject(draft,{bpm:value}),'Tempo diubah'));
numericEdit('proLength',4,32,value=>{
 const end=value*BAR,loop={...project.loop,startTick:Math.min(project.loop.startTick,end-BAR),endTick:project.loop.endTick===project.lengthBars*BAR?end:Math.min(project.loop.endTick,end)};
 return mutate(draft=>C.updateProject(draft,{lengthBars:value,loop}),'Panjang projek diubah');
});
numericEdit('proLoopStart',1,()=>project.lengthBars,value=>mutate(draft=>C.updateProject(draft,{loop:{...draft.loop,startTick:(value-1)*BAR}}),'Mula ulangan diubah'));
numericEdit('proLoopEnd',1,()=>project.lengthBars,value=>mutate(draft=>C.updateProject(draft,{loop:{...draft.loop,endTick:value*BAR}}),'Akhir ulangan diubah'));
$('proLoopEnabled').addEventListener('change',()=>{if(!mutate(draft=>C.updateProject(draft,{loop:{...draft.loop,enabled:$('proLoopEnabled').checked}}),'Ulangan diubah'))$('proLoopEnabled').checked=project.loop.enabled;});
$('proMetronome').addEventListener('change',()=>engine?.setMetronome($('proMetronome').checked));
$('proCursor').addEventListener('input',()=>{const tick=Number($('proCursor').value);renderPosition(engine?engine.seek(tick):tick);});
$('proAddTrack').addEventListener('click',()=>{
 const before=new Set(project.tracks.map(track=>track.id));
 if(mutate(draft=>C.addTrack(draft,$('proInstrument').value),'Trek ditambah')){
  const added=project.tracks.find(track=>!before.has(track.id));if(added){selectTrack(added.id);announce('Trek '+added.name+' ditambah. Isi langkah untuk mula.');}
 }
});
for(let index=0;index<tabs.length;index++){
 const tab=$(tabs[index][0]);tab.addEventListener('click',()=>setTab(index));
 tab.addEventListener('keydown',event=>{
  let next=index;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;
  event.preventDefault();setTab(next,true);
 });
}
$('proConfirmCancel').addEventListener('click',()=>$('proConfirmDialog').close());
$('proConfirmAccept').addEventListener('click',()=>{
 const action=confirmAction;confirmAction=null;$('proConfirmDialog').close();
 try{action?.();}catch(error){announce(error.message||'Perubahan tidak dapat digunakan.',true);}
});
$('proConfirmDialog').addEventListener('cancel',event=>{event.preventDefault();$('proConfirmDialog').close();});
$('proConfirmDialog').addEventListener('close',()=>{confirmAction=null;const previous=confirmFocus;confirmFocus=null;if(active&&previous?.isConnected)previous.focus();});
document.addEventListener('keydown',event=>{
 if(!active||event.defaultPrevented||event.repeat||event.isComposing||!canEdit())return;
 const target=event.target,editor=target?.closest?.('input,textarea,select,[contenteditable],[role="textbox"]');
 if(editor)return;
 if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();return;}
 if((event.code==='Space'||event.key===' ')&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&!target?.closest?.('button,a,summary,[role="button"],[role="tab"]')){
  event.preventDefault();if(playbackState==='playing'||playbackState==='pending')pause('Main semula dijeda.');else play();
 }
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){lifecyclePause();flushSave();}});
window.addEventListener('blur',lifecyclePause);
window.addEventListener('pagehide',()=>{lifecyclePause();flushSave();});
renderShell();
})();
