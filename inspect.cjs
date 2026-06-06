const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  await page.goto('http://localhost:5173/marketing/campaigns');
  await page.waitForTimeout(2000);
  
  // Click create
  await page.click('button:has-text("Create Campaign")');
  await page.waitForTimeout(2000);
  
  // Fill name
  await page.fill('input[placeholder*="campaign name"]', 'DOM Inspection');
  
  // Submit
  await page.click('button:has-text("Create & Design")');
  await page.waitForTimeout(5000);
  
  // Look for No blocks yet
  const html = await page.evaluate(() => {
    // Find element containing "No blocks yet"
    const el = document.querySelector('#tpl-builder-root');
    if (!el) return 'NO ROOT';
    
    // find innermost text
    return el.innerHTML.substring(0, 5000);
  });
  
  console.log("HTML START");
  console.log(html);
  
  await browser.close();
})();
