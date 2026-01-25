# Jellyfin Auto Screenshot Button

Adds a screenshot button to the **Jellyfin Web UI video player**, available in the **Video OSD** during playback.

Tested **only on Windows 11** with **Chrome**.

---

## Features

- **Single click** → takes a screenshot of the current frame  
- **Hold click** → takes screenshots continuously every 0.2 seconds (rapid-fire mode)  
- **Double click** → toggles **auto mode**, taking a screenshot every second automatically  
  - Auto mode is reset to off when double click again, leaving video, or page reload.
  - On switching through videos (shuffle, playlists, autoplay next) it stays on at the moment.
 
![Jellyfin Auto Screenshot Button](Screenshot.png)


---

## Installation

This is a **Userscript / UI tweak** for Jellyfin Web:

1. Copy the script content  
2. Install via a **Userscript manager** (e.g., Tampermonkey) **or inject using Jellyfin's classic JavaScript Injector plugin**, the most common method  
3. Reload Jellyfin Web  
4. During video playback, the **camera button** will appear in the Video OSD next to your rating/favorite buttons

---

## Downloads & File Naming

Download folder:
Uses the system's default Downloads folder.
On Windows, this is the standard Windows Downloads directory of the current user.

Default file naming:
Follows the Windows Snipping Tool naming style, extended with the video title.

# Format:

Screenshot YYYY-MM-DD HHMMSS - videotitle.png

(Every ":" will be parsed to " -" for naming)

Experimental for TV Shows - Autoparsing: 

Screenshot YYYY-MM-DD HHMMSS - tvshowtitle - seasonumberepisodenumber - episodetitle.png


# Example:

Screenshot 2026-01-25 045602 - Inception.png or Screenshot 2026-01-25 045602 - John Wick - Chapter 2.png

Screenshot 2026-01-25 045602 - Star Trek - Voyager - S07E21 - Friendship One.png

---

## Disclaimer for Subtitles

As far tested image based subtitles (PGSSUB, DVDSUB=VOBSUB, .sup, .sub/.idx) are displayed on the screenshots, text based (SUBRIP, .srt), not
