/**
 * Lightweight logger facade with pluggable backend.
 * Defaults to console but allows injecting any logger that supports
 * error/warn/info/debug/trace. Also provides level-based log(level,...args).
 */

const baseConsole = {
  error: console.error ? console.error.bind(console) : () => {},
  warn: console.warn ? console.warn.bind(console) : console.error ? console.error.bind(console) : () => {},
  info: console.info ? console.info.bind(console) : console.log ? console.log.bind(console) : () => {},
  debug: console.debug ? console.debug.bind(console) : console.log ? console.log.bind(console) : () => {},
  trace: console.trace ? console.trace.bind(console) : console.log ? console.log.bind(console) : () => {},
  log: console.log ? console.log.bind(console) : () => {}
};

let currentLogger = normalizeLogger(baseConsole);

function normalizeLogger(logger) {
  if (!logger || typeof logger !== 'object') return baseConsole;
  return {
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : baseConsole.error,
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : baseConsole.warn,
    info: typeof logger.info === 'function' ? logger.info.bind(logger) : baseConsole.info,
    debug: typeof logger.debug === 'function' ? logger.debug.bind(logger) : baseConsole.debug,
    trace: typeof logger.trace === 'function' ? logger.trace.bind(logger) : baseConsole.trace
  };
}

export function setLogger(logger) {
  currentLogger = normalizeLogger(logger);
}

export function getLogger() {
  return currentLogger;
}

function getTimestamp() {
  const now = new Date();
  return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

export const logger = {
  error: (...args) => currentLogger.error(`[${getTimestamp()}]`, ...args),
  warn: (...args) => currentLogger.warn(`[${getTimestamp()}]`, ...args),
  info: (...args) => currentLogger.info(`[${getTimestamp()}]`, ...args),
  debug: (...args) => currentLogger.debug(`[${getTimestamp()}]`, ...args),
  trace: (...args) => currentLogger.trace(`[${getTimestamp()}]`, ...args),
  log: (level, ...args) => {
    const lvl = (level || '').toString().toLowerCase();
    const ts = `[${getTimestamp()}]`;
    switch (lvl) {
      case 'error':
        return currentLogger.error(ts, ...args);
      case 'warn':
      case 'warning':
        return currentLogger.warn(ts, ...args);
      case 'debug':
        return currentLogger.debug(ts, ...args);
      case 'trace':
        return currentLogger.trace(ts, ...args);
      case 'info':
      default:
        return currentLogger.info(ts, ...args);
    }
  }
};
