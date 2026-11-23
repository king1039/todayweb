const http = require("http");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Accept": "application/json,text/plain,text/html,application/xml;q=0.9,*/*;q=0.8"
    }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function parseTencentQuote(text, name, icon) {
  const encoded = text.split("=")[1] || "";
  const fields = encoded.replace(/^"/, "").replace(/"$/, "").split("~");
  if (fields.length < 32) return null;
  const value = Number(fields[3]);
  const change = Number(fields[32]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    code: "",
    icon,
    name,
    value,
    change: Number.isFinite(change) ? change : null,
    changePercent: Number.isFinite(change) ? change : null,
    simple: "",
    simpleText: "",
    history: [],
    historyLabels: [],
    source: "腾讯行情",
    sourceDate: fields[30] || ""
  };
}

function parseTencentFuture(text, name, icon) {
  const encoded = text.split("=")[1] || "";
  const fields = encoded.replace(/^"/, "").replace(/"$/, "").split(",");
  const value = Number(fields[0]);
  const change = Number(fields[1]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return {
    code: "",
    icon,
    name,
    value,
    change: Number.isFinite(change) ? change : null,
    changePercent: Number.isFinite(change) ? change : null,
    simple: "",
    simpleText: "",
    history: [],
    historyLabels: [],
    source: "腾讯行情",
    sourceDate: fields[12] || ""
  };
}

async function getMarketData() {
  const configs = [
    ["us.INX", "标普500", "🇺🇸", "standard"],
    ["us.NDX", "纳斯达克100", "🇺🇸", "standard"],
    ["us.DJI", "道琼斯", "🇺🇸", "standard"],
    ["sh000001", "上证指数", "🇨🇳"],
    ["sh000300", "沪深300", "🇨🇳"],
    ["sh000688", "科创50", "🇨🇳"],
    ["hf_XAU", "国际黄金", "🟡", "future"],
    ["hf_CL", "原油", "🛢️", "future"]
  ];
  const allNames = [
    ["标普500", "🇺🇸"], ["纳斯达克100", "🇺🇸"], ["道琼斯", "🇺🇸"],
    ["上证指数", "🇨🇳"], ["沪深300", "🇨🇳"], ["科创50", "🇨🇳"],
    ["国际黄金", "🟡"], ["国内黄金", "🟡"], ["原油", "🛢️"], ["美元/人民币", "💵"]
  ];
  const live = {};
  let usdcny = null;
  let domesticGold = null;
  try {
    const quoteText = await fetchText("http://qt.gtimg.cn/q=" + configs.map(item => item[0]).join(","));
    quoteText.split("\n").forEach(line => {
      const match = line.match(/^v_(.+)=/);
      if (!match) return;
      const config = configs.find(item => item[0] === match[1]);
      if (config) {
        const record = config[3] === "future"
          ? parseTencentFuture(line, config[1], config[2])
          : parseTencentQuote(line, config[1], config[2]);
        if (record) live[config[1]] = record;
      }
    });
  } catch (error) {
    console.error("Market API fetch failed:", error.message);
  }
  try {
    const forexText = await fetchText("https://open.er-api.com/v6/latest/USD");
    const forex = JSON.parse(forexText);
    const rate = Number(forex && forex.rates && forex.rates.CNY);
    if (forex.result === "success" && Number.isFinite(rate) && rate > 0) {
      usdcny = {
        code: "USDCNY",
        icon: "💵",
        name: "美元/人民币",
        value: rate,
        change: null,
        changePercent: null,
        simple: "公开汇率",
        simpleText: "公开汇率",
        history: [],
        historyLabels: [],
        source: "ExchangeRate-API",
        sourceDate: forex.time_last_update_utc || ""
      };
      live["美元/人民币"] = usdcny;
    }
  } catch (error) {
    console.error("Forex API fetch failed:", error.message);
  }
  try {
    const goldText = await fetchText("https://api.gold-api.com/price/XAU");
    const gold = JSON.parse(goldText);
    const usdPerOunce = Number(gold && gold.price);
    if (Number.isFinite(usdPerOunce) && usdPerOunce > 0) {
      let cnyPerUsd = usdcny && usdcny.value;
      if (!cnyPerUsd) {
        const forexText = await fetchText("https://open.er-api.com/v6/latest/USD");
        const forex = JSON.parse(forexText);
        cnyPerUsd = Number(forex && forex.rates && forex.rates.CNY);
      }
      const cnyPerGram = cnyPerUsd && usdPerOunce * cnyPerUsd / 31.1034768;
      if (Number.isFinite(cnyPerGram) && cnyPerGram > 0) {
        domesticGold = {
          code: "AU9999",
          icon: "🟡",
          name: "国内黄金",
          value: cnyPerGram,
          change: null,
          changePercent: null,
          simple: "国际现货折算",
          simpleText: "国际现货折算",
          history: [],
          historyLabels: [],
          source: "Gold-API + ExchangeRate-API",
          sourceDate: gold.updatedAt || ""
        };
        live["国内黄金"] = domesticGold;
      }
    }
  } catch (error) {
    console.error("Gold API fetch failed:", error.message);
  }
  const data = allNames.map(([name, icon]) => live[name] || {
    icon,
    name,
    value: null,
    change: null,
    simple: "实时数据暂未获取",
    history: [],
    source: "",
    sourceDate: ""
  });
  return { data, updatedAt: new Date().toISOString() };
}

async function fetchWorldBank(indicator, perPage = 10) {
  const text = await fetchText(
    `https://api.worldbank.org/v2/country/CN/indicator/${indicator}?format=json&per_page=${perPage}`
  );
  const json = JSON.parse(text);
  const rows = Array.isArray(json) && Array.isArray(json[1]) ? json[1] : [];
  return rows
    .filter(row => row && row.value !== null && row.value !== "" && Number.isFinite(Number(row.value)))
    .map(row => ({ year: row.date, value: Number(row.value) }))
    .sort((a, b) => a.year.localeCompare(b.year));
}

async function fetchLatestNbsArticle(keyword) {
  const html = await fetchText("https://www.stats.gov.cn/sj/zxfb/");
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*title=["']([^"']+)["'][^>]*>/gi)];
  const match = links.find(item => item[2].includes(keyword));
  if (!match) return null;
  const url = new URL(match[1], "https://www.stats.gov.cn/sj/zxfb/").toString();
  const articleHtml = await fetchText(url);
  const text = articleHtml
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { title: match[2].trim(), url, text };
}

async function getLifeData() {
  const indicators = [];

  async function addWorldBank(config, indicator) {
    try {
      const history = await fetchWorldBank(indicator);
      const latest = history[history.length - 1];
      if (!latest) throw new Error("No values");
      const previous = history[history.length - 2];
      const change = previous && previous.value !== 0
        ? (latest.value - previous.value) / Math.abs(previous.value) * 100
        : null;
      indicators.push({
        id: config.id,
        icon: config.icon,
        name: config.name,
        subtitle: config.subtitle,
        value: config.format(latest.value),
        change,
        simple: config.simple(latest.value, change),
        period: latest.year,
        source: "世界银行公开数据",
        sourceUrl: `https://api.worldbank.org/v2/country/CN/indicator/${indicator}`,
        history: history.map(item => item.value),
        historyLabels: history.map(item => item.year)
      });
    } catch (error) {
      console.error(`World Bank ${indicator} failed:`, error.message);
      indicators.push({
        id: config.id,
        icon: config.icon,
        name: config.name,
        subtitle: config.subtitle,
        value: "数据核验中",
        change: null,
        simple: "公开接口暂未返回有效数据",
        period: "暂无",
        source: "世界银行公开数据",
        history: [],
        historyLabels: []
      });
    }
  }

  await addWorldBank({
    id: "population", icon: "👥", name: "人口总数", subtitle: "年末人口",
    format: value => `${(value / 100000000).toFixed(4)}亿`,
    simple: () => "人口数据为公开年度统计"
  }, "SP.POP.TOTL");

  await addWorldBank({
    id: "birth", icon: "👶", name: "出生率", subtitle: "人口自然变化",
    format: value => `${value.toFixed(2)}‰`,
    simple: () => "出生率为每千人出生人数"
  }, "SP.DYN.CBRT.IN");

  await addWorldBank({
    id: "death", icon: "🧓", name: "死亡率", subtitle: "人口自然变化",
    format: value => `${value.toFixed(2)}‰`,
    simple: () => "死亡率为每千人死亡人数"
  }, "SP.DYN.CDRT.IN");

  await addWorldBank({
    id: "unemployment", icon: "👥", name: "就业", subtitle: "总失业率（世界银行估算）",
    format: value => `${value.toFixed(2)}%`,
    simple: () => "为国际口径估算值，不等同于城镇调查失业率"
  }, "SL.UEM.TOTL.ZS");

  await addWorldBank({
    id: "income", icon: "🪙", name: "居民收入", subtitle: "人均 GDP（公开代理指标）",
    format: value => `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    simple: () => "此项为人均 GDP，不是居民可支配收入"
  }, "NY.GDP.PCAP.CD");

  try {
    const quote = await fetchText("http://qt.gtimg.cn/q=hf_CL");
    const fields = quote.split("=")[1].replace(/^"/, "").replace(/"$/, "").split(",");
    const value = Number(fields[0]);
    const change = Number(fields[1]);
    if (Number.isFinite(value) && value > 0) {
      indicators.push({
        id: "fuel",
        icon: "⛽",
        name: "油价",
        subtitle: "WTI 国际原油参考",
        value: `$${value.toFixed(2)}/桶`,
        change: Number.isFinite(change) ? change : null,
        simple: "用于参考，不等同于国内92#汽油零售价",
        period: fields[12] || "实时",
        source: "腾讯行情公开接口",
        history: [],
        historyLabels: []
      });
    }
  } catch (error) {
    console.error("Life crude oil fetch failed:", error.message);
  }

  try {
    const forexText = await fetchText("https://open.er-api.com/v6/latest/USD");
    const forex = JSON.parse(forexText);
    const value = Number(forex && forex.rates && forex.rates.CNY);
    if (forex.result === "success" && Number.isFinite(value) && value > 0) {
      indicators.push({
        id: "usd",
        icon: "💱",
        name: "人民币汇率",
        subtitle: "美元 / 人民币",
        value: value.toFixed(4),
        change: null,
        simple: "公开中间参考汇率",
        period: forex.time_last_update_utc || "实时",
        source: "ExchangeRate-API",
        sourceUrl: "https://open.er-api.com/v6/latest/USD",
        history: [],
        historyLabels: []
      });
    }
  } catch (error) {
    console.error("Life forex fetch failed:", error.message);
  }

  try {
    const cpi = await fetchLatestNbsArticle("居民消费价格");
    const cpiMatch = cpi && cpi.title.match(/同比(上涨|下降|持平)(\d+(?:\.\d+)?)?%/);
    let cpiValue = null;
    if (cpiMatch) {
      cpiValue = cpiMatch[2] ? Number(cpiMatch[2]) : 0;
      if (cpiMatch[1] === "下降") cpiValue = -cpiValue;
    }
    const periodMatch = cpi && cpi.title.match(/(\d{4})年(\d{1,2})月份/);
    indicators.unshift({
      id: "cpi",
      icon: "🛒",
      name: "CPI 物价",
      subtitle: "全国居民消费价格",
      value: cpiValue === null ? "数据核验中" : `${cpiValue.toFixed(1)}%`,
      change: cpiValue,
      simple: cpiValue === null ? "公开接口暂未解析有效数值" : `全国居民消费价格同比${cpiValue >= 0 ? "上涨" : "下降"}`,
      period: periodMatch ? `${periodMatch[1]}年${periodMatch[2]}月` : cpi ? cpi.title : "暂无",
      source: "国家统计局",
      sourceUrl: cpi ? cpi.url : "https://www.stats.gov.cn/sj/zxfb/",
      history: cpiValue === null ? [] : [cpiValue],
      historyLabels: cpiValue === null ? [] : [periodMatch ? `${periodMatch[1]}-${periodMatch[2].padStart(2, "0")}` : "最新"]
    });
  } catch (error) {
    indicators.unshift({
      id: "cpi", icon: "🛒", name: "CPI 物价", subtitle: "全国居民消费价格",
      value: "数据核验中", change: null, simple: "国家统计局公开页面暂未取到",
      period: "暂无", source: "国家统计局", history: [], historyLabels: []
    });
  }

  try {
    const house = await fetchLatestNbsArticle("商品住宅销售价格");
    indicators.unshift({
      id: "house",
      icon: "🏠",
      name: "房价",
      subtitle: "广州 · 新建住宅",
      value: "广州数据暂未获取",
      change: null,
      simple: "只展示广州数据，暂未获取到广州单独数据",
      period: house ? "广州数据待解析" : "暂无",
      source: "国家统计局",
      sourceUrl: house ? house.url : "https://www.stats.gov.cn/sj/zxfb/",
      history: [],
      historyLabels: []
    });
  } catch (error) {
    indicators.unshift({
      id: "house", icon: "🏠", name: "房价", subtitle: "广州 · 新建住宅",
      value: "广州数据暂未获取", change: null, simple: "只展示广州数据，暂未获取到广州单独数据",
      period: "暂无", source: "国家统计局", history: [], historyLabels: []
    });
  }

  return { data: indicators, updatedAt: new Date().toISOString() };
}

async function sendApiResponse(res, getData) {
  try {
    const data = await getData();
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(data));
  } catch (error) {
    console.error("API request failed:", error);
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error.message }));
  }
}

const server = http.createServer((req, res) => {
  const requestPath = decodeURIComponent(req.url.split("?")[0]);
  if (requestPath === "/api/market") {
    sendApiResponse(res, getMarketData);
    return;
  }
  if (requestPath === "/api/life") {
    sendApiResponse(res, getLifeData);
    return;
  }
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const filePath = path.resolve(root, relativePath);

  if (!filePath.startsWith(root + path.sep)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      fs.readFile(path.join(root, "index.html"), (error, content) => {
        if (error) {
          res.writeHead(500);
          res.end("Server error");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(content);
      });
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

module.exports = { getMarketData, getLifeData };

if (require.main === module) {
  server.listen(port, "0.0.0.0", () => {
    console.log(`Today web is running at http://localhost:${port}`);
  });
}
