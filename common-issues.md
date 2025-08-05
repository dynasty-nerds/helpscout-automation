# Common Support Issues

This file defines common issue patterns for automatic categorization. Update this file to add or modify issue detection patterns.

## Format
Each section should have:
- **Category**: The summary text to use
- **Keywords**: Words/phrases that identify this issue (case-insensitive)

---

## Subscription Issues

### Wants to cancel subscription
- Keywords: cancel

### Requesting refund
- Keywords: refund

### Subscription not recognized
- Keywords: (subscription OR upgrade) AND (recognized OR renewed OR "just paid")
- Note: Common after renewal - user needs to sign out and back in

---

## League Sync Issues

### ESPN sync/connection issue
- Keywords: espn AND (connect OR sync OR link)

### Sleeper sync issue
- Keywords: sleeper AND (sync OR connect)

### MFL sync issue
- Keywords: mfl AND (sync OR connect)

### Fleaflicker sync issue
- Keywords: (flea OR flicker) AND (sync OR connect)

### FFPC sync issue
- Keywords: ffpc AND (sync OR connect)

---

## Draft & Roster Issues

### Draft pick order/assignment issue
- Keywords: (rookie OR draft) AND (pick OR order OR wrong)
- Note: Common during rookie draft season

### Mock draft issue
- Keywords: mock AND draft

### Missing player on roster
- Keywords: player AND (missing OR "not showing" OR roster)
- Note: Often occurs with rookies due to MasterNerds player ID issues

### Player info incorrect
- Keywords: player AND (name OR team OR incorrect)

### League Analyzer player issue
- Keywords: "league analyzer" AND (player OR roster)

---

## Access & Login Issues

### Access issue
- Keywords: access

### Login problem
- Keywords: login OR "log in"

---

## General Issues

### Feature not working
- Keywords: "not working"

### Error with app
- Keywords: error

### Bug report
- Keywords: bug

### Subscription question
- Keywords: subscription
- Note: Generic subscription questions not covered above

### Needs help
- Keywords: help

### General inquiry
- Note: Default when no other patterns match