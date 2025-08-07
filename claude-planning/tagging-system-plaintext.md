# Topic Tagging System

This document defines the tags used by our automated tagging system. Every ticket should receive exactly ONE topic tag.

## Standalone Tags (Green)
These tags stand alone without subcategories:

#film-room
#podcast  
#rookie-guide
#roster-rescue
#sleeper-mini

## Parent/Child Tags (Blue/Purple)
Use the most specific (child) tag when possible. Only use parent tags when the specific subcategory is unclear.

### Account Login Group
#account-login
#account-login/app-store-issue
#account-login/duplicate-charge
#account-login/email-mismatch
#account-login/login-issue
#account-login/payment-sync
#account-login/subscription-refresh

### Drafts Group
#drafts
#drafts/mocks
#drafts/picks

### Feature Request Group
#feature-request
#feature-request/new-feature
#feature-request/new-platform
#feature-request/ui-improvement

### General Misc Group
#general-misc
#general-misc/careers
#general-misc/discord

### League Sync Group
#league-sync
#league-sync/espn
#league-sync/ffpc
#league-sync/fleaflicker
#league-sync/mfl
#league-sync/rollover
#league-sync/scoring
#league-sync/sleeper

### Misc Bug Group
#misc-bug
#misc-bug/app-crash
#misc-bug/feature-broken

### Players/Rookies Group
#players-rookies
#players-rookies/info
#players-rookies/missing
#players-rookies/values

### Promotions Group
#promotions
#promotions/fastdraft
#promotions/underdog

### Refund/Cancel Group
#refund-cancel
#refund-cancel/cancel
#refund-cancel/refund

## Special Tags (Handled Separately)
These tags are applied automatically by the system IN ADDITION to topic tags:

#angry-customer - Applied when anger score >= 40
#high-urgency - Applied when urgency score >= 60 or anger score >= 40
#spam - Applied when spam is detected (no other tags needed)

## System Tags (Ignore)
#ai-drafts - HelpScout native AI tag
#call-sheet - Special internal tag for call sheets

## Tag Selection Rules

1. Choose the MOST SPECIFIC tag possible
2. NEVER use both parent and child tags together
3. If unclear, default to #general-misc
4. For spam, only use #spam (no topic tag)

## Examples

Customer: "I can't log into my account on iPhone"
Tag: #account-login/login-issue

Customer: "My ESPN league won't sync"
Tag: #league-sync/espn

Customer: "Having issues with my account"
Tag: #account-login (parent only, unclear specifics)

Customer: "When is the rookie guide coming out?"
Tag: #rookie-guide

Customer: "My league isn't syncing"
Tag: #league-sync (parent only, platform unknown)