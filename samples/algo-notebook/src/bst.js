/** 二叉搜索树（插入与查找；删除待实现） */

export class TreeNode {
  constructor(value) {
    this.value = value;
    this.left = null;
    this.right = null;
  }
}

export class BST {
  constructor() {
    this.root = null;
  }

  insert(value) {
    const node = new TreeNode(value);
    if (this.root === null) {
      this.root = node;
      return this;
    }
    let cur = this.root;
    while (true) {
      if (value === cur.value) return this; // 忽略重复值
      if (value < cur.value) {
        if (cur.left === null) {
          cur.left = node;
          return this;
        }
        cur = cur.left;
      } else {
        if (cur.right === null) {
          cur.right = node;
          return this;
        }
        cur = cur.right;
      }
    }
  }

  has(value) {
    let cur = this.root;
    while (cur !== null) {
      if (value === cur.value) return true;
      cur = value < cur.value ? cur.left : cur.right;
    }
    return false;
  }

  /** 中序遍历应为升序，用于自查 */
  toArray() {
    const out = [];
    const walk = (node) => {
      if (node === null) return;
      walk(node.left);
      out.push(node.value);
      walk(node.right);
    };
    walk(this.root);
    return out;
  }
}
