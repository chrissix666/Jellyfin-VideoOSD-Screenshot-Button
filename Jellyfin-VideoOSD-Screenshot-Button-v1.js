function ssIsSupportedPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = ['mobi', 'ipad', 'iphone', 'ipod', 'silk', 'opera mini'].some((term) => ua.includes(term));
    const isTv = ['tv', 'samsungbrowser', 'viera', 'web0s'].some((term) => ua.includes(term));
    const isTizen = ua.includes('tizen') || window.tizen != null;
    const isAndroid = ua.includes('android');
    const isIOS = ['ipad', 'iphone', 'ipod'].some((term) => ua.includes(term)) || (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
    return !(isMobile || isTv || isTizen || isAndroid || isIOS);
}

(function () {
    'use strict';

    if (!ssIsSupportedPlatform()) return;

    // ---- PLUGIN ADAPTER: config source, retrofit for VideoOSD Tweaks and Candy ----
    const PLUGIN_GUID = '468b1980-7a6c-4e45-a129-24825085ece4';

    const CONFIG = {
        // ============================================================
        // == SHARED VALUES (both standalone and plugin usage) ==
        // Every field below is a genuinely new capability that this
        // mod never had any way to configure before this retrofit
        // (either hardcoded PNG-only, a single fixed filename shape,
        // or an always-on mode with a fixed interval). None of them
        // replace a pre-existing configurable default, so all are
        // plain local CONFIG fields usable identically by a
        // standalone/JS-injector user (hand-edit these values
        // directly) and by the plugin (applyPluginConfig() below
        // overwrites them once fetched). No dual-mode branch needed
        // anywhere in this file, same reasoning as Speed-Buttons and
        // FrameByFrame.
        // ============================================================

        hideOnNarrowWindow: true,
        // No centeredGapEm here: corrected, General/Individual Centered
        // Gap only ever applies to the 3 bottom-left mods (A-B Loop,
        // Speed, FrameByFrame), never to Download/Screenshot in the
        // bottom-right zone.

        // 'png' | 'jpg'. Original script hardcoded PNG only
        // (canvas.toDataURL('image/png')).
        fileFormat: 'png',

        // 'original' | 'library'. Original script only ever scraped
        // the visible page title (== today's 'library' behavior).
        filenameSource: 'library',

        // Per content type, only relevant when filenameSource is
        // 'library'. Movies default on, Episodes/Videos default off
        // (matches the original script's own behavior, which never
        // included a year for episodes, and stripped it for movies).
        includeYearMovies: true,
        includeYearEpisodes: false,
        includeYearVideos: false,

        // One of: 'screenshot_timestamp_label' (default, matches the
        // original script's only behavior), 'screenshot_timestamp',
        // 'screenshot_label', 'timestamp_label', 'screenshot_only',
        // 'timestamp_only', 'label_only'.
        filenamePattern: 'screenshot_timestamp_label',

        // Original script: always enabled, fixed 200ms.
        rapidFireEnabled: true,
        rapidFireIntervalMs: 200,

        // Original script: always enabled, fixed 1000ms
        // (AUTO_SCREENSHOT_INTERVAL_MS).
        autoModeEnabled: true,
        autoModeIntervalMs: 1000
    };

    async function fetchPluginConfig() {
        if (!window.ApiClient || typeof ApiClient.getPluginConfiguration !== 'function') {
            return null;
        }
        try {
            return await ApiClient.getPluginConfiguration(PLUGIN_GUID);
        } catch (err) {
            return null;
        }
    }

    function applyPluginConfig(pluginConfig) {
        if (!pluginConfig) return;

        if (typeof pluginConfig.ScreenshotHideOnNarrowWindow === 'boolean') {
            CONFIG.hideOnNarrowWindow = pluginConfig.ScreenshotHideOnNarrowWindow;
        }

        if (typeof pluginConfig.ScreenshotFileFormat === 'string') {
            CONFIG.fileFormat = pluginConfig.ScreenshotFileFormat;
        }
        if (typeof pluginConfig.ScreenshotFilenameSource === 'string') {
            CONFIG.filenameSource = pluginConfig.ScreenshotFilenameSource;
        }
        if (typeof pluginConfig.ScreenshotIncludeYearMovies === 'boolean') {
            CONFIG.includeYearMovies = pluginConfig.ScreenshotIncludeYearMovies;
        }
        if (typeof pluginConfig.ScreenshotIncludeYearEpisodes === 'boolean') {
            CONFIG.includeYearEpisodes = pluginConfig.ScreenshotIncludeYearEpisodes;
        }
        if (typeof pluginConfig.ScreenshotIncludeYearVideos === 'boolean') {
            CONFIG.includeYearVideos = pluginConfig.ScreenshotIncludeYearVideos;
        }
        if (typeof pluginConfig.ScreenshotFilenamePattern === 'string') {
            CONFIG.filenamePattern = pluginConfig.ScreenshotFilenamePattern;
        }
        if (typeof pluginConfig.ScreenshotRapidFireEnabled === 'boolean') {
            CONFIG.rapidFireEnabled = pluginConfig.ScreenshotRapidFireEnabled;
        }
        if (typeof pluginConfig.ScreenshotRapidFireIntervalMs === 'number') {
            CONFIG.rapidFireIntervalMs = pluginConfig.ScreenshotRapidFireIntervalMs;
        }
        if (typeof pluginConfig.ScreenshotAutoModeEnabled === 'boolean') {
            CONFIG.autoModeEnabled = pluginConfig.ScreenshotAutoModeEnabled;
        }
        if (typeof pluginConfig.ScreenshotAutoModeIntervalMs === 'number') {
            CONFIG.autoModeIntervalMs = pluginConfig.ScreenshotAutoModeIntervalMs;
        }
    }

    // NEW: content-kind (movie/episode/video) and original-filename
    // detection. Neither existed before this retrofit -- the original
    // script only ever scraped the visible page title text, it never
    // queried the API at all. Both are needed now: content-kind to pick
    // the right "Include Year" setting, original filename for the new
    // "Original Filename" source option. Fetched together in one call and
    // cached per now-playing item, same caching pattern already proven in
    // FrameByFrame-Buttons.js's getFpsFromSession().
    let cachedItemInfo = null;
    let cachedItemInfoName = null;

    async function getNowPlayingItemInfo() {
        if (!window.ApiClient?.getSessions) return null;

        try {
            const sessions = await ApiClient.getSessions();
            const session =
                sessions.find(s => s.NowPlayingItem && s.PlayState) ||
                sessions.find(s => s.NowPlayingItem);

            const item = session?.NowPlayingItem;
            if (!item) return null;

            const itemName = item.Name || item.Id || 'unknown';

            if (cachedItemInfo && cachedItemInfoName === itemName) {
                return cachedItemInfo;
            }

            let kind = 'video';
            if (item.Type === 'Movie') kind = 'movie';
            else if (item.Type === 'Episode') kind = 'episode';

            let originalFilename = null;
            try {
                const userId = ApiClient.getCurrentUserId();
                const fullItem = await ApiClient.getItem(userId, item.Id);
                const path = fullItem?.Path || fullItem?.MediaSources?.[0]?.Path;
                if (path) {
                    const withExt = path.split(/[\\/]/).pop();
                    originalFilename = withExt.replace(/\.[^.]+$/, '');
                }
            } catch (err) {
                originalFilename = null;
            }

            cachedItemInfo = { kind, originalFilename };
            cachedItemInfoName = itemName;
            return cachedItemInfo;
        } catch (err) {
            return null;
        }
    }
    // ---- END PLUGIN ADAPTER ----

    const ADDON_ID = 'screenshotButton';
    const ADDON_NAME = 'Screenshot Button';
    const RESPONSIVE_STYLE_ID = 'screenshotButtonResponsiveStyle';

    const CUSTOMS_API_NAME = 'JellyfinVideoOSDCustomsMenu';
    const CUSTOMS_WAIT_MS = 300;
    const CUSTOMS_WAIT_TRIES = 120;
    const CUSTOMS_STORAGE_KEY =
        CUSTOMS_API_NAME + '.addon.' + ADDON_ID;

    let btn = null;
    let autoMode = false;
    let autoIntervalId = null;
    let lastVideoRef = null;

    let observer = null;
    let pollInterval = null;
    let enabled = false;

    let registeredWithCustoms = false;
    let customsRegisterTimer = null;



    let ignoreStoredCustomsState = false;

    const isCustomsAvailable = () => {
        const api = window[CUSTOMS_API_NAME];
        return !!api && typeof api.registerAddon === 'function';
    };

    const isEnabledByCustomsState = () =>
        localStorage.getItem(CUSTOMS_STORAGE_KEY) !== 'false';

    // Renamed usage: now driven by CONFIG.hideOnNarrowWindow and callable
    // repeatedly to add/remove, not just add-once. Same
    // refreshResponsiveStyle() pattern as the other retrofitted mods.
    const refreshResponsiveStyle = () => {
        const existing = document.getElementById(RESPONSIVE_STYLE_ID);
        if (!CONFIG.hideOnNarrowWindow) {
            if (existing) existing.remove();
            return;
        }
        if (existing) return;

        const style = document.createElement('style');
        style.id = RESPONSIVE_STYLE_ID;
        style.textContent = `
        @media all and (max-width: 50em) {
            .videoOsdBottom .btnScreenshot { display: none !important; }
        }
        `;
        document.head.appendChild(style);
    };

    const ensureStyles = () => {
        if (document.getElementById('auto-screenshot-style')) return;

        const style = document.createElement('style');
        style.id = 'auto-screenshot-style';
        style.textContent = `
        @keyframes autoscreenshot-wiggle {
            0%   { transform: rotate(0deg); }
            20%  { transform: rotate(-6deg); }
            40%  { transform: rotate(6deg); }
            60%  { transform: rotate(-4deg); }
            80%  { transform: rotate(4deg); }
            100% { transform: rotate(0deg); }
        }

        .auto-screenshot-click {
            animation: autoscreenshot-wiggle 0.6s ease-in-out;
        }

        .auto-screenshot-active {
            animation: autoscreenshot-wiggle 1s ease-in-out infinite;
        }
        `;
        document.head.appendChild(style);
    };

    const sanitize = str =>
        str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();

    const getIcon = () => btn?.querySelector('.material-symbols-outlined');

    const animateSingleShot = () => {
        const icon = getIcon();
        if (!icon || autoMode) return;

        icon.classList.remove('auto-screenshot-click');
        void icon.offsetWidth;
        icon.classList.add('auto-screenshot-click');
    };

    const startWiggle = () => {
        const icon = getIcon();
        if (!icon) return;

        icon.classList.remove('auto-screenshot-click');
        icon.classList.add('auto-screenshot-active');
    };

    const stopWiggle = () => {
        const icon = getIcon();
        if (!icon) return;

        icon.classList.remove('auto-screenshot-active');
    };

    // CHANGED: now async (needs an API call for content-kind and/or the
    // original filename, neither obtainable synchronously from the DOM
    // alone), and reads CONFIG.filenameSource/includeYearXxx. The original
    // regex-based title parsing itself (episodeMatch groups, sanitize)
    // stays completely untouched, only the year-stripping decision and an
    // upfront "use the original filename instead" branch are new.
    const getVideoLabel = async video => {
        if (CONFIG.filenameSource === 'original') {
            const info = await getNowPlayingItemInfo();
            if (info?.originalFilename) {
                return ` - ${sanitize(info.originalFilename)}`;
            }
            // Original filename unavailable (e.g. API call failed) -- fall
            // through to the library-name approach below instead of
            // returning an empty label.
        }

        const pageTitleEl = document.querySelector('h3.pageTitle') ||
            Array.from(document.querySelectorAll('[aria-hidden="true"]'))
                .find(el => el.className.toLowerCase().includes('pagetitle'));

        if (!pageTitleEl) return '';

        let text = pageTitleEl.textContent.trim();

        const info = await getNowPlayingItemInfo();
        const kind = info?.kind || 'video';
        const includeYear = kind === 'movie' ? CONFIG.includeYearMovies
            : kind === 'episode' ? CONFIG.includeYearEpisodes
                : CONFIG.includeYearVideos;

        const episodeMatch = text.match(/^(.*?)-\s*S(\d+)[\:-]?E(\d+)\s*-\s*(.*?)(?:\s*\(\d{4}\))?$/i);
        if (episodeMatch) {
            let showTitle = episodeMatch[1].trim();
            showTitle = showTitle.replace(/\s*:\s*/g, ' - ');

            const season = episodeMatch[2].padStart(2, '0');
            const episode = episodeMatch[3].padStart(2, '0');
            const episodeName = episodeMatch[4].trim();

            // The original regex already excludes any year from the
            // captured groups regardless -- episodes never carried one in
            // the label before this retrofit. Only append it back if the
            // admin explicitly turned "Include Year (Episodes)" on.
            const yearMatch = text.match(/\((\d{4})\)\s*$/);
            const yearSuffix = includeYear && yearMatch ? ` (${yearMatch[1]})` : '';

            return ` - ${showTitle} - S${season}E${episode} - ${episodeName}${yearSuffix}`;
        }

        if (!includeYear) {
            text = text.replace(/\s*\(\d{4}\)/, '');
        }
        text = text.replace(/\s*:\s*/g, ' - ');

        return ` - ${sanitize(text)}`;
    };

    // NEW: builds the timestamp text once, shared by all 7 filename
    // patterns below.
    const buildTimestampPart = () => {
        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time =
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        return `${date} ${time}`;
    };

    // NEW: all 7 mathematically possible combinations of the 3 building
    // blocks ("Screenshot" text / Timestamp / Label), see the concept
    // document. 'screenshot_timestamp_label' reproduces the original
    // script's only behavior exactly.
    const buildFilename = (labelPart, extension) => {
        const timestamp = buildTimestampPart();
        const screenshotText = 'Screenshot';
        const cleanLabel = labelPart.replace(/^\s*-\s*/, '');

        let base;
        switch (CONFIG.filenamePattern) {
            case 'screenshot_timestamp':
                base = `${screenshotText} ${timestamp}`;
                break;
            case 'screenshot_label':
                base = `${screenshotText}${labelPart}`;
                break;
            case 'timestamp_label':
                base = `${timestamp}${labelPart}`;
                break;
            case 'screenshot_only':
                base = screenshotText;
                break;
            case 'timestamp_only':
                base = timestamp;
                break;
            case 'label_only':
                base = cleanLabel;
                break;
            case 'screenshot_timestamp_label':
            default:
                base = `${screenshotText} ${timestamp}${labelPart}`;
                break;
        }

        return `${base}.${extension}`;
    };

    // CHANGED: pixel capture (canvas.drawImage) still happens synchronously
    // first, exactly like before, so the captured frame is unaffected by
    // any async label/filename work that follows -- deliberately ordered
    // this way so awaiting getVideoLabel() can never cause a frame
    // mismatch between what was requested and what actually got saved.
    // File format (CONFIG.fileFormat) and the new filename pattern system
    // are applied only after the frame is already captured.
    const takeScreenshot = () => {
        const video = document.querySelector('video');
        if (!video || video.videoWidth === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const isJpg = CONFIG.fileFormat === 'jpg';
        const mimeType = isJpg ? 'image/jpeg' : 'image/png';
        const dataUrl = isJpg ? canvas.toDataURL(mimeType, 0.92) : canvas.toDataURL(mimeType);
        const extension = isJpg ? 'jpg' : 'png';

        getVideoLabel(video).then(label => {
            const link = document.createElement('a');
            link.download = buildFilename(label, extension);
            link.href = dataUrl;
            link.click();
        });
    };

    const stopAutoMode = () => {
        autoMode = false;

        if (autoIntervalId) {
            clearInterval(autoIntervalId);
            autoIntervalId = null;
        }

        stopWiggle();
    };

    const startAutoMode = () => {
        if (autoMode) return;

        autoMode = true;
        startWiggle();
        takeScreenshot();
        autoIntervalId = setInterval(takeScreenshot, CONFIG.autoModeIntervalMs);
    };

    const toggleAutoMode = () => {
        autoMode ? stopAutoMode() : startAutoMode();
    };

    const ensureBtn = () => {
        if (!btn) {
            ensureStyles();

            btn = document.createElement('button');
            btn.className = 'btnScreenshot autoSize paper-icon-button-light';
            btn.title = 'Screenshot';

            const icon = document.createElement('span');
            icon.className = 'xlargePaperIconButton material-symbols-outlined';
            icon.textContent = 'photo_camera';
            btn.appendChild(icon);

            let intervalId = null;
            let clickCount = 0;
            let clickTimer = null;

            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                clickCount++;

                if (clickTimer) clearTimeout(clickTimer);

                clickTimer = setTimeout(() => {
                    if (clickCount === 1) {
                        animateSingleShot();
                    } else if (clickCount === 2 && CONFIG.autoModeEnabled) {
                        toggleAutoMode();
                    }

                    clickCount = 0;
                }, 250);
            });

            btn.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();

                if (!CONFIG.rapidFireEnabled) return;
                if (autoMode || intervalId) return;

                startWiggle();
                takeScreenshot();

                intervalId = setInterval(takeScreenshot, CONFIG.rapidFireIntervalMs);
            });

            const stopInterval = event => {
                if (event) {
                    event.preventDefault();
                    event.stopPropagation();
                }

                if (!intervalId) return;

                clearInterval(intervalId);
                intervalId = null;

                if (!autoMode) {
                    stopWiggle();
                }
            };

            btn.addEventListener('mouseup', stopInterval);
            btn.addEventListener('mouseleave', stopInterval);
        }

        return btn;
    };

    const removeButton = () => {
        if (btn) {
            btn.remove();
            btn = null;
        }
    };

    const checkVideoChange = () => {
        const video = document.querySelector('video');

        if (video !== lastVideoRef) {
            lastVideoRef = video;

            if (autoMode) stopAutoMode();
        }
    };

    const injectButton = () => {
        if (!enabled) return false;

        const favBtn = document.querySelector('.buttons.focuscontainer-x > .btnUserRating');
        if (!favBtn || !favBtn.parentNode) return false;

        const container = favBtn.parentNode;

        if (!container.querySelector('.btnScreenshot')) {
            refreshResponsiveStyle();
            const newBtn = ensureBtn();
            container.insertBefore(newBtn, favBtn);
        }

        return true;
    };

    const enable = () => {
        if (enabled) return;

        enabled = true;

        observer = new MutationObserver(() => {
            injectButton();
            checkVideoChange();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['style', 'class']
        });

        pollInterval = setInterval(() => {
            if (injectButton()) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        }, 300);

        injectButton();

        console.log('[Jellyfin Screenshot Button] Enabled.');
    };

    const disable = () => {
        if (!enabled) return;

        enabled = false;

        stopAutoMode();

        if (observer) {
            observer.disconnect();
            observer = null;
        }

        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }

        removeButton();
        lastVideoRef = null;

        console.log('[Jellyfin Screenshot Button] Disabled.');
    };

    const tryRegisterWithCustoms = () => {
        if (registeredWithCustoms) return false;

        const api = window[CUSTOMS_API_NAME];

        if (!api || typeof api.registerAddon !== 'function') {
            return false;
        }

        registeredWithCustoms = true;

        if (localStorage.getItem(CUSTOMS_STORAGE_KEY) === null) {
            localStorage.setItem(CUSTOMS_STORAGE_KEY, 'true');
        }

        api.registerAddon({
            id: ADDON_ID,
            name: ADDON_NAME,

            enable() {
                ignoreStoredCustomsState = false;
                enable();
            },

            disable() {
                ignoreStoredCustomsState = false;
                disable();
            }
        });

        if (!ignoreStoredCustomsState) {
            if (isEnabledByCustomsState()) {
                enable();
            } else {
                disable();
            }
        } else {
            enable();
        }

        console.log('[Jellyfin Screenshot Button] Registered with Customs.');

        return true;
    };

    const startCustomsRegistrationWatcher = () => {
        tryRegisterWithCustoms();

        if (registeredWithCustoms) return;

        let tries = 0;

        customsRegisterTimer = setInterval(() => {
            tries += 1;
            tryRegisterWithCustoms();

            if (registeredWithCustoms || tries >= CUSTOMS_WAIT_TRIES) {
                clearInterval(customsRegisterTimer);
                customsRegisterTimer = null;
            }
        }, CUSTOMS_WAIT_MS);
    };

    const start = () => {
        if (isCustomsAvailable()) {
            ignoreStoredCustomsState = false;
            tryRegisterWithCustoms();
        } else {
            ignoreStoredCustomsState = true;
            enable();
        }

        startCustomsRegistrationWatcher();

        console.log('[Jellyfin Screenshot Button] Script loaded.');
    };

    if (document.documentElement) {
        start();
    } else {
        document.addEventListener('DOMContentLoaded', start, {
            once: true
        });
    }

    // ---- PLUGIN ADAPTER: apply fetched config once it arrives ----
    fetchPluginConfig().then(function (pluginConfig) {
        applyPluginConfig(pluginConfig);
        refreshResponsiveStyle();
    });
    // ---- END PLUGIN ADAPTER ----
})();
