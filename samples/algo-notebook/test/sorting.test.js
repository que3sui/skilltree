import { test } from "node:test";
import assert from "node:assert/strict";
import { bubbleSort, mergeSort, quickSort } from "../src/sorting.js";

test("冒泡排序：基本用例", () => {
  assert.deepEqual(bubbleSort([3, 1, 2]), [1, 2, 3]);
  assert.deepEqual(bubbleSort([]), []);
});

test("归并排序：含重复与负数", () => {
  assert.deepEqual(mergeSort([5, -1, 5, 0, -1]), [-1, -1, 0, 5, 5]);
  assert.deepEqual(mergeSort([2, 1]), [1, 2]);
});

test("快排：空数组与单元素", () => {
  assert.deepEqual(quickSort([]), []);
  assert.deepEqual(quickSort([42]), [42]);
});
