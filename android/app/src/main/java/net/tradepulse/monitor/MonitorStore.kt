package net.tradepulse.monitor

import android.content.Context
import androidx.core.content.edit
import org.json.JSONArray
import org.json.JSONObject

class MonitorStore(context: Context) {
  private val prefs = context.getSharedPreferences("tradepulse_monitor", Context.MODE_PRIVATE)

  fun loadConfig(): MonitorConfig {
    return MonitorConfig(
      email = prefs.getString("email", "") ?: "",
      password = prefs.getString("password", "") ?: "",
      symbols = MonitorConfig.parseSymbols(prefs.getString("symbols", "AAPL") ?: "AAPL"),
      intervalMinutes = prefs.getInt("intervalMinutes", 5),
      lookbackMinutes = prefs.getInt("lookbackMinutes", 30),
      entryScore = prefs.getInt("entryScore", 45),
      strongEntryScore = prefs.getInt("strongEntryScore", 70),
      pricePlanEnabled = prefs.getBoolean("pricePlanEnabled", true),
      pricePullbackTolerancePct = Double.fromBits(prefs.getLong("pricePullbackTolerancePct", 0.8.toRawBits())),
      priceStopBufferPct = Double.fromBits(prefs.getLong("priceStopBufferPct", 1.5.toRawBits())),
      priceMinConfidence = prefs.getInt("priceMinConfidence", 60),
      language = prefs.getString("language", "zh-CN") ?: "zh-CN",
      notifyEntrySignals = prefs.getBoolean("notifyEntrySignals", true),
    )
  }

  fun saveConfig(config: MonitorConfig) {
    prefs.edit {
      putString("email", config.email)
      putString("password", config.password)
      putString("symbols", config.symbols.joinToString(","))
      putInt("intervalMinutes", config.intervalMinutes)
      putInt("lookbackMinutes", config.lookbackMinutes)
      putInt("entryScore", config.entryScore)
      putInt("strongEntryScore", config.strongEntryScore)
      putBoolean("pricePlanEnabled", config.pricePlanEnabled)
      putLong("pricePullbackTolerancePct", config.pricePullbackTolerancePct.toRawBits())
      putLong("priceStopBufferPct", config.priceStopBufferPct.toRawBits())
      putInt("priceMinConfidence", config.priceMinConfidence)
      putString("language", config.language)
      putBoolean("notifyEntrySignals", config.notifyEntrySignals)
    }
  }

  fun loadSeenSignals(): Set<String> {
    return prefs.getStringSet("seenSignals", emptySet())?.toSet() ?: emptySet()
  }

  fun saveSeenSignals(values: Set<String>) {
    prefs.edit {
      putStringSet("seenSignals", values)
    }
  }

  fun saveScan(rendered: RenderedScan, statusText: String, mode: String) {
    prefs.edit {
      putString("statusText", statusText)
      putString("resultsText", rendered.resultsText)
      putString("lastScanJson", rendered.toJson())
      putString("mode", mode)
      putString("lastError", "")
      putLong("lastUpdatedAt", System.currentTimeMillis())
      putString("historyJson", appendHistory(rendered))
    }
  }

  fun saveRuntimeState(statusText: String, mode: String, lastError: String = "") {
    prefs.edit {
      putString("statusText", statusText)
      putString("mode", mode)
      putString("lastError", lastError)
      putLong("lastUpdatedAt", System.currentTimeMillis())
    }
  }

  fun saveErrorState(message: String, mode: String) {
    val text = "最近一次扫描失败：$message"
    prefs.edit {
      putString("statusText", text)
      putString("lastError", message)
      putString("mode", mode)
      putLong("lastUpdatedAt", System.currentTimeMillis())
    }
  }

  fun loadStatusText(): String {
    return prefs.getString("statusText", "尚未扫描") ?: "尚未扫描"
  }

  fun loadResultsText(): String {
    return prefs.getString("resultsText", "尚未扫描") ?: "尚未扫描"
  }

  fun loadLastScan(): RenderedScan? {
    return RenderedScan.fromJson(prefs.getString("lastScanJson", null))
  }

  fun loadHistoryText(limit: Int = 20): String {
    val array = runCatching { JSONArray(prefs.getString("historyJson", "[]")) }.getOrElse { JSONArray() }
    if (array.length() == 0) return "暂无历史"
    return buildString {
      val count = minOf(limit, array.length())
      for (index in 0 until count) {
        val item = array.optJSONObject(index) ?: continue
        append(item.optString("generatedAt"))
        append("  ")
        append(item.optString("tradeDate"))
        append("  ")
        append(item.optString("summaryText"))
        if (index < count - 1) append("\n")
      }
    }
  }

  fun storageSecurityText(): String {
    return "账号密码保存在本机 SharedPreferences。当前版本未启用加密存储。"
  }

  private fun appendHistory(rendered: RenderedScan): String {
    val old = runCatching { JSONArray(prefs.getString("historyJson", "[]")) }.getOrElse { JSONArray() }
    val next = JSONArray()
    next.put(
      JSONObject()
        .put("generatedAt", rendered.generatedAt)
        .put("tradeDate", rendered.tradeDate)
        .put("summaryText", rendered.summaryText),
    )
    for (index in 0 until minOf(199, old.length())) {
      next.put(old.optJSONObject(index))
    }
    return next.toString()
  }
}
