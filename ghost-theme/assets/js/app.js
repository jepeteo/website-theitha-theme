const SIGNALS_URL = "https://api.theitha.com/api/signals/list";
const SUMMARY_URL = "https://api.theitha.com/api/signals/summary";

let cachedMemberToken = null;
let cachedMemberUuid = null;
let cachedSignalsPayload = null;

const signalsFilterState = {
    status: "all",
    market: "all"
};

const marketChartSymbols = {
    forex: "FX:EURUSD",
    commodities: "OANDA:XAUUSD",
    crypto: "BITSTAMP:BTCUSD",
    indices: "FOREXCOM:US30"
};

function looksLikeJwt(value) {
    return typeof value === "string" && value.split(".").length === 3;
}

function pickTokenFromObject(obj) {
    if (!obj || typeof obj !== "object") {
        return null;
    }

    const candidates = [
        obj.access_token,
        obj.token,
        obj.jwt,
        obj.memberToken,
        obj?.member?.access_token,
        obj?.member?.token,
        obj?.member?.jwt,
        obj?.members?.[0]?.access_token,
        obj?.members?.[0]?.token,
        obj?.members?.[0]?.jwt
    ];

    for (const candidate of candidates) {
        if (looksLikeJwt(candidate)) {
            return candidate;
        }
    }

    return null;
}

function readTokenFromStorage() {
    const storageKeys = [
        "ghost-members-ssr",
        "ghost-members-token",
        "ghost-members-jwt",
        "ghost-members-current",
        "ghost-members-session"
    ];

    const stores = [];
    if (typeof window !== "undefined" && window.localStorage) {
        stores.push(window.localStorage);
    }
    if (typeof window !== "undefined" && window.sessionStorage) {
        stores.push(window.sessionStorage);
    }

    for (const store of stores) {
        for (const key of storageKeys) {
            const raw = store.getItem(key);
            if (!raw) {
                continue;
            }

            if (looksLikeJwt(raw)) {
                return raw;
            }

            try {
                const parsed = JSON.parse(raw);
                const token = pickTokenFromObject(parsed);
                if (token) {
                    return token;
                }
            } catch (_error) {
                // not JSON, continue
            }
        }
    }

    return null;
}

function readCookieValue(name) {
    const match = document.cookie
        .split(";")
        .map((entry) => entry.trim())
        .find((entry) => entry.startsWith(`${name}=`));

    if (!match) {
        return null;
    }

    const raw = match.slice(name.length + 1);
    try {
        return decodeURIComponent(raw);
    } catch (_error) {
        return raw;
    }
}

async function resolveMemberUuid() {
    if (cachedMemberUuid) {
        return cachedMemberUuid;
    }

    try {
        const response = await fetch("/members/api/member/", {
            method: "GET",
            credentials: "include"
        });

        if (!response.ok) {
            return null;
        }

        const member = await response.json();
        if (member && member.uuid) {
            cachedMemberUuid = member.uuid;
            return cachedMemberUuid;
        }
    } catch (_error) {
        // Not logged in or endpoint unavailable
    }

    return null;
}

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
                { proName: "BITSTAMP:BTCUSD", title: "BTCUSD" }
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
    if (!document.getElementById("tv-market-overview")) {
        return;
    }

    mountTradingViewWidget("tv-market-overview",
        "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js",
        {
            colorTheme: "dark",
            dateRange: "12M",
            showChart: false,
            locale: "en",
            width: "100%",
            height: 400,
            largeChartUrl: "",
            isTransparent: true,
            showSymbolLogo: true,
            showFloatingTooltip: false,
            tabs: [
                {
                    title: "Forex",
                    symbols: [
                        { s: "FX:EURUSD", d: "EUR/USD" },
                        { s: "FX:GBPJPY", d: "GBP/JPY" },
                        { s: "FX:USDJPY", d: "USD/JPY" },
                        { s: "FX:GBPUSD", d: "GBP/USD" },
                        { s: "FX:AUDUSD", d: "AUD/USD" }
                    ]
                },
                {
                    title: "Commodities",
                    symbols: [
                        { s: "OANDA:XAUUSD", d: "XAU/USD - Gold" },
                        { s: "OANDA:XPTUSD", d: "XPT/USD - Platinum" },
                        { s: "OANDA:XPDUSD", d: "XPD/USD - Palladium" },
                        { s: "OANDA:XAGUSD", d: "XAG/USD - Silver" },
                        { s: "TVC:COPPER", d: "XCU/USD - Copper" }
                    ]
                },
                {
                    title: "Crypto",
                    symbols: [
                        { s: "BITSTAMP:BTCUSD", d: "BTC/USD" },
                        { s: "BITSTAMP:ETHUSD", d: "ETH/USD" },
                        { s: "BINANCE:SOLUSDT", d: "SOL/USD" },
                        { s: "BITSTAMP:XRPUSD", d: "XRP/USD" },
                        { s: "BINANCE:BTCUSDT", d: "BTC/USDT" }
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

    const renderAdvancedChart = (symbol) => {
        const container = document.getElementById("tv-advanced-chart");
        if (!container) {
            return;
        }

        container.innerHTML = "";
        delete container.dataset.tvInitialized;

        mountTradingViewWidget("tv-advanced-chart",
            "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js",
            {
                symbol,
                width: "100%",
                height: 550,
                theme: "dark",
                isTransparent: true,
                locale: "en",
                autosize: false
            }
        );
    };

    renderAdvancedChart(marketChartSymbols.forex);

    mountTradingViewWidget("tv-economic-calendar",
        "https://s3.tradingview.com/external-embedding/embed-widget-events.js",
        {
            width: "100%",
            height: 500,
            colorTheme: "dark",
            isTransparent: true,
            locale: "en"
        }
    );

    const marketButtons = Array.from(document.querySelectorAll("[data-markets-filters] [data-market]"));
    marketButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const market = button.getAttribute("data-market") || "forex";
            const symbol = marketChartSymbols[market] || marketChartSymbols.forex;

            marketButtons.forEach((item) => item.classList.remove("demo-chip--active"));
            button.classList.add("demo-chip--active");

            renderAdvancedChart(symbol);
        });
    });
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

function classifySignalMarket(symbol) {
    const value = String(symbol || "").toUpperCase();
    if (value.includes("BTC") || value.includes("ETH") || value.includes("SOL") || value.includes("XRP")) {
        return "crypto";
    }
    if (value.includes("XAU") || value.includes("XAG") || value.includes("WTI") || value.includes("OIL") || value.includes("BRENT")) {
        return "commodities";
    }
    if (value.includes("US30") || value.includes("NAS") || value.includes("SPX") || value.includes("DAX") || value.includes("DJI")) {
        return "indices";
    }
    return "forex";
}

function applySignalsFilters(payload) {
    const signals = Array.isArray(payload?.data) ? payload.data : [];

    const filtered = signals.filter((signal) => {
        const statusValue = String(signal?.status || "active").toLowerCase();
        const marketValue = classifySignalMarket(signal?.symbol);

        const statusPass = signalsFilterState.status === "all" || statusValue === signalsFilterState.status;
        const marketPass = signalsFilterState.market === "all" || marketValue === signalsFilterState.market;

        return statusPass && marketPass;
    });

    return {
        ...payload,
        data: filtered
    };
}

function setupSignalsFilters() {
    const chips = Array.from(document.querySelectorAll("[data-filter-type][data-filter-value]"));
    if (chips.length === 0) {
        return;
    }

    chips.forEach((chip) => {
        chip.addEventListener("click", () => {
            const filterType = chip.getAttribute("data-filter-type");
            const filterValue = chip.getAttribute("data-filter-value") || "all";

            if (filterType !== "status" && filterType !== "market") {
                return;
            }

            signalsFilterState[filterType] = filterValue;

            const groupSelector = filterType === "status"
                ? "[data-signals-status-filters] [data-filter-type='status']"
                : "[data-signals-market-filters] [data-filter-type='market']";

            document.querySelectorAll(groupSelector).forEach((el) => {
                el.classList.remove("demo-chip--active");
            });
            chip.classList.add("demo-chip--active");

            if (cachedSignalsPayload) {
                const filteredPayload = applySignalsFilters(cachedSignalsPayload);
                document.querySelectorAll("[data-signals-list]").forEach((target) => {
                    renderSignals(target, filteredPayload);
                });
            }
        });
    });
}

function renderSummary(target, summary) {
    if (!target) {
        return;
    }

    clearNode(target);

    const grid = document.createElement("div");
    grid.className = "grid grid-cols-3 gap-4 text-center";

    const active = Number(summary?.activeSignals ?? summary?.active ?? 0);
    const winners = Number(summary?.wonSignals ?? summary?.winners ?? 0);
    const lost = Number(summary?.lostSignals ?? summary?.lost ?? 0);
    const total = active + winners + lost;

    const stats = [
        { label: "Active", value: active },
        { label: "Winners", value: winners },
        { label: "Total", value: total }
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
            badge.textContent = signal.direction || (isBuy ? "BUY" : "SELL");

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
    const memberUuid = await resolveMemberUuid();
    const headers = {};
    if (memberUuid) {
        headers["X-Ghost-Member-Uuid"] = memberUuid;
    }

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers
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

        cachedSignalsPayload = signals;
        const filteredSignals = applySignalsFilters(signals);

        removeSkeleton();
        summaryTargets.forEach((target) => renderSummary(target, summary));
        listTargets.forEach((target) => renderSignals(target, filteredSignals));

        // Update subtitle based on tier
        const subtitle = document.getElementById("signals-subtitle");
        if (subtitle) {
            if (signals.tier === "paid") {
                subtitle.textContent = "Live trading signals updated throughout the session. Full access unlocked.";
            } else if (signals.tier === "free") {
                subtitle.textContent = "Live trading signals updated throughout the session. Upgrade to unlock all entry details.";
            } else {
                subtitle.textContent = "Live trading signals updated throughout the session. Sign in to unlock entry details.";
            }
        }
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

    // Filter controls
    setupSignalsFilters();

    // Data after widgets
    loadData();
});
