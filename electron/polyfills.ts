/**
 * 运行时 Polyfill
 * 解决某些 npm 包在 Node.js/Electron 环境中的兼容性问题
 *
 * 依赖来源:
 * - crypto: uuid, @lancedb/lancedb 等需要 globalThis.crypto
 * - DOMMatrix/DOMPoint/DOMRect: pdf-parse 内部依赖
 */

import { webcrypto } from 'node:crypto'

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    writable: true,
    configurable: true
  })
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  class MockDOMMatrix {
    constructor(init?: any) {
      if (typeof init === 'object') {
        Object.assign(this, init)
      }
    }
    static fromMatrix() { return new MockDOMMatrix() }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    flipX() { return this }
    flipY() { return this }
    skewX() { return this }
    skewY() { return this }
    multiply() { return this }
    inverse() { return this }
    transformPoint() { return { x: 0, y: 0 } }
    toJSON() { return {} }
  }
  Object.defineProperty(globalThis, 'DOMMatrix', {
    value: MockDOMMatrix,
    writable: true,
    configurable: true
  })
}

if (typeof globalThis.DOMPoint === 'undefined') {
  class MockDOMPoint {
    x: number; y: number; z: number; w: number;
    constructor(x = 0, y = 0, z = 0, w = 0) {
      this.x = x; this.y = y; this.z = z; this.w = w;
    }
    matrixTransform() { return new MockDOMPoint() }
    toJSON() { return { x: this.x, y: this.y, z: this.z, w: this.w } }
  }
  Object.defineProperty(globalThis, 'DOMPoint', { value: MockDOMPoint, writable: true, configurable: true })
}

if (typeof globalThis.DOMRect === 'undefined') {
  class MockDOMRect {
    x: number; y: number; width: number; height: number;
    constructor(x = 0, y = 0, width = 0, height = 0) {
      this.x = x; this.y = y; this.width = width; this.height = height;
    }
    toJSON() { return { x: this.x, y: this.y, width: this.width, height: this.height } }
  }
  Object.defineProperty(globalThis, 'DOMRect', { value: MockDOMRect, writable: true, configurable: true })
}
