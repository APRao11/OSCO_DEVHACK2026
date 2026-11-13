import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMedications, toIsoDate, FLAG_TYPES } from '../src/reconcile/medicationEpisodes.js';

let nextId = 1;
const med = (overrides) => ({
	id: `c${nextId++}`,
	category: 'medication',
	subject: 'patient',
	assertion: 'present',
	name: 'Metformin',
	name_normalised: 'metformin',
	action: 'none',
	dose: null,
	frequency: null,
	normalised: {},
	event_date: null,
	date_precision: 'day',
	...overrides,
});

const dose = (amount, perDay = 2) => ({ dose: { amount, unit: 'mg', per_day: perDay } });
const AS_OF = '2021-06-01';

describe('reconcileMedications (section 8.6)', () => {
	test('start -> change -> stop gives one episode with two dose segments, stopped', () => {
		const claims = [
			med({ action: 'start', dose: '500 mg', normalised: dose(500), event_date: '2019-03-12' }),
			med({ action: 'change', dose: '1000 mg', normalised: dose(1000, 1), event_date: '2021-02-02' }),
			med({ action: 'stop', event_date: '2021-05-01' }),
		];
		const { histories } = reconcileMedications(claims, { asOf: AS_OF });
		assert.equal(histories.length, 1);
		const [history] = histories;
		assert.equal(history.episodes.length, 1);
		const [episode] = history.episodes;
		assert.equal(episode.start.date, '2019-03-12');
		assert.equal(episode.end.date, '2021-05-01');
		assert.deepEqual(episode.segments.map((s) => [s.dose, s.from.date, s.to.date]), [
			['500 mg', '2019-03-12', '2021-02-02'],
			['1000 mg', '2021-02-02', '2021-05-01'],
		]);
		assert.equal(history.status.state, 'stopped');
		assert.equal(history.status.label, 'Stopped on 2021-05-01');
		assert.deepEqual(history.flags, []);
	});

	test('sorts by date, not by input order', () => {
		const claims = [
			med({ action: 'stop', event_date: '2020-01-01' }),
			med({ action: 'start', dose: '500 mg', normalised: dose(500), event_date: '2019-01-01' }),
		];
		const [history] = reconcileMedications(claims, { asOf: AS_OF }).histories;
		assert.equal(history.episodes[0].start.date, '2019-01-01');
		assert.equal(history.status.state, 'stopped');
	});

	test('an active mention with a different known dose is treated as a change', () => {
		const claims = [
			med({ action: 'start', dose: '500 mg', normalised: dose(500), event_date: '2021-01-01' }),
			med({ action: 'continue', dose: '850 mg', normalised: dose(850), event_date: '2021-03-01' }),
		];
		const [history] = reconcileMedications(claims, { asOf: AS_OF }).histories;
		assert.deepEqual(history.episodes[0].segments.map((s) => s.dose), ['500 mg', '850 mg']);
	});

	test('a mention without a dose never implies a change', () => {
		const claims = [
			med({ action: 'start', dose: '500 mg', normalised: dose(500), event_date: '2021-01-01' }),
			med({ action: 'continue', event_date: '2021-03-01' }),
		];
		const [history] = reconcileMedications(claims, { asOf: AS_OF }).histories;
		assert.equal(history.episodes[0].segments.length, 1);
		assert.equal(history.status.date, '2021-03-01');
	});

	test('active mention after a stop opens a new episode and raises a flag', () => {
		const claims = [
			med({ action: 'start', event_date: '2019-01-01' }),
			med({ action: 'stop', event_date: '2019-06-01' }),
			med({ action: 'continue', event_date: '2021-04-01' }),
		];
		const [history] = reconcileMedications(claims, { asOf: AS_OF }).histories;
		assert.equal(history.episodes.length, 2);
		assert.equal(history.episodes[1].start, null); // start date not documented
		assert.equal(history.status.state, 'last_documented_active');
		assert.equal(history.flags.length, 1);
		assert.equal(history.flags[0].type, FLAG_TYPES.ACTIVE_AFTER_STOP);
		assert.deepEqual(history.flags[0].claimIds, [claims[1].id, claims[2].id]);
	});

	test('"continue" with no earlier prescription is an orphan reference', () => {
		const [history] = reconcileMedications([med({ action: 'continue', event_date: '2021-05-01' })], { asOf: AS_OF }).histories;
		assert.equal(history.flags[0].type, FLAG_TYPES.ORPHAN_REFERENCE);
		assert.equal(history.episodes[0].start, null);
	});

	test('a stop with no earlier record is kept and flagged', () => {
		const [history] = reconcileMedications([med({ action: 'stop', event_date: '2021-05-01' })], { asOf: AS_OF }).histories;
		assert.equal(history.status.state, 'stopped');
		assert.equal(history.flags[0].type, FLAG_TYPES.ORPHAN_REFERENCE);
	});

	test('last evidence older than the stale period is marked possibly outdated and flagged', () => {
		const claims = [med({ action: 'start', event_date: '2020-01-15' })];
		const [history] = reconcileMedications(claims, { asOf: AS_OF }).histories;
		assert.equal(history.status.state, 'last_documented_active');
		assert.equal(history.status.label, 'Last documented active on 2020-01-15');
		assert.equal(history.status.possiblyOutdated, true);
		assert.equal(history.flags[0].type, FLAG_TYPES.STALE_MEDICATION);

		const fresh = reconcileMedications(claims, { asOf: '2020-03-01' }).histories[0];
		assert.equal(fresh.status.possiblyOutdated, false);
		assert.deepEqual(fresh.flags, []);
	});

	test('falls back to the document date and marks it as such', () => {
		const [history] = reconcileMedications([med({ action: 'start', document_date: '2021-04-10' })], { asOf: AS_OF }).histories;
		assert.equal(history.episodes[0].start.date, '2021-04-10');
		assert.equal(history.episodes[0].start.dateSource, 'document');
	});

	test('keeps undated, family, absent and possible findings out of episodes', () => {
		const result = reconcileMedications(
			[
				med({ action: 'start' }), // no date at all
				med({ subject: 'family', event_date: '2021-01-01' }),
				med({ assertion: 'absent', event_date: '2021-01-01' }),
				med({ assertion: 'possible', event_date: '2021-01-01' }),
				med({ category: 'condition', event_date: '2021-01-01' }),
			],
			{ asOf: AS_OF },
		);
		assert.equal(result.histories.length, 0);
		assert.equal(result.undated.length, 1);
		assert.deepEqual(result.notCounted.map((n) => n.assertion), ['absent', 'possible']);
	});

	test('groups by normalised drug name (brand and generic together)', () => {
		const claims = [
			med({ name: 'Glycomet', action: 'start', event_date: '2020-01-01' }),
			med({ name: 'Metformin', action: 'stop', event_date: '2020-06-01' }),
			med({ name: 'Telma', name_normalised: 'telmisartan', action: 'start', event_date: '2021-05-01' }),
		];
		const { histories } = reconcileMedications(claims, { asOf: AS_OF });
		assert.deepEqual(histories.map((h) => [h.drug, h.status.state]), [
			['metformin', 'stopped'],
			['telmisartan', 'last_documented_active'],
		]);
	});

	test('is deterministic', () => {
		const claims = [
			med({ action: 'start', event_date: '2020-01-01' }),
			med({ action: 'change', dose: '1000 mg', normalised: dose(1000), event_date: '2020-01-01' }),
		];
		const a = reconcileMedications(claims, { asOf: AS_OF });
		const b = reconcileMedications([...claims].reverse(), { asOf: AS_OF });
		assert.deepEqual(a, b);
	});
});

describe('toIsoDate', () => {
	test('handles pg Date values, partial dates and junk', () => {
		assert.equal(toIsoDate(new Date(2021, 1, 2)), '2021-02-02');
		assert.equal(toIsoDate('2019-03'), '2019-03-01');
		assert.equal(toIsoDate('2019'), '2019-01-01');
		assert.equal(toIsoDate('not a date'), null);
		assert.equal(toIsoDate(null), null);
	});
});
