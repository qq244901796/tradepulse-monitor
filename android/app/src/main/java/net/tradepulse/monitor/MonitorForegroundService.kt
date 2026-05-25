package net.tradepulse.monitor

import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.IBinder
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.max

class MonitorForegroundService : Service() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
  private lateinit var engine: AndroidMonitorEngine
  private lateinit var notifier: MonitorNotifier
  private var loopJob: Job? = null

  override fun onCreate() {
    super.onCreate()
    engine = AndroidMonitorEngine(applicationContext)
    notifier = MonitorNotifier(applicationContext)
    notifier.createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopSelf()
      return START_NOT_STICKY
    }

    startForeground(
      MonitorNotifier.SERVICE_NOTIFICATION_ID,
      notifier.serviceNotification("后台服务已启动，等待下一次扫描。"),
    )
    startLoop()
    return START_STICKY
  }

  override fun onDestroy() {
    loopJob?.cancel()
    super.onDestroy()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  private fun startLoop() {
    if (loopJob?.isActive == true) return
    loopJob = scope.launch {
      while (isActive) {
        val config = engine.loadConfig()
        val intervalMs = max(1, config.intervalMinutes) * 60_000L
        val minutes = max(1, config.intervalMinutes)
        engine.saveRuntimeState("后台服务运行中，下次约 $minutes 分钟后扫描。", "后台服务")
        startForeground(
          MonitorNotifier.SERVICE_NOTIFICATION_ID,
          notifier.serviceNotification("后台服务运行中，下次约 $minutes 分钟后扫描。"),
        )
        delay(intervalMs)
        val result = engine.scan(
          trigger = "service",
          mode = "后台服务",
          sendNotifications = true,
        )
        val content = if (result.ok) {
          "最近扫描完成：${result.renderedScan?.tradeDate ?: "-"}"
        } else {
          result.message.ifBlank { "最近扫描失败" }
        }
        startForeground(
          MonitorNotifier.SERVICE_NOTIFICATION_ID,
          notifier.serviceNotification(content),
        )
      }
    }
  }

  companion object {
    private const val ACTION_START = "net.tradepulse.monitor.START_MONITOR"
    private const val ACTION_STOP = "net.tradepulse.monitor.STOP_MONITOR"

    fun start(context: Context) {
      val intent = Intent(context, MonitorForegroundService::class.java).apply {
        action = ACTION_START
      }
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      val intent = Intent(context, MonitorForegroundService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }
}
