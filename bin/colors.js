const isColorSupported =
  Boolean(process.stdout?.isTTY) &&
  !Boolean(process.env.NO_COLOR) &&
  process.env.TERM !== "dumb";

function wrap(startCode, endCode) {
  return (text) => (isColorSupported ? `\x1b[${startCode}m${text}\x1b[${endCode}m` : String(text));
}

export const c = {
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
  white: wrap(37, 39),
};
