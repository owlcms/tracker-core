# OWLCMS WebSocket Event Forwarding - Message Format Specification

## Overview

OWLCMS pushes competition events to a remote receiver (owlcms-tracker / tracker-core) over a single WebSocket connection. This document describes what **OWLCMS 69** actually sends, and how tracker-core answers.

- **Reference sender:** OWLCMS 69 (`WebSocketEventForwarder`, `WebSocketEventSender`, `AthleteExporter`).
- **Protocol version:** `69.0.0`, carried in every text frame and every binary frame. tracker-core requires a version of at least `69.0.0` (any `-suffix` such as `-rc08` is ignored when comparing). OWLCMS 66, 67 and 68 all send `64.0.0` and are refused; **tracker-core 2.0 requires OWLCMS 69**, and OWLCMS 69 requires tracker-core 2.0.
- **Data model:** V2 only. Session athletes are sent as `sessionAthletes` with `athlete` + `displayInfo` entries.

Formats that tracker-core still accepts but that OWLCMS 69 no longer sends are listed in [Appendix A](#appendix-a-legacy-inputs-accepted-by-tracker-core).

## Connection

### Configuration

The WebSocket destination is configured in OWLCMS as a `ws://` or `wss://` URL for public results and/or video data, for example `ws://localhost:8096/ws`. tracker-core listens on `/ws` by default.

### Lifecycle

- OWLCMS opens **one connection per distinct URL** and reuses it for all message types.
- tracker-core accepts **one OWLCMS connection at a time**. A second upgrade request while a connection is open is rejected with HTTP `409 Conflict`.
- On every new connection, tracker-core deletes its local asset directories (`flags`, `logos`, `pictures`, `gamx`, `mappings`) before handling any frame.
- **Reconnection (OWLCMS):** unlimited retries with exponential backoff of 1 s, 2 s, 4 s, 8 s, 16 s, then every 30 s. The backoff counter is reset only after a connection that actually opened is closed for a reason other than authentication failure (close code `1008`).
- **Keepalive:** after each update, OWLCMS re-sends the latest `update` message every 15 seconds until the next update replaces it. Identical messages are otherwise suppressed for 1 second.

### Startup Sequence

Every time the connection opens (including reconnects), OWLCMS sends, in order:

1. `database_metadata` (text) followed by `database_zip` (binary)
2. `translations_zip` (binary)
3. `flags_zip` (binary), only when there are flags to send

`logos_zip`, `pictures_zip` and `gamx_zip` are sent only when the receiver asks for them with a 428 response (see [Requesting Missing Data](#requesting-missing-data-428)). tracker-core requests `logos_zip` once after the first database load on each connection.

OWLCMS also re-sends:

- `database_metadata` + `database_zip` to all receivers when platforms, championships, or the active age groups are edited.
- `translations_zip` to all receivers when translations are reloaded.

## Authentication

When an update key is configured in OWLCMS for the destination, OWLCMS stamps it on **every** frame:

- **Text frames:** `payload.updateKey`.
- **Binary frames:** an optional key trailer after the payload (see [Key Trailer](#key-trailer)).

When `OWLCMS_UPDATEKEY` is set on tracker-core, **every** frame is checked. A text or binary frame with a missing or different key is answered with a `401` response and the connection is closed with code `1008`. When `OWLCMS_UPDATEKEY` is not set, keys are ignored.

## Text Frames

### Envelope

Every text frame is a JSON object:

```json
{
  "version": "69.0.0",
  "type": "update",
  "payload": { "updateKey": "secret123", "...": "..." }
}
```

| Field | Description |
|-------|-------------|
| `version` | Protocol version. Required by tracker-core; a missing or too-old version is answered with `400`. |
| `type` | `update`, `timer`, `decision`, or `database_metadata` |
| `payload` | Message-specific object |

`updateKey` is present in the payload only when a key is configured.

### Value Encoding

- `timer` payloads, and `decision` payloads except the objects `records`, `decisionState` and `adjudicationDecision`, contain **only string values** (`"true"`, `"60000"`, ...). A field whose value would be `null` is omitted.
- `update` payloads mix strings with arrays and objects (`sessionAthletes`, `startOrderKeys`, `liftingOrderKeys`, `leaders`, `records`, `decisionState`). Timer fields merged into an update (see below) may be numbers, booleans, or `null`.

### Common Enumerations

| Field | Values |
|-------|--------|
| `fopState` | `INACTIVE`, `BREAK`, `CURRENT_ATHLETE_DISPLAYED`, `TIME_RUNNING`, `TIME_STOPPED`, `DOWN_SIGNAL_VISIBLE`, `DECISION_VISIBLE` |
| `mode` (board mode) | `WAIT`, `INTRO_COUNTDOWN`, `CEREMONY`, `LIFT_COUNTDOWN`, `CURRENT_ATHLETE`, `INTERRUPTION`, `SESSION_DONE` |
| `breakType` | `BEFORE_INTRODUCTION`, `FIRST_SNATCH`, `SNATCH_DONE`, `FIRST_CJ`, `GROUP_DONE`, `CEREMONY`, `SESSION`, `TECHNICAL`, `MARSHAL`, `JURY`, `CHALLENGE`, `TEST_BUTTONS` |
| `ceremonyType` | `INTRODUCTION`, `OFFICIALS_INTRODUCTION`, `MEDALS` |
| `liftTypeKey` | `Snatch`, `Clean_and_Jerk` (translation keys) |
| `attemptNumber` | `1`..`3` within the current lift |

---

### 1. UPDATE Messages

**Type:** `"update"`

**Purpose:** Competition state: current athlete, session athletes, lifting order, breaks, ceremonies, leaders, records, and display options.

**Sent on these `uiEvent` values:** `LiftingOrderUpdated`, `SwitchGroup`, `GroupDone`, `StartLifting`, `BreakStarted`, `BreakDone`, `CeremonyStarted`, `CeremonyDone`, `GlobalRankingUpdated`. `InitialSync` is used when there is no triggering event. Repeated every 15 seconds as a keepalive.

#### Payload Fields

**Event and competition**

| Field | Description |
|-------|-------------|
| `uiEvent` | Event class name that triggered the update |
| `updateKey` | Authentication key (when configured) |
| `competitionName` | Competition name |
| `fop` | Field of play (platform) name |
| `fopState` | Field of play state |
| `mode` | Board mode |
| `hidden` | `"true"` when there is nothing to show (no session, inactive platform) |

**Break and ceremony**

| Field | Description |
|-------|-------------|
| `break` | `"true"` / `"false"` |
| `breakType` | Present only when `fopState` is `BREAK` |
| `breakIsIndefinite` | `"true"` / `"false"` |
| `ceremonyEventType` | `ceremonyStarted` or `ceremonyDone`, when a ceremony has occurred |
| `ceremonyType` | Ceremony type, when applicable |
| `ceremonySession` | Session name for the ceremony |
| `ceremonyCategory` | Category display name for the ceremony |
| `ceremonyAgeGroup` | Age group name for the ceremony |
| `ceremonyChampionship` | Championship name for the ceremony |

**Current athlete and attempt**

| Field | Description |
|-------|-------------|
| `fullName` | Current athlete full name. During breaks, a break/session message; on `GroupDone`, the session results text |
| `teamName` | Current athlete team (empty during breaks) |
| `startNumber` | Start number |
| `categoryName` | Category display name of the current athlete |
| `attempt` | Formatted attempt label (empty during breaks) |
| `attemptNumber` | `1`..`3` |
| `weight` | Requested weight |
| `timeAllowed` | Time allowed for the current attempt, in milliseconds |
| `liftTypeKey` | `Snatch` or `Clean_and_Jerk` |

**Session**

| Field | Description |
|-------|-------------|
| `sessionName` | Current session name (empty when the session is done) |
| `sessionDescription` | Session description |
| `sessionInfo` | Formatted session and lift type line |
| `liftsDone` | Formatted count of lifts done (empty when the session is done) |

**Display options** (all `"true"` / `"false"` unless noted)

| Field | Description |
|-------|-------------|
| `showLiftRanks` | Show snatch / clean&jerk ranks |
| `showTotalRank` | Show total rank |
| `showMedalScore` | Show the medal score column |
| `medalScoringName` | Title of the medal score column (string) |
| `scoringName` | Title of the best-score column (string) |
| `showSinclair` | Show the best-score column |
| `showSinclairRank` | Show the best-score rank column |
| `showBodyWeight` | Show body weight |
| `wideTeamNames` | Use wide team name layout |
| `sinclairMeet` | At least one shown championship awards medals by score |

**Athletes and ordering**

| Field | Description |
|-------|-------------|
| `sessionAthletes` | Session athletes in start order (see below). Absent when the session has no athletes |
| `startOrderKeys` | Athlete keys in start order, with a spacer before each new category |
| `liftingOrderKeys` | Athlete keys in lifting order, with a spacer at the start and before the first clean&jerk athlete |
| `currentAthleteKey` | Key of the athlete at the top of the lifting order |
| `nextAthleteKey` | Key of the second athlete in the lifting order |
| `previousAthleteKey` | Key of the athlete before the current one in start order, when that athlete has lifted |
| `leaders` | Present only when there are 1 to 16 leaders: entries shaped like `sessionAthletes`, with a spacer before each new category |

Athlete keys are integers. Spacer entries are `{"isSpacer": true}`.

**Records**

| Field | Description |
|-------|-------------|
| `records` | [Records table](#records-table) for the current athlete (JSON object). Absent when there is no current athlete or no record to show |
| `recordKind` | `new` (a record was just set), `attempt` (the requested weight would break a record), or `none` |
| `recordMessage` | Translated record message when `recordKind` is `new` or `attempt` |

**Decision display**

| Field | Description |
|-------|-------------|
| `decisionState` | [Decision state](#decision-state-decisionstate) object, the same as in decision messages |
| `juryDecisionsOnAttemptBoard` | `"true"` / `"false"`: OWLCMS switch, default of the tracker attempt board "show jury votes" option |
| `juryDecisionsOnScoreboard` | `"true"` / `"false"`: OWLCMS switch, default of the tracker scoreboard "show jury votes" option |
| `decisionSectionOnWarmupScoreboard` | `"true"` / `"false"`: OWLCMS switch, default of the decision section on warm-up scoreboards |
| `decisionSectionStopwatch` | `"true"` / `"false"`: OWLCMS switch, default of the review stopwatch in the scoreboard decision section |
| `decisionSectionShowAgeGroups` | `"true"` / `"false"`: OWLCMS switch, default of the age groups next to the athlete in the decision section |

These switches only provide defaults: OWLCMS always sends the full decision information, and each tracker plugin decides what to show.

#### Records Table

`records` describes the records box shown under the current athlete on OWLCMS scoreboards: one row per record name (federation), and one column per record category, plus a personal-best column.

```json
{
  "recordNames": ["IWF", "Pan Am"],
  "recordCategories": ["SR 89", "JR 89"],
  "recordTable": [
    {
      "cat": "SR 89",
      "recordClass": "recordBox",
      "records": [
        {"SNATCH": 175.0, "CLEANJERK": 216.0, "TOTAL": 387.0, "snatchHighlight": "highlight"},
        {"SNATCH": 168.0, "CLEANJERK": "\u00a0", "TOTAL": 375.0}
      ]
    },
    {
      "cat": "JR 89",
      "recordClass": "recordBox",
      "records": [
        {"SNATCH": 166.0, "CLEANJERK": 200.0, "TOTAL": 362.0},
        {"SNATCH": "\u00a0", "CLEANJERK": "\u00a0", "TOTAL": "\u00a0"}
      ]
    },
    {
      "cat": "Personal Best",
      "recordClass": "recordBoxPersonal",
      "records": [
        {"SNATCH": "150", "CLEANJERK": "185", "TOTAL": "333"}
      ]
    }
  ],
  "nbRecords": 4
}
```

| Field | Description |
|-------|-------------|
| `recordNames` | Row titles: record names, in the configured record order |
| `recordCategories` | Column titles: translated `Record.CategoryTitle` (age group and body weight category) |
| `recordTable` | Columns, left to right in ascending age group order. The last column is the personal-best column when the athlete has a personal best |
| `recordTable[].cat` | Column title (`Record.PersonalBest` translation for the personal-best column) |
| `recordTable[].recordClass` | `recordBox`, or `recordBoxPersonal` for the personal-best column |
| `recordTable[].records` | One cell per row of `recordNames` (a single cell for the personal-best column) |
| cell `SNATCH`, `CLEANJERK`, `TOTAL` | Record value as a number, or `"\u00a0"` when there is no record. Personal-best values are strings |
| cell `snatchHighlight`, `cjHighlight`, `totalHighlight` | `"highlight"` when the current request would break that record |
| `nbRecords` | Number of record columns + 1 (+ 1 more when there is a personal-best column) |

**Merged timer fields**

The latest `timer` payload is merged into every update, so updates also contain fields such as `fopName`, `serverLocalTime`, `athleteTimerEventType`, `athleteMillisRemaining`, `athleteStartTimeMillis`, `athleteInitialWarningMillis`, `athleteFinalWarningMillis`, `breakTimerEventType`, `breakMillisRemaining`, `breakStartTimeMillis`, and `indefiniteBreak`. Remaining times are recomputed when the update is built. Update fields with the same name take precedence.

For a running break, an update's `breakMillisRemaining` is **live remaining time**, while
`breakStartTimeMillis` can still be the original start timestamp. Do not subtract elapsed time from that remaining
value again. tracker-core preserves the deadline established by the `BreakStarted` timer frame across ceremony and
keepalive updates; when joining mid-break with only an update snapshot, it derives the deadline from receipt time
plus the live remaining value.

#### Session Done (`uiEvent: "GroupDone"`)

- `fopState` is `BREAK`, `breakType` is `GROUP_DONE`, `mode` is `SESSION_DONE`.
- `sessionName` is empty and `fullName` contains the session results text.
- **tracker-core behavior:** the session is considered done for that platform, and returns to "in progress" on the next timer event, decision event, or update with another `uiEvent`. tracker-core logs `🔄 Session reopened for FOP X`.

#### Session Athletes

Each `sessionAthletes` entry contains:

| Field | Description |
|-------|-------------|
| `athleteKey` | Athlete key as a string (same value as `athlete.key`) |
| `athlete` | Raw athlete DTO, same fields as a database athlete (see [Athlete Object](#athlete-object)) |
| `displayInfo` | Precomputed display values, identical to the OWLCMS internal scoreboards |

```json
{
  "athleteKey": "-2005683348",
  "athlete": {
    "key": -2005683348,
    "firstName": "John",
    "lastName": "Doe",
    "fullBirthDate": "1995-03-15",
    "isoBirthDate": "1995-03-15",
    "gender": "M",
    "categoryCode": "SR_M89",
    "team": 456,
    "sessionName": "A",
    "startNumber": 5,
    "lotNumber": 12,
    "snatch1Declaration": 100,
    "snatch1ActualLift": -100,
    "snatch2Declaration": 100,
    "snatch2ActualLift": 100,
    "...": "..."
  },
  "displayInfo": {
    "fullName": "DOE, John",
    "teamName": "USA Weightlifting",
    "yearOfBirth": "1995",
    "gender": "M",
    "startNumber": "5",
    "lotNumber": "12",
    "category": "M89 Senior",
    "sattempts": [
      {"value": 100, "status": "bad"},
      {"value": 100, "status": "good"},
      {"value": 103, "status": "request"}
    ],
    "cattempts": [
      {"value": 120, "status": "request"},
      {"value": null, "status": "empty"},
      {"value": null, "status": "empty"}
    ],
    "bestSnatch": "100",
    "bestCleanJerk": "-",
    "total": "-",
    "snatchRank": "2",
    "cleanJerkRank": "-",
    "totalRank": "-",
    "medalRank": "-",
    "medalScore": "",
    "medalHighlight": "",
    "sinclair": "-",
    "sinclairRank": "-",
    "group": "A",
    "subCategory": "",
    "classname": "",
    "bodyWeight": "88.40",
    "custom1": "",
    "custom2": "",
    "membership": "123456",
    "teamLength": 17,
    "flagURL": "/local/flags/USA Weightlifting.svg",
    "flagClass": "longTeam"
  }
}
```

**displayInfo fields** (all strings unless noted):

| Field | Description |
|-------|-------------|
| `fullName` | Formatted with the `FullNameFormat` translation (by default `LASTNAME, Firstname`) |
| `teamName` | Team name |
| `yearOfBirth` | Year of birth |
| `gender` | `M` or `F` |
| `startNumber` | Start number |
| `lotNumber` | Lot number |
| `category` | Category name with age group, e.g. `M89 Senior` |
| `sattempts` | Array of 3 snatch attempt objects (see below) |
| `cattempts` | Array of 3 clean&jerk attempt objects (see below) |
| `bestSnatch` | Best snatch, or `-` |
| `bestCleanJerk` | Best clean&jerk, or `-` |
| `total` | Total, or `-` |
| `snatchRank` | Snatch rank, or `-` |
| `cleanJerkRank` | Clean&jerk rank, or `-` |
| `totalRank` | Total rank, or `-` |
| `medalRank` | Medal rank |
| `medalScore` | Medal score (empty when medals are not awarded by score) |
| `medalHighlight` | Medal highlight CSS class (empty on session scoreboards) |
| `sinclair` | Best score (Sinclair or the configured best-lifter system) |
| `sinclairRank` | Best-score rank |
| `group` | Session name (absent when the athlete has no session) |
| `subCategory` | Subcategory (may be `null`) |
| `classname` | `current blink` (top of lifting order), `next` (second), or empty. Empty for athletes who have completed 6 attempts |
| `bodyWeight` | Formatted body weight |
| `custom1`, `custom2` | Custom fields |
| `membership` | Membership number |
| `teamLength` | Number: length of the team name (`0` when no team) |
| `flagURL` | `/local/flags/<file>` when a flag exists, otherwise empty |
| `flagClass` | `shortTeam` or `longTeam` (empty when no team) |

**Attempt objects** (`sattempts`, `cattempts`):

| `status` | `value` | Meaning |
|----------|---------|---------|
| `good` | weight | Successful lift |
| `bad` | weight (positive) | Failed lift |
| `current` | requested weight | Next attempt of the current athlete, in the current lift |
| `next` | requested weight | Next attempt of the next athlete, in the current lift |
| `request` | requested weight | Next pending attempt of any other athlete |
| `empty` | `null` or `"\u00A0"` | No data, or a later pending attempt |

Only the first pending attempt of each lift carries `current`, `next`, or `request`. `current` and `next` are used only in the lift currently being contested.

---

### 2. TIMER Messages

**Type:** `"timer"`

**Purpose:** Athlete clock and break clock events.

**Common fields:**

| Field | Description |
|-------|-------------|
| `updateKey` | Authentication key (when configured) |
| `fopName` | Field of play name (note: `fopName`, not `fop`) |
| `fopState` | Field of play state |
| `mode` | Board mode |
| `fullName` | Current athlete full name |
| `attemptNumber` | `1`..`3` |
| `liftTypeKey` | `Snatch` or `Clean_and_Jerk` |
| `serverLocalTime` | OWLCMS server local time, ISO format (e.g. `14:23:45.123456`) |

#### Athlete Clock Events

`athleteTimerEventType` is `StartTime`, `StopTime`, or `SetTime`.

| Field | Description |
|-------|-------------|
| `athleteTimerEventType` | `StartTime`, `StopTime`, or `SetTime` |
| `athleteMillisRemaining` | Milliseconds remaining |
| `athleteStartTimeMillis` | Epoch milliseconds when the event was sent (`StartTime` and `StopTime` only) |
| `timeAllowed` | Total time allowed for the attempt (usually `60000` or `120000`) |
| `athleteInitialWarningMillis` | Initial-warning threshold, or `-1` when disabled |
| `athleteFinalWarningMillis` | Final-warning threshold, or `-1` when disabled |

Warning thresholds:

- 2:00 clock: `timeAllowed=120000`, `athleteInitialWarningMillis=90000`, `athleteFinalWarningMillis=30000`
- 1:00 clock: `timeAllowed=60000`, `athleteInitialWarningMillis=-1`, `athleteFinalWarningMillis=30000`

#### Break Clock Events

`breakTimerEventType` is `BreakStarted`, `BreakSetTime`, or `BreakPaused`. No timer message is sent when a break ends; the end of a break is reported by an `update` with `uiEvent: "BreakDone"`.

| Field | Sent with | Description |
|-------|-----------|-------------|
| `breakTimerEventType` | all | `BreakStarted`, `BreakSetTime`, or `BreakPaused` |
| `break` | all | `"true"` / `"false"` |
| `breakType` | all, when `fopState` is `BREAK` | Break type |
| `ceremonyType` | all, when applicable | Ceremony type |
| `indefiniteBreak` | `BreakStarted`, `BreakSetTime` | `"true"` when the break has no end time |
| `breakStartTimeMillis` | `BreakStarted` | Epoch milliseconds when the break started |
| `breakMillisRemaining` | all | Milliseconds remaining (`0` for an indefinite break) |

---

### 3. DECISION Messages

**Type:** `"decision"`

**Purpose:** Referee decisions, down signal, jury deliberation lifecycle, and jury outcomes.

#### Referee Decisions

`decisionEventType` values:

| Value | Meaning | `decisionsVisible` | `down` |
|-------|---------|--------------------|--------|
| `initialDecision` | First referee decisions received, not yet shown (camelCase) | `false` | `false` |
| `FULL_DECISION` | Decision complete, lights shown | `true` | `false` |
| `DOWN_SIGNAL` | Down signal given | `false` | `true` |
| `RESET` | Decisions cleared | `false` | `false` |

| Field | Description |
|-------|-------------|
| `decisionEventType` | See above |
| `updateKey` | Authentication key (when configured) |
| `mode` | Board mode |
| `competitionName` | Competition name |
| `fop` | Field of play name |
| `fopState` | Field of play state |
| `break` | `"true"` / `"false"` |
| `fullName` | Current athlete full name |
| `attemptNumber` | `1`..`3` |
| `liftTypeKey` | `Snatch` or `Clean_and_Jerk` |
| `d1`, `d2`, `d3` | `"true"` (good lift) / `"false"` (no lift); omitted when the referee has not decided |
| `decision` | Overall decision `"true"` / `"false"` (`initialDecision` and `FULL_DECISION`, when known) |
| `singleLight` | `"true"` when a single light is used (`initialDecision` and `FULL_DECISION`) |
| `singleReferee` | Same value as `singleLight` (kept for compatibility) |
| `timingPolicy` | `IMMEDIATE`, when set (`initialDecision` and `FULL_DECISION`) |
| `inputKind` | `ANNOUNCER_ENTRY` or `SOLO_INPUT`, when set (`initialDecision` and `FULL_DECISION`) |
| `decisionsVisible` | `"true"` / `"false"` |
| `down` | `"true"` / `"false"` |
| `records` | [Records table](#records-table) (JSON object), same as in update messages. Absent when there is nothing to show |
| `recordKind` | `new`, `attempt`, or `none` |
| `recordMessage` | Translated record message when `recordKind` is `new` or `attempt` |
| `decisionState` | [Decision state](#decision-state-decisionstate) object |

#### Jury Events

Jury events are also sent as `type: "decision"`. They carry `updateKey`, `mode`, `fop`, `fopState`, and `break`, but **not** `competitionName`, `fullName`, `attemptNumber`, `liftTypeKey`, `d1`..`d3`, `decisionsVisible`, or `down`.

`decisionEventType` values:

| Value | Meaning |
|-------|---------|
| `START_DELIBERATION` | Jury deliberation started |
| `END_DELIBERATION` | Jury deliberation ended |
| `CHALLENGE` | Challenge started |
| `END_CHALLENGE` | Challenge ended |
| `JURY_DECISION` | Jury outcome on the lift |

All jury events carry `decisionState`. Fields added for `JURY_DECISION`:

| Field | Description |
|-------|-------------|
| `adjudicationDecision` | [Adjudication decision](#adjudication-decision-adjudicationdecision) object |
| `juryDecision` | `GOOD_LIFT` or `BAD_LIFT` |
| `juryReversal` | `"true"` when the jury reversed the referees' result |
| `juryReasonCode` | IWF rejection reason code (`1`..`17`) when `juryDecision` is `BAD_LIFT` and a reason was selected. The text is the `Jury.incorrect.<code>` translation |
| `athleteFull` | Athlete full name |
| `athleteAbbreviated` | Athlete abbreviated name |
| `waitForAnnouncer` | `"true"` when announcer confirmation is still pending |
| `recordKind` | `none`, `new`, or `denied` |
| `actualLift` | Signed lift value (negative for a failed lift), when provided |

Other jury notifications (`LOADING_ERROR`, `CALL_TECHNICAL_CONTROLLER`, `CALL_REFEREES`, `END_CALL_REFEREES`, `TECHNICAL_PAUSE`, `END_TECHNICAL_PAUSE`, `END_JURY_BREAK`, `MARSHALL`) are also forwarded as `decision` messages, but **without** a `decisionEventType` field.

#### Jury Vote and Review Vote Events

Sent as `type: "decision"` with only `updateKey`, `mode`, `fop`, `fopState`, `break`, `decisionEventType` and `decisionState` (no referee decision fields).

| `decisionEventType` | Sent when |
|---|---|
| `JURY_UPDATE` | a juror votes on the lift (review votes are reported by `PANEL_VOTE`) |
| `PANEL_VOTE_CALLED` | the Jury Chair calls for votes |
| `PANEL_VOTE` | a review vote arrives, the last vote reveals all the votes, the vote closes or is abandoned |
| `JURY_DISPLAY_RESET` | Cancel vote result, a decision entered by the Jury Chair, or Resume |

**tracker-core:** these types never replace `decisionEventType` in the platform state, which keeps the last referee decision (`FULL_DECISION` etc.). Their type is stored as `juryEventType`, and the `decision` broadcast carries the message's own type.

#### Decision State (`decisionState`)

In **every `decision` and every `update` message**. The decision cells as the OWLCMS attempt board computes them, with the jury votes **always** included whatever the display switches (OWLCMS 69 runs the attempt board state machine in the forwarder).

```json
"decisionState": {
  "sequence": 1788100000042,
  "athleteKey": -2005683348,
  "visible": true,
  "down": false,
  "singleRef": false,
  "refs": ["white", "white", "red"],
  "jury": ["voted", "empty", "voted", "empty"],
  "review": "deliberation",
  "panelReview": true,
  "reviewVoteOpen": false,
  "reviewStartMillis": 1788100000000,
  "originalRefereeDecisions": [true, true, false]
}
```

| Field | Meaning |
|---|---|
| `sequence` | increases with every change, also across OWLCMS restarts (seeded from the clock); a lower value than the last one received is stale |
| `athleteKey` | athlete the cells describe: the athlete whose lift is decided or reviewed, otherwise the current athlete |
| `visible` | OWLCMS shows the decision area (down arrow, lights or review cells); `false` after a reset |
| `down` | down arrow shown instead of the cells |
| `singleRef` | single-light setup: only `refs[1]` is meaningful |
| `refs` | 3 referee cells: `empty`, `voted` (voted, value hidden), `white`, `red` |
| `jury` | one cell per juror (`[]` with no jury), same vocabulary. Hidden until every juror has voted, then all revealed |
| `review` | `none`, `deliberation` or `challenge` |
| `panelReview` | the review is the automatic seven-person Adjudication Panel Review |
| `reviewVoteOpen` | the Jury Chair has called for votes and the vote is in progress |
| `reviewStartMillis` | during a review only: epoch ms when the deliberation or challenge started |
| `originalRefereeDecisions` | during a review only: the referees' lights on the lift under review (`true` / `false` / `null`) |

A reset, or the `StartLifting` update after an adjudication, clears the cells (`visible: false`, all `empty`).
A plugin that keeps a decision on screen longer (tracker scoreboard) keeps the previous `decisionState` it received.

During a review, the cells show, in order: the votes that led to the review (after an automatic stop or with the seven-person panel); all `empty` when the vote is called (for a jury other than the seven-person panel, the referees' decision stays in `refs`); `voted` as votes arrive; all revealed at the last vote.

#### Adjudication Decision (`adjudicationDecision`)

On **every `JURY_DECISION` message**, including the Speaker-only ones (`waitForAnnouncer: true`, which boards skip).

```json
"adjudicationDecision": {
  "decision": false,
  "reversal": true,
  "ruleCode": 5,
  "athleteKey": -2005683348,
  "liftTypeKey": "Snatch",
  "attemptNumber": 2,
  "originalRefereeDecisions": [true, true, false],
  "refereeVotes": [false, false, true],
  "juryVotes": [false, false, false, true],
  "newRecord": false,
  "recordKind": "none",
  "waitForAnnouncer": false,
  "chairEntered": false,
  "speakerEntered": false
}
```

| Field | Meaning |
|---|---|
| `decision` | `true` = Good Lift, `false` = No Lift |
| `reversal` | the jury reversed the referees (`false` = confirmed); `null` when not known |
| `ruleCode` | IWF rejection rule `1`..`17` for a No Lift when given, else `null`; text is `Jury.incorrect.<code>` |
| `athleteKey`, `liftTypeKey`, `attemptNumber` | the **judged** attempt: `liftTypeKey` `Snatch` / `Clean_and_Jerk`, `attemptNumber` `1`..`3` |
| `originalRefereeDecisions` | the referees' lights on that lift; `[null, null, null]` when the lift was entered by the announcer or a single input |
| `refereeVotes` | the 3 referees' review votes, **seven-person panel only**; `[]` for 3- and 5-member juries and the four-member jury without VPT (the referees do not vote again) |
| `juryVotes` | the jurors' votes (3..5), `true` / `false` / `null`, as entered when the decision was applied (all `null` after a Jury Chair override, which clears the votes) |
| `newRecord` | a record was set |
| `recordKind` | `none`, `new` or `denied` |
| `waitForAnnouncer` | notification meant for the Speaker only |
| `chairEntered` | the Jury Chair's override (seven-person panel only) |
| `speakerEntered` | the decision was entered by the Speaker |

No text and no display duration: the tracker translates `JuryNotification.Reversal` / `Confirmed`, `JuryDialog.GoodLiftLabel` / `BadLiftLabel` and `Jury.incorrect.<code>`, and chooses how long to show the decision (5 s on OWLCMS attempt boards). tracker-core keeps it until the next athlete clock start, with its arrival time (`adjudicationDecisionReceivedAt`).

**Holding the decision for the jury:** with the `juryDecisionsOnAttemptBoard` switch on, OWLCMS keeps the referee decision visible (`visible: true`) until every juror has voted; a stuck jury is released by starting the clock with the override. With the switch off, the decision clears after 3.5 s but the next clock waits for the jury.

---

### 4. DATABASE_METADATA Messages

**Type:** `"database_metadata"`

**Purpose:** Announces the checksum of the database ZIP that immediately follows as a binary `database_zip` frame.

```json
{
  "version": "69.0.0",
  "type": "database_metadata",
  "payload": {
    "databaseChecksum": "3f5c...e1",
    "updateKey": "secret123"
  }
}
```

- `databaseChecksum` is a SHA-256 hex digest of the exported competition JSON, computed after removing `exportDate` and every `updateKey` property. It changes only when the competition data changes, and is meant for caching.
- tracker-core stores the checksum and attaches it (as `databaseChecksum`) to the next `database_zip` it receives on the connection.

---

## Binary Frames

### Frame Layout

Binary frames use the WebSocket binary opcode:

```
[4 bytes: versionLength][versionLength bytes: UTF-8 version]
[4 bytes: typeLength][typeLength bytes: UTF-8 type]
[payload bytes]
[optional key trailer]
```

All lengths are unsigned 32-bit big-endian integers.

**Example** (`flags_zip`, protocol `69.0.0`, no key):

```
[00 00 00 06] [36 39 2E 30 2E 30] [00 00 00 09] [66 6C 61 67 73 5F 7A 69 70] [50 4B 03 04 ... ZIP ...]
 versionLen    "69.0.0"            typeLen       "flags_zip"                   payload
```

tracker-core checks the version with the same rule as text frames. A frame with a too-old version is ignored and the protocol error is reported to the hub.

### Key Trailer

When an update key is configured, OWLCMS appends it after the payload:

```
[ ...frame... ] [keyLength bytes: UTF-8 key] [4 bytes: keyLength] [4 bytes: magic A5 4B 45 59]
```

Detection, reading from the end of the frame:

1. If the last 4 bytes are `A5 4B 45 59`, a trailer is present.
2. The 4 bytes before the magic are the big-endian `keyLength`.
3. The `keyLength` bytes before that are the UTF-8 key.
4. Everything before the key is the frame proper.
5. Without the magic, there is no trailer.

### Binary Message Types

| Type | Sent | Payload | tracker-core handling |
|------|------|---------|-----------------------|
| `database_zip` | On connect, on request, and after platform / championship / age group edits; always preceded by `database_metadata` | ZIP with one entry, `competition.json` | Parsed and loaded as the full competition database |
| `translations_zip` | On connect, on request, and when translations are reloaded | ZIP with one entry, `translations.json` | Loaded into the hub, skipped when the checksum is unchanged |
| `flags_zip` | On connect (when flags exist) and on request | Flag image files, plus `mappings/country-code-map.json` | Flags extracted to `<local>/flags/`, mappings to `<local>/mappings/` |
| `logos_zip` | On request only | Logo image files | Extracted to `<local>/logos/` |
| `pictures_zip` | On request only | Athlete/official picture files | Extracted to `<local>/pictures/` |
| `gamx_zip` | On request only | GAMX parameter tables (`params-*.json`) | Extracted to `<local>/gamx/` |

`<local>` is the tracker-core local files directory (default `./local`), served under the `/local` URL prefix. Each extraction first empties the target directory. Empty `pictures_zip`, `logos_zip` and `gamx_zip` archives are not sent.

#### `database_zip` content

`competition.json` contains the full competition export (format `2.0`). Top-level keys:

```json
{
  "formatVersion": "2.0",
  "exportDate": "...",
  "competition": { },
  "config": { },
  "accounts": [ ],
  "championships": [ ],
  "ageGroups": [ ],
  "teams": [ ],
  "coaches": [ ],
  "sessions": [ ],
  "athletes": [ ],
  "platforms": [ ],
  "records": [ ],
  "recordConfig": { },
  "technicalOfficials": [ ],
  "technicalOfficialsTimetable": [ ]
}
```

Dates are ISO-8601 strings (`"2026-08-26"`, `"2026-08-30T10:51:08.44137"`).

##### Athlete Object

```json
{
  "key": -2005683348,
  "lastName": "DOE",
  "firstName": "John",
  "fullBirthDate": "2007-01-01",
  "isoBirthDate": "2007-01-01",
  "gender": "M",
  "bodyWeight": 109.2,
  "categoryCode": "S20_M110",
  "team": 68471,
  "sessionName": "M+95/M110",
  "startNumber": 1,
  "lotNumber": 4,
  "snatch1Declaration": 150,
  "snatch1Change1": null,
  "snatch1Change2": null,
  "snatch1ActualLift": 150,
  "snatch1LiftTime": "2026-08-30T10:51:08.44137",
  "snatch2AutomaticProgression": "151",
  "...": "...",
  "participations": [
    {
      "categoryCode": "PSR_M110",
      "championshipType": "U",
      "snatchRank": 4,
      "cleanJerkRank": 6,
      "totalRank": 5,
      "teamMember": true,
      "...": "..."
    }
  ]
}
```

- `key` is an integer and is the athlete identifier used in `startOrderKeys`, `liftingOrderKeys`, and `sessionAthletes`.
- `team` is a numeric team ID; the name is in the `teams` array.
- `sessionName` is the athlete's session.
- Attempt values: positive = good lift, negative = failed lift, `null` = not attempted. `Declaration` / `Change1` / `Change2` are requested weights.

##### Database vs. Update Athlete Data

| Field | DATABASE (`athletes[]`) | UPDATE (`sessionAthletes[].displayInfo`) |
|-------|------------------------|------------------------------------------|
| Birth date | `fullBirthDate: "1995-03-15"` | `yearOfBirth: "1995"` |
| Team | `team: 12345` (numeric ID) | `teamName: "USA"` |
| Category | `categoryCode: "SR_M89"` | `category: "M89 Senior"` |
| Attempts | `snatch1ActualLift: -100` | `sattempts: [{value, status}]` |
| Name | `firstName`, `lastName` | `fullName: "DOE, John"` |

##### Records

```json
{
  "id": 1848108757857399600,
  "recordValue": 87,
  "ageGrp": "JR",
  "athleteName": "Asian Standard",
  "bwCatLower": 0,
  "bwCatUpper": 48,
  "bwCatString": "48",
  "gender": "F",
  "recordFederation": "AWF",
  "recordLift": "SNATCH",
  "recordName": "Asia",
  "groupNameString": "",
  "...": "..."
}
```

`groupNameString` is empty for pre-existing records, and contains the session name for records set during the competition.

#### `translations_zip` content

`translations.json`:

```json
{
  "locales": {
    "en": { "Start": "Start", "...": "..." },
    "fr": { "Start": "Commencer", "...": "..." },
    "fr_CA": { "Start": "Démarrer", "...": "..." },
    "zh_HANT": { "...": "..." }
  },
  "translationsChecksum": "63cc8833...f87b"
}
```

- Locale keys are Java locale strings with **underscores** (`fr_CA`, `es_419`, `zh_HANT`).
- Regional maps are **already complete**: OWLCMS merges the base language and the regional overrides before sending.
- `translationsChecksum` is a SHA-256 hex digest of all locale data. tracker-core skips reprocessing when it matches the last checksum received.

Plugins read translations with `competitionHub.getTranslations({ locale: 'fr_CA' })`. tracker-core also accepts hyphenated requests (`fr-CA` finds `fr_CA`); an unknown region falls back to its base language (`fr_BE` → `fr`), and an unknown language to English.

---

## Tracker Responses

tracker-core answers each **text** frame with one JSON text frame. Binary frames get no reply on success.

| Situation | Response |
|-----------|----------|
| `update`, `timer`, `decision` processed | `{"status": 200, "message": "Update processed"}` (`Timer processed`, `Decision processed`) |
| `database_metadata` received | `{"status": 200, "message": "Database metadata accepted"}` |
| Database still loading | `{"status": 202, "message": "Database load in progress, please retry"}` |
| Database or translations missing, no request outstanding | `428`, see below |
| Database or translations missing, expected or already requested | `{"status": 202, "message": "Update processed, waiting for startup data", "reason": "waiting_for_startup_data", "waitingFor": ["translations"]}` (see [Start Latch](#start-latch)) |
| Processing failure | `{"status": 500, "message": "..."}` |
| Missing or too-old `version` (text frame), or a binary frame whose version header is missing or too old | `{"status": 400, "error": "Protocol version check failed", "reason": "...", "details": {...}}` |
| Missing or invalid update key | `{"status": 401, "message": "..."}`, then close code `1008` |
| Envelope without `type` or `payload` | `{"error": "Invalid message format. Expected {version, type, payload}"}` |
| Invalid JSON or binary processing error | `{"error": "..."}` |

### Requesting Missing Data (428)

tracker-core asks for data with a `428` message. It is sent either as the reply to a text frame or on its own (at connection, when a plugin needs a resource, or to refresh the database):

```json
{
  "status": 428,
  "message": "Precondition Required: Missing required data",
  "reason": "missing_preconditions",
  "refresh": false,
  "missing": ["database", "translations"]
}
```

**`missing` names sent by tracker-core:** `database`, `translations`, `flags`, `logos`, `pictures`, `gamx`. OWLCMS accepts each name with or without the `_zip` suffix and sends the matching data:

| `missing` entry | OWLCMS sends |
|-----------------|--------------|
| `database` / `database_zip` | `database_metadata` + `database_zip` |
| `translations` / `translations_zip` | `translations_zip` |
| `flags` / `flags_zip` | `flags_zip` |
| `logos` / `logos_zip` | `logos_zip` (if any logos exist) |
| `pictures` / `pictures_zip` | `pictures_zip` (if any pictures exist) |
| `gamx` / `gamx_zip` | `gamx_zip` (if GAMX tables exist) |

**`reason` values:** `missing_preconditions` (reply to a text frame), `startup_preconditions`, `plugin_preconditions`, `startup_document_resources` (logos requested after the first database load), `database_refresh`, `resource_refresh` (fresh copies requested, e.g. before producing a document or on a tracker full refresh).

**`refresh`:** every 428 sent by tracker-core includes `"refresh": true|false`.

- `refresh: true` (`database_refresh`, `resource_refresh`): OWLCMS discards its cached translations / flags / logos / pictures / GAMX archives and rebuilds them before answering.
- `refresh: false` (all other requests, including replies to text frames): OWLCMS answers from its cached archives.
- The database itself is always exported from the current competition state.
- OWLCMS treats a 428 *without* a `refresh` field as a refresh if `missing` contains `database` or `database_zip` (older trackers, see Appendix A).

The connection stays open after a 428. tracker-core re-sends requests for resources that have not arrived, with increasing delays (first after 10 s).

### Start Latch

The tracker cannot run without the database and the translations. Until both have arrived on a connection (or after a full refresh), the start latch is closed:

1. OWLCMS sends both when the connection opens ([Startup Sequence](#startup-sequence)); tracker-core counts that as the request.
2. Text frames received before they arrive are still applied, and are answered with `202` and `reason: "waiting_for_startup_data"` (no `missing` list), so OWLCMS sends each resource once.
3. The latch opens when both have arrived; later frames get `200`.
4. A resource still missing 10 s after the connection opened is asked for with a `428` (`startup_preconditions`), then again with increasing delays. A reply to a text frame asks for it (`missing_preconditions`) only when no request is outstanding.

Resources requested on demand (`flags`, `logos`, `pictures`, `gamx`) follow the same rule: a resource already requested is not asked for again until the retry delay has passed. Requests with `refresh: true` are always sent.

OWLCMS ignores replies other than `428`.

---

## Example Messages

**Update:**

```json
{
  "version": "69.0.0",
  "type": "update",
  "payload": {
    "uiEvent": "LiftingOrderUpdated",
    "updateKey": "secret123",
    "competitionName": "2026 National Championships",
    "fop": "A",
    "fopState": "CURRENT_ATHLETE_DISPLAYED",
    "mode": "CURRENT_ATHLETE",
    "break": "false",
    "breakIsIndefinite": "false",
    "fullName": "DOE, John",
    "teamName": "USA",
    "attemptNumber": "2",
    "weight": "120",
    "timeAllowed": "60000",
    "liftTypeKey": "Snatch",
    "sessionName": "A",
    "hidden": "false",
    "currentAthleteKey": -2005683348,
    "startOrderKeys": [{"isSpacer": true}, -2005683348, 117622417],
    "liftingOrderKeys": [{"isSpacer": true}, -2005683348, 117622417],
    "sessionAthletes": [ "..." ]
  }
}
```

**Timer (athlete clock):**

```json
{
  "version": "69.0.0",
  "type": "timer",
  "payload": {
    "updateKey": "secret123",
    "fopName": "A",
    "fopState": "TIME_RUNNING",
    "mode": "CURRENT_ATHLETE",
    "fullName": "DOE, John",
    "attemptNumber": "2",
    "liftTypeKey": "Snatch",
    "serverLocalTime": "14:23:45.123456",
    "athleteTimerEventType": "StartTime",
    "timeAllowed": "60000",
    "athleteStartTimeMillis": "1788100000000",
    "athleteMillisRemaining": "60000",
    "athleteInitialWarningMillis": "-1",
    "athleteFinalWarningMillis": "30000"
  }
}
```

**Timer (break clock):**

```json
{
  "version": "69.0.0",
  "type": "timer",
  "payload": {
    "updateKey": "secret123",
    "fopName": "A",
    "fopState": "BREAK",
    "mode": "INTERRUPTION",
    "serverLocalTime": "14:23:45.123456",
    "breakTimerEventType": "BreakStarted",
    "break": "true",
    "breakType": "FIRST_SNATCH",
    "indefiniteBreak": "false",
    "breakStartTimeMillis": "1788100000000",
    "breakMillisRemaining": "600000"
  }
}
```

**Decision:**

```json
{
  "version": "69.0.0",
  "type": "decision",
  "payload": {
    "decisionEventType": "FULL_DECISION",
    "updateKey": "secret123",
    "mode": "CURRENT_ATHLETE",
    "competitionName": "2026 National Championships",
    "fop": "A",
    "fopState": "DECISION_VISIBLE",
    "break": "false",
    "fullName": "DOE, John",
    "attemptNumber": "2",
    "liftTypeKey": "Snatch",
    "d1": "true",
    "d2": "true",
    "d3": "false",
    "decision": "true",
    "singleReferee": "false",
    "singleLight": "false",
    "decisionsVisible": "true",
    "down": "false"
  }
}
```

**Jury decision:**

```json
{
  "version": "69.0.0",
  "type": "decision",
  "payload": {
    "updateKey": "secret123",
    "mode": "CURRENT_ATHLETE",
    "fop": "A",
    "fopState": "DECISION_VISIBLE",
    "break": "false",
    "decisionEventType": "JURY_DECISION",
    "juryDecision": "BAD_LIFT",
    "juryReversal": "true",
    "juryReasonCode": "3",
    "athleteFull": "DOE, Jane",
    "athleteAbbreviated": "DOE J.",
    "waitForAnnouncer": "false",
    "recordKind": "none",
    "actualLift": "-103"
  }
}
```

---

## Appendix A: Legacy Inputs Accepted by tracker-core

OWLCMS 69 does not send any of the following. tracker-core still accepts them for tools and recorded samples. OWLCMS 68 and earlier cannot reach them: they send protocol `64.0.0`, which is refused with a `400` reply (the connection stays open), and a frame with no version header is refused too.

**Text frames**

- `type: "database"` with the competition export as `payload`. A payload without athletes is stored as metadata and answered with `202` (`reason: "awaiting_binary_database"`) while waiting for a binary database.
- A database embedded in any text payload as `payload.database`, with an optional `payload.databaseChecksum` or `payload.checksum`.
- Other `type` values: processed generically, or answered with `428` when no database is loaded.
- Update key under `payload.update_key` or `payload.updatekey`.
- `fopName` instead of `fop` (and the reverse) on any message type.
- Athlete timer messages without `athleteInitialWarningMillis` / `athleteFinalWarningMillis`: thresholds are derived from the duration (`120000` → `90000` / `30000`; `60000` → `-1` / `30000`).
- `records` in `decision` payloads as a JSON string (older senders), including the string `"null"`; parsed into an object.
- Messages without `decisionState` / `adjudicationDecision` (older senders): plugins fall back to the referee decision fields (`d1`..`d3`, `down`, `juryDecision`, ...).

**Binary frames**

- Type aliases: `database` (for `database_zip`), `flags` (for `flags_zip`), `pictures` (for `pictures_zip`).
- `database_zip` payloads containing raw JSON instead of a ZIP, or a ZIP whose JSON entry is named `database.json` or any other `*.json`.
- `translations.json` without the `locales` wrapper (locale maps at the top level).
- Frames without a key trailer when `OWLCMS_UPDATEKEY` is not configured.

**428 handling (OWLCMS side)**

- A 428 without a `refresh` field whose `missing` list contains `database` or `database_zip` is treated as a refresh request.
