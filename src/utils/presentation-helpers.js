/**
 * Presentation helpers for scoreboard display
 * 
 * These helpers transform FOP update data into presentation-ready format
 * for break messages, session info, attempt labels, and current athlete extraction.
 * 
 * All functions that need translations accept a `hub` parameter with a translate() method.
 * Example: hub.translate('Snatch', 'en') => 'Snatch'
 */

// =============================================================================
// BREAK MODE DETECTION
// =============================================================================

/**
 * Check if we're in a break mode
 * @param {string} mode - Board mode from fopUpdate
 * @returns {boolean}
 */
export function isBreakMode(mode) {
	return mode === 'INTERRUPTION' || 
	       mode === 'INTRO_COUNTDOWN' || 
	       mode === 'LIFT_COUNTDOWN' || 
	       mode === 'LIFT_COUNTDOWN_CEREMONY' || 
	       mode === 'SESSION_DONE' || 
	       mode === 'CEREMONY';
}

// =============================================================================
// SESSION INFO
// =============================================================================

/**
 * Build sessionInfo string using tracker translations
 * Format: "Session M1 – Snatch" (using en-dash)
 * @param {Object} fopUpdate - FOP update object
 * @param {Object} hub - Competition hub with translate(key, locale) method
 * @param {string} locale - Language locale code
 * @returns {string} - Session info string or empty string if no session
 */
export function buildSessionInfo(fopUpdate, hub, locale = 'en') {
	const hasSessionName = fopUpdate?.sessionName != null && fopUpdate?.sessionName !== '';
	if (!hasSessionName) {
		return '';
	}
	const sessionLabel = hub.translate('Tracker.Session', locale) || hub.translate('Session', locale);
	const liftTypeKey = fopUpdate?.liftTypeKey || 'Snatch';
	const liftTypeLabel = liftTypeKey === 'Snatch' || liftTypeKey === 'SNATCH'
		? hub.translate('Snatch', locale)
		: hub.translate('Clean_and_Jerk', locale);
	return `${sessionLabel} ${fopUpdate.sessionName} – ${liftTypeLabel}`;
}

// =============================================================================
// ATTEMPT LABELS
// =============================================================================

/**
 * Build attempt label using tracker translations
 * Format: "Snatch #2" or "C&J #1" based on liftTypeKey and attemptNumber
 * @param {Object} fopUpdate - FOP update object
 * @param {Object} hub - Competition hub with translate(key, locale) method
 * @param {string} locale - Language locale code
 * @returns {string} - Attempt label or empty string
 */
export function buildAttemptLabel(fopUpdate, hub, locale = 'en') {
	const liftTypeKey = fopUpdate?.liftTypeKey || '';
	const attemptNumber = fopUpdate?.attemptNumber || '';
	if (!liftTypeKey || !attemptNumber) {
		return '';
	}
	let template;
	if (liftTypeKey === 'Snatch' || liftTypeKey === 'SNATCH') {
		template = hub.translate('Snatch_number', locale);
	} else {
		template = hub.translate('C_and_J_number', locale);
	}
	return template.replace('{0}', attemptNumber);
}

// =============================================================================
// GROUP/SESSION NAME FOR BREAKS
// =============================================================================

/**
 * Infer the group/session name for break display
 * Mirrors OWLCMS BreakDisplay.inferGroupName()
 * @param {Object} fopUpdate - FOP update object
 * @param {Object} hub - Competition hub with translate(key, locale) method
 * @param {string} locale - Language locale code
 * @returns {string}
 */
export function inferGroupName(fopUpdate, hub, locale = 'en') {
	const sessionName = fopUpdate?.sessionName || fopUpdate?.groupName || '';
	if (!sessionName) {
		return '';
	}
	// Use translation key "Group_number" with session name (translate handles !Key fallback)
	const template = hub.translate('Group_number', locale);
	return template.replace('{0}', sessionName);
}

// =============================================================================
// BREAK MESSAGES
// =============================================================================

/**
 * Infer the break message for break display
 * Mirrors OWLCMS BreakDisplay.inferMessage()
 * @param {string} breakType - Break type from fopUpdate
 * @param {string} ceremonyType - Ceremony type if applicable
 * @param {Object} hub - Competition hub with translate(key, locale) method
 * @param {string} locale - Language locale code
 * @returns {string}
 */
export function inferBreakMessage(breakType, ceremonyType, hub, locale = 'en') {
	// Match OWLCMS BreakDisplay.java::inferMessage logic:
	// 1. If both null -> "Competition Paused"
	// 2. If ceremonyType != null (and breakType == CEREMONY) -> ceremony message  
	// 3. Otherwise use breakType
	
	if (!breakType && !ceremonyType) {
		return hub.translate('PublicMsg.CompetitionPaused', locale);
	}
	
	// Handle ceremony during a break (breakType == "CEREMONY" means we're in a ceremony)
	// Only use ceremonyType when breakType indicates a ceremony is active
	if (breakType === 'CEREMONY' && ceremonyType) {
		switch (ceremonyType) {
			case 'INTRODUCTION':
				return hub.translate('BreakMgmt.IntroductionOfAthletes', locale);
			case 'MEDALS':
				return hub.translate('PublicMsg.Medals', locale);
			case 'OFFICIALS_INTRODUCTION':
				return hub.translate('BreakMgmt.IntroductionOfOfficials', locale);
		}
	}
	
	// Handle regular break types
	if (breakType) {
		switch (breakType) {
			case 'FIRST_CJ':
				return hub.translate('BreakType.FIRST_CJ', locale);
			case 'FIRST_SNATCH':
				return hub.translate('BreakType.FIRST_SNATCH', locale);
			case 'BEFORE_INTRODUCTION':
				return hub.translate('BreakType.BEFORE_INTRODUCTION', locale);
			case 'TECHNICAL':
				return hub.translate('PublicMsg.CompetitionPaused', locale);
			case 'JURY':
				return hub.translate('PublicMsg.JuryDeliberation', locale);
			case 'CHALLENGE':
				return hub.translate('PublicMsg.CHALLENGE', locale);
			case 'GROUP_DONE':
				return hub.translate('PublicMsg.GroupDone', locale);
			case 'MARSHAL':
				return hub.translate('PublicMsg.CompetitionPaused', locale);
			case 'CEREMONY':
				// breakType is CEREMONY but no ceremonyType - fall through to default
				break;
			default:
				return `!BreakType.${breakType}`;
		}
	}
	
	// Fallback
	return hub.translate('PublicMsg.CompetitionPaused', locale);
}

// =============================================================================
// CURRENT ATTEMPT EXTRACTION
// =============================================================================

/**
 * Extract current attempt info from FOP update for display
 * Returns null if no current athlete, or break info if in break mode
 * 
 * @param {Object} fopUpdate - FOP update object
 * @param {Object} hub - Competition hub with translate(key, locale) method
 * @param {Function} getFlagUrl - Function to get flag URL: (teamName, urlMode) => string|null
 * @param {string} locale - Language locale code
 * @returns {Object|null} - Current attempt info or null if no current athlete
 */
export function extractCurrentAttempt(fopUpdate, hub, getFlagUrl, locale = 'en') {
	// Check if we're in break mode - show break info instead of athlete
	const mode = fopUpdate?.mode || 'WAIT';
	const breakType = fopUpdate?.breakType || null;
	const ceremonyType = fopUpdate?.ceremonyType || null;
	
	if (isBreakMode(mode)) {
		// During break: show break message as name, clear team, show session info
		const breakMessage = inferBreakMessage(breakType, ceremonyType, hub, locale);
		const groupInfo = inferGroupName(fopUpdate, hub, locale);
		
		return {
			fullName: breakMessage,
			name: breakMessage,
			teamName: null,  // Clear team during break
			team: null,
			flagUrl: null,
			startNumber: null,
			categoryName: groupInfo,  // Show session/group in category slot
			category: groupInfo,
			attempt: '',
			attemptNumber: null,
			weight: null,
			timeAllowed: fopUpdate?.timeAllowed,
			startTime: null,
			isBreak: true  // Flag for components to know this is break info
		};
	}
	
	// Check if there's a current athlete using currentAthleteKey
	if (!fopUpdate?.currentAthleteKey || !fopUpdate?.fullName) {
		return null;
	}
	
	// Clean HTML entities in fullName
	const cleanFullName = (fopUpdate.fullName || '').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
	
	// Format attempt label using shared helper
	const attemptLabel = buildAttemptLabel(fopUpdate, hub, locale);

	return {
		fullName: cleanFullName,
		name: cleanFullName,
		teamName: fopUpdate.teamName || null,
		team: fopUpdate.teamName || null,
		flagUrl: getFlagUrl ? getFlagUrl(fopUpdate.teamName, true) : null,
		startNumber: fopUpdate.startNumber,
		categoryName: fopUpdate.categoryName,
		category: fopUpdate.categoryName,
		attempt: attemptLabel,
		attemptNumber: fopUpdate.attemptNumber,
		weight: fopUpdate.weight || '-',
		timeAllowed: fopUpdate.timeAllowed,
		startTime: null,
		isBreak: false
	};
}
