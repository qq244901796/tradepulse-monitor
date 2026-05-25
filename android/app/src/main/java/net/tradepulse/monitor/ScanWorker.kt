package net.tradepulse.monitor

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit
import kotlin.math.max

class ScanWorker(
  context: Context,
  params: WorkerParameters,
) : CoroutineWorker(context, params) {
  override suspend fun doWork(): Result {
    val engine = AndroidMonitorEngine(applicationContext)
    val result = engine.scan(
      trigger = "workmanager",
      mode = "系统兜底任务",
      sendNotifications = true,
    )
    return when {
      result.ok || result.skipped -> Result.success()
      else -> Result.retry()
    }
  }

  companion object {
    private const val UNIQUE_WORK_NAME = "tradepulse-monitor-scan"

    fun schedule(context: Context, intervalMinutes: Int) {
      val actualInterval = max(15, intervalMinutes).toLong()
      val request = PeriodicWorkRequestBuilder<ScanWorker>(actualInterval, TimeUnit.MINUTES)
        .setConstraints(
          Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build(),
        )
        .build()
      WorkManager.getInstance(context).enqueueUniquePeriodicWork(
        UNIQUE_WORK_NAME,
        ExistingPeriodicWorkPolicy.UPDATE,
        request,
      )
    }
  }
}
