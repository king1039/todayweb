const fs = require("fs");
const path = require("path");
const { getMarketData, getLifeData } = require("../server");

async function main() {
  const [market, life] = await Promise.all([getMarketData(), getLifeData()]);
  const usableMarketData = market.data.some(item => Number.isFinite(item.value));
  const usableLifeData = life.data.some(item =>
    item.id !== "house" && item.value !== "数据核验中" && item.value !== "广州数据暂未获取"
  );

  if (!usableMarketData) throw new Error("No usable market data was returned; snapshots were not updated");
  if (!usableLifeData) throw new Error("No usable life data was returned; snapshots were not updated");

  const dataDirectory = path.join(__dirname, "..", "data");
  fs.mkdirSync(dataDirectory, { recursive: true });
  fs.writeFileSync(path.join(dataDirectory, "market.json"), JSON.stringify(market, null, 2) + "\n");
  fs.writeFileSync(path.join(dataDirectory, "life.json"), JSON.stringify(life, null, 2) + "\n");

  console.log(`Updated ${market.data.length} market records and ${life.data.length} life indicators.`);
}

main().catch(error => {
  console.error("Data refresh failed:", error);
  process.exitCode = 1;
});
