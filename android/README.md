# Android 版本

安卓端使用原生 Kotlin 工程，并通过 `android/app/src/main/assets/tradepulse-core.bundle.js` 调用共享识别逻辑。共享 JS 在本地隐藏 WebView 中执行，不依赖 `Android JavaScriptSandbox`。

## 当前能力

- 页面内编辑账号、密码、股票列表、扫描周期、阈值和语言。
- 手动扫描 TradePulse 导出数据。
- 保存配置后启动前台服务，按配置周期持续扫描。
- `保存并开始` 会先执行一次扫描，扫描成功后才启动后台服务；扫描失败不会进入后台循环。
- `测试网络` 可以在不提交账号密码的情况下检查登录域名、日期接口和导出页面是否可访问。
- `WorkManager` 作为系统兜底任务运行，安卓系统最短通常是 15 分钟。
- 首次出现 `STRONG_ENTRY`、`MIXED_ENTRY`、`POSSIBLE_ENTRY` 时发送本地通知。
- 同一交易日、同一股票、同一信号只提醒一次。
- 保存最近一次结果和最近 200 次历史摘要。
- 结果页支持筛选：全部、入场、首次、卖压。

## 共享核心同步

修改识别逻辑后先更新共享 bundle：

```powershell
node .\scripts\build-core-bundle.mjs
powershell -ExecutionPolicy Bypass -File .\scripts\sync-android-core.ps1
```

然后重新构建安卓 APK：

```powershell
cd android
$env:GRADLE_USER_HOME='D:\tradepulse\android\.gradle-home'
.\gradlew.bat :app:assembleDebug
```

输出：

```text
android\app\build\outputs\apk\debug\app-debug.apk
```

## 注意

后台按配置周期扫描依赖前台服务，所以系统通知栏会常驻一个“TradePulse 监控运行中”的通知。设备省电策略仍可能影响网络和后台执行，`WorkManager` 会作为兜底补扫。

如果提示 WebView 不可用，需要在手机上更新 Android System WebView 或 Chrome。
