# Stage A API Contracts Specification

## Overview

This document provides the authoritative, exhaustive endpoint contracts for the **My Travelroad** REST API (Stage A). All request schemas, response envelopes, path/query parameters, validation rules, and error conditions are documented with realistic JSON payloads.

All endpoints adhere to the `/api/v1` base URI and standard JSON response envelope defined in [`api-architecture.md`](./api-architecture.md).

---

## Table of Contents
1. [Module A: Authentication (`/api/v1/auth`)](#module-a-authentication)
2. [Module B: Tourist Profiles (`/api/v1/profiles`)](#module-b-tourist-profiles)
3. [Module C: Destination Categories (`/api/v1/categories`)](#module-c-destination-categories)
4. [Module D: Destinations (`/api/v1/destinations`)](#module-d-destinations)
5. [Module E: Saved Destinations (`/api/v1/saved-destinations`)](#module-e-saved-destinations)
6. [Module F: Administration (`/api/v1/admin`)](#module-f-administration)
7. [Module G: Destination Verification (`/api/v1/admin/verification`)](#module-g-destination-verification)

---

## Module A: Authentication

### 1. Register Tourist Account
- **Endpoint**: `POST /api/v1/auth/register`
- **Purpose**: Creates a new individual tourist identity (`Account`) and associated profile (`TouristProfile`).
- **Authentication**: None (Public).
- **Permissions**: None.
- **Rate Limit**: 5 requests / min per IP.
- **Validation Rules**:
  - `email`: RFC 5322 compliant, max 255 chars, lowercase.
  - `password`: Min 8 chars, max 72 chars (Argon2id limit), must include 1 uppercase, 1 lowercase, 1 digit.
  - `displayName`: 2 to 120 chars, trimmed.
  - `handle`: 3 to 50 chars, regex `^[a-z0-9_]+$`.
- **Request Body**:
```json
{
  "email": "amina.rahman@example.com",
  "password": "Password123!",
  "displayName": "Amina Rahman",
  "handle": "amina_explorer",
  "preferredLanguage": "en"
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
      "email": "amina.rahman@example.com",
      "role": "traveler",
      "status": "pending_verification",
      "emailVerified": false,
      "createdAt": "2026-11-15T15:00:00.000Z"
    },
    "profile": {
      "id": "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
      "displayName": "Amina Rahman",
      "handle": "amina_explorer",
      "preferredLanguage": "en",
      "travelPreferences": [],
      "isPublic": true
    }
  }
}
```
- **Error Responses**:
  - `409 Conflict`: `DUPLICATE_RESOURCE` (Email or handle already registered).
  - `422 Unprocessable Entity`: `VALIDATION_FAILED` (Password too weak or invalid handle).

---

### 2. Login Account
- **Endpoint**: `POST /api/v1/auth/login`
- **Purpose**: Authenticates credentials, returns short-lived JWT access token, and sets rotating HttpOnly refresh cookie.
- **Authentication**: None (Public).
- **Permissions**: None. Rejects accounts with `type = 'system'`. Accounts with `status = 'pending_verification'` receive a scoped access token with `emailVerified: false`.
- **Rate Limit**: 5 requests / min per IP.
- **Request Body**:
```json
{
  "email": "amina.rahman@example.com",
  "password": "Password123!"
}
```
- **Successful Response (`200 OK`)**:
  - **Headers**: `Set-Cookie: refreshToken=rt_01JB8...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 900,
    "account": {
      "id": "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
      "email": "amina.rahman@example.com",
      "role": "traveler",
      "status": "active"
    }
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: `INVALID_CREDENTIALS` (Incorrect email or password).
  - `403 Forbidden`: `ACCOUNT_SUSPENDED` (Account temporarily suspended by administration).
  - `403 Forbidden`: `ACCOUNT_DEACTIVATED` (Account permanently deactivated).
  - `423 Locked`: `ACCOUNT_LOCKED` (Too many failed attempts; account locked until `lockedUntil`).

---

### 3. Logout Account
- **Endpoint**: `POST /api/v1/auth/logout`
- **Purpose**: Revokes the active refresh token session in Redis and clears session cookies.
- **Authentication**: Bearer Access Token or valid Refresh Cookie.
- **Request Headers**: `X-Requested-With: XMLHttpRequest` (Mandatory anti-CSRF header when invoking with cookies).
- **Permissions**: Authenticated user.
- **Successful Response (`200 OK`)**:
  - **Headers**: `Set-Cookie: refreshToken=; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
```json
{
  "success": true,
  "data": {
    "message": "Successfully logged out and session revoked."
  }
}
```

---

### 4. Refresh Session Token
- **Endpoint**: `POST /api/v1/auth/refresh`
- **Purpose**: Rotates the refresh token and issues a new 15-minute access token. Replay of revoked tokens invalidates entire token family in Redis.
- **Authentication**: HttpOnly `refreshToken` cookie.
- **Request Headers**: `X-Requested-With: XMLHttpRequest` (Mandatory anti-CSRF header).
- **Permissions**: Valid refresh token holder.
- **Successful Response (`200 OK`)**:
  - **Headers**: `Set-Cookie: refreshToken=rt_new...; Path=/api/v1/auth; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000`
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `BAD_REQUEST` (Missing mandatory `X-Requested-With: XMLHttpRequest` header).
  - `401 Unauthorized`: `TOKEN_INVALID` or `TOKEN_EXPIRED`.
  - `403 Forbidden`: `ACCOUNT_SUSPENDED` (Account suspended; refresh session revoked).
  - `403 Forbidden`: `ACCOUNT_DEACTIVATED` (Account deactivated).

---

### 5. Current Authenticated Identity
- **Endpoint**: `GET /api/v1/auth/me`
- **Purpose**: Returns the account metadata and profile summary for the current caller.
- **Authentication**: Bearer Access Token.
- **Permissions**: Authenticated user.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "account": {
      "id": "e7b0a880-922c-47b2-9a57-0b1a78e7f101",
      "email": "amina.rahman@example.com",
      "role": "traveler",
      "status": "active",
      "emailVerified": true,
      "createdAt": "2026-11-15T15:00:00.000Z"
    },
    "profile": {
      "id": "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
      "displayName": "Amina Rahman",
      "handle": "amina_explorer",
      "avatarUrl": "https://assets.mytravelroad.com/avatars/amina.jpg"
    }
  }
}
```

---

### 6. Verify Email
- **Endpoint**: `POST /api/v1/auth/verify-email`
- **Purpose**: Verifies an email address using an ephemeral confirmation token. Consumed atomically from Redis store (`email_verification:{tokenHash}`).
- **Authentication**: None.
- **Token Specifications**: 256-bit CSPRNG token stored as SHA-256 hash with 24-hour TTL.
- **Request Body**:
```json
{
  "token": "emv_01JB89Z8H1K4V9Z0P9R8E7W6T2"
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "Email address successfully verified."
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `TOKEN_INVALID` or `TOKEN_EXPIRED` (Token unknown, expired, or previously consumed).

---

### 7. Forgot Password
- **Endpoint**: `POST /api/v1/auth/forgot-password`
- **Purpose**: Dispatches a password reset email containing a single-use 15-minute token if the account exists.
- **Token Specifications**: 256-bit CSPRNG token stored as SHA-256 hash in Redis (`password_reset:{tokenHash}`, TTL: 900s).
- **Rate Limit**: 5 requests / min per IP. Anti-enumeration design (always returns 200).
- **Request Body**:
```json
{
  "email": "amina.rahman@example.com"
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "If the email is registered, a password reset link has been dispatched."
  }
}
```

---

### 8. Reset Password
- **Endpoint**: `POST /api/v1/auth/reset-password`
- **Purpose**: Consumes a valid password reset token atomically, sets a new Argon2id password hash, and revokes all active refresh sessions across all devices for the account.
- **Request Body**:
```json
{
  "token": "pwr_01JB89Z8H1K4V9Z0P9R8E7W6T2",
  "newPassword": "NewSecurePassword456!"
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "message": "Password successfully reset. Please log in with your new credentials."
  }
}
```
- **Error Responses**:
  - `400 Bad Request`: `TOKEN_INVALID` or `TOKEN_EXPIRED` (Token invalid or expired).
  - `422 Unprocessable Entity`: `VALIDATION_FAILED` (Password fails complexity criteria).

---

## Module B: Tourist Profiles

### 9. Get Own Profile
- **Endpoint**: `GET /api/v1/profiles/me`
- **Purpose**: Retrieves full profile for the authenticated traveler, including travel preferences and privacy settings.
- **Authentication**: Bearer Access Token.
- **Permissions**: Authenticated user (`traveler` or higher).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
    "displayName": "Amina Rahman",
    "handle": "amina_explorer",
    "avatarUrl": "https://assets.mytravelroad.com/avatars/amina.jpg",
    "bio": "Wildlife photographer and heritage explorer based in Malappuram.",
    "homeRegion": "Malappuram, Kerala",
    "preferredLanguage": "en",
    "travelPreferences": [
      "ecotourism_nature",
      "waterfalls_trekking",
      "photography"
    ],
    "isPublic": true,
    "createdAt": "2026-11-15T15:00:00.000Z",
    "updatedAt": "2026-11-15T15:30:00.000Z"
  }
}
```

---

### 10. Update Own Profile
- **Endpoint**: `PATCH /api/v1/profiles/me`
- **Purpose**: Modifies user-facing profile attributes.
- **Authentication**: Bearer Access Token.
- **Request Body**:
```json
{
  "displayName": "Amina R.",
  "bio": "Updated bio exploring Nilambur teak trails.",
  "travelPreferences": ["ecotourism_nature", "cultural_heritage", "photography"]
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "f8c1b991-033d-58c3-ab68-1c2b89f8a202",
    "displayName": "Amina R.",
    "handle": "amina_explorer",
    "bio": "Updated bio exploring Nilambur teak trails.",
    "travelPreferences": ["ecotourism_nature", "cultural_heritage", "photography"],
    "updatedAt": "2026-11-15T15:45:00.000Z"
  }
}
```

---

### 11. Update Profile Visibility
- **Endpoint**: `PATCH /api/v1/profiles/me/visibility`
- **Purpose**: Sets whether profile is discoverable publicly.
- **Request Body**:
```json
{
  "isPublic": false
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "isPublic": false,
    "updatedAt": "2026-11-15T15:50:00.000Z"
  }
}
```

---

### 12. View Public Profile
- **Endpoint**: `GET /api/v1/profiles/:handle`
- **Purpose**: Retrieves public traveler profile by handle.
- **Authentication**: None.
- **Path Parameters**: `handle`: Unique handle (e.g., `amina_explorer`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "displayName": "Amina Rahman",
    "handle": "amina_explorer",
    "avatarUrl": "https://assets.mytravelroad.com/avatars/amina.jpg",
    "bio": "Wildlife photographer and heritage explorer based in Malappuram.",
    "homeRegion": "Malappuram, Kerala",
    "travelPreferences": ["ecotourism_nature", "photography"],
    "createdAt": "2026-11-15T15:00:00.000Z"
  }
}
```
- **Error Response**: `404 Not Found` if handle does not exist or `isPublic = false`.

---

## Module C: Destination Categories

### 13. List Categories
- **Endpoint**: `GET /api/v1/categories`
- **Purpose**: Lists all active categories in display order.
- **Query Parameters**:
  - `tree`: Optional boolean (`true` returns nested hierarchy; default: `false`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "11111111-1111-4000-a000-000000000001",
      "slug": "nature-forests",
      "name": "Nature & Forests",
      "shortLabel": "Forests",
      "description": "Evergreen forest reserves, teak plantations, and eco-tourism trails.",
      "iconKey": "forest",
      "parentId": null,
      "displayOrder": 1,
      "status": "active"
    },
    {
      "id": "11111111-1111-4000-a000-000000000002",
      "slug": "beaches-estuaries",
      "name": "Beaches & Estuaries",
      "shortLabel": "Beaches",
      "description": "Arabian sea coastlines, river mouths, and mangrove bird sanctuaries.",
      "iconKey": "coast",
      "parentId": null,
      "displayOrder": 2,
      "status": "active"
    }
  ]
}
```

---

### 14. Get Category Details
- **Endpoint**: `GET /api/v1/categories/:slug`
- **Purpose**: Retrieves a specific category and its immediate child subcategories.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4000-a000-000000000001",
    "slug": "nature-forests",
    "name": "Nature & Forests",
    "shortLabel": "Forests",
    "description": "Evergreen forest reserves, teak plantations, and eco-tourism trails.",
    "iconKey": "forest",
    "parentId": null,
    "displayOrder": 1,
    "status": "active",
    "subcategories": []
  }
}
```

---

### 15. List Category Destinations
- **Endpoint**: `GET /api/v1/categories/:slug/destinations`
- **Purpose**: Retrieves paginated published destinations belonging to this category.
- **Query Parameters**: `page` (default 1), `limit` (default 20), `sort` (default `featuredRank:asc`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "slug": "nilambur-teak-reserve",
      "title": "Nilambur Teak Reserve",
      "shortDescription": "Home to the world's oldest teak plantation (Conolly's Plot) and pristine rainforest trails.",
      "district": "Malappuram",
      "coverMedia": {
        "url": "https://assets.mytravelroad.com/destinations/nilambur/cover.jpg",
        "altText": "Lush teak forest canopy at Nilambur"
      },
      "verificationStatus": "verified"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 12,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

---

## Module D: Destinations

### 16. List Published Destinations
- **Endpoint**: `GET /api/v1/destinations`
- **Purpose**: Public discovery listing with district and category filters.
- **Query Parameters**:
  - `category`: Category slug.
  - `district`: Kerala district name (e.g., `Malappuram`, `Wayanad`, `Kozhikode`).
  - `page`: Page number (default 1).
  - `limit`: Items per page (default 20, max 100).
  - `sort`: Sort criteria (e.g., `featuredRank:asc`, `createdAt:desc`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "slug": "nilambur-teak-reserve",
      "title": "Nilambur Teak Reserve",
      "shortDescription": "Home to the world's oldest teak plantation.",
      "district": "Malappuram",
      "talukOrSubdivision": "Nilambur",
      "primaryCategory": {
        "slug": "nature-forests",
        "name": "Nature & Forests"
      },
      "coverMedia": {
        "url": "https://assets.mytravelroad.com/destinations/nilambur/cover.jpg",
        "thumbnailUrl": "https://assets.mytravelroad.com/destinations/nilambur/thumb.jpg",
        "altText": "Nilambur teak canopy"
      },
      "verificationStatus": "verified"
    }
  ],
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "totalItems": 48,
      "totalPages": 3,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

---

### 17. Get Destination by Slug
- **Endpoint**: `GET /api/v1/destinations/:slug`
- **Purpose**: Comprehensive published destination profile.
- **Path Parameters**: `slug`: Destination slug (e.g., `nilambur-teak-reserve`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "slug": "nilambur-teak-reserve",
    "title": "Nilambur Teak Reserve",
    "shortDescription": "Home to the world's oldest teak plantation.",
    "fullDescription": "Detailed historical and botanical storytelling...",
    "primaryCategory": {
      "id": "11111111-1111-4000-a000-000000000001",
      "slug": "nature-forests",
      "name": "Nature & Forests"
    },
    "secondaryCategories": [],
    "locationSummary": {
      "formattedAddress": "Nilambur Forest Range, Malappuram, Kerala 679329",
      "locality": "Nilambur",
      "talukOrSubdivision": "Nilambur",
      "district": "Malappuram",
      "stateOrProvince": "Kerala",
      "countryCode": "IN",
      "isRestricted": false
    },
    "verificationSummary": {
      "overallStatus": "verified",
      "lastAuditedAt": "2026-11-14T10:00:00.000Z"
    },
    "publishedAt": "2026-11-14T00:00:00.000Z"
  }
}
```

---

### 18. Search Destinations
- **Endpoint**: `GET /api/v1/destinations/search`
- **Purpose**: Multi-modal search: text keyword matching, radial geographic proximity, or bounding box window.
- **Query Parameters**:
  - `q`: Text search query.
  - `near`: `longitude,latitude` (e.g., `76.22,11.28`).
  - `radiusKm`: Search radius (default 15, max 100).
  - `bbox`: `minLon,minLat,maxLon,maxLat`.
  - `page`, `limit`.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "slug": "nilambur-teak-reserve",
      "title": "Nilambur Teak Reserve",
      "distanceKm": 4.2,
      "district": "Malappuram",
      "publicCoordinates": [76.2274, 11.2778]
    }
  ],
  "meta": {
    "pagination": { "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
  }
}
```

---

### 19. Retrieve Public Destination Location
- **Endpoint**: `GET /api/v1/destinations/:slug/location`
- **Purpose**: Returns geographic location strictly projected through the 3-Tier Coordinate Privacy model.
- **Privacy Enforcement**:
  - Tier 0 (Unrestricted): Returns exact coordinates.
  - Tier 1/2 (Restricted with Centroid): Returns approximate centroid coordinate and masked display locality.
  - Tier 3 (Restricted Suppressed): Returns `publicCoordinates: null`. Raw coordinates are NEVER exposed.
- **Successful Response (Tier 1/2 Restricted Destination Example)**:
```json
{
  "success": true,
  "data": {
    "destinationId": "550e8400-e29b-41d4-a716-446655440002",
    "isRestricted": true,
    "restrictionReason": "wildlife_protection",
    "publicCoordinates": [76.2000, 11.2500],
    "publicLocalityName": "Nilambur North Forest Range Office",
    "talukOrSubdivision": "Nilambur",
    "district": "Malappuram",
    "stateOrProvince": "Kerala",
    "countryCode": "IN",
    "nearestTransitHub": {
      "type": "railway_station",
      "name": "Nilambur Road Railway Station",
      "distanceKm": 8.5
    }
  }
}
```

---

### 20. Retrieve Destination Media Gallery
- **Endpoint**: `GET /api/v1/destinations/:slug/media`
- **Purpose**: Returns approved media assets in display sequence order.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "media-uuid-1",
      "type": "image",
      "url": "https://assets.mytravelroad.com/destinations/nilambur/1.jpg",
      "thumbnailUrl": "https://assets.mytravelroad.com/destinations/nilambur/1_thumb.jpg",
      "altText": "Conolly's Plot ancient teak grove",
      "caption": "World's oldest planted teak trees, planted in the 1840s.",
      "attribution": "DTPC Malappuram / Kerala Tourism",
      "license": "official_department_press",
      "isCover": true,
      "displayOrder": 1
    }
  ]
}
```

---

### 21. Retrieve Destination Opening Hours & Fees
- **Endpoint**: `GET /api/v1/destinations/:slug/opening-hours`
- **Purpose**: Operating schedules, season advisories, and admission fee structure.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "type": "scheduled",
    "weeklySchedule": [
      { "dayOfWeek": 1, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 2, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 3, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 4, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 5, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 6, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
      { "dayOfWeek": 0, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" }
    ],
    "seasonalNotes": "Open throughout the year. Forest trails may close during heavy monsoon red alerts.",
    "entryFeePolicy": "paid",
    "feeStructure": {
      "currency": "INR",
      "isFree": false,
      "adultFee": 50,
      "childFee": 25,
      "foreignNationalFee": 150,
      "stillCameraFee": 50,
      "specialPermitRequired": false
    },
    "advisoryNote": "Last entry permitted at 16:15."
  }
}
```

---

## Module E: Saved Destinations

### 22. List Saved Destinations
- **Endpoint**: `GET /api/v1/saved-destinations`
- **Purpose**: Retrieves the authenticated traveler's bookmarked destinations.
- **Authentication**: Bearer Access Token.
- **Query Parameters**: `collectionName`, `page`, `limit`.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "saved-uuid-001",
      "destinationId": "550e8400-e29b-41d4-a716-446655440001",
      "collectionName": "Monsoon 2027",
      "personalNotes": "Visit early morning for forest mist photography.",
      "savedAt": "2026-11-15T15:00:00.000Z",
      "destination": {
        "slug": "nilambur-teak-reserve",
        "title": "Nilambur Teak Reserve",
        "district": "Malappuram",
        "coverUrl": "https://assets.mytravelroad.com/destinations/nilambur/thumb.jpg"
      }
    }
  ],
  "meta": { "pagination": { "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false } }
}
```

---

### 23. Save Destination (Bookmark)
- **Endpoint**: `POST /api/v1/saved-destinations`
- **Purpose**: Bookmarks a destination. Enforces unique constraint per account/destination.
- **Authentication**: Bearer Access Token.
- **Request Body**:
```json
{
  "destinationId": "550e8400-e29b-41d4-a716-446655440001",
  "collectionName": "Monsoon 2027",
  "personalNotes": "Visit early morning for forest mist photography."
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "saved-uuid-001",
    "destinationId": "550e8400-e29b-41d4-a716-446655440001",
    "collectionName": "Monsoon 2027",
    "savedAt": "2026-11-15T15:00:00.000Z"
  }
}
```
- **Error Response**: `409 Conflict` if already saved by this account (`DUPLICATE_RESOURCE`).

---

### 24. Remove Saved Destination
- **Endpoint**: `DELETE /api/v1/saved-destinations/:destinationId`
- **Purpose**: Removes a bookmarked destination from the traveler's wishlist.
- **Authentication**: Bearer Access Token.
- **Successful Response (`204 No Content`)**:
  - Empty body.

---

## Module F: Administration

### 25. Admin Dashboard Summary
- **Endpoint**: `GET /api/v1/admin/dashboard`
- **Purpose**: Aggregated operational counts for administrators and curators.
- **Authentication**: Bearer Access Token (`curator`, `moderator`, `super_admin`).
- **Role Scoping & Boundary**:
  - `super_admin`: Receives complete platform-wide telemetry, including accounts overview, destination counts, and queues.
  - `moderator`: Scoped strictly to safety and moderation metrics (`mediaModeration`, reported items, user flags).
  - `curator`: Scoped strictly to content and verification pipelines (`destinations`, `verificationQueue`, `mediaModeration`).
  - **Data Privacy Guarantee**: Metrics aggregate statistical counters only. Dashboard payloads **never expose personal data, evidence documents, or raw coordinates**.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "destinations": {
      "total": 64,
      "published": 48,
      "draft": 12,
      "inReview": 4
    },
    "verificationQueue": {
      "pendingReview": 14,
      "needsUpdate": 3,
      "unassigned": 6
    },
    "mediaModeration": {
      "pendingReview": 22
    },
    "categories": {
      "total": 10,
      "active": 9
    }
  }
}
```

---

### 26. List Destinations (Admin View)
- **Endpoint**: `GET /api/v1/admin/destinations`
- **Purpose**: Lists destinations with any publication status (`draft`, `in_review`, `published`, `archived`).
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Query Parameters**: `status`, `district`, `categoryId`, `page`, `limit`.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "slug": "nilambur-teak-reserve",
      "title": "Nilambur Teak Reserve",
      "publicationStatus": "published",
      "featuredRank": 1,
      "verificationOverallStatus": "verified",
      "createdAt": "2026-11-14T00:00:00.000Z",
      "updatedAt": "2026-11-15T10:00:00.000Z"
    }
  ],
  "meta": { "pagination": { "page": 1, "limit": 20, "totalItems": 64, "totalPages": 4, "hasNextPage": true, "hasPrevPage": false } }
}
```

---

### 27. Create Destination Draft
- **Endpoint**: `POST /api/v1/admin/destinations`
- **Purpose**: Creates an initial destination draft with location and taxonomy. Produces an `AuditLog` entry.
- **Authentication**: Bearer Access Token (`contributor`, `curator`, `super_admin`).
- **Request Body**:
```json
{
  "title": "Adyanpara Cascades",
  "slug": "adyanpara-cascades",
  "shortDescription": "A picturesque cascade nestled in the Kurmbalangod village forest.",
  "fullDescription": "Comprehensive description of Adyanpara waterfalls...",
  "primaryCategoryId": "11111111-1111-4000-a000-000000000001",
  "location": {
    "coordinates": [76.3125, 11.3412],
    "formattedAddress": "Kurmbalangod Village, Nilambur Taluk, Malappuram 679334",
    "locality": "Kurmbalangod",
    "talukOrSubdivision": "Nilambur",
    "district": "Malappuram",
    "stateOrProvince": "Kerala",
    "countryCode": "IN",
    "isRestricted": false
  }
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "slug": "adyanpara-cascades",
    "title": "Adyanpara Cascades",
    "publicationStatus": "draft",
    "createdAt": "2026-11-15T15:00:00.000Z"
  }
}
```

---

### 28. Get Privileged Destination Details
- **Endpoint**: `GET /api/v1/admin/destinations/:id`
- **Purpose**: Complete administrative entity representation including unmasked exact coordinates, altitude, accuracy, and ecological restriction parameters. Restricted to curator and super_admin for spatial verification. Produces an `AuditLog` telemetry entry (`action: 'destination.privileged_location_read'`).
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Permissions**: Curator or Super Admin.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "slug": "adyanpara-cascades",
    "title": "Adyanpara Cascades",
    "shortDescription": "A picturesque cascade nestled in the Kurmbalangod village forest.",
    "fullDescription": "Comprehensive description of Adyanpara waterfalls...",
    "publicationStatus": "draft",
    "featuredRank": null,
    "primaryCategory": {
      "id": "11111111-1111-4000-a000-000000000001",
      "slug": "nature-wildlife",
      "name": "Nature & Wildlife"
    },
    "secondaryCategories": [],
    "location": {
      "destinationId": "550e8400-e29b-41d4-a716-446655440003",
      "coordinates": [76.3125, 11.3412],
      "altitudeMeters": 140.0,
      "accuracyMeters": 4.5,
      "formattedAddress": "Kurmbalangod Village, Nilambur Taluk, Malappuram 679334",
      "locality": "Kurmbalangod",
      "talukOrSubdivision": "Nilambur",
      "district": "Malappuram",
      "stateOrProvince": "Kerala",
      "countryCode": "IN",
      "postalCode": "679334",
      "isRestricted": true,
      "restrictionReason": "Adjacent to ecologically fragile forest buffer zone",
      "publicCentroidCoordinates": [76.3200, 11.3500],
      "publicApproximateDisplayName": "Kurmbalangod Forest Range Office Checkpoint",
      "maskLocality": true
    },
    "openingHours": null,
    "media": [],
    "verificationSummary": {
      "overallStatus": "unverified",
      "lastAuditedAt": null,
      "nextAuditDueAt": null
    },
    "createdAt": "2026-11-15T15:00:00.000Z",
    "updatedAt": "2026-11-15T15:00:00.000Z"
  }
}
```
- **Error Responses**:
  - `401 Unauthorized`: `AUTHENTICATION_REQUIRED`.
  - `403 Forbidden`: `FORBIDDEN_ACCESS` (Traveler and Contributor tiers cannot view privileged coordinates).
  - `404 Not Found`: `RESOURCE_NOT_FOUND`.

---

### 29. Update Destination Fields
- **Endpoint**: `PATCH /api/v1/admin/destinations/:id`
- **Purpose**: Updates editorial fields, location, or secondary categories. Produces an `AuditLog` entry.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "shortDescription": "Updated summary of Adyanpara cascade trails.",
  "featuredRank": 5
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "shortDescription": "Updated summary of Adyanpara cascade trails.",
    "featuredRank": 5,
    "updatedAt": "2026-11-15T15:30:00.000Z"
  }
}
```

---

### 30. Publish Destination
- **Endpoint**: `POST /api/v1/admin/destinations/:id/publish`
- **Purpose**: Elevates destination lifecycle status to `published`. Produces an `AuditLog` entry (`action: 'destination.publish'`).
- **Authentication**: Bearer Access Token (`super_admin` only).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "publicationStatus": "published",
    "publishedAt": "2026-11-15T15:35:00.000Z"
  }
}
```

---

### 31. Archive Destination
- **Endpoint**: `POST /api/v1/admin/destinations/:id/archive`
- **Purpose**: Transitions a destination to `archived` status, unpublishing it from public views. Produces an `AuditLog` entry.
- **Authentication**: Bearer Access Token (`super_admin` only).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440003",
    "publicationStatus": "archived",
    "updatedAt": "2026-11-15T15:40:00.000Z"
  }
}
```

---

### 32. Create Destination Category
- **Endpoint**: `POST /api/v1/admin/categories`
- **Purpose**: Defines a new taxonomy classification. Produces an `AuditLog` entry.
- **Authentication**: Bearer Access Token (`super_admin` only).
- **Request Body**:
```json
{
  "name": "Cultural Heritage",
  "slug": "cultural-heritage",
  "shortLabel": "Heritage",
  "description": "Historic monuments, palaces, and ancient temple complexes.",
  "iconKey": "landmark",
  "parentId": null,
  "displayOrder": 3
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4000-a000-000000000003",
    "slug": "cultural-heritage",
    "name": "Cultural Heritage",
    "status": "active"
  }
}
```

---

### 33. Update Destination Category
- **Endpoint**: `PATCH /api/v1/admin/categories/:id`
- **Purpose**: Modifies taxonomy category attributes. Produces an `AuditLog` entry.
- **Authentication**: Bearer Access Token (`super_admin` only).
- **Request Body**:
```json
{
  "displayOrder": 4,
  "status": "active"
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4000-a000-000000000003",
    "displayOrder": 4,
    "status": "active",
    "updatedAt": "2026-11-15T15:45:00.000Z"
  }
}
```

---

### 34. Attach Destination Media Asset
- **Endpoint**: `POST /api/v1/admin/destinations/:id/media`
- **Purpose**: Associates a previously uploaded media asset with a destination's gallery.
- **Upload Workflow**: Clients upload binary files directly to cloud object storage (S3/R2) via pre-signed URLs. The backend accepts pre-validated asset URLs, preventing server SSRF or high memory buffering.
- **Validation Rules**:
  - `url` & `thumbnailUrl`: Must match approved CDN domain (`^https://assets\.mytravelroad\.com/.*$`).
  - Allowed MIME: `image/jpeg`, `image/png`, `image/webp`. File size ceiling: 10MB.
- **Authentication**: Bearer Access Token (`contributor`, `curator`, `super_admin`).
- **Request Body**:
```json
{
  "type": "image",
  "url": "https://assets.mytravelroad.com/destinations/adyanpara/waterfall.jpg",
  "thumbnailUrl": "https://assets.mytravelroad.com/destinations/adyanpara/waterfall_thumb.jpg",
  "altText": "Adyanpara waterfalls cascading down rocky hillside",
  "caption": "Cascading waterfall during peak post-monsoon volume.",
  "attribution": "DTPC Malappuram",
  "license": "cc_by",
  "isCover": true,
  "displayOrder": 1
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "media-uuid-002",
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "status": "approved",
    "isCover": true,
    "createdAt": "2026-11-15T15:50:00.000Z"
  }
}
```

---

### 35. Update Media Asset
- **Endpoint**: `PATCH /api/v1/admin/media/:id`
- **Purpose**: Reorders media, changes cover status, or moderates review status.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "status": "approved",
  "isCover": false,
  "displayOrder": 2
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "media-uuid-002",
    "status": "approved",
    "isCover": false,
    "displayOrder": 2
  }
}
```

---

### 36. Delete Media Asset
- **Endpoint**: `DELETE /api/v1/admin/media/:id`
- **Purpose**: Removes a media asset from the destination gallery.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Successful Response (`204 No Content`)**:
  - Empty body.

---

### 37. Configure Destination Opening Hours & Fees
- **Endpoint**: `PUT /api/v1/admin/destinations/:id/opening-hours`
- **Purpose**: Creates or replaces destination operating schedules and tariffs. Produces an atomic `AuditLog` entry (`action: 'destination.opening_hours_update'`) committed within the same database transaction.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "type": "scheduled",
  "weeklySchedule": [
    { "dayOfWeek": 1, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 2, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 3, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 4, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 5, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 6, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" },
    { "dayOfWeek": 0, "isClosed": false, "openTime": "09:00", "closeTime": "17:00" }
  ],
  "seasonalNotes": "Closed during severe flood warnings.",
  "entryFeePolicy": "paid",
  "feeStructure": {
    "currency": "INR",
    "isFree": false,
    "adultFee": 25,
    "childFee": 10
  },
  "advisoryNote": "Wear anti-slip footwear on rocky waterfall paths."
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "type": "scheduled",
    "entryFeePolicy": "paid",
    "updatedAt": "2026-11-15T15:55:00.000Z"
  }
}
```

---

## Module G: Destination Verification

### 38. List Verification Queue
- **Endpoint**: `GET /api/v1/admin/verification/queue`
- **Purpose**: Triage queue of destinations awaiting initial verification or periodic re-audit.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Query Parameters**: `status`, `assignedCuratorId`, `auditDue` (boolean), `page`, `limit`.
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "verificationId": "verif-uuid-001",
      "destinationId": "550e8400-e29b-41d4-a716-446655440003",
      "destinationTitle": "Adyanpara Cascades",
      "overallStatus": "in_review",
      "assignedCuratorId": "curator-uuid-001",
      "lastAuditedAt": null,
      "nextAuditDueAt": "2026-12-01T00:00:00.000Z",
      "curatorQueueNotes": "Pending official Forest Department monsoon timing circular."
    }
  ],
  "meta": { "pagination": { "page": 1, "limit": 20, "totalItems": 14, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false } }
}
```

---

### 39. Retrieve Verification Details
- **Endpoint**: `GET /api/v1/admin/verification/:destinationId`
- **Purpose**: Complete fact-level verification container, field-level status map, attached evidence, and history.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "id": "verif-uuid-001",
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "overallStatus": "in_review",
    "assignedCuratorId": "curator-uuid-001",
    "fieldStatuses": {
      "location_coordinates": "verified",
      "opening_hours": "in_review",
      "entry_fees": "unverified",
      "safety_advisories": "verified"
    },
    "evidence": [
      {
        "id": "evid-uuid-001",
        "evidenceType": "on_site_gps_track",
        "documentUrl": "https://assets.mytravelroad.com/evidence/adyanpara_gps.gpx",
        "sourceOrganization": "DTPC Malappuram Field Survey",
        "submittedAt": "2026-11-15T12:00:00.000Z"
      }
    ]
  }
}
```

---

### 40. Assign Curator
- **Endpoint**: `POST /api/v1/admin/verification/:destinationId/assign`
- **Purpose**: Assigns or reassigns an editorial curator to a destination's verification audit.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "curatorAccountId": "curator-uuid-001",
  "queueNotes": "Assigned to regional Malappuram field auditor."
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "assignedCuratorId": "curator-uuid-001",
    "curatorQueueNotes": "Assigned to regional Malappuram field auditor.",
    "updatedAt": "2026-11-15T16:00:00.000Z"
  }
}
```

---

### 41. Submit Verification Evidence
- **Endpoint**: `POST /api/v1/admin/verification/:destinationId/evidence`
- **Purpose**: Attaches documentary proof (gazette circular, field survey, photo) substantiating a fact.
- **Confidentiality & Security**: Evidence documents are internal, confidential to `curator` and `super_admin`, and never exposed on public endpoints. Uploads are direct-to-S3/R2 with domain whitelisting (`https://assets.mytravelroad.com/...`). Allowed MIME: `image/*`, `application/pdf`. Max size: 25MB.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "evidenceType": "government_gazette",
  "sourceOrganization": "Kerala Forest & Wildlife Department",
  "officialReferenceCode": "GO(Rt)No.412/2026/F&WLD",
  "documentUrl": "https://assets.mytravelroad.com/evidence/go_412_2026.pdf",
  "notes": "Official gazette notification confirming ecotourism visiting hours and monsoon advisory."
}
```
- **Successful Response (`201 Created`)**:
```json
{
  "success": true,
  "data": {
    "id": "evid-uuid-002",
    "verificationId": "verif-uuid-001",
    "evidenceType": "government_gazette",
    "sourceOrganization": "Kerala Forest & Wildlife Department",
    "submittedAt": "2026-11-15T16:05:00.000Z"
  }
}
```

---

### 42. Verify Individual Destination Field
- **Endpoint**: `POST /api/v1/admin/verification/:destinationId/verify-field`
- **Purpose**: Certifies a specific fact field as verified based on supporting evidence. Generates a `VerificationRecord` and updates aggregate field statuses.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "field": "opening_hours",
  "confidenceLevel": "official_authority",
  "evidenceId": "evid-uuid-002",
  "notes": "Verified against Kerala Forest Department circular GO(Rt)No.412/2026.",
  "validUntil": "2027-11-15T00:00:00.000Z"
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "recordId": "rec-uuid-001",
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "field": "opening_hours",
    "status": "verified",
    "confidenceLevel": "official_authority",
    "verifiedBy": "curator-uuid-001",
    "timestamp": "2026-11-15T16:10:00.000Z",
    "validUntil": "2027-11-15T00:00:00.000Z"
  }
}
```

---

### 43. Dispute or Request Field Update
- **Endpoint**: `POST /api/v1/admin/verification/:destinationId/dispute-field`
- **Purpose**: Flags an existing fact as outdated or disputed, scheduling it for curator review.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Request Body**:
```json
{
  "field": "entry_fees",
  "notes": "Reports indicate DTPC revised ticket fees from Rs 25 to Rs 40."
}
```
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": {
    "recordId": "rec-uuid-002",
    "destinationId": "550e8400-e29b-41d4-a716-446655440003",
    "field": "entry_fees",
    "status": "needs_update",
    "timestamp": "2026-11-15T16:15:00.000Z"
  }
}
```

---

### 44. Retrieve Verification History
- **Endpoint**: `GET /api/v1/admin/verification/:destinationId/history`
- **Purpose**: Retrieves the complete immutable historical audit trail of all field verification records for a destination.
- **Authentication**: Bearer Access Token (`curator`, `super_admin`).
- **Successful Response (`200 OK`)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "rec-uuid-001",
      "field": "opening_hours",
      "status": "verified",
      "confidenceLevel": "official_authority",
      "verifiedBy": "curator-uuid-001",
      "notes": "Verified against Kerala Forest Department circular GO(Rt)No.412/2026.",
      "timestamp": "2026-11-15T16:10:00.000Z",
      "validUntil": "2027-11-15T00:00:00.000Z"
    },
    {
      "id": "rec-uuid-002",
      "field": "entry_fees",
      "status": "needs_update",
      "confidenceLevel": "documentary_cross_reference",
      "verifiedBy": "curator-uuid-001",
      "notes": "Reports indicate DTPC revised ticket fees from Rs 25 to Rs 40.",
      "timestamp": "2026-11-15T16:15:00.000Z",
      "validUntil": null
    }
  ]
}
```
