"""
BBV-Net News-Scraper für lokale Sturmmeldungen.
Sucht bei bbv-net.de nach Berichten über Sturmschäden am Schadensdatum.
Screenshot der Suchergebnisseite wird in den PDF-Report eingebettet.

Kein API-Key erforderlich — nutzt öffentliche Suche von bbv-net.de.
Ergebnisse werden 24 Stunden gecacht.
"""
import io
import json
import logging
import re
from datetime import date, datetime, timedelta
from pathlib import Path
from urllib.parse import urlencode, quote_plus

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BBV_NET_BASE = "https://www.bbv-net.de"
CACHE_DIR = Path("/data/cache/news")

# Suchmuster für storm-relevante Artikel
STORM_KEYWORDS = [
    "sturm", "unwetter", "orkan", "windböen", "sturmschaden",
    "sturmschäden", "böen", "windstärke"
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _cache_key(damage_date: date) -> str:
    return damage_date.strftime("%Y-%m-%d")


def _cache_path(cache_key: str) -> Path:
    return CACHE_DIR / f"bbvnet_{cache_key}.json"


def _screenshot_cache_path(cache_key: str) -> Path:
    return CACHE_DIR / f"bbvnet_{cache_key}_screenshot.png"


def _is_cache_valid(path: Path, max_age_hours: int = 24) -> bool:
    if not path.exists():
        return False
    age_h = (datetime.now().timestamp() - path.stat().st_mtime) / 3600
    return age_h < max_age_hours


def _is_storm_related(text: str) -> bool:
    text_lower = text.lower()
    return any(kw in text_lower for kw in STORM_KEYWORDS)


def _is_date_relevant(article_date_str: str, damage_date: date, window_days: int = 3) -> bool:
    """Prüft ob ein Artikel innerhalb des Zeitfensters um den Schadensdatum liegt."""
    if not article_date_str:
        return True  # Datum unbekannt → trotzdem aufnehmen
    try:
        # Versuche verschiedene Datumsformate
        for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d. %B %Y", "%B %d, %Y"):
            try:
                parsed = datetime.strptime(article_date_str.strip()[:10], fmt[:len(article_date_str.strip())]).date()
                return abs((parsed - damage_date).days) <= window_days
            except ValueError:
                continue
        # ISO-Format direkt im String suchen
        m = re.search(r"(\d{4}-\d{2}-\d{2})", article_date_str)
        if m:
            parsed = date.fromisoformat(m.group(1))
            return abs((parsed - damage_date).days) <= window_days
    except Exception:
        pass
    return True  # Im Zweifel aufnehmen


async def _fetch_search_results(query: str) -> str | None:
    """Lädt die Suchergebnisseite von BBV-Net."""
    # Verschiedene Search-URL-Muster probieren
    search_urls = [
        f"{BBV_NET_BASE}/?s={quote_plus(query)}",
        f"{BBV_NET_BASE}/suche/?q={quote_plus(query)}",
        f"{BBV_NET_BASE}/search/?q={quote_plus(query)}",
    ]

    async with httpx.AsyncClient(
        headers=HEADERS,
        follow_redirects=True,
        timeout=15.0,
    ) as client:
        for url in search_urls:
            try:
                resp = await client.get(url)
                if resp.status_code == 200 and len(resp.text) > 1000:
                    logger.info("BBV-Net: Suchergebnisse gefunden bei %s", url)
                    return resp.text, url
            except Exception as e:
                logger.debug("BBV-Net: URL %s fehlgeschlagen: %s", url, e)

    return None, None


def _parse_articles(html: str, damage_date: date) -> list[dict]:
    """Parst BBV-Net HTML nach Artikeln mit Sturmbezug."""
    soup = BeautifulSoup(html, "lxml")
    articles = []

    # Typische Artikel-Selektoren für WordPress/News-Sites
    selectors = [
        "article",
        ".post",
        ".article",
        ".entry",
        ".news-item",
        ".search-result",
        ".teaser",
        "li.type-post",
    ]

    found_items = []
    for sel in selectors:
        items = soup.select(sel)
        if items:
            found_items = items
            break

    # Fallback: alle h2/h3 mit Links
    if not found_items:
        for heading in soup.select("h2 a, h3 a, h4 a"):
            href = heading.get("href", "")
            if BBV_NET_BASE in href or href.startswith("/"):
                title = heading.get_text(strip=True)
                if title and len(title) > 10:
                    found_items.append({"_fallback": True, "title": title, "url": href})

    for item in found_items[:20]:
        if isinstance(item, dict) and item.get("_fallback"):
            # Fallback-Ergebnis direkt verwenden
            title = item["title"]
            url = item["url"]
            excerpt = ""
            article_date = ""
        else:
            # Titel
            title_el = (
                item.select_one("h1, h2, h3, h4, .entry-title, .post-title, .headline") or
                item.select_one("a")
            )
            if not title_el:
                continue
            title = title_el.get_text(strip=True)
            if len(title) < 10:
                continue

            # URL
            link_el = item.select_one("a[href]") or title_el if hasattr(title_el, "get") else None
            url = ""
            if link_el:
                url = link_el.get("href", "")
                if url and not url.startswith("http"):
                    url = BBV_NET_BASE + url

            # Datum
            date_el = item.select_one("time, .date, .published, .entry-date, [datetime]")
            article_date = ""
            if date_el:
                article_date = date_el.get("datetime", "") or date_el.get_text(strip=True)

            # Kurztext
            excerpt_el = item.select_one(".excerpt, .entry-summary, .teaser-text, p")
            excerpt = excerpt_el.get_text(strip=True)[:200] if excerpt_el else ""

        # Filtern: Sturmbezug prüfen
        combined = f"{title} {excerpt}".lower()
        if not _is_storm_related(combined):
            continue

        # Datum prüfen
        if not _is_date_relevant(article_date, damage_date):
            continue

        articles.append({
            "title": title,
            "url": url,
            "date": article_date,
            "excerpt": excerpt,
        })

    return articles[:6]  # Maximal 6 Artikel


async def _take_screenshot(search_url: str, cache_path: Path) -> bytes | None:
    """
    Nimmt einen Screenshot der Suchergebnisseite mit Playwright.
    Versucht Cookie-Banner zu schließen und ggf. BBV-Login durchzuführen.
    Gibt None zurück wenn die Seite nur einen Cookie-Banner zeigt (kein Inhalt).
    """
    try:
        from playwright.async_api import async_playwright
        from config import settings

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await browser.new_context(
                viewport={"width": 1280, "height": 900},
                locale="de-DE",
                extra_http_headers={"Accept-Language": "de-DE,de;q=0.9"},
            )
            page = await ctx.new_page()

            # BBV-Login falls Zugangsdaten vorhanden
            if settings.bbv_username and settings.bbv_password:
                try:
                    await page.goto(f"{BBV_NET_BASE}/anmelden/", timeout=15_000,
                                    wait_until="domcontentloaded")
                    await page.wait_for_timeout(800)
                    # Cookie-Banner vor Login wegklicken
                    await _dismiss_cookie_banner(page)
                    # Login-Formular ausfüllen
                    for sel in ["input[name='log']", "input[name='username']",
                                "input[type='email']", "#user_login"]:
                        if await page.locator(sel).count() > 0:
                            await page.fill(sel, settings.bbv_username)
                            break
                    for sel in ["input[name='pwd']", "input[name='password']",
                                "input[type='password']", "#user_pass"]:
                        if await page.locator(sel).count() > 0:
                            await page.fill(sel, settings.bbv_password)
                            break
                    for sel in ["input[type='submit']", "button[type='submit']",
                                "#wp-submit", ".login-submit button"]:
                        if await page.locator(sel).count() > 0:
                            await page.click(sel)
                            break
                    await page.wait_for_timeout(1500)
                    logger.info("BBV-Net: Login versucht für %s", settings.bbv_username)
                except Exception as e:
                    logger.debug("BBV-Net: Login fehlgeschlagen (wird fortgesetzt): %s", e)

            # Zur Suchergebnisseite navigieren
            await page.goto(search_url, timeout=20_000, wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)

            # Cookie-Banner schließen
            await _dismiss_cookie_banner(page)
            await page.wait_for_timeout(800)

            # Prüfen ob nach Cookie-Dismissal noch ein Banner die Seite blockiert
            body_text = await page.evaluate("document.body.innerText")
            cookie_indicators = [
                "einwilligung zu cookies", "cookie-einstellungen",
                "ihre privatsphäre", "datenschutzerklärung akzeptieren",
                "consent", "alle akzeptieren", "alles ablehnen"
            ]
            banner_detected = any(ind in body_text.lower() for ind in cookie_indicators)
            if banner_detected:
                # Letzter Versuch: JavaScript-basierten Banner schließen
                await page.evaluate("""
                    // Entferne alle bekannten Cookie-Overlays
                    ['[class*="cookie"]','[class*="consent"]','[id*="cookie"]',
                     '[id*="consent"]','[class*="overlay"]','[class*="modal"]'].forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => {
                            if (el.style) { el.style.display = 'none'; }
                        });
                    });
                    document.body.style.overflow = 'auto';
                """)
                await page.wait_for_timeout(500)
                # Nochmal prüfen
                body_text = await page.evaluate("document.body.innerText")
                still_blocked = any(ind in body_text.lower() for ind in cookie_indicators[:3])
                if still_blocked:
                    logger.warning("BBV-Net: Cookie-Banner konnte nicht entfernt werden — kein Screenshot")
                    await browser.close()
                    return None

            screenshot = await page.screenshot(
                full_page=False,
                clip={"x": 0, "y": 0, "width": 1280, "height": 900},
            )
            await browser.close()

            cache_path.parent.mkdir(parents=True, exist_ok=True)
            cache_path.write_bytes(screenshot)
            logger.info("BBV-Net: Screenshot gespeichert (%d KB)", len(screenshot) // 1024)
            return screenshot

    except ImportError:
        logger.warning("Playwright nicht installiert — kein Screenshot möglich.")
        return None
    except Exception as e:
        logger.error("BBV-Net: Screenshot fehlgeschlagen: %s", e)
        return None


async def _dismiss_cookie_banner(page) -> None:
    """Versucht Cookie-Banner auf BBV-Net und ähnlichen Seiten zu schließen."""
    # Selector-basiert (CSS)
    css_selectors = [
        "button[id*='accept']", "button[class*='accept']",
        "button[class*='zustimm']", "[aria-label*='Zustimmen']",
        "[data-testid*='accept']", "#onetrust-accept-btn-handler",
        ".cc-btn.cc-allow", ".fc-cta-consent", ".sp_choice_type_11",
        "[data-gdpr-action='accept']", ".cookie-accept",
    ]
    for sel in css_selectors:
        try:
            btn = page.locator(sel).first
            if await btn.is_visible(timeout=600):
                await btn.click(timeout=1500)
                await page.wait_for_timeout(400)
                return
        except Exception:
            pass

    # Text-basiert (fängt "Alle akzeptieren", "Alles akzeptieren" etc.)
    for text in ["Alle akzeptieren", "Alles akzeptieren", "Akzeptieren",
                 "Zustimmen", "OK", "Einverstanden", "Weiter ohne Zustimmung"]:
        try:
            btn = page.get_by_role("button", name=text).first
            if await btn.is_visible(timeout=400):
                await btn.click(timeout=1000)
                await page.wait_for_timeout(400)
                return
        except Exception:
            pass


async def search_storm_news(
    damage_date: date,
    location_name: str = "Bocholt",
) -> dict:
    """
    Hauptfunktion: Sucht BBV-Net nach Sturmmeldungen am Schadensdatum.

    Returns:
        {
            "articles": [...],
            "screenshot": bytes | None,
            "search_url": str,
            "found": bool,
        }
    """
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = _cache_key(damage_date)
    meta_cache = _cache_path(cache_key)
    shot_cache = _screenshot_cache_path(cache_key)

    # Metadaten aus Cache laden
    if _is_cache_valid(meta_cache):
        try:
            cached = json.loads(meta_cache.read_text())
            screenshot = shot_cache.read_bytes() if shot_cache.exists() else None
            logger.info("BBV-Net: Cache-Treffer für %s (%d Artikel)", damage_date, len(cached.get("articles", [])))
            return {**cached, "screenshot": screenshot}
        except Exception:
            pass

    # Suchanfragen für Schadensdatum ± 1 Tag
    month_names = [
        "", "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember"
    ]

    search_dates = [
        damage_date - timedelta(days=1),
        damage_date,
        damage_date + timedelta(days=1),
    ]

    all_articles: list[dict] = []
    search_url = None
    query = f"Sturm {location_name} {damage_date.day}. {month_names[damage_date.month]} {damage_date.year}"

    for search_date in search_dates:
        date_de = f"{search_date.day}. {month_names[search_date.month]} {search_date.year}"
        q = f"Sturm {location_name} {date_de}"
        html, found_url = await _fetch_search_results(q)
        if html:
            if not search_url:
                search_url = found_url
            parsed = _parse_articles(html, damage_date)
            # Duplikate vermeiden (gleicher Titel)
            existing_titles = {a["title"] for a in all_articles}
            for art in parsed:
                if art["title"] not in existing_titles:
                    all_articles.append(art)
                    existing_titles.add(art["title"])

    # Fallback: ohne Datum suchen wenn nichts gefunden
    if not all_articles:
        q_short = f"Sturm {location_name}"
        html, found_url = await _fetch_search_results(q_short)
        if html:
            search_url = search_url or found_url
            all_articles = _parse_articles(html, damage_date)

    articles = all_articles[:6]
    logger.info("BBV-Net: %d sturmrelevante Artikel gefunden für %s (±1 Tag)", len(articles), damage_date)

    # Cache speichern
    result_meta = {
        "articles": articles,
        "search_url": search_url or f"{BBV_NET_BASE}/?s={quote_plus(query)}",
        "found": len(articles) > 0,
        "query": query,
    }
    try:
        meta_cache.write_text(json.dumps(result_meta, ensure_ascii=False))
    except Exception:
        pass

    # Screenshot nur wenn tatsächlich Artikel gefunden — nie bei "keine Ergebnisse"
    screenshot = None
    if articles:
        if not _is_cache_valid(shot_cache):
            screenshot = await _take_screenshot(search_url, shot_cache)
        elif shot_cache.exists():
            screenshot = shot_cache.read_bytes()

    return {**result_meta, "screenshot": screenshot}
