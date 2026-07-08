let hoverOverlay = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "START_SELECTION") {
    enableElementSelection();
  }
});

function enableElementSelection() {
  if (hoverOverlay) hoverOverlay.remove();

  hoverOverlay = document.createElement('div');
  hoverOverlay.style.position = 'absolute';
  hoverOverlay.style.backgroundColor = 'rgba(40, 167, 69, 0.35)';
  hoverOverlay.style.border = '2px dashed #28a745';
  hoverOverlay.style.pointerEvents = 'none';
  hoverOverlay.style.zIndex = '999999';
  document.body.appendChild(hoverOverlay);

  document.addEventListener('mouseover', onMouseOver);
  document.addEventListener('click', onElementClick, { once: true });
}

function onMouseOver(e) {
  if (e.target === hoverOverlay) return;
  const rect = e.target.getBoundingClientRect();
  hoverOverlay.style.width = `${rect.width}px`;
  hoverOverlay.style.height = `${rect.height}px`;
  hoverOverlay.style.top = `${rect.top + window.scrollY}px`;
  hoverOverlay.style.left = `${rect.left + window.scrollX}px`;
}

function onElementClick(e) {
  e.preventDefault();
  e.stopPropagation();

  document.removeEventListener('mouseover', onMouseOver);
  if (hoverOverlay) hoverOverlay.remove();

  const selector = getUniqueSelector(e.target);
  const currentText = e.target.innerText.trim();

  chrome.storage.local.get(['monitor_selectors', 'monitor_initial_texts'], (data) => {
    const selectorsList = data.monitor_selectors || [];
    const textsList = data.monitor_initial_texts || {};

    selectorsList.push(selector);
    textsList[selector] = currentText; // Map text state to selector string path

    chrome.storage.local.set({
      monitor_selectors: selectorsList,
      monitor_initial_texts: textsList
    }, () => {
      alert(`Added element to watch list! Total selected: ${selectorsList.length}.\nClick "Target Element" again to add more, or hit "Start Monitoring".`);
    });
  });
}

function getUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  let path = [];
  while (el.nodeType === Node.ELEMENT_NODE) {
    let selector = el.nodeName.toLowerCase();
    if (el.className) {
      selector += '.' + el.className.trim().split(/\s+/)[0];
    }
    path.unshift(selector);
    el = el.parentNode;
  }
  return path.join(' > ');
}

// Validation run executed automatically upon tab completion
(() => {
  chrome.storage.local.get(['monitor_enabled', 'monitor_selectors', 'monitor_initial_texts', 'monitor_sound'], (data) => {
    if (!data.monitor_enabled || !data.monitor_selectors || data.monitor_selectors.length === 0) return;

    let modificationDetected = false;
    const currentStoredTexts = data.monitor_initial_texts || {};

    data.monitor_selectors.forEach((selector) => {
      const targetEl = document.querySelector(selector);
      if (targetEl) {
        const freshText = targetEl.innerText.trim();
        if (freshText !== currentStoredTexts[selector]) {
          modificationDetected = true;
          currentStoredTexts[selector] = freshText; // Update tracking data
        }
      }
    });

    if (modificationDetected) {
      chrome.storage.local.set({ monitor_initial_texts: currentStoredTexts }, () => {
        chrome.runtime.sendMessage({ action: "PLAY_ALERT_SOUND", soundType: data.monitor_sound });
      });
    }
  });
})();