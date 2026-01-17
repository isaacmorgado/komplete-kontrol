---
description: Clear context for the current session
tags: [context, session]
argument-hint: [session-id]
---

$IF($1,
  Clear all messages from session $1 context window.
  Use session manager to load the session and clear its context window.
  Confirm the action was successful and show updated statistics.,
  Please provide a session ID to clear context.
  Usage: /context-clear [session-id]
  
  Available sessions can be listed with: session list
)
