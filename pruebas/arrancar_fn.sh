#!/bin/bash
cd /home/claude/v2test; pkill -f twilio_mock.py; pkill -f "deno run"
nohup python3 twilio_mock.py > twilio.log 2>&1 &
SUPABASE_URL=http://127.0.0.1:8780 SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiAiSFMyNTYiLCAidHlwIjogIkpXVCJ9.eyJyb2xlIjogInNlcnZpY2Vfcm9sZSIsICJleHAiOiA5OTk5OTk5OTk5fQ.aPvj9yhd98EVmlMt53aMWPHjaC8PPgPocqzWg0kQEXU TWILIO_ACCOUNT_SID=AC1 TWILIO_AUTH_TOKEN=t TWILIO_VERIFY_SID=VA1 TWILIO_BASE=http://127.0.0.1:8791 nohup deno run --allow-net --allow-env /home/claude/repo-cargaya/v2/supabase/functions/recuperar-pin/index.ts > deno.log 2>&1 &
sleep 3
