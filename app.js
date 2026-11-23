let marketData = [];
let lifeData = [];

const app = document.getElementById("app");
const modalRoot = document.getElementById("modal-root");
let activeTab = "market";

function formatValue(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  value = Number(value);
  if (value < 10) return value.toFixed(3);
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function formatChange(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return "--";
  value = Number(value);
  return (value > 0 ? "+" : "") + value.toFixed(1) + "%";
}

function changeClass(value) {
  return value > 0 ? "rise" : value < 0 ? "fall" : "flat";
}

function dateLabel() {
  const names = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"];
  const date = new Date();
  return `${date.getMonth() + 1}月${date.getDate()}日 ${names[date.getDay()]}`;
}

function setTab(tab, updateHash = true) {
  if (tab !== "market" && tab !== "life") tab = "market";
  activeTab = tab;
  document.querySelectorAll(".top-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.tab === tab);
  });
  if (updateHash) history.replaceState(null, "", "#" + tab);
  modalRoot.innerHTML = "";
  if (tab === "market") {
    renderMarket();
    loadMarketData();
  }
  if (tab === "life") {
    renderLife();
    loadLifeData();
  }
}

async function loadMarketData() {
  try {
    let response = await fetch("./data/market.json", { cache: "no-store" });
    if (!response.ok) response = await fetch("/api/market", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    marketData = Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error("loadMarketData error:", error);
    marketData = [];
  }
  if (activeTab === "market") renderMarket();
}

async function loadLifeData() {
  try {
    let response = await fetch("./data/life.json", { cache: "no-store" });
    if (!response.ok) response = await fetch("/api/life", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    lifeData = Array.isArray(result.data) ? result.data : [];
  } catch (error) {
    console.error("loadLifeData error:", error);
    lifeData = [];
  }
  if (activeTab === "life") renderLife();
}

function renderMarket() {
  app.innerHTML = `
    <div class="minute-tip"><span>☀️</span> 一分钟，看完今天的重要变化</div>
    <section class="card market-card">
      <div class="section-heading">
        <div><span class="section-title">今日主要指数</span><span class="section-subtitle">比上一个交易日</span></div>
        <div class="section-meta"><span class="section-date">${dateLabel()}</span><span class="section-update">数据截至今日收盘</span></div>
      </div>
      ${marketData.map((item, index) => `
        <button class="market-row" type="button" data-market="${index}">
          <span class="market-info"><span class="asset-icon">${item.icon}</span><span class="market-label"><span class="market-name">${item.name}</span><span class="simple-text">${item.simple}</span></span></span>
          <span class="market-value">${formatValue(item.value)}</span>
          <span class="market-change ${changeClass(item.change)}">${formatChange(item.change)}</span>
        </button>
      `).join("")}
    </section>`;
  app.querySelectorAll("[data-market]").forEach(button => {
    button.addEventListener("click", () => openMarketDetail(marketData[Number(button.dataset.market)]));
  });
}

function openMarketDetail(item) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <article class="modal" role="dialog" aria-modal="true" aria-label="${item.name}详情">
        <div class="modal-content">
          <div class="modal-header"><h2 class="modal-title">${item.name}</h2><button class="close-button" type="button" aria-label="关闭">×</button></div>
          <span class="detail-value">${formatValue(item.value)}</span><span class="detail-time">数据截至今日收盘</span>
          <div class="trend-heading">
            <div><span class="trend-title">近一年走势</span><span class="period-change ${changeClass(item.change)}">${formatChange(item.change)}</span></div>
            <div class="chart-period-tabs"><button class="chart-period-tab active" type="button">1年</button><button class="chart-period-tab" type="button">3年</button><button class="chart-period-tab" type="button">5年</button></div>
          </div>
          <canvas class="chart" aria-label="${item.name}走势图"></canvas>
          <span class="detail-explain">${item.simple}，整体趋势存在阶段性波动。</span>
          <div class="poll-section"><span class="poll-question">你觉得接下来会涨还是会跌？</span><div class="poll-buttons"><button class="poll-button poll-up" type="button">看涨</button><button class="poll-button poll-down" type="button">看跌</button></div><span class="poll-result">看涨 58%　　看跌 42%</span><span class="poll-participants">12,345 人参与</span></div>
          <span class="disclaimer">互动结果仅代表用户观点，不构成任何投资或交易建议。</span>
        </div>
      </article>
    </div>`;
  const backdrop = modalRoot.querySelector(".modal-backdrop");
  backdrop.addEventListener("click", event => { if (event.target === backdrop) modalRoot.innerHTML = ""; });
  modalRoot.querySelector(".close-button").addEventListener("click", () => { modalRoot.innerHTML = ""; });
  modalRoot.querySelectorAll(".chart-period-tab").forEach(tab => tab.addEventListener("click", () => {
    modalRoot.querySelectorAll(".chart-period-tab").forEach(value => value.classList.remove("active"));
    tab.classList.add("active");
  }));
  modalRoot.querySelectorAll(".poll-button").forEach(button => button.addEventListener("click", () => {
    modalRoot.querySelectorAll(".poll-button").forEach(value => value.disabled = true);
    modalRoot.querySelector(".poll-result").textContent = button.classList.contains("poll-up") ? "看涨 59%　　看跌 41%" : "看涨 57%　　看跌 43%";
  }));
  drawChart(modalRoot.querySelector(".chart"), item.history);
}

function renderLife() {
  if (!lifeData.length) {
    app.innerHTML = `<section class="card empty">正在从国家统计局和世界银行公开接口获取生活数据…</section>`;
    return;
  }
  app.innerHTML = `<section class="indicator-grid">${lifeData.map((item, index) => `
    <button class="indicator-card" type="button" data-life="${index}">
      <span class="indicator-heading"><span class="indicator-icon">${item.icon}</span><span class="indicator-name-wrap"><span class="indicator-name">${item.name}</span><span class="indicator-subtitle">${item.subtitle}</span></span></span>
      <span class="indicator-value-row"><span class="indicator-value">${item.value}</span><span class="indicator-change ${changeClass(item.change)}">${typeof item.change === "number" ? formatChange(item.change) : "--"}</span></span>
      <span class="indicator-simple">${item.simple}</span><span class="indicator-footer">${item.period} · ${item.source}</span>
    </button>`).join("")}</section>`;
  app.querySelectorAll("[data-life]").forEach(button => button.addEventListener("click", () => openLifeDetail(lifeData[Number(button.dataset.life)])));
}

function openLifeDetail(item) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop" role="presentation">
      <article class="modal" role="dialog" aria-modal="true" aria-label="${item.name}详情">
        <div class="modal-content">
          <div class="life-detail-head"><span class="life-detail-icon">${item.icon}</span><div><div class="modal-header" style="gap:20px"><h2 class="modal-title">${item.name}</h2><button class="close-button" type="button" aria-label="关闭">×</button></div><span class="detail-meta">最新数据：${item.period}</span></div></div>
          <span class="detail-value">${item.value}</span>
          <div class="trend-heading"><div><span class="trend-title">近一年走势</span><span class="period-change ${changeClass(item.change)}">${formatChange(item.change)}</span></div><div class="chart-period-tabs"><button class="chart-period-tab active" type="button">1年</button><button class="chart-period-tab" type="button">3年</button><button class="chart-period-tab" type="button">5年</button></div></div>
          <canvas class="chart" aria-label="${item.name}走势图"></canvas>
          <div class="explain-box"><span class="explain-text">${item.simple}，整体变化需要结合更长时间和更多因素观察。</span></div>
          ${item.options ? `<div class="vote-section"><span class="poll-question">${item.question}</span><div class="vote-options">${item.options.map((option, index) => `<button class="vote-option" type="button" data-vote="${index}">${option[0]} ${option[1]}%</button>`).join("")}</div></div>` : ""}
          <span class="detail-footer">数据来源：${item.source}　|　更新时间：${item.period}</span>
          <span class="disclaimer">互动结果仅代表用户个人感受和观点，不构成任何投资、购房或决策建议。</span>
        </div>
      </article>
    </div>`;
  const backdrop = modalRoot.querySelector(".modal-backdrop");
  backdrop.addEventListener("click", event => { if (event.target === backdrop) modalRoot.innerHTML = ""; });
  modalRoot.querySelector(".close-button").addEventListener("click", () => { modalRoot.innerHTML = ""; });
  modalRoot.querySelectorAll(".vote-option").forEach(button => button.addEventListener("click", () => {
    modalRoot.querySelectorAll(".vote-option").forEach(value => value.disabled = true);
  }));
  drawChart(modalRoot.querySelector(".chart"), item.history);
}

function drawChart(canvas, values) {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  const width = rect.width;
  const height = rect.height;
  const left = 52, right = 12, top = 18, bottom = 30;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  ctx.clearRect(0, 0, width, height);
  ctx.font = "11px sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 4; i++) {
    const y = top + plotHeight * i / 3;
    const value = max - range * i / 3;
    ctx.strokeStyle = "#eef5fb";
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillStyle = "#8494ad";
    ctx.fillText(value >= 1000 ? Math.round(value).toLocaleString("en-US") : value.toFixed(value < 10 ? 2 : 0), left - 8, y);
  }
  ctx.beginPath();
  values.forEach((value, index) => {
    const x = left + plotWidth * index / (values.length - 1);
    const y = top + (max - value) / range * plotHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#1689f8";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();
}

document.querySelectorAll(".top-tab").forEach(button => button.addEventListener("click", () => setTab(button.dataset.tab)));
window.addEventListener("hashchange", () => setTab(location.hash.replace("#","") || "market", false));
window.addEventListener("resize", () => {
  const canvas = modalRoot.querySelector(".chart");
  if (!canvas) return;
  const tabName = activeTab;
  if (tabName === "market") {
    const title = modalRoot.querySelector(".modal-title").textContent;
    const item = marketData.find(value => value.name === title);
    if (item) drawChart(canvas, item.history);
  }
});

const initialTab = ["market","life"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "market";
setTab(initialTab, true);
