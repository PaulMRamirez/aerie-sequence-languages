import { SyntaxNode } from '@lezer/common';
import type {
  CommandDictionary,
  EnumMap,
  FswCommand,
  FswCommandArgument,
  FswCommandArgumentBoolean,
  FswCommandArgumentEnum,
  FswCommandArgumentFixedString,
  FswCommandArgumentFloat,
  FswCommandArgumentInteger,
  FswCommandArgumentNumeric,
  FswCommandArgumentRepeat,
  FswCommandArgumentUnsigned,
  FswCommandArgumentVarString,
  HwCommand,
} from '@nasa-jpl/plandev-ampcs';
import type { VariableDeclaration } from '@nasa-jpl/seq-json-schema/types';
import { CommandInfoMapper } from '../interfaces/command-info-mapper.js';
import type { EditorView } from '@codemirror/view';

/**
 * Return a default argument for a given argument definition.
 */
export function fswCommandArgDefault(fswCommandArg: FswCommandArgument, enumMap: EnumMap): string {
  const { arg_type: argType } = fswCommandArg;

  switch (argType) {
    case 'boolean': {
      const booleanArg = fswCommandArg as FswCommandArgumentBoolean;
      const { default_value: defaultValue } = booleanArg;

      if (defaultValue !== null) {
        return defaultValue.toLowerCase();
      } else {
        return 'false';
      }
    }
    case 'enum': {
      const enumArg = fswCommandArg as FswCommandArgumentEnum;
      const enumSymbolValue =
        fswCommandArg.default_value ?? enumMap[enumArg.enum_name]?.values[0]?.symbol ?? fswCommandArg.name;
      return enumSymbolValue ? `"${enumSymbolValue}"` : 'UNKNOWN_ENUM';
    }
    case 'fill':
    case 'fixed_string':
      return '""';
    case 'float': {
      const floatArg = fswCommandArg as FswCommandArgumentFloat;
      const { default_value: defaultValue, range } = floatArg;

      if (defaultValue !== null) {
        return `${defaultValue}`;
      } else if (range !== null) {
        const { min } = range;
        return `${min}`;
      } else {
        return '0.0';
      }
    }
    case 'integer': {
      const intArg = fswCommandArg as FswCommandArgumentInteger;
      const { default_value: defaultValue, range } = intArg;

      if (defaultValue !== null) {
        return `${defaultValue}`;
      } else if (range !== null) {
        const { min } = range;
        return `${min}`;
      } else {
        return '0';
      }
    }
    case 'numeric': {
      const numericArg = fswCommandArg as FswCommandArgumentNumeric;
      const { default_value: defaultValue, range } = numericArg;

      if (defaultValue !== null) {
        return `${defaultValue}`;
      } else if (range !== null) {
        const { min } = range;
        return `${min}`;
      } else {
        return '0.0';
      }
    }
    case 'repeat': {
      const repeatArg = fswCommandArg as FswCommandArgumentRepeat;
      const { repeat } = repeatArg;

      let defaultRepeatArg = '[';
      let totalRepeatedArgs = 0;

      if (repeat) {
        const { min } = repeat;

        do {
          let repeatedArg = '';

          for (let i = 0; i < repeat.arguments.length; ++i) {
            const arg = repeat.arguments[i];
            const argValue = fswCommandArgDefault(arg, enumMap);
            repeatedArg += `${argValue}`;

            if (i !== repeat.arguments.length - 1) {
              repeatedArg += ' ';
            }
          }

          defaultRepeatArg += repeatedArg;
          ++totalRepeatedArgs;

          // If we are going to add another repeated arg, make sure to add a comma.
          if (min !== null && totalRepeatedArgs < min) {
            defaultRepeatArg += ' ';
          }
        } while (min !== null && totalRepeatedArgs < min);
      }

      defaultRepeatArg += ']';

      return defaultRepeatArg;
    }
    case 'time':
      return '0';
    case 'unsigned': {
      const numericArg = fswCommandArg as FswCommandArgumentUnsigned;
      const { default_value: defaultValue, range } = numericArg;

      if (defaultValue !== null) {
        return `${defaultValue}`;
      } else if (range !== null) {
        const { min } = range;
        return `${min}`;
      } else {
        return '0';
      }
    }
    case 'var_string': {
      const varStringArg = fswCommandArg as FswCommandArgumentVarString;
      const { default_value: defaultValue } = varStringArg;

      if (defaultValue) {
        return defaultValue;
      } else {
        return '""';
      }
    }
    default:
      return '';
  }
}

export function isFswCommand(command: FswCommand | HwCommand): command is FswCommand {
  return (command as FswCommand).type === 'fsw_command';
}

export function isHwCommand(command: FswCommand | HwCommand): command is HwCommand {
  return (command as HwCommand).type === 'hw_command';
}

export function isFswCommandArgumentEnum(arg: FswCommandArgument): arg is FswCommandArgumentEnum {
  return arg.arg_type === 'enum';
}

export function isFswCommandArgumentInteger(arg: FswCommandArgument): arg is FswCommandArgumentInteger {
  return arg.arg_type === 'integer';
}

export function isFswCommandArgumentFloat(arg: FswCommandArgument): arg is FswCommandArgumentFloat {
  return arg.arg_type === 'float';
}

export function isFswCommandArgumentNumeric(arg: FswCommandArgument): arg is FswCommandArgumentNumeric {
  return arg.arg_type === 'numeric';
}

export function isFswCommandArgumentUnsigned(arg: FswCommandArgument): arg is FswCommandArgumentUnsigned {
  return arg.arg_type === 'unsigned';
}

export function isFswCommandArgumentRepeat(arg: FswCommandArgument): arg is FswCommandArgumentRepeat {
  return arg.arg_type === 'repeat';
}

export function isFswCommandArgumentVarString(arg: FswCommandArgument): arg is FswCommandArgumentVarString {
  return arg.arg_type === 'var_string';
}

export function isFswCommandArgumentFixedString(arg: FswCommandArgument): arg is FswCommandArgumentFixedString {
  return arg.arg_type === 'fixed_string';
}

export function isFswCommandArgumentBoolean(arg: FswCommandArgument): arg is FswCommandArgumentBoolean {
  return arg.arg_type === 'boolean';
}

export function isHexValue(argText: string) {
  return /^0x[\da-f]+$/i.test(argText);
}

export function addDefaultArgs(
  commandDictionary: CommandDictionary,
  view: EditorView,
  commandNode: SyntaxNode,
  argDefs: FswCommandArgument[],
  commandInfoMapper: CommandInfoMapper,
) {
  const insertPosition = commandInfoMapper.getArgumentAppendPosition(commandNode);
  if (insertPosition !== undefined) {
    const str = commandInfoMapper.formatArgumentArray(
      argDefs.map(argDef => fswCommandArgDefault(argDef, commandDictionary.enumMap)),
      commandNode,
    );
    const transaction = view.state.update({
      changes: { from: insertPosition, insert: str },
    });
    view.dispatch(transaction);
  }
}

export function getDefaultVariableArgs(parameters: VariableDeclaration[]): string[] {
  return parameters.map(parameter => {
    switch (parameter.type) {
      case 'STRING':
        return `"${parameter.name}"`;
      case 'FLOAT':
        return parameter.allowable_ranges && parameter.allowable_ranges.length > 0
          ? parameter.allowable_ranges[0].min
          : 0;
      case 'INT':
      case 'UINT':
        return parameter.allowable_ranges && parameter.allowable_ranges.length > 0
          ? parameter.allowable_ranges[0].min
          : 0;
      case 'ENUM':
        return parameter.allowable_values && parameter.allowable_values.length > 0
          ? `"${parameter.allowable_values[0]}"`
          : parameter.enum_name
            ? `"${parameter.enum_name}"`
            : 'UNKNOWN';
      default:
        return `ERROR:"${parameter.name}"`;
    }
  }) as string[];
}

export function addDefaultVariableArgs(
  parameters: VariableDeclaration[],
  view: EditorView,
  commandNode: SyntaxNode,
  commandInfoMapper: CommandInfoMapper,
) {
  const insertPosition = commandInfoMapper.getArgumentAppendPosition(commandNode);
  if (insertPosition !== undefined) {
    const str = commandInfoMapper.formatArgumentArray(getDefaultVariableArgs(parameters), commandNode);
    const transaction = view.state.update({
      changes: { from: insertPosition, insert: str },
    });
    view.dispatch(transaction);
  }
}

export function parseNumericArg(argText: string, dictArgType: 'float' | 'integer' | 'numeric' | 'unsigned') {
  switch (dictArgType) {
    case 'float':
    case 'numeric':
      return parseFloat(argText);
  }
  return parseInt(argText);
}

export function decodeInt32Array(encoded: string[]) {
  return encoded
    .map(charAsHex => {
      const n = Number(charAsHex);
      return String.fromCodePoint((n >> 24) & 0xff, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff);
    })
    .join('');
}

export function getAllEnumSymbols(enumMap: EnumMap, enumName: string): undefined | string[] {
  return enumMap[enumName]?.values.map(({ symbol }) => symbol);
}
