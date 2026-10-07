import test from 'node:test';
import assert from 'node:assert/strict';
import {projectSource} from './project-source.mjs';
test('example retains its existing recovery slot', () => {
  assert.deepEqual(projectSource(''), {src:'starter.json',recoveryKey:'autosave'});
});
test('pack full-window recovery opens the same isolated slot without arbitrary fetching',()=>{
  assert.deepEqual(projectSource('?recovery=pack%3Areview%3Areaver'),{src:'starter.json',recoveryKey:'pack:review:reaver'});
  assert.throws(()=>projectSource('?recovery=https://example.com/project.json'));
});
test('each bundled project gets its own recovery slot', () => {
  const slots = new Set();
  for (const family of ['reaver','herald','rogue']) for (const group of ['a','b']) {
    const id = `hammer-${family}-${group}`;
    const entry = projectSource(`?project=${id}`);
    assert.equal(entry.src, `projects/${id}.rig.json`);
    slots.add(entry.recoveryKey);
  }
  assert.equal(slots.size, 6);
});
test('project selection cannot fetch arbitrary paths', () => {
  for (const id of ['../secret','https://example.com/a','hammer-reaver-c']) {
    assert.throws(() => projectSource(`?project=${encodeURIComponent(id)}`));
  }
});
