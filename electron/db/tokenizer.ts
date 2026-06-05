import log from 'electron-log';
import { createRequire } from 'node:module';

let jiebaReady = false;
let jiebaCut: ((text: string, hmm?: boolean) => string[]) | null = null;

export function initJieba() {
    if (jiebaReady) return;
    try {
        // 使用 createRequire 加载 CJS 模块，避免 Vite 将 import() 解析到 web 版本
        const require = createRequire(import.meta.url);
        const jiebaWasm = require('jieba-wasm');
        jiebaCut = jiebaWasm.cut;
        jiebaReady = true;
        log.info('[DB] jieba-wasm initialized');
    } catch (err) {
        log.warn('[DB] jieba-wasm init failed, Chinese tokenization disabled:', err);
    }
}

export function tokenizeChinese(text: string): string {
    if (!jiebaCut) return text;
    try {
        return jiebaCut(text, true).join(' ');
    } catch {
        return text;
    }
}

export function isJiebaReady(): boolean {
    return jiebaReady;
}

initJieba();
