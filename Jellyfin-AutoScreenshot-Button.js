(function () {
    'use strict';

    /**********************
     * CONFIG
     **********************/
    const AUTO_SCREENSHOT_INTERVAL_MS = 1000; // ⬅️ hier anpassen

    let btn = null;
    let autoMode = false;
    let autoIntervalId = null;
    let lastVideoRef = null;

    /**********************
     * STYLES
     **********************/
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
        .auto-screenshot-active {
            animation: autoscreenshot-wiggle 1s ease-in-out infinite;
        }
        `;
        document.head.appendChild(style);
    };

    const sanitize = str =>
        str.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();

    /**********************
     * LABEL PARSING
     * Uses Page Title for file naming
     * Year is now always removed
     **********************/
    const getVideoLabel = video => {
        // Find current pageTitle
        const pageTitleEl = document.querySelector('h3.pageTitle') || 
                            Array.from(document.querySelectorAll('[aria-hidden="true"]'))
                                 .find(el => el.className.toLowerCase().includes('pagetitle'));

        if (!pageTitleEl) return '';

        let text = pageTitleEl.textContent.trim();

        // --- Check for Episode first ---
        // Pattern: ShowTitle - Sx:Ey - EpisodeName (Year optional)
        const episodeMatch = text.match(/^(.*?)-\s*S(\d+)[\:-]?E(\d+)\s*-\s*(.*?)(?:\s*\(\d{4}\))?$/i);
        if (episodeMatch) {
            let showTitle = episodeMatch[1].trim();
            // Replace ":" with " - " in ShowTitle only
            showTitle = showTitle.replace(/\s*:\s*/g, ' - ');

            const season = episodeMatch[2].padStart(2,'0');
            const episode = episodeMatch[3].padStart(2,'0');
            const episodeName = episodeMatch[4].trim();

            // Episode detected → ignore year, format SxxEyy
            return ` - ${showTitle} - S${season}E${episode} - ${episodeName}`;
        }

        // --- Not an Episode ---
        // Remove any year in parentheses if present
        text = text.replace(/\s*\(\d{4}\)/, '');
        // Replace ":" with " - " for non-episode titles
        text = text.replace(/\s*:\s*/g, ' - ');

        return ` - ${sanitize(text)}`;
    };

    /**********************
     * TAKE SCREENSHOT
     **********************/
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

    /**********************
     * AUTO MODE
     **********************/
    const stopAutoMode = () => {
        autoMode = false;
        clearInterval(autoIntervalId);
        autoIntervalId = null;
        const icon = btn?.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.remove('auto-screenshot-active');
    };

    const startAutoMode = () => {
        autoMode = true;
        takeScreenshot();
        autoIntervalId = setInterval(takeScreenshot, AUTO_SCREENSHOT_INTERVAL_MS);
        const icon = btn?.querySelector('.material-symbols-outlined');
        if (icon) icon.classList.add('auto-screenshot-active');
    };

    const toggleAutoMode = () => {
        autoMode ? stopAutoMode() : startAutoMode();
    };

    /**********************
     * BUTTON
     **********************/
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

            // Single / Double click
            btn.addEventListener('click', () => {
                clickCount++;
                if (clickTimer) clearTimeout(clickTimer);

                clickTimer = setTimeout(() => {
                    if (clickCount === 2) toggleAutoMode();
                    clickCount = 0;
                }, 250);
            });

            // Hold: immediate screenshot + repeat every 200ms
            btn.addEventListener('mousedown', () => {
                if (autoMode || intervalId) return;
                takeScreenshot();
                intervalId = setInterval(takeScreenshot, 200);
            });

            const stopInterval = () => {
                clearInterval(intervalId);
                intervalId = null;
            };

            btn.addEventListener('mouseup', stopInterval);
            btn.addEventListener('mouseleave', stopInterval);
        }
        return btn;
    };

    /**********************
     * VIDEO CHANGE DETECTION
     **********************/
    const checkVideoChange = () => {
        const video = document.querySelector('video');
        if (video !== lastVideoRef) {
            lastVideoRef = video;
            if (autoMode) stopAutoMode();
        }
    };

    /**********************
     * INJECT BUTTON
     **********************/
    const injectButton = () => {
        const favBtn = document.querySelector('.buttons.focuscontainer-x > .btnUserRating');
        if (!favBtn || !favBtn.parentNode) return false;
        const container = favBtn.parentNode;
        if (!container.querySelector('.btnScreenshot')) {
            container.insertBefore(ensureBtn(), favBtn);
        }
        return true;
    };

    const observer = new MutationObserver(() => {
        injectButton();
        checkVideoChange();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const pollInterval = setInterval(() => {
        if (injectButton()) clearInterval(pollInterval);
    }, 300);

    injectButton();
})();
