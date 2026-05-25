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
