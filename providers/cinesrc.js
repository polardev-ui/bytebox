/**
 * cinesrc.st provider
 */
async function extract(page, id, type, season, episode) {
    let embedUrl = `https://cinesrc.to/embed/${type}/${id}`;
    if (type === 'tv') embedUrl += `/${season}/${episode}`;

    let streamUrl = null;
    let subtitles = [];

    const routeHandler = async (route) => {
        const url = route.request().url();

        if (url.includes('.m3u8') || url.includes('playlist') || url.includes('.mpd')) {
            if (!url.includes('subtitles') && !url.includes('.vtt')) {
                streamUrl = url;
            }
        }

        if (url.includes('.vtt') || url.includes('.srt')) {
            subtitles.push({
                kind: 'captions',
                label: 'Track ' + (subtitles.length + 1),
                src: url,
                srclang: extractLang(url)
            });
        }

        if (isAd(url)) return route.abort();
        return route.continue();
    };

    await page.route('**/*', routeHandler);

    try {
        await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: 25000 });
        await page.mouse.click(640, 360);
        await page.waitForTimeout(1500);

        const player = await page.$('#player, video, .jw-display, .plyr');
        if (player) await player.click({ force: true }).catch(() => {});

        let checks = 0;
        while (!streamUrl && checks < 40) {
            await page.waitForTimeout(250);
            checks++;
        }
    } catch (err) {
        console.error('[CineSrc] Error:', err.message);
    } finally {
        await page.unroute('**/*', routeHandler);
    }

    return { streamUrl, subtitles };
}

function isAd(url) {
    return /adsystem|popads|analytics|doubleclick|googlesyndication|adroll/.test(url);
}

function extractLang(url) {
    try {
        const match = url.match(/[?&]lang=(\w+)/);
        return match ? match[1] : 'en';
    } catch { return 'en'; }
}

module.exports = { extract };
