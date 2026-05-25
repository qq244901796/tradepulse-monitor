package net.tradepulse.monitor

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.content.res.ColorStateList
import android.graphics.Color
import android.graphics.Typeface
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import net.tradepulse.monitor.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
  private lateinit var binding: ActivityMainBinding
  private lateinit var engine: AndroidMonitorEngine
  private var refreshJob: Job? = null
  private var currentFilter = ResultFilter.ALL
  private val editingSymbols = mutableListOf<String>()

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityMainBinding.inflate(layoutInflater)
    setContentView(binding.root)

    engine = AndroidMonitorEngine(applicationContext)
    MonitorNotifier(applicationContext).createChannels()
    setupLanguageSpinner()
    renderStoredState(updateForm = true)
    bindActions()
    requestNotificationPermissionIfNeeded()
  }

  override fun onStart() {
    super.onStart()
    refreshJob = lifecycleScope.launch {
      while (isActive) {
        renderStoredState(updateForm = false)
        delay(3_000)
      }
    }
  }

  override fun onStop() {
    refreshJob?.cancel()
    refreshJob = null
    super.onStop()
  }

  private fun bindActions() {
    binding.historyButton.setOnClickListener {
      startActivity(Intent(this, HistoryActivity::class.java))
    }

    binding.settingsButton.setOnClickListener {
      val config = engine.loadConfig()
      if (isSettingsPanelVisible() && config.validate() == null) {
        setSettingsPanelVisible(false)
      } else {
        populateConfigForm(config)
        setSettingsPanelVisible(true)
      }
    }

    binding.moreButton.setOnClickListener {
      showMoreMenu()
    }

    binding.addSymbolButton.setOnClickListener {
      addSymbolFromInput()
    }

    binding.closeSettingsButton.setOnClickListener {
      if (engine.loadConfig().validate() == null) {
        setSettingsPanelVisible(false)
      } else {
        toast(formTexts().completeConfigBeforeClose)
      }
    }

    binding.saveButton.setOnClickListener {
      val oldConfig = engine.loadConfig()
      val config = readConfigFromForm()

      if (onlyLanguageChanged(oldConfig, config)) {
        engine.saveConfig(config)
        populateConfigForm(config)
        renderStoredState(updateForm = false)
        if (config.validate() == null) setSettingsPanelVisible(false)
        toast(uiTexts(config.language).languageSaved)
        return@setOnClickListener
      }

      val texts = uiTexts(config.language)
      validateConfig(config, texts)?.let { message ->
        toast(message)
        setSettingsPanelVisible(true)
        return@setOnClickListener
      }
      engine.saveConfig(config)
      runScan(
        trigger = "manual",
        mode = "手动扫描",
        startBackgroundAfterSuccess = true,
        hideSettingsAfterSuccess = true,
      )
    }

    binding.scanButton.setOnClickListener {
      if (!ensureStoredConfigReady()) return@setOnClickListener
      runScan(
        trigger = "manual",
        mode = "手动扫描",
        startBackgroundAfterSuccess = false,
        hideSettingsAfterSuccess = false,
      )
    }

    binding.filterAll.setOnClickListener { setFilter(ResultFilter.ALL) }
    binding.filterEntry.setOnClickListener { setFilter(ResultFilter.ENTRY) }
    binding.filterFirst.setOnClickListener { setFilter(ResultFilter.FIRST) }
    binding.filterSell.setOnClickListener { setFilter(ResultFilter.SELL) }
  }

  private fun showMoreMenu() {
    val texts = currentTexts()
    PopupMenu(this, binding.moreButton).apply {
      menu.add(texts.startBackground).setOnMenuItemClickListener {
        if (ensureStoredConfigReady()) runNetworkTest(startBackgroundAfterSuccess = true)
        true
      }
      menu.add(texts.stopBackground).setOnMenuItemClickListener {
        MonitorForegroundService.stop(this@MainActivity)
        engine.saveRuntimeState("后台服务已停止。", "已停止")
        toast(texts.backgroundStopped)
        renderStoredState(updateForm = false)
        true
      }
      menu.add(texts.testNetwork).setOnMenuItemClickListener {
        runNetworkTest(startBackgroundAfterSuccess = false)
        true
      }
      show()
    }
  }

  private fun runScan(
    trigger: String,
    mode: String,
    startBackgroundAfterSuccess: Boolean,
    hideSettingsAfterSuccess: Boolean,
  ) {
    val texts = currentTexts()
    setBusy(true)
    binding.statusText.text = texts.scanning
    binding.lastScanText.text = texts.pleaseWait
    lifecycleScope.launch {
      val result = withContext(Dispatchers.IO) {
        engine.scan(trigger = trigger, mode = mode, sendNotifications = true)
      }
      setBusy(false)
      if (result.ok) {
        if (startBackgroundAfterSuccess) {
          val config = engine.loadConfig()
          ScanWorker.schedule(this@MainActivity, config.intervalMinutes)
          MonitorForegroundService.start(this@MainActivity)
          toast(uiTexts(config.language).scanSuccessBackground)
        } else {
          toast(currentTexts().scanComplete)
        }
        if (hideSettingsAfterSuccess) {
          populateConfigForm(engine.loadConfig())
          setSettingsPanelVisible(false)
        }
        renderStoredState(updateForm = false)
      } else if (result.skipped) {
        toast(result.message)
      } else {
        renderStoredState(updateForm = false)
        showError(result.message.ifBlank { currentTexts().scanFailed })
      }
    }
  }

  private fun runNetworkTest(startBackgroundAfterSuccess: Boolean) {
    val texts = currentTexts()
    setBusy(true)
    binding.statusText.text = texts.testingNetwork
    binding.lastScanText.text = texts.pleaseWait
    lifecycleScope.launch {
      val results = withContext(Dispatchers.IO) { engine.testNetwork() }
      setBusy(false)
      val message = results.joinToString("\n") { it.message }
      val allOk = results.all { it.ok }
      if (allOk && startBackgroundAfterSuccess) {
        val config = engine.loadConfig()
        ScanWorker.schedule(this@MainActivity, config.intervalMinutes)
        MonitorForegroundService.start(this@MainActivity)
        engine.saveRuntimeState("网络测试通过，后台监控已启动。", "后台服务")
        renderStoredState(updateForm = false)
      } else {
        renderStoredState(updateForm = false)
      }
      MaterialAlertDialogBuilder(this@MainActivity)
        .setTitle(if (allOk) currentTexts().networkPassed else currentTexts().networkFailed)
        .setMessage(message)
        .setPositiveButton(currentTexts().gotIt, null)
        .show()
    }
  }

  private fun renderStoredState(updateForm: Boolean) {
    val config = engine.loadConfig()
    val texts = uiTexts(config.language)
    val configError = validateConfig(config, texts)
    val scan = engine.lastScan()
    val status = engine.lastStatusText()

    renderStaticTexts(texts)

    if (updateForm) {
      populateConfigForm(config)
      setSettingsPanelVisible(configError != null)
    }

    binding.securityText.text = texts.security
    binding.stockCountText.text = buildStockLine(config, configError, texts)

    if (configError == null) {
      binding.statusText.text = buildHeadlineStatus(status, scan, texts)
      binding.lastScanText.text = buildLastScanText(status, scan, texts)
      binding.summaryText.text = buildSummaryText(scan, texts)
      renderResults(scan, texts)
    } else {
      binding.statusText.text = texts.needConfig
      binding.lastScanText.text = texts.fillConfigStart
      binding.summaryText.text = texts.settingsHelp
      renderResults(null, texts)
    }

    renderFilterState()
  }

  private fun renderResults(scan: RenderedScan?, texts: UiTexts) {
    binding.resultsContainer.removeAllViews()
    val items = scan?.items.orEmpty()
      .filter { item ->
        when (currentFilter) {
          ResultFilter.ALL -> true
          ResultFilter.ENTRY -> item.isEntrySignal
          ResultFilter.FIRST -> item.firstSeen
          ResultFilter.SELL -> item.isSellPressure
        }
      }
      .sortedWith(compareBy<ScanResultItem> { signalPriority(it) }.thenBy { it.symbol })

    if (items.isEmpty()) {
      binding.resultsContainer.addView(
        simpleText(
          value = if (scan == null) texts.noScanResults else texts.noFilteredResults,
          color = "#667085",
        ),
      )
      return
    }

    items.forEach { item ->
      binding.resultsContainer.addView(resultCard(item, texts))
    }
  }

  private fun resultCard(item: ScanResultItem, texts: UiTexts): MaterialCardView {
    val density = resources.displayMetrics.density
    val color = signalColor(item)
    val card = MaterialCardView(this).apply {
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      ).apply {
        topMargin = (8 * density).toInt()
      }
      radius = 8 * density
      strokeWidth = (1 * density).toInt()
      strokeColor = Color.parseColor(color)
      setCardBackgroundColor(Color.WHITE)
      setContentPadding(
        (12 * density).toInt(),
        (10 * density).toInt(),
        (12 * density).toInt(),
        (10 * density).toInt(),
      )
    }

    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
    }

    val titleRow = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = android.view.Gravity.CENTER_VERTICAL
    }
    titleRow.addView(
      simpleText(
        value = item.symbol,
        bold = true,
        color = "#101828",
        textSize = 18f,
      ).apply {
        layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
      },
    )
    titleRow.addView(
      simpleText(
        value = "${texts.signal(item.signal)}${if (item.firstSeen) " · ${texts.firstTag}" else ""}",
        bold = true,
        color = color,
        textSize = 14f,
      ).apply {
        layoutParams = LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.WRAP_CONTENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        )
      },
    )
    content.addView(titleRow)

    content.addView(
      simpleText(
        value = "${texts.buyScore} ${item.buyScore}  |  ${texts.sellScore} ${item.sellScore}",
        bold = true,
        color = "#344054",
      ),
    )
    content.addView(simpleText("${texts.price} ${item.priceText}", color = "#475467"))
    content.addView(simpleText("${texts.largeDeal} ${item.largeDealText}", color = "#475467"))
    content.addView(simpleText("${texts.recentLargeDeal} ${item.recentLargeDealText}", color = "#475467"))

    item.pricePlan?.let { plan ->
      content.addView(
        simpleText(
          value = "${pricePlanLabel(texts, "title")}  ${plan.statusText} / ${plan.actionText}",
          bold = true,
          color = if (item.isEntrySignal) "#047857" else "#344054",
        ),
      )
      content.addView(
        simpleText(
          value = "${pricePlanLabel(texts, "watch")} ${plan.watchPriceText}  |  ${pricePlanLabel(texts, "zone")} ${plan.buyZoneText}",
          color = "#475467",
          textSize = 13f,
        ),
      )
      content.addView(
        simpleText(
          value = "${pricePlanLabel(texts, "breakout")} ${plan.breakoutText}  |  ${pricePlanLabel(texts, "stop")} ${plan.stopText}",
          color = "#475467",
          textSize = 13f,
        ),
      )
      content.addView(
        simpleText(
          value = "${pricePlanLabel(texts, "confidence")} ${plan.confidenceText}  |  ${pricePlanLabel(texts, "source")} ${plan.sourceText}",
          color = "#667085",
          textSize = 13f,
        ),
      )
      plan.reasons.take(2).forEach { reason ->
        content.addView(simpleText("- $reason", color = "#667085", textSize = 13f))
      }
    }

    item.reasons.take(4).forEach { reason ->
      content.addView(simpleText("- $reason", color = "#667085", textSize = 13f))
    }
    card.addView(content)
    return card
  }

  private fun simpleText(
    value: String,
    bold: Boolean = false,
    color: String = "#344054",
    textSize: Float = 14f,
  ): TextView {
    return TextView(this).apply {
      text = value
      this.textSize = textSize
      setTextColor(Color.parseColor(color))
      if (bold) setTypeface(typeface, Typeface.BOLD)
      layoutParams = LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
      )
    }
  }

  private fun pricePlanLabel(texts: UiTexts, key: String): String {
    val english = texts === UiTexts.EN
    return when (key) {
      "title" -> if (english) "Price Plan" else "\u4ef7\u683c\u8ba1\u5212"
      "watch" -> if (english) "Watch" else "\u89c2\u5bdf\u4ef7"
      "zone" -> if (english) "Zone" else "\u4e70\u5165\u533a\u95f4"
      "breakout" -> if (english) "Breakout" else "\u7a81\u7834\u786e\u8ba4"
      "stop" -> if (english) "Stop" else "\u98ce\u9669\u6b62\u635f"
      "confidence" -> if (english) "Confidence" else "\u53ef\u4fe1\u5ea6"
      "source" -> if (english) "Source" else "\u6570\u636e\u6e90"
      else -> key
    }
  }

  private fun setFilter(filter: ResultFilter) {
    currentFilter = filter
    renderStoredState(updateForm = false)
  }

  private fun renderStaticTexts(texts: UiTexts) {
    binding.historyButton.text = texts.history
    binding.settingsButton.text = texts.settings
    binding.moreButton.text = texts.more
    binding.scanButton.text = texts.scan
    binding.settingsTitleText.text = texts.settings
    binding.closeSettingsButton.text = texts.close
    binding.settingsHintText.text = texts.settingsHint
    binding.emailLabel.text = texts.email
    binding.passwordLabel.text = texts.password
    binding.symbolsLabel.text = texts.symbols
    binding.symbolsHelpText.text = texts.symbolsHelp
    binding.stockSymbolInput.hint = texts.symbolHint
    binding.addSymbolButton.text = texts.add
    binding.intervalLabel.text = texts.interval
    binding.intervalHelpText.text = texts.intervalHelp
    binding.lookbackLabel.text = texts.lookback
    binding.lookbackHelpText.text = texts.lookbackHelp
    binding.entryScoreLabel.text = texts.entryScore
    binding.entryScoreHelpText.text = texts.entryScoreHelp
    binding.strongScoreLabel.text = texts.strongScore
    binding.strongScoreHelpText.text = texts.strongScoreHelp
    binding.languageLabel.text = texts.language
    binding.notifyCheck.text = texts.notifyEntry
    binding.saveButton.text = texts.saveAndStart
    binding.resultsTitleText.text = texts.resultsTitle
    binding.resultsSubtitleText.text = texts.resultsSubtitle
    binding.filterAll.text = texts.all
    binding.filterEntry.text = texts.entry
    binding.filterFirst.text = texts.first
    binding.filterSell.text = texts.sell
  }

  private fun currentTexts(): UiTexts {
    return uiTexts(engine.loadConfig().language)
  }

  private fun formTexts(): UiTexts {
    return uiTexts(if (binding.languageSpinner.selectedItemPosition == 1) "en-US" else "zh-CN")
  }

  private fun validateConfig(config: MonitorConfig, texts: UiTexts): String? {
    if (config.email.isBlank()) return texts.emailRequired
    if (config.password.isBlank()) return texts.passwordRequired
    if (config.symbols.isEmpty()) return texts.symbolRequired
    if (config.intervalMinutes < 1) return texts.intervalInvalid
    if (config.lookbackMinutes < 1) return texts.lookbackInvalid
    if (config.entryScore !in 0..100) return texts.entryScoreInvalid
    if (config.strongEntryScore !in 0..100) return texts.strongScoreInvalid
    return null
  }

  private fun onlyLanguageChanged(oldConfig: MonitorConfig, newConfig: MonitorConfig): Boolean {
    return oldConfig.language != newConfig.language && oldConfig.copy(language = newConfig.language) == newConfig
  }

  private fun readConfigFromForm(): MonitorConfig {
    val stored = engine.loadConfig()
    val passwordText = binding.passwordInput.text?.toString().orEmpty()
    return MonitorConfig(
      email = binding.emailInput.text?.toString()?.trim().orEmpty(),
      password = passwordText.ifBlank { stored.password },
      symbols = editingSymbols.toList(),
      intervalMinutes = binding.intervalInput.text?.toString()?.toIntOrNull() ?: 5,
      lookbackMinutes = binding.lookbackInput.text?.toString()?.toIntOrNull() ?: 30,
      entryScore = binding.entryScoreInput.text?.toString()?.toIntOrNull() ?: 45,
      strongEntryScore = binding.strongScoreInput.text?.toString()?.toIntOrNull() ?: 70,
      pricePlanEnabled = stored.pricePlanEnabled,
      pricePullbackTolerancePct = stored.pricePullbackTolerancePct,
      priceStopBufferPct = stored.priceStopBufferPct,
      priceMinConfidence = stored.priceMinConfidence,
      language = if (binding.languageSpinner.selectedItemPosition == 1) "en-US" else "zh-CN",
      notifyEntrySignals = binding.notifyCheck.isChecked,
    )
  }

  private fun populateConfigForm(config: MonitorConfig) {
    val texts = uiTexts(config.language)
    binding.emailInput.setText(config.email)
    binding.passwordInput.setText("")
    binding.passwordInput.hint = if (config.password.isBlank()) {
      texts.passwordFirstHint
    } else {
      texts.passwordKeepHint
    }
    binding.stockSymbolInput.setText("")
    editingSymbols.clear()
    editingSymbols.addAll(config.symbols)
    renderEditingSymbols(texts)
    binding.intervalInput.setText(config.intervalMinutes.toString())
    binding.lookbackInput.setText(config.lookbackMinutes.toString())
    binding.entryScoreInput.setText(config.entryScore.toString())
    binding.strongScoreInput.setText(config.strongEntryScore.toString())
    binding.languageSpinner.setSelection(if (config.language == "en-US") 1 else 0, false)
    binding.notifyCheck.isChecked = config.notifyEntrySignals
  }

  private fun addSymbolFromInput() {
    val texts = formTexts()
    val raw = binding.stockSymbolInput.text?.toString().orEmpty()
    val symbol = raw.trim().uppercase()
    when {
      symbol.isBlank() -> {
        toast(texts.enterSymbol)
        return
      }
      symbol.contains(Regex("[\\s,;，；]+")) -> {
        toast(texts.oneSymbolOnly)
        return
      }
      !symbol.matches(SYMBOL_REGEX) -> {
        toast(texts.symbolInvalid)
        return
      }
      editingSymbols.contains(symbol) -> {
        toast(texts.symbolDuplicate)
        return
      }
    }

    editingSymbols.add(symbol)
    binding.stockSymbolInput.setText("")
    renderEditingSymbols(texts)
  }

  private fun renderEditingSymbols(texts: UiTexts = formTexts()) {
    binding.symbolsContainer.removeAllViews()
    if (editingSymbols.isEmpty()) {
      binding.symbolsContainer.addView(
        simpleText(
          value = texts.noSymbolsAdded,
          color = "#667085",
          textSize = 13f,
        ),
      )
      return
    }

    val density = resources.displayMetrics.density
    editingSymbols.forEach { symbol ->
      val row = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
        gravity = android.view.Gravity.CENTER_VERTICAL
        layoutParams = LinearLayout.LayoutParams(
          ViewGroup.LayoutParams.MATCH_PARENT,
          ViewGroup.LayoutParams.WRAP_CONTENT,
        ).apply {
          topMargin = (6 * density).toInt()
        }
        setPadding(
          (10 * density).toInt(),
          (6 * density).toInt(),
          (8 * density).toInt(),
          (6 * density).toInt(),
        )
        backgroundTintList = ColorStateList.valueOf(Color.parseColor("#F2F4F7"))
      }

      row.addView(
        simpleText(
          value = symbol,
          bold = true,
          color = "#101828",
          textSize = 15f,
        ).apply {
          layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        },
      )

      row.addView(
        MaterialButton(this).apply {
          text = texts.delete
          minWidth = 0
          setPadding((10 * density).toInt(), 0, (10 * density).toInt(), 0)
          textSize = 13f
          setTextColor(Color.parseColor("#B42318"))
          backgroundTintList = ColorStateList.valueOf(Color.TRANSPARENT)
          strokeColor = ColorStateList.valueOf(Color.parseColor("#FDA29B"))
          strokeWidth = (1 * density).toInt()
          setOnClickListener {
            editingSymbols.remove(symbol)
            renderEditingSymbols(texts)
          }
        },
      )

      binding.symbolsContainer.addView(row)
    }
  }

  private fun ensureStoredConfigReady(): Boolean {
    val config = engine.loadConfig()
    val texts = uiTexts(config.language)
    val error = validateConfig(config, texts)
    if (error == null) return true

    populateConfigForm(config)
    setSettingsPanelVisible(true)
    binding.statusText.text = texts.needConfig
    binding.lastScanText.text = texts.fillConfigStart
    binding.summaryText.text = texts.settingsHelp
    toast(error)
    return false
  }

  private fun buildStockLine(config: MonitorConfig, configError: String?, texts: UiTexts): String {
    if (configError != null) return texts.stockCountNeedConfig
    val symbols = config.symbols.take(3).joinToString(" / ")
    val suffix = if (texts === UiTexts.EN) {
      if (config.symbols.size > 3) " and ${config.symbols.size} total" else " ${config.symbols.size} total"
    } else {
      if (config.symbols.size > 3) " 等 ${config.symbols.size} 只" else " ${config.symbols.size} 只"
    }
    return "$symbols$suffix · ${String.format(texts.everyMinutes, config.intervalMinutes)}"
  }

  private fun buildHeadlineStatus(status: String, scan: RenderedScan?, texts: UiTexts): String {
    return when {
      status.contains("正在") -> texts.running
      status.contains("失败") -> texts.failed
      status.contains("停止") -> texts.backgroundStoppedHeadline
      status.contains("后台服务") || status.contains("后台监控") -> texts.backgroundRunning
      scan == null -> texts.waitingFirstScan
      scan.items.any { it.isEntrySignal } -> texts.entryFound
      scan.items.any { it.isSellPressure } -> texts.sellFound
      else -> texts.neutral
    }
  }

  private fun buildLastScanText(status: String, scan: RenderedScan?, texts: UiTexts): String {
    val lastScan = extractStatusValue(status, "最近扫描")
    return when {
      lastScan != null && scan != null -> "${texts.lastScan} $lastScan · ${texts.data} ${scan.tradeDate}"
      lastScan != null -> "${texts.lastScan} $lastScan"
      scan != null -> "${texts.data} ${scan.tradeDate}"
      else -> texts.noScanYet
    }
  }

  private fun buildSummaryText(scan: RenderedScan?, texts: UiTexts): String {
    if (scan == null) return texts.noSummary
    val entryCount = scan.items.count { it.isEntrySignal }
    val firstCount = scan.items.count { it.firstSeen && it.isEntrySignal }
    val sellCount = scan.items.count { it.isSellPressure }
    return "${texts.entry} $entryCount  |  ${texts.first} $firstCount  |  ${texts.sell} $sellCount"
  }

  private fun extractStatusValue(status: String, label: String): String? {
    return status
      .lineSequence()
      .map { it.trim() }
      .firstOrNull { it.startsWith("$label：") }
      ?.substringAfter("：")
      ?.trim()
      ?.takeIf { it.isNotBlank() }
  }

  private fun signalPriority(item: ScanResultItem): Int {
    return when {
      item.isEntrySignal && item.firstSeen -> 0
      item.isEntrySignal -> 1
      item.isSellPressure -> 2
      else -> 3
    }
  }

  private fun signalColor(item: ScanResultItem): String {
    return when {
      item.isEntrySignal -> "#047857"
      item.isSellPressure -> "#B42318"
      else -> "#98A2B3"
    }
  }

  private fun renderFilterState() {
    styleFilter(binding.filterAll, currentFilter == ResultFilter.ALL)
    styleFilter(binding.filterEntry, currentFilter == ResultFilter.ENTRY)
    styleFilter(binding.filterFirst, currentFilter == ResultFilter.FIRST)
    styleFilter(binding.filterSell, currentFilter == ResultFilter.SELL)
  }

  private fun styleFilter(button: MaterialButton, selected: Boolean) {
    val background = if (selected) "#0F766E" else "#FFFFFF"
    val foreground = if (selected) "#FFFFFF" else "#344054"
    val stroke = if (selected) "#0F766E" else "#D0D5DD"
    button.backgroundTintList = ColorStateList.valueOf(Color.parseColor(background))
    button.setTextColor(Color.parseColor(foreground))
    button.strokeColor = ColorStateList.valueOf(Color.parseColor(stroke))
  }

  private fun isSettingsPanelVisible(): Boolean {
    return binding.settingsPanel.visibility == View.VISIBLE
  }

  private fun setSettingsPanelVisible(visible: Boolean) {
    binding.settingsPanel.visibility = if (visible) View.VISIBLE else View.GONE
  }

  private fun setupLanguageSpinner() {
    val adapter = ArrayAdapter(
      this,
      android.R.layout.simple_spinner_dropdown_item,
      listOf("中文", "English"),
    )
    binding.languageSpinner.adapter = adapter
  }

  private fun setBusy(busy: Boolean) {
    binding.historyButton.isEnabled = !busy
    binding.settingsButton.isEnabled = !busy
    binding.moreButton.isEnabled = !busy
    binding.closeSettingsButton.isEnabled = !busy
    binding.addSymbolButton.isEnabled = !busy
    binding.stockSymbolInput.isEnabled = !busy
    binding.saveButton.isEnabled = !busy
    binding.scanButton.isEnabled = !busy
    binding.filterAll.isEnabled = !busy
    binding.filterEntry.isEnabled = !busy
    binding.filterFirst.isEnabled = !busy
    binding.filterSell.isEnabled = !busy
  }

  private fun requestNotificationPermissionIfNeeded() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
    if (
      ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
      PackageManager.PERMISSION_GRANTED
    ) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), NOTIFICATION_REQUEST_CODE)
    }
  }

  private fun showError(message: String) {
    val texts = currentTexts()
    MaterialAlertDialogBuilder(this)
      .setTitle(texts.scanFailed)
      .setMessage(message)
      .setPositiveButton(texts.gotIt, null)
      .show()
  }

  private fun toast(message: String) {
    Toast.makeText(this, message, Toast.LENGTH_SHORT).show()
  }

  private enum class ResultFilter {
    ALL,
    ENTRY,
    FIRST,
    SELL,
  }

  companion object {
    private const val NOTIFICATION_REQUEST_CODE = 4101
    private val SYMBOL_REGEX = Regex("[A-Z0-9.\\-]+")
  }
}
