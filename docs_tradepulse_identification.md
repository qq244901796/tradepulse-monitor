# TradePulse Institutional Entry Identification

Current data source:

- Page: `https://app-trps.tradepulse.net/export`
- Minute export API: `/api/export?symbol=AAPL,TSM&sdate=20260521&edate=20260521&type=0`
- Power inflow list API: `/api/export?symbol=*&sdate=20260521&edate=20260521&type=1`

The first detection version treats institutional entry as a weighted signal, not a single-field rule.

## Signals

- `Power Inflows list hit`: strongest signal. If a symbol appears in `type=1`, TradePulse itself marked it as a power-inflow event.
- `PWR INFLOW minute count`: confirmation from the symbol minute data.
- `LARGE DEAL net ratio`: large-deal net buying pressure.
  - `sum(LARGE DEAL) / sum(abs(LARGE DEAL))`
  - Strong positive ratio means large-deal prints are mostly buying-side.
- `Recent LARGE DEAL ratio`: same ratio over the latest N minutes, currently 30 minutes.
- `DAILY ACC.` and `MOMENTUM ACC.`: confirmation signals.
  - Positive and rising supports entry.
  - Negative and falling marks conflict or sell pressure.
- `Price change`: small confirmation only. Price is not the core signal.

## Output Classes

- `STRONG_ENTRY`: power/large-deal signals are strong and confirmation fields do not conflict materially.
- `MIXED_ENTRY`: strong entry evidence exists, but one or more confirmation fields are bearish.
- `POSSIBLE_ENTRY`: buy evidence is present but not strong enough for `STRONG_ENTRY`.
- `SELL_PRESSURE`: sell-side pressure dominates.
- `NEUTRAL`: no clear entry or exit signal.
- `NO_DATA`: export returned no rows for that symbol/date.

## Usage

Start the dedicated Chrome profile and log in once:

```powershell
.\scripts\start_tradepulse_chrome.ps1
```

Edit the watchlist:

```json
{
  "symbols": ["AAPL", "TSM", "IONQ"],
  "lookbackMinutes": 30,
  "minBuyScoreForEntry": 45,
  "minBuyScoreForStrongEntry": 70
}
```

Run the scan:

```powershell
node scripts\analyze_tradepulse_institutional.mjs
```

Override symbols/date without editing config:

```powershell
$env:SYMBOLS="NVDA,TSLA,AMD"; node scripts\analyze_tradepulse_institutional.mjs
$env:DATE="2026-05-21"; node scripts\analyze_tradepulse_institutional.mjs
```
