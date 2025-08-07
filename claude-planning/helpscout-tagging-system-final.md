# HelpScout Tagging System Documentation

## Overview
Our tagging system uses a hierarchical structure with three types of tags to categorize customer support tickets effectively. Every ticket should receive the most specific tag possible while maintaining clarity.

## Tag Types

### 1. Standalone Major Tags (Green)
These are independent category tags that don't have subcategories. Use these when the entire category is clear and specific.

### 2. Parent Major Tags (Blue)
These are category tags that have child tags beneath them. Use these only when you cannot determine the specific subcategory.

### 3. Child/Minor Tags (Purple)
These are detailed subcategories that provide specific context. Always prefer using a child tag over a parent tag when the detail is known.

## Tagging Rules

1. **Use ONE tag per ticket** (either standalone, parent, or child - never both parent and child)
2. **Prefer child tags** when you have enough information
3. **Use parent tags** only when the specific detail is unknown
4. **Add sentiment/special tags** (angry-customer, high-urgency, spam) IN ADDITION when applicable

## Complete Tag List

### 💚 Standalone Major Tags (Green)
- **film-room** - Content about film analysis and player breakdowns
- **general-misc** - General questions that don't fit other categories
- **podcast** - Questions or feedback about the podcast
- **promotions** - Questions about promotions and discount codes
- **rookie-guide** - Questions about the Rookie Guide product
- **roster-rescue** - Questions about the Roster Rescue product
- **sleeper-mini** - Issues specific to the Sleeper Mini app

### 🔵 Parent Major Tags (Blue, with children)

#### account-login
Use parent tag only when login issue type is unclear.

**Child Tags:**
- **account-login/app-store-issue** - App Store subscription problems
- **account-login/duplicate-charge** - Multiple or duplicate charges
- **account-login/email-mismatch** - Using different email addresses
- **account-login/login-issue** - Can't log in or authentication problems
- **account-login/payment-sync** - Payment not syncing to access
- **account-login/subscription-refresh** - Needs to sign out/in to refresh

#### drafts
Use parent tag only when draft issue type is unclear.

**Child Tags:**
- **drafts/mocks** - Mock draft issues
- **drafts/picks** - Draft picks on rosters or display issues

#### feature-request
Use parent tag only when feature request type is unclear.

**Child Tags:**
- **feature-request/new-feature** - Request for new functionality
- **feature-request/new-platform** - Request for new league platform support
- **feature-request/ui-improvement** - UI/UX improvement suggestions

#### general-misc
Use parent tag for general questions without specific subcategory.

**Child Tags:**
- **general-misc/careers** - Questions about careers at Dynasty Nerds
- **general-misc/discord** - Questions about Discord server

#### league-sync
Use parent tag only when league platform is unknown.

**Child Tags:**
- **league-sync/espn** - ESPN league sync issues
- **league-sync/ffpc** - FFPC league sync issues
- **league-sync/fleaflicker** - Fleaflicker league sync issues
- **league-sync/mfl** - MyFantasyLeague sync issues
- **league-sync/rollover** - Season rollover sync issues
- **league-sync/scoring** - League scoring sync issues
- **league-sync/sleeper** - Sleeper league sync issues

#### misc-bug
Use parent tag only when bug type is unclear.

**Child Tags:**
- **misc-bug/app-crash** - App is crashing
- **misc-bug/feature-broken** - Feature that used to work is broken

#### players-rookies
Use parent tag only when rookie issue type is unclear.

**Child Tags:**
- **players-rookies/info** - Information about rookie players
- **players-rookies/missing** - Rookie players missing from database
- **players-rookies/values** - Rookie player value questions

#### promotions
Use parent tag only when promotion type is unclear.

**Child Tags:**
- **promotions/fastdraft** - FastDraft promotion code issues
- **promotions/underdog** - Underdog promotion questions

#### refund-cancel
Use parent tag only when request type is unclear.

**Child Tags:**
- **refund-cancel/cancel** - Cancellation requests
- **refund-cancel/refund** - Refund requests

### 🔴 Special/Sentiment Tags
These are added IN ADDITION to category tags when applicable:

- **angry-customer** - Customer expressing frustration or anger
- **high-urgency** - Time-sensitive or critical issues
- **spam** - Spam messages (use alone, no other tags needed)

### 🤖 System Tags
- **ai-drafts** - Automatically added by HelpScout's native AI system

## Usage Examples

### Example 1: Clear Issue
**Ticket:** "I can't log into my account on the iPhone app"
**Tag:** `account-login/login-issue`

### Example 2: Unclear Category
**Ticket:** "Having problems with my account"
**Tag:** `account-login` (parent only, since specific issue unclear)

### Example 3: Standalone Category
**Ticket:** "When is the next Rookie Guide coming out?"
**Tag:** `rookie-guide`

### Example 4: With Sentiment
**Ticket:** "This is ridiculous! I paid yesterday and still can't access anything!"
**Tags:** `account-login/payment-sync` + `angry-customer`

### Example 5: Platform Specific
**Ticket:** "My ESPN league isn't updating"
**Tag:** `league-sync/espn`

### Example 6: Unknown Platform
**Ticket:** "My league isn't syncing properly"
**Tag:** `league-sync` (parent only, platform unknown)

## Decision Tree

1. **Is it spam?** → Tag `spam` only
2. **Is it a standalone category?** → Use standalone major tag
3. **Can you identify the specific detail?** → Use child tag
4. **Detail unclear?** → Use parent tag only
5. **Is customer angry or urgent?** → Add sentiment tag

## Tag Hierarchy Summary

```
Total Tags: 47
├── Standalone Major Tags: 7
├── Parent/Child Groups: 10 groups
│   ├── account-login (6 children)
│   ├── drafts (2 children)
│   ├── feature-request (3 children)
│   ├── general-misc (2 children)
│   ├── league-sync (7 children)
│   ├── misc-bug (2 children)
│   ├── players-rookies (3 children)
│   ├── promotions (2 children)
│   └── refund-cancel (2 children)
├── Special Tags: 3
└── System Tags: 1
```

## Notes for Support Team

- **Never use both** parent and child tags on the same ticket
- **Always prefer** the most specific (child) tag when possible
- **Report missing categories** if you find patterns not covered
- **Update this document** when new tags are added
- **Check tag analytics** monthly to identify new patterns

---

*Last Updated: August 2025*
*Version: 2.0 - Hierarchical System*