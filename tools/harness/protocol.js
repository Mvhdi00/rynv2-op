const WASM_B64 = "AGFzbQEAAAABBwFgAn9/AX8DAgEABwUBAW0AAAqWAQGTAQAgAUEBakGx893xeWwgAHMhACAAIABBEnZzIQAgAEGwyu30BnMhACAAIABBFXZzIQAgAEGN98afBmohACAAQR93IQAgAEHk4ILTe2ohACAAQQJ3IQAgACAAQR50cyEAIABB7IulkgNzIQAgACAAQQl2cyEAIABB8arckwdqIQAgACAAQRx0cyEAIABBC3ZB/wFxCw==";
const bin = Uint8Array.from(atob(WASM_B64), c => c.charCodeAt(0));
const m = new WebAssembly.Instance(new WebAssembly.Module(bin), {}).exports.m;
export const BUILD_ID = "s16nqv";
export const BUILD_SALT = 2292205383;
export function mixKey(D, O) { const out = new Uint8Array(D.length), s = O | 0; for (let i = 0; i < D.length; i++) out[i] = D[i] ^ m(s, i); return out; }
