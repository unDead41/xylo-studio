'use strict';
// Shares Studio Pro's display sources without requiring its unrelated modules.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8').trim();
function place(html,name,body,before){
 const start='<!-- studio-display:'+name+':start -->',end='<!-- studio-display:'+name+':end -->';
 const a=html.indexOf(start),b=html.indexOf(end),block=start+'\n'+body+'\n'+end;
 if(a>=0){if(b<a||html.indexOf(start,a+1)>=0)throw Error('Invalid display '+name+' markers');return html.slice(0,a)+block+html.slice(b+end.length);}
 if(!html.includes(before))throw Error('Missing insertion point '+before);
 return html.replace(before,block+'\n'+before);
}
let html=read('index.html')+'\n';
html=place(html,'boot','<script id="studio-display">\n'+read('studio-pro/display.js').replace(/<\/script/gi,'<\\/script')+'\n</script>','<meta name="theme-color"');
const styles=['display'];
html=place(html,'styles','<style id="display-styles">\n'+styles.map(name=>read('studio-pro/'+name+'.css')).join('\n')+'\n</style>','</head>');
html=place(html,'dialog',read('studio-pro/display.html'),'</main>');
const button='<button type="button" id="displaySettingsBtn" class="display-trigger" aria-haspopup="dialog" aria-controls="displayDialog" aria-expanded="false">Paparan</button>';
if(!html.includes('id="displaySettingsBtn"')){
 const header=html.indexOf('<header class="header">'),navEnd=html.indexOf('</nav>',header);
 if(header<0||navEnd<0)throw Error('Missing shared header navigation');
 html=html.slice(0,navEnd+6)+button+html.slice(navEnd+6);
}
if(process.argv.includes('--check')){
 if(html!==fs.readFileSync(path.join(root,'index.html'),'utf8')){console.error('Embedded display sources are stale. Run node scripts/embed-display.cjs.');process.exitCode=1;}
 else console.log('Embedded display sources match.');
}else{fs.writeFileSync(path.join(root,'index.html'),html);console.log('Embedded display sources updated.');}
