---
description: List all available commands
tags: [help, info]
argument-hint: [category]
---

$IF($1,
  Show all commands in the $1 category:
  
  - Command names and descriptions
  - Usage hints
  - Tags
  
  Use the command registry to filter commands by category.,
  Show all available commands organized by category:
  
  - Context commands (context-show, context-clear)
  - Session commands (session-list, session-show, session-create, session-delete)
  - Memory commands (memory-show, memory-edit)
  - Budget commands (budget-show, budget-reset)
  
  Use the command registry to list all commands and display them
  in a formatted table grouped by category.
)
