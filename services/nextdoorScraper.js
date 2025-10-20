import puppeteer from 'puppeteer';
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// console.log('Troubleshooting dotenv:', dotenv.config())
const KEYWORDS =[
  "chippie", // UK slang for Carpenter [1]
  "brickie", // UK slang for Bricklayer [1]
  "tradie", // UK slang for Tradesman [1]

  // Problem-Oriented Keywords
  "leaky pipe",
  "dripping faucet",
  "running toilet",
  "clogged drain",
  "blocked toilet",
  "burst pipe",
  "low water pressure",
  "no hot water",
  "boiler breakdown",
  "boiler repair",
  "water leak",
  "unpleasant odours from pipes",
  "tripping circuit breaker",
  "faulty wiring",
  "dead outlet",
  "flickering lights",
  "power outage",
  "overheated appliance",
  "overheated switch",
  "leaky roof",
  "missing tiles",
  "damaged shingles",
  "blocked gutters",
  "overflowing gutters",
  "sagging gutters",
  "damp patches around roofline",
  "cracks in wall",
  "cracks in ceiling",
  "uneven floor",
  "damp walls",
  "mould",
  "mildew",
  "musty smell",
  "peeling paint",
  "rotting wood",
  "foundation cracks",
  "rising damp",
  "drafty windows",
  "broken window",
  "cracked glass",
  "difficulty opening window",
  "difficulty closing window",
  "difficulty opening door",
  "difficulty closing door",
  "rotting window frame",
  "damaged door seal",
  "broken appliance",
  "wall damage",
  "hole in wall",
  "broken fence",
  "damaged patio",
  "damaged deck",
  "no power",
  "electrical issue",
  "overloaded circuit",
  "fuse box",
  "fascia repair",
  "soffit repair",
  "bargeboard repair",
  "dishwasher repair",
  "washing machine repair",
  "oven repair",
  "fence repair",
  "patio repair",
  "deck repair",

  // Project-Specific Keywords
  "kitchen renovation",
  "bathroom remodel",
  "loft conversion", // UK specific [2]
  "basement finishing",
  "interior renovation",
  "garage conversion",
  "house extension",
  "two-storey extension",
  "single-storey extension",
  "building extension", // UK specific [2]
  "garden design", // UK specific [2]
  "landscaping",
  "deck building",
  "patio renovation",
  "garden office installation",
  "new outbuilding construction",
  "window installation",
  "door installation",
  "conservatory installation",
  "boiler installation",
  "appliance installation",
  "flooring installation",
  "gutter guard installation",
  "attic conversion", // Included for completeness, though "loft conversion" is preferred in UK [2]
  "rendering",
  "damp proofing",
  "wall skimming",
  "structural timber work",
  "stump grinding",
  "garden clearance",
  "furniture re-upholstery",
  "flue inspection",
  "blockage removal",
  "security upgrades",
  "double glazing",
  "uPVC products",
  "bifold doors",
  "orangeries",
  "porches",
  "front door",
  "back door",
  "sliding patio door",
  "french door",
  "garage door",
  "chimney cleaning",
  "tree removal",
  "pruning",
  "custom furniture",
  "shelving",
  "wall repairs",
  "minor installations",
  "general repairs",
  "odd jobs",

  // Location-Based & Urgency Modifiers
  "near me",
  "local",
  "in my area",
  "in Birmingham", // Placeholder for specific town/neighborhood
  "urgent",
  "emergency",
  "ASAP",
  "quickly",
  "immediate",
  "need help now",
  "fast repair",

  // Recommendation & Inquiry Phrases
  "recommend a",
  "any recommendations for",
  "looking for a good",
  "can anyone suggest a",
  "who do you use for",
  "any trusted",
  "best [trade] in [area]",
  "experienced [trade]",
  "looking for",
  "need a",
  "seeking",
  "require",
  "want to hire",
  "quotes for",
  "job spec for", // Common in UK forums [3]
  "help with",
  "advice on",
  "my [item] is [problem]",
  "have a [problem] with",
  "experiencing [issue]",
  "need to fix",
  "need to repair",

  // General Home Maintenance & Repair Terms
  "home maintenance",
  "home repair",
  "property maintenance",
  "property repair",
  "house upkeep",
  "building works",
  "odd jobs",
  "DIY help",
  "fix",
  "repair",
  "install",
  "replace",
  "mend",
  "restore",
  "maintain",
  "service",
  "diagnose",
  "troubleshoot",
  "resolve",
  "upgrade",
  "clean",
  "build",
  "convert",
  "renovate",
  "remodel",
  "paint",
  "decorate",
  "plaster",
  "wire",
  "plumb",
  "tile",
  "landscape",
  "garden",
  "guttering", // UK specific [4]
  "fascias", // UK specific [5]
  "soffits", // UK specific [5]
  "bargeboards", // UK specific [5]
  "chimney",
  "fireplace",
  "structural engineer",
  "damp proof course",
  "weather stripping",
  "re-aligning doors",
  "resealing windows",
  "appliance wiring",
  "security system",
  "smoke detectors",
  "carbon monoxide detectors",
  "burglar alarms",
  "fire alarms",
  "fire extinguishers",
  "emergency lighting",
  "asbestos"
];
const SCRAPER_N8N_WEBHOOK_URL = process.env.SCRAPER_N8N_WEBHOOK_URL;
const COOKIE_PATH = './cookies/session.json';
// console.log("SCRAPER N8N", SCRAPER_N8N_WEBHOOK_URL)
async function saveCookies(page) {
  try {
    const dir = path.dirname(COOKIE_PATH);
    await fs.mkdir(dir, { recursive: true });
    const cookies = await page.cookies();
    await fs.writeFile(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log("💾 Cookies saved.");
  } catch (err) {
    console.error("❌ Failed to save cookies:", err);
    throw err;
  }
}

async function loadCookies(page) {
  try {
    console.log("📦 Loading cookies...");
    const cookies = JSON.parse(await fs.readFile(COOKIE_PATH));
    console.log("🔍 Cookies loaded:", cookies.length);
    await page.setCookie(...cookies);
    return true;
  } catch {
    return false;
  }
}

async function scrapeNextdoor() {
  console.log("🚀 Starting Nextdoor scraping...");
  let browser;

  try {
    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    const cookiesLoaded = await loadCookies(page);

    if (!cookiesLoaded) {
      console.log("🔐 Logging into Nextdoor...");
      await page.goto('https://nextdoor.co.uk/login/', { waitUntil: 'domcontentloaded' });

      await page.waitForSelector('#id_email', { timeout: 60000 });
      await page.type('#id_email', process.env.NEXTDOOR_EMAIL, { delay: 50 });

      await page.waitForSelector('#id_password', { timeout: 15000 });
      await page.type('#id_password', process.env.NEXTDOOR_PASSWORD, { delay: 50 });

      await Promise.all([
        page.click('#signin_button'),
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      ]);

      console.log("✅ Login successful. Saving cookies...");
      await saveCookies(page);
    }

    console.log("🌍 Navigating to feed...");
    const feedStart = Date.now();
    await page.goto('https://nextdoor.co.uk/news_feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000
    });
    console.log(`✅ Arrived at feed in ${(Date.now() - feedStart) / 1000}s`);

    // console.log("📸 Taking screenshot of the feed...");
    // const screenshotDir = path.resolve('./screenshots');
    // await fs.mkdir(screenshotDir, { recursive: true });
    // await page.screenshot({ path: path.join(screenshotDir, 'feed.png') });

    console.log("⏳ Waiting for posts to load...");
    await page.waitForSelector('[data-testid="styled-text"]', {
      timeout: 200000,
      visible: true
    });
    console.log("📸 Taking screenshot of the feed...");
    const screenshotDir = path.resolve('./screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });
    await page.screenshot({ path: path.join(screenshotDir, 'feed.png') });

    const posts = await page.$$eval('[data-testid="styled-text"]', nodes =>
      nodes.map(n => n.innerText)
    );

    console.log(`🧵 ${posts.length} posts found.`);

    const matches = [];

    for (const post of posts) {
      const match = KEYWORDS.find(word => post.toLowerCase().includes(word));
      if (match) {
        const data = {
          source: "Nextdoor",
          post,
          keyword: match,
          timestamp: new Date().toISOString()
        };

        matches.push(data);

        console.log("✅ MATCH FOUND:", data);

        if (SCRAPER_N8N_WEBHOOK_URL) {
          try {
            
            await axios.post(SCRAPER_N8N_WEBHOOK_URL, data);
            console.log("📨 Sent to n8n webhook");
          } catch (err) {
            console.error("⚠️ Webhook failed:", err.message);
          }
        } else {
          console.warn("⚠️ No N8N webhook URL provided. Skipping send.");
        }
      }
    }

    await browser.close();
    console.log("✅ Scraper finished cleanly.");
    return matches;

  } catch (err) {
    console.error("❌ Scraper error:", err);
    if (browser) await browser.close();
    throw err;
  }
}

// ✅ Export only the wrapper as requested
export async function runNextdoorScraper() {
  try {
    const matches = await scrapeNextdoor();
    return matches;
  } catch (err) {
    console.error("❌ Scraper failed in wrapper:", err);
    throw err;
  }
}
