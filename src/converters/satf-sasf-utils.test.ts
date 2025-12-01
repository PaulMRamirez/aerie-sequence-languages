import { describe, expect, it } from 'vitest';
import { satfToSeqn, sasfToSeqn, seqnToSATF, seqnToSASF } from './satf-sasf-utils.js';
import { ParsedSatf, ParsedSeqn } from '../languages/satf/types/types.js';

//-- SATF to Seqn Test---
describe('satfToSeqn', () => {
  it('should return empty header and sequences for empty SATF string', async () => {
    const satf = '';
    const result = await satfToSeqn(satf);
    expect(result).toEqual({ metadata: '', sequences: [] });
  });

  it('should return empty for invalid SATF string', async () => {
    const satf = ' invalid satf string ';

    const result = await satfToSeqn(satf);
    expect(result).toEqual({ metadata: '', sequences: [] } as ParsedSeqn);
  });

  it('should parse valid SATF string with header and sequences', async () => {
    const satf = `
      CCS3ZF0000100000001NJPL3KS0L015$$MARK$$;
      MISSION_NAME = TEST;
      CCSD3RE00000$$MARK$$NJPL3IF0M01400000001;
      $$TEST     SPACECRAFT ACTIVITY TYPE FILE
      ************************************************************
      *PROJECT          TEST
      *SPACECRAFT       000
      *Input files used:
      *File Type	Last modified			File name
      *SC_MODEL	Thu Jan 01 00:00:00 UTC 1970	/Default Sequence Project/SC_MODEL/
      ************************************************************
      $$EOH
      absolute(temp,\\temp\\)
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('sequences');
    expect(result.sequences).toBeInstanceOf(Array);
  });

  it('should return empty sequences for SATF string with missing sequences', async () => {
    const satf = `
      CCS3ZF0000100000001NJPL3KS0L015$$MARK$$;
      MISSION_NAME = TEST;
      CCSD3RE00000$$MARK$$NJPL3IF0M01400000001;
      $$TEST     SPACECRAFT ACTIVITY TYPE FILE
      ************************************************************
      *PROJECT          TEST
      *SPACECRAFT       000
      *Input files used:
      *File Type	Last modified			File name
      *SC_MODEL	Thu Jan 01 00:00:00 UTC 1970	/Default Sequence Project/SC_MODEL/
      ************************************************************
      $$EOH
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('metadata');
    expect(result.sequences).toEqual([]);
  });

  it('should return empty header for SATF string with missing header', async () => {
    const satf = `
      $$EOH
      absolute(temp,\\temp\\)
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.metadata).toEqual('');
  });

  it('should return valid sequence with models', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, EPOCH, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES, \\x=1,z=1.1,y="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('test');
    expect(result.sequences[0].steps)
      .toStrictEqual(`E00:01:00 01VV param6 10 false "abc" # This command turns, to correct position.
@METADATA "INCLUSION_CONDITION" "param_rate == receive_rate"
@METADATA "DRAW" "VERTICAL"
@MODEL "x" 1 "00:00:00"
@MODEL "z" 1.1 "00:00:00"
@MODEL "y" "abc" "00:00:00"`);
  });

  it('should throw for invalid time tag', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, MARS_TIME, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES, \\x=1,z=1.1,y="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    try {
      await satfToSeqn(satf);
    } catch (error) {
      expect(error.message).toStrictEqual(
        "Invalid Time Tag 'MARS_TIME' found in SATF/SASF. Aborting SATF/SASF -> Seqn conversion...",
      );
    }
  });

  it('should throw for no time', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, EPOCH, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES, \\x=1,z=1.1,y="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    try {
      await satfToSeqn(satf);
    } catch (error) {
      expect(error.message).toStrictEqual('No time found in SATF/SASF. Aborting SATF/SASF -> Seqn conversion...');
    }
  });

  it('should return valid sequence and models times with 00:00:00 for durations', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, EPOCH, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES,\\a=1,GLOBAL::b=1.1,c="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('test');
    expect(result.sequences[0].steps)
      .toStrictEqual(`E00:01:00 01VV param6 10 false "abc" # This command turns, to correct position.
@METADATA "INCLUSION_CONDITION" "param_rate == receive_rate"
@METADATA "DRAW" "VERTICAL"
@MODEL "a" 1 "00:00:00"
@MODEL "GLOBAL::b" 1.1 "00:00:00"
@MODEL "c" "abc" "00:00:00"`);
  });

  it('should return valid sequence and models times with single duration spread across all models', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, EPOCH, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES,\\a=1,GLOBAL::b=1.1,c="abc",00:00:01\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    try {
      const result = await satfToSeqn(satf);
      expect(result).toHaveProperty('sequences');
      expect(result.sequences[0].name).toStrictEqual('test');
      expect(result.sequences[0].steps)
        .toStrictEqual(`E00:01:00 01VV param6 10 false "abc" # This command turns, to correct position.
@METADATA "INCLUSION_CONDITION" "param_rate == receive_rate"
@METADATA "DRAW" "VERTICAL"
@MODEL "a" 1 "00:00:01"
@MODEL "GLOBAL::b" 1.1 "00:00:01"
@MODEL "c" "abc" "00:00:01"`);
    } catch (exception) {
      console.log('hi');
    }
  });

  it('should return an error of mismatch modeling times', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, EPOCH, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES,\\a=1,GLOBAL::b=1.1,c="abc",00:00:01,00:00:02\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    try {
      await satfToSeqn(satf);
    } catch (error) {
      expect(error.message).toStrictEqual('Mismatch of models to durations');
    }
  });

  it('should return valid sequence and model times with one duration per variable with two variables', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            0, SCHEDULED_TIME, \\00:01:00\\, EPOCH, 
            ASSUMED_MODEL_VALUES,\\a=1,GLOBAL::b=1.1,00:00:01,00:00:02\\,
            CMD (),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
      const result = await satfToSeqn(satf);
      expect(result).toHaveProperty('sequences');
      expect(result.sequences[0].name).toStrictEqual('test');
      expect(result.sequences[0].steps)
        .toStrictEqual(`E00:01:00 CMD
@MODEL "a" 1 "00:00:01"
@MODEL "GLOBAL::b" 1.1 "00:00:02"`);
  });

  it('should return valid sequence and model times with one duration per variable with three variables', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            0, SCHEDULED_TIME, \\00:01:00\\, EPOCH, 
            ASSUMED_MODEL_VALUES,\\a=1,GLOBAL::b=1.1,c="abc",00:00:01,00:00:02,00:00:03\\,
            CMD (),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
      const result = await satfToSeqn(satf);
      expect(result).toHaveProperty('sequences');
      expect(result.sequences[0].name).toStrictEqual('test');
      expect(result.sequences[0].steps)
        .toStrictEqual(`E00:01:00 CMD
@MODEL "a" 1 "00:00:01"
@MODEL "GLOBAL::b" 1.1 "00:00:02"
@MODEL "c" "abc" "00:00:03"`);
  });

  it('should handle multiline comments', async () => {
    const satf = `
    $$EOH
    ABSOLUTE_SEQUENCE(test,\\testv01\\,
        STEPS,
        command (
          1, SCHEDULED_TIME, \\00:01:00\\, FROM_PREVIOUS_START, 
          COMMENT,\\"hi  : bye",
                 "A   : pickup shoe",
                 "B: put on shoe",
                 "C: tie shoe",
                 "cumulative_time is     1 sec (2024-00T01:00:00)"\\,
          echo),
        end
      )
    $$EOF
  `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('test');
    expect(result.sequences[0].steps).toStrictEqual(
      `R00:01:00 echo # "hi  : bye", "A   : pickup shoe", "B: put on shoe", "C: tie shoe", "cumulative_time is     1 sec (2024-00T01:00:00)"`,
    );
  });

  it('should return multiple sequence with models', async () => {
    const satf = `
      $$EOH
      ABSOLUTE_SEQUENCE(test,\\testv01\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, FROM_ACTIVITY_START, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            DRAW, \\VERTICAL\\,
            NTEXT, \\"this is a ntext with quotes"\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES, \\x=1,z=1.1,y="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        ),
      RT_on_board_block(test,\\testv01\\,
      RETURN_TYPE, \\VOID\\,
      SEQGEN_AUTO_START_OR_LOAD_TIMES, \\S$BEGIN\\,
      VIRTUAL_CHANNEL, \\VC2\\,
      ON_BOARD_FILENAME, \\/tmp/dir/file.seq\\,
      FLAGS,\\one | two | three\\,
      HELP,\\this is help text\\,
      ON_BOARD_PATH,\\path/to/file.txt\\,
          STEPS,
          command (
            3472, SCHEDULED_TIME, \\00:01:00\\, FROM_ACTIVITY_START,
            NTEXT, \\this is a ntext without quotes\\,
            COMMENT, \\This command turns, to correct position.\\, ASSUMED_MODEL_VALUES, \\x=1,z=1.1,y="abc"\\,
            01VV (param6, 10, false, "abc"),
            PROCESSORS, "PRI", end),
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences.length).toBe(2);
    expect(result.sequences[0].name).toStrictEqual('test');
    expect(result.sequences[0].steps)
      .toStrictEqual(`B00:01:00 01VV param6 10 false "abc" # This command turns, to correct position.
@METADATA "INCLUSION_CONDITION" "param_rate == receive_rate"
@METADATA "DRAW" "VERTICAL"
@METADATA "NTEXT" "\\"this is a ntext with quotes\\""
@MODEL "x" 1 "00:00:00"
@MODEL "z" 1.1 "00:00:00"
@MODEL "y" "abc" "00:00:00"`);

    expect(result.sequences[1].metadata).toStrictEqual(`@METADATA "VIRTUAL_CHANNEL" "VC2"
@METADATA "ON_BOARD_FILENAME" "/tmp/dir/file.seq"
@METADATA "ON_BOARD_PATH" "path/to/file.txt"
@METADATA "SEQGEN" "S$BEGIN"`);
    expect(result.sequences[1].steps)
      .toStrictEqual(`B00:01:00 01VV param6 10 false "abc" # This command turns, to correct position.
@METADATA "NTEXT" "this is a ntext without quotes"
@MODEL "x" 1 "00:00:00"
@MODEL "z" 1.1 "00:00:00"
@MODEL "y" "abc" "00:00:00"`);
  });

  it('should use globals', async () => {
    const sasf = `
      $$EOH
      RT_on_board_block(test,\\testv01\\,
          STEPS,
          command (
            1, SCHEDULED_TIME, \\00:01:00\\, FROM_PREVIOUS_START, INCLUSION_CONDITION,
            ECHO ("GLOBAL::GlobalG", 10, "NOGLOBAL")
            ),
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(sasf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('test');
    expect(result.sequences[0].steps).toStrictEqual(`R00:01:00 ECHO "GLOBAL::GlobalG" 10 "NOGLOBAL"`);
  });

  it('Parameters', async () => {
    const satf = `
      $$EOH
      RT_on_board_block(/start.txt,\\start\\,
        PARAMETERS,
        unsigned_decimal(
          TYPE,UNSIGNED_DECIMAL,
          RANGE,\\10.01...99.99\\,
          RANGE,\\100...199.99\\,
        ),
        signed_decimal(
          TYPE,SIGNED_DECIMAL,
          DEFAULT, 10
          RANGE,\\10, 90000, 120000, 150000, 360001\\,
          HELP, \\This is a help\\
        ),
        hex(
          TYPE,HEXADECIMAL,
          RANGE,\\0x00...0xff\\
        ),
        octal(
          TYPE,OCTAL,
          DEFAULT, 10
          RANGE,\\0, 1, 2, 3, 4, 5, 6, 7\\
        ),
        binary(
          TYPE,BINARY,
          RANGE,\\0, 1\\),
        engine(
          TYPE,ENGINEERING,
        ),
        time(
          TYPE,TIME,
          RANGE,\\0T00:00:00...100T00:00:00\\
        ),
        duration(
          TYPE,DURATION,
          DEFAULT, \\00:01:00\\
        ),
        enum(
          TYPE,STRING,
          ENUM_NAME,\\STORE_NAME\\,
          DEFAULT, \\BOB_HARDWARE\\,
          RANGE,\\BOB_HARDWARE, SALLY_FARM, "TIM_FLOWERS"\\
        ),
        string(
          TYPE,STRING,
          DEFAULT, abc
        ),
        quoted_string(
          TYPE,QUOTED_STRING,
          DEFAULT, "abc"
          RANGE,\\"abc", "123"\\
        ),
        true(
            TYPE,UNSIGNED_DECIMAL
        ),
        end,
        STEPS,
          command (
            1, SCHEDULED_TIME, \\00:01:00\\, FROM_ACTIVITY_START,
            NOOP()
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('start.txt');
    expect(result.sequences[0].inputParameters).toStrictEqual(`@INPUT_PARAMS_BEGIN
unsigned_decimal UINT "10.01...99.99, 100...199.99"
signed_decimal INT "" "10, 90000, 120000, 150000, 360001"
hex STRING "0x00...0xff"
octal STRING "" "0, 1, 2, 3, 4, 5, 6, 7"
binary STRING "" "0, 1"
engine FLOAT
time STRING "0T00:00:00...100T00:00:00"
duration STRING
enum ENUM STORE_NAME "" "BOB_HARDWARE, SALLY_FARM, TIM_FLOWERS"
string ENUM
quoted_string STRING "" "abc, 123"
true UINT
@INPUT_PARAMS_END`);

    expect(result.sequences[0].steps).toStrictEqual(`B00:01:00 NOOP`);
  });

  it('Quoted Parameters', async () => {
    const satf = `
      $$EOH
      RT_on_board_block(/start.txt,\\start\\,
        PARAMETERS,
        attitude_spec(
          TYPE,STRING,
          ENUM_NAME,\\STORE_NAME\\,
          RANGE,\\"BOB_HARDWARE", "SALLY_FARM", "TIM_FLOWERS"\\
        ),
        end,
        STEPS,
          command (
            1, SCHEDULED_TIME, \\00:01:00\\, FROM_ACTIVITY_START, INCLUSION_CONDITION, \\param_rate == receive_rate\\,
            ECHO ("abc","attitude_spec")
          end
        )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('start.txt');
    expect(result.sequences[0].inputParameters).toStrictEqual(`@INPUT_PARAMS_BEGIN
attitude_spec ENUM STORE_NAME "" "BOB_HARDWARE, SALLY_FARM, TIM_FLOWERS"
@INPUT_PARAMS_END`);

    expect(result.sequences[0].steps).toStrictEqual(`B00:01:00 ECHO "abc" "attitude_spec"
@METADATA "INCLUSION_CONDITION" "param_rate == receive_rate"`);
  });

  it('Verify Time types', async () => {
    const satf = `
      $$EOH
      RT_on_board_block(/start.txt,\\start\\,
        STEPS,
          command(1,
            SCHEDULED_TIME,\\2025-001T10:00:00\\,ABSOLUTE,
            CMD
          ),
          command(2,
            SCHEDULED_TIME,\\10:00:00\\,FROM_PREVIOUS_START,
            CMD
          ),
          command(3,
            SCHEDULED_TIME,\\00:08:20\\,FROM_PREVIOUS_START,
            CMD
          ),
          command(4,
            SCHEDULED_TIME,\\-03:00:00\\,EPOCH,
            CMD
          ),
          command(5,
            SCHEDULED_TIME,\\00:00:01\\,EPOCH,
            CMD
          ),
          command(6,
            SCHEDULED_TIME,\\00:08:00\\,FROM_REQUEST_START,
            CMD
          ),
          command(7,
            SCHEDULED_TIME,\\00:00:01\\,WAIT_PREVIOUS_END,
            CMD
          ),
        end
      )
      $$EOF
    `;
    const result = await satfToSeqn(satf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('start.txt');
    expect(result.sequences[0].inputParameters).toStrictEqual('');

    expect(result.sequences[0].steps).toStrictEqual(`A2025-001T10:00:00 CMD
R10:00:00 CMD
R00:08:20 CMD
E-03:00:00 CMD
E00:00:01 CMD
B00:08:00 CMD
C CMD`);
  });
});

//--- SASF To Seqn Test ----
describe('sasfToSeqn', () => {
  it('should return empty header and sequences for empty SATF string', async () => {
    const sasf = '';
    const result = await sasfToSeqn(sasf);
    expect(result).toEqual({ metadata: '', sequences: [] } as ParsedSeqn);
  });

  it('should return empty invalid SATF string', async () => {
    const sasf = ' invalid satf string ';

    const result = await sasfToSeqn(sasf);
    expect(result).toEqual({ metadata: '', sequences: [] } as ParsedSeqn);
  });

  it('should parse valid SASF string with header and sequences', async () => {
    const sasf = `
      $$EOH
      CCS3ZF0000100000001NJPL3KS0L015$$MARK$$;
      MISSION_NAME = TEST;
      CCSD3RE00000$$MARK$$NJPL3IF0M01400000001;
      $$TEST     SPACECRAFT ACTIVITY TYPE FILE
      ************************************************************
      *PROJECT          TEST
      *SPACECRAFT       000
      *Input files used:
      *File Type	Last modified			File name
      *SC_MODEL	Thu Jan 01 00:00:00 UTC 1970	/Default Sequence Project/SC_MODEL/
      ************************************************************
      $$EOH
      $$EOD
      $$EOF
    `;
    const result = await sasfToSeqn(sasf);
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('sequences');
    expect(result.sequences).toBeInstanceOf(Array);
  });

  it('should return valid request with models', async () => {
    const sasf = `
      $$EOH
      $$EOD
      request(VFT2_REQUEST_01,
        START_TIME, 2024-266T19:59:57,
        REQUESTOR, "me",
        PROCESSOR, "VC2AB",
        KEY, "No_Key")

        command(1,
          SCHEDULED_TIME,\\00:00:01.123456\\,FROM_PREVIOUS_START,
          COMMENT,\\"this "is a" comment"\\,
          FILE_REMOVE("/eng/seq/awesome.abs", TRUE)
        ),
        command(2,
          SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
          COMMENT,\\cumulative_time is "2 sec"\\,
          USER_SEQ_ECHO("SEQ awesome COMPLETION IN 2 MINS")
        ),
        end;
      $$EOF
    `;
    const result = await sasfToSeqn(sasf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('VFT2_REQUEST_01');
    expect(result.sequences[0].requests).toStrictEqual(
      `A2024-266T19:59:57 @REQUEST_BEGIN("VFT2_REQUEST_01")
  R00:00:01.123456 FILE_REMOVE "/eng/seq/awesome.abs" TRUE # "this "is a" comment"
  R00:00:01 USER_SEQ_ECHO "SEQ awesome COMPLETION IN 2 MINS" # cumulative_time is "2 sec"
@REQUEST_END
@METADATA "REQUESTOR" "me"
@METADATA "PROCESSOR" "VC2AB"
@METADATA "KEY" "No_Key"
`,
    );
  });

  it('should return valid G time type', async () => {
    const sasf = `
      $$EOH
      $$EOD
      request(name,
        START_TIME, \\-00:00:00.100\\,GROUND_EPOCH )
          command(1,
            SCHEDULED_TIME,\\2025-001T10:00:00\\,ABSOLUTE,
            CMD
          ),
          command(2,
            SCHEDULED_TIME,\\10:00:00\\,FROM_PREVIOUS_START,
            CMD
          ),
          command(3,
            SCHEDULED_TIME,\\00:08:20\\,FROM_PREVIOUS_START,
            CMD
          ),
          command(4,
            SCHEDULED_TIME,\\-03:00:00\\,EPOCH,
            CMD
          ),
          command(5,
            SCHEDULED_TIME,\\00:00:01\\,EPOCH,
            CMD
          ),
          command(6,
            SCHEDULED_TIME,\\00:08:00\\,FROM_REQUEST_START,
            CMD
          ),
      end;
      $$EOF
    `;
    const result = await sasfToSeqn(sasf);
    expect(result).toHaveProperty('sequences');
    expect(result.sequences[0].name).toStrictEqual('name');
    expect(result.sequences[0].requests).toStrictEqual(
      `G-00:00:00.100 @REQUEST_BEGIN("name")
  A2025-001T10:00:00 CMD
  R10:00:00 CMD
  R00:08:20 CMD
  E-03:00:00 CMD
  E00:00:01 CMD
  B00:08:00 CMD
@REQUEST_END
`,
    );
  });
});

//--- Seqn to SATF Test ----
describe('seqnToSatf', () => {
  it('should return empty header and empty SATF string', async () => {
    const result = await seqnToSATF('');
    expect(result).toEqual({ header: {} } as ParsedSatf);
  });

  it('should have headers and empty SATF string', async () => {
    const result = await seqnToSATF(`
@METADATA "DATA_SET_ID" "SPACECRAFT_ACTIVITY_TYPE"
@METADATA "MISSION_NAME" "BANANNA"
@METADATA "SPACECRAFT_NAME" "BANANNA_BOT"
@METADATA "FILE_NAME" "test.satf"
@METADATA "PRODUCER_ID" "PLANDEV"
@METADATA "PRODUCT_CREATION_TIME" "2024-045T23:44:06"

@METADATA "VIRTUAL_CHANNEL" "VC2AB"
@METADATA "ON_BOARD_FILENAME" "/path/test.mod"
    `);
    expect(result).toEqual({
      header: {
        DATA_SET_ID: '"SPACECRAFT_ACTIVITY_TYPE"',
        FILE_NAME: '"test.satf"',
        MISSION_NAME: '"BANANNA"',
        ON_BOARD_FILENAME: '"/path/test.mod"',
        PRODUCER_ID: '"PLANDEV"',
        PRODUCT_CREATION_TIME: '"2024-045T23:44:06"',
        SPACECRAFT_NAME: '"BANANNA_BOT"',
        VIRTUAL_CHANNEL: '"VC2AB"',
      },
    } as ParsedSatf);
  });

  it('should return commented metadata', async () => {
    const result = await seqnToSATF(
      `# username=rrgoetz
# name=test.seq

C ECHO "HI"
`,
    );
    expect(result.header).toEqual({
      name: 'test.seq',
      username: 'rrgoetz',
    });
  });

  it('should return variables', async () => {
    const result = await seqnToSATF(`
    @LOCALS_BEGIN
    time UINT
    alpha STRING
    level FLOAT "10.01...99.99, 100...199.99" "1,2,4"
    SIZE INT "-1...20, 40..."
    STORE ENUM STORE_NAME "" "MACY, ROSS, BEST_BUY"
    CHARGE
    true UINT
    @LOCALS_END
`);
    expect(result).toEqual({
      header: {},
      variables: `VARIABLES,
	time(
		TYPE,UNSIGNED_DECIMAL
	),
	alpha(
		TYPE,QUOTED_STRING
	),
	level(
		TYPE,FLOAT,
		RANGE,\\10.01...99.99\\,
		RANGE,\\100...199.99\\,
		RANGE,\\1,2,4\\
	),
	SIZE(
		TYPE,SIGNED_DECIMAL,
		RANGE,\\-1...20\\,
		RANGE,\\40...Infinity\\
	),
	STORE(
		TYPE,STRING,
		ENUM_NAME,\\STORE_NAME\\,
		RANGE,\\MACY,ROSS,BEST_BUY\\
	),
	CHARGE(
		TYPE,SIGNED_DECIMAL
	),
	true(
		TYPE,UNSIGNED_DECIMAL
	),
end`,
    } as ParsedSatf);
  });

  it('should return Parameters', async () => {
    const result = await seqnToSATF(`
    @INPUT_PARAMS_BEGIN
    time UINT
    alpha STRING
    level FLOAT "10.01...99.99, 100...199.99" "1,2,4"
    SIZE INT "-1...20, 40..."
    STORE ENUM STORE_NAME "" "MACY, ROSS, BEST_BUY"
    CHARGE
    @INPUT_PARAMS_END
`);
    expect(result).toEqual({
      header: {},
      parameters: `PARAMETERS,
	time(
		TYPE,UNSIGNED_DECIMAL
	),
	alpha(
		TYPE,QUOTED_STRING
	),
	level(
		TYPE,FLOAT,
		RANGE,\\10.01...99.99\\,
		RANGE,\\100...199.99\\,
		RANGE,\\1,2,4\\
	),
	SIZE(
		TYPE,SIGNED_DECIMAL,
		RANGE,\\-1...20\\,
		RANGE,\\40...Infinity\\
	),
	STORE(
		TYPE,STRING,
		ENUM_NAME,\\STORE_NAME\\,
		RANGE,\\MACY,ROSS,BEST_BUY\\
	),
	CHARGE(
		TYPE,SIGNED_DECIMAL
	),
end`,
    } as ParsedSatf);
  });

  it('should return satf steps', async () => {
    const result = await seqnToSATF(`
    R00:00:01.000 CMD true 1.45
    R00:00:01.000 CMD "OFF"
    R00:00:01.000 CMD .01`);
    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
		CMD(TRUE, 1.45)
	),
	command(2,
		SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
		CMD("OFF")
	),
	command(3,
		SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
		CMD(.01)
	),
end`);
  });

  it('should return satf steps with comments', async () => {
    const result = await seqnToSATF(`
    R00:00:01.000 CMD true 1 #I am a description`);
    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
		COMMENT,\\I am a description\\,
		CMD(TRUE, 1)
	),
end`);
  });

  it('should return satf steps with variables as args', async () => {
    const result = await seqnToSATF(`
    @INPUT_PARAMS_BEGIN
      temperature STRING
    @INPUT_PARAMS_END
    @LOCALS_BEGIN
      level FLOAT "10.01...99.99, 100...199.99" "1,2,4"
    @LOCALS_END

    A2025-001T00:00:01.000 CMD temperature level #I am a description`);

    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\2025-001T00:00:01.000\\,ABSOLUTE,
		COMMENT,\\I am a description\\,
		CMD(temperature, level)
	),
end`);
  });

  it('should return satf steps with global as args and user_seq command', async () => {
    const result = await seqnToSATF(
      `
    @INPUT_PARAMS_BEGIN
      temperature STRING
    @INPUT_PARAMS_END

    E00:00:01.010 CMD temperature level #I am a description
    B-10 USER_SEQ_DIR temperature #I am a description`,
      ['level'],
    );

    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:01.010\\,EPOCH,
		COMMENT,\\I am a description\\,
		CMD(temperature, level)
	),
	command(2,
		SCHEDULED_TIME,\\-00:00:10\\,FROM_REQUEST_START,
		COMMENT,\\I am a description\\,
		USER_SEQ_DIR(temperature)
	),
end`);
  });

  it('should return supported metadata NTEXT', async () => {
    const result = await seqnToSATF(`
    C NO_OP #NTEXT is supported "metadata"
    @METADATA "NTEXT" "this is a place for notes"`);

    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:00\\,WAIT_PREVIOUS_END,
		NTEXT,\\this is a place for notes\\,
		COMMENT,\\NTEXT is supported "metadata"\\,
		NO_OP()
	),
end`);
  });

  it('should return supported modeling time', async () => {
    const result = await seqnToSATF(`
    C NO_OP #NTEXT is supported "metadata"
    @METADATA "NTEXT" "this is a place for notes"
    @MODEL "x" 1 "00:00:00"
    @MODEL "y" "abc" "00:00:01"
    @MODEL "z" true "00:00:02"
    `);

    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:00\\,WAIT_PREVIOUS_END,
		NTEXT,\\this is a place for notes\\,
		COMMENT,\\NTEXT is supported "metadata"\\,
		ASSUMED_MODEL_VALUES,\\x=1,y="abc",z=true,00:00:00,00:00:01,00:00:02\\,
		NO_OP()
	),
end`);
  });

  it('Throw error for no time found', async () => {
    try {
      const result = await seqnToSATF(`
    CMD true 1.45`);
    } catch (error) {
      expect(error.message).toStrictEqual(
        'No time found for command CMD true 1.45. Aborting Seqn -> SATF/SASF conversion...',
      );
    }
  });

  it('Throw error for invalid time found', async () => {
    try {
      const result = await seqnToSATF(`
    R0:1:0 CMD true 1.45`);
    } catch (error) {
      expect(error.message).toStrictEqual(
        'No time found for command R0:1:0 CMD true 1.45. Aborting Seqn -> SATF/SASF conversion...',
      );
    }
  });

  it('Throw error for invalid time tag found', async () => {
    try {
      const result = await seqnToSATF(`
    Z00:00:00 CMD true 1.45`);
    } catch (error) {
      expect(error.message).toStrictEqual(
        'No time found for command Z00:00:00 CMD true 1.45. Aborting Seqn -> SATF/SASF conversion...',
      );
    }
  });

  it('should round trip a satf', async () => {
    const satf = `
  $$EOH

  RT_on_board_block(/eng/seq/instrument.mod,\\instrument\\,
      ON_BOARD_FILENAME,/on/board/instrument.mod,
      VIRTUAL_CHANNEL,VC2B,
      PARAMETERS,
          status(
              TYPE,UNSIGNED_DECIMAL
          ),
          id(
              TYPE,STRING,
              ENUM_NAME,GRNS_ANNEAL_HEATER
          ),
          temp(
              TYPE,UNSIGNED_DECIMAL
          ),
      end,
      STEPS,
          command(1,
              SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
              NTEXT,\\"Set package"\\,
              STATUS("EXECUTE","status")
          ),
          command(2,
              SCHEDULED_TIME,\\00:00:01.123456\\,FROM_PREVIOUS_START,
              NTEXT,\\"Disable volatage"\\,
              VOLTAGE_OFF("OFF")
          )
      end,
  )
  $$EOF`;
    const seqn = await satfToSeqn(satf);
    const result = await seqnToSATF(`${seqn.sequences[0].inputParameters}\n${seqn.sequences[0].steps}`);
    expect(result.parameters?.trimEnd()).toEqual(
      `PARAMETERS,
	status(
		TYPE,UNSIGNED_DECIMAL
	),
	id(
		TYPE,STRING,
		ENUM_NAME,\\GRNS_ANNEAL_HEATER\\
	),
	temp(
		TYPE,UNSIGNED_DECIMAL
	),
end`,
    );
    expect(result.steps?.trimEnd()).toEqual(
      `STEPS,
	command(1,
		SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
		NTEXT,\\"Set package"\\,
		STATUS("EXECUTE", "status")
	),
	command(2,
		SCHEDULED_TIME,\\00:00:01.123456\\,FROM_PREVIOUS_START,
		NTEXT,\\"Disable volatage"\\,
		VOLTAGE_OFF("OFF")
	),
end`,
    );
  });
  it('should return valid satf times', async () => {
    const result = await seqnToSATF(`
    A2025-001T10:00:00 CMD
    R10:00:00 CMD
    R500 CMD
    E-03:00:00.1 CMD
    E+1.0 CMD
    B00:08:00 CMD
    C CMD`);
    expect(result.steps).toEqual(`STEPS,
	command(1,
		SCHEDULED_TIME,\\2025-001T10:00:00\\,ABSOLUTE,
		CMD()
	),
	command(2,
		SCHEDULED_TIME,\\10:00:00\\,FROM_PREVIOUS_START,
		CMD()
	),
	command(3,
		SCHEDULED_TIME,\\00:08:20\\,FROM_PREVIOUS_START,
		CMD()
	),
	command(4,
		SCHEDULED_TIME,\\-03:00:00.100\\,EPOCH,
		CMD()
	),
	command(5,
		SCHEDULED_TIME,\\00:00:01\\,EPOCH,
		CMD()
	),
	command(6,
		SCHEDULED_TIME,\\00:08:00\\,FROM_REQUEST_START,
		CMD()
	),
	command(7,
		SCHEDULED_TIME,\\00:00:00\\,WAIT_PREVIOUS_END,
		CMD()
	),
end`);
  });
});

//--- Seqn to SASF Test
describe('seqnToSasf', () => {
  it('Should return a barebone sasf', async () => {
    const result = await seqnToSASF(`
    C @REQUEST_BEGIN("request1")
    @REQUEST_END
    @METADATA "REQUESTOR" "me"
    @METADATA "PROCESSOR" "VC2AB"
    @METADATA "KEY" "No_Key"
  `);
    expect(result.requests?.trimEnd()).toEqual(
      `request(request1,
	START_TIME, 00:00:00,WAIT_PREVIOUS_END,
	REQUESTOR,"me",
	PROCESSOR,"VC2AB",
	KEY,"No_Key")

end;`,
    );
  });

  it('Should round trip an sasf', async () => {
    const seqN = await sasfToSeqn(
      `CCSD3ZF0000100000001NJPL3KS0L015$$MARK$$;
      DATA_SET_ID = SPACECRAFT_ACTIVITY_SEQUENCE;
      CCSD3RE00000$$MARK$$NJPL3IF0M00500000001;
      $$EOH
      $$EOD

      # I am a comment inside a sasf
      
      request(ep_atr_testing_setup,
          REQUESTOR, "me",
          PROCESSOR, "VC2AB",
          KEY, "NO_KEY",
          START_TIME, 2024-001T00:00:00.000)
              command(1,
                  SCHEDULED_TIME,\\00:00:01.000\\,FROM_PREVIOUS_START,
                  USER_SEQ_VAR_SEQ_ACTIVATE("NO_EPOCH", -1, "/eng/seq/ep_configure.mod", "THRUSTER_TABLE_A", 55, 10, 35)
              ),
              command(2,
                  SCHEDULED_TIME,\\01:00:00.000\\,FROM_PREVIOUS_START,
                  USER_SEQ_VAR_SEQ_LOAD("NO_EPOCH", -1, "/eng/seq/ep_start_mission_thrust.mod", "TRUE", 235, 0.218, 2400)
              ),
              command(3,
                  SCHEDULED_TIME,\\00:01:00.000\\,FROM_PREVIOUS_START,
                  USER_SEQ_EXECUTE("ep_start_mission_thrust.mod")
              ),
      end;`,
    );
    const result = await seqnToSASF(seqN.sequences[0].requests!);
    expect(result.requests?.trimEnd()).toEqual(
      `request(ep_atr_testing_setup,
	START_TIME, 2024-001T00:00:00.000,ABSOLUTE,
	REQUESTOR,"me",
	PROCESSOR,"VC2AB",
	KEY,"NO_KEY")
		command(1,
			SCHEDULED_TIME,\\00:00:01\\,FROM_PREVIOUS_START,
			USER_SEQ_VAR_SEQ_ACTIVATE("NO_EPOCH", -1, "/eng/seq/ep_configure.mod", "THRUSTER_TABLE_A", 55, 10, 35)
		),
		command(2,
			SCHEDULED_TIME,\\01:00:00\\,FROM_PREVIOUS_START,
			USER_SEQ_VAR_SEQ_LOAD("NO_EPOCH", -1, "/eng/seq/ep_start_mission_thrust.mod", "TRUE", 235, 0.218, 2400)
		),
		command(3,
			SCHEDULED_TIME,\\00:01:00\\,FROM_PREVIOUS_START,
			USER_SEQ_EXECUTE("ep_start_mission_thrust.mod")
		),
end;`,
    );
  });
  it('should return valid satf times', async () => {
    const result = await seqnToSASF(`
      G-00:00:00.100 "test" @REQUEST_BEGIN("request.name")
        A2025-001T10:00:00 CMD
        R10:00:00 CMD
        R500 CMD
        E-03:00:00 CMD
        E+1.0 CMD
        B00:08:00 CMD
      @REQUEST_END`);
    expect(result.requests).toEqual(`request(request.name,
	START_TIME, -00:00:00.100,GROUND_EPOCH)
		command(1,
			SCHEDULED_TIME,\\2025-001T10:00:00\\,ABSOLUTE,
			CMD()
		),
		command(2,
			SCHEDULED_TIME,\\10:00:00\\,FROM_PREVIOUS_START,
			CMD()
		),
		command(3,
			SCHEDULED_TIME,\\00:08:20\\,FROM_PREVIOUS_START,
			CMD()
		),
		command(4,
			SCHEDULED_TIME,\\-03:00:00\\,EPOCH,
			CMD()
		),
		command(5,
			SCHEDULED_TIME,\\00:00:01\\,EPOCH,
			CMD()
		),
		command(6,
			SCHEDULED_TIME,\\00:08:00\\,FROM_REQUEST_START,
			CMD()
		),
end;
`);
  });
});
