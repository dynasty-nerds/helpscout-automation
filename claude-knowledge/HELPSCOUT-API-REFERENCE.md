# HelpScout API Reference

## Internal Reference Document

This document provides quick reference links to HelpScout's API documentation for maintaining and extending this automation system.

## 📚 HelpScout Docs API

**Base Documentation**: https://developer.helpscout.com/docs-api/

### Key Endpoints We Use

#### 1. Get All Collections
- **Endpoint**: `GET /v1/collections`
- **Purpose**: Retrieve all documentation collections
- **Docs**: https://developer.helpscout.com/docs-api/collections/list/

#### 2. Get Articles in Collection
- **Endpoint**: `GET /v1/collections/{id}/articles`
- **Purpose**: Get all articles in a specific collection
- **Docs**: https://developer.helpscout.com/docs-api/articles/list/

#### 3. Get Single Article
- **Endpoint**: `GET /v1/articles/{id}`
- **Purpose**: Retrieve full content of a specific article
- **Docs**: https://developer.helpscout.com/docs-api/articles/get/

#### 4. Search Articles
- **Endpoint**: `GET /v1/search/articles`
- **Purpose**: Search for articles by query
- **Docs**: https://developer.helpscout.com/docs-api/search/

### Authentication
- **Method**: API Key in Basic Auth
- **Header**: `Authorization: Basic {base64(apiKey:X)}`
- **Key Location**: HelpScout account → Manage → API Keys

### Rate Limits
- **Limit**: 400 requests per minute
- **Headers**: Check `X-RateLimit-*` headers in responses

### Our Implementation
- **File**: `/lib/helpscout-docs.ts`
- **Key Methods**:
  - `getCachedArticles()` - Fetches and caches all articles
  - `findRelevantArticles()` - Searches for relevant content
  - `getArticleById()` - Gets specific article content

## 📧 HelpScout Mailbox API

**Base Documentation**: https://developer.helpscout.com/mailbox-api/

### Key Endpoints We Use

#### 1. List Conversations
- **Endpoint**: `GET /v2/conversations`
- **Purpose**: Get all conversations with filters
- **Docs**: https://developer.helpscout.com/mailbox-api/endpoints/conversations/list/

#### 2. Get Conversation
- **Endpoint**: `GET /v2/conversations/{id}`
- **Purpose**: Get single conversation with threads
- **Docs**: https://developer.helpscout.com/mailbox-api/endpoints/conversations/get/

#### 3. Create Thread (Draft/Note)
- **Endpoint**: `POST /v2/conversations/{id}/threads`
- **Purpose**: Add draft replies or notes to conversations
- **Docs**: https://developer.helpscout.com/mailbox-api/endpoints/conversations/threads/create/

#### 4. Update Conversation Tags
- **Endpoint**: `PATCH /v2/conversations/{id}`
- **Purpose**: Add/remove tags from conversations
- **Docs**: https://developer.helpscout.com/mailbox-api/endpoints/conversations/update/

### Authentication (OAuth2)
- **Method**: OAuth2 Bearer Token
- **Flow**: Client Credentials
- **Token Endpoint**: `POST https://api.helpscout.net/v2/oauth2/token`
- **Docs**: https://developer.helpscout.com/mailbox-api/overview/authentication/

### Rate Limits
- **Limit**: 400 requests per minute per app
- **Headers**: `X-RateLimit-Limit`, `X-RateLimit-Remaining`
- **Retry**: Use `Retry-After` header when rate limited

### Webhook Events
- **Docs**: https://developer.helpscout.com/mailbox-api/webhooks/
- **Events We Could Use**:
  - `convo.created` - New conversation created
  - `convo.customer.reply.created` - Customer replied
  - `convo.assigned` - Conversation assigned to agent

### Our Implementation
- **File**: `/lib/helpscout-client.ts`
- **Key Methods**:
  - `getConversations()` - Fetches active conversations
  - `addNote()` - Adds analysis notes
  - `createDraft()` - Creates draft replies
  - `updateTags()` - Manages conversation tags

## 🔍 Important Fields

### Conversation Object
```typescript
{
  id: number
  number: number
  subject: string
  status: 'active' | 'pending' | 'closed' | 'spam'
  primaryCustomer: {
    email: string
    firstName?: string
    lastName?: string
  }
  tags: Array<{ id: number, name: string }>
  _embedded: {
    threads: Array<{
      id: number
      type: 'customer' | 'reply' | 'note'
      body: string
      state: 'draft' | 'published'
      createdBy: { id: number, firstName: string }
    }>
  }
}
```

### Article Object
```typescript
{
  id: string
  name: string  // Title
  text: string  // Full HTML content
  publicUrl: string
  collectionId: string
  status: 'published' | 'draft' | 'notpublished'
  updatedAt: string
  categories?: string[]
}
```

## 🛠️ Development Tips

### Testing API Calls
1. Use the API Explorer: https://developer.helpscout.com/api-explorer/
2. Check rate limit headers in responses
3. Use `?embed=threads` to include conversation threads
4. Filter conversations: `?status=active,pending`

### Error Handling
- **401**: Check OAuth token expiration
- **403**: Verify app permissions
- **404**: Resource not found
- **429**: Rate limit exceeded (check Retry-After)
- **500**: HelpScout server error (retry with backoff)

### Best Practices
1. **Cache tokens**: OAuth tokens valid for 2 hours
2. **Batch requests**: Use embedded resources when possible
3. **Handle pagination**: Use `page` parameter for large result sets
4. **Respect rate limits**: Implement exponential backoff
5. **Log everything**: Track API usage for debugging

## 📝 Useful Queries

### Get Active Tickets
```
GET /v2/conversations?status=active,pending&embed=threads
```

### Search Docs for Topic
```
GET /v1/search/articles?query=refund&collectionId={id}
```

### Get Recent Conversations
```
GET /v2/conversations?sortField=createdAt&sortOrder=desc&page=1
```

### Get Tagged Conversations
```
GET /v2/conversations?tag=high-urgency
```

## 🔗 Additional Resources

- **API Status**: https://status.helpscout.com/
- **API Changelog**: https://developer.helpscout.com/changelog/
- **Support**: https://docs.helpscout.com/
- **Community**: https://community.helpscout.com/

## 📌 Quick Reference URLs

- **Docs API Base**: `https://docsapi.helpscout.net/v1`
- **Mailbox API Base**: `https://api.helpscout.net/v2`
- **OAuth Token**: `https://api.helpscout.net/v2/oauth2/token`
- **Our Docs Collection**: `5f285c7e04286342d763acc4`
- **Fix Changelog Article**: `68919485bb013911a3b209ac`
- **Known Issues Article**: `68919c52816719208b5a1a93`

---

*Last Updated: August 2025*