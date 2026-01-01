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

export const logger = {
  error: (...args) => currentLogger.error(...args),
  warn: (...args) => currentLogger.warn(...args),
  info: (...args) => currentLogger.info(...args),
  debug: (...args) => currentLogger.debug(...args),
  trace: (...args) => currentLogger.trace(...args),
  log: (level, ...args) => {
    const lvl = (level || '').toString().toLowerCase();
    switch (lvl) {
      case 'error':
        return currentLogger.error(...args);
      case 'warn':
      case 'warning':
        return currentLogger.warn(...args);
      case 'debug':
        return currentLogger.debug(...args);
      case 'trace':
        return currentLogger.trace(...args);
      case 'info':
      default:
        return currentLogger.info(...args);
    }
  }
};
