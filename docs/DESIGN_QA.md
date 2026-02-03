# Design QA

Visual quality assurance checklist for poe-code CLI.

## Screenshots

Generate screenshots of CLI output:

```bash
npm run screenshot-poe-code -- <command>
```

## Task

1. Run each command through the screenshot script one by one
2. Review each screenshot
3. Verify all output uses the design system correctly
4. Ensure great user experience for CLI users

## Design System Usage

Always import from `@poe-code/design-system`:

```typescript
import { intro, outro, text, symbols, log } from "@poe-code/design-system";
```

Never import directly from `@clack/prompts` - use the design-system wrappers.

## Common Issues

- Commands not using the design language
- Direct @clack/prompts imports instead of design-system
- Hardcoded colors instead of tokens
- Missing or incorrect symbols
- Commands outputting information that is not useful

## Commands to Check

```bash
# Core help
npm run screenshot-poe-code -- --help
npm run screenshot-poe-code -- configure --help
npm run screenshot-poe-code -- install --help
npm run screenshot-poe-code -- spawn --help
npm run screenshot-poe-code -- wrap --help
npm run screenshot-poe-code -- test --help
npm run screenshot-poe-code -- unconfigure --help
npm run screenshot-poe-code -- login --help
npm run screenshot-poe-code -- generate --help
npm run screenshot-poe-code -- generate text --help
npm run screenshot-poe-code -- generate image --help
npm run screenshot-poe-code -- generate video --help
npm run screenshot-poe-code -- generate audio --help
npm run screenshot-poe-code -- mcp --help
npm run screenshot-poe-code -- mcp serve --help
npm run screenshot-poe-code -- mcp configure --help
npm run screenshot-poe-code -- mcp unconfigure --help
npm run screenshot-poe-code -- skill --help
npm run screenshot-poe-code -- skill configure --help
npm run screenshot-poe-code -- skill unconfigure --help

# Dry-run simulations
npm run screenshot-poe-code -- configure claude-code --dry-run --yes --api-key sk-test
npm run screenshot-poe-code -- install claude-code --dry-run --yes
npm run screenshot-poe-code -- unconfigure claude-code --dry-run --yes
npm run screenshot-poe-code -- spawn claude "hi" --dry-run
npm run screenshot-poe-code -- login --dry-run --yes --api-key sk-test
npm run screenshot-poe-code -- generate "hello" --dry-run
npm run screenshot-poe-code -- generate text "hello" --dry-run
npm run screenshot-poe-code -- generate image "a cat" --dry-run
npm run screenshot-poe-code -- generate video "a cat" --dry-run
npm run screenshot-poe-code -- generate audio "a cat" --dry-run
npm run screenshot-poe-code -- mcp configure claude-code --dry-run
npm run screenshot-poe-code -- mcp unconfigure claude-code --dry-run
npm run screenshot-poe-code -- skill configure claude-code --global --dry-run
npm run screenshot-poe-code -- skill unconfigure claude-code --global --dry-run
```

## Regenerate Design Docs

After making visual changes:

```bash
npm run generate:design-docs
```

This regenerates [DESIGN_LANGUAGE.md](./DESIGN_LANGUAGE.md) with updated screenshots.
