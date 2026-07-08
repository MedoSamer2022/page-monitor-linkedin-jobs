let countdownIntervalId = null;

const modeSelect = document.getElementById('timing-mode');
const fixedContainer = document.getElementById('fixed-container');
const randomContainer = document.getElementById('random-container');
const tabSelect = document.getElementById('target-tab-select');

// Toggle fields visual visibility based on type choice
modeSelect.addEventListener('change', () => {
  if (modeSelect.value === 'fixed') {
    fixedContainer.classList.remove('hidden');
    randomContainer.classList.add('hidden');
  } else {
    fixedContainer.classList.add('hidden');
    randomContainer.classList.remove('hidden');
  }
});

// Load all open browser tabs into the dropdown list
function populateTabsList(activeTrackedId) {
  chrome.tabs.query({}, (tabs) => {
    tabSelect.innerHTML = '';
    
    // Filter out extensions settings or blank landing pages
    const validTabs = tabs.filter(t => t.url && !t.url.startsWith('chrome://'));
    
    if (validTabs.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.innerText = "No valid pages open";
      tabSelect.appendChild(opt);
      return;
    }

    validTabs.forEach((tab) => {
      const opt = document.createElement('option');
      opt.value = tab.id;
      // Truncate title strings to look clean in the dropdown select panel layout
      opt.innerText = `${tab.title ? tab.title.substring(0, 30) : 'Web Page'} (${new URL(tab.url).hostname})`;
      
      // Keep selected tab marked if it matches a running tracking process
      if (activeTrackedId && tab.id === parseInt(activeTrackedId, 10)) {
        opt.selected = true;
      } else if (!activeTrackedId && tab.active) {
        opt.selected = true; // Fallback default to the tab you are looking at right now
      }
      tabSelect.appendChild(opt);
    });
  });
}

function updateSelectorsListDisplay(selectors) {
  const container = document.getElementById('selectors-list');
  if (!selectors || selectors.length === 0) {
    container.innerText = "None selected yet.";
    return;
  }
  container.innerHTML = selectors.map((s, idx) => `<div>${idx + 1}. ${s}</div>`).join('');
}

document.getElementById('select-element').addEventListener('click', async () => {
  const selectedTabId = parseInt(tabSelect.value, 10);
  if (!selectedTabId) {
    alert("Please select a target tab from the menu first.");
    return;
  }
  // Focus and trigger selector logic directly on the chosen target tab
  chrome.tabs.update(selectedTabId, { active: true });
  chrome.tabs.sendMessage(selectedTabId, { action: "START_SELECTION" });
  window.close();
});

document.getElementById('add-manual-selector').addEventListener('click', async () => {
  const inputEl = document.getElementById('manual-selector');
  const selector = inputEl.value.trim();
  const selectedTabId = parseInt(tabSelect.value, 10);
  
  if (!selector || !selectedTabId) return;
  
  chrome.scripting.executeScript({
    target: { tabId: selectedTabId },
    func: (sel) => {
      const el = document.querySelector(sel);
      return el ? el.innerText.trim() : null;
    },
    args: [selector]
  }, (results) => {
    if (!results || results[0].result === null) {
      alert("Could not find that element on the chosen target tab page.");
      return;
    }

    chrome.storage.local.get(['monitor_selectors', 'monitor_initial_texts'], (data) => {
      const selectorsList = data.monitor_selectors || [];
      const textsList = data.monitor_initial_texts || {};

      if (!selectorsList.includes(selector)) selectorsList.push(selector);
      textsList[selector] = results[0].result;

      chrome.storage.local.set({ monitor_selectors: selectorsList, monitor_initial_texts: textsList }, () => {
        updateSelectorsListDisplay(selectorsList);
        inputEl.value = '';
        document.getElementById('status').innerText = "Manual element added.";
      });
    });
  });
});

document.getElementById('start').addEventListener('click', async () => {
  const mode = modeSelect.value;
  const interval = parseFloat(document.getElementById('interval').value);
  const randMin = parseFloat(document.getElementById('rand-min').value);
  const randMax = parseFloat(document.getElementById('rand-max').value);
  const limit = parseInt(document.getElementById('limit').value, 10);
  const sound = document.getElementById('sound-type').value;
  const selectedTabId = parseInt(tabSelect.value, 10);

  if (!selectedTabId) {
    alert("Please select a target tab to monitor.");
    return;
  }
  
  chrome.storage.local.get(['monitor_selectors'], (data) => {
    if (!data.monitor_selectors || data.monitor_selectors.length === 0) {
      alert("Please select or add at least one page element first!");
      return;
    }
    
    chrome.storage.local.set({
      monitor_enabled: true,
      monitor_mode: mode,
      monitor_interval: interval,
      monitor_rand_min: randMin,
      monitor_rand_max: randMax,
      monitor_limit: limit,
      monitor_refresh_count: 0,
      monitor_sound: sound,
      target_tab_id: selectedTabId // Link background processing exclusively to the dropdown tab selection
    }, () => {
      chrome.runtime.sendMessage({ action: "START_BACKGROUND_TIMER" });
      document.getElementById('status').innerText = "Monitoring initialized.";
      
      setTimeout(() => {
        chrome.storage.local.get(['next_refresh_time'], (freshData) => {
          if (freshData.next_refresh_time) renderCountdown(freshData.next_refresh_time);
        });
      }, 200);
    });
  });
});

document.getElementById('stop').addEventListener('click', () => {
  chrome.storage.local.set({ monitor_enabled: false, monitor_selectors: [] }, () => {
    chrome.runtime.sendMessage({ action: "STOP_BACKGROUND_TIMER" });
    document.getElementById('status').innerText = "Monitoring cleared.";
    document.getElementById('timer-display').style.display = 'none';
    document.getElementById('selectors-list').innerText = "None selected yet.";
    clearInterval(countdownIntervalId);
  });
});

function renderCountdown(targetTime) {
  const display = document.getElementById('timer-display');
  display.style.display = 'block';
  clearInterval(countdownIntervalId);

  function updateDisplay() {
    const remaining = targetTime - Date.now();
    if (remaining <= 0) {
      display.innerText = "🔄 Processing Refresh...";
      clearInterval(countdownIntervalId);
      return;
    }
    const totalSeconds = Math.floor(remaining / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    display.innerText = `⏳ Next Refresh: ${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  updateDisplay();
  countdownIntervalId = setInterval(updateDisplay, 1000);
}

(async () => {
  chrome.storage.local.get([
    'monitor_enabled', 'monitor_mode', 'monitor_interval', 
    'monitor_rand_min', 'monitor_rand_max', 'next_refresh_time', 
    'monitor_selectors', 'monitor_limit', 'target_tab_id'
  ], (data) => {
    
    // Initialize the dropdown tab selector menu layout
    populateTabsList(data.target_tab_id);

    updateSelectorsListDisplay(data.monitor_selectors);
    if (data.monitor_limit !== undefined) document.getElementById('limit').value = data.monitor_limit;
    if (data.monitor_mode) {
      modeSelect.value = data.monitor_mode;
      modeSelect.dispatchEvent(new Event('change'));
    }
    if (data.monitor_interval) document.getElementById('interval').value = data.monitor_interval;
    if (data.monitor_rand_min) document.getElementById('rand-min').value = data.monitor_rand_min;
    if (data.monitor_rand_max) document.getElementById('rand-max').value = data.monitor_rand_max;
    
    if (data.monitor_enabled === true && data.next_refresh_time) {
      document.getElementById('status').innerText = "Monitoring is active.";
      renderCountdown(data.next_refresh_time);
    }
  });
})();