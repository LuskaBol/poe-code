---
name: poe-code-ralph-plan
description: 'Generate a Ralph plan (YAML) from a user request. Triggers on: create a plan, write plan for, plan this feature, ralph plan.'
---

{{{PROMPT_PARTIAL_PLAN}}}

## User Request

The user's request follows this skill invocation. Use it to determine what to build.

## Output Path

Write the YAML file to `.agents/tasks/plan-<name>.yaml` unless the user specifies a different path.
