import {test} from 'node:test';
import assert from 'node:assert/strict';
import {safeImageType} from '../src/team/image-format.mjs';
test('private inline media recognizes genuine PNG bytes and refuses active content, truncation and corrupt containers',()=>{
 const png=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64'));
 assert.equal(safeImageType(png),'image/png');
 for(const value of [Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),Buffer.from('<!doctype html><script>alert(1)</script>'),png.slice(0,-1),Uint8Array.from([...png,60,115,118,103,62])])assert.equal(safeImageType(value),null);
 const corrupt=png.slice();corrupt[40]^=1;assert.equal(safeImageType(corrupt),null);
});
