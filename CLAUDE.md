# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with this repository.

## Project Overview

This is `@nasa-jpl/plandev-sequence-languages`, a TypeScript library that provides consolidated parsing for sequence languages with first-party support in PlanDev sequencing. The package is used by the Phoenix Sequence Editor for parsing and editing spacecraft command sequences.

### Supported Languages

- **SeqN** - Primary sequence language with full editor support (linting, completion, formatting, tooltips)
- **SATF/SASF** - Spacecraft Activity Timeline Format / Spacecraft Activity Sequence Format
- **VML** - Vehicle Macro Language
- **SeqJSON** - JSON-based sequence format
- **Handlebars** - Template language support for seq-n-handlebars

## Build & Development Commands

```bash
# Install dependencies
npm install

# Build the project (cleans, generates grammars, compiles TypeScript)
npm run build

# Run tests (generates grammars first, then runs vitest)
npm test

# Generate grammar files individually
npm run seqn      # Generate seq-n grammar
npm run satf      # Generate SATF/SASF grammar
npm run vml       # Generate VML grammar
npm run grammar-builder  # Generate all grammars

# Format code
npm run format:check   # Check formatting
npm run format:write   # Fix formatting

# Clean build artifacts
npm run clean
```

## Project Architecture

```
src/
├── converters/         # Format conversion utilities (seqn ↔ seqJson, satf/sasf)
├── interfaces/         # TypeScript interfaces for language & adaptation APIs
├── languages/
│   ├── seq-n/          # SeqN language (parser, linter, completion, formatter, etc.)
│   ├── satf/           # SATF/SASF parser and constants
│   ├── vml/            # VML language support
│   ├── seqjson/        # SeqJSON language support
│   ├── handlebars/     # Handlebars templating
│   └── seq-n-handlebars/  # Combined SeqN + Handlebars
├── themes/             # CodeMirror themes
├── types/              # Shared TypeScript types
└── utils/              # Generic utilities (string, tree, sequence helpers)
```

## Key Technologies

- **Lezer** (`@lezer/lr`, `@lezer/generator`) - Parser generator for grammar files (`.grammar`)
- **CodeMirror 6** - Editor framework (`@codemirror/*` packages)
- **Vitest** - Test runner
- **TypeScript** - Targets ES2018, outputs both CJS and ESM

## Grammar Files

Grammar files use Lezer syntax and are compiled to JavaScript:
- `src/languages/seq-n/seq-n.grammar` → `seq-n.grammar.js`
- `src/languages/satf/grammar/satf-sasf.grammar` → `satf-sasf.grammar.js`
- `src/languages/vml/vml.grammar` → `vml.grammar.js`

**Important**: Run `npm run grammar-builder` after modifying any `.grammar` file.

## Testing

Tests are located alongside source files with `.test.ts` suffix. Key test files:
- `src/languages/seq-n/grammar.test.ts` - SeqN grammar tests
- `src/languages/satf/grammar/satf.test.ts` - SATF parser tests
- `src/languages/satf/grammar/sasf.test.ts` - SASF parser tests
- `src/languages/vml/vml.test.ts` - VML tests
- `src/converters/*.test.ts` - Converter tests

## Dependencies

Key external dependencies:
- `@nasa-jpl/plandev-ampcs` - AMPCS command dictionary types
- `@nasa-jpl/plandev-time-utils` - Time parsing utilities
- `@nasa-jpl/seq-json-schema` - SeqJSON schema definitions

## Module Exports

The package exports both CJS (`dist/cjs/`) and ESM (`dist/esm/`) formats. Main exports include:
- Parsers: `seqnParser`, `SatfSasfParser`
- Languages: `seqnLanguage`, `seqJsonLanguage`
- Converters: `seqJsonToSeqn`, `seqnToSeqJson`, `seqnToSATF`, `satfToSeqn`, etc.
- Utilities: string helpers, sequence utilities, type guards
