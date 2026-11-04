'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
function translator(){
 const window={addEventListener(){},document:null};
 const context={window,document:null,localStorage:{getItem:()=>null,setItem(){}}};
 vm.runInNewContext(html.match(/<script id="studio-i18n">([\s\S]*?)<\/script>/)[1],context);
 return window.StudioI18n;
}
test('new studio and accessible display controls participate in the retained language owner',()=>{
 const api=translator();
 for(const phrase of ['Susunan','Projek','Panjang & ulangan','Paparan yang selesa','Warna dan kontras','Kontras tinggi','Tambah ke Studio Pro','Instrumen untuk trek baharu','Tahap output']){
  assert.notEqual(api.t(phrase,'en'),phrase,'Missing new UI translation: '+phrase);assert.equal(api.t(phrase,'ms'),phrase);
 }
});
test('new translation corpus is bundled and contains complete matching template captures',()=>{
 const corpus=JSON.parse(fs.readFileSync('studio-pro/i18n.json','utf8')),api=translator(),phrases=new Set();
 assert.ok(corpus.entries.length>=100);assert.ok(corpus.templates.length>=10);
 for(const pair of corpus.entries){assert.equal(pair.length,2);assert.ok(pair.every(value=>typeof value==='string'&&value.trim()));assert.ok(!phrases.has(pair[0]),'Duplicate extra phrase '+pair[0]);phrases.add(pair[0]);assert.ok(api.t(pair[0],'en').trim());}
 const fields=s=>[...new Set([...s.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map(m=>m[1]))].sort();
 for(const item of corpus.templates)assert.deepEqual(fields(item.ms),fields(item.en),'Incomplete template: '+item.ms);
});
test('language and display preferences remain independent native controls',()=>{
 assert.match(html,/<select\b[^>]*id="languageSelect"/);assert.match(html,/<select\b[^>]*id="displayTheme"/);assert.match(html,/<select\b[^>]*id="displayVision"/);
 const api=translator();assert.equal(api.t('My custom track Rakam 743.5ms','en'),'My custom track Rakam 743.5ms');
 assert.match(fs.readFileSync('studio-pro/display.js','utf8'),/e-instru-display-v1/);assert.match(html,/e-instru-language/);
});
test('mixer and destructive-dialog templates preserve dictionary-matching user titles in both directions',()=>{
 const api=translator();
 for(const [ms,en]of [
  ['Bisu Rakam','Mute Rakam'],
  ['Solo Henti dihidupkan.','Solo Henti on.'],
  ['Pan Rakam: Kiri 40%.','Pan Rakam: Left 40%.'],
  ['Salinan “Rakam” dalam pelayar akan dipadam. Eksport JSON dahulu jika diperlukan.','The copy “Rakam” will be deleted from this browser. Export JSON first if needed.']
 ]){assert.equal(api.t(ms,'en'),en);assert.equal(api.t(en,'ms'),ms);}
});
test('continued bar and starter workflows translate controls and dynamic feedback',()=>{
 const api=translator();
 for(const [ms,en]of [
  ['Alat bar','Bar tools'],['Salin bar','Copy bar'],['Tampal bar','Paste bar'],['Kosongkan bar','Clear bar'],
  ['Cuba contoh projek','Try a starter project'],['Mulakan dengan contoh','Start from an example'],['Buka contoh','Open example'],
  ['Melodi dan rentak','Melody and rhythm'],['Rentak sekolah','School rhythm'],['Rentak perarakan','Marching rhythm'],
  ['Bar 3 ditampal.','Bar 3 pasted.'],
  ['Salinan: Rekoder Soprano · bar 2 · 3 not.','Copied: Soprano Recorder · bar 2 · 3 notes.']
 ]){assert.equal(api.t(ms,'en'),en);assert.equal(api.t(en,'ms'),ms);}
});
