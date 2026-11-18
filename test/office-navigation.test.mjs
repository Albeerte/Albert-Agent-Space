import test from 'node:test';
import assert from 'node:assert/strict';
import {buildObstacleMap} from '../public/vendor/pathfinder.js';
import {astar2D} from '../public/vendor/office-pathfinding.js';

test('Reused office navigation routes meeting agents through a door and around furniture',()=>{
  const cols=22,rows=13,cellSize=8;
  const blocked=buildObstacleMap(cols,rows,[
    {x:10,y:1,w:1,h:4},{x:10,y:7,w:1,h:5},
    {x:6,y:4,w:2,h:2}
  ]);
  const grid={cols,rows,cellSize,cells:Uint8Array.from(blocked.flat().map(Boolean))};
  const path=astar2D(28,28,140,76,grid);
  assert.ok(path.length>1);
  for(const point of path)assert.equal(blocked[Math.floor(point.y/8)][Math.floor(point.x/8)],false);
  const doorway=path.filter(point=>Math.floor(point.x/8)===10);
  assert.ok(doorway.length);
  assert.ok(doorway.every(point=>[5,6].includes(Math.floor(point.y/8))));
  const sealed=buildObstacleMap(cols,rows,[{x:10,y:1,w:1,h:11}]);
  assert.deepEqual(astar2D(28,28,140,76,{...grid,cells:Uint8Array.from(sealed.flat().map(Boolean))}),[]);
});
