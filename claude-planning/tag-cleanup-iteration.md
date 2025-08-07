# Tag Cleanup Iteration Guide

## Overview
This document helps iterate through cleaning up 299 existing tags and merging them into the new categorization system.

## New Tag Categories (Target State)

### Major Categories (8 total)
- ✅ account-access
- ✅ league-sync  
- ✅ draft-picks
- ✅ refund-cancel
- ✅ sleeper-mini
- ✅ feature-request
- ✅ bug-report
- ✅ general-question

### Minor Categories (30 total)
**League Platforms (7):**
- ✅ league-espn
- ✅ league-sleeper
- ✅ league-mfl
- ✅ league-ffpc
- ✅ league-fleaflicker
- ✅ league-yahoo
- ✅ league-rollover

**Draft Issues (4):**
- ✅ draft-mock
- ✅ draft-rookie
- ✅ draft-startup
- ✅ draft-display

**Billing Issues (5):**
- ✅ refund-requested
- ✅ cancel-requested
- ✅ duplicate-charge
- ✅ auto-renew-stop
- ✅ subscription-refresh

**Access Issues (5):**
- ✅ payment-sync
- ✅ login-issue
- ✅ email-mismatch
- ✅ app-store-purchase
- ✅ memberpress-issue

**Bug Types (4):**
- ✅ app-crash
- ✅ data-incorrect
- ✅ feature-broken
- ✅ sync-broken

**Feature Types (3):**
- ✅ new-platform
- ✅ new-feature
- ✅ ui-improvement

**Special Tags (2):**
- ✅ angry-customer (sentiment)
- ✅ spam (quality)

## Phase 1: Delete Unused Tags (0 tickets)
These can be deleted immediately with no impact:

### Customer Name/Email Tags (PRIVACY ISSUE - DELETE FIRST)
- [ ] **aidan**: 0 tickets
- [ ] **alex-m**: 0 tickets
- [ ] **brandon**: 0 tickets
- [ ] **dan@dynasty**: 0 tickets
- [ ] **david**: 0 tickets
- [ ] **joe**: 0 tickets
- [ ] **kyle**: 0 tickets
- [ ] **nick@dynastynerds**: 0 tickets
- [ ] **zach**: 0 tickets

### Date-Specific Tags (OUTDATED)
- [ ] **issues-from-1-22**: 0 tickets
- [ ] **rollover**: 0 tickets
- [ ] **feb-march-refund**: 0 tickets

### Unused Issue Tags
- [ ] **bestball**: 0 tickets
- [ ] **dynasty-gm**: 0 tickets
- [ ] **espn-api-change**: 0 tickets
- [ ] **fast-drafting**: 0 tickets
- [ ] **ffpc-issue**: 0 tickets
- [ ] **franchise-leagues**: 0 tickets
- [ ] **issues**: 0 tickets
- [ ] **league-fleaflicker**: 0 tickets
- [ ] **league-not-supported**: 0 tickets
- [ ] **league-rollover**: 0 tickets
- [ ] **login-issues**: 0 tickets
- [ ] **missing-league**: 0 tickets
- [ ] **mock-draft-2024**: 0 tickets
- [ ] **new-startup-draft**: 0 tickets
- [ ] **not-logged-in**: 0 tickets
- [ ] **not-on-helpscout**: 0 tickets
- [ ] **paypal**: 0 tickets
- [ ] **pre-rollover-notification**: 0 tickets
- [ ] **promotion-codes**: 0 tickets
- [ ] **rankings-questions**: 0 tickets
- [ ] **rtk**: 0 tickets
- [ ] **sleeper-error**: 0 tickets
- [ ] **sleeper-feature-parity**: 0 tickets
- [ ] **sort-by-position**: 0 tickets
- [ ] **startup-mock-draft**: 0 tickets
- [ ] **startup-picks**: 0 tickets
- [ ] **subscription-issue**: 0 tickets
- [ ] **team-defense**: 0 tickets
- [ ] **twitter-login**: 0 tickets
- [ ] **underdog**: 0 tickets
- [ ] **web-app**: 0 tickets

## Phase 2: Rename High-Usage Tags
These tags have significant usage and should be renamed to new categories:

### Platform Tags → league-* format
- [ ] **fleaflicker** (144) → **league-fleaflicker**
- [ ] **espn** (132) → **league-espn**
- [ ] **sleeper** (103) → **league-sleeper**
- [ ] **mfl** (68) → **league-mfl**
- [ ] **yahoo** (3) → **league-yahoo**
- [ ] **ffpc** (2) → **league-ffpc**

### Issue Type Tags → Major Categories
- [ ] **refund** (199) → **refund-cancel**
- [ ] **cancel** (158) → **refund-cancel**
- [ ] **leagues-not-syncing** (84) → **league-sync**
- [ ] **logged-in-cant-view** (75) → **account-access**
- [ ] **subscription-access** (72) → **account-access**
- [ ] **draft-picks-issue** (32) → **draft-picks**
- [ ] **mock-draft** (21) → **draft-picks** + **draft-mock**
- [ ] **bug** (17) → **bug-report**
- [ ] **subscription-canceled** (14) → **refund-cancel**
- [ ] **duplicate-charge** (10) → **refund-cancel** + **duplicate-charge**
- [ ] **rookie-draft** (7) → **draft-picks** + **draft-rookie**
- [ ] **feature-request** (7) → **feature-request**
- [ ] **app-crash** (3) → **bug-report** + **app-crash**

### Sleeper Mini
- [ ] **sleeper-mini** (65) → Keep as is (already correct)

### Sentiment Tags
- [ ] **angry-customer** (18) → Keep as is (special tag)
- [ ] **spam** (Keep as is when created)

## Phase 3: Merge Similar/Duplicate Tags
These groups should be merged into single tags:

### Access Issues → account-access
- [ ] **login-issue** (59)
- [ ] **login** (19)
- [ ] **login-error** (16)
- [ ] **access-issue** (15)
- [ ] **cant-login** (3)
- [ ] **access** (2)
- [ ] **email-mismatch** (5)
- [ ] **sign-in-issue** (1)
**Merge all to:** **account-access** + **login-issue** (minor)

### Subscription Issues → account-access
- [ ] **subscription** (62)
- [ ] **subscription-access** (72)
- [ ] **subscription-ended** (5)
- [ ] **canceled-subscription** (5)
- [ ] **subscription-canceled** (14)
- [ ] **memberpress** (20)
- [ ] **membership** (8)
**Merge all to:** **account-access** + **memberpress-issue** (minor)

### Refund/Cancel → refund-cancel
- [ ] **refund** (199)
- [ ] **cancel** (158)
- [ ] **refund-request** (12)
- [ ] **cancel-subscription** (13)
- [ ] **refund-cancel** (11)
- [ ] **cancel-refund** (7)
- [ ] **subscription-refund** (5)
- [ ] **cancellation** (5)
- [ ] **billing** (11)
**Merge all to:** **refund-cancel**

### League Sync Issues → league-sync
- [ ] **leagues-not-syncing** (84)
- [ ] **not-syncing** (28)
- [ ] **league-issue** (22)
- [ ] **league** (8)
- [ ] **sync-issue** (21)
- [ ] **syncing-issue** (17)
- [ ] **league-sync** (13)
- [ ] **refresh** (10)
- [ ] **not-updating** (8)
**Merge all to:** **league-sync**

### Draft Issues → draft-picks
- [ ] **draft-picks-issue** (32)
- [ ] **draft-picks** (23)
- [ ] **rookie-picks** (23)
- [ ] **mock-draft** (21)
- [ ] **draft** (9)
- [ ] **rookie-draft** (7)
- [ ] **startup-draft** (1)
**Merge all to:** **draft-picks** (with appropriate minor tags)

### App Store Issues → account-access + app-store-purchase
- [ ] **app-store** (20)
- [ ] **app-store-issue** (3)
- [ ] **app-store-purchase** (1)
**Merge all to:** **account-access** + **app-store-purchase**

## Phase 4: Handle Special Cases

### Keep As-Is (Special/Internal)
- [ ] **high-urgency** (Keep for escalation)
- [ ] **angry-customer** (Keep for sentiment)
- [ ] **vip** (Keep if using for important customers)
- [ ] **call-sheet** (Keep if specific workflow)

### FastDraft Related
- [ ] **fast-draft** (45) → Could become minor tag under **account-access**
- [ ] **missing-fast-draft** (22) → Merge with above
- [ ] **fast-draft-issue** (8) → Merge with above

### Unclear/Review Needed
- [ ] **charge** (44) - Review: billing or fantasy charges?
- [ ] **update** (39) - Too vague, review usage
- [ ] **issue** (29) - Too vague, review usage
- [ ] **please-help** (24) - Review sentiment
- [ ] **help** (18) - Review sentiment
- [ ] **error** (15) - Review specific errors
- [ ] **missing** (12) - Review what's missing
- [ ] **question** (10) - Should be **general-question**

## Phase 5: Final Cleanup

### After Merging
1. Run tag analysis again to verify cleanup
2. Update automation to use new tags
3. Train team on new tag system
4. Monitor for tags being created outside system

### Success Metrics
- [ ] Reduce from 299 tags to ~40 tags
- [ ] 100% of tickets have major category
- [ ] 50%+ of tickets have relevant minor category
- [ ] No customer names in tags
- [ ] No date-specific tags

## Notes for Team

### When Manually Tagging
1. Always add ONE major category first
2. Add minor categories only if clearly applicable
3. Don't create new tags - request additions to system
4. Use angry-customer and high-urgency sparingly

### Tag Merge Process in HelpScout
1. Go to Manage → Tags
2. Click on tag to merge FROM
3. Select "Merge" option
4. Choose tag to merge TO
5. Confirm (all tickets will be retagged)

### Bulk Delete Process
1. Go to Manage → Tags
2. Select multiple tags with checkbox
3. Click "Delete" (only works if 0 tickets)

---

## Quick Reference - Final Tag List (40 total)

**Major (8):** account-access, league-sync, draft-picks, refund-cancel, sleeper-mini, feature-request, bug-report, general-question

**Minor (30):** league-espn, league-sleeper, league-mfl, league-ffpc, league-fleaflicker, league-yahoo, league-rollover, draft-mock, draft-rookie, draft-startup, draft-display, refund-requested, cancel-requested, duplicate-charge, auto-renew-stop, subscription-refresh, payment-sync, login-issue, email-mismatch, app-store-purchase, memberpress-issue, app-crash, data-incorrect, feature-broken, sync-broken, new-platform, new-feature, ui-improvement

**Special (2):** angry-customer, spam