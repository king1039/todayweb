const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const outputDirectory = path.join(root, "dist");

fs.mkdirSync(path.join(outputDirectory, "data"), { recursive: true });

["index.html", "app.js", "styles.css"].forEach(file => {
  fs.copyFileSync(path.join(root, file), path.join(outputDirectory, file));
});

["market.json", "life.json"].forEach(file => {
  fs.copyFileSync(path.join(root, "data", file), path.join(outputDirectory, "data", file));
});

console.log(`Built static website in ${outputDirectory}`);
