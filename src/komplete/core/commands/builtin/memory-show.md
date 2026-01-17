---
description: Show memory file contents
tags: [memory, info]
argument-hint: [session-id]
---

$IF($1,
  Show the memory file contents for session $1.
  
  The memory file contains:
  - Session metadata (frontmatter)
  - System context
  - User preferences
  - Important context
  
  Use the memory file manager to read and display the memory file.,
  Please provide a session ID to show memory.
  Usage: /memory-show [session-id]
  
  Available sessions can be listed with: session list
)
