Release Notes

## Version 1.16
- 1.16.4: Correctly derive case-sensitive asset URLs.  Perform case-insensitive match but return the correct case.
- 1.16.3: setting "fresh: true" on sendPreconditionRequest() to request an updated zip
- 1.16.2: Break and athlete timers now carry an absolute `endTimeMillis` anchor so a reload mid-timer shows the true remaining time instead of the cache-frozen snapshot (notably for indefinite/before-introduction breaks)
- 1.16.1: Reject second connection
  - if misconfigured developer instance, it will get ignored
  - reduced websocket ping-pong delays to close connection within 15s if proxy drops OWLCMS but keeps tracker
- 1.16.0: Redid the resource request loop to handle retries
- 1.16.0: Fixes for timer message handling and deduplication

## Version 1.5
- 1.15.15: record attempt vs new
- 1.15.14: break timers
- 1.15.13: manage ceremonies states more completely to better feed scoreboardss
- 1.15.12: reduce spurious logs for scoreboard decision tracking
- 1.5.11: correctly track client id when a tab is closed to release SSE
- 1.5.10: live remaining time for a running athlete timer, derived from the start timestamp so a fresh load or reload mid-attempt shows the correct clock
- 1.5.9: systematic checking of the authentication token, esp. in binary frames
- 1.5.8: logging cleanup
- 1.5.7: processing of immediate decisions re: hiding the down signal
- 1.5.5: defensive check when recursing directories
- 1.5.4: additional state in the hub to track jury deliberations and challenges
- 1.5.3: retrieve IOC code-to-Country name forward and reverse maps used for flag name normalization
- 1.5.2: Request document logos again after a WebSocket database refresh
- 1.5.1: Added 2028 Sinclair coefficients and year-aware Sinclair/Masters scoring helpers
- 1.5.1: Allow using 2025 masters age factors
- 1.5.0: Process owlcms values for timer warning delays

## Version 1.4
- 1.4.1: Cleaned up Championship support
- 1.4.0: Added support for explicit Championship entities now present in JSON V2 exports
- 1.4.0: Added `requestDatabaseRefresh()` helper so document generators can request a fresh database snapshot from OWLCMS over the active WebSocket connection

## Version 1.3
1.3.3: Translation routines now report missing keys by returning !key (similar to owlcms)
1.3.2: forcefully clean-up all update fields that owlcms sent as null to prevent stale info
1.3.1: emit protocol_ok and protocol_mismatch events when the protocol version matchco or not.


## Version 1.2
1.2.0: fixed event emission for timer and decision events to enable SSE-only propagation by consumers
1.2.0: made the cache keys respect a canonical order and respect Unicode names for platforms and options.
1.2.0: support substitutions in translation patterns using the Java MessageFormat

## Version 1.1
1.1.0: Added shared record sorting utility functions
1.1.0: Now clear directories prior to extracting zip (flags, logos, pictures)
1.1.0: Wait for requested resources before allowing caller plugin to proceed

## Version 1.0
1.0.0: First Release
1.0.0: fixed processing for logos
1.0.0-rc02: additional exposed functions to reset connections to avoid having to restart server when a database reset is warranted
1.0.0-beta05: Automated scripts for releasing, adjusted to work with owlcms-tracker version locking.