/**
 * vidsrc.to provider
 */
async function extract(page, id, type, season, episode) {
    let embedUrl = `https://vidsrc.to/embed/${type}/${id}`;
    if (type === 'tv') embedUrl += `/${season}/${episode}`;

    let streamUrl = null;
    let subtitles = [];

    // Intercept network requests for stream URLs
    const routeHandler = async (route) => {
        const url = route.request().url();

        if (url.includes('.m3u8') || url.includes('/master.json') || url.includes('playlist.list')) {
            if (!url.includes('subtitles') && !url.includes('.vtt')) {
                streamUrl = url;
            }
        }

        if (url.includes('.vtt') || url.includes('.srt')) {
            const lang = extractLangFromUrl(url);
            subtitles.push({
                kind: 'captions',
                label: lang.toUpperCase(),
                src: url,
                srclang: lang
            });
        }

        if (isAd(url)) return route.abort();
        return route.continue();
    };

    await page.route('**/*', routeHandler);

    try {
        await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: 25000 });

        // Click play button area
        await page.mouse.click(640, 360);
        await page.waitForTimeout(1500);

        // Try clicking video player elements
        const player = await page.$('#player, .vjs-big-play-button, video, .plyr__control');
        if (player) await player.click({ force: true }).catch(() => {});

        // Wait for stream to appear
        let checks = 0;
        while (!streamUrl && checks < 40) {
            await page.waitForTimeout(250);
            checks++;
        }
    } catch (err) {
        console.error('[VidSrc] Error:', err.message);
    } finally {
        await page.unroute('**/*', routeHandler);
    }

    return { streamUrl, subtitles };
}

function isAd(url) {
    return /adsystem|popads|analytics|doubleclick|googlesyndication|adroll|adsrv|adnxs/.test(url);
}

function extractLangFromUrl(url) {
    try {
        const match = url.match(/[?&]lang=(\w+)/);
        if (match) return match[1];
        const parts = url.split('/');
        for (const p of parts) {
            if (/^[a-z]{2}(-[a-z]{2})?$/i.test(p)) return p.toLowerCase().split('-')[0];
        }
    } catch {}
    return 'en';
}

module.exports = { extract };
