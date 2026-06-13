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

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
  trace: 4
};

function normalizeLevelName(level) {
  const normalized = (level || '').toString().trim().toLowerCase();
  if (normalized === 'warning') return 'warn';
  if (normalized === 'log') return 'info';
  return Object.prototype.hasOwnProperty.call(LOG_LEVELS, normalized) ? normalized : null;
}

function resolveInitialLogLevel() {
  const envLevel = typeof process !== 'undefined' ? process.env.LOG_LEVEL : undefined;
  return normalizeLevelName(envLevel) || 'info';
}

let currentLogger = normalizeLogger(baseConsole);
let currentLogLevel = resolveInitialLogLevel();

function normalizeLogger(logger) {
  if (!logger || typeof logger !== 'object') return baseConsole;
  return {
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : baseConsole.error,
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : baseConsole.warn,
    info: typeof logger.info === 'function' ? logger.info.bind(logger) : baseConsole.info,
    debug: typeof logger.debug === 'function' ? logger.debug.bind(logger) : baseConsole.debug,
    trace: typeof logger.trace === 'function' ? logger.trace.bind(logger) : baseConsole.trace,
    log: typeof logger.log === 'function' ? logger.log.bind(logger) : baseConsole.log
  };
}

export function setLogger(logger) {
  currentLogger = normalizeLogger(logger);
}

export function getLogger() {
  return currentLogger;
}

export function setLogLevel(level) {
  currentLogLevel = normalizeLevelName(level) || 'info';
}

export function getLogLevel() {
  return currentLogLevel;
}

function shouldLog(level) {
  const normalizedLevel = normalizeLevelName(level) || 'info';
  return LOG_LEVELS[normalizedLevel] <= LOG_LEVELS[currentLogLevel];
}

function getTimestamp() {
  const now = new Date();
  return now.toTimeString().slice(0, 8) + '.' + String(now.getMilliseconds()).padStart(3, '0');
}

export const logger = {
  error: (...args) => {
    if (shouldLog('error')) currentLogger.error(`[${getTimestamp()}]`, ...args);
  },
  warn: (...args) => {
    if (shouldLog('warn')) currentLogger.warn(`[${getTimestamp()}]`, ...args);
  },
  info: (...args) => {
    if (shouldLog('info')) currentLogger.info(`[${getTimestamp()}]`, ...args);
  },
  debug: (...args) => {
    if (shouldLog('debug')) currentLogger.debug(`[${getTimestamp()}]`, ...args);
  },
  trace: (...args) => {
    if (shouldLog('trace')) currentLogger.trace(`[${getTimestamp()}]`, ...args);
  },
  log: (levelOrMessage, ...args) => {
    const lvl = normalizeLevelName(levelOrMessage);
    const ts = `[${getTimestamp()}]`;
    
    // Check if the first argument is a known log level
    if (lvl) {
      if (!shouldLog(lvl)) return;
      switch (lvl) {
        case 'error':
          return currentLogger.error(ts, ...args);
        case 'warn':
          return currentLogger.warn(ts, ...args);
        case 'debug':
          return currentLogger.debug(ts, ...args);
        case 'trace':
          return currentLogger.trace(ts, ...args);
        case 'info':
          return currentLogger.info(ts, ...args);
      }
    }
    
    // If not a level, treat as a message and log with default level (info/log)
    // We pass levelOrMessage as the first message argument
    if (!shouldLog('info')) return;
    return currentLogger.log(ts, levelOrMessage, ...args);
  }
};
