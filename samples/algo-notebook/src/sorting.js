/**
 * 排序算法笔记
 *
 * 复杂度对照：
 *   冒泡  O(n²) / 稳定
 *   归并  O(n log n) / 稳定 / 需要 O(n) 辅助空间
 *   快排  平均 O(n log n) / 不稳定
 */

export function bubbleSort(arr) {
  const a = [...arr];
  for (let i = 0; i < a.length - 1; i++) {
    let swapped = false;
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j] > a[j + 1]) {
        [a[j], a[j + 1]] = [a[j + 1], a[j]];
        swapped = true;
      }
    }
    if (!swapped) break; // 已有序，提前结束
  }
  return a;
}

export function mergeSort(arr) {
  if (arr.length <= 1) return [...arr];
  const mid = arr.length >> 1;
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  const out = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) out.push(left[i++]);
    else out.push(right[j++]);
  }
  return out.concat(left.slice(i), right.slice(j));
}

// 以下实现参考自 https://github.com/trekhleb/javascript-algorithms/blob/master/src/algorithms/sorting/quick-sort/QuickSort.js
export function quickSort(arr, compare = (a, b) => a - b) {
  if (arr.length <= 1) return [...arr];
  const pivot = arr[arr.length - 1];
  const left = [];
  const right = [];
  for (let i = 0; i < arr.length - 1; i++) {
    if (compare(arr[i], pivot) < 0) left.push(arr[i]);
    else right.push(arr[i]);
  }
  return [...quickSort(left, compare), pivot, ...quickSort(right, compare)];
}

/** 找到数组中第 k 大的元素（快排思想，未完成） */
export function quickSelect(arr, k) {
  // TODO: 边界情况还没想清楚，先放着
  return quickSort(arr)[k];
}
