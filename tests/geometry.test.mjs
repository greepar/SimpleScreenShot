// SPDX-License-Identifier: Apache-2.0 OR GPL-3.0-or-later

import assert from 'node:assert/strict';

import {
    containsPoint,
    intersection,
    normalizeRect,
    rectForPoint,
    sanitizeFilename,
} from '../extension/geometry.js';

assert.deepEqual(
    normalizeRect(40, 80, 10, 20),
    {x: 10, y: 20, width: 30, height: 60});

assert.deepEqual(
    normalizeRect(-10, -5, 120, 80, {x: 0, y: 0, width: 100, height: 60}),
    {x: 0, y: 0, width: 100, height: 60});

assert.equal(containsPoint({x: 10, y: 10, width: 20, height: 20}, 29, 29), true);
assert.equal(containsPoint({x: 10, y: 10, width: 20, height: 20}, 30, 30), false);

assert.deepEqual(
    intersection(
        {x: 0, y: 0, width: 100, height: 100},
        {x: 60, y: 50, width: 80, height: 20}),
    {x: 60, y: 50, width: 40, height: 20});

assert.deepEqual(
    rectForPoint([
        {x: 0, y: 0, width: 40, height: 40, id: 'first'},
        {x: 40, y: 0, width: 40, height: 40, id: 'second'},
    ], 55, 12),
    {x: 40, y: 0, width: 40, height: 40, id: 'second'});

assert.equal(sanitizeFilename('  Screenshot: 12/30?  '), 'Screenshot- 12-30-');
assert.equal(sanitizeFilename('...'), 'Screenshot');

console.log('geometry tests passed');
