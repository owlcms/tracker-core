/**
 * Scoreboard Decision Block State Machine (OWLCMS 69 code parity, outcome-only).
 *
 * Mirrors OWLCMS DecisionBlockState.java (with showJuryVotes = false), Results.java,
 * ReviewLabels.java, and JuryRejectionReasons.java so tracker scoreboards can render
 * the bottom decision section with the 20 s hold behavior across live SSE events and
 * fresh/reloaded API requests.
 */

export const DEFAULT_DECISION_BLOCK_HOLD_MS = 20000;

export const DECISION_BLOCK_LABEL_KEYS = [
	'PublicMsg.JuryDeliberation',
	'PublicMsg.AdjudicationPanelReview',
	'PublicMsg.JuryReview',
	'PublicMsg.CHALLENGE',
	'PublicMsg.AdjudicationPanelVote',
	'PublicMsg.JuryVote',
	'JuryDialog.GoodLiftLabel',
	'JuryDialog.BadLiftLabel',
	'Jury.StandsAsCalled',
	...Array.from({ length: 17 }, (_, i) => `Jury.incorrect.${i + 1}`)
];

const JURY_BREAK_TYPES = new Set(['JURY', 'CHALLENGE']);
const LIFTS_DONE_BREAK_TYPES = new Set(['FIRST_CJ', 'GROUP_DONE']);

function cleanText(value) {
	if (value === null || value === undefined) return '';
	return String(value).replace(/&ndash;/g, '\u2013').replace(/&mdash;/g, '\u2014').trim();
}

function parseOptionalBool(value) {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	return null;
}

function parseOptionalInt(value) {
	if (value === null || value === undefined || value === '') return null;
	const parsed = Number.parseInt(String(value), 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function boolToCell(value) {
	if (value === true || value === 'true') return 'white';
	if (value === false || value === 'false') return 'red';
	return 'empty';
}

function hasAnyDecisionLight(refs) {
	return Array.isArray(refs) && refs.some((c) => c === 'white' || c === 'red');
}

function normalizeRefCells(rawRefs) {
	if (!Array.isArray(rawRefs)) return ['empty', 'empty', 'empty'];
	return [0, 1, 2].map((index) => {
		const cell = rawRefs[index];
		return cell === 'white' || cell === 'red' ? cell : 'empty';
	});
}

/**
 * Convert an array of 3 referee booleans (from decisionState.originalRefereeDecisions
 * or adjudicationDecision.originalRefereeDecisions) into { singleRef, refs }.
 * Returns null if no lights are set.
 */
export function refLightsFromBooleans(decisions) {
	if (!Array.isArray(decisions) || decisions.length === 0) return null;
	const c0 = boolToCell(decisions[0]);
	const c1 = boolToCell(decisions[1]);
	const c2 = boolToCell(decisions[2]);
	const refs = [c0, c1, c2];
	if (!hasAnyDecisionLight(refs)) return null;
	const singleRef = c0 === 'empty' && c2 === 'empty' && c1 !== 'empty';
	return { singleRef, refs };
}

/**
 * Extract referee lights from a FULL_DECISION payload (OWLCMS 69 decisionState or legacy d1/d2/d3).
 */
export function refLightsFromDecisionPayload(decisionState, params) {
	if (decisionState && Array.isArray(decisionState.refs)) {
		const singleRef = decisionState.singleRef === true;
		const refs = normalizeRefCells(decisionState.refs);
		if (hasAnyDecisionLight(refs)) {
			return { singleRef, refs };
		}
	}
	const singleRef = params?.singleLight === true || params?.singleLight === 'true'
		|| params?.singleReferee === true || params?.singleReferee === 'true';
	const d1 = boolToCell(params?.d1);
	const d2 = boolToCell(params?.d2 ?? (singleRef ? params?.decision : null));
	const d3 = boolToCell(params?.d3);
	const refs = singleRef ? ['empty', d2, 'empty'] : [d1, d2, d3];
	return hasAnyDecisionLight(refs) ? { singleRef, refs } : null;
}

/**
 * Resolve the review label translation key matching OWLCMS ReviewLabels.key().
 */
export function resolveReviewLabelKey(decisionState, deliberationType) {
	const review = decisionState?.review;
	const isChallenge = deliberationType === 'CHALLENGE' || review === 'challenge';
	const isReview = isChallenge || deliberationType === 'START_DELIBERATION' || (review && review !== 'none');
	if (!isReview) return null;

	if (decisionState?.reviewVoteCalled === true) {
		return decisionState?.panelProcedure === true
			? 'PublicMsg.AdjudicationPanelVote'
			: 'PublicMsg.JuryVote';
	}
	if (isChallenge) return 'PublicMsg.CHALLENGE';
	if (decisionState?.panelReview === true) return 'PublicMsg.AdjudicationPanelReview';
	if (decisionState?.juryReview === true) return 'PublicMsg.JuryReview';
	return 'PublicMsg.JuryDeliberation';
}

/**
 * Format the verdict text matching OWLCMS Results.renderJuryVerdict() + JuryRejectionReasons.label().
 * Returns e.g. "Good Lift", "No Lift – 5 - Press-out", or "Good Lift – Referee Decision Stands as Called".
 */
export function formatDecisionBlockVerdict(verdict, labels = {}) {
	if (!verdict || typeof verdict.good !== 'boolean') return '';
	const verdictKey = verdict.good ? 'JuryDialog.GoodLiftLabel' : 'JuryDialog.BadLiftLabel';
	const verdictLabel = labels?.[verdictKey] || verdictKey;
	const ruleCode = verdict.ruleCode;
	let rule = null;
	if (ruleCode === 0) {
		rule = labels?.['Jury.StandsAsCalled'] || 'Jury.StandsAsCalled';
	} else if (ruleCode !== null && ruleCode !== undefined && ruleCode >= 1 && ruleCode <= 17) {
		const ruleKey = `Jury.incorrect.${ruleCode}`;
		const ruleText = labels?.[ruleKey];
		rule = ruleText ? `${ruleCode} - ${ruleText}` : String(ruleCode);
	}
	return rule ? `${verdictLabel} \u2013 ${rule}` : verdictLabel;
}

/**
 * Pick only the translation strings needed by the scoreboard decision block.
 */
export function buildDecisionBlockLabels(translations) {
	const labels = {};
	for (const key of DECISION_BLOCK_LABEL_KEYS) {
		if (translations?.[key]) {
			labels[key] = translations[key];
		}
	}
	return labels;
}

function allJurorsVoted(juryCells) {
	if (!Array.isArray(juryCells) || juryCells.length === 0) return false;
	return juryCells.every((cell) => cell === 'white' || cell === 'red');
}

function cloneAthlete(athlete) {
	if (!athlete) return null;
	return {
		key: athlete.key ?? null,
		startNumber: athlete.startNumber !== undefined && athlete.startNumber !== null ? String(athlete.startNumber) : '',
		fullName: cleanText(athlete.fullName),
		ageGroups: cleanText(athlete.ageGroups)
	};
}

function cloneRefLights(lights) {
	if (!lights) return null;
	return {
		singleRef: lights.singleRef === true,
		refs: [...lights.refs]
	};
}

function cloneVerdict(verdict) {
	if (!verdict) return null;
	return { ...verdict };
}

/**
 * Create a fresh per-FOP internal decision-block state.
 */
export function createDecisionBlockState(holdMs = DEFAULT_DECISION_BLOCK_HOLD_MS) {
	return {
		state: 'ready',
		sequence: 0,
		reviewedAthlete: null,
		refLights: null,
		reviewedRefLights: null,
		jurySize: 0,
		juryVoteComplete: false,
		deliberationType: null,
		reviewLabelKey: null,
		reviewStartMillis: null,
		verdict: null,
		startedAt: null,
		holdMs,
		expiresAt: null
	};
}

function toReady(block) {
	const changed = block.state !== 'ready'
		|| block.reviewedAthlete !== null
		|| block.refLights !== null
		|| block.verdict !== null
		|| block.reviewLabelKey !== null
		|| block.expiresAt !== null;
	block.state = 'ready';
	block.reviewedAthlete = null;
	block.refLights = null;
	block.reviewedRefLights = null;
	block.juryVoteComplete = false;
	block.deliberationType = null;
	block.reviewLabelKey = null;
	block.reviewStartMillis = null;
	block.verdict = null;
	block.startedAt = null;
	block.expiresAt = null;
	if (changed) {
		block.sequence += 1;
	}
}

function startHold(block, now) {
	block.startedAt = now;
	block.expiresAt = now + block.holdMs;
}

function clearHold(block) {
	block.startedAt = null;
	block.expiresAt = null;
}

/**
 * Expire an elapsed hold (mirrors DecisionBlockState.onReviewTimeout()).
 */
export function expireDecisionBlockIfNeeded(block, now = Date.now()) {
	if (!block) return false;
	const verdictShown = block.state === 'deliberation' && block.verdict !== null;
	if ((block.state === 'decision' || verdictShown) && block.expiresAt !== null && now >= block.expiresAt) {
		toReady(block);
		return true;
	}
	return false;
}

/**
 * Return a plain JSON-serializable snapshot of the decision block state.
 */
export function snapshotDecisionBlock(block, now = Date.now()) {
	if (!block) {
		return {
			state: 'ready',
			sequence: 0,
			athlete: null,
			refLights: null,
			deliberationType: null,
			reviewLabelKey: null,
			reviewStartMillis: null,
			verdict: null,
			startedAt: null,
			holdMs: DEFAULT_DECISION_BLOCK_HOLD_MS,
			expiresAt: null,
			waitingForJury: false
		};
	}
	expireDecisionBlockIfNeeded(block, now);
	return {
		state: block.state,
		sequence: block.sequence,
		athlete: cloneAthlete(block.reviewedAthlete),
		refLights: cloneRefLights(block.refLights),
		deliberationType: block.deliberationType,
		reviewLabelKey: block.reviewLabelKey,
		reviewStartMillis: block.reviewStartMillis,
		verdict: cloneVerdict(block.verdict),
		startedAt: block.startedAt,
		holdMs: block.holdMs,
		expiresAt: block.expiresAt,
		waitingForJury: block.state === 'decision' && block.jurySize > 0 && !block.juryVoteComplete
	};
}

function enterDeliberation(block, { deliberationType, decisionState, athlete, reviewedLights, now }) {
	block.state = 'deliberation';
	block.deliberationType = deliberationType;
	block.reviewedAthlete = athlete ? cloneAthlete(athlete) : block.reviewedAthlete;
	block.refLights = reviewedLights ? cloneRefLights(reviewedLights) : block.refLights;
	block.reviewedRefLights = cloneRefLights(block.refLights);
	block.verdict = null;
	block.juryVoteComplete = false;
	clearHold(block);
	block.reviewStartMillis = decisionState?.reviewStartMillis ?? block.reviewStartMillis ?? now;
	block.reviewLabelKey = resolveReviewLabelKey(decisionState, deliberationType);

	// Jury-only deliberation/challenge opens the review vote immediately:
	// OWLCMS Results.java + DecisionDisplayRules.HIDE_REFEREES_DISPLAYS hide referee lights.
	if (decisionState?.reviewVoteOpen === true && decisionState?.panelProcedure === false) {
		block.refLights = null;
	}
	block.sequence += 1;
}

function enterDecision(block, { decisionState, params, athlete, now }) {
	const refLights = refLightsFromDecisionPayload(decisionState, params);
	const juryCells = Array.isArray(decisionState?.jury) ? decisionState.jury : [];
	const jurySize = juryCells.length;
	const complete = allJurorsVoted(juryCells);

	block.state = 'decision';
	block.deliberationType = null;
	block.reviewLabelKey = null;
	block.reviewStartMillis = null;
	block.verdict = null;
	block.reviewedAthlete = athlete ? cloneAthlete(athlete) : null;
	block.refLights = refLights;
	block.reviewedRefLights = cloneRefLights(refLights);
	block.jurySize = jurySize;
	block.juryVoteComplete = complete;

	// Parity with DecisionBlockState.render():
	// - No jury (jurySize === 0): start 20 s hold immediately.
	// - Jury configured (jurySize > 0): start 20 s hold once all jurors have voted;
	//   until then wait (cleared by StartTime, deliberation, or non-jury break).
	if (jurySize === 0 || complete) {
		startHold(block, now);
	} else {
		clearHold(block);
	}
	block.sequence += 1;
}

function handleLiftsDone(block) {
	// Parity with DecisionBlockState.onLiftsDone():
	// DECISION stays (running hold or waiting for missing jury votes);
	// a shown jury verdict stays until its hold expires; anything else returns to READY.
	if (block.state === 'decision') {
		return;
	}
	if (block.state === 'deliberation' && block.verdict !== null) {
		return;
	}
	if (block.state !== 'ready') {
		toReady(block);
	}
}

/**
 * Apply one incoming OWLCMS WebSocket message to the per-FOP decision-block state.
 *
 * @param {Object} block - Mutable state created by createDecisionBlockState()
 * @param {Object} context
 * @param {'decision'|'timer'|'update'} context.messageType
 * @param {Object} context.normalizedParams - Current incoming message params
 * @param {Object} context.mergedState - Merged FOP state after hub processing
 * @param {string|null} [context.juryEventType] - Jury event type if decision message was a jury/panel event
 * @param {Function} [context.resolveAthlete] - (athleteKey, fallbackName) => { key, startNumber, fullName, ageGroups } | null
 * @param {number} [context.now] - Current timestamp in ms
 */
export function updateDecisionBlockState(block, {
	messageType,
	normalizedParams = {},
	mergedState = {},
	juryEventType = null,
	resolveAthlete = () => null,
	now = Date.now()
}) {
	expireDecisionBlockIfNeeded(block, now);

	const reportedHold = parseOptionalInt(normalizedParams.decisionBlockHold);
	if (reportedHold !== null && reportedHold > 0) {
		block.holdMs = reportedHold;
	}

	const ds = mergedState.decisionState || normalizedParams.decisionState || null;

	if (messageType === 'decision') {
		const eventType = juryEventType || normalizedParams.decisionEventType || null;

		if (eventType === 'FULL_DECISION') {
			// Ignored during an active deliberation without a verdict.
			if (block.state === 'deliberation' && block.verdict === null) {
				return;
			}
			const athleteKey = ds?.athleteKey ?? mergedState.currentAthleteKey ?? null;
			const athlete = resolveAthlete(athleteKey, normalizedParams.fullName || mergedState.fullName);
			enterDecision(block, { decisionState: ds, params: normalizedParams, athlete, now });
			return;
		}

		if (eventType === 'JURY_UPDATE') {
			if (block.state === 'decision' && !block.juryVoteComplete) {
				const juryCells = Array.isArray(ds?.jury) ? ds.jury : [];
				if (juryCells.length > 0) {
					block.jurySize = juryCells.length;
					if (allJurorsVoted(juryCells)) {
						block.juryVoteComplete = true;
						startHold(block, now);
						block.sequence += 1;
					}
				}
			}
			return;
		}

		if (eventType === 'START_DELIBERATION' || eventType === 'CHALLENGE') {
			const athleteKey = ds?.athleteKey ?? null;
			const athlete = resolveAthlete(athleteKey, normalizedParams.athleteFull || normalizedParams.fullName)
				|| block.reviewedAthlete;
			const reviewedLights = refLightsFromBooleans(ds?.originalRefereeDecisions) || block.refLights;
			enterDeliberation(block, {
				deliberationType: eventType,
				decisionState: ds,
				athlete,
				reviewedLights,
				now
			});
			return;
		}

		if (eventType === 'PANEL_VOTE_CALLED' || eventType === 'PANEL_VOTE') {
			if (block.state === 'deliberation' && block.verdict === null) {
				let changed = false;
				const nextLabel = resolveReviewLabelKey(ds, block.deliberationType);
				if (nextLabel && nextLabel !== block.reviewLabelKey) {
					block.reviewLabelKey = nextLabel;
					changed = true;
				}
				// With showJuryVotes = false:
				// - Seven-person panel (panelProcedure === true): keep original referee lights.
				// - Jury-only review (panelProcedure === false): hide referee lights (HIDE_REFEREES_DISPLAYS).
				if (ds?.panelProcedure === false && block.refLights !== null) {
					block.refLights = null;
					changed = true;
				}
				if (changed) {
					block.sequence += 1;
				}
			}
			return;
		}

		if (eventType === 'JURY_DECISION') {
			const adjudication = normalizedParams.adjudicationDecision || null;
			const waitForAnnouncer = adjudication
				? adjudication.waitForAnnouncer === true
				: parseOptionalBool(normalizedParams.waitForAnnouncer) === true;
			if (waitForAnnouncer) {
				return;
			}
			const good = adjudication
				? adjudication.decision
				: (normalizedParams.juryDecision === 'GOOD_LIFT'
					? true
					: (normalizedParams.juryDecision === 'BAD_LIFT' ? false : null));
			if (typeof good !== 'boolean') {
				return;
			}

			const athleteKey = adjudication?.athleteKey ?? ds?.athleteKey ?? null;
			const fallbackName = normalizedParams.athleteFull || normalizedParams.fullName || null;
			const resolvedAthlete = resolveAthlete(athleteKey, fallbackName);

			if (block.state !== 'deliberation') {
				const reviewedLights = refLightsFromBooleans(
					adjudication?.originalRefereeDecisions ?? ds?.originalRefereeDecisions
				) || block.refLights;
				block.state = 'deliberation';
				block.reviewedAthlete = resolvedAthlete || block.reviewedAthlete;
				block.refLights = reviewedLights;
				block.reviewedRefLights = cloneRefLights(reviewedLights);
				block.deliberationType = null;
				block.reviewLabelKey = null;
				block.juryVoteComplete = false;
			} else if (!block.reviewedAthlete && resolvedAthlete) {
				block.reviewedAthlete = resolvedAthlete;
			}

			block.verdict = {
				good,
				reversal: adjudication?.reversal ?? parseOptionalBool(normalizedParams.juryReversal),
				ruleCode: adjudication?.ruleCode ?? parseOptionalInt(normalizedParams.juryReasonCode),
				newRecord: adjudication?.newRecord === true,
				liftTypeKey: adjudication?.liftTypeKey ?? null,
				attemptNumber: adjudication?.attemptNumber ?? null
			};
			block.reviewStartMillis = null;
			startHold(block, now);
			block.sequence += 1;
			return;
		}

		if (eventType === 'JURY_DISPLAY_RESET') {
			if (block.state === 'deliberation' && block.verdict === null) {
				// Cancel vote result or Chair-entered decision: stay in deliberation,
				// restore original referee lights and review label.
				block.refLights = cloneRefLights(block.reviewedRefLights);
				block.reviewLabelKey = resolveReviewLabelKey(ds, block.deliberationType);
				block.sequence += 1;
				return;
			}
			toReady(block);
			return;
		}

		// RESET, DOWN_SIGNAL, INITIAL_DECISION, END_DELIBERATION, END_CHALLENGE: no state change.
		return;
	}

	if (messageType === 'timer') {
		if (normalizedParams.athleteTimerEventType === 'StartTime') {
			if (block.state !== 'ready') {
				toReady(block);
			}
			return;
		}
		if (normalizedParams.breakTimerEventType === 'BreakStarted') {
			const breakType = String(normalizedParams.breakType || mergedState.breakType || '').toUpperCase();
			if (JURY_BREAK_TYPES.has(breakType)) {
				return;
			}
			if (LIFTS_DONE_BREAK_TYPES.has(breakType)) {
				handleLiftsDone(block);
				return;
			}
			toReady(block);
		}
		return;
	}

	if (messageType === 'update') {
		const uiEvent = normalizedParams.uiEvent || '';
		const fopState = String(mergedState.fopState || '').toUpperCase();
		const mode = String(mergedState.mode || '').toUpperCase();
		const breakType = String(mergedState.breakType || '').toUpperCase();

		if (fopState === 'INACTIVE' || mode === 'WAIT') {
			toReady(block);
			return;
		}

		if (uiEvent === 'SwitchGroup' || uiEvent === 'InitialSync') {
			if (fopState === 'BREAK' && JURY_BREAK_TYPES.has(breakType)) {
				const deliberationType = breakType === 'CHALLENGE' ? 'CHALLENGE' : 'START_DELIBERATION';
				const athlete = resolveAthlete(ds?.athleteKey ?? null, null);
				const reviewedLights = refLightsFromBooleans(ds?.originalRefereeDecisions);
				enterDeliberation(block, {
					deliberationType,
					decisionState: ds,
					athlete,
					reviewedLights,
					now
				});
				return;
			}
			if (fopState === 'DECISION_VISIBLE' && ds?.visible === true) {
				const athlete = resolveAthlete(ds?.athleteKey ?? mergedState.currentAthleteKey ?? null, mergedState.fullName);
				enterDecision(block, { decisionState: ds, params: mergedState, athlete, now });
				return;
			}
			if (uiEvent === 'SwitchGroup') {
				toReady(block);
			}
			return;
		}

		if (uiEvent === 'StartLifting') {
			// Parity with Results.afterSlaveStartLifting -> onStartLifting(true):
			// keep a shown jury verdict until its 20 s hold expires; otherwise return to READY.
			if (block.state === 'deliberation' && block.verdict !== null) {
				return;
			}
			if (block.state !== 'ready') {
				toReady(block);
			}
			return;
		}

		if (uiEvent === 'GroupDone' || mode === 'SESSION_DONE'
			|| (uiEvent === 'BreakStarted' && LIFTS_DONE_BREAK_TYPES.has(breakType))) {
			handleLiftsDone(block);
			return;
		}

		if (uiEvent === 'BreakStarted') {
			if (JURY_BREAK_TYPES.has(breakType)) {
				const deliberationType = breakType === 'CHALLENGE' ? 'CHALLENGE' : 'START_DELIBERATION';
				if (block.state !== 'deliberation') {
					const athlete = resolveAthlete(ds?.athleteKey ?? null, null) || block.reviewedAthlete;
					const reviewedLights = refLightsFromBooleans(ds?.originalRefereeDecisions) || block.refLights;
					enterDeliberation(block, {
						deliberationType,
						decisionState: ds,
						athlete,
						reviewedLights,
						now
					});
				} else if (block.verdict === null) {
					const nextLabel = resolveReviewLabelKey(ds, block.deliberationType || deliberationType);
					if (nextLabel && nextLabel !== block.reviewLabelKey) {
						block.reviewLabelKey = nextLabel;
						block.sequence += 1;
					}
				}
				return;
			}
			toReady(block);
			return;
		}

		if (uiEvent === 'CeremonyStarted') {
			toReady(block);
		}
		// LiftingOrderUpdated and other updates preserve the current hold.
	}
}
