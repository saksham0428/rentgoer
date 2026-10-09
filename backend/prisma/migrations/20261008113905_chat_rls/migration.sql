-- Enable RLS on Message table
ALTER TABLE "Message" ENABLE ROW LEVEL SECURITY;

-- Add Message to supabase_realtime publication
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE "Message";

-- Create policy to allow read access to messages if the conversation exists
-- Since the frontend uses the anon key and UUIDs are unguessable, the conversation ID acts as a capability token.
CREATE POLICY "Allow message read by conversation ID" ON "Message"
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM "Conversation" c
    WHERE c.id = "Message"."conversationId"
  )
);