#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';
import {
	DEFAULT_DECISION_BLOCK_HOLD_MS,
	createDecisionBlockState,
	updateDecisionBlockState,
	snapshotDecisionBlock,
	formatDecisionBlockVerdict
} from '../src/utils/decision-block-state.js';

console.log('✓ Testing scoreboard decision block state...\n');

const athlete7 = { key: 7, startNumber: '12', fullName: 'SMITH, John', ageGroups: 'SR, U23' };
const athlete8 = { key: 8, startNumber: '14', fullName: 'DOE, Jane', ageGroups: 'SR' };
const resolveAthlete = (key, fallbackName) => {
	if (String(key) === '7') return athlete7;
	if (String(key) === '8') return athlete8;
	return fallbackName ? { key: key ?? null, startNumber: '', fullName: fallbackName, ageGroups: '' } : null;
};

const ds = (sequence, refs, jury = [], extra = {}) => ({
	sequence,
	athleteKey: 7,
	visible: true,
	down: false,
	singleRef: false,
	refs,
	jury,
	review: 'none',
	panelReview: false,
	juryReview: false,
	reviewVoteOpen: false,
	reviewVoteCalled: false,
	panelProcedure: false,
	...extra
});

// 1. No jury: 20 s hold starts at FULL_DECISION, ignores DOWN_SIGNAL / RESET / LiftingOrderUpdated, expires at 20 s
{
	const block = createDecisionBlockState(20000);
	const t0 = 1_000_000;

	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'DOWN_SIGNAL', down: 'true', decisionState: ds(1, ['empty', 'empty', 'empty'], [], { down: true }) },
		mergedState: { currentAthleteKey: 7 },
		resolveAthlete,
		now: t0
	});
	assert.equal(snapshotDecisionBlock(block, t0).state, 'ready', 'DOWN_SIGNAL never activates decision block');

	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'FULL_DECISION', d1: 'true', d2: 'true', d3: 'false', decisionsVisible: 'true', decisionState: ds(2, ['white', 'white', 'red'], []) },
		mergedState: { currentAthleteKey: 7, decisionState: ds(2, ['white', 'white', 'red'], []) },
		resolveAthlete,
		now: t0 + 1000
	});
	let snap = snapshotDecisionBlock(block, t0 + 1000);
	assert.equal(snap.state, 'decision');
	assert.equal(snap.athlete.startNumber, '12');
	assert.equal(snap.athlete.fullName, 'SMITH, John');
	assert.equal(snap.athlete.ageGroups, 'SR, U23');
	assert.deepEqual(snap.refLights, { singleRef: false, refs: ['white', 'white', 'red'] });
	assert.equal(snap.expiresAt, t0 + 1000 + DEFAULT_DECISION_BLOCK_HOLD_MS);
	assert.equal(snap.waitingForJury, false);

	// 3.5 s later: FOP RESET + LiftingOrderUpdated to next athlete must NOT clear the block
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'RESET', decisionsVisible: 'false', decisionState: ds(3, ['empty', 'empty', 'empty'], [], { visible: false }) },
		mergedState: { currentAthleteKey: 7 },
		resolveAthlete,
		now: t0 + 4500
	});
	updateDecisionBlockState(block, {
		messageType: 'update',
		normalizedParams: { uiEvent: 'LiftingOrderUpdated', currentAthleteKey: 8, fullName: 'DOE, Jane' },
		mergedState: { fopState: 'CURRENT_ATHLETE_DISPLAYED', mode: 'CURRENT_ATHLETE', currentAthleteKey: 8 },
		resolveAthlete,
		now: t0 + 4600
	});
	snap = snapshotDecisionBlock(block, t0 + 15000);
	assert.equal(snap.state, 'decision', 'decision stays after RESET and LiftingOrderUpdated');
	assert.equal(snap.athlete.fullName, 'SMITH, John', 'keeps athlete who lifted');

	// At 20 s: expires back to ready
	snap = snapshotDecisionBlock(block, t0 + 21000);
	assert.equal(snap.state, 'ready', 'expires after 20 s');
	assert.equal(snap.athlete, null);
}

// 2. Jury configured: waits for all jurors to vote before starting 20 s hold
{
	const block = createDecisionBlockState(20000);
	const t0 = 2_000_000;

	const ds0 = ds(10, ['white', 'white', 'red'], ['empty', 'empty', 'empty', 'empty']);
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'FULL_DECISION', decisionState: ds0 },
		mergedState: { currentAthleteKey: 7, decisionState: ds0 },
		resolveAthlete,
		now: t0
	});
	let snap = snapshotDecisionBlock(block, t0 + 25000);
	assert.equal(snap.state, 'decision', 'does not expire while jury votes are missing');
	assert.equal(snap.waitingForJury, true);
	assert.equal(snap.expiresAt, null);

	// Partial jury vote still waits
	const ds1 = ds(11, ['white', 'white', 'red'], ['voted', 'voted', 'empty', 'empty']);
	updateDecisionBlockState(block, {
		messageType: 'decision',
		juryEventType: 'JURY_UPDATE',
		normalizedParams: { decisionState: ds1 },
		mergedState: { decisionState: ds1 },
		resolveAthlete,
		now: t0 + 26000
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 26000).expiresAt, null);

	// Final jury vote starts the 20 s hold
	const ds2 = ds(12, ['white', 'white', 'red'], ['white', 'white', 'red', 'white']);
	updateDecisionBlockState(block, {
		messageType: 'decision',
		juryEventType: 'JURY_UPDATE',
		normalizedParams: { decisionState: ds2 },
		mergedState: { decisionState: ds2 },
		resolveAthlete,
		now: t0 + 30000
	});
	snap = snapshotDecisionBlock(block, t0 + 30000);
	assert.equal(snap.waitingForJury, false);
	assert.equal(snap.expiresAt, t0 + 50000, '20 s starts at last jury vote');

	// Starting the next athlete clock clears early
	updateDecisionBlockState(block, {
		messageType: 'timer',
		normalizedParams: { athleteTimerEventType: 'StartTime', athleteMillisRemaining: '60000' },
		mergedState: { fopState: 'TIME_RUNNING', mode: 'CURRENT_ATHLETE' },
		resolveAthlete,
		now: t0 + 32000
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 32000).state, 'ready', 'StartTime clears early');
}

// 3. Seven-person panel deliberation -> vote called -> verdict -> StartLifting keeps verdict -> correction restarts 20 s
{
	const block = createDecisionBlockState(20000);
	const t0 = 3_000_000;

	const dsDelib = ds(20, ['white', 'white', 'red'], ['white', 'red', 'red', 'red'], {
		review: 'deliberation',
		panelReview: true,
		panelProcedure: true,
		reviewStartMillis: t0,
		originalRefereeDecisions: [true, true, false]
	});
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'START_DELIBERATION', decisionState: dsDelib },
		mergedState: { fopState: 'BREAK', breakType: 'JURY', mode: 'INTERRUPTION', decisionState: dsDelib },
		resolveAthlete,
		now: t0
	});
	let snap = snapshotDecisionBlock(block, t0 + 1000);
	assert.equal(snap.state, 'deliberation');
	assert.equal(snap.reviewLabelKey, 'PublicMsg.AdjudicationPanelReview');
	assert.equal(snap.reviewStartMillis, t0);
	assert.deepEqual(snap.refLights, { singleRef: false, refs: ['white', 'white', 'red'] });
	assert.equal(snap.expiresAt, null);

	// Chair calls vote: label switches to AdjudicationPanelVote, original ref lights stay (showJuryVotes=false)
	const dsVote = { ...dsDelib, sequence: 21, reviewVoteOpen: true, reviewVoteCalled: true, refs: ['empty', 'empty', 'empty'] };
	updateDecisionBlockState(block, {
		messageType: 'decision',
		juryEventType: 'PANEL_VOTE_CALLED',
		normalizedParams: { decisionState: dsVote },
		mergedState: { decisionState: dsVote },
		resolveAthlete,
		now: t0 + 5000
	});
	snap = snapshotDecisionBlock(block, t0 + 5000);
	assert.equal(snap.reviewLabelKey, 'PublicMsg.AdjudicationPanelVote');
	assert.deepEqual(snap.refLights, { singleRef: false, refs: ['white', 'white', 'red'] }, 'panel review keeps original ref lights when jury votes hidden');

	// Speaker-only waitForAnnouncer=true verdict is ignored
	const adjudicationWait = {
		decision: false, reversal: true, ruleCode: 5, athleteKey: 7, liftTypeKey: 'Snatch', attemptNumber: 2,
		originalRefereeDecisions: [true, true, false], newRecord: false, waitForAnnouncer: true
	};
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'JURY_DECISION', adjudicationDecision: adjudicationWait },
		mergedState: { decisionState: dsVote },
		resolveAthlete,
		now: t0 + 10000
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 10000).verdict, null, 'waitForAnnouncer=true ignored');

	// Confirmed verdict starts 20 s hold and clears stopwatch
	const adjudicationConfirmed = { ...adjudicationWait, waitForAnnouncer: false };
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'JURY_DECISION', adjudicationDecision: adjudicationConfirmed },
		mergedState: { decisionState: dsVote },
		resolveAthlete,
		now: t0 + 12000
	});
	snap = snapshotDecisionBlock(block, t0 + 12000);
	assert.equal(snap.state, 'deliberation');
	assert.equal(snap.verdict.good, false);
	assert.equal(snap.verdict.ruleCode, 5);
	assert.equal(snap.reviewStartMillis, null, 'stopwatch stopped on verdict');
	assert.equal(snap.expiresAt, t0 + 32000);

	// 3.5 s later: OWLCMS automatic StartLifting keeps verdict and does NOT restart 20 s
	updateDecisionBlockState(block, {
		messageType: 'update',
		normalizedParams: { uiEvent: 'StartLifting' },
		mergedState: { fopState: 'CURRENT_ATHLETE_DISPLAYED', mode: 'CURRENT_ATHLETE' },
		resolveAthlete,
		now: t0 + 15500
	});
	snap = snapshotDecisionBlock(block, t0 + 15500);
	assert.equal(snap.verdict.good, false, 'StartLifting keeps verdict');
	assert.equal(snap.expiresAt, t0 + 32000, 'StartLifting does not restart 20 s');

	// Corrected verdict restarts 20 s
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: {
			decisionEventType: 'JURY_DECISION',
			adjudicationDecision: { ...adjudicationConfirmed, decision: true, reversal: false, ruleCode: null }
		},
		mergedState: {},
		resolveAthlete,
		now: t0 + 20000
	});
	snap = snapshotDecisionBlock(block, t0 + 20000);
	assert.equal(snap.verdict.good, true);
	assert.equal(snap.expiresAt, t0 + 40000, 'correction restarts 20 s');
}

// 4. Jury-only review hides referee lights; JURY_DISPLAY_RESET restores them; StartLifting (Resume) clears deliberation
{
	const block = createDecisionBlockState(20000);
	const t0 = 4_000_000;
	const dsJuryOnly = ds(30, ['empty', 'empty', 'empty'], ['empty', 'empty', 'empty'], {
		review: 'challenge',
		panelProcedure: false,
		reviewVoteOpen: true,
		originalRefereeDecisions: [true, true, false]
	});
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'CHALLENGE', decisionState: dsJuryOnly },
		mergedState: { decisionState: dsJuryOnly },
		resolveAthlete,
		now: t0
	});
	let snap = snapshotDecisionBlock(block, t0);
	assert.equal(snap.reviewLabelKey, 'PublicMsg.CHALLENGE');
	assert.equal(snap.refLights, null, 'jury-only open vote hides referee lights (HIDE_REFEREES_DISPLAYS)');

	// Cancel vote result (JURY_DISPLAY_RESET while no verdict): stays in deliberation and restores original lights
	const dsReset = { ...dsJuryOnly, sequence: 31, reviewVoteOpen: false, reviewVoteCalled: false };
	updateDecisionBlockState(block, {
		messageType: 'decision',
		juryEventType: 'JURY_DISPLAY_RESET',
		normalizedParams: { decisionState: dsReset },
		mergedState: { decisionState: dsReset },
		resolveAthlete,
		now: t0 + 2000
	});
	snap = snapshotDecisionBlock(block, t0 + 2000);
	assert.equal(snap.state, 'deliberation');
	assert.deepEqual(snap.refLights, { singleRef: false, refs: ['white', 'white', 'red'] });

	// Resume without verdict: StartLifting returns to ready
	updateDecisionBlockState(block, {
		messageType: 'update',
		normalizedParams: { uiEvent: 'StartLifting' },
		mergedState: { fopState: 'CURRENT_ATHLETE_DISPLAYED', mode: 'CURRENT_ATHLETE' },
		resolveAthlete,
		now: t0 + 3000
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 3000).state, 'ready');
}

// 5. Last snatch (FIRST_CJ) and SESSION_DONE keep hold; TECHNICAL break clears
{
	const block = createDecisionBlockState(20000);
	const t0 = 5_000_000;
	const dsDec = ds(40, ['white', 'white', 'white'], []);
	updateDecisionBlockState(block, {
		messageType: 'decision',
		normalizedParams: { decisionEventType: 'FULL_DECISION', decisionState: dsDec },
		mergedState: { currentAthleteKey: 7, decisionState: dsDec },
		resolveAthlete,
		now: t0
	});
	updateDecisionBlockState(block, {
		messageType: 'update',
		normalizedParams: { uiEvent: 'BreakStarted', breakType: 'FIRST_CJ' },
		mergedState: { fopState: 'BREAK', mode: 'LIFT_COUNTDOWN', breakType: 'FIRST_CJ' },
		resolveAthlete,
		now: t0 + 3500
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 5000).state, 'decision', 'FIRST_CJ preserves decision hold');

	updateDecisionBlockState(block, {
		messageType: 'update',
		normalizedParams: { uiEvent: 'BreakStarted', breakType: 'TECHNICAL' },
		mergedState: { fopState: 'BREAK', mode: 'INTERRUPTION', breakType: 'TECHNICAL' },
		resolveAthlete,
		now: t0 + 6000
	});
	assert.equal(snapshotDecisionBlock(block, t0 + 6000).state, 'ready', 'TECHNICAL break clears decision hold');
}

// 6. Verdict formatting matches OWLCMS Results.renderJuryVerdict + JuryRejectionReasons
{
	const labels = {
		'JuryDialog.GoodLiftLabel': 'Good Lift',
		'JuryDialog.BadLiftLabel': 'No Lift',
		'Jury.StandsAsCalled': 'Referee Decision Stands as Called',
		'Jury.incorrect.5': 'Press-out'
	};
	assert.equal(formatDecisionBlockVerdict({ good: true, ruleCode: null }, labels), 'Good Lift');
	assert.equal(formatDecisionBlockVerdict({ good: false, ruleCode: 5 }, labels), 'No Lift \u2013 5 - Press-out');
	assert.equal(formatDecisionBlockVerdict({ good: true, ruleCode: 0 }, labels), 'Good Lift \u2013 Referee Decision Stands as Called');
}

// 7. CompetitionHub end-to-end integration: decisionBlock emitted on decision & timer and stored on fopUpdates
{
	const hub = new CompetitionHub();
	hub.databaseRequested = 0;
	const emittedDecisions = [];
	const emittedTimers = [];
	hub.on('decision', (e) => emittedDecisions.push(e));
	hub.on('timer', (e) => emittedTimers.push(e));

	hub.handleOwlcmsMessage({
		fop: 'A',
		fopState: 'DECISION_VISIBLE',
		mode: 'CURRENT_ATHLETE',
		break: 'false',
		decisionEventType: 'FULL_DECISION',
		fullName: 'SMITH, John',
		startNumber: '12',
		d1: 'true',
		d2: 'true',
		d3: 'false',
		decisionsVisible: 'true',
		decisionState: ds(50, ['white', 'white', 'red'], [])
	}, 'decision');

	assert.equal(emittedDecisions.length, 1);
	assert.equal(emittedDecisions[0].decisionBlock.state, 'decision');
	assert.equal(emittedDecisions[0].decisionBlock.athlete.fullName, 'SMITH, John');
	assert.equal(hub.fopUpdates.A.decisionBlock.state, 'decision');

	hub.handleOwlcmsMessage({
		fop: 'A',
		fopState: 'TIME_RUNNING',
		mode: 'CURRENT_ATHLETE',
		break: 'false',
		athleteTimerEventType: 'StartTime',
		athleteMillisRemaining: '60000'
	}, 'timer');

	assert.equal(emittedTimers.length, 1);
	assert.equal(emittedTimers[0].decisionBlock.state, 'ready', 'timer StartTime emits cleared decisionBlock');
	assert.equal(hub.fopUpdates.A.decisionBlock.state, 'ready');
}

console.log('✓ Scoreboard decision block state tests passed\n');
