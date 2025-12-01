import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import type { EditorView, Tooltip } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import type { CommandDictionary, FswCommand, HwCommand } from '@nasa-jpl/plandev-ampcs';
import { PhoenixContext, PhoenixResources } from 'interfaces/phoenix.js';
import { buildAmpcsArgumentTooltip, buildAmpcsCommandTooltip } from '../../utils/editor-utils.js';
import { isFswCommandArgumentRepeat } from '../../utils/sequence-utils.js';
import { getTokenPositionInLine } from '../../utils/tree-utils.js';
import { SeqNCommandInfoMapper } from './seq-n-tree-utils.js';
import { SEQN_NODES } from './seqn-grammar-constants.js';

/**
 * Searches up through a node's ancestors to find a node by the given name.
 */
function getParentNodeByName(view: EditorView, pos: number, name: string): SyntaxNode | undefined {
  let node: SyntaxNode | undefined = syntaxTree(view.state).resolveInner(pos, -1);

  // TODO - replace with getAncestorNode
  while (node && node.name !== name) {
    node = node.parent?.node;
  }

  return node;
}

/**
 * Tooltip function that returns a Code Mirror extension function.
 * Can be optionally called with a command dictionary so it's available during tooltip generation.
 */
export function seqnTooltip(
  commandDictionary: CommandDictionary | null = null,
  resources: PhoenixResources,
  phoenixContext: PhoenixContext,
  mapper: SeqNCommandInfoMapper,
): Extension {
  return resources.hoverTooltip((view, pos, side): Tooltip | null => {
    const { from, to } = getTokenPositionInLine(view, pos);

    // First handle the case where the token is out of bounds.
    if ((from === pos && side < 0) || (to === pos && side > 0)) {
      return null;
    }

    // Check to see if we are hovering over a command stem.
    // TODO: Get token from AST? For now just assumes token is a commend stem if found in dictionary.
    if (commandDictionary) {
      const { hwCommandMap, fswCommandMap } = commandDictionary;
      const text = view.state.doc.sliceString(from, to);
      const command: FswCommand | HwCommand | null = fswCommandMap[text] ?? hwCommandMap[text] ?? null;

      if (command) {
        return resources.createTooltip(buildAmpcsCommandTooltip(command), from, to);
      }
    }

    // Check to see if we are hovering over command arguments.
    const argsNode = getParentNodeByName(view, pos, 'Args');

    if (argsNode) {
      const stem = argsNode.parent?.getChild('Stem');

      if (commandDictionary && stem) {
        const { fswCommandMap } = commandDictionary;
        const text = view.state.doc.sliceString(stem.from, stem.to);
        const fswCommand: FswCommand | null = fswCommandMap[text] ?? null;
        const argValues: string[] = [];

        if (!fswCommand) {
          return null;
        }

        let argNode = argsNode.firstChild;

        while (argNode) {
          argValues.push(view.state.doc.sliceString(argNode.from, argNode.to));
          argNode = argNode.nextSibling;
        }

        let i = 0;
        argNode = argsNode.firstChild;
        while (argNode) {
          const argDef = fswCommand.arguments[i];

          if (argDef !== undefined) {
            const isRepeatArg = isFswCommandArgumentRepeat(argDef) && argDef.repeat;

            if (argNode.name === SEQN_NODES.REPEAT_ARG && isRepeatArg) {
              let repeatArgNode = argNode.firstChild;
              let j = 0;
              while (repeatArgNode) {
                if (repeatArgNode.from === from && repeatArgNode.to === to) {
                  const arg = argDef.repeat?.arguments[j % argDef.repeat.arguments.length];
                  if (arg) {
                    return resources.createTooltip(buildAmpcsArgumentTooltip(arg, commandDictionary), from, to);
                  }
                }
                repeatArgNode = repeatArgNode.nextSibling;
                ++j;
              }
            }

            if ((argNode.from === from && argNode.to === to) || isRepeatArg) {
              const arg = mapper.getArgumentDef(text, fswCommand.arguments[i], argValues, phoenixContext);

              if (arg) {
                return resources.createTooltip(buildAmpcsArgumentTooltip(arg, commandDictionary), from, to);
              }
            }
          }

          argNode = argNode.nextSibling;
          ++i;
        }
      }
    }

    return null;
  });
}
