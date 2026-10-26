Release Notes

## Version 2.0
- 2.0.0-beta01: **Requires OWLCMS 69.** The protocol version is 69.0.0 and the minimum accepted version is now 69.0.0.
- 2.0.0-beta01: Pages opened before the translations arrived kept showing untranslated keys (`!Group_number`, `!BreakType...`) after the translations loaded: the scoreboard API and plugin caches were not invalidated. Loading translations now invalidates them.
- 2.0.0-beta01: Running break countdowns keep a stable end time across ceremony and keepalive updates. Those updates carry live remaining time, so subtracting elapsed time from it again made countdowns reach zero early. Indefinite breaks no longer expose a countdown.
- 2.0.0-beta01: Aligned with the WebSocket protocol sent by OWLCMS 69, documented in `docs/WEBSOCKET_MESSAGE_SPEC.md`.
- 2.0.0-beta01: Database athletes had `yearOfBirth: "2"` because the birth year was read from the old `[year, month, day]` array format; OWLCMS sends ISO dates (`"2007-01-01"`). Both formats are now accepted.
- 2.0.0-beta01: Replies to OWLCMS messages that ask for missing data now send `refresh: false`. Without it, OWLCMS treated every missing-database reply as a refresh request and rebuilt all its translation, flag, logo, picture and GAMX archives.
- 2.0.0-beta01: New `competitionHub.refreshResources()` and `competitionHub.requestFullRefresh()` ask OWLCMS for fresh copies (`refresh: true`) and wait for them, without closing the connection. Used by the tracker before producing documents and for a full refresh.
- 2.0.0-beta01: After OWLCMS reconnected, athlete pictures were missing until the tracker was restarted: the pictures directory was purged but pictures were still marked as loaded, so they were never requested again.
- 2.0.0-beta01: `displaySettings.stylesDir` removed; OWLCMS no longer sends `stylesDir` over the WebSocket (OWLCMS uses several display themes, so a single name was meaningless). The unused `styles` local directory is no longer managed.
- 2.0.0-beta01: Translations for regional locales did not fall back to their base language: OWLCMS sends `fr_CA`, but only `fr-CA` was recognized. Both separators now work (`fr-CA` also finds `fr_CA`).
- 2.0.0-beta01: Decision messages from OWLCMS 69 carry `records` as an object, like update messages; the JSON string sent by older OWLCMS versions is still accepted.
- 2.0.0-beta01: Jury votes, review votes and jury decisions from OWLCMS 69: `decisionState` (referee and jury cells as the OWLCMS attempt board shows them, review state) in every decision and update message, and `adjudicationDecision` (decision, reversal, rule, judged attempt, original referee decision, review votes) on jury decisions. Available to plugins through `extractDecisionState()`, also during jury breaks; `extractDecisionDisplayDefaults()` gives the OWLCMS display switches as plugin option defaults.
- 2.0.0-beta01: New decision message types `JURY_UPDATE`, `PANEL_VOTE_CALLED`, `PANEL_VOTE`, `JURY_DISPLAY_RESET` are stored as `juryEventType` and never replace `decisionEventType`, so plugins keyed on the referee decision (Celebrations, OBS) are not affected.
- 2.0.0-beta01: Start latch: the database and the translations that OWLCMS sends when the connection opens are no longer requested again. Messages that arrive before they do are applied and answered with 202 instead of a request, so OWLCMS no longer sends the translations once per message received meanwhile (15 copies of a 1.4 MB archive were seen at startup). Messages arriving within 1 s of a database request are no longer dropped. Resources requested by plugins are not asked for again while a request is outstanding; unanswered requests are retried after 10 s, then with increasing delays.
- 2.0.0-beta01: Learning mode also records each OWLCMS connection, both directions in order, to `recordings/recording-<time>.jsonl` (binary frames summarized as type, size and SHA-256; update key and database secrets removed). `LEARNING_MODE_DIR` moves the samples and recordings.

## Version 1.17
- 1.17.4: Accept the database cache token (`databaseChecksum`) in a new `database_metadata` WebSocket message sent by OWLCMS just before the `database_zip` binary frame. It is retained per connection and attached to the next database ZIP, so duplicate-checksum suppression and plugin cache keys keep working while the ZIP only contains the exported `competition.json`.
- 1.17.3: Athlete participations are reordered so `participations[0]` is always the registration category (session protocols were showing ranks from another participation)
- 1.17.3: V2 competition dates sent as ISO strings (`2026-08-26`) both ISO strings and date arrays are now accepted
- 1.17.3: `formatCategoryDisplay` normalizes open-ended categories to leading-plus notation for both `>110` and `110+` inputs (→ `+110`)
- 1.17.2: Accept a new jury decision field (juryReasonCode) to match OWLCMS 68 (if present)
- 1.17.1: Q-Points were not clamped to the lightest meaningful weight, and yielded 0 for extremely light athletes
- 1.17.0: Some data fields for team championship formats were missing.

## Version 1.16
- 1.16.5: Make detection of new records easier in the merged state
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