import { type Diagnostic } from '@codemirror/lint';
import type { Extension, Text } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import type { CommandDictionary } from '@nasa-jpl/plandev-ampcs';
import { parse as jsonSourceMapParse } from 'json-source-map';
import { PhoenixResources } from '../../interfaces/phoenix';

export function outputLinter(
  resources: PhoenixResources,
  commandDictionary: CommandDictionary | null = null,
): Extension {
  return resources.linter(view => seqJsonLinter(view, commandDictionary));
}

// TODO do we really need a SeqJSON linter?
/**
 * Linter function that returns a Code Mirror extension function.
 * Can be optionally called with a command dictionary so it's available during linting.
 */
export function seqJsonLinter(view: EditorView, commandDictionary: CommandDictionary | null = null): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  try {
    const text = view.state.doc.toString();
    const sourceMap = jsonSourceMapParse(text);

    if (commandDictionary) {
      for (const [key, pointer] of Object.entries(sourceMap.pointers)) {
        const stemMatch = key.match(/\/steps\/\d+\/stem/);

        if (stemMatch) {
          const stemValue = view.state.doc.sliceString(pointer.value.pos, pointer.valueEnd.pos);
          const stemValueNoQuotes = stemValue.replaceAll('"', '');
          const hasFswCommand = commandDictionary.fswCommandMap[stemValueNoQuotes] ?? false;
          const hasHwCommand = commandDictionary.hwCommandMap[stemValueNoQuotes] ?? false;
          const hasCommand = hasFswCommand || hasHwCommand;

          if (!hasCommand) {
            diagnostics.push({
              actions: [],
              from: pointer.value.pos,
              message: 'Command not found',
              severity: 'error',
              to: pointer.valueEnd.pos,
            });
          }
        }
      }
    }
  } catch (e) {
    if (!(e instanceof SyntaxError)) {
      throw e;
    }
    const pos = getErrorPosition(e, view.state.doc);

    diagnostics.push({
      from: pos,
      message: e.message,
      severity: 'error',
      to: pos,
    });
  }

  return diagnostics;
}

/**
 * Helper for getting an error position of JSON.prase throws a SyntaxError.
 * @see https://github.com/codemirror/lang-json/blob/main/src/lint.ts
 */
function getErrorPosition(error: SyntaxError, doc: Text): number {
  let m;

  if ((m = error.message.match(/at position (\d+)/))) {
    return Math.min(+m[1], doc.length);
  }

  if ((m = error.message.match(/at line (\d+) column (\d+)/))) {
    return Math.min(doc.line(+m[1]).from + +m[2] - 1, doc.length);
  }

  return 0;
}
