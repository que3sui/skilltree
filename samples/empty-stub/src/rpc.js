/**
 * 自研 RPC 框架 —— 传输层
 *
 * 对标 gRPC：HTTP/2 多路复用 + protobuf 编码 + 负载均衡策略插拔。
 */

export class RpcServer {
  constructor() {
    this.methods = new Map();
    // TODO: HTTP/2 server 初始化
  }

  addMethod(name, handler) {
    // TODO: 注册方法，绑定拦截器链
    this.methods.set(name, handler);
  }

  listen(port) {
    // TODO: 实现监听
    throw new Error("未实现");
  }
}

export class RpcClient {
  // TODO: 连接池、重试、熔断
}
