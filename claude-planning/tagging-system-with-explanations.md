This document defines the topic tags used by our automated tagging system. Every ticket should receive exactly ONE topic tag.

Standalone Tags (Green)
These tags stand alone without subcategories:

#film-room - Questions about film analysis, player breakdowns, or film room content access
#podcast - Questions or feedback about the Dynasty Nerds podcast
#rookie-guide - Questions about the Rookie Guide product, when it releases, or how to access it
#roster-rescue - Questions about the Roster Rescue product or roster analysis features
#sleeper-mini - Issues specific to the Sleeper Mini app (not regular Sleeper league sync)

Parent/Child Tags (Blue/Purple respectively)
Use the most specific (child) tag when possible. Only use parent tags when the specific subcategory is unclear.

Account Login Group
#account-login - General account access issues when specific problem is unclear
#account-login/app-store-issue - App Store subscription not syncing with account access
#account-login/duplicate-charge - Customer charged multiple times for same subscription
#account-login/email-mismatch - Using different email for payment vs account login
#account-login/login-issue - Can't log in, forgot password, authentication errors
#account-login/payment-sync - Payment confirmed but access not granted yet
#account-login/subscription-refresh - Just subscribed but can't add leagues/access features (needs logout/login refresh)

Drafts Group
#drafts - General draft-related issues when specific type unclear
#drafts/mocks - Mock draft tool issues, mock draft not working
#drafts/picks - Draft picks not showing on rosters, rookie picks missing

Feature Request Group
#feature-request - General feature request when type unclear
#feature-request/new-feature - Request for completely new functionality
#feature-request/new-platform - Request to support new league platform (e.g., add Yahoo support)
#feature-request/ui-improvement - Suggestions for UI/UX improvements

General Misc Group
#general-misc - General questions that don't fit other categories
#general-misc/careers - Questions about working at Dynasty Nerds
#general-misc/discord - Questions about Discord server access or issues

League Sync Group
#league-sync - League sync issues when platform unknown or general sync problems
#league-sync/espn - ESPN league not syncing, ESPN-specific issues
#league-sync/ffpc - FFPC league sync issues
#league-sync/fleaflicker - Fleaflicker league sync issues
#league-sync/mfl - MyFantasyLeague (MFL) sync issues
#league-sync/rollover - Season rollover issues, leagues not rolling to new season
#league-sync/scoring - League scoring not matching platform, scoring sync issues
#league-sync/sleeper - Sleeper league not syncing (different from Sleeper Mini app)

Misc Bug Group
#misc-bug - Bug reports when specific type unclear
#misc-bug/app-crash - App is crashing, freezing, or force closing
#misc-bug/feature-broken - Feature that previously worked is now broken

Players/Rookies Group
#players-rookies - Rookie/player issues when specific type unclear
#players-rookies/info - Questions about rookie player information or rankings
#players-rookies/missing - Rookie players missing from database
#players-rookies/values - Questions about player values or dynasty rankings

Promotions Group
#promotions - Promotion/discount code issues when type unclear
#promotions/fastdraft - FastDraft promotion code issues or questions
#promotions/underdog - Underdog promotion or partnership questions

Refund/Cancel Group
#refund-cancel - Billing issues when specific request unclear
#refund-cancel/cancel - Customer wants to cancel subscription
#refund-cancel/refund - Customer requesting refund

Sentiment Tags (Handled Separately)
These tags are applied automatically by the system IN ADDITION to topic tags:

#angry-customer - Applied when anger score >= 40
#high-urgency - Applied when urgency score >= 60 or anger score >= 40
#spam - Applied when spam is detected (no other tags needed)

System Tags (Ignore)
#ai-drafts - HelpScout native AI tag
#call-sheet - Special internal tag for call sheets

Tag Selection Rules
Choose the MOST SPECIFIC tag possible and only add 1 topic tag per ticket (sentiment and system tags are separately handled)
NEVER use both parent and child tags together
If unclear, default to #general-misc
For spam, only use #spam (no topic tag)

Important Distinctions
ACCOUNT ACCESS vs LEAGUE SYNC:
- If user JUST subscribed and can't add leagues/access features → #account-login/subscription-refresh
- If user mentions "just paid", "just bought", "new subscription" + can't access → #account-login/subscription-refresh  
- If user has been using the app and specific leagues won't sync → #league-sync or platform-specific
- "Can't add leagues" right after subscribing → #account-login/subscription-refresh
- "My ESPN league won't update" → #league-sync/espn

Examples
Customer: "I just bought pro but can't add my leagues"
Tag: #account-login/subscription-refresh (new subscription access issue)

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

Customer: "Just subscribed but the app says I'm not premium"
Tag: #account-login/subscription-refresh