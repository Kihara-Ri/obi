import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';

const css = readFileSync(new URL('../src/styles/album-flip-card.css', import.meta.url), 'utf8');
const card = readFileSync(new URL('../src/components/AlbumFlipCard.tsx', import.meta.url), 'utf8');

const declarations = selector => {
  const start = css.indexOf(selector + '{');
  assert.ok(start >= 0, selector + ' not found');
  const bodyStart = start + selector.length + 1;
  const end = css.indexOf('}', bodyStart);
  assert.ok(end > bodyStart, selector + ' block is incomplete');
  return css.slice(bodyStart, end);
};

test('back center is card-bounded and uses true multiline flex layout', () => {
  const center = declarations('.album-flip-back-center');
  assert.match(center, /left:\s*7%/);
  assert.match(center, /right:\s*7%/);
  assert.match(center, /width:\s*86%/);
  assert.match(center, /min-width:\s*0/);
  assert.match(center, /box-sizing:\s*border-box/);
  assert.match(center, /text-align:\s*center/);
  assert.match(center, /white-space:\s*normal/);
});

test('long names wrap, stay centered and do not overflow the card', () => {
  const title = declarations('.album-flip-album-title');
  assert.match(title, /width:\s*100%/);
  assert.match(title, /max-width:\s*100%/);
  assert.match(title, /min-width:\s*0/);
  assert.match(title, /white-space:\s*normal/);
  assert.match(title, /overflow-wrap:\s*anywhere/);
  assert.match(title, /text-align:\s*center/);
  assert.match(title, /text-wrap:\s*balance/);
  assert.match(title, /word-break:\s*normal/);
  assert.match(card, /className="album-flip-album-title"/);
});

test('artist names wrap and preserve centered back-face layout', () => {
  const artist = declarations('.album-flip-artist-name');
  assert.match(artist, /max-width:\s*100%/);
  assert.match(artist, /white-space:\s*normal/);
  assert.match(artist, /overflow-wrap:\s*anywhere/);
  assert.match(artist, /text-align:\s*center/);
});
