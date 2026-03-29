#!/bin/bash
# measure_times.sh
# Simple measurement of scraping scripts

echo "===== Playwright MCP + browser extension ====="
time node ../ex1/scrape_iparralde.js

echo ""
echo "===== Agent-browser ====="
time node ../ex3/scrape_iparralde_browser.js

echo ""
echo "===== Agent-browser + LightPanda ====="
time bash ../ex4/scrape_inmo_v2.sh
