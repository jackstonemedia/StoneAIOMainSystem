/**
 * Scraper Service — Lead Studio
 * Discovers business URLs from DuckDuckGo (primary) and Bing (fallback).
 * Returns an array of raw URLs to scrape for contact info.
 */

import axios from 'axios';
import * as cheerio from 'cheerio';
import { logger } from '../../utils/logger.js';

// Directory / social sites to skip — not business websites
const SKIP_DOMAINS = new Set([
  'yelp.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'yellowpages.com', 'angi.com', 'homeadvisor.com',
  'thumbtack.com', 'bbb.org', 'nextdoor.com', 'google.com', 'maps.google.com',
  'mapquest.com', 'foursquare.com', 'tripadvisor.com', 'houzz.com',
  'reddit.com', 'wikipedia.org', 'indeed.com', 'glassdoor.com',
  'angieslist.com', 'manta.com', 'superpages.com', 'dexknows.com',
  'whitepages.com', 'citysearch.com', 'merchantcircle.com', 'kudzu.com',
  'bark.com', 'porch.com', 'fixr.com', 'networx.com', 'find.co',
  'expertise.com', 'bing.com', 'duckduckgo.com', 'yahoo.com',
]);

function isDirectoryDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    for (const skip of SKIP_DOMAINS) {
      if (hostname === skip || hostname.endsWith('.' + skip)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Fetch a page with a realistic browser UA and short timeout.
 */
async function fetchHtml(url: string, timeoutMs = 8000): Promise<string> {
  const response = await axios.get(url, {
    timeout: timeoutMs,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'Connection': 'keep-alive',
    },
    maxRedirects: 5,
  });
  return response.data as string;
}

/**
 * Search DuckDuckGo HTML interface and extract result URLs.
 * DDG HTML: https://html.duckduckgo.com/html/?q=query
 */
async function searchDuckDuckGo(query: string, pages = 10): Promise<string[]> {
  const urls: string[] = [];

  for (let page = 0; page < pages; page++) {
    try {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 600)); // polite delay
      const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&s=${page * 30}`;
      const html = await fetchHtml(searchUrl, 12000);
      const $ = cheerio.load(html);

      $('a.result__url, .result__a').each((_: any, el: any) => {
        const href = $(el).attr('href') || '';
        // DDG results sometimes have the URL in data-href or in the text
        const urlText = href.startsWith('http') ? href : $(el).text().trim();
        if (urlText.startsWith('http') && !isDirectoryDomain(urlText)) {
          urls.push(urlText.split('?')[0]); // strip tracking params
        }
      });

      // Also parse result__snippet containers for URLs
      $('.result__snippet, .result__body a').each((_: any, el: any) => {
        const href = $(el).attr('href') || '';
        if (href.startsWith('http') && !isDirectoryDomain(href)) {
          urls.push(href.split('?')[0]);
        }
      });

      if (urls.length >= pages * 15) break; // got enough
    } catch (err: any) {
      logger.warn('[Scraper] DDG page fetch failed', { page, error: err.message });
      if (page === 0) throw err; // fail fast if first page fails
      break;
    }
  }

  return [...new Set(urls)]; // dedupe
}

/**
 * Search Bing HTML (fallback) and extract result URLs.
 */
async function searchBing(query: string, pages = 8): Promise<string[]> {
  const urls: string[] = [];

  for (let page = 0; page < pages; page++) {
    try {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}&first=${page * 10 + 1}`;
      const html = await fetchHtml(searchUrl, 12000);
      const $ = cheerio.load(html);

      $('li.b_algo h2 a, .b_algo .b_title a').each((_: any, el: any) => {
        const href = $(el).attr('href') || '';
        if (href.startsWith('http') && !isDirectoryDomain(href)) {
          urls.push(href.split('?')[0]);
        }
      });

      if (urls.length >= pages * 8) break;
    } catch (err: any) {
      logger.warn('[Scraper] Bing page fetch failed', { page, error: err.message });
      if (page === 0) throw err;
      break;
    }
  }

  return [...new Set(urls)];
}

/**
 * Discover business URLs for the given niche + area.
 * Tries DuckDuckGo first; if that returns <20 results, falls back to Bing.
 */
export async function discoverUrls(
  niche: string,
  area: string,
  engine: 'duckduckgo' | 'bing' | 'auto' = 'auto'
): Promise<{ urls: string[]; engine: string; query: string }> {
  const query = `${niche} ${area}`;
  logger.info('[Scraper] Discovering URLs', { query, engine });

  if (engine === 'bing') {
    const urls = await searchBing(query);
    return { urls, engine: 'bing', query };
  }

  try {
    const urls = await searchDuckDuckGo(query, 10);
    if (urls.length >= 20) {
      return { urls, engine: 'duckduckgo', query };
    }
    logger.warn('[Scraper] DDG returned few results, falling back to Bing', { count: urls.length });
  } catch (err: any) {
    logger.warn('[Scraper] DDG failed, falling back to Bing', { error: err.message });
  }

  const urls = await searchBing(query);
  return { urls, engine: 'bing', query };
}
