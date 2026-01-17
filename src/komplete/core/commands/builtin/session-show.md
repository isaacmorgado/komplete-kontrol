---
description: Show details for a specific session
tags: [session, info]
argument-hint: [session-id]
---

$IF($1,
  Show detailed information for session $1:
  
  - Session metadata (ID, agent, model, timestamps)
  - Message count and token count
  - Context window statistics
  - List of recent messages (last 10)
  
  Use the session manager to load the session and display its details.,
  Please provide a session ID to show.
  Usage: /session-show [session-id]
  
  Available sessions can be listed with: session list
)
