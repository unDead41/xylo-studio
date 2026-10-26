// Compile emitted headers against the actual Music engine; do not modify that checkout.
const fs=require('node:fs'),vm=require('node:vm'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const i=process.argv.indexOf('--music-root');if(i<0)throw Error('Pass --music-root <actual Music checkout>');const music=path.resolve(process.argv[i+1]);
const box={};vm.createContext(box);vm.runInContext(fs.readFileSync(fs.existsSync('dist/index.html')?'dist/index.html':'index.html','utf8').match(/<script id="xylo-core">([\s\S]*?)<\/script>/)[1],box);const C=box.XyloCore;
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'xylo-export-'));
try{fs.mkdirSync(path.join(tmp,'avr'));fs.writeFileSync(path.join(tmp,'avr/pgmspace.h'),'#pragma once\n#define PROGMEM\n');
const takes=C.PRESETS.map(p=>C.preset(p.id));takes.push(C.fromTaps([{midi:60,raw_ms:0},{midi:64,raw_ms:750},{midi:67,raw_ms:1500}],80,12,2,4));
// A rest and an extended pitch are legal in the real engine; long scores still
// must not claim compatibility with its unchanged 64-event/30-second limits.
const rests=C.empty();rests.events=[{midi:60,onset_tick:0,duration_tick:24},{midi:0,onset_tick:24,duration_tick:24},{midi:70,onset_tick:48,duration_tick:48}];rests.end_tick=96;takes.push(rests);
for(const p of C.PRESETS){let blocked=false;try{C.cpp(C.preset(p.id,4,'long'));}catch(e){if(!/Uno/.test(e.message))throw e;blocked=true;}if(!blocked)throw Error('Long score incorrectly exported for Uno: '+p.title);}
for(let j=0;j<takes.length;j++){
fs.writeFileSync(path.join(tmp,'score.h'),C.cpp(takes[j]));
fs.writeFileSync(path.join(tmp,'main.cpp'),'#include "score.h"\n#include "music/tick_player.h"\n#include <assert.h>\nint main(){xylo::Player p;assert(p.startScore(xylo_studio::song,0,xylo::Mode::ScoreOnly));for(uint32_t ms=0;ms<32000;++ms)p.update(ms);assert(p.state()==xylo::PlayerState::Finished);}\n');
const args=['-std=c++11','-Wall','-Wextra','-Werror','-I'+tmp,'-I'+path.join(music,'include'),path.join(tmp,'main.cpp'),...['src/music/score.cpp','src/music/player.cpp','src/actuators/bank.cpp'].map(p=>path.join(music,p)),'-o',path.join(tmp,'check')];
cp.execFileSync('g++',args,{stdio:'inherit'});cp.execFileSync(path.join(tmp,'check'),[],{stdio:'inherit'});
}console.log('PASS: '+takes.length+' exported headers compile and play to completion with actual Music startScore API.');}finally{fs.rmSync(tmp,{recursive:true,force:true});}
