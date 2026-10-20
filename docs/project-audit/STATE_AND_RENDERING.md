# State Management and Rendering Lifecycle — RentGoer

---

## Provider Tree

```
RootLayout (Next.js Server Component)
  AuthProvider          [client, mounts once globally]
    NotificationProvider  [client, depends on AuthContext]
      FavoritesProvider   [client, depends on AuthContext]
        Navbar            [client, reads all three contexts]
        main              [page content]
        Footer            [server or client depending on page]
```

Source: frontend/src/app/layout.tsx

All three providers are mounted at the root layout. In Next.js App Router, the root layout is a persistent shell — providers do NOT re-mount on client-side page navigation. Their state survives route changes.

---

## AuthProvider (AuthContext.tsx)

State managed: user (User | null), loading (boolean)

Mount behavior:
1. Renders immediately with user=null, loading=true
2. useEffect fires once: calls GET /api/proxy/auth/me
3. On success: setUser(userData), setLoading(false)
4. On failure: setUser(null), setLoading(false)

Operations:
- refreshUser(): re-calls /auth/me, updates user state — used after profile/email updates
- logout(): POST /auth/logout, then setUser(null), router.push('/'), router.refresh()

Memoization: contextValue memoized with useMemo([user, loading, refreshUser, logout])
Note: refreshUser and logout are wrapped in useCallback with stable deps.

React Strict Mode consideration: In development, effects run twice. The isCancelled flag in the mount useEffect prevents double-setting state from the second invocation.

---

## NotificationProvider (NotificationContext.tsx)

State managed: notifications[], unreadCount, unreadChatCount

Dependencies: useAuth() (reads user.id)

Mount behavior (when user.id is set):
1. Three parallel API calls:
   - GET /notifications (list)
   - GET /notifications/unread-count
   - GET /conversations/unread-count
2. Sets notifications, unreadCount, unreadChatCount
3. Opens EventSource to /api/proxy/notifications/realtime (or NEXT_PUBLIC_API_URL)
4. Listens to window custom event 'chat:unread_sync' for same-tab coordination

SSE event handling:
- NOTIFICATION_READ_SYNC: updates counts from server-authoritative values, marks local notifications as read
- New notification: prepends to list, increments unreadCount, increments unreadChatCount if CHAT_MESSAGE

Cleanup: on user.id change or unmount, isCancelled=true, eventSource.close(), event listener removed

Operations (all useCallback):
- markAsRead(id): optimistic update, then PUT /notifications/:id/read
- markAllAsRead(): optimistic update, then PUT /notifications/read-all
- fetchNotifications(): manual refresh (used by Notifications page on mount)
- fetchUnreadChatCount(): manual refresh (used by Chat page)
- markConversationAsRead(conversationId): optimistic update, then PATCH /conversations/:id/read

Memoization: contextValue memoized with useMemo

Known re-render trigger: setUnreadCount inside setNotifications callback — this is a functional update pattern. In React 18+, batching handles this, but in some older patterns this could cause double render. Not a significant concern with React 19.

---

## FavoritesProvider (FavoritesContext.tsx)

State managed: favoriteIds (string[]), loading (boolean)

Dependencies: useAuth() (reads user.id and user.role)

Mount behavior:
1. If user is not TENANT: clears state and returns
2. Calls GET /favorites/ids
3. Sets favoriteIds array (just IDs, not full property objects)

Operations:
- toggleFavorite(propertyId): optimistic update, then POST or DELETE /properties/:id/favorite
- fetchFavorites(): manual refresh

Memoization: contextValue memoized

Performance note: favoriteCount is derived from favoriteIds.length — no extra state.
On optimistic rollback (API failure): reverts favoriteIds state correctly.

---

## Navbar (layout/Navbar.tsx)

- Client component
- Reads from AuthContext: user, loading, logout
- Reads from NotificationContext: unreadCount, unreadChatCount
- Renders notification bell badge and chat badge in header
- Triggers logout via AuthContext.logout()
- Has mobile responsive menu

Re-render: Any change to user, unreadCount, or unreadChatCount causes Navbar re-render. This is expected since the Navbar displays all three values. No unnecessary re-renders observed from context shape.

---

## useConversationRealtime Hook

File: frontend/src/hooks/useConversationRealtime.ts

- Used in the Chat page per conversation
- Opens EventSource to /conversations/:id/realtime when user is authenticated
- On message: calls onNewMessage callback via stable ref
- On error: falls back to polling every 5 seconds
- Status state: 'connecting' | 'connected' | 'disconnected'
- Cleanup: eventSource.close(), clearInterval on unmount

The onNewMessageRef pattern (keeping a ref to the latest callback) prevents stale closure issues without re-creating the EventSource on every render.

---

## useUnreadChatCount Hook

File: frontend/src/hooks/useUnreadChatCount.ts

Contents: 271 bytes — minimal wrapper that reads unreadChatCount from NotificationContext.
This is a thin re-export, not additional logic.

---

## Server vs. Client Component Boundaries

| Page | Type | Notes |
|---|---|---|
| app/page.tsx (landing) | Server | Fetches current user server-side, renders role-aware CTA |
| app/properties/page.tsx | Server or Client | Fetches properties server-side initially |
| app/properties/[id]/page.tsx | Mixed | Property detail likely server, interactive elements client |
| app/owner/page.tsx | Client | Full client component with useEffect for data |
| app/login/page.tsx | Client | Form interaction |
| app/register/page.tsx | Client | Form interaction |
| app/chat/page.tsx | Client | SSE connections require client |
| app/notifications/page.tsx | Client | SSE-driven |
| app/admin/* | Client | Dashboard with interactive data |

---

## Effects That Trigger Network Requests

| Location | Trigger | Requests |
|---|---|---|
| AuthProvider useEffect | Mount | GET /auth/me |
| NotificationProvider useEffect | user.id change | GET /notifications, GET /notifications/unread-count, GET /conversations/unread-count, open SSE |
| FavoritesProvider useEffect | user.id or role change | GET /favorites/ids |
| useConversationRealtime useEffect | conversationId or user.id change | SSE /conversations/:id/realtime |
| Owner Dashboard useEffect | user, authLoading change | GET /properties/owner/me, GET /verification/me |

---

## State Persistence

| State | Persisted? | How |
|---|---|---|
| Authentication token | Yes (DB-backed cookie) | HttpOnly cookie, 7 days |
| User profile | Server (DB) | Fetched on mount |
| Notifications | Server (DB) | Fetched on login |
| Unread counts | Server (DB) | Fetched on login, updated via SSE |
| Favorites | Server (DB) | Fetched on login, optimistic local |
| Chat messages | Server (DB) | Fetched per conversation |
| SSE connection state | In-memory (lost on disconnect) | Reconnected on page load |

---

## Logout and User Switching

1. AuthContext.logout() calls POST /auth/logout (clears cookie)
2. Sets user=null in AuthContext
3. NotificationProvider useEffect detects user.id is now undefined:
   - Clears notifications, unreadCount, unreadChatCount
   - Cancels SSE connection (isCancelled=true, eventSource.close())
4. FavoritesProvider useEffect detects user.id change:
   - Clears favoriteIds

No stale state persists across logout in the primary contexts. Pages that cached data in local useState would need to be navigated away from to clear.

---

## Memoization Analysis

All three context values use useMemo with their dependent state. This prevents consumers from re-rendering when unrelated state in the provider changes.
All callback functions (logout, toggleFavorite, markAsRead, etc.) use useCallback with appropriate deps.

Potential improvement: NotificationContext provides many values in one context object. If components only need unreadCount (like the Navbar chat badge), they still subscribe to the full context. Splitting into NotificationListContext and NotificationCountContext would reduce unnecessary re-renders, but the current scale does not make this urgent.
