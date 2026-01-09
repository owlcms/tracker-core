/**
 * Format attempt string using MessageFormat-style translations
 * 
 * Processes patterns like: "{0}<sup>{0,choice,1#st|2#nd|3#rd}</sup> att."
 * 
 * @param {number} attemptNumber - 1, 2, or 3
 * @param {string} liftType - "SNATCH" or "CLEANJERK"
 * @param {Object} translations - Translation object
 * @returns {string} Formatted attempt string with HTML
 */
export function formatAttemptString(attemptNumber, liftType, translations) {
    if (!attemptNumber || !liftType || !translations) return '';
    
    // Get the pattern from translations (e.g., "{0}<sup>{0,choice,1#st|2#nd|3#rd}</sup> att.")
    const pattern = translations['AttemptBoard_attempt_number'] || '{0}<sup>{0,choice,1#st|2#nd|3#rd}</sup> att.';
    
    // Get lift type translation
    const liftKey = liftType === 'SNATCH' ? 'Snatch' : 'Clean_and_Jerk';
    const liftName = translations[liftKey] || (liftType === 'SNATCH' ? 'Snatch' : 'Clean & Jerk');
    
    // Process the pattern
    let result = pattern;
    
    // Replace {0} with attempt number (not inside choice)
    result = result.replace(/\{0\}(?![^{]*choice)/g, attemptNumber);
    
    // Process choice format: {0,choice,1#st|2#nd|3#rd}
    result = result.replace(/\{0,choice,([^}]+)\}/g, (match, choices) => {
        const choiceMap = {};
        choices.split('|').forEach(choice => {
            const [num, text] = choice.split('#');
            choiceMap[num] = text;
        });
        return choiceMap[attemptNumber] || '';
    });
    
    // Append lift type
    return `${result} ${liftName}`;
}
