#!/usr/bin/env node
// Bumps the patch component of expo.version in app.json.
const fs = require("node:fs");
const path = require("node:path");

const appJsonPath = path.join(__dirname, "..", "app.json");
const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

const current = appJson.expo.version;
const parts = current.split(".").map(Number);
if (parts.length !== 3 || parts.some(Number.isNaN)) {
  throw new Error(`expo.version "${current}" is not in x.y.z format`);
}
parts[2] += 1;
const next = parts.join(".");

appJson.expo.version = next;
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + "\n");

console.log(`Bumped expo.version: ${current} -> ${next}`);
