package net.tradepulse.monitor

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.net.UnknownHostException
import java.net.URLEncoder
import java.util.concurrent.TimeUnit

data class NetworkProbeResult(
  val name: String,
  val ok: Boolean,
  val message: String,
)

class TradePulseNetworkException(message: String, cause: Throwable? = null) : IOException(message, cause)

class TradePulseApi(
  private val email: String,
  private val password: String,
) {
  private val client = OkHttpClient.Builder()
    .cookieJar(MemoryCookieJar())
    .followRedirects(false)
    .followSslRedirects(false)
    .callTimeout(60, TimeUnit.SECONDS)
    .build()

  fun login() {
    val ret = URLEncoder.encode(APP_EXPORT_URL, Charsets.UTF_8.name())
    request("$AUTH_ORIGIN/trps/login?ret=$ret")

    val body = JSONObject()
      .put("teml", email)
      .put("tpass", password)
      .toString()
      .toRequestBody("application/json".toMediaType())

    val response = request(
      url = "$AUTH_ORIGIN/trps/login",
      method = "POST",
      headers = mapOf(
        "accept" to "application/json, text/plain, */*",
        "content-type" to "application/json",
        "origin" to AUTH_ORIGIN,
        "referer" to "$AUTH_ORIGIN/trps/login?ret=$ret",
      ),
      body = body,
    )
    val text = response.body?.string().orEmpty()
    check(response.isSuccessful) { "登录失败：HTTP ${response.code}" }
    if (text.isNotBlank()) {
      val payload = runCatching { JSONObject(text) }.getOrNull()
      if (payload?.optBoolean("status") == false) {
        error("登录失败：TradePulse 拒绝了账号密码。")
      }
    }
  }

  fun latestDate(): String {
    val response = request(
      url = "$DATA_ORIGIN/daily.enable.do",
      headers = mapOf("accept" to "application/json"),
    )
    val text = response.body?.string().orEmpty()
    check(response.isSuccessful) { "读取日期失败：HTTP ${response.code}" }
    val dates = JSONArray(text)
    return dates.optString(0).takeIf { it.isNotBlank() }
      ?: error("TradePulse 没有返回可用交易日。")
  }

  fun exportCsv(symbols: String, tradeDate: String, type: Int): String {
    val url = buildString {
      append("$APP_ORIGIN/api/export?")
      append("symbol=")
      append(URLEncoder.encode(symbols, Charsets.UTF_8.name()))
      append("&sdate=")
      append(tradeDate)
      append("&edate=")
      append(tradeDate)
      append("&type=")
      append(type)
    }
    val response = request(
      url = url,
      headers = mapOf(
        "accept" to "text/csv,*/*",
        "referer" to APP_EXPORT_URL,
      ),
    )
    if (response.code in 300..399) {
      error("导出失败：会话已失效。")
    }
    val text = response.body?.string().orEmpty()
    check(response.isSuccessful) { "导出失败：HTTP ${response.code}" }
    if (text.contains("sign in", ignoreCase = true) || text.contains("login", ignoreCase = true)) {
      error("导出失败：返回了登录页面。")
    }
    return text
  }

  fun chartRows(symbol: String): String {
    val url = "$DATA_ORIGIN/chart.do?sym=${URLEncoder.encode(symbol.uppercase(), Charsets.UTF_8.name())}"
    val response = request(
      url = url,
      headers = mapOf(
        "accept" to "application/json,*/*",
        "referer" to "$APP_ORIGIN/chart",
      ),
    )
    val text = response.body?.string().orEmpty()
    check(response.isSuccessful) { "读取 Chart 曲线失败：HTTP ${response.code}" }
    JSONArray(text)
    return text
  }

  private fun request(
    url: String,
    method: String = "GET",
    headers: Map<String, String> = emptyMap(),
    body: okhttp3.RequestBody? = null,
  ): okhttp3.Response {
    val request = Request.Builder()
      .url(url)
      .method(method, body)
      .header("user-agent", USER_AGENT)
      .apply {
        headers.forEach { (key, value) -> header(key, value) }
      }
      .build()
    return try {
      client.newCall(request).execute()
    } catch (error: UnknownHostException) {
      throw TradePulseNetworkException(resolveHostMessage(request.url.host), error)
    } catch (error: IOException) {
      throw TradePulseNetworkException(connectMessage(request.url.host, error.message), error)
    }
  }

  companion object {
    private const val APP_ORIGIN = "https://app-trps.tradepulse.net"
    private const val AUTH_ORIGIN = "https://auth0.tradepulse.net"
    private const val DATA_ORIGIN = "https://data1.tradepulse.net"
    private const val APP_EXPORT_URL = "$APP_ORIGIN/export"
    private const val USER_AGENT =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"

    fun testNetwork(): List<NetworkProbeResult> {
      val api = TradePulseApi("", "")
      return listOf(
        api.probe("登录域名", "$AUTH_ORIGIN/trps/login"),
        api.probe("数据日期接口", "$DATA_ORIGIN/daily.enable.do"),
        api.probe("Chart 曲线接口", "$DATA_ORIGIN/chart.do?sym=AAPL"),
        api.probe("导出页面", APP_EXPORT_URL),
      )
    }

    private fun resolveHostMessage(host: String): String {
      return "无法解析 TradePulse ${hostLabel(host)} $host。请检查手机网络、DNS、VPN/代理，或先在手机浏览器打开 TradePulse 登录页。"
    }

    private fun connectMessage(host: String, detail: String?): String {
      val suffix = detail?.takeIf { it.isNotBlank() }?.let { "（$it）" } ?: ""
      return "无法连接 TradePulse ${hostLabel(host)} $host$suffix。请检查手机网络、VPN/代理或防火墙。"
    }

    private fun hostLabel(host: String): String {
      return when (host) {
        "auth0.tradepulse.net" -> "登录域名"
        "app-trps.tradepulse.net" -> "导出接口域名"
        "data1.tradepulse.net" -> "交易日数据域名"
        else -> "域名"
      }
    }
  }

  private fun probe(name: String, url: String): NetworkProbeResult {
    return try {
      val response = request(url, headers = mapOf("accept" to "*/*"))
      response.close()
      if (response.code in 200..399) {
        NetworkProbeResult(name, true, "$name：可访问（HTTP ${response.code}）")
      } else {
        NetworkProbeResult(name, false, "$name：返回 HTTP ${response.code}")
      }
    } catch (error: Throwable) {
      NetworkProbeResult(name, false, "$name：${error.message ?: "访问失败"}")
    }
  }
}

private class MemoryCookieJar : CookieJar {
  private val cookies = mutableListOf<Cookie>()

  override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
    for (cookie in cookies) {
      this.cookies.removeAll { existing ->
        existing.name == cookie.name && existing.domain == cookie.domain && existing.path == cookie.path
      }
      this.cookies.add(cookie)
    }
  }

  override fun loadForRequest(url: HttpUrl): List<Cookie> {
    return cookies.filter { it.matches(url) }
  }
}
