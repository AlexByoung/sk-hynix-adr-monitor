# SK hynix ADR 价差检测器

主要监测 Hyperliquid XYZ HIP-3 的 `xyz:SKHY` ADR 永续与 `xyz:SKHX` 普通股永续之间的价差。旧的现货接口仍保留用于对照。

## 换算公式

SK hynix 的换股关系为 10 份 ADR 对应 1 股普通股，因此：

```text
每份 ADR 对应价值（USD）= xyz:SKHX 标记价 ÷ 10
永续跨合约溢价率 = (xyz:SKHY 标记价 ÷ 对应价值 - 1) × 100%
```

页面同时显示标记价、预言机价格、资金费率、持仓量与 24 小时成交额。公开只读数据来自 `POST https://api.hyperliquid.xyz/info` 的 `metaAndAssetCtxs` 请求，无需 API Key。

界面支持中文、English 与 한국어，并会在浏览器中记住语言选择。

## API

- `GET /api/perp-spread?threshold=10`：主要的 HIP-3 永续价差接口。
- `GET /api/spread?threshold=10`：保留的 Nasdaq／KRX／汇率现货对照接口。
- `GET /api/health`：服务健康检查。

## 本地运行

需要 Node.js 20 或以上版本：

```bash
npm start
```

浏览器打开 `http://localhost:3000`。运行测试：

```bash
npm test
```

## 部署到 Render

1. 将整个项目上传到 GitHub。
2. 在 Render 新建 **Web Service** 并连接仓库。
3. Runtime 选择 **Docker**。
4. 部署完成后打开 Render 提供的网址。

服务已监听 Render 自动注入的 `PORT`，无需额外环境变量。

## 在 iPad 的 Node.js Lab 运行

Node.js Lab 使用项目根目录中的 `ipad-server.cjs` 兼容入口：

1. 将整个项目文件夹复制到 Node.js Lab 的本地文件目录。
2. 打开侧边栏的 **Web Application** 设置。
3. 开启 **Enabled**。
4. **Browser address** 填入 `http://127.0.0.1:3000`。
5. **App** 填入项目的相对路径：`sk-hynix-adr-monitor/ipad-server.cjs`。
6. 完全关闭并重新打开 Node.js Lab，然后点击 **Open App**。

Node.js Lab 无法单独重启 Node 进程；修改设置或代码后需要完全重启 App。

## 行情与风险说明

- 主要界面使用 Hyperliquid 的公开只读 API；接口和 HIP-3 市场仍可能暂时中断。
- 永续合约连续交易，但预言机在美股或韩股休市时可能更新较慢。
- 价差会受到资金费率、盘口深度和流动性影响，不代表可以无成本成交。
- 接口不可用时，可展开网页中的手动模式输入两个永续合约的标记价格。
- 本工具用于观察跨市场估值差，不等于存在可执行的无风险套利。
