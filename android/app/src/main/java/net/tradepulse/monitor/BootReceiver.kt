package net.tradepulse.monitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
    val engine = AndroidMonitorEngine(context)
    val config = engine.loadConfig()
    if (config.validate() == null) {
      ScanWorker.schedule(context, config.intervalMinutes)
      runCatching { MonitorForegroundService.start(context) }
    }
  }
}
