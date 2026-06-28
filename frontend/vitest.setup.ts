import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement these APIs that Radix UI's <Select> relies on for
// positioning/scrolling — without them, opening the select throws in tests.
if (!('hasPointerCapture' in Element.prototype)) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!('releasePointerCapture' in Element.prototype)) {
  Element.prototype.releasePointerCapture = () => {};
}
if (!('scrollIntoView' in Element.prototype)) {
  Element.prototype.scrollIntoView = () => {};
}
if (!('ResizeObserver' in globalThis)) {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  // @ts-expect-error - test polyfill
  globalThis.ResizeObserver = ResizeObserverStub;
}
