import test from 'node:test';
import assert from 'node:assert/strict';

import { coordinatesFrom, distanceKm, projectTrackPoints } from '../src/appData.js';

test('coordinatesFrom rejects incomplete or out-of-range coordinates', () => {
  assert.equal(coordinatesFrom({ latitude: 28.6 }), null);
  assert.equal(coordinatesFrom({ latitude: 91, longitude: 77 }), null);
  assert.deepEqual(coordinatesFrom({ lat: '28.6139', lng: '77.2090' }), {
    latitude: 28.6139,
    longitude: 77.209
  });
});

test('distanceKm calculates a realistic Delhi to Noida distance', () => {
  const distance = distanceKm(
    { latitude: 28.6139, longitude: 77.209 },
    { latitude: 28.5355, longitude: 77.391 }
  );

  assert.ok(distance > 18 && distance < 22, `unexpected distance: ${distance}`);
  assert.equal(distanceKm(null, { latitude: 1, longitude: 1 }), Infinity);
});

test('projectTrackPoints uses real coordinates when all points are available', () => {
  const points = projectTrackPoints({
    pickup: { latitude: 28.61, longitude: 77.2 },
    rider: { latitude: 28.58, longitude: 77.3 },
    drop: { latitude: 28.54, longitude: 77.39 }
  });

  assert.equal(points.live, true);
  assert.ok(points.pickup.x < points.rider.x);
  assert.ok(points.rider.x < points.drop.x);
});
