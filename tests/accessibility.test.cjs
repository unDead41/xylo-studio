const {test}=require('node:test');
const assert=require('node:assert/strict');
const {studio}=require('./helpers/studio.cjs');

// Record explicit controller focus requests. The host fixture does not model
// native dialog autofocus, focus trapping or the browser's Escape behavior.
function focusRequests(s){
 const calls=[];
 Object.getPrototypeOf(s.ids.get('editPitch')).focus=function(){calls.push(this);};
 return calls;
}
const editors=s=>s.ids.get('eventRows').querySelectorAll('button');
const savedTake=s=>JSON.parse(s.saved.get('xylo-studio-v2')).take;

test('a new password request does not describe a hidden error from the previous request',async()=>{
 const s=studio();await s.ids.get('exportBtn').fire('click');
 assert.equal(s.ids.get('exportPassword').getAttribute('aria-describedby'),'exportPasswordIntro');
 s.ids.get('exportPassword').value='wrong';await s.ids.get('exportPasswordForm').fire('submit');
 assert.equal(s.ids.get('exportPassword').getAttribute('aria-describedby'),'exportPasswordIntro exportPasswordError');
 s.ids.get('exportPasswordDialog').close();await s.ids.get('exportBtn').fire('click');
 assert.equal(s.ids.get('exportPasswordError').hidden,true);
 assert.equal(s.ids.get('exportPassword').getAttribute('aria-invalid'),null);
 assert.equal(s.ids.get('exportPassword').getAttribute('aria-describedby'),'exportPasswordIntro');
});

test('editor errors identify and focus the field that needs correction',async()=>{
 const s=studio(),focus=focusRequests(s),before=s.saved.get('xylo-studio-v2');
 await editors(s)[0].fire('click');
 s.ids.get('editPitch').value='';
 await s.ids.get('editForm').fire('submit');
 assert.equal(s.ids.get('editDialog').open,true);
 assert.equal(s.ids.get('editPitch').getAttribute('aria-invalid'),'true');
 assert.equal(s.ids.get('editTick').getAttribute('aria-invalid'),null);
 assert.equal(focus.at(-1),s.ids.get('editPitch'));
 s.ids.get('editPitch').value='64';s.ids.get('editTick').value='';
 await s.ids.get('editForm').fire('submit');
 assert.equal(s.ids.get('editDialog').open,true);
 assert.equal(s.ids.get('editPitch').getAttribute('aria-invalid'),null);
 assert.equal(s.ids.get('editTick').getAttribute('aria-invalid'),'true');
 assert.equal(focus.at(-1),s.ids.get('editTick'));
 assert.equal(s.saved.get('xylo-studio-v2'),before);
 s.ids.get('editTick').value='1';
 await s.ids.get('editForm').fire('submit');
 assert.match(s.ids.get('editError').textContent,/tick 0/);
 assert.equal(focus.at(-1),s.ids.get('editTick'));
 s.ids.get('editDialog').close();await editors(s)[1].fire('click');
 assert.equal(s.ids.get('editError').hidden,true);
 assert.equal(s.ids.get('editError').textContent,'');
 for(const id of ['editPitch','editTick','editGate'])assert.equal(s.ids.get(id).getAttribute('aria-invalid'),null);
});

test('recorder gate errors focus the gate and a successful correction preserves raw evidence',async()=>{
 const s=studio(),focus=focusRequests(s);await s.ids.get('chooseRecorder').fire('click');
 const raw=JSON.stringify(savedTake(s).raw_capture);
 await editors(s)[0].fire('click');s.ids.get('editGate').value='0';
 await s.ids.get('editForm').fire('submit');
 assert.equal(s.ids.get('editDialog').open,true);
 assert.equal(s.ids.get('editGate').getAttribute('aria-invalid'),'true');
 assert.equal(s.ids.get('editTick').getAttribute('aria-invalid'),null);
 assert.equal(focus.at(-1),s.ids.get('editGate'));
 s.ids.get('editGate').value='18';await s.ids.get('editForm').fire('submit');
 assert.equal(s.ids.get('editDialog').open,false);
 assert.equal(s.ids.get('editGate').getAttribute('aria-invalid'),null);
 assert.equal(savedTake(s).events[0].gate_tick,18);
 assert.equal(JSON.stringify(savedTake(s).raw_capture),raw);
 assert.equal(focus.at(-1),editors(s)[0]);
});

test('saving a moved event returns focus to its rebuilt editor at the new position',async()=>{
 const s=studio(),focus=focusRequests(s),oldEditor=editors(s)[1],raw=JSON.stringify(savedTake(s).raw_capture);
 await oldEditor.fire('click');s.ids.get('editTick').value='400';
 await s.ids.get('editForm').fire('submit');
 const buttons=editors(s),take=savedTake(s);
 assert.equal(take.events.at(-1).midi,62);assert.equal(take.events.at(-1).onset_tick,400);
 assert.equal(JSON.stringify(take.raw_capture),raw);
 assert.notEqual(buttons.at(-1),oldEditor);
 assert.equal(focus.at(-1),buttons.at(-1));
 assert.ok(s.ids.get('eventTableScroll').scrollTop>0);
});

test('deleting an event focuses the nearest remaining editor',async()=>{
 const s=studio(),focus=focusRequests(s);
 await editors(s)[4].fire('click');await s.ids.get('deleteEventBtn').fire('click');
 assert.equal(editors(s).length,12);assert.equal(focus.at(-1),editors(s)[4]);
 await editors(s).at(-1).fire('click');await s.ids.get('deleteEventBtn').fire('click');
 assert.equal(editors(s).length,11);assert.equal(focus.at(-1),editors(s).at(-1));
});

test('deleting the final event offers keyboard focus on Undo',async()=>{
 const base=studio(),take=base.C.fromTaps([{midi:60,raw_ms:0}]);
 const s=studio({variant:null,legacy:take}),focus=focusRequests(s);
 await editors(s)[0].fire('click');await s.ids.get('deleteEventBtn').fire('click');
 assert.equal(editors(s).length,0);assert.equal(s.ids.get('undoBtn').disabled,false);
 assert.equal(focus.at(-1),s.ids.get('undoBtn'));
 await s.ids.get('undoBtn').fire('click');assert.equal(editors(s).length,1);
});
