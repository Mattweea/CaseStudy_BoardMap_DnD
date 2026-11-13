import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { build } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const bundled = await build({
  entryPoints: [new URL('../src/components/DarknessLayer.tsx', import.meta.url).pathname],
  bundle: true, platform: 'node', format: 'esm', write: false, jsx: 'automatic',
  plugins: [{ name: 'shared-react', setup(builder) {
    builder.onResolve({ filter: /^react(?:\/|$)/ }, ({ path }) => ({ path: pathToFileURL(require.resolve(path)).href, external: true }));
  } }],
});
const { DarknessLayer } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString('base64')}`);
const render = (props = {}) => renderToStaticMarkup(createElement(DarknessLayer, {
  width: 480, height: 480, cellSize: 48, paths: [], ...props,
}));

test('unknown Player terrain remains opaque black by default', () => {
  assert.match(render(), /<rect[^>]*fill="#000"[^>]*fill-opacity="1"[^>]*mask=/);
});

test('the Master veil can be translucent without changing the default Player coverage', () => {
  assert.match(render({ opacity: 0.45 }), /fill="#000" fill-opacity="0.45"/);
  assert.match(render(), /fill="#000" fill-opacity="1"/);
});

test('revealed paths preserve holes and feather only inside their geometry', () => {
  const markup = render({ paths: ['M0,0 L10,0 L10,10 Z M2,2 L3,2 L3,3 Z'] });
  assert.match(markup, /fill-rule="evenodd"/);
  assert.match(markup, /<feComposite in2="SourceGraphic" operator="in"/);
  assert.doesNotMatch(markup, /<path[^>]*stroke=/);
});
