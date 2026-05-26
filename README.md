# TradePulse Monitor

这个项目现在包含两个方向：

- Windows 本地监控程序：`start.vbs` / `start.bat`
- Android 原生工程：`android/`

两端共用的识别逻辑放在：

```text
packages/core/src
```

## Windows 使用

普通用户入口：

```text
start.vbs
```

调试入口：

```powershell
.\start.bat
```

浏览器会打开：

```text
http://127.0.0.1:14587
```

首次运行直接在页面里填写账号、密码、股票列表和阈值，不需要手改配置文件。

1.3 起 Windows 端可以在设置里选择三种监控模式：

- `股票列表`：按指定股票识别机构入场、卖压和价格计划。
- `Top Flows`：定期读取 TradePulse Top Flows 榜单，观察新进榜、离开榜单和名次变动。
- `Power Inflows`：定期读取官方强资金流入榜单，只在新股票进入榜单时触发邮件提醒。

## 共享核心

共享核心负责这些内容：

- CSV 解析
- 配置标准化
- 机构入场识别逻辑
- 中英文原因与日志文案

如果后续要同时修改 Windows 和 Android 的判断逻辑，优先改这里：

```text
packages\core\src
```

打包安卓可读的 bundle：

```powershell
node .\scripts\build-core-bundle.mjs
```

同步到安卓资源目录：

```powershell
.\scripts\sync-android-core.ps1
```

## Android 说明

安卓工程目录：

```text
android\
```

当前第一版已经包含：

- 账号和监控参数设置
- 手动扫描
- 后台定时扫描
- 读取共享 JS 核心做识别

注意：安卓后台扫描使用 `WorkManager`，系统限制最短周期是 `15` 分钟，所以它不会像 Windows 端那样稳定运行 `5` 分钟周期。

## Windows 打包

生成 Windows 免安装压缩包：

```powershell
.\scripts\package-windows.ps1
```

输出：

```text
dist\tradepulse-monitor.zip
```

## 1.1 Chart 数据源

当前版本会额外读取 TradePulse Chart 曲线接口：

```text
https://data1.tradepulse.net/chart.do?sym=股票代码
```

价格计划会优先使用 Chart 曲线数据；如果 Chart 读取失败，会自动退回原来的 export CSV 数据，不会中断扫描。

重新探索 Chart 页面接口：

```powershell
$env:TARGET_URL="https://app-trps.tradepulse.net/chart"
powershell.exe -ExecutionPolicy Bypass -File .\scripts\start_tradepulse_chrome.ps1
node .\scripts\inspect_chart.mjs
```

报告输出：

```text
reports\chart-api-discovery.json
```

## 1.2 Top Flows 数据源

Top Flows 模式读取：

```text
https://data1.tradepulse.net/rank.do?type=0
```

当前 Windows 端先固定使用 `ALL` 榜单。后续如果要加 `NYSE`、`NASDAQ`、`ETF` 过滤，只需要继续扩展 `topFlows.type` 和页面选择控件。

## 1.3 Power Inflows 邮件提醒

Power Inflows 模式读取：

```text
https://app-trps.tradepulse.net/api/export?symbol=*&sdate=YYYYMMDD&edate=YYYYMMDD&type=1
```

设置页里只需要填写 Resend API Key 和收件邮箱，并可点击“发送测试邮件”先验证。软件固定使用 Resend 测试发件人 `onboarding@resend.dev`，不需要配置 SMTP、授权码、域名或发件邮箱。没有自有域名时，该测试发件人通常只能发到 Resend 账号绑定邮箱。软件只在 Power Inflows 出现新进榜股票时发送邮件；首次扫描只建立基线，不发送整张榜单。
