const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 8080;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

async function extractDirectStream(id, type = 'movie', season = '', episode = '') {
    const browser = await chromium.launch({ 
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    });
    
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    let targetStreamUrl = null;
    let subtitleTracks = [];

    let embedUrl = `https://vidsrc.to/embed/${type}/${id}`;
    if (type === 'tv') {
        embedUrl += `/${season}/${episode}`;
    }

    try {
        await page.route('**/*', async (route) => {
            const url = route.request().url();
            
            if (url.includes('.m3u8') || url.includes('/master.json') || url.includes('playlist.list')) {
                if (!url.includes('subtitles')) {
                    targetStreamUrl = url;
                }
            }
            
            if (url.includes('.vtt') || url.includes('.srt')) {
                subtitleTracks.push({
                    label: `Track ${subtitleTracks.length + 1}`,
                    src: url,
                    srclang: 'en'
                });
            }

            if (url.includes('adsystem') || url.includes('popads') || url.includes('analytics')) {
                return route.abort();
            }
            
            route.continue();
        });

        await page.goto(embedUrl, { waitUntil: 'networkidle', timeout: 15000 });
        
        const playButton = await page.$('.play-btn, #player, .vjs-big-play-button');
        if (playButton) {
            await playButton.click().catch(() => {});
        }
        
        await page.waitForTimeout(3000);

    } catch (err) {
        console.error("[Bytebox Scraper Error]:", err.message);
    } finally {
        await browser.close();
    }

    return { streamUrl: targetStreamUrl, subtitles: subtitleTracks };
}

app.get('/embed/movie/:id', async (req, res) => {
    const mediaId = req.params.id;
    console.log(`[Bytebox API] Extracting clean assets for Movie: ${mediaId}`);
    
    const media = await extractDirectStream(mediaId, 'movie');

    if (!media.streamUrl) {
        return res.status(404).send("Error: Unable to safely isolate direct clean stream components.");
    }

    res.render('player', {
        title: `Bytebox - Movie ${mediaId}`,
        streamUrl: media.streamUrl,
        subtitles: JSON.stringify(media.subtitles)
    });
});

app.get('/embed/tv/:id/:season/:episode', async (req, res) => {
    const { id, season, episode } = req.params;
    console.log(`[Bytebox API] Extracting clean assets for TV: ${id} (S${season}E${episode})`);
    
    const media = await extractDirectStream(id, 'tv', season, episode);

    if (!media.streamUrl) {
        return res.status(404).send("Error: Unable to safely isolate direct clean stream components.");
    }

    res.render('player', {
        title: `Bytebox - S${season}E${episode}`,
        streamUrl: media.streamUrl,
        subtitles: JSON.stringify(media.subtitles)
    });
});

app.listen(PORT, () => {
    console.log(`Bytebox Node.js Engine successfully operational on port ${PORT}`);
});