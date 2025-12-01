import { syntaxTree } from '@codemirror/language';
import type { Extension } from '@codemirror/state';
import type { EditorView } from '@codemirror/view';
import { hoverTooltip, type Tooltip } from '@codemirror/view';
import type { SyntaxNode } from '@lezer/common';
import type {
  CommandDictionary,
  FswCommand,
  FswCommandArgument,
  FswCommandArgumentInteger,
} from '@nasa-jpl/plandev-ampcs';
import { buildAmpcsArgumentTooltip, buildAmpcsCommandTooltip } from 'utils/editor-utils.js';
import type { CreateTooltip, LibrarySequenceSignature, PhoenixResources } from '../../interfaces/phoenix.js';
import { decodeInt32Array } from '../../utils/sequence-utils.js';
import { unquoteUnescape } from '../../utils/string.js';
import { checkContainment, getNearestAncestorNodeOfType, getTokenPositionInLine } from '../../utils/tree-utils.js';
import { librarySequenceToFswCommand } from './vml-block-library.js';
import {
  RULE_BYTE_ARRAY,
  RULE_CALL_PARAMETER,
  RULE_CALL_PARAMETERS,
  RULE_CONSTANT,
  RULE_FUNCTION_NAME,
  RULE_ISSUE,
  RULE_ISSUE_DYNAMIC,
  RULE_SIMPLE_EXPR,
  RULE_SPAWN,
  RULE_STATEMENT,
  RULE_TIME_TAGGED_STATEMENT,
  RULE_VM_MANAGEMENT,
  TOKEN_HEX_CONST,
  TOKEN_INT_CONST,
} from './vml-constants.js';
import { getVmlNameNode } from './vml-tree-utils.js';

const sequenceEngineArgument: FswCommandArgumentInteger = {
  arg_type: 'integer',
  bit_length: 8,
  default_value: null,
  description: `Sequence Engine / Virtual Machine. -1 is used to specify next available engine`,
  name: `Sequence Engine / Virtual Machine`,
  range: null,
  units: '',
};

export function vmlTooltip(
  commandDictionary: CommandDictionary | null,
  librarySequenceMap: { [sequenceName: string]: LibrarySequenceSignature },
  resources: PhoenixResources,
): Extension {
  return hoverTooltip((view: EditorView, pos: number, side: number): Tooltip | null => {
    const { from, to } = getTokenPositionInLine(view, pos);

    // First handle the case where the token is out of bounds.
    if ((from === pos && side < 0) || (to === pos && side > 0)) {
      return null;
    }

    const tree = syntaxTree(view.state);
    const cursorNode = tree.cursorAt(from, 1).node;

    const timeTaggedNode = getNearestAncestorNodeOfType(cursorNode, [RULE_TIME_TAGGED_STATEMENT]);
    if (!timeTaggedNode) {
      return null;
    }

    const statementNode = timeTaggedNode.getChild(RULE_STATEMENT);
    if (!statementNode) {
      return null;
    }

    const nameNode = getVmlNameNode(timeTaggedNode);
    const commandName = nameNode ? unquoteUnescape(view.state.sliceDoc(nameNode.from, nameNode.to)) : null;
    let command: FswCommand | undefined = undefined;

    if (commandName) {
      if (statementNode.getChild(RULE_ISSUE) || statementNode.getChild(RULE_ISSUE_DYNAMIC)) {
        command = commandDictionary?.fswCommandMap[commandName];
      } else if (statementNode.getChild(RULE_VM_MANAGEMENT)?.getChild(RULE_SPAWN)?.getChild(RULE_FUNCTION_NAME)) {
        const librarySequence = librarySequenceMap[commandName];
        if (librarySequence) {
          command = librarySequenceToFswCommand(librarySequence);
        }
      }
    }

    // cursor over command
    if (command && nameNode?.from === from && nameNode?.to === to) {
      return cmdTooltip(resources.createTooltip, command, from, to);
    }

    // over seq engine
    if (
      checkContainment(cursorNode, [RULE_VM_MANAGEMENT, undefined, RULE_SIMPLE_EXPR, RULE_CONSTANT, TOKEN_INT_CONST])
    ) {
      return argTooltip(resources.createTooltip, sequenceEngineArgument, null, from, to);
    }

    const callParameterNode = getNearestAncestorNodeOfType(cursorNode, [RULE_CALL_PARAMETER]);
    // over parameter
    // handle variables
    if (callParameterNode && command) {
      const arrayNode = callParameterNode.getChild(RULE_BYTE_ARRAY);
      if (arrayNode) {
        const encodedValues = arrayNode
          .getChildren(TOKEN_HEX_CONST)
          .map(node => view.state.sliceDoc(node.from, node.to));
        const decodedValue = decodeInt32Array(encodedValues);
        if (decodedValue) {
          return strTooltip(resources.createTooltip, decodedValue, from, to);
        }
      }

      return callParameterTooltip(resources.createTooltip, callParameterNode, command, commandDictionary, from, to);
    }

    return null;
  });
}

function callParameterTooltip(
  createTooltip: CreateTooltip,
  callParameterNode: SyntaxNode,
  command: FswCommand,
  commandDictionary: CommandDictionary | null,
  from: number,
  to: number,
): Tooltip | null {
  const callParametersNode = getNearestAncestorNodeOfType(callParameterNode, [RULE_CALL_PARAMETERS]);
  if (!callParametersNode) {
    return null;
  }

  const parameterNodes = callParametersNode.getChildren(RULE_CALL_PARAMETER);
  const argIndex = parameterNodes.findIndex(
    paramNode => callParameterNode.to === paramNode.to && callParameterNode.from === paramNode.from,
  );

  const arg = argIndex > -1 && command.arguments[argIndex];
  if (!arg) {
    return null;
  }

  return argTooltip(createTooltip, arg, commandDictionary, from, to);
}

function strTooltip(createTooltip: CreateTooltip, message: string, from: number, to: number) {
  return createTooltip([message], from, to);
}

function argTooltip(
  createTooltip: CreateTooltip,
  arg: FswCommandArgument,
  commandDictionary: CommandDictionary | null,
  from: number,
  to: number,
): Tooltip {
  return createTooltip(buildAmpcsArgumentTooltip(arg, commandDictionary), from, to);
}

function cmdTooltip(createTooltip: CreateTooltip, command: FswCommand, from: number, to: number): Tooltip {
  return createTooltip(buildAmpcsCommandTooltip(command), from, to);
}
