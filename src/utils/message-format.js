/**
 * Simple Java MessageFormat implementation for JavaScript
 * Supports:
 * - {0}, {1}, etc. - Parameter substitution
 * - {0,choice,1#value1|2#value2|3#value3} - Choice format
 */

/**
 * Format a message using MessageFormat patterns
 * @param {string} pattern - The pattern string (e.g., "{0}<sup>{0,choice,1#st|2#nd|3#rd}</sup> att.")
 * @param {...any} args - Arguments to substitute
 * @returns {string} Formatted message
 * 
 * @example
 * formatMessage("{0}<sup>{0,choice,1#st|2#nd|3#rd}</sup> att.", 2)
 * // Returns: "2<sup>nd</sup> att."
 */
export function formatMessage(pattern, ...args) {
    if (!pattern) return '';
    
    return pattern.replace(/\{(\d+)(?:,choice,([^}]+))?\}/g, (match, index, choicePattern) => {
        const argIndex = parseInt(index, 10);
        const value = args[argIndex];
        
        if (value == null) return match; // Leave unsubstituted if no value
        
        // Handle choice format
        if (choicePattern) {
            return processChoice(value, choicePattern);
        }
        
        // Simple substitution
        return String(value);
    });
}

/**
 * Process a choice pattern
 * @param {number} value - The value to match
 * @param {string} choicePattern - Pattern like "1#st|2#nd|3#rd"
 * @returns {string} The matched choice value
 */
function processChoice(value, choicePattern) {
    const numValue = Number(value);
    const choices = choicePattern.split('|');
    
    for (const choice of choices) {
        const [limitStr, result] = choice.split('#', 2);
        const limit = parseFloat(limitStr.trim());
        
        if (numValue === limit) {
            return result || '';
        }
    }
    
    // No match found - return the value as-is
    return String(value);
}
