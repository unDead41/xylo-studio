// Embed the reviewed account assets without introducing a runtime build/CDN.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8').trimEnd();
const config = JSON.parse(read('assets/auth/config.json'));
if (!config.publishableKey.startsWith('sb_publishable_') || !config.url.startsWith('https://')) throw Error('Only public project configuration may be embedded.');
const vendor = read('vendor/supabase/supabase-2.118.0.js');
const hash = createHash('sha256').update(fs.readFileSync(path.join(root, 'vendor/supabase/supabase-2.118.0.js'))).digest('hex');
if (hash !== 'ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3') throw Error('Vendored SDK checksum changed.');
const script = (id, source) => '<script id="' + id + '">\n' + source.replace(/<\/script/gi, '<\\/script') + '\n</script>';
const block = [
  '<!-- auth-assets:start; regenerate with node scripts/build-auth.mjs -->',
  script('auth-config', 'window.InstruAuthConfig = Object.freeze(' + JSON.stringify(config) + ');'),
  script('auth-vendor', '/* @supabase/supabase-js 2.118.0\n' + read('vendor/supabase/LICENSE') + '\n*/\n' + vendor),
  script('auth-service', read('assets/auth/auth-service.js')),
  script('auth-ui', read('assets/auth/auth-ui.js')),
  script('auth-bootstrap', read('assets/auth/auth-bootstrap.js')),
  '<!-- auth-assets:end -->'
].join('\n');
const css = '<style id="auth-styles">\n' + read('assets/auth/auth.css') + '\n</style>';
let html = read('index.html') + '\n';
html = html.includes('<!-- auth-assets:start')
  ? html.replace(/<!-- auth-assets:start[\s\S]*?<!-- auth-assets:end -->/, () => block)
  : html.replace('</body>', () => block + '\n</body>');
html = html.includes('<style id="auth-styles">')
  ? html.replace(/<style id="auth-styles">[\s\S]*?<\/style>/, () => css)
  : html.replace('</head>', () => css + '\n</head>');
if (process.argv.includes('--check')) {
  if (html !== fs.readFileSync(path.join(root, 'index.html'), 'utf8')) throw Error('Auth assets differ from index.html; run node scripts/build-auth.mjs.');
  console.log('Embedded auth assets match their reviewed sources.');
} else {
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log('Embedded optional account assets in index.html.');
}
