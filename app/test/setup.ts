import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// テスト後のクリーンアップ
afterEach(() => {
  cleanup();
});
