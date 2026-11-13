import assert from 'node:assert/strict';
import test from 'node:test';
import { lineWallCells, rectangleCells, wallCellPaths } from '../shared/wall-cells.mjs';
test('fast brush fills intermediate cells and rectangles are inclusive and bounded before allocation', () => {
  assert.deepEqual(lineWallCells({x:1,y:2},{x:5,y:2}), Array.from({length:5},(_,i)=>({x:i+1,y:2})));
  assert.equal(rectangleCells({x:3,y:4},{x:1,y:2}).length,9);
  assert.throws(()=>rectangleCells({x:0,y:0},{x:999999,y:999999}));
  assert.throws(()=>lineWallCells({x:0,y:0},{x:5000,y:0}));
  assert.equal((wallCellPaths([{x:0,y:0},{x:1,y:0}]).outline.match(/M/g)||[]).length,6);
  const dense = rectangleCells({x:0,y:0},{x:49,y:99});
  assert.equal(dense.length,5000);
  assert.equal((wallCellPaths(dense).outline.match(/M/g)||[]).length,300);
});
