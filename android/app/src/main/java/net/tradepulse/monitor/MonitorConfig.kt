package net.tradepulse.monitor

data class MonitorConfig(
  val email: String = "",
  val password: String = "",
  val symbols: List<String> = listOf("AAPL"),
  val intervalMinutes: Int = 5,
  val lookbackMinutes: Int = 30,
  val entryScore: Int = 45,
  val strongEntryScore: Int = 70,
  val language: String = "zh-CN",
  val notifyEntrySignals: Boolean = true,
) {
  fun validate(): String? {
    if (email.isBlank()) return "请填写 TradePulse 邮箱。"
    if (password.isBlank()) return "请填写 TradePulse 密码。"
    if (symbols.isEmpty()) return "请至少添加一个股票代码。"
    if (intervalMinutes < 1) return "扫描周期必须大于 0。"
    if (lookbackMinutes < 1) return "回看分钟必须大于 0。"
    if (entryScore !in 0..100) return "入场阈值必须在 0 到 100 之间。"
    if (strongEntryScore !in 0..100) return "强入场阈值必须在 0 到 100 之间。"
    return null
  }

  fun toJsConfigJson(): String {
    val symbolJson = symbols.joinToString(",") { "\"${escapeJson(it)}\"" }
    return """
      {
        "account": {
          "email": "${escapeJson(email)}",
          "password": "${escapeJson(password)}"
        },
        "monitor": {
          "symbols": [$symbolJson],
          "intervalMinutes": $intervalMinutes,
          "lookbackMinutes": $lookbackMinutes,
          "runAllDay": true
        },
        "rules": {
          "minBuyScoreForEntry": $entryScore,
          "minBuyScoreForStrongEntry": $strongEntryScore
        },
        "server": {
          "host": "127.0.0.1",
          "port": 14587
        },
        "ui": {
          "language": "${escapeJson(language)}"
        }
      }
    """.trimIndent()
  }

  companion object {
    fun parseSymbols(raw: String): List<String> {
      return raw
        .split(Regex("[\\s,;，；]+"))
        .map { it.trim().uppercase() }
        .filter { it.matches(Regex("[A-Z0-9.\\-]+")) }
        .distinct()
    }

    private fun escapeJson(value: String): String {
      return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
    }
  }
}
