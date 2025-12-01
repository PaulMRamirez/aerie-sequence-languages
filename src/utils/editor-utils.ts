import { CommandDictionary, FswCommand, FswCommandArgument, HwCommand } from '@nasa-jpl/plandev-ampcs';
import { getAllEnumSymbols } from './sequence-utils.js';

export function buildAmpcsCommandTooltip(command: FswCommand | HwCommand): string[] {
  let commandExample: string = '';
  if (command.type === 'hw_command') {
    commandExample = command.stem;
  } else if (command.type === 'fsw_command') {
    const commandArgs = command.arguments.map(({ arg_type, name }) => `${name}: ${arg_type}`);
    if (commandArgs.length) {
      commandExample = `${command.stem}(${commandArgs.join(', ')})`;
    } else {
      commandExample = command.stem;
    }
  }

  return [commandExample, command.description];
}

export function buildAmpcsArgumentTooltip(
  arg: FswCommandArgument,
  dictionary: CommandDictionary | null,
  maxEnumsToDisplay: number = 20,
): string[] {
  const displayLines: string[] = [`Name: ${arg.name}`, `Type: ${arg.arg_type}`, `Description: ${arg.description}`];

  // TODO replace all these big if statements with waterfalling switch/case
  if (
    arg.arg_type === 'boolean' ||
    arg.arg_type === 'enum' ||
    arg.arg_type === 'float' ||
    arg.arg_type === 'integer' ||
    arg.arg_type === 'numeric' ||
    arg.arg_type === 'time' ||
    arg.arg_type === 'unsigned' ||
    arg.arg_type === 'var_string'
  ) {
    displayLines.push(`Default Value: ${arg.default_value ?? 'None'}`);
  }

  if (
    arg.arg_type === 'float' ||
    arg.arg_type === 'integer' ||
    arg.arg_type === 'numeric' ||
    arg.arg_type === 'unsigned'
  ) {
    displayLines.push(`Range: ${arg.range ? `[${arg.range.min}, ${arg.range.max}]` : 'None'}`);
  }

  if (
    arg.arg_type === 'float' ||
    arg.arg_type === 'integer' ||
    arg.arg_type === 'numeric' ||
    arg.arg_type === 'time' ||
    arg.arg_type === 'unsigned'
  ) {
    displayLines.push(`Units: ${arg.units === 'none' ? 'None' : arg.units}`);
  }

  if (
    arg.arg_type === 'boolean' ||
    arg.arg_type === 'enum' ||
    arg.arg_type === 'float' ||
    arg.arg_type === 'integer' ||
    arg.arg_type === 'numeric' ||
    arg.arg_type === 'time' ||
    arg.arg_type === 'unsigned'
  ) {
    displayLines.push(`Bit Length: ${arg.bit_length ?? 'None'}`);
  }

  if (arg.arg_type === 'repeat' || arg.arg_type === 'var_string') {
    displayLines.push(`Prefix Bit Length: ${arg.prefix_bit_length ?? 'None'}`);
  }

  if (arg.arg_type === 'enum') {
    displayLines.push(`Enum Name: ${arg.enum_name}`);
    if (dictionary) {
      let enumSymbolsDisplayStr: string = '';

      const enumValues = getAllEnumSymbols(dictionary.enumMap, arg.enum_name);
      const values = enumValues ?? [];
      enumSymbolsDisplayStr = values.slice(0, maxEnumsToDisplay).join('  |  ');
      const numHiddenValues = values.length - maxEnumsToDisplay;
      if (numHiddenValues > 0) {
        enumSymbolsDisplayStr += ` ... ${numHiddenValues} more`;
      }
      displayLines.push(`Enum Symbols: ${enumSymbolsDisplayStr}`);
    }
  }

  return displayLines;
}
