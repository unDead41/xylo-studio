const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');

const click=(s,id)=>s.ids.get(id).fire('click');
function labelIncludesVisible(s,button,label){
 const name=s.ids.get(button).getAttribute('aria-label')?.toLocaleLowerCase(),visible=s.ids.get(label).textContent.toLocaleLowerCase();
 assert.ok(visible&&name?.includes(visible),button+' accessible name includes the visible action');
}

test('pitched transport labels follow song, empty recording and recorded playback states',async()=>{
 const s=studio();assert.equal(s.ids.get('playLabel').textContent,'Main lagu');labelIncludesVisible(s,'playBtn','playLabel');labelIncludesVisible(s,'recordBtn','recordLabel');
 await click(s,'recordBtn');assert.equal(s.ids.get('playBtn').disabled,true);labelIncludesVisible(s,'recordBtn','recordLabel');
 await click(s,'stopBtn');assert.equal(s.ids.get('statNotes').textContent,'0');assert.equal(s.ids.get('playBtn').disabled,true);assert.equal(s.ids.get('sourceTag').textContent,'Score kosong');assert.doesNotMatch(s.ids.get('goal').className,/\bgood\b/);assert.match(s.ids.get('goalText').textContent,/Rakam/);assert.match(s.ids.get('eventRows').textContent,/Rakam/);assert.match(s.ids.get('timeline').textContent,/Rakam/);
 await click(s,'recordBtn');await s.dispatch('keydown',{key:'a'});await s.dispatch('keyup',{key:'a'});await click(s,'stopBtn');assert.equal(s.ids.get('statNotes').textContent,'1');assert.equal(s.ids.get('playLabel').textContent,'Main rakaman');labelIncludesVisible(s,'playBtn','playLabel');assert.ok(s.ids.get('playBtn').getAttribute('aria-label').includes(s.ids.get('takeTitle').value));
 await click(s,'playBtn');assert.equal(s.ids.get('playLabel').textContent,'Henti score');labelIncludesVisible(s,'playBtn','playLabel');await click(s,'stopBtn');assert.equal(s.ids.get('playLabel').textContent,'Main rakaman');labelIncludesVisible(s,'playBtn','playLabel');
});

test('switching pitched instruments refreshes hold guidance and the microphone explanation',async()=>{
 const s=studio();assert.equal(s.ids.get('micBtn').disabled,false);assert.equal(s.ids.get('micBtn').getAttribute('aria-describedby'),null);assert.doesNotMatch(s.ids.get('studioKeyboardHint').textContent,/lepaskan/);
 await click(s,'changeInstrumentBtn');await click(s,'chooseRecorder');assert.equal(s.ids.get('micBtn').disabled,true);assert.equal(s.ids.get('micBtn').getAttribute('aria-describedby'),'recorderMicHint');assert.match(s.ids.get('studioKeyboardHint').textContent,/Tahan/);assert.match(s.ids.get('studioKeyboardHint').textContent,/lepaskan/);
 await click(s,'changeInstrumentBtn');await click(s,'chooseXylophone');assert.equal(s.ids.get('micBtn').disabled,false);assert.equal(s.ids.get('micBtn').getAttribute('aria-describedby'),null);assert.doesNotMatch(s.ids.get('studioKeyboardHint').textContent,/lepaskan/);
});

test('renaming the current take refreshes the accessible playback target immediately',async()=>{
 const s=studio(),title='Latihan baharu Ijamm';s.ids.get('takeTitle').value=title;await s.ids.get('takeTitle').fire('change');
 assert.equal(JSON.parse(s.saved.get('xylo-studio-v2')).take.title,title);assert.ok(s.ids.get('playBtn').getAttribute('aria-label').includes(title),'Playback announces the current saved title before another transport action');labelIncludesVisible(s,'playBtn','playLabel');
});
