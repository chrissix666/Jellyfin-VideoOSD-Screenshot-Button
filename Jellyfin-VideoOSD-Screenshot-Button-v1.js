(function () {
    'use strict';

    const ADDON_ID = 'screenshotButton';
    const ADDON_NAME = 'Screenshot Button';

    const AUTO_SCREENSHOT_INTERVAL_MS = 1000;
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

    const getVideoLabel = video => {
        const pageTitleEl = document.querySelector('h3.pageTitle') ||
            Array.from(document.querySelectorAll('[aria-hidden="true"]'))
                .find(el => el.className.toLowerCase().includes('pagetitle'));

        if (!pageTitleEl) return '';

        let text = pageTitleEl.textContent.trim();

        const episodeMatch = text.match(/^(.*?)-\s*S(\d+)[\:-]?E(\d+)\s*-\s*(.*?)(?:\s*\(\d{4}\))?$/i);
        if (episodeMatch) {
            let showTitle = episodeMatch[1].trim();
            showTitle = showTitle.replace(/\s*:\s*/g, ' - ');

            const season = episodeMatch[2].padStart(2, '0');
            const episode = episodeMatch[3].padStart(2, '0');
            const episodeName = episodeMatch[4].trim();

            return ` - ${showTitle} - S${season}E${episode} - ${episodeName}`;
        }

        text = text.replace(/\s*\(\d{4}\)/, '');
        text = text.replace(/\s*:\s*/g, ' - ');

        return ` - ${sanitize(text)}`;
    };

    const takeScreenshot = () => {
        const video = document.querySelector('video');
        if (!video || video.videoWidth === 0) return;

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        const now = new Date();
        const date = now.toISOString().slice(0, 10);
        const time =
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0') +
            String(now.getSeconds()).padStart(2, '0');

        const label = getVideoLabel(video);

        const link = document.createElement('a');
        link.download = `Screenshot ${date} ${time}${label}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
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
        autoIntervalId = setInterval(takeScreenshot, AUTO_SCREENSHOT_INTERVAL_MS);
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
                    } else if (clickCount === 2) {
                        toggleAutoMode();
                    }

                    clickCount = 0;
                }, 250);
            });

            btn.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopPropagation();

                if (autoMode || intervalId) return;

                startWiggle();
                takeScreenshot();

                intervalId = setInterval(takeScreenshot, 200);
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
            container.insertBefore(ensureBtn(), favBtn);
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
})();
