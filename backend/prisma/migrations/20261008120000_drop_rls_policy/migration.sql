DROP POLICY IF EXISTS "Allow message read by conversation ID" ON "Message";
REVOKE SELECT ON "Message" FROM anon, authenticated;
REVOKE SELECT ON "Conversation" FROM anon, authenticated;
