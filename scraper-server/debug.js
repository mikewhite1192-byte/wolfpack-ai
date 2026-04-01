const puppeteer = require("puppeteer-core");

async function debug() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/bin/google-chrome",
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    defaultViewport: { width: 1280, height: 900 },
  });

  const page = await browser.newPage();
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

  await page.goto("https://www.google.com/maps/search/roofing+contractors+in+Detroit+MI", { waitUntil: "networkidle2", timeout: 30000 });

  // Wait longer
  await new Promise(r => setTimeout(r, 5000));

  await page.screenshot({ path: "/tmp/maps-debug.png", fullPage: false });

  // Get page title and h1s
  const title = await page.title();
  const h1s = await page.$$eval("h1", els => els.map(e => e.textContent));
  const feedItems = await page.$$('div[role="feed"] > div > div > a[href*="/maps/place/"]');

  console.log("Title:", title);
  console.log("H1s:", h1s);
  console.log("Feed items:", feedItems.length);

  // Try clicking first result
  if (feedItems.length > 0) {
    await feedItems[0].click();
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: "/tmp/maps-detail.png", fullPage: false });

    const detailH1 = await page.$$eval("h1", els => els.map(e => e.textContent));
    console.log("Detail H1s:", detailH1);

    // Try various selectors for phone
    const buttons = await page.$$eval("button[data-tooltip]", els => els.map(e => ({ tooltip: e.getAttribute("data-tooltip"), text: e.textContent?.substring(0, 50) })));
    console.log("Buttons with tooltips:", JSON.stringify(buttons, null, 2));
  }

  await browser.close();
}

debug().catch(console.error);
