const express = require('express');
const { chromium } = require('playwright');
const path = require('path');
const vidsrc = require('./providers/vidsrc');
const cinesrc = require('./providers/cinesrc');
const vidfast = require('./providers/vidfast');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS — allow Vercel frontend and any origin for embeds
app.use((req, res, next) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

const PROVIDERS = [
    { name: 'VidSrc', fn: vidsrc.extract },
    { name: 'CineSrc', fn: cinesrc.extract },
    { name: 'VidFast', fn: vidfast.extract },
];

async function extractStream(id, type = 'movie', season = '', episode = '', forcedServer = '') {
    const browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-infobars',
            '--window-size=1280,720',
        ],
    });

    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
        hasTouch: false,
    });

    await context.route('**/*', (route) => {
        const url = route.request().url();
        if (/adsystem|popads|analytics|doubleclick|googlesyndication|adroll|adsrv|adnxs|exoclick|trafficjunky/.test(url)) {
            return route.abort();
        }
        route.continue();
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        delete navigator.__proto__.webdriver;
    });

    const page = await context.newPage();
    const result = { streamUrl: null, subtitles: [], provider: null };

    try {
        if (forcedServer) {
            const idx = parseInt(forcedServer, 10) - 1;
            if (idx >= 0 && idx < PROVIDERS.length) {
                const r = await PROVIDERS[idx].fn(page, id, type, season, episode);
                if (r.streamUrl) {
                    result.streamUrl = r.streamUrl;
                    result.subtitles = r.subtitles;
                    result.provider = PROVIDERS[idx].name;
                }
            }
        } else {
            const tasks = PROVIDERS.map(async (prov) => {
                const p = await context.newPage();
                try {
                    const r = await prov.fn(p, id, type, season, episode);
                    return r.streamUrl ? { ...r, provider: prov.name } : null;
                } catch {
                    return null;
                }
            });

            const winner = await Promise.any(tasks);
            if (winner) {
                result.streamUrl = winner.streamUrl;
                result.subtitles = winner.subtitles || [];
                result.provider = winner.provider;
            }
        }
    } catch (err) {
        console.error('[ByteBox] Extraction error:', err.message);
    } finally {
        await browser.close();
    }

    return result;
}

// ── Routes ──

app.get('/embed/movie/:id', (req, res) => {
    res.render('player', {
        title: `ByteBox — Movie`,
        id: req.params.id,
        type: 'movie',
        season: '',
        episode: '',
    });
});

app.get('/embed/tv/:id/:season/:episode', (req, res) => {
    const { id, season, episode } = req.params;
    res.render('player', {
        title: `ByteBox — S${season}E${episode}`,
        id,
        type: 'tv',
        season,
        episode,
    });
});

app.get('/embed/tv/:id', (req, res) => {
    res.render('player', {
        title: `ByteBox — TV Show`,
        id: req.params.id,
        type: 'tv',
        season: '1',
        episode: '1',
    });
});

app.get('/api/stream/movie/:id', async (req, res) => {
    const server = req.query.server || '';
    const media = await extractStream(req.params.id, 'movie', '', '', server);
    if (!media.streamUrl) return res.status(404).json({ error: 'Stream not found' });
    res.json(media);
});

app.get('/api/stream/tv/:id/:season/:episode', async (req, res) => {
    const { id, season, episode } = req.params;
    const server = req.query.server || '';
    const media = await extractStream(id, 'tv', season, episode, server);
    if (!media.streamUrl) return res.status(404).json({ error: 'Stream not found' });
    res.json(media);
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
    console.log(`[ByteBox] Server running on port ${PORT}`);
});