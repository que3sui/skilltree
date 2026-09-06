/**
 * 服务注册中心 —— 核心模块
 *
 * 设计要点：
 * - 一致性哈希环做节点分布
 * - 租约机制 + 心跳续约
 * - watch 推送变更
 */

const LEASE_TTL_MS = 15_000;

class Registry {
  constructor(options = {}) {
    this.leases = new Map();
    this.watchers = [];
    this.ttl = options.leaseTtlMs ?? LEASE_TTL_MS;
  }

  register(service) {
    // TODO: 校验 service 元数据
    // TODO: 写入一致性哈希环
    // TODO: 创建租约并启动续约定时器
    throw new Error("未实现");
  }

  heartbeat(serviceId) {
    // TODO: 续租
    throw new Error("未实现");
  }

  discover(name) {
    // TODO: 按服务名返回健康实例列表
    throw new Error("未实现");
  }

  watch(name, callback) {
    // TODO: 变更推送
    this.watchers.push(callback);
  }
}
