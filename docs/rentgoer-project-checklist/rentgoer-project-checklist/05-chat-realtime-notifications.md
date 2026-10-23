# 05 — Chat, real-time updates & notifications

## Confirmed milestones
- [x] Conversation and Message schema models with compound unique `[propertyId, tenantId]` (`backend/prisma/schema.prisma:L122-164`)
- [x] Pre-rental and post-acceptance conversation creation endpoints (`POST /api/conversations`, `/pre-rental`) preventing self-chat (`backend/src/controllers/chat.controller.ts:L36-124`)
- [x] Persistent messaging endpoint (`POST /api/conversations/:id/messages`) with participant authorization and 1-2000 character validation (`backend/src/controllers/chat.controller.ts:L168-242`)
- [x] Real-time chat SSE stream (`GET /api/conversations/:id/realtime`) with 20s keepalive pings (`: ping\n\n`) and reverse proxy buffering bypass (`X-Accel-Buffering: no`) (`backend/src/controllers/chat.controller.ts:L244-320`)
- [x] In-process `chatEventEmitter` for broadcasting messages by conversation ID (`backend/src/lib/realtime.ts`)
- [x] Chat message read receipt synchronization (`PATCH /api/conversations/:id/read`) emitting `NOTIFICATION_READ_SYNC` (`backend/src/controllers/chat.controller.ts:L322-386`)
- [x] Unread chat message counter (`GET /api/conversations/unread-count`, `backend/src/controllers/chat.controller.ts:L126-166`)
- [x] Real-time notification SSE stream (`GET /api/notifications/realtime`) with per-user `notificationEventEmitter` (`backend/src/controllers/notification.controller.ts:L142-200`, `backend/src/lib/realtime-notifications.ts`)
- [x] In-app notification creation for `RENTAL_REQUEST`, `REQUEST_ACCEPTED`, `REQUEST_REJECTED`, and `CHAT_MESSAGE`
- [x] Notification management endpoints: list (`GET /api/notifications`), unread count (`GET /api/notifications/unread-count`), mark read (`PUT /api/notifications/:id/read`), mark all read (`PUT /api/notifications/read-all`)
- [x] In-memory connection tracker capping sockets per user (3 for notifications, 5 for chat) (`backend/src/lib/sse-tracker.ts`)
- [x] Frontend `NotificationContext.tsx` with EventSource stream, badge management, and `chat:unread_sync` event dispatch
- [x] Frontend `useConversationRealtime.ts` with EventSource stream and 5-second polling fallback on disconnect
- [x] Frontend Navbar dual badge counters (`unreadCount`, `unreadChatCount`) synchronized via SSE and local DOM events
- [x] Frontend chat interfaces (`/chat`, `/chat/[id]`) and notification feed (`/notifications`)
- [x] Dedicated realtime and chat test scripts (`backend/scratch/test-chat-integration.ts`, `backend/scratch/test-pre-rental-chat-unit.ts`, `backend/scratch/test-notification-sync-unit.ts`)

## Remaining
- [ ] Verify pre-rental inquiry chat and participant/property authorization rules in live browser
- [ ] Verify real-time chat delivery and polling fallback behavior in live browser
- [ ] Verify unread-message and notification counts stay synchronized across open tabs
- [ ] Verify notification read and mark-all-read workflows in live browser
- [ ] Verify SSE connections are cleaned up correctly on logout and navigation
- [ ] Evaluate Redis Pub/Sub before horizontal backend scaling (in-process EventEmitters cannot broadcast across multiple instances)
- [ ] Fix ESLint error in `frontend/src/hooks/useConversationRealtime.ts:L17` (`react-hooks/refs`: ref mutation during render)
- [ ] Add 20-second keepalive ping to Notification SSE stream to match Chat SSE and prevent proxy idle disconnects

