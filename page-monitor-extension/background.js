// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "START_BACKGROUND_TIMER") {
    planNextRun();
  } else if (message.action === "STOP_BACKGROUND_TIMER") {
    if (chrome.alarms) {
      chrome.alarms.clear("refresh_alarm");
    }
  } else if (message.action === "PLAY_ALERT_SOUND") {
    triggerSound(message.soundType);
  }
});

// Main loop controller
function planNextRun() {
  if (!chrome.alarms) return;
  
  chrome.alarms.clear("refresh_alarm", () => {
    chrome.storage.local.get([
      'monitor_enabled', 'monitor_mode', 'monitor_interval', 
      'monitor_rand_min', 'monitor_rand_max', 'monitor_limit', 'monitor_refresh_count'
    ], (data) => {
      if (!data.monitor_enabled) return;

      // Check refresh limits
      if (data.monitor_limit > 0 && data.monitor_refresh_count >= data.monitor_limit) {
        chrome.storage.local.set({ monitor_enabled: false });
        sendNotification("Monitoring Finished", "The maximum target refresh count limit has been reached.");
        return;
      }

      // Determine runtime wait intervals
      let finalMinutes = parseFloat(data.monitor_interval) || 1;
      if (data.monitor_mode === 'random') {
        const min = parseFloat(data.monitor_rand_min) || 0.5;
        const max = parseFloat(data.monitor_rand_max) || 2;
        finalMinutes = Math.random() * (max - min) + min;
      }

      const nextTime = Date.now() + (finalMinutes * 60 * 1000);
      
      chrome.storage.local.set({ next_refresh_time: nextTime }, () => {
        chrome.alarms.create("refresh_alarm", { delayInMinutes: finalMinutes });
      });
    });
  });
}

// Catch the alarm when it fires
if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "refresh_alarm") {
      chrome.storage.local.get(['monitor_enabled', 'monitor_refresh_count', 'target_tab_id'], (freshData) => {
        if (!freshData.monitor_enabled || !freshData.target_tab_id) return;

        const explicitTabId = parseInt(freshData.target_tab_id, 10);

        chrome.tabs.get(explicitTabId, (tab) => {
          if (chrome.runtime.lastError || !tab) {
            chrome.storage.local.set({ monitor_enabled: false });
            chrome.alarms.clear("refresh_alarm");
            return;
          }

          chrome.tabs.reload(explicitTabId, { bypassCache: true }, () => {
            const newCount = (freshData.monitor_refresh_count || 0) + 1;
            chrome.storage.local.set({ monitor_refresh_count: newCount }, () => {
              setTimeout(() => {
                planNextRun();
              }, 3000);
            });
          });
        });
      });
    }
  });
}

function triggerSound(type) {
  if (!chrome.tts) return;
  
  if (type === "bell") {
    chrome.tts.speak("Ding! Ding!", { pitch: 1.6, rate: 1.4 });
  } else if (type === "siren") {
    chrome.tts.speak("Wee woo! Wee woo! Alert!", { pitch: 0.6, rate: 1.1 });
  } else if (type === "beep") {
    chrome.tts.speak("Bip. Bip. Bip.", { pitch: 1.9, rate: 2.0 });
  } else {
    chrome.tts.speak("Attention, modification verified on observed selector paths.", { pitch: 1.0, rate: 1.0 });
  }
  sendNotification("Element Update Found!", "A modification was spotted inside your watched elements layout.");
}

function sendNotification(title, message) {
  if (!chrome.notifications) return;
  
  chrome.notifications.create({
    type: 'basic',
    iconUrl: "", // FIXED: Left blank to use Chrome's default browser icon layout
    title: title,
    message: message,
    priority: 2
  });
}