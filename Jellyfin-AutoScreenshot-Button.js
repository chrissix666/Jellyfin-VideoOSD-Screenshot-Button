
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
        str
            .replace(/[\\/:*?"<>|]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const getVideoLabel = video => {
        if (video.title && video.title.trim()) return sanitize(video.title);
        if (document.title && document.title.trim()) return sanitize(document.title);
        if (video.currentSrc) {
            try {
                const url = new URL(video.currentSrc);
                let name = url.pathname.split('/').pop() || '';
                name = name.replace(/\.[^.]+$/, '');
                if (name && !/^(master|index|playlist)$/i.test(name)) return sanitize(name);
            } catch {}
        }
        return 'video';
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
        link.download = `Screenshot ${date} ${time} ${label}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

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

            btn.addEventListener('click', () => {
                clickCount++;
                if (clickTimer) clearTimeout(clickTimer);

                clickTimer = setTimeout(() => {
                    if (clickCount === 2) toggleAutoMode();
                    clickCount = 0;
                }, 250);
            });

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

    const checkVideoChange = () => {
        const video = document.querySelector('video');
        if (video !== lastVideoRef) {
            lastVideoRef = video;
            if (autoMode) stopAutoMode();
        }
    };

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
