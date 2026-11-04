'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const html=fs.readFileSync('index.html','utf8');
test('self-contained deliverable contains current Studio Pro module sources',()=>{
 const result=spawnSync(process.execPath,['scripts/embed-studio-pro.cjs','--check'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);
 for(const name of ['core','audio','arranger','mixer','projects','shell'])assert.match(html,new RegExp('<script id="pro-'+name+'">'));
 assert.match(html,/<script id="studio-display">/);assert.doesNotMatch(html,/<script\b[^>]*\bsrc=/i);
});
test('every actual inline script compiles and literal document IDs are unique',()=>{
 const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)];assert.ok(scripts.length>=18);
 for(const [i,match]of scripts.entries())assert.doesNotThrow(()=>new vm.Script(match[1],{filename:'index:inline-'+i}));
 const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'');
 const ids=[...markup.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size,'duplicate document ID');
});
test('display boot applies stored theme before the document body is rendered',()=>{
 assert.ok(html.indexOf('id="studio-display"')<html.indexOf('<body'));
 const css=fs.readFileSync('studio-pro/display.css','utf8');assert.match(css,/:root\[data-theme=dark\]\{[^}]*--on-primary:#101B26/);
 assert.match(css,/button:not\(\.bar\):hover/);assert.match(css,/\.anatomy-label\{fill:var\(--muted\)/);
});
