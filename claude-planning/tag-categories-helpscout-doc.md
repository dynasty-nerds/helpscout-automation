# Tag Categories Document (For HelpScout Docs)

This is a sample document to be created in HelpScout Docs (like Fix Changelog and Known Issues). It will be fetched dynamically by the automation system.

---

# Support Tag Categories

This document defines the tag categories used by our automated tagging system. Every ticket should receive exactly ONE major category tag and optionally minor detail tags.

## Major Categories (Required)

### account-access
**When to use:** Login issues, subscription access problems, "can't access premium", payment not syncing
**Keywords:** can't access, premium locked, subscription not working, payment issue, login

### league-sync  
**When to use:** League not syncing, players missing, roster issues, league not updating
**Keywords:** league, sync, roster, players missing, not updating, refresh

### draft-picks
**When to use:** Mock draft issues, draft picks on rosters, rookie picks, draft display problems
**Keywords:** draft, picks, rookie, mock draft, startup

### refund-cancel
**When to use:** Refund requests, cancellation requests, billing disputes
**Keywords:** refund, cancel, money back, stop billing, unsubscribe, charge

### sleeper-mini
**When to use:** Sleeper Mini specific issues
**Keywords:** sleeper mini, mini app

### feature-request
**When to use:** New features, improvements, "wish we had", suggestions
**Keywords:** wish, would be nice, please add, feature request, suggestion, could you

### bug-report
**When to use:** App crashes, errors, broken functionality, something used to work
**Keywords:** broken, crash, error, used to work, bug, not working

### general-question
**When to use:** How-to questions, general confusion, doesn't fit other categories
**Keywords:** how do I, where is, what is, help me understand

## Minor Categories (Optional Details)

### League Platform Tags
Use with: league-sync, draft-picks
- **league-espn** - ESPN league issues
- **league-sleeper** - Sleeper league issues  
- **league-mfl** - MFL/MyFantasyLeague issues
- **league-ffpc** - FFPC league issues
- **league-fleaflicker** - Fleaflicker league issues
- **league-yahoo** - Yahoo league issues
- **league-rollover** - Season rollover issues (February-August)

### Draft Issue Tags
Use with: draft-picks
- **draft-mock** - Mock draft specific issues
- **draft-rookie** - Rookie draft picks
- **draft-startup** - Startup draft issues
- **draft-display** - Draft picks not showing correctly

### Billing Issue Tags
Use with: refund-cancel, account-access
- **refund-requested** - Customer explicitly requests refund
- **cancel-requested** - Customer wants to cancel
- **duplicate-charge** - Multiple/duplicate transactions
- **auto-renew-stop** - Wants to stop auto renewal
- **subscription-refresh** - Needs to sign out/in to refresh
- **payment-sync** - Payment not syncing to access

### Access Issue Tags
Use with: account-access
- **login-issue** - Can't log in
- **email-mismatch** - Using different email
- **app-store-purchase** - App Store subscription issues
- **memberpress-issue** - MemberPress specific problems

### Bug Type Tags
Use with: bug-report
- **app-crash** - App is crashing
- **data-incorrect** - Wrong data displayed
- **feature-broken** - Feature used to work, now doesn't
- **sync-broken** - Sync functionality broken

### Feature Type Tags
Use with: feature-request
- **new-platform** - Request for new league platform support
- **new-feature** - General new feature request
- **ui-improvement** - UI/UX improvement request

## Detection Priority

When multiple categories could apply, use this priority order:
1. spam (if detected - no other tags needed)
2. refund-cancel (financial issues take priority)
3. account-access (access problems are urgent)
4. bug-report (broken functionality)
5. league-sync (sync issues)
6. draft-picks (draft issues)
7. sleeper-mini (if mentioned)
8. feature-request (new requests)
9. general-question (default)

## Notes for Agents

- Tags are applied automatically based on message content
- You can manually add/remove tags as needed
- If you see a pattern that needs a new category, update this document
- Report missing categories to the team for discussion

---

Last Updated: [Date]
Version: 1.0