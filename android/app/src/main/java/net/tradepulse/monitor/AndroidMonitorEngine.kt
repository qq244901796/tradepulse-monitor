package net.tradepulse.monitor

import android.content.Context
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

data class MonitorRunResult(
  val ok: Boolean,
  val skipped: Boolean = false,
  val renderedScan: RenderedScan? = null,
  val message: String = "",
)

class AndroidMonitorEngine(private val context: Context) {
  private val appContext = context.applicationContext
  private val store = MonitorStore(appContext)
  private val core = TradePulseCoreBridge(appContext)
  private val notifier = MonitorNotifier(appContext)

  fun loadConfig(): MonitorConfig = store.loadConfig()

  fun saveConfig(config: MonitorConfig) {
    store.saveConfig(config)
  }

  fun lastStatusText(): String = store.loadStatusText()

  fun lastResultsText(): String = store.loadResultsText()

  fun lastScan(): RenderedScan? = store.loadLastScan()

  fun historyText(): String = store.loadHistoryText()

  fun storageSecurityText(): String = store.storageSecurityText()

  fun saveErrorState(message: String, mode: String = "手动扫描") {
    store.saveErrorState(message, mode)
  }

  fun saveRuntimeState(statusText: String, mode: String) {
    store.saveRuntimeState(statusText, mode)
  }

  fun testNetwork(): List<NetworkProbeResult> {
    return TradePulseApi.testNetwork()
  }

  fun scan(trigger: String, mode: String, sendNotifications: Boolean): MonitorRunResult {
    if (!SCANNING.compareAndSet(false, true)) {
      return MonitorRunResult(ok = false, skipped = true, message = "已有扫描正在运行。")
    }

    val config = store.loadConfig()
    return try {
      config.validate()?.let { error(it) }
      store.saveRuntimeState("正在扫描：$mode", mode)

      val api = TradePulseApi(config.email, config.password)
      api.login()
      val latestDate = api.latestDate()
      val stockCsv = api.exportCsv(config.symbols.joinToString(","), latestDate, 0)
      val powerCsv = api.exportCsv("*", latestDate, 1)
      val rendered = core.analyze(
        tradeDate = toDisplayDate(latestDate),
        stockCsv = stockCsv,
        powerCsv = powerCsv,
        config = config,
        seenSignals = store.loadSeenSignals(),
      )

      val statusText = buildStatusText(config, rendered, trigger, mode)
      store.saveSeenSignals(rendered.seenSignals)
      store.saveScan(rendered, statusText, mode)

      if (sendNotifications && config.notifyEntrySignals) {
        rendered.items
          .filter { it.firstSeen && it.isEntrySignal }
          .forEach { notifier.notifyEntrySignal(it, rendered.tradeDate) }
      }

      MonitorRunResult(ok = true, renderedScan = rendered)
    } catch (error: Throwable) {
      val message = error.message ?: "扫描失败"
      store.saveErrorState(message, mode)
      MonitorRunResult(ok = false, message = message)
    } finally {
      SCANNING.set(false)
    }
  }

  private fun buildStatusText(
    config: MonitorConfig,
    rendered: RenderedScan,
    trigger: String,
    mode: String,
  ): String {
    val now = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").format(LocalDateTime.now())
    val fallbackInterval = max(15, config.intervalMinutes)
    return """
      运行模式：$mode
      最近扫描：$now
      触发方式：$trigger
      数据日期：${rendered.tradeDate}
      配置周期：${config.intervalMinutes} 分钟
      系统兜底周期：$fallbackInterval 分钟
      信号概览：${rendered.summaryText}
    """.trimIndent()
  }

  private fun toDisplayDate(value: String): String {
    return "${value.substring(0, 4)}-${value.substring(4, 6)}-${value.substring(6, 8)}"
  }

  companion object {
    private val SCANNING = AtomicBoolean(false)
  }
}
