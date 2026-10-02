function ssIsSupportedPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = ['mobi', 'ipad', 'iphone', 'ipod', 'silk', 'opera mini'].some((term) => ua.includes(term));
    const isTv = ['tv', 'samsungbrowser', 'viera', 'web0s'].some((term) => ua.includes(term));
    const isTizen = ua.includes('tizen') || window.tizen != null;
    const isAndroid = ua.includes('android');
    const isIOS = ['ipad', 'iphone', 'ipod'].some((term) => ua.includes(term)) || (ua.includes('macintosh') && navigator.maxTouchPoints > 1);
    return !(isMobile || isTv || isTizen || isAndroid || isIOS);
}

function ssMain() {
    'use strict';


    // ---- PLUGIN ADAPTER: config source, retrofit for VideoOSD Tweaks and Candy ----

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
        const maxAttempts = 120;
        const delayMs = 250;
        let failures = 0;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            // No ApiClient yet (jellyfin-web creates it once a server is
            // known, e.g. after the server selection page): wait without
            // using up an attempt, like the not-logged-in case below.
            if (!window.ApiClient) attempt--;
            if (window.ApiClient && typeof ApiClient.getJSON === 'function') {
                // Not logged in yet (e.g. still on the login page): every
                // request would only fail with 401, so wait without using up
                // an attempt (the whole budget used to run out right there).
                if (typeof ApiClient.accessToken === 'function' && !ApiClient.accessToken()) {
                    attempt--;
                    await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
                    continue;
                }
                try {
                    // The plugin's own endpoint, readable for every signed-in user.
                    const config = await ApiClient.getJSON(ApiClient.getUrl('VideoOSDTweaksCandy/ClientConfiguration'));
                    if (config) return config;
                    throw new Error('empty configuration');
                } catch (err) {
                    // 403: no access; 404: plugin not installed (standalone
                    // use). Retrying can't change
                    // either, so stop and use the defaults instead of sending
                    // up to 120 failing requests.
                    if (err && (err.status === 403 || err.status === 404)) return null;
                    // Server error (5xx), network error or empty answer: at most 3
                    // retries, 0.5 / 1 / 2 s apart, then the defaults until the next
                    // fetch (this used to send up to 120 requests in 30 s).
                    if (++failures > 3) return null;
                    await new Promise(function (resolve) { setTimeout(resolve, delayMs * Math.pow(2, failures)); });
                    continue;
                }
            }
            await new Promise(function (resolve) { setTimeout(resolve, delayMs); });
        }
        return null;
    }

    // FIX for a real, confirmed bug found via a faithful full-stack test
    // (all real scripts + real Jellyfin HTML together), identical to the
    // Download Button's: this function was CALLED at the bottom of this
    // file but never defined anywhere in it (the comment at the CONFIG
    // block even referenced "applyPluginConfig() below" -- it did not
    // exist). The call threw a ReferenceError inside the promise chain
    // as an unhandled rejection, so ALL admin-configured Screenshot
    // settings (file format, filename source/pattern, rapid-fire, auto
    // mode, narrow-window hiding) were silently ignored and the script
    // permanently ran on its standalone defaults. Mapping mirrors the
    // pattern every other addon uses; guarded per-field so a missing or
    // partial config never wipes a default.
    function applyPluginConfig(pluginConfig) {
        if (!pluginConfig) return;

        if (typeof pluginConfig.ScreenshotHideOnNarrowWindow === 'boolean') {
            CONFIG.hideOnNarrowWindow = pluginConfig.ScreenshotHideOnNarrowWindow;
        }
        if (typeof pluginConfig.ScreenshotFileFormat === 'string' && pluginConfig.ScreenshotFileFormat) {
            CONFIG.fileFormat = pluginConfig.ScreenshotFileFormat;
        }
        if (typeof pluginConfig.ScreenshotFilenameSource === 'string' && pluginConfig.ScreenshotFilenameSource) {
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
        if (typeof pluginConfig.ScreenshotFilenamePattern === 'string' && pluginConfig.ScreenshotFilenamePattern) {
            CONFIG.filenamePattern = pluginConfig.ScreenshotFilenamePattern;
        }
        if (typeof pluginConfig.ScreenshotRapidFireEnabled === 'boolean') {
            CONFIG.rapidFireEnabled = pluginConfig.ScreenshotRapidFireEnabled;
        }
        if (Number.isFinite(Number(pluginConfig.ScreenshotRapidFireIntervalMs)) && Number(pluginConfig.ScreenshotRapidFireIntervalMs) > 0) {
            CONFIG.rapidFireIntervalMs = Number(pluginConfig.ScreenshotRapidFireIntervalMs);
        }
        if (typeof pluginConfig.ScreenshotAutoModeEnabled === 'boolean') {
            CONFIG.autoModeEnabled = pluginConfig.ScreenshotAutoModeEnabled;
        }
        if (Number.isFinite(Number(pluginConfig.ScreenshotAutoModeIntervalMs)) && Number(pluginConfig.ScreenshotAutoModeIntervalMs) > 0) {
            CONFIG.autoModeIntervalMs = Number(pluginConfig.ScreenshotAutoModeIntervalMs);
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

    const getIcon = () => (btn ? btn.querySelector('.jvosd-screenshot-icon') : null);

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
    const getNowPlayingItemInfo = async () => {
        if (!window.ApiClient) return null;
        try {
            const ratingBtn = document.querySelector('#videoOsdPage:not(.hide) .btnUserRating');
            const id = ratingBtn && ratingBtn.dataset ? ratingBtn.dataset.id : undefined;
            if (!id) return null;

            const userId = ApiClient.getCurrentUserId();
            const item = await ApiClient.getItem(userId, id);
            if (!item) return null;

            let kind = 'video';
            if (item.Type === 'Movie') kind = 'movie';
            else if (item.Type === 'Episode') kind = 'episode';

            let originalFilename = null;
            if (item.Path) {
                originalFilename = item.Path.split(/[\\/]/).pop().replace(/\.[^/.]+$/, '');
            }

            return {
                kind: kind,
                originalFilename: originalFilename,
                name: item.Name || null,
                seriesName: item.SeriesName || null,
                // "!= null" instead of "||": season 0 (specials) and episode 0
                // are real numbers, not missing ones.
                seasonNumber: item.ParentIndexNumber != null ? item.ParentIndexNumber : null,
                episodeNumber: item.IndexNumber != null ? item.IndexNumber : null,
                productionYear: item.ProductionYear || null
            };
        } catch (err) {
            return null;
        }
    };

    const getVideoLabel = async video => {
        const info = await getNowPlayingItemInfo();



        if (CONFIG.filenameSource === 'original') {
            if (info && info.originalFilename) {
                return ` - ${sanitize(info.originalFilename)}`;
            }
            // Original filename unavailable -- fall through to library-name approach.
        }

        // Library name: try API first, fall back to DOM parsing
        if (info && info.name) {
            const kind = info.kind || 'video';
            const includeYear = kind === 'movie' ? CONFIG.includeYearMovies
                : kind === 'episode' ? CONFIG.includeYearEpisodes
                    : CONFIG.includeYearVideos;

            let label;
            if (kind === 'episode' && info.seriesName) {
                const s = String(info.seasonNumber != null ? info.seasonNumber : 1).padStart(2, '0');
                const e = String(info.episodeNumber != null ? info.episodeNumber : 1).padStart(2, '0');
                label = `${info.seriesName} - S${s}E${e} - ${info.name}`;
            } else {
                label = info.name;
            }

            if (includeYear && info.productionYear) {
                label += ` (${info.productionYear})`;
            }

            label = label.replace(/\s*:\s*/g, ' - ');
            return ` - ${sanitize(label)}`;
        }

        // DOM fallback (API unavailable)
        const pageTitleEl = document.querySelector('h3.pageTitle') ||
            Array.from(document.querySelectorAll('[aria-hidden="true"]'))
                .find(el => el.className.toLowerCase().includes('pagetitle'));

        if (!pageTitleEl) return '';

        let text = pageTitleEl.textContent.trim();

        const kind = (info && info.kind) || 'video';
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
        // Local date, like the local time below: toISOString() is UTC,
        // so near midnight the date part didn't match the time part.
        const date =
            now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
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

        const isJpg = CONFIG.fileFormat === 'jpg';
        const mimeType = isJpg ? 'image/jpeg' : 'image/png';

        // A remote stream played without CORS (e.g. a .strm pointing to
        // another server) taints the canvas, and toDataURL() then throws.
        // That used to be an uncaught error on every shot (and on every
        // auto-mode tick); a screenshot is impossible there, so stop
        // cleanly instead.
        let dataUrl;
        try {
            canvas.getContext('2d').drawImage(video, 0, 0);
            dataUrl = isJpg ? canvas.toDataURL(mimeType, 0.92) : canvas.toDataURL(mimeType);
        } catch (err) {
            console.warn('[VideoOSD Screenshot Button] screenshot not possible for this video:', err);
            if (autoMode) stopAutoMode();
            return;
        }
        const extension = isJpg ? 'jpg' : 'png';

        getVideoLabel(video).then(label => {
            const link = document.createElement('a');
            link.download = buildFilename(label, extension);
            link.href = dataUrl;
            link.click();
        }).catch(function (err) {
            console.error('[VideoOSD Screenshot Button] takeScreenshot failed:', err);
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
        // No immediate shot: the double-click that starts auto mode has
        // already taken its own shots (mousedown / Enter). If screenshots
        // are impossible (tainted canvas), the first interval shot stops
        // auto mode again and clears the interval.
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

            // Inline SVG instead of the "Material Symbols Outlined" icon
            // font: jellyfin-web ships no Material Symbols font, so without
            // it (loaded by some other theme/plugin/CSS) the ligature text
            // "photo_camera" was rendered as plain text instead of an icon. The
            // path is the font's own "photo_camera" glyph (FILL 0, wght 400,
            // GRAD 0, opsz 24), sized to the font's standard 24px, so it
            // looks exactly like the font rendering did.
            const icon = document.createElement('span');
            icon.className = 'xlargePaperIconButton jvosd-screenshot-icon';
            icon.style.cssText = 'display:inline-block;width:24px;height:24px;line-height:0;';
            icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true" style="display:block"><path d="M480 -260Q555 -260 607.5 -312.5Q660 -365 660 -440Q660 -515 607.5 -567.5Q555 -620 480 -620Q405 -620 352.5 -567.5Q300 -515 300 -440Q300 -365 352.5 -312.5Q405 -260 480 -260ZM480 -340Q438 -340 409.0 -369.0Q380 -398 380 -440Q380 -482 409.0 -511.0Q438 -540 480 -540Q522 -540 551.0 -511.0Q580 -482 580 -440Q580 -398 551.0 -369.0Q522 -340 480 -340ZM160 -120Q127 -120 103.5 -143.5Q80 -167 80 -200V-680Q80 -713 103.5 -736.5Q127 -760 160 -760H286L360 -840H600L674 -760H800Q833 -760 856.5 -736.5Q880 -713 880 -680V-200Q880 -167 856.5 -143.5Q833 -120 800 -120ZM160 -200H800Q800 -200 800.0 -200.0Q800 -200 800 -200V-680Q800 -680 800.0 -680.0Q800 -680 800 -680H638L565 -760H395L322 -680H160Q160 -680 160.0 -680.0Q160 -680 160 -680V-200Q160 -200 160.0 -200.0Q160 -200 160 -200ZM480 -440Q480 -440 480.0 -440.0Q480 -440 480 -440Q480 -440 480.0 -440.0Q480 -440 480 -440Q480 -440 480.0 -440.0Q480 -440 480 -440Q480 -440 480.0 -440.0Q480 -440 480 -440Z"/></svg>';
            btn.appendChild(icon);

            let intervalId = null;
            let clickCount = 0;
            let clickTimer = null;

            btn.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();

                // Keyboard activation (Enter) fires click without
                // mousedown (detail 0), so take the shot here for it.
                if (event.detail === 0 && !autoMode) takeScreenshot();

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

            // Pointer events where the browser has them: a finger fires
            // pointerdown when it touches (mousedown only comes after the
            // finger is lifted), so hold-to-rapid-fire also works by touch.
            // Browsers without pointer events keep the mouse events.
            const usePointer = typeof window.PointerEvent === 'function';
            const downEvent = usePointer ? 'pointerdown' : 'mousedown';

            let lastPointerType = '';

            if (usePointer) {
                // No scrolling or zoom while the finger holds the button,
                // and no long-press menu after a touch; a mouse right-click
                // keeps its normal context menu.
                btn.style.touchAction = 'none';
                btn.addEventListener('contextmenu', event => {
                    if (lastPointerType === 'touch') event.preventDefault();
                });
            }

            btn.addEventListener(downEvent, event => {
                event.preventDefault();
                event.stopPropagation();
                lastPointerType = event.pointerType || 'mouse';

                // Left button / primary touch only: right/middle click used
                // to take shots and start rapid fire too.
                if (event.button !== 0) return;
                if (autoMode || intervalId) return;

                // FIX: the single-click screenshot used to sit behind the
                // rapid-fire check, so with rapid fire disabled a click
                // only wiggled the icon and saved nothing. The shot is
                // taken first; only the hold-to-repeat part needs rapid
                // fire. (The one-shot wiggle comes from the click handler.)
                takeScreenshot();

                if (!CONFIG.rapidFireEnabled) return;

                startWiggle();
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

            if (usePointer) {
                btn.addEventListener('pointerup', stopInterval);
                btn.addEventListener('pointerleave', stopInterval);
                btn.addEventListener('pointercancel', stopInterval);
            } else {
                btn.addEventListener('mouseup', stopInterval);
                btn.addEventListener('mouseleave', stopInterval);
            }
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

        const favBtn = document.querySelector('#videoOsdPage:not(.hide) .buttons.focuscontainer-x > .btnUserRating');
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

        // FIX for a possible cause of a real, live-observed hang: this
        // observer watches the whole document.body subtree for any
        // style/class change, which fires constantly during active video
        // playback (Jellyfin's own progress bar updates style/class very
        // frequently), and it's one of 3 currently-enabled mods with an
        // essentially identical, independent observer, all reacting to
        // the same mutations simultaneously. Debounced to at most once
        // every 100ms: still responsive enough to catch newly inserted
        // elements quickly, but coalesces a rapid burst of many mutations
        // into a single actual check instead of running the callback
        // hundreds or thousands of times per second.
        let debounceTimer = null;
        observer = new MutationObserver(() => {
            if (debounceTimer) return;
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                injectButton();
                checkVideoChange();
            }, 100);
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

        console.log('[VideoOSD Screenshot Button] Script loaded.');
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
    }).catch(function (err) {
        console.error('[VideoOSD Screenshot Button] config apply failed:', err);
    });
    // ---- END PLUGIN ADAPTER ----
}

// Phones, tablets and TV devices: this addon stays off there unless the plugin
// setting "ScreenshotOnTouchAndTvDevices" allows it (the owner's choice, default off). The setting is
// read from the plugin's own endpoint, which every signed-in user may read.
function ssAllowedOnThisDevice() {
  // Signed out (login page) nothing is sent and no timer runs: the check
  // waits for the first view change ("viewshow") or hash change with a token.
  return new Promise(function (resolve) {
    let started = false;
    const attempt = function () {
      const api = window.ApiClient;
      if (started || !api || typeof api.accessToken !== 'function' || !api.accessToken()) return;
      started = true;
      document.removeEventListener('viewshow', attempt, true);
      window.removeEventListener('hashchange', attempt);
      api.getJSON(api.getUrl('VideoOSDTweaksCandy/ClientConfiguration')).then(function (config) {
        resolve(!!config && config.ScreenshotOnTouchAndTvDevices === true);
      }, function () {
        resolve(false);
      });
    };
    attempt();
    if (!started) {
      document.addEventListener('viewshow', attempt, true);
      window.addEventListener('hashchange', attempt);
    }
  });
}

if (ssIsSupportedPlatform()) {
    ssMain();
} else {
    ssAllowedOnThisDevice().then(function (allowed) {
        if (allowed) ssMain();
    });
}
