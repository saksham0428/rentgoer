# Real-Time Communication Architecture — RentGoer

**Audit Date:** October 20, 2026  
**Auditor:** Senior Technical Documentation Auditor & Repository Verification Engineer  
**Scope:** Server-Sent Events (SSE) channels, in-process EventEmitters, message broadcasting, read synchronization, and client fallbacks.

---

## 1. Overview

RentGoer implements Server-Sent Events (SSE) as its primary real-time transport mechanism **[Verified in source]**.
There are two dedicated SSE channels:
1. **Notification SSE (`GET /api/notifications/realtime`)** — per-user event stream delivering in-app notifications and read-state synchronization **[Verified in source]**.
2. **Chat SSE (`GET /api/conversations/:id/realtime`)** — per-conversation event stream delivering real-time chat messages to active conversation participants **[Verified in source]**.

Both channels are backed by in-process Node.js `EventEmitter` singletons **[Verified in source]**. There is currently no external message broker (e.g. Redis or RabbitMQ) **[Verified in source]**.

---

## 2. Backend Infrastructure & Connection Tracking

### 2.1 chatEventEmitter (`backend/src/lib/realtime.ts`)
```typescript
export const chatEventEmitter = new EventEmitter();
chatEventEmitter.setMaxListeners(1000);
```
- A process-level singleton `EventEmitter` **[Verified in source]**.
- Events are namespaced by conversation ID: `message:${conversationId}` **[Verified in source]**.
- `broadcastMessage(message)` emits the payload to all clients listening to that conversation channel **[Verified in source]**.

### 2.2 notificationEventEmitter (`backend/src/lib/realtime-notifications.ts`)
```typescript
export const notificationEventEmitter = new EventEmitter();
notificationEventEmitter.setMaxListeners(1000);
```
- A process-level singleton `EventEmitter` **[Verified in source]**.
- Events are namespaced by user ID: `notification:${userId}` **[Verified in source]**.
- `emitNotification(userId, notification)` pushes events to all active sockets belonging to that user **[Verified in source]**.

### 2.3 SSE Connection Tracker (`backend/src/lib/sse-tracker.ts`)
- Implements in-memory `Map<string, number>` tracking active connections per `userId` **[Verified in source]**.
- **Configurable Limits:**
  - `NOTIFICATION_SSE_MAX_CONNECTIONS_PER_USER`: defaults to 3 **[Verified in source]**.
  - `CONVERSATION_SSE_MAX_CONNECTIONS_PER_USER`: defaults to 5 **[Verified in source]**.
- If a user opens more sockets than permitted, the connection attempt is rejected with HTTP 429 (`"Too many active notification connections"`) **[Verified in source]**.

---

## 3. Notification SSE Channel (`/api/notifications/realtime`)

### Server Implementation (`notification.controller.ts`)
1. Authenticates user via `authMiddleware` **[Verified in source]**.
2. Verifies socket count via `sseTracker.addNotificationConnection(userId)` **[Verified in source]**.
3. Emits HTTP headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive` **[Verified in source]**.
4. Flushes headers via `res.flushHeaders()` **[Verified in source]**.
5. Registers listener: `notificationEventEmitter.on('notification:${userId}', onNotification)` **[Verified in source]**.
6. On client disconnect (`req.on('close')`), unbinds listener and decrements `sseTracker` count **[Verified in source]**.
7. *Note:* Does not emit periodic keepalive pings; relies on browser-level reconnects **[Verified in source]**.

### Events Emitted

| Event Payload / Action | Trigger Controller | Target Recipient | Data Contents | Confidence |
|---|---|---|---|---|
| **New Notification** | `createRentalRequest`, `acceptRequest`, `sendMessage` | Owner / Tenant | Full `Notification` object | **[Verified in source]** |
| `NOTIFICATION_READ_SYNC` (`CONVERSATION_READ`) | `markConversationAsRead` | Current User | `{ type, action, conversationId, unreadNotificationCount, unreadChatCount }` | **[Verified in source]** |
| `NOTIFICATION_READ_SYNC` (`NOTIFICATION_READ`) | `markAsRead` | Current User | `{ type, action, notificationId, unreadNotificationCount, unreadChatCount }` | **[Verified in source]** |
| `NOTIFICATION_READ_SYNC` (`ALL_READ`) | `markAllAsRead` | Current User | `{ type, action, unreadNotificationCount: 0, unreadChatCount: 0 }` | **[Verified in source]** |

### Client Integration (`NotificationContext.tsx`)
- Mounts globally inside `RootLayout` **[Verified in source]**.
- On initial authentication, fetches `/notifications`, `/notifications/unread-count`, and `/conversations/unread-count` in parallel **[Verified in source]**.
- Opens `EventSource(`${API_URL}/notifications/realtime`)` with `withCredentials: true` **[Verified in source]**.
- Parses data frames:
  - If `data.type === 'NOTIFICATION_READ_SYNC'`: updates `unreadCount` and `unreadChatCount` immediately, marks relevant notifications in local state as `isRead = true`, and dispatches DOM `chat:unread_sync` event **[Verified in source]**.
  - If regular notification: prepends to list, increments `unreadCount`, and increments `unreadChatCount` if `data.type === 'CHAT_MESSAGE'` **[Verified in source]**.
- *Note on Fallback:* `NotificationContext` does not run an automatic polling timer; it relies on native EventSource automatic reconnection **[Verified in source]**.

---

## 4. Chat SSE Channel (`/api/conversations/:id/realtime`)

### Server Implementation (`chat.controller.ts`)
1. Authenticates user and verifies user is participant (`tenantId` or `ownerId`) **[Verified in source]**.
2. Verifies socket limits via `sseTracker.addChatConnection(userId)` **[Verified in source]**.
3. Emits headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no` **[Verified in source]**.
4. Flushes headers and sends initial acknowledgment: `: connected\n\n` **[Verified in source]**.
5. Starts 20-second keepalive timer: writes `: ping\n\n` every 20,000ms to prevent proxy timeouts **[Verified in source]**.
6. Binds `chatEventEmitter.on('message:${conversationId}', onMessage)` **[Verified in source]**.
7. Cleans up interval and listeners on client disconnect **[Verified in source]**.

### Client Integration & 5-Second Polling Fallback (`useConversationRealtime.ts`)
- Connects to `/api/proxy/conversations/${conversationId}/realtime` **[Verified in source]**.
- On incoming message: invokes callback using `onNewMessageRef` to avoid stale closures **[Verified in source]**.
- **Polling Fallback:** If `eventSource.onerror` fires, the hook transitions state to `disconnected` and immediately activates an interval polling fallback:
  ```typescript
  pollInterval = setInterval(async () => {
    const res = await api.get(`/conversations/${conversationId}/messages?after=${lastPollTimestamp}&limit=20`);
    // feeds new messages to message handler
  }, 5000);
  ```
  Once the EventSource reconnects (`onopen`), the polling timer is cleared **[Verified in source]**.

---

## 5. Cross-Tab Synchronization

When a conversation or notification is marked as read, RentGoer coordinates open browser tabs through two complementary mechanisms **[Verified in source]**:
1. **Server-Pushed SSE Broadcast:** The server emits `NOTIFICATION_READ_SYNC` over the user's notification SSE stream, reaching any tab that has an active stream **[Verified in source]**.
2. **Local DOM Event Dispatch:**
   ```typescript
   window.dispatchEvent(new CustomEvent('chat:unread_sync', { detail: data }));
   ```
   Ensures instantaneous badge zeroing without waiting for network roundtrips **[Verified in source]**.

---

## 6. Single-Instance vs Multi-Instance Limitations

### Current Single-Instance Topology (Render)
- All client SSE sockets connect to the same Node.js process **[Verified in source]**.
- When an API request emits an event to `chatEventEmitter` or `notificationEventEmitter`, the event is delivered immediately to connected sockets **[Verified in source]**.

### Horizontal Scaling Barrier
- If the Render backend is scaled horizontally to 2 or more container instances:
  - Client A connected to Instance 1 will not receive events emitted by Client B on Instance 2 **[Inferred]**.
  - Chat and notifications would only arrive when the client polling fallback kicks in or the user manually refreshes **[Inferred]**.
- **Remediation Requirement:** Prior to horizontal scaling, replace the in-process `EventEmitter` singletons with an external Pub/Sub engine, such as Redis Pub/Sub or Supabase Realtime Broadcast **[Inferred]**.
