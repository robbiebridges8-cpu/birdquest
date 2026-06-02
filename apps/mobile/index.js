// h3-js's emscripten/asm.js bundle does `new TextDecoder('utf-16le')` at
// module init time. Hermes throws RangeError on that encoding, which prevents
// record.tsx from loading. Wrap the constructor so unsupported encodings return
// a no-op decoder (h3-js only uses UTF16Decoder for internal C-string ops that
// aren't exercised by latLngToCell).
if (typeof global !== 'undefined' && global.TextDecoder) {
  const NativeTextDecoder = global.TextDecoder;
  global.TextDecoder = function PatchedTextDecoder(label, options) {
    try {
      return new NativeTextDecoder(label, options);
    } catch (_) {
      return { decode: () => '' };
    }
  };
  global.TextDecoder.prototype = NativeTextDecoder.prototype;
}

require('expo-router/entry');
