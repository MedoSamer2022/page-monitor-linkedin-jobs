# Multi-Page Monitor Pro (Chrome Extension) - Linkedin Job Page Monitor

A powerful Manifest V3 Chrome Extension designed to track modifications across multiple page elements simultaneously using either a fixed interval loop or a randomized timing range to avoid bot detection.

## Features
* **Multi-Element Tracking:** Select target elements visually or input custom CSS selectors manually.
* **Background Monitoring:** Runs safely via `chrome.alarms` in a background service worker—monitors selected tabs even when they are not active.
* **Flexible Timing Modes:** Choose a **Fixed Interval** or a **Randomized Range** (to mimic human behavior).
* **Custom Audio Alerts:** Integrated with Chrome's TTS engine to provide distinct sound profiles (Bell, Siren, Beep, Voice) upon DOM updates.
* **Refresh Limits:** Set a maximum number of loops or keep it at `0` for infinite tracking.

## Installation Instructions
1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click the **Load unpacked** button in the top-left corner.
5. Select the folder containing these extension files.

## Files Structure
* `manifest.json` - Extension permissions, background declarations, and metadata configurations.
* `background.js` - Persistent service worker handling alarms, tabs reloads, and text-to-speech audio alerts.
* `content.js` - Injected script handling visual DOM element targeting and text comparison baselines.
* `popup.html` & `popup.js` - Interactive user control UI panel.
