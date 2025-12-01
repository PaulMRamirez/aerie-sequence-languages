import type { SyntaxNode, Tree } from '@lezer/common';
import type {
  CommandDictionary,
  EnumMap,
  FswCommand,
  FswCommandArgument,
  FswCommandArgumentRepeat,
} from '@nasa-jpl/plandev-ampcs';
import { SEQN_NODES } from './seqn-grammar-constants.js';
import { parseVariables } from '../../converters/seqnToSeqJson.js';
import type { EditorView } from '@codemirror/view';
import type { UserSequence, LibrarySequenceSignature, PhoenixContext } from '../../interfaces/phoenix.js';
import type { ArgTextDef, TimeTagInfo } from '../../interfaces/command-info-mapper.js';
import { fswCommandArgDefault, isFswCommandArgumentRepeat } from '../../utils/sequence-utils.js';
import { getFromAndTo, getNearestAncestorNodeOfType } from '../../utils/tree-utils.js';
import type { CommandInfoMapper } from '../../interfaces/command-info-mapper.js';
import { GlobalVariable } from '../../types/global-types.js';
import { seqnParser } from './seq-n.js';
import { TOKEN_ERROR } from './seq-n-constants.js';
import { validateVariables } from './seq-n-linter.js';

export function getNameNode(stepNode: SyntaxNode | null) {
  if (stepNode) {
    switch (stepNode.name) {
      case SEQN_NODES.ACTIVATE:
      case SEQN_NODES.LOAD:
        return stepNode.getChild(SEQN_NODES.SEQUENCE_NAME);
      case SEQN_NODES.GROUND_BLOCK:
      case SEQN_NODES.GROUND_EVENT:
        return stepNode.getChild(SEQN_NODES.GROUND_NAME);
      case SEQN_NODES.COMMAND:
        return stepNode.getChild(SEQN_NODES.STEM);
      case SEQN_NODES.REQUEST:
        return stepNode.getChild(SEQN_NODES.REQUEST_NAME);
    }
  }

  return null;
}

export function getAncestorStepOrRequest(node: SyntaxNode | null) {
  return getNearestAncestorNodeOfType(node, [
    SEQN_NODES.COMMAND,
    SEQN_NODES.ACTIVATE,
    SEQN_NODES.GROUND_BLOCK,
    SEQN_NODES.GROUND_EVENT,
    SEQN_NODES.LOAD,
    SEQN_NODES.REQUEST,
  ]);
}

export function seqnToLibrarySequence(sequence: UserSequence): LibrarySequenceSignature {
  const tree = seqnParser.parse(sequence.definition); // TODO is it bad to use seqnParser here? test with comments
  return {
    name: sequence.name,
    parameters: parseVariables(tree.topNode, sequence.definition, SEQN_NODES.PARAMETER_DECLARATION) ?? [],
  };
}

export class SeqNCommandInfoMapper implements CommandInfoMapper {
  globals: GlobalVariable[];

  constructor(globals?: GlobalVariable[]) {
    this.globals = globals ?? [];
  }

  getArgumentAppendPosition(commandOrRepeatArgNode: SyntaxNode | null): number | undefined {
    if (
      commandOrRepeatArgNode?.name === SEQN_NODES.COMMAND ||
      commandOrRepeatArgNode?.name === SEQN_NODES.ACTIVATE ||
      commandOrRepeatArgNode?.name === SEQN_NODES.LOAD
    ) {
      const argsNode = commandOrRepeatArgNode.getChild(SEQN_NODES.ARGS);
      const stemNode = commandOrRepeatArgNode.getChild(SEQN_NODES.STEM);
      return getFromAndTo([stemNode, argsNode]).to;
    } else if (commandOrRepeatArgNode?.name === SEQN_NODES.REPEAT_ARG) {
      return commandOrRepeatArgNode.to - 1;
    }
    return undefined;
  }

  getArgumentNodeContainer(commandNode: SyntaxNode | null): SyntaxNode | null {
    return commandNode?.getChild(SEQN_NODES.ARGS) ?? null;
  }

  getArgumentsFromContainer(containerNode: SyntaxNode | null): SyntaxNode[] {
    const children: SyntaxNode[] = [];

    let child = containerNode?.firstChild;
    while (child) {
      children.push(child);
      child = child.nextSibling;
    }

    return children;
  }

  getContainingCommand(node: SyntaxNode | null): SyntaxNode | null {
    return getAncestorStepOrRequest(node);
  }

  getDefaultValueForArgumentDef(argDef: FswCommandArgument, enumMap: EnumMap): string {
    return fswCommandArgDefault(argDef, enumMap);
  }

  getNameNode(stepNode: SyntaxNode | null): SyntaxNode | null {
    return getNameNode(stepNode);
  }

  getVariables(docText: string, tree: Tree): string[] {
    return [
      ...validateVariables(tree.topNode.getChildren(SEQN_NODES.LOCAL_DECLARATION), docText, 'LOCALS').variables,
      ...validateVariables(tree.topNode.getChildren(SEQN_NODES.PARAMETER_DECLARATION), docText, 'INPUT_PARAMS')
        .variables,
    ].map(v => v.name);
  }

  isArgumentNodeOfVariableType(argNode: SyntaxNode | null): boolean {
    return argNode?.name === SEQN_NODES.ENUM;
  }

  isByteArrayArg(): boolean {
    return false;
  }

  nodeTypeEnumCompatible(node: SyntaxNode | null): boolean {
    return node?.name === SEQN_NODES.STRING;
  }

  nodeTypeHasArguments(node: SyntaxNode | null): boolean {
    return node?.name === SEQN_NODES.COMMAND;
  }

  nodeTypeNumberCompatible(node: SyntaxNode | null): boolean {
    return node?.name === SEQN_NODES.NUMBER;
  }

  getTimeTagInfo(seqEditorView: EditorView, commandNode: SyntaxNode | null): TimeTagInfo {
    const node = commandNode?.getChild('TimeTag');

    return (
      node && {
        node,
        text: seqEditorView.state.sliceDoc(node.from, node.to) ?? '',
      }
    );
  }

  getArgumentInfo(
    commandDef: FswCommand | null,
    seqEditorView: EditorView,
    args: SyntaxNode | null,
    argumentDefs: FswCommandArgument[] | undefined,
    parentArgDef: FswCommandArgumentRepeat | undefined,
    phoenixContext: PhoenixContext,
  ): ArgTextDef[] {
    const argArray: ArgTextDef[] = [];
    const precedingArgValues: string[] = [];
    const parentRepeatLength = parentArgDef?.repeat?.arguments.length;

    if (args) {
      for (const node of this.getArgumentsFromContainer(args)) {
        if (node.name === TOKEN_ERROR) {
          continue;
        }

        let argDef: FswCommandArgument | undefined = undefined;
        if (argumentDefs) {
          let argDefIndex = argArray.length;
          if (parentRepeatLength !== undefined) {
            // for repeat args shift index
            argDefIndex %= parentRepeatLength;
          }
          argDef = argumentDefs[argDefIndex];
        }

        if (commandDef && argDef) {
          argDef = this.getArgumentDef(commandDef?.stem, argDef, precedingArgValues, phoenixContext);
        }

        let children: ArgTextDef[] | undefined = undefined;
        if (!!argDef && isFswCommandArgumentRepeat(argDef)) {
          children = this.getArgumentInfo(
            commandDef,
            seqEditorView,
            node,
            argDef.repeat?.arguments,
            argDef,
            phoenixContext,
          );
        }
        const argValue = seqEditorView.state.sliceDoc(node.from, node.to);
        argArray.push({
          argDef,
          children,
          node,
          parentArgDef,
          text: argValue,
        });
        precedingArgValues.push(argValue);
      }
    }
    // add entries for defined arguments missing from editor
    if (argumentDefs) {
      if (!parentArgDef) {
        argArray.push(...argumentDefs.slice(argArray.length).map(argDef => ({ argDef })));
      } else {
        const repeatArgs = parentArgDef?.repeat?.arguments;
        if (repeatArgs) {
          if (argArray.length % repeatArgs.length !== 0) {
            argArray.push(...argumentDefs.slice(argArray.length % repeatArgs.length).map(argDef => ({ argDef })));
          }
        }
      }
    }

    return argArray;
  }

  getCommandDef(
    commandDictionary: CommandDictionary | null,
    librarySequences: LibrarySequenceSignature[],
    stemName: string,
  ): FswCommand | null {
    const commandDefFromCommandDictionary = commandDictionary?.fswCommandMap[stemName];
    if (commandDefFromCommandDictionary) {
      return commandDefFromCommandDictionary;
    } else {
      return null;
    }
  }

  getArgumentDef(
    stem: string,
    defaultArgDef: FswCommandArgument,
    precedingArgs: string[],
    context: PhoenixContext,
  ): FswCommandArgument {
    return defaultArgDef;
  }

  getVariablesInScope(seqEditorView: EditorView, tree: Tree | null, cursorPosition?: number): string[] {
    const globalNames = this.globals.map(globalVariable => globalVariable.name);
    if (tree && cursorPosition !== undefined) {
      const docText = seqEditorView.state.doc.toString();
      return [...globalNames, ...this.getVariables(docText, tree)];
    }
    return globalNames;
  }

  formatArgumentArray(values: string[]): string {
    return ' ' + values.join(' ');
  }
}
