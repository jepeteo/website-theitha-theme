const SIGNALS_URL = "https://api.theitha.com/api/signals/list";
const SUMMARY_URL = "https://api.theitha.com/api/signals/summary";

/**
 * Mount a TradingView external-embedding widget into a container.
 * Injects a <div> with a JSON config inside a <script> tag pointing
 * to the correct TradingView embed script URL.
 * Idempotent: skips if data-tv-initialized is already set.
 */
function mountTradingViewWidget(containerId, scriptSrc, config) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    if (container.dataset.tvInitialized === "true") {
        return;
    }

    // TradingView external-embedding expects a wrapper div containing
    // a <script> with the config as its text content.
    const wrapper = document.createElement("div");
    wrapper.className = "tradingview-widget-container";

    const innerDiv = document.createElement("div");
    innerDiv.className = "tradingview-widget-container__widget";
    wrapper.appendChild(innerDiv);

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = scriptSrc;
    script.async = true;
    script.textContent = JSON.stringify(config);
    wrapper.appendChild(script);

    container.appendChild(wrapper);
    container.dataset.tvInitialized = "true";
}

function initGlobalHeaderTicker() {
    mountTradingViewWidget("tv-ticker",
        "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js",
        {
            symbols: [
                { proName: "FX:EURUSD", title: "EURUSD" },
                { proName: "OANDA:XAUUSD", title: "XAUUSD" },
                { proName: "BITSTAMP:BTCUSD", title: "BTCUSD" },
                { proName: "NASDAQ:NDX", title: "NASDAQ" }
            ],
            showSymbolLogo: true,
            isTransparent: true,
            displayMode: "adaptive",
            colorTheme: "dark",
            locale: "en"
        }
    );
}

function initHomeMarketOverview() {
    if (!document.querySelector("[data-view='home']")) {
        return;
    }

    mountTradingViewWidget("tv-market-overview",
        "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
        {
            colorTheme: "dark",
            dateRange: "12M",
            showChart: true,
            locale: "en",
            width: "100%",
            height: "100%",
            largeChartUrl: "",
            isTransparent: true,
            showSymbolLogo: true,
            showFloatingTooltip: false,
            tabs: [
                {
                    title: "Forex",
                    symbols: [
                        { s: "FX:EURUSD", d: "EUR/USD" },
                        { s: "FX:GBPUSD", d: "GBP/USD" },
                        { s: "FX:USDJPY", d: "USD/JPY" }
                    ]
                },
                {
                    title: "Commodities",
                    symbols: [
                        { s: "OANDA:XAUUSD", d: "Gold" },
                        { s: "TVC:USOIL", d: "US Oil" }
                    ]
                },
                {
                    title: "Crypto",
                    symbols: [
                        { s: "BITSTAMP:BTCUSD", d: "Bitcoin" },
                        { s: "BITSTAMP:ETHUSD", d: "Ethereum" }
                    ]
                }
            ]
        }
    );
}

function initMarketsPageWidgets() {
    if (!document.querySelector("[data-view='markets']")) {
        return;
    }

    mountTradingViewWidget("tv-advanced-chart",
        "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
        {
            symbol: "FX:EURUSD",
            width: "100%",
            height: 550,
            colorTheme: "dark",
            isTransparent: true,
            locale: "en",
            autosize: false
        }
    );

    mountTradingViewWidget("tv-economic-calendar",
        "https://s3.tradingview.com/external-embedding/embed-widget-economic-calendar.js",
        {
            width: "100%",
            height: 500,
            colorTheme: "dark",
            isTransparent: true,
            locale: "en"
        }
    );
}

/**
 * Format a relative time string from ISO date.
 */
function relativeTime(dateStr) {
    if (!dateStr) {
        return "";
    }
    try {
        const now = Date.now();
        const then = new Date(dateStr).getTime();
        const diffMs = now - then;
        if (diffMs < 0) {
            return "just now";
        }
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) {
            return "just now";
        }
        if (mins < 60) {
            return mins + "m ago";
        }
        const hours = Math.floor(mins / 60);
        if (hours < 24) {
            return hours + "h ago";
        }
        const days = Math.floor(hours / 24);
        if (days < 30) {
            return days + "d ago";
        }
        return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (_e) {
        return "";
    }
}

/**
 * Build a confidence meter bar (0–100).
 */
function buildConfidenceBar(confidence) {
    const outer = document.createElement("div");
    outer.className = "confidence-meter";

    const inner = document.createElement("div");
    const pct = Math.max(0, Math.min(100, Number(confidence) || 0));
    inner.className = "confidence-meter__fill";
    if (pct >= 70) {
        inner.classList.add("confidence-meter__fill--high");
    } else if (pct >= 40) {
        inner.classList.add("confidence-meter__fill--mid");
    } else {
        inner.classList.add("confidence-meter__fill--low");
    }
    inner.style.width = pct + "%";
    outer.appendChild(inner);

    return outer;
}

function removeSkeleton() {
    document.querySelectorAll("[data-signals-skeleton]").forEach((el) => el.remove());
}

function isLockedSignal(signal) {
    return Boolean(signal) && signal.locked === true;
}

function isFullSignal(signal) {
    return Boolean(signal) && signal.locked === false;
}

function createNode(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
}

function clearNode(node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function renderSummary(target, summary) {
    if (!target) {
        return;
    }

    clearNode(target);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-3 gap-4 text-center";

    const stats = [
        { label: "Active", value: summary.active },
        { label: "Winners", value: summary.winners },
        { label: "Total", value: summary.total }
    ];

    stats.forEach(({ label, value }) => {
        const cell = document.createElement("div");
        cell.className = "flex flex-col gap-1";

        const valNode = document.createElement("span");
        valNode.className = "data-mono text-lg font-semibold";
        valNode.textContent = value ?? "—";

        const labelNode = document.createElement("span");
        labelNode.className = "text-caption";
        labelNode.textContent = label;

        cell.appendChild(valNode);
        cell.appendChild(labelNode);
        grid.appendChild(cell);
    });

    target.appendChild(grid);

    if (summary?.updatedAt) {
        const updated = document.createElement("p");
        updated.className = "text-caption text-center mt-3";
        updated.textContent = `Updated: ${summary.updatedAt}`;
        target.appendChild(updated);
    }
}

function renderSignals(target, payload) {
    if (!target) {
        return;
    }

    clearNode(target);

    const signals = Array.isArray(payload?.data) ? payload.data : [];

    if (signals.length === 0) {
        const empty = document.createElement("div");
        empty.className = "signals-empty-state";
        empty.innerHTML =
            '<svg class="w-10 h-10 text-muted opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5" />' +
            '</svg>' +
            '<p class="text-text font-semibold">No signals available yet</p>' +
            '<p class="text-muted text-sm">New trading signals will appear here when published.</p>' +
            '<a href="/signals/" class="btn-outline mt-1">Go to Signals</a>';
        target.appendChild(empty);
        return;
    }

    signals.forEach((signal) => {
        const card = document.createElement("div");

        if (isLockedSignal(signal)) {
            card.className = "card-signal";

            const header = document.createElement("div");
            header.className = "flex items-center justify-between mb-2";

            const symbol = document.createElement("span");
            symbol.className = "font-semibold text-text";
            symbol.textContent = signal.symbol;

            const badge = document.createElement("span");
            badge.className = "badge badge--locked";
            badge.textContent = "Locked";

            header.appendChild(symbol);
            header.appendChild(badge);
            card.appendChild(header);

            const hint = document.createElement("p");
            hint.className = "text-caption text-sm";
            hint.textContent = "Upgrade to view this signal";
            card.appendChild(hint);

            target.appendChild(card);
            return;
        }

        if (isFullSignal(signal)) {
            const dir = (signal.direction || "").toLowerCase();
            const isBuy = dir === "buy" || dir === "long";
            const dirClass = isBuy ? "card-signal--buy" : "card-signal--sell";
            card.className = `card-signal ${dirClass}`;

            // ── Header row: symbol + badge + time ──
            const header = document.createElement("div");
            header.className = "flex items-center justify-between mb-1";

            const symbolWrap = document.createElement("div");
            symbolWrap.className = "flex items-center gap-2";

            const symbol = document.createElement("span");
            symbol.className = "font-semibold text-text text-base";
            symbol.textContent = signal.symbol;

            const badge = document.createElement("span");
            badge.className = isBuy ? "badge badge--buy" : "badge badge--sell";
            badge.textContent = signal.direction;

            symbolWrap.appendChild(symbol);
            symbolWrap.appendChild(badge);
            header.appendChild(symbolWrap);

            const timeStr = relativeTime(signal.createdAt);
            if (timeStr) {
                const timeEl = document.createElement("span");
                timeEl.className = "text-caption text-xs";
                timeEl.textContent = timeStr;
                header.appendChild(timeEl);
            }

            card.appendChild(header);

            // ── Confidence bar ──
            if (signal.confidence != null) {
                const confRow = document.createElement("div");
                confRow.className = "flex items-center gap-2 mb-3";

                const confLabel = document.createElement("span");
                confLabel.className = "text-caption text-xs";
                confLabel.textContent = "Confidence";

                const confBar = buildConfidenceBar(signal.confidence);

                const confVal = document.createElement("span");
                confVal.className = "data-mono text-xs";
                confVal.textContent = Math.round(signal.confidence) + "%";

                confRow.appendChild(confLabel);
                confRow.appendChild(confBar);
                confRow.appendChild(confVal);
                card.appendChild(confRow);
            }

            // ── Price data grid ──
            const dataGrid = document.createElement("div");
            dataGrid.className = "signal-data-grid";

            const fields = [
                { label: "Entry", value: signal.entry, cls: "" },
                { label: "Stop Loss", value: signal.stopLoss || signal.sl || "—", cls: "text-danger" },
                { label: "Take Profit", value: signal.takeProfit || signal.tp || "—", cls: "text-success" }
            ];

            fields.forEach(({ label, value, cls }) => {
                const cell = document.createElement("div");
                cell.className = "flex flex-col";

                const lbl = document.createElement("span");
                lbl.className = "text-caption text-xs";
                lbl.textContent = label;

                const val = document.createElement("span");
                val.className = "data-mono text-sm " + cls;
                val.textContent = value;

                cell.appendChild(lbl);
                cell.appendChild(val);
                dataGrid.appendChild(cell);
            });

            card.appendChild(dataGrid);
            target.appendChild(card);
            return;
        }

        card.className = "card-signal";
        card.textContent = "Unknown signal shape";
        target.appendChild(card);
    });
}

async function fetchJson(url) {
    const response = await fetch(url, {
        method: "GET"
    });

    if (!response.ok) {
        throw new Error(`Request failed for ${url}`);
    }

    return response.json();
}

async function loadData() {
    const summaryTargets = document.querySelectorAll("[data-signals-summary]");
    const listTargets = document.querySelectorAll("[data-signals-list]");

    if (summaryTargets.length === 0 && listTargets.length === 0) {
        return;
    }

    try {
        const [summary, signals] = await Promise.all([
            fetchJson(SUMMARY_URL),
            fetchJson(SIGNALS_URL)
        ]);

        removeSkeleton();
        summaryTargets.forEach((target) => renderSummary(target, summary));
        listTargets.forEach((target) => renderSignals(target, signals));
    } catch (error) {
        removeSkeleton();
        summaryTargets.forEach((target) => {
            clearNode(target);
            const msg = document.createElement("p");
            msg.className = "text-muted text-sm text-center py-2";
            msg.textContent = "Unable to load summary data";
            target.appendChild(msg);
        });
        listTargets.forEach((target) => {
            clearNode(target);
            const errCard = document.createElement("div");
            errCard.className = "signals-empty-state";
            errCard.innerHTML =
                '<svg class="w-10 h-10 text-danger opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">' +
                '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />' +
                '</svg>' +
                '<p class="text-text font-semibold">Could not load signals</p>' +
                '<p class="text-muted text-sm">Please try refreshing the page.</p>';
            target.appendChild(errCard);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Widgets first (visual priority)
    initGlobalHeaderTicker();
    initHomeMarketOverview();
    initMarketsPageWidgets();

    // Data after widgets
    loadData();
});
