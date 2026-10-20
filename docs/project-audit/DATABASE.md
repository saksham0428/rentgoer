# Database Documentation — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Source:** `backend/prisma/schema.prisma` (309 lines) **[Verified in source]**  
**Migration History:** 13 sequential SQL migrations from 2026-10-07 to 2026-10-17 **[Verified in source]**  
**Metrics:** **11 Models**, **10 Enums**, **13 Migrations** **[Verified in source]**

---

## 1. Entity Relationship Diagram (Mermaid)

```mermaid
erDiagram
    User {
        String id PK
        String name
        String email UK
        String passwordHash
        Role role
        String phone
        Int tokenVersion
        Boolean isVerified
        DateTime verifiedAt
        String verifiedById FK
        DateTime createdAt
        DateTime updatedAt
    }

    Property {
        String id PK
        String ownerId FK
        String title
        String description
        Float rent
        Float securityDeposit
        String city
        String locality
        String address
        Float latitude
        Float longitude
        Int bedrooms
        Int bathrooms
        PropertyType propertyType
        FurnishedStatus furnishedStatus
        DateTime availableFrom
        Boolean isAvailable
        Boolean isVerified
        DateTime verifiedAt
        String verifiedById FK
        DateTime createdAt
        DateTime updatedAt
    }

    PropertyImage {
        String id PK
        String propertyId FK
        String url
        String publicId
        DateTime createdAt
    }

    Favorite {
        String id PK
        String userId FK
        String propertyId FK
        DateTime createdAt
    }

    RentalRequest {
        String id PK
        String propertyId FK
        String tenantId FK
        String message
        RequestStatus status
        DateTime createdAt
        DateTime updatedAt
    }

    Conversation {
        String id PK
        String rentalRequestId FK
        String propertyId FK
        String tenantId FK
        String ownerId FK
        DateTime createdAt
        DateTime updatedAt
    }

    Message {
        String id PK
        String conversationId FK
        String senderId FK
        String content
        DateTime createdAt
        DateTime updatedAt
        DateTime readAt
    }

    Notification {
        String id PK
        String userId FK
        NotificationType type
        String title
        String message
        Boolean isRead
        DateTime readAt
        String referenceId
        DateTime createdAt
        DateTime updatedAt
    }

    Review {
        String id PK
        String rentalRequestId FK UK
        String propertyId FK
        String tenantId FK
        Int rating
        String title
        String comment
        DateTime createdAt
        DateTime updatedAt
    }

    Report {
        String id PK
        String reporterId FK
        ReportTargetType targetType
        String targetId
        ReportReason reason
        String description
        ReportStatus status
        String moderatorNote
        DateTime createdAt
        DateTime updatedAt
    }

    VerificationRequest {
        String id PK
        VerificationType type
        String ownerId FK
        String propertyId FK
        VerificationStatus status
        DateTime submittedAt
        DateTime reviewedAt
        String reviewedById FK
        String rejectionReason
        DateTime createdAt
        DateTime updatedAt
    }

    User ||--o{ Property : "owns (PropertyOwner)"
    User ||--o{ Favorite : "has"
    User ||--o{ RentalRequest : "makes (TenantRequests)"
    User ||--o{ Conversation : "tenant in (TenantConversations)"
    User ||--o{ Conversation : "owner in (OwnerConversations)"
    User ||--o{ Message : "sends (SentMessages)"
    User ||--o{ Notification : "receives"
    User ||--o{ Review : "writes (TenantReviews)"
    User ||--o{ Report : "files (UserReports)"
    User ||--o{ VerificationRequest : "requests (OwnerVerificationRequests)"
    User ||--o| User : "verified by (AdminVerifiedUsers)"
    Property ||--o{ PropertyImage : "has"
    Property ||--o{ Favorite : "saved as"
    Property ||--o{ RentalRequest : "receives"
    Property ||--o{ Conversation : "has"
    Property ||--o{ Review : "receives"
    Property ||--o{ VerificationRequest : "has"
    RentalRequest ||--o| Conversation : "linked to"
    RentalRequest ||--o| Review : "leads to"
    Conversation ||--o{ Message : "contains"
```

---

## 2. Model Specifications

### 2.1 User
- **Purpose:** Central entity for all platform actors (Tenants, Owners, Admins) **[Verified in source]**.
- **Primary Key:** UUID (`id`) **[Verified in source]**.
- **Unique Constraints:** `email` **[Verified in source]**.
- **Key Security Fields:** `passwordHash` (bcrypt hash), `tokenVersion` (integer counter for session invalidation) **[Verified in source]**.
- **Role Control:** `role` enum (`TENANT`, `OWNER`, `ADMIN`) **[Verified in source]**.
- **Verification:** `isVerified`, `verifiedAt`, self-referential `verifiedById` pointing to the reviewing Admin **[Verified in source]**.
- **Cascade Deletes:** Deleting a user cascades to their `Favorite`, `RentalRequest`, `Conversation`, `Message`, `Notification`, `Report`, and `VerificationRequest` records **[Verified in source]**.

### 2.2 Property
- **Purpose:** Property listing created and owned by an `OWNER` **[Verified in source]**.
- **Primary Key:** UUID (`id`) **[Verified in source]**.
- **Indexes:** Composite index `(city, locality)`, foreign key index `(ownerId)` **[Verified in source]**.
- **Dimensions & Geography:** `rent` (Float), `securityDeposit` (Float), `bedrooms` (Int), `bathrooms` (Int), `city` (String), `locality` (String), `address` (String), `latitude` (Float?), `longitude` (Float?) **[Verified in source]**.
- **Enums:** `propertyType` (`APARTMENT`, `HOUSE`, `ROOM`, `PG`, `STUDIO`), `furnishedStatus` (`FURNISHED`, `SEMI_FURNISHED`, `UNFURNISHED`) **[Verified in source]**.
- **State Toggles:** `isAvailable` (Boolean, default: true), `isVerified` (Boolean, default: false) **[Verified in source]**.
- **Note on Missing Columns:** Schema inspection confirms there are **no columns** for `amenities`, `carpetArea`, `pincode`, or `state` in the database **[Verified in source]**.

### 2.3 PropertyImage
- **Purpose:** Image records pointing to Supabase Storage objects **[Verified in source]**.
- **Fields:** `id` (UUID PK), `propertyId` (FK), `url` (public Supabase URL), `publicId` (storage path `properties/{id}/{uuid}.{ext}`), `createdAt` **[Verified in source]**.
- **Foreign Key:** `propertyId` references `Property.id` with `onDelete: Cascade` **[Verified in source]**.

### 2.4 Favorite
- **Purpose:** Tenant bookmarking of properties **[Verified in source]**.
- **Unique Constraint:** `@@unique([userId, propertyId])` prevents duplicate saves **[Verified in source]**.
- **Indexes:** `(userId)`, `(propertyId)` **[Verified in source]**.

### 2.5 RentalRequest
- **Purpose:** Formal rental application submitted by a tenant **[Verified in source]**.
- **Indexes:** `(propertyId)`, `(tenantId)` **[Verified in source]**.
- **Status Enum:** `RequestStatus` (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED`) **[Verified in source]**.
- **Relationships:** Links optionally to 1 `Conversation` and 1 `Review` **[Verified in source]**.

### 2.6 Conversation
- **Purpose:** Chat thread between tenant and owner for a given property **[Verified in source]**.
- **Unique Constraints:** `@@unique([rentalRequestId])`, `@@unique([propertyId, tenantId])` **[Verified in source]**.
- **Nullable Foreign Key:** `rentalRequestId` is nullable, enabling pre-rental inquiries prior to formal application **[Verified in source]**.

### 2.7 Message
- **Purpose:** Individual message in a conversation **[Verified in source]**.
- **Indexes:** `(conversationId)`, `(senderId)`, `(createdAt)` **[Verified in source]**.
- **Read Tracking:** `readAt` (nullable DateTime) — null represents unread **[Verified in source]**.

### 2.8 Notification
- **Purpose:** In-app notification delivery **[Verified in source]**.
- **Indexes:** `(userId)`, `(isRead)`, `(createdAt)` **[Verified in source]**.
- **Enum:** `NotificationType` (`RENTAL_REQUEST`, `REQUEST_ACCEPTED`, `REQUEST_REJECTED`, `CHAT_MESSAGE`) **[Verified in source]**.
- **Polymorphic Reference:** `referenceId` (String?) stores target `rentalRequestId` or `conversationId` without FK constraint **[Verified in source]**.

### 2.9 Review
- **Purpose:** Tenant review after tenancy completion **[Verified in source]**.
- **Unique Constraint:** `@@unique([rentalRequestId])` guarantees at most 1 review per tenancy **[Verified in source]**.
- **Foreign Key Deletion:** `onDelete: Restrict` on `rentalRequestId` prevents deleting completed rental requests that have reviews attached **[Verified in source]**.

### 2.10 Report
- **Purpose:** Moderation incident report filed against a user, property, or message **[Verified in source]**.
- **Indexes:** `(reporterId)`, `(targetType, targetId)`, `(status)`, `(createdAt)` **[Verified in source]**.
- **Enums:** `targetType` (`PROPERTY`, `USER`, `MESSAGE`), `status` (`OPEN`, `REVIEWING`, `RESOLVED`, `DISMISSED`), `reason` (9 values) **[Verified in source]**.

### 2.11 VerificationRequest
- **Purpose:** Owner identity or property deed verification submission **[Verified in source]**.
- **Indexes:** `(type)`, `(status)`, `(ownerId)`, `(propertyId)`, `(submittedAt)` **[Verified in source]**.
- **Enums:** `type` (`OWNER`, `PROPERTY`), `status` (`PENDING`, `APPROVED`, `REJECTED`) **[Verified in source]**.

---

## 3. Database Enums (10 Total)

| Enum Name | Defined Values | Confidence |
|---|---|---|
| `Role` | `TENANT`, `OWNER`, `ADMIN` | **[Verified in source]** |
| `PropertyType` | `APARTMENT`, `HOUSE`, `ROOM`, `PG`, `STUDIO` | **[Verified in source]** |
| `FurnishedStatus` | `FURNISHED`, `SEMI_FURNISHED`, `UNFURNISHED` | **[Verified in source]** |
| `RequestStatus` | `PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`, `COMPLETED` | **[Verified in source]** |
| `NotificationType` | `RENTAL_REQUEST`, `REQUEST_ACCEPTED`, `REQUEST_REJECTED`, `CHAT_MESSAGE` | **[Verified in source]** |
| `ReportTargetType` | `PROPERTY`, `USER`, `MESSAGE` | **[Verified in source]** |
| `ReportStatus` | `OPEN`, `REVIEWING`, `RESOLVED`, `DISMISSED` | **[Verified in source]** |
| `ReportReason` | `FRAUD`, `SCAM`, `FAKE_LISTING`, `INAPPROPRIATE_CONTENT`, `HARASSMENT`, `SPAM`, `MISLEADING_INFORMATION`, `SAFETY_CONCERN`, `OTHER` (9 values) | **[Verified in source]** |
| `VerificationType` | `OWNER`, `PROPERTY` | **[Verified in source]** |
| `VerificationStatus` | `PENDING`, `APPROVED`, `REJECTED` | **[Verified in source]** |

---

## 4. Index Audit & Query Patterns

### Verified Existing Indexes (from `schema.prisma`)
- `Property`: `@@index([city, locality])`, `@@index([ownerId])` **[Verified in source]**.
- `PropertyImage`: `@@index([propertyId])` **[Verified in source]**.
- `Favorite`: `@@unique([userId, propertyId])`, `@@index([userId])`, `@@index([propertyId])` **[Verified in source]**.
- `RentalRequest`: `@@index([propertyId])`, `@@index([tenantId])` **[Verified in source]**.
- `Conversation`: `@@unique([rentalRequestId])`, `@@unique([propertyId, tenantId])`, `@@index([tenantId])`, `@@index([ownerId])`, `@@index([propertyId])` **[Verified in source]**.
- `Message`: `@@index([conversationId])`, `@@index([senderId])`, `@@index([createdAt])` **[Verified in source]**.
- `Notification`: `@@index([userId])`, `@@index([isRead])`, `@@index([createdAt])` **[Verified in source]**.
- `Review`: `@@unique([rentalRequestId])`, `@@index([propertyId])`, `@@index([tenantId])` **[Verified in source]**.
- `Report`: `@@index([reporterId])`, `@@index([targetType, targetId])`, `@@index([status])`, `@@index([createdAt])` **[Verified in source]**.
- `VerificationRequest`: `@@index([type])`, `@@index([status])`, `@@index([ownerId])`, `@@index([propertyId])`, `@@index([submittedAt])` **[Verified in source]**.

### Missing Index Recommendations (for Scale)
1. `Notification (userId, isRead)` composite: unread count query `where: { userId, isRead: false }` currently filters `isRead` using row-level filtering **[Inferred]**.
2. `Message (conversationId, readAt)` composite: unread message count query filters `conversationId` and `readAt: null` **[Inferred]**.
3. `Property (isVerified, createdAt)` composite: sorting by verified listings performs an in-memory sort without an index **[Inferred]**.

---

## 5. Migration History (13 Migrations)

| Migration Directory | Date Prefix | Architectural Purpose | Confidence |
|---|---|---|---|
| `20261007195500_init` | 2026-10-07 | Initial baseline: User, Property, PropertyImage | **[Verified in source]** |
| `20261008113744_chat` | 2026-10-08 | Adds Conversation and Message tables | **[Verified in source]** |
| `20261008113905_chat_rls` | 2026-10-08 | Experimental Supabase RLS policies (subsequently removed) | **[Verified in source]** |
| `20261008113906_chat_perms` | 2026-10-08 | Permissions adjustments (subsequently removed) | **[Verified in source]** |
| `20261008120000_drop_rls_policy` | 2026-10-08 | Drops RLS policies | **[Verified in source]** |
| `20261008120823_drop_rls_policy` | 2026-10-08 | Drops remaining RLS constraints | **[Verified in source]** |
| `20261008121457_notifications` | 2026-10-08 | Introduces Notification model | **[Verified in source]** |
| `20261008123108_add_notif_read_at` | 2026-10-08 | Adds `readAt` timestamp column to Notification | **[Verified in source]** |
| `20261008123954_reviews` | 2026-10-08 | Introduces Review model with rentalRequest relation | **[Verified in source]** |
| `20261008125641_add_reports` | 2026-10-08 | Introduces polymorphic Report model | **[Verified in source]** |
| `20261008171051_add_verification` | 2026-10-08 | Introduces VerificationRequest and verification fields | **[Verified in source]** |
| `20261016030000_add_token_version` | 2026-10-16 | Adds `tokenVersion` to User for instant session revocation | **[Verified in source]** |
| `20261017000000_pre_rental_conversations` | 2026-10-17 | Alters Conversation to make `rentalRequestId` nullable | **[Verified in source]** |
