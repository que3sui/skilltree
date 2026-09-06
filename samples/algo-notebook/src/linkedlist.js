/** 单链表 */

export class ListNode {
  constructor(value, next = null) {
    this.value = value;
    this.next = next;
  }
}

export class LinkedList {
  constructor() {
    this.head = null;
    this.size = 0;
  }

  append(value) {
    const node = new ListNode(value);
    if (this.head === null) {
      this.head = node;
    } else {
      let cur = this.head;
      while (cur.next !== null) cur = cur.next;
      cur.next = node;
    }
    this.size++;
    return this;
  }

  prepend(value) {
    this.head = new ListNode(value, this.head);
    this.size++;
    return this;
  }

  /** 删除第一个值等于 value 的节点，返回是否删除 */
  delete(value) {
    if (this.head === null) return false;
    if (this.head.value === value) {
      this.head = this.head.next;
      this.size--;
      return true;
    }
    let prev = this.head;
    while (prev.next !== null) {
      if (prev.next.value === value) {
        prev.next = prev.next.next;
        this.size--;
        return true;
      }
      prev = prev.next;
    }
    return false;
  }

  toArray() {
    const out = [];
    let cur = this.head;
    while (cur !== null) {
      out.push(cur.value);
      cur = cur.next;
    }
    return out;
  }
}
