/**
 * Shared timer and decision state extraction helpers
 * Used by all scoreboards for consistent timer/break/decision handling
 */

function parseOptionalMillis(value) {
	if (value === undefined || value === null || value === '') {
		return null;
	}
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function deriveLegacyAthleteWarningThresholds(duration) {
	if (duration === 120000) {
		return { initialWarningMillis: 90000, finalWarningMillis: 30000 };
	}
	if (duration === 60000) {
		return { initialWarningMillis: -1, finalWarningMillis: 30000 };
	}
	return { initialWarningMillis: null, finalWarningMillis: null };
}

function resolveAthleteDuration(fopUpdate, athleteTimeRemaining, athleteEvent) {
	const explicitDuration = parseOptionalMillis(fopUpdate?.timeAllowed);
	if (explicitDuration !== null) {
		return explicitDuration;
	}

	if ((athleteEvent === 'SetTime' || athleteEvent === 'StartTime') && (athleteTimeRemaining === 120000 || athleteTimeRemaining === 60000)) {
		return athleteTimeRemaining;
	}

	return 60000;
}

function resolveAthleteWarningThresholds(fopUpdate, athleteDuration) {
	let initialWarningMillis = parseOptionalMillis(fopUpdate?.athleteInitialWarningMillis);
	let finalWarningMillis = parseOptionalMillis(fopUpdate?.athleteFinalWarningMillis);

	const legacy = deriveLegacyAthleteWarningThresholds(athleteDuration);
	if (initialWarningMillis === null) {
		initialWarningMillis = legacy.initialWarningMillis;
	}
	if (finalWarningMillis === null) {
		finalWarningMillis = legacy.finalWarningMillis;
	}

	return { initialWarningMillis, finalWarningMillis };
}

// =============================================================================
// TIMER AND DECISION EXTRACTION
// =============================================================================

/**
 * Extract both athlete and break timers from a FOP update.
 * Returns { timer, breakTimer } where each object contains:
 * { type: 'athlete'|'break', state: 'running'|'set'|'stopped', isActive, visible, timeRemaining, duration, startTime, displayText }
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @param {string} language - Language code for break text (e.g., 'nb' for Norwegian Bokmål)
 * @returns {Object} { timer, breakTimer }
 */
export function extractTimers(fopUpdate, language = 'en') {
	const athleteEvent = fopUpdate?.athleteTimerEventType;
	const athleteTimeRemaining = parseInt(fopUpdate?.athleteMillisRemaining || 0);
	const athleteDuration = resolveAthleteDuration(fopUpdate, athleteTimeRemaining, athleteEvent);
	const { initialWarningMillis, finalWarningMillis } = resolveAthleteWarningThresholds(fopUpdate, athleteDuration);

	// Treat explicit timer events as active even if stale fopState says INACTIVE
	const fopState = String(fopUpdate?.fopState || '').toUpperCase();
	const hasTimerSignal = Boolean(athleteEvent || fopUpdate?.breakTimerEventType);
	const isInactive = fopState === 'INACTIVE' && !hasTimerSignal;

	// Athlete timer state - simple mapping
	const athleteState = athleteEvent === 'StartTime' ? 'running' : 
	                     athleteEvent === 'StopTime' ? 'stopped' : 
	                     athleteEvent === 'SetTime' ? 'set' : 
	                     (athleteEvent ? String(athleteEvent).toLowerCase() : 'stopped');

	// For a running timer, compute a live remaining value from the start anchor.
	// athleteMillisRemaining is the snapshot captured at the StartTime event and is
	// not decremented server-side, so a client joining mid-attempt (fresh load or
	// reload after inactivity) would otherwise resume from a stale, too-high value.
	// Subtracting the elapsed time since athleteStartTimeMillis yields the true remaining.
	const athleteStartMillis = parseInt(fopUpdate?.athleteStartTimeMillis || 0);
	let athleteLiveRemaining = athleteTimeRemaining;
	if (athleteState === 'running' && athleteStartMillis > 0 && athleteTimeRemaining > 0) {
		const expectedEnd = athleteStartMillis + athleteTimeRemaining;
		athleteLiveRemaining = Math.max(0, expectedEnd - Date.now());
	}

	const athleteTimer = {
		type: 'athlete',
		state: athleteState,
		isActive: !isInactive && Boolean(athleteEvent || athleteTimeRemaining > 0),
		visible: !isInactive && Boolean(athleteEvent || athleteTimeRemaining > 0),
		timeRemaining: athleteLiveRemaining,
		duration: athleteDuration,
		initialWarningMillis,
		finalWarningMillis,
		startTime: athleteStartMillis || null
	};

	// Break timer state
	const breakEvent = fopUpdate?.breakTimerEventType;
	const breakRemainingReported = parseInt(fopUpdate?.breakMillisRemaining || 0);
	const breakStartMillisReported = parseInt(fopUpdate?.breakStartTimeMillis || fopUpdate?.breakStartTime || 0);
	// Break timer is only shown once the announcer has actually started it (start anchor present).
	// While fopState may already be 'BREAK' (e.g. before_introduction configured but not yet started),
	// we hide the timer until breakStartTimeMillis is set by OWLCMS.
	const breakTimerStarted = breakStartMillisReported > 0;
	const mode = String(fopUpdate?.mode || '').toUpperCase();
	const breakFlag = fopUpdate?.break === true || fopUpdate?.break === 'true';

	const normBreakEvent = (breakEvent || '').toString().toLowerCase();
	const breakPaused = normBreakEvent.includes('pause') || normBreakEvent === 'breakpaused';

	// If athlete timer starts, we exit break state
	const athleteTimerStarting = athleteEvent === 'StartTime' && fopState !== 'BREAK' && !breakFlag;

	// Determine if we're in a break state:
	// - fopState === 'BREAK' means we're in a break
	// - breakTimerEventType with 'start' or 'breakstarted' means break started
	// - If explicitly paused, we're NOT in break state
	// - If athlete timer starts, we're NOT in break state anymore
	// - During SESSION_DONE, we're always in break state (ignore athlete timer)
	const isSessionDone = mode === 'SESSION_DONE';
	// CEREMONY mode: the break timer is paused and no athlete timer should run
	const isCeremony = mode === 'CEREMONY';
	const inBreakState = !breakPaused && !athleteTimerStarting && !isCeremony && (fopState === 'BREAK' || normBreakEvent.includes('start') || normBreakEvent === 'breakstarted' || isSessionDone);

	// Compute remaining milliseconds using reported timing data
	let computedBreakRemaining = 0;
	let breakDisplayText = null;  // Text to display instead of time (e.g., "STOP" / "STOPP")

	// Check if this is an INTERRUPTION mode break
	if (mode === 'INTERRUPTION' && inBreakState) {
		// Compute display text based on language
		breakDisplayText = language === 'no' ? 'STOPP' : 'STOP';
	} else if (inBreakState) {
		// Normal break with countdown
		if (breakRemainingReported > 0 && breakStartMillisReported > 0) {
			// We have current timing: compute remaining based on start + duration
			const expectedEnd = breakStartMillisReported + breakRemainingReported;
			const now = Date.now();
			computedBreakRemaining = Math.max(0, expectedEnd - now);
		} else if (!breakRemainingReported && breakStartMillisReported > 0) {
			// We have persisted start time but no remaining duration reported
			// Estimate: assume 600000ms (10 minutes) duration
			const now = Date.now();
			const elapsed = now - breakStartMillisReported;
			const assumedDuration = 600000;
			computedBreakRemaining = Math.max(0, assumedDuration - elapsed);
		}
		// Otherwise computedBreakRemaining stays 0 (no timing data available)
	}

	const breakTimer = {
		type: 'break',
		state: inBreakState ? 'running' : 'stopped',
		isActive: !isInactive && inBreakState,
		visible: !isInactive && !isSessionDone && inBreakState && (breakTimerStarted || Boolean(breakDisplayText)),
		timeRemaining: computedBreakRemaining,    // 0 if no timing data
		duration: breakRemainingReported || parseInt(fopUpdate?.breakTimeAllowed || fopUpdate?.timeAllowed || 600000),
		startTime: breakStartMillisReported || null,
		displayText: breakDisplayText  // "STOP"/"STOPP" for INTERRUPTION mode, null otherwise
	};

	const athleteTimerDisplayReady = fopUpdate?.athleteTimerDisplayReady !== false;

	// Update athlete timer visibility: hide during break, inactive, SESSION_DONE,
	// ceremony, or while the timer value is only prepared for an athlete not yet shown.
	athleteTimer.visible = !isInactive && !isSessionDone && !isCeremony && !inBreakState && athleteTimerDisplayReady && athleteTimer.isActive;

	return { timer: athleteTimer, breakTimer };
}

/**
 * Compute what should be displayed: decision lights, break timer, athlete timer, or nothing.
 * Returns { displayMode, displayClass, activeTimer } where:
 * - displayMode: 'decision' | 'break' | 'athlete' | 'none'
 * - displayClass: CSS class like 'show-decision', 'show-break', etc.
 * - activeTimer: the timer object that should be displayed (either timer or breakTimer)
 * 
 * @param {Object} timer - Athlete timer from extractTimers()
 * @param {Object} breakTimer - Break timer from extractTimers()
 * @param {Object} decision - Decision state from extractDecisionState()
 * @returns {Object} { displayMode, displayClass, activeTimer }
 */
export function computeDisplayMode(timer, breakTimer, decision) {
	const decisionPresent = Boolean(decision?.visible);
	const decisionSignalPresent = decisionPresent || Boolean(decision?.type) || Boolean(decision?.down);
	
	// Priority: decision > break timer > athlete timer > nothing
	let displayMode = decisionPresent ? 'decision' : 
	                  (breakTimer?.visible ? 'break' : 
	                  (timer?.visible && !decisionSignalPresent ? 'athlete' : 'none'));
	
	// Defensive rule: if break timer is actively running and visible, and there's no visible
	// decision, prefer the break display even if other flags are inconsistent.
	// Requires breakTimer.visible so that a break that is in-state but not yet started
	// (announcer hasn't pressed start) does not prematurely switch to 'break' mode.
	if (!decisionPresent && breakTimer && breakTimer.state === 'running' && breakTimer.visible) {
		displayMode = 'break';
		// Ensure visibility flags align with forced display mode
		try {
			if (timer) timer.visible = false;
		} catch (e) {
			// ignore immaterial errors modifying timer objects
		}
	}
	
	const displayClass = `show-${displayMode}`;
	const activeTimer = displayMode === 'break' ? breakTimer : timer;
	
	return { displayMode, displayClass, activeTimer };
}

/**
 * Extract decision state from FOP update
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @returns {Object} Decision state with visible, type, referee decisions, etc.
 */
export function extractDecisionState(fopUpdate) {
	const eventType = fopUpdate?.athleteTimerEventType;
	const mode = String(fopUpdate?.mode || '').toUpperCase();
	const fopState = String(fopUpdate?.fopState || '').toUpperCase();
	const isSessionDone = mode === 'SESSION_DONE';
	const isBreakState = fopState === 'BREAK' || mode.startsWith('LIFT_COUNTDOWN') || fopUpdate?.break === true || fopUpdate?.break === 'true';
	
	if (eventType === 'StartTime' || isSessionDone || isBreakState) {
		return {
			visible: false, type: null, isSingleReferee: false,
			ref1: null, ref2: null, ref3: null, down: false
		};
	}

	// OWLCMS sends an intermediate INITIAL_DECISION (down=false, decisionsVisible=false)
	// between the down signal and the FULL_DECISION. During this phase the referees have
	// decided but the lights are intentionally not revealed yet (delayed reveal). The down
	// signal must keep showing until the full decision, otherwise the athlete clock pops
	// back in between.
	// decisionEventType is normalized to canonical UPPER_SNAKE in the hub
	// (_sanitizeInboundPayload), so OWLCMS's camelCase 'initialDecision' arrives here as
	// 'INITIAL_DECISION'.
	const isInitialDecision = fopUpdate?.decisionEventType === 'INITIAL_DECISION';

	const isVisible = fopUpdate?.decisionsVisible === 'true' ||
					  fopUpdate?.decisionEventType === 'FULL_DECISION' ||
					  fopUpdate?.down === 'true' ||
					  isInitialDecision;
	const isSingleReferee = fopUpdate?.singleReferee === 'true' || fopUpdate?.singleReferee === true;

	const mapDecision = (value) => {
		if (value === 'true') return 'good';
		if (value === 'false') return 'bad';
		return null;
	};

	// Keep the lights masked (show the down signal) for a bare down signal and for the
	// INITIAL_DECISION in-progress phase; only the FULL_DECISION reveals the ref lights.
	const isDownOnly = (fopUpdate?.down === 'true' || isInitialDecision)
					  && fopUpdate?.decisionEventType !== 'FULL_DECISION';

	return {
		visible: Boolean(isVisible),
		type: fopUpdate?.decisionEventType || null,
		isSingleReferee,
		ref1: isDownOnly ? null : mapDecision(fopUpdate?.d1),
		ref2: isDownOnly ? null : mapDecision(fopUpdate?.d2),
		ref3: isDownOnly ? null : mapDecision(fopUpdate?.d3),
		down: fopUpdate?.down === 'true' || isInitialDecision
	};
}

/**
 * Convenience function to extract all timer/decision state at once
 * 
 * @param {Object} fopUpdate - The FOP update object from competition hub
 * @param {string} language - Language code for break text
 * @returns {Object} { timer, breakTimer, decision, displayMode, activeTimer }
 */
export function extractTimerAndDecisionState(fopUpdate, language = 'en') {
	const { timer, breakTimer } = extractTimers(fopUpdate, language);
	const decision = extractDecisionState(fopUpdate);
	const { displayMode, displayClass, activeTimer } = computeDisplayMode(timer, breakTimer, decision);
	
	return {
		timer,
		breakTimer,
		decision,
		displayMode,
		displayClass,
		activeTimer
	};
}
