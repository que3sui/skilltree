# task-todo

一个零依赖的命令行待办事项管理器。数据存放在 `~/.todo.json`（可用环境变量 `TODO_FILE` 覆盖），写入采用"先写临时文件再原子替换"，避免进程中断导致数据损坏。

## 使用

```bash
node src/index.js add "完成操作系统实验报告" --priority high
node src/index.js list              # 列出未完成
node src/index.js list --all        # 包含已完成
node src index.js done 3            # 完成第 3 项
node src/index.js rm 3
```

## 设计说明

- **存储与命令分离**：`store.js` 只负责读写与并发写保护，`commands.js` 只负责业务规则，`index.js` 只负责解析参数与分发。新增命令不需要改存储层。
- **校验前置**：所有用户输入先经过 `validate.js`，非法输入以退出码 1 和人类可读信息失败，而不是抛栈。
- **优先级排序**：list 默认按 `priority desc, createdAt asc` 排序；用 `Map` 建优先级索引做 O(n) 分桶而不是每次比较排序。
- **已知局限**：多终端同时写只靠重命名原子性，未做文件锁；条目超过万级后 list 全量渲染会慢。这两点在 issues 里记录了思路。

## 测试

```bash
npm test
```

测试覆盖：添加/完成/删除的正常与边界路径（空标题、超长标题、重复完成、不存在序号）、原子写入的临时文件清理、优先级排序正确性。
