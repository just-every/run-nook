import {test} from 'node:test';
import {clockJourney} from './push/journey.mjs';

// Its own CI job beside push-journey.mjs: it waits out a real 45-second heartbeat
// expiry and a real five-minute mobile delay on a fresh installation.
test('NOOK-073 real clocks: the heartbeat expires at 45 seconds and a five-minute mobile delay releases on the actual alarm',{timeout:600_000},clockJourney);
