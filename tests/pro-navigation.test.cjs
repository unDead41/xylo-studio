'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {studio}=require('./helpers/studio.cjs');
function fixture(){
 const s=studio({percussion:true,chooser:true});
 vm.runInNewContext(fs.readFileSync('studio-pro/core.js','utf8'),{window:s.window});
 const C=s.window.ProStudioCore;let project=C.createProject(),active=false,message='';
 s.window.ProStudioApp={enter(){active=true;s.ids.get('proView').hidden=false;},leave(){active=false;s.ids.get('proView').hidden=true;},isActive:()=>active,announce:v=>message=v,importTake(take){try{project=C.importTake(project,take);return true;}catch(error){message=error.message;return false;}}};
 return {...s,getProject:()=>project,getMessage:()=>message};
}
test('Pro returns to pitched Studio with a visible workspace and matching navigation state',async()=>{
 const s=fixture();await s.ids.get('chooseXylophone').click();await s.ids.get('proModeBtn').click();
 assert.equal(s.ids.get('proView').hidden,false);assert.equal(s.document.title,'Studio Pro · e-Instru Studio');
 await s.ids.get('studioModeBtn').click();assert.equal(s.ids.get('proView').hidden,true);assert.equal(s.ids.get('studioView').hidden,false);assert.equal(s.ids.get('gameView').hidden,true);assert.equal(s.ids.get('instrumentChooser').hidden,true);assert.equal(s.ids.get('studioModeBtn').getAttribute('aria-pressed'),'true');assert.equal(s.document.title,'Xylophone · e-Instru Studio');
});
test('chooser Pro entry, Game and chooser returns never strand all views hidden',async()=>{
 const s=fixture();await s.ids.get('choosePro').click();await s.ids.get('gameModeBtn').click();
 assert.equal(s.ids.get('proView').hidden,true);assert.equal(s.ids.get('gameView').hidden,false);
 await s.ids.get('proModeBtn').click();await s.ids.get('proBack').click();assert.equal(s.ids.get('instrumentChooser').hidden,false);assert.equal(s.ids.get('proView').hidden,true);
 await s.ids.get('chooseRecorder').click();assert.equal(s.ids.get('studioView').hidden,false);assert.equal(s.ids.get('studioModeBtn').getAttribute('aria-pressed'),'true');assert.equal(s.ids.get('proModeBtn').getAttribute('aria-pressed'),'false');
});
test('pitched take bridge copies the source and imports the exact sounding score',async()=>{
 const s=fixture();await s.ids.get('chooseXylophone').click();const source=s.window.XyloStudioBridge.getTake(),before=JSON.stringify(source);
 await s.ids.get('sendToPro').click();const p=s.getProject();assert.equal(p.tracks.length,1);assert.equal(p.tracks[0].instrumentId,'xylophone');assert.equal(p.tracks[0].events.length,source.events.filter(e=>e.midi>0).length);assert.equal(JSON.stringify(s.window.XyloStudioBridge.getTake()),before);source.title='external mutation';assert.notEqual(s.window.XyloStudioBridge.getTake().title,source.title);
});
test('all six percussion studios send independent recorded actions into Pro',async()=>{
 for(const [id,choose,prefix,action]of [['tamborin','chooseTamborin','perc','tap'],['kompang','chooseKompang','komp','center'],['snare','chooseSnare','snare','hit'],['bass_drum','chooseBassDrum','bass','hit'],['cymbals','chooseCymbals','cym','crash'],['triangle','chooseTriangle','tri','open']]){
  const s=fixture();await s.ids.get(choose).click();await s.ids.get(prefix+'Record').click();await s.settle();
  const button=s.ids.get(prefix+'Tap');assert.ok(button,'actual primary pad '+prefix+'Tap');await button.fire('pointerdown',{pointerId:1,button:0});await s.settle();await s.ids.get(prefix+'Stop').click();await s.ids.get(prefix+'SendToPro').click();
  const p=s.getProject();assert.equal(p.tracks.length,1,id);assert.equal(p.tracks[0].instrumentId,id);assert.equal(p.tracks[0].events[0].action,action);assert.equal(p.tracks[0].events[0].midi,null);assert.equal(p.tracks[0].sourceTake.raw_capture[0].raw_ms,0);
 }
});
