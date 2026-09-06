#!/usr/bin/env node
import { load, StoreError } from "./store.js";
import { add, list, complete, remove, stats } from "./commands.js";
import { ValidationError } from "./validate.js";

const USAGE = `todo —— 命令行待办事项

用法:
  todo add <标题> [--priority high|normal|low]
  todo list [--all]
  todo done <序号>
  todo rm <序号>
  todo stats
`;

function parseArgs(argv) {
  const args = { _: [], priority: "normal", all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--priority") {
      args.priority = argv[++i] ?? "";
    } else if (a === "--all") {
      args.all = true;
    } else if (a === "-h" || a === "--help") {
      args.help = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function printItem(it) {
  const mark = it.done ? "✓" : " ";
  const flag = it.priority === "high" ? "‼" : it.priority === "low" ? "↓" : " ";
  console.log(` ${mark} ${String(it.index).padStart(3)} [${flag}] ${it.title}`);
}

function main(argv) {
  const args = parseArgs(argv);
  if (args.help || args._.length === 0) {
    console.log(USAGE);
    return 0;
  }
  const [cmd, ...rest] = args._;
  const store = load();

  switch (cmd) {
    case "add": {
      if (rest.length === 0) throw new ValidationError('用法: todo add "标题" [--priority high]');
      const item = add(store, { title: rest.join(" "), priority: args.priority });
      console.log(`已添加 #${item.id}：${item.title}（优先级 ${item.priority}）`);
      return 0;
    }
    case "list": {
      const items = list(store, { all: args.all });
      if (items.length === 0) {
        console.log("（空）没有待办事项，享受生活吧");
        return 0;
      }
      items.forEach(printItem);
      return 0;
    }
    case "done": {
      const item = complete(store, { index: rest[0] });
      console.log(`已完成：${item.title}`);
      return 0;
    }
    case "rm": {
      const item = remove(store, { index: rest[0] });
      console.log(`已删除：${item.title}`);
      return 0;
    }
    case "stats": {
      const s = stats(store);
      console.log(`共 ${s.total} 项：待办 ${s.pending} / 已完成 ${s.done}`);
      const parts = Object.entries(s.byPriority).map(([p, n]) => `${p}×${n}`);
      if (parts.length > 0) console.log(`待办优先级分布：${parts.join("，")}`);
      return 0;
    }
    default:
      throw new ValidationError(`未知命令 "${cmd}"，输入 todo --help 查看用法`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (err) {
  if (err?.userFacing) {
    console.error(`错误：${err.message}`);
    process.exitCode = 1;
  } else {
    console.error("程序内部错误，详情：");
    console.error(err);
    process.exitCode = 2;
  }
}
