package net.tradepulse.monitor

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import kotlin.math.absoluteValue

class MonitorNotifier(private val context: Context) {
  private val appContext = context.applicationContext

  fun serviceNotification(content: String): Notification {
    createChannels()
    return NotificationCompat.Builder(appContext, SERVICE_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentTitle("TradePulse 监控运行中")
      .setContentText(content)
      .setStyle(NotificationCompat.BigTextStyle().bigText(content))
      .setContentIntent(openAppIntent())
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build()
  }

  fun notifyEntrySignal(item: ScanResultItem, tradeDate: String) {
    if (!canPostNotifications()) return
    createChannels()
    val reasons = item.reasons.take(2).joinToString("\n")
    val body = buildString {
      append("${item.signalText}  买入分 ${item.buyScore} / 卖压分 ${item.sellScore}")
      if (reasons.isNotBlank()) {
        append("\n")
        append(reasons)
      }
    }
    val notification = NotificationCompat.Builder(appContext, ALERT_CHANNEL_ID)
      .setSmallIcon(android.R.drawable.stat_notify_more)
      .setContentTitle("${item.symbol} 首次${item.signalText}")
      .setContentText("${item.signalText}  $tradeDate")
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setContentIntent(openAppIntent())
      .setAutoCancel(true)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build()

    NotificationManagerCompat.from(appContext).notify(
      "${tradeDate}|${item.symbol}|${item.signal}".hashCode().absoluteValue,
      notification,
    )
  }

  fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = appContext.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(
        SERVICE_CHANNEL_ID,
        "TradePulse 后台监控",
        NotificationManager.IMPORTANCE_LOW,
      ).apply {
        description = "显示 TradePulse 后台监控正在运行。"
      },
    )
    manager.createNotificationChannel(
      NotificationChannel(
        ALERT_CHANNEL_ID,
        "TradePulse 入场提醒",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "首次发现机构入场类信号时提醒。"
      },
    )
  }

  private fun canPostNotifications(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
      ContextCompat.checkSelfPermission(appContext, Manifest.permission.POST_NOTIFICATIONS) ==
      PackageManager.PERMISSION_GRANTED
  }

  private fun openAppIntent(): PendingIntent {
    val intent = Intent(appContext, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
    }
    return PendingIntent.getActivity(
      appContext,
      0,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  companion object {
    const val SERVICE_NOTIFICATION_ID = 1001
    private const val SERVICE_CHANNEL_ID = "tradepulse_monitor_service"
    private const val ALERT_CHANNEL_ID = "tradepulse_entry_alerts"
  }
}
