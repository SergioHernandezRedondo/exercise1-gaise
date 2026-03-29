# Exercise 5 - Scraping Performance Comparison

| Combination                        | Command                                      | real (total) | user | sys |
|------------------------------------|---------------------------------------------|--------------|------|-----|
| Playwright MCP + browser extension  | `time node ex1/scrape_iparralde.js`         | 0m36.923s    | 0m0.862s | 0m0.091s |
| Agent-browser                       | `time node ex3/scrape_iparralde_browser.js` | 0m6.230s     | 0m0.050s | 0m0.053s |
| Agent-browser + LightPanda          | `time bash ex4/scrape_inmo_v2.sh`           | 0m10.195s    | 0m0.116s | 0m0.126s |
