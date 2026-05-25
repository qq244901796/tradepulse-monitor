package net.tradepulse.monitor

import org.json.JSONArray
import org.json.JSONObject

data class RenderedScan(
  val generatedAt: String,
  val tradeDate: String,
  val summaryText: String,
  val resultsText: String,
  val seenSignals: Set<String>,
  val items: List<ScanResultItem>,
) {
  fun toJson(): String {
    return JSONObject()
      .put("generatedAt", generatedAt)
      .put("tradeDate", tradeDate)
      .put("summaryText", summaryText)
      .put("resultsText", resultsText)
      .put("seenSignals", JSONArray(seenSignals.toList()))
      .put("items", JSONArray(items.map { it.toJson() }))
      .toString()
  }

  companion object {
    fun fromJson(raw: String?): RenderedScan? {
      if (raw.isNullOrBlank()) return null
      return runCatching {
        val json = JSONObject(raw)
        RenderedScan(
          generatedAt = json.optString("generatedAt"),
          tradeDate = json.optString("tradeDate"),
          summaryText = json.optString("summaryText"),
          resultsText = json.optString("resultsText"),
          seenSignals = json.optJSONArray("seenSignals").toStringSet(),
          items = json.optJSONArray("items").toScanItems(),
        )
      }.getOrNull()
    }
  }
}

data class ScanResultItem(
  val symbol: String,
  val signal: String,
  val signalText: String,
  val buyScore: Int,
  val sellScore: Int,
  val firstSeen: Boolean,
  val priceText: String,
  val largeDealText: String,
  val recentLargeDealText: String,
  val reasons: List<String>,
  val pricePlan: RenderedPricePlan?,
) {
  val isEntrySignal: Boolean
    get() = signal == "STRONG_ENTRY" || signal == "MIXED_ENTRY" || signal == "POSSIBLE_ENTRY"

  val isSellPressure: Boolean
    get() = signal == "SELL_PRESSURE"

  fun toJson(): JSONObject {
    return JSONObject()
      .put("symbol", symbol)
      .put("signal", signal)
      .put("signalText", signalText)
      .put("buyScore", buyScore)
      .put("sellScore", sellScore)
      .put("firstSeen", firstSeen)
      .put("priceText", priceText)
      .put("largeDealText", largeDealText)
      .put("recentLargeDealText", recentLargeDealText)
      .put("reasons", JSONArray(reasons))
      .put("pricePlan", pricePlan?.toJson())
  }

  companion object {
    fun fromJson(json: JSONObject): ScanResultItem {
      return ScanResultItem(
        symbol = json.optString("symbol"),
        signal = json.optString("signal"),
        signalText = json.optString("signalText"),
        buyScore = json.optInt("buyScore"),
        sellScore = json.optInt("sellScore"),
        firstSeen = json.optBoolean("firstSeen"),
        priceText = json.optString("priceText"),
        largeDealText = json.optString("largeDealText"),
        recentLargeDealText = json.optString("recentLargeDealText"),
        reasons = json.optJSONArray("reasons").toStringList(),
        pricePlan = json.optJSONObject("pricePlan")?.let { RenderedPricePlan.fromJson(it) },
      )
    }
  }
}

data class RenderedPricePlan(
  val status: String,
  val statusText: String,
  val actionText: String,
  val watchPriceText: String,
  val buyZoneText: String,
  val breakoutText: String,
  val stopText: String,
  val confidenceText: String,
  val sourceText: String,
  val reasons: List<String>,
) {
  fun toJson(): JSONObject {
    return JSONObject()
      .put("status", status)
      .put("statusText", statusText)
      .put("actionText", actionText)
      .put("watchPriceText", watchPriceText)
      .put("buyZoneText", buyZoneText)
      .put("breakoutText", breakoutText)
      .put("stopText", stopText)
      .put("confidenceText", confidenceText)
      .put("sourceText", sourceText)
      .put("reasons", JSONArray(reasons))
  }

  companion object {
    fun fromJson(json: JSONObject): RenderedPricePlan {
      return RenderedPricePlan(
        status = json.optString("status"),
        statusText = json.optString("statusText"),
        actionText = json.optString("actionText"),
        watchPriceText = json.optString("watchPriceText"),
        buyZoneText = json.optString("buyZoneText"),
        breakoutText = json.optString("breakoutText"),
        stopText = json.optString("stopText"),
        confidenceText = json.optString("confidenceText"),
        sourceText = json.optString("sourceText"),
        reasons = json.optJSONArray("reasons").toStringList(),
      )
    }
  }
}

private fun JSONArray?.toStringSet(): Set<String> {
  if (this == null) return emptySet()
  return buildSet {
    for (index in 0 until length()) add(optString(index))
  }
}

private fun JSONArray?.toStringList(): List<String> {
  if (this == null) return emptyList()
  return buildList {
    for (index in 0 until length()) add(optString(index))
  }
}

private fun JSONArray?.toScanItems(): List<ScanResultItem> {
  if (this == null) return emptyList()
  return buildList {
    for (index in 0 until length()) {
      optJSONObject(index)?.let { add(ScanResultItem.fromJson(it)) }
    }
  }
}
