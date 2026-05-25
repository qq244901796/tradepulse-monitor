package net.tradepulse.monitor

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class TradePulseCoreBridge(private val context: Context) {
  private val bundleSource: String by lazy {
    context.assets.open("tradepulse-core.bundle.js").bufferedReader().use { it.readText() }
  }

  fun analyze(
    tradeDate: String,
    stockCsv: String,
    powerCsv: String,
    chartRowsBySymbol: Map<String, String> = emptyMap(),
    config: MonitorConfig,
    seenSignals: Set<String>,
  ): RenderedScan {
    val script = buildScript(tradeDate, stockCsv, powerCsv, chartRowsBySymbol, config, seenSignals)
    return parseRenderedScan(evaluateWithWebView(script))
  }

  private fun evaluateWithWebView(script: String): String {
    check(Looper.myLooper() != Looper.getMainLooper()) {
      "识别逻辑不能在主线程执行。"
    }

    val latch = CountDownLatch(1)
    val resultRef = AtomicReference<String?>()
    val errorRef = AtomicReference<Throwable?>()

    Handler(Looper.getMainLooper()).post {
      var webView: WebView? = null
      try {
        webView = WebView(context.applicationContext).apply {
          configureForLocalJavaScript(settings)
          webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String?) {
              view.evaluateJavascript(script) { encodedResult ->
                try {
                  if (encodedResult == null || encodedResult == "null") {
                    error("识别逻辑没有返回结果。")
                  }
                  resultRef.set(decodeEvaluateJavascriptResult(encodedResult))
                } catch (error: Throwable) {
                  errorRef.set(error)
                } finally {
                  view.destroy()
                  latch.countDown()
                }
              }
            }
          }
        }
        webView.loadDataWithBaseURL(
          "https://local.tradepulse.monitor/",
          "<!doctype html><html><head></head><body></body></html>",
          "text/html",
          "UTF-8",
          null,
        )
      } catch (error: Throwable) {
        webView?.destroy()
        errorRef.set(error)
        latch.countDown()
      }
    }

    if (!latch.await(30, TimeUnit.SECONDS)) {
      throw IllegalStateException("识别逻辑执行超时，请更新 Android System WebView 或 Chrome。")
    }

    errorRef.get()?.let { error ->
      throw IllegalStateException(
        "识别逻辑执行失败，请更新 Android System WebView/Chrome，或重新同步共享核心。",
        error,
      )
    }

    return resultRef.get()
      ?: throw IllegalStateException("识别逻辑执行失败：没有返回结果。")
  }

  private fun configureForLocalJavaScript(settings: WebSettings) {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = false
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    settings.cacheMode = WebSettings.LOAD_NO_CACHE
    settings.blockNetworkLoads = true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
      settings.allowFileAccessFromFileURLs = false
      settings.allowUniversalAccessFromFileURLs = false
    }
  }

  private fun decodeEvaluateJavascriptResult(value: String): String {
    return JSONArray("[$value]").getString(0)
  }

  private fun buildScript(
    tradeDate: String,
    stockCsv: String,
    powerCsv: String,
    chartRowsBySymbol: Map<String, String>,
    config: MonitorConfig,
    seenSignals: Set<String>,
  ): String {
    val seenJson = JSONArray(seenSignals.toList()).toString()
    val configJson = config.toJsConfigJson()
    val chartJson = JSONObject().apply {
      chartRowsBySymbol.forEach { (symbol, rawJson) ->
        put(symbol, runCatching { JSONArray(rawJson) }.getOrElse { JSONArray() })
      }
    }.toString()
    return """
      $bundleSource
      (function () {
        const language = ${JSONObject.quote(config.language)};
        const seenSignals = JSON.parse(${JSONObject.quote(seenJson)});
        const result = globalThis.TradePulseCore.analyzeTradePulseFromCsv({
          date: ${JSONObject.quote(tradeDate)},
          stockCsv: ${JSONObject.quote(stockCsv)},
          powerCsv: ${JSONObject.quote(powerCsv)},
          chartRowsBySymbol: JSON.parse(${JSONObject.quote(chartJson)}),
          config: JSON.parse(${JSONObject.quote(configJson)}),
          seenSignals: seenSignals
        });

        function fixed(value, digits) {
          const number = Number(value);
          return Number.isFinite(number) ? number.toFixed(digits == null ? 2 : digits) : '-';
        }

        function metricText(item) {
          const metrics = item.metrics || {};
          if (!metrics.rows) {
            return {
              price: '-',
              largeDeal: '-',
              recentLargeDeal: '-'
            };
          }
          return {
            price: fixed(metrics.firstPrice) + ' -> ' + fixed(metrics.lastPrice) + ' (' + fixed(metrics.priceChangePct, 2) + '%)',
            largeDeal: fixed(metrics.totalLargeDeal) + ' / ' + fixed((metrics.largeDealRatio || 0) * 100, 1) + '%',
            recentLargeDeal: fixed(metrics.recentLargeDeal) + ' / ' + fixed((metrics.recentLargeDealRatio || 0) * 100, 1) + '%'
          };
        }

        function renderPricePlan(plan) {
          if (!plan) return null;
          const status = plan.status || 'NO_DATA';
          const sourceKey = plan.source === 'chart' ? 'pricePlanSourceChart' : 'pricePlanSourceExport';
          const statusText = globalThis.TradePulseCore.t(language, 'pricePlanStatus' + status);
          const actionText = plan.actionable
            ? globalThis.TradePulseCore.t(language, 'pricePlanActionable')
            : globalThis.TradePulseCore.t(language, 'pricePlanNotActionable');
          return {
            status: status,
            statusText: statusText,
            actionText: actionText,
            watchPriceText: fixed(plan.watchPrice),
            buyZoneText: fixed(plan.buyZoneLow) + ' - ' + fixed(plan.buyZoneHigh),
            breakoutText: fixed(plan.confirmBreakoutPrice),
            stopText: fixed(plan.riskStopPrice),
            confidenceText: (plan.confidenceScore || 0) + '/' + (plan.minConfidence || 60),
            sourceText: globalThis.TradePulseCore.t(language, sourceKey),
            reasons: (plan.reasons || []).slice(0, 2)
              .map((reason) => globalThis.TradePulseCore.translateReason(reason, language))
          };
        }

        const items = result.results.map((item) => {
          const metrics = metricText(item);
          const reasons = (item.reasons || []).slice(0, 4)
            .map((reason) => globalThis.TradePulseCore.translateReason(reason, language));
          return {
            symbol: item.symbol,
            signal: item.signal,
            signalText: globalThis.TradePulseCore.t(language, item.signal),
            buyScore: item.buyScore,
            sellScore: item.sellScore,
            firstSeen: Boolean(item.firstSeen),
            priceText: metrics.price,
            largeDealText: metrics.largeDeal,
            recentLargeDealText: metrics.recentLargeDeal,
            reasons: reasons,
            pricePlan: renderPricePlan(item.pricePlan)
          };
        });

        const renderedBlocks = items.map((item) => {
          const lines = [
            item.symbol + '  ' + item.signalText + (item.firstSeen ? '  首次' : ''),
            '买入分 ' + item.buyScore + ' / 卖压分 ' + item.sellScore,
            item.priceText,
            globalThis.TradePulseCore.t(language, 'largeDeal') + ': ' + item.largeDealText,
            globalThis.TradePulseCore.t(language, 'recentLargeDeal') + ': ' + item.recentLargeDealText,
            item.pricePlan
              ? globalThis.TradePulseCore.t(language, 'pricePlan') + ': ' + item.pricePlan.statusText + ' / ' + item.pricePlan.buyZoneText + ' / ' + item.pricePlan.confidenceText
              : '',
            ...item.reasons.map((value) => '- ' + value)
          ].filter(Boolean);
          return lines.join('\n');
        });

        const summaryText = Object.keys(globalThis.TradePulseCore.SIGNAL_KEYS)
          .map((signal) => globalThis.TradePulseCore.t(language, signal) + ': ' + (result.summary[signal] || 0))
          .join(' / ');

        const mergedSeen = new Set(seenSignals);
        result.results.forEach((item) => {
          if (item.signal !== 'NEUTRAL' && item.signal !== 'NO_DATA') {
            mergedSeen.add(result.date + '|' + item.symbol + '|' + item.signal);
          }
        });

        return JSON.stringify({
          generatedAt: new Date().toISOString(),
          tradeDate: result.date,
          summaryText: summaryText,
          resultsText: renderedBlocks.join('\n\n'),
          seenSignals: Array.from(mergedSeen),
          items: items
        });
      }());
    """.trimIndent()
  }

  private fun parseRenderedScan(raw: String): RenderedScan {
    val json = JSONObject(raw)
    val seenJson = json.optJSONArray("seenSignals") ?: JSONArray()
    val itemJson = json.optJSONArray("items") ?: JSONArray()
    return RenderedScan(
      generatedAt = json.optString("generatedAt"),
      tradeDate = json.optString("tradeDate"),
      summaryText = json.optString("summaryText"),
      resultsText = json.optString("resultsText"),
      seenSignals = buildSet {
        for (index in 0 until seenJson.length()) add(seenJson.optString(index))
      },
      items = buildList {
        for (index in 0 until itemJson.length()) {
          itemJson.optJSONObject(index)?.let { add(ScanResultItem.fromJson(it)) }
        }
      },
    )
  }
}
