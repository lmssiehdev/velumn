/**
 * Converts Unicode emoji to Twemoji SVG URL
 *
 * @see https://github.com/twitter/twemoji/blob/d94f4cf793e6d5ca592aa00f58a88f6a4229ad43/scripts/build.js#L571C7-L589C8
 */
export function emojiToTwemoji(emoji: string, version = '14.0.2') {
  function toCodePoint(unicodeSurrogates: string) {
    var r = [],
      c = 0,
      p = 0,
      i = 0;
    while (i < unicodeSurrogates.length) {
      c = unicodeSurrogates.charCodeAt(i++);
      if (p) {
        r.push(
          (0x1_00_00 + ((p - 0xd8_00) << 10) + (c - 0xdc_00)).toString(16)
        );
        p = 0;
      } else if (0xd8_00 <= c && c <= 0xdb_ff) {
        p = c;
      } else {
        r.push(c.toString(16));
      }
    }
    return r.join('-');
  }

  const filename = toCodePoint(emoji);

  return `https://cdn.jsdelivr.net/gh/twitter/twemoji@${version}/assets/svg/${filename}.svg`;
}
