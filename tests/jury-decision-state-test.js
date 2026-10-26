#!/usr/bin/env node

import assert from 'node:assert/strict';

import { CompetitionHub } from '../src/competition-hub.js';
import { extractDecisionDisplayDefaults, extractDecisionState } from '../src/utils/timer-decision-helpers.js';

console.log('✓ Testing jury decision state...\n');

const cells = (sequence, refs, jury, extra = {}) => ({
	sequence, athleteKey: 7, visible: true, down: false, singleRef: false, refs, jury,
	review: 'none', panelReview: false, reviewVoteOpen: false, ...extra
});

// no database in these tests: skip the hub's short wait for a just-requested database
function send(hub, payload, type) {
	hub.databaseRequested = 0;
	hub.handleOwlcmsMessage(payload, type);
}

function decision(hub, payload) {
	hub.databaseRequested = 0;
	hub.handleOwlcmsMessage({ fop: 'A', fopState: 'DECISION_VISIBLE', mode: 'CURRENT_ATHLETE', break: 'false', ...payload }, 'decision');
	return hub.fopUpdates.A;
}

// Jury and review-vote messages keep FULL_DECISION as the platform's decisionEventType
{
	const hub = new CompetitionHub();
	const broadcasts = [];
	hub.on('decision', (event) => broadcasts.push(event.decision));

	decision(hub, {
		decisionEventType: 'FULL_DECISION', d1: 'true', d2: 'true', d3: 'false', decisionsVisible: 'true', down: 'false',
		decisionState: cells(10, ['white', 'white', 'red'], ['empty', 'empty', 'empty', 'empty'])
	});
	const state = decision(hub, {
		decisionEventType: 'JURY_UPDATE', d1: 'true', d2: 'true', d3: 'false', decisionsVisible: 'true', down: 'false',
		decisionState: cells(11, ['white', 'white', 'red'], ['voted', 'empty', 'empty', 'empty'])
	});

	assert.equal(state.decisionEventType, 'FULL_DECISION', 'referee decision type kept');
	assert.equal(state.juryEventType, 'JURY_UPDATE', 'jury type stored separately');
	assert.deepEqual(state.decisionState.jury, ['voted', 'empty', 'empty', 'empty']);
	assert.equal(broadcasts[1].type, 'JURY_UPDATE', 'broadcast carries the message type, not FULL_DECISION');
	assert.deepEqual(broadcasts[1].decisionState.jury, ['voted', 'empty', 'empty', 'empty']);
	assert.equal(extractDecisionState(state).type, 'FULL_DECISION', 'Celebrations-style readers still see FULL_DECISION');
}

// A late jury vote after the reset does not bring the referee decision back
{
	const hub = new CompetitionHub();
	decision(hub, { decisionEventType: 'RESET', decisionsVisible: 'false', down: 'false', decisionState: cells(20, ['empty', 'empty', 'empty'], [], { visible: false }) });
	const state = decision(hub, {
		decisionEventType: 'JURY_UPDATE', d1: 'true', d2: 'true', d3: 'true', decisionsVisible: 'true', down: 'false',
		decisionState: cells(21, ['empty', 'empty', 'empty'], ['voted', 'empty', 'empty'], { visible: false })
	});
	assert.equal(state.decisionEventType, 'RESET');
	assert.equal(state.decisionsVisible, 'false', 'legacy fields of a jury message are ignored');
}

// An older decisionState arriving late is ignored
{
	const hub = new CompetitionHub();
	decision(hub, { decisionEventType: 'PANEL_VOTE', decisionState: cells(31, ['voted', 'voted', 'voted'], ['voted', 'voted', 'voted', 'voted']) });
	const state = decision(hub, { decisionEventType: 'PANEL_VOTE', decisionState: cells(30, ['empty', 'empty', 'empty'], ['empty', 'empty', 'empty', 'empty']) });
	assert.equal(state.decisionState.sequence, 31, 'stale sequence ignored');
}

// decisionState and adjudicationDecision survive an update and reach plugins during a review break
{
	const hub = new CompetitionHub();
	const adjudication = {
		decision: false, reversal: true, ruleCode: 5, athleteKey: 7, liftTypeKey: 'Snatch', attemptNumber: 2,
		originalRefereeDecisions: [true, true, false], refereeVotes: [false, false, true], juryVotes: [false, false, false, true],
		newRecord: false, recordKind: 'none', waitForAnnouncer: false, chairEntered: false, speakerEntered: false
	};
	decision(hub, {
		decisionEventType: 'JURY_DECISION', fopState: 'BREAK', break: 'true',
		decisionState: cells(40, ['red', 'red', 'white'], ['red', 'red', 'red', 'white'], { review: 'deliberation', panelReview: true }),
		adjudicationDecision: adjudication
	});
	assert.ok(hub.fopUpdates.A.adjudicationDecisionReceivedAt > 0, 'arrival time recorded');

	send(hub, { fop: 'A', uiEvent: 'BreakStarted', fopState: 'BREAK', break: 'true', breakType: 'JURY', mode: 'INTERRUPTION' }, 'update');
	const state = hub.fopUpdates.A;
	assert.deepEqual(state.adjudicationDecision, adjudication, 'adjudicationDecision preserved across an update');

	const extracted = extractDecisionState(state);
	assert.equal(extracted.visible, false, 'legacy referee decision hidden in a break');
	assert.equal(extracted.decisionState.review, 'deliberation', 'decisionState still available in a break');
	assert.deepEqual(extracted.adjudicationDecision, adjudication);

	// the next clock start clears the jury decision
	send(hub, { fop: 'A', athleteTimerEventType: 'StartTime', athleteMillisRemaining: '60000', fopState: 'TIME_RUNNING', break: 'false' }, 'timer');
	assert.equal(hub.fopUpdates.A.adjudicationDecision, undefined, 'cleared at the next clock start');
	assert.equal(hub.fopUpdates.A.decisionState.sequence, 40, 'decisionState is OWLCMS-authoritative, never cleared by the hub');
}

// Option defaults
{
	const defaults = extractDecisionDisplayDefaults({ juryDecisionsOnAttemptBoard: 'true', juryDecisionsOnScoreboard: 'false' });
	assert.equal(defaults.juryDecisionsOnAttemptBoard, true);
	assert.equal(defaults.juryDecisionsOnScoreboard, false);
	assert.equal(defaults.decisionSectionStopwatch, undefined, 'unsent switch is undefined');
}

console.log('✓ Jury decision state tests passed\n');
