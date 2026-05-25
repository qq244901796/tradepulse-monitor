package net.tradepulse.monitor

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import net.tradepulse.monitor.databinding.ActivityHistoryBinding

class HistoryActivity : AppCompatActivity() {
  private lateinit var binding: ActivityHistoryBinding

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    binding = ActivityHistoryBinding.inflate(layoutInflater)
    setContentView(binding.root)

    binding.backButton.setOnClickListener { finish() }
    renderHistory()
  }

  private fun renderHistory() {
    val store = MonitorStore(applicationContext)
    val texts = uiTexts(store.loadConfig().language)
    binding.backButton.text = texts.back
    binding.historyTitleText.text = texts.historyTitle

    val history = store.loadHistoryText(limit = 100)
    binding.historyText.text = if (history == "暂无历史" && texts === UiTexts.EN) {
      "No history"
    } else {
      history
    }
  }
}
