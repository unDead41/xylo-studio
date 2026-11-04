const { test } = require('node:test');
const assert = require('node:assert/strict');
const { deferred, user, settle } = require('./helpers.cjs');
const { uiHost } = require('./ui-host.cjs');

test('the optional account control leaves the guest view available and dialog closed', () => {
  const { ui, doc, byId, guest } = uiHost();
  assert.equal(byId('authDialog').open, false);
  assert.equal(byId('authAccountButton').getAttribute('data-signed-in'), 'false');
  assert.equal(guest.hidden, false);
  assert.equal(guest.disabled, false);
  assert.equal(doc.activeElement, guest);
  ui.destroy();
});

test('opening account sign-in focuses email and Escape clears secrets and restores the previous focus', async () => {
  let dismissals = 0;
  const { ui, doc, byId, guest } = uiHost({ onDismiss: () => dismissals++ });
  await byId('authAccountButton').fire('click');
  assert.equal(byId('authDialog').open, true);
  assert.equal(doc.activeElement.id, 'authSignInEmail');
  byId('authSignInPassword').value = 'private-password';
  const event = await doc.fire('keydown', { key: 'Escape' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(event.propagationStopped, true);
  assert.equal(byId('authDialog').open, false);
  assert.equal(byId('authSignInPassword').value, '');
  assert.equal(doc.activeElement, guest);
  assert.equal(dismissals, 1);
  ui.destroy();
});

test('cancel and the guest continuation button dismiss the dialog without any server operation', async () => {
  const { ui, byId, calls } = uiHost();
  ui.open('signIn');
  const cancel = await byId('authDialog').fire('cancel');
  assert.equal(cancel.defaultPrevented, true);
  assert.equal(byId('authDialog').open, false);
  ui.open('signUp');
  await byId('authDialog').querySelector('.auth-continue').fire('click');
  assert.equal(byId('authDialog').open, false);
  assert.equal(calls.length, 0);
  ui.destroy();
});

test('the keyboard handlers wrap Tab and Shift+Tab within visible dialog controls', async () => {
  const { ui, doc, byId, guest } = uiHost();
  ui.open('signIn');
  const first = byId('authDialog').querySelector('.auth-close');
  const last = byId('authDialog').querySelector('.auth-continue');
  last.focus();
  const forward = await doc.fire('keydown', { key: 'Tab', shiftKey: false });
  assert.equal(forward.defaultPrevented, true);
  assert.equal(doc.activeElement, first);
  const backward = await doc.fire('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.equal(doc.activeElement, last);
  guest.focus();
  await doc.fire('focusin', { target: guest });
  assert.equal(doc.activeElement.id, 'authSignInEmail');
  ui.destroy();
});

test('switching from sign-in to forgot password retains email and removes the typed password', async () => {
  const { ui, byId, doc } = uiHost();
  ui.open('signIn');
  byId('authSignInEmail').value = 'musician@example.invalid';
  byId('authSignInPassword').value = 'private-password';
  await byId('authSignInForm').querySelector('[data-auth-view="forgotPassword"]').fire('click');
  assert.equal(byId('authForgotPasswordForm').hidden, false);
  assert.equal(byId('authSignInForm').hidden, true);
  assert.equal(byId('authForgotPasswordEmail').value, 'musician@example.invalid');
  assert.equal(byId('authSignInPassword').value, '');
  assert.equal(doc.activeElement.id, 'authForgotPasswordEmail');
  ui.destroy();
});

test('invalid sign-in fields are marked accessibly and never submitted', async () => {
  const { ui, byId, doc, calls, submit } = uiHost();
  ui.open('signIn');
  await submit('authSignInForm', { email: 'invalid-email', password: '' });
  assert.equal(calls.length, 0);
  assert.equal(byId('authSignInEmail').getAttribute('aria-invalid'), 'true');
  assert.equal(byId('authSignInPassword').getAttribute('aria-invalid'), 'true');
  assert.equal(doc.activeElement.id, 'authSignInEmail');
  assert.equal(byId('authMessage').getAttribute('role'), 'alert');
  byId('authSignInEmail').value = 'musician@example.invalid';
  await byId('authSignInEmail').fire('input');
  assert.equal(byId('authSignInEmail').getAttribute('aria-invalid'), null);
  assert.equal(byId('authSignInEmailError').hidden, true);
  ui.destroy();
});

test('signup rejects short and mismatched passwords and keeps the password hint when clearing an error', async () => {
  const { ui, byId, calls, submit } = uiHost();
  ui.open('signUp');
  const base = { name: 'Musician', email: 'musician@example.invalid' };
  await submit('authSignUpForm', { ...base, password: 'short', passwordConfirm: 'short' });
  assert.equal(calls.length, 0);
  assert.equal(byId('authSignUpPassword').getAttribute('aria-invalid'), 'true');
  assert.match(byId('authSignUpPassword').getAttribute('aria-describedby'), /authSignUpPasswordHint/);
  byId('authSignUpPassword').value = 'password1';
  await byId('authSignUpPassword').fire('input');
  assert.equal(byId('authSignUpPassword').getAttribute('aria-describedby'), 'authSignUpPasswordHint');
  await submit('authSignUpForm', { ...base, password: 'password1', passwordConfirm: 'different1' });
  assert.equal(calls.length, 0);
  assert.equal(byId('authSignUpPasswordConfirm').getAttribute('aria-invalid'), 'true');
  ui.destroy();
});

test('signup displays a neutral confirmation result without presenting a signed-in account', async () => {
  const neutral = 'Jika alamat e-mel ini boleh didaftarkan, pautan pengesahan akan dihantar.';
  const received = [];
  const { ui, byId, submit } = uiHost({ onSubmit: async (action, values) => { received.push({ action, values }); return { ok: true, message: neutral, data: { confirmationRequired: true } }; } });
  ui.open('signUp');
  await submit('authSignUpForm', { name: ' Musician ', email: ' musician@example.invalid ', password: 'password1', passwordConfirm: 'password1' });
  assert.equal(received.length, 1);
  assert.equal(received[0].action, 'signUp');
  assert.equal(received[0].values.email, 'musician@example.invalid');
  assert.equal(received[0].values.name, 'Musician');
  assert.equal(byId('authMessage').textContent, neutral);
  assert.equal(byId('authAccountButton').getAttribute('data-signed-in'), 'false');
  assert.equal(byId('authSignUpPassword').value, '');
  assert.equal(byId('authSignUpPasswordConfirm').value, '');
  ui.destroy();
});

test('a pending submit disables form operations, suppresses duplicates, and still allows returning to guest mode', async () => {
  const pending = deferred(), received = [];
  const { ui, byId, submit, guest } = uiHost({ onSubmit: (action, values) => { received.push({ action, values }); return pending.promise; } });
  ui.open('signIn');
  await submit('authSignInForm', { email: 'musician@example.invalid', password: 'password1' });
  assert.equal(byId('authDialog').getAttribute('aria-busy'), 'true');
  assert.equal(byId('authSignInEmail').disabled, true);
  assert.equal(byId('authSignInForm').querySelector('[type="submit"]').disabled, true);
  await byId('authSignInForm').fire('submit');
  assert.equal(received.length, 1);
  await byId('authDialog').querySelector('.auth-continue').fire('click');
  assert.equal(byId('authDialog').open, false);
  assert.equal(guest.disabled, false);
  pending.resolve({ ok: true, message: 'Completed' });
  await settle();
  assert.equal(byId('authDialog').open, false);
  assert.equal(byId('authDialog').getAttribute('aria-busy'), 'false');
  assert.equal(byId('authSignInPassword').value, '');
  ui.destroy();
});

test('a transport failure produces a retryable message and reenables form controls', async () => {
  const { ui, byId, submit } = uiHost({ onSubmit: async () => { throw new TypeError('Private transport details'); } });
  ui.open('signIn');
  await submit('authSignInForm', { email: 'musician@example.invalid', password: 'password1' });
  assert.equal(byId('authMessage').hidden, false);
  assert.equal(byId('authMessage').getAttribute('role'), 'alert');
  assert.doesNotMatch(byId('authMessage').textContent, /Private transport details/);
  assert.equal(byId('authSignInEmail').disabled, false);
  ui.destroy();
});

test('normal password change requires current password and focuses a current-password server error after reenabling controls', async () => {
  const { ui, doc, byId, submit, calls } = uiHost({ onSubmit: async () => ({ ok: false, errorCode: 'current_password_mismatch', message: 'Kata laluan semasa tidak tepat.' }) });
  ui.setState({ ready: true, user: user() });
  ui.open('changePassword');
  await submit('authChangePasswordForm', { currentPassword: '', password: 'new-password1', passwordConfirm: 'new-password1' });
  assert.equal(calls.length, 0);
  assert.equal(byId('authChangePasswordCurrentPassword').getAttribute('aria-invalid'), 'true');
  await submit('authChangePasswordForm', { currentPassword: 'wrong', password: 'new-password1', passwordConfirm: 'new-password1' });
  assert.equal(byId('authChangePasswordCurrentPassword').disabled, false);
  assert.equal(byId('authChangePasswordCurrentPassword').getAttribute('aria-invalid'), 'true');
  assert.equal(doc.activeElement.id, 'authChangePasswordCurrentPassword');
  ui.destroy();
});

test('verified recovery opens password setup and submits no current password', async () => {
  const { ui, byId, submit, calls } = uiHost();
  ui.setState({ ready: true, user: user(), recovery: true, callback: { status: 'success', type: 'recovery', message: 'Recovery verified.' } });
  assert.equal(byId('authDialog').open, true);
  assert.equal(byId('authChangePasswordForm').hidden, false);
  assert.equal(byId('authChangePasswordCurrentPassword').required, false);
  assert.equal(byId('authChangePasswordCurrentPassword').closest('.auth-field').hidden, true);
  await submit('authChangePasswordForm', { password: 'new-password1', passwordConfirm: 'new-password1' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, 'changePassword');
  assert.equal(Object.hasOwn(calls[0].values, 'currentPassword'), false);
  ui.setState({ recovery: false, callback: { status: 'idle', type: null, message: '' } });
  assert.equal(byId('authChangePasswordForm').hidden, true);
  assert.equal(byId('authChangePasswordPassword').value, '');
  ui.destroy();
});

test('expired recovery displays an error without exposing the new-password form to a guest', () => {
  const { ui, byId } = uiHost();
  ui.setState({ ready: true, user: null, recovery: false, callback: { status: 'error', type: 'recovery', errorCode: 'otp_expired', message: 'Pautan telah tamat tempoh.' } });
  assert.equal(byId('authDialog').open, true);
  assert.equal(byId('authSignInForm').hidden, false);
  assert.equal(byId('authChangePasswordForm').hidden, true);
  assert.equal(byId('authMessage').textContent, 'Pautan telah tamat tempoh.');
  assert.equal(byId('authMessage').getAttribute('role'), 'alert');
  ui.destroy();
});

test('reauthentication reveals a nonce field and sends the explicit code request before retry', async () => {
  let requestCode = 0, attempts = 0;
  const received = [];
  const { ui, byId, submit } = uiHost({
    onSubmit: async (action, values) => {
      received.push({ action, values });
      return ++attempts === 1 ? { ok: false, errorCode: 'reauthentication_needed', message: 'Need confirmation code.' } : { ok: true, message: 'Password changed.' };
    },
    onSendReauthCode: async () => { requestCode++; return { ok: true, message: 'Code sent.' }; },
  });
  ui.setState({ user: user() }); ui.open('changePassword');
  const values = { currentPassword: 'old', password: 'new-password1', passwordConfirm: 'new-password1' };
  await submit('authChangePasswordForm', values);
  assert.equal(byId('authChangePasswordNonce').closest('.auth-reauth').hidden, false);
  assert.equal(byId('authChangePasswordNonce').required, true);
  await byId('authDialog').querySelector('[data-auth-operation="requestReauthentication"]').fire('click');
  assert.equal(requestCode, 1);
  assert.equal(byId('authChangePasswordPassword').value, 'new-password1');
  await submit('authChangePasswordForm', values);
  assert.equal(received.length, 1, 'retry without nonce should fail before calling the service');
  await submit('authChangePasswordForm', { ...values, nonce: '123456' });
  assert.equal(received.length, 2);
  assert.equal(received[1].values.nonce, '123456');
  assert.equal(byId('authChangePasswordPassword').value, '');
  ui.destroy();
});

test('password visibility is announced and is reset when the dialog closes', async () => {
  const { ui, byId } = uiHost();
  ui.open('signIn');
  const input = byId('authSignInPassword'), toggle = input.closest('.auth-field').querySelector('.auth-password-toggle');
  input.value = 'private-password';
  await toggle.fire('click');
  assert.equal(input.type, 'text');
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  ui.close();
  assert.equal(input.type, 'password');
  assert.equal(input.value, '');
  assert.equal(toggle.getAttribute('aria-pressed'), 'false');
  ui.destroy();
});

test('sign-out uses its explicit callback and returns to sign-in when session state clears', async () => {
  let host, signOutCount = 0;
  host = uiHost({ onSignOut: async () => { signOutCount++; host.ui.setState({ user: null }); return { ok: true, message: 'Signed out.' }; } });
  host.ui.setState({ user: user() }); host.ui.open('account');
  await host.byId('authDialog').querySelector('[data-auth-operation="signOut"]').fire('click');
  assert.equal(signOutCount, 1);
  assert.equal(host.calls.length, 0);
  assert.equal(host.byId('authAccountButton').getAttribute('data-signed-in'), 'false');
  assert.equal(host.byId('authSignInForm').hidden, false);
  host.ui.destroy();
});

test('account metadata is rendered as plain text', () => {
  const { ui, byId } = uiHost();
  const name = '<img src=x onerror=alert(1)>';
  ui.setState({ user: user({ user_metadata: { display_name: name } }) }); ui.open('account');
  assert.equal(byId('authUserName').textContent, name);
  assert.equal(byId('authUserName').children.length, 0);
  ui.destroy();
});

test('unavailable account configuration keeps the guest continuation control active', async () => {
  const { ui, byId, submit, calls, guest } = uiHost({ state: { ready: true, configurationError: 'Unavailable' } });
  ui.open('signIn');
  assert.equal(byId('authSignInEmail').disabled, true);
  assert.equal(byId('authDialog').querySelector('.auth-continue').disabled, false);
  await submit('authSignInForm', { email: 'musician@example.invalid', password: 'password1' });
  assert.equal(calls.length, 0);
  await byId('authDialog').querySelector('.auth-continue').fire('click');
  assert.equal(byId('authDialog').open, false);
  assert.equal(guest.disabled, false);
  ui.destroy();
});

test('destroy removes account DOM and handlers and restores the existing guest focus', async () => {
  const { ui, doc, guest } = uiHost();
  ui.open('signIn'); ui.destroy();
  assert.equal(doc.getElementById('authDialog'), null);
  assert.equal(doc.getElementById('authAccountButton'), null);
  assert.equal(doc.activeElement, guest);
  ui.open('signUp');
  await doc.fire('keydown', { key: 'Tab' });
  assert.equal(doc.activeElement, guest);
});
