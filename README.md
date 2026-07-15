# SK hynix ADR 价差检测器

监测 Nasdaq `SKHY` ADR 与韩国交易所 `000660.KS` 普通股的汇率调整价差。

## 换算公式

SK hynix 的换股关系为 10 份 ADR 对应 1 股普通股，因此：

```text
每份 ADR 理论价值（USD）= 000660 股价（KRW）× 0.1 ÷ USD/KRW
溢价率 = (SKHY ÷ 理论价值 - 1) × 100%
```

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

- 第一版使用 Yahoo Finance 的公开延迟行情，无需 API Key；该接口并非保证可用的交易级行情。
- 韩国和美国市场交易时间不重叠，画面会同时显示各行情的时间戳与市场状态。
- 新上市代码若暂时未被免费数据源收录，可展开网页中的手动模式输入三项价格。
- 本工具用于观察跨市场估值差，不等于存在可执行的无风险套利。
