const GOLD_API_URL =
  "https://api.jdjygold.com/gw2/generic/jrm/h5/m/stdLatestPrice?productSku=1961543816";
const REFRESH_INTERVAL = 30000; // 5秒刷新一次

// 获取金价数据
async function fetchGoldPrice() {
  try {
    const response = await fetch(GOLD_API_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // 根据API响应结构提取数据
    if (data.success && data.resultData && data.resultData.datas) {
      const goldData = {
        price: data.resultData.datas.price,
        upAndDownAmt: data.resultData.datas.upAndDownAmt,
        upAndDownRate: data.resultData.datas.upAndDownRate,
        yesterdayPrice: data.resultData.datas.yesterdayPrice,
        time: data.resultData.datas.time,
        lastUpdate: new Date().getTime(),
        success: true
      };

      // 存储到本地存储
      await chrome.storage.local.set({ goldData });

      // 更新扩展图标徽章
      updateBadge(goldData.price, goldData.upAndDownAmt);

      console.log("金价数据更新成功:", goldData);

      // 检查价格预警
      checkPriceAlerts(parseFloat(goldData.price));

      return goldData;
    } else {
      throw new Error("API返回数据格式错误");
    }
  } catch (error) {
    console.error("获取金价失败:", error);

    // 存储错误信息
    const errorData = {
      error: "获取失败: " + error.message,
      lastUpdate: new Date().getTime(),
      success: false
    };
    await chrome.storage.local.set({ goldData: errorData });
    return errorData;
  }
}

// 更新扩展图标徽章
function updateBadge(price, change) {
  if (!price) return;

  // 显示价格（去掉小数点），Chrome 徽章不支持自定义字体大小，最多显示 4 个字符会撑满
  const badgeText = Math.floor(parseFloat(price)).toString();

  // 设置徽章背景色：涨为红，跌为绿，增加一点透明度让它看起来视觉上没那么重
  const changeNum = parseFloat(change);
  // 使用RGBA颜色，稍微降低饱和度/增加透明度，视觉上会显得“轻”一点
  const badgeColor = changeNum >= 0 ? [239, 68, 68, 230] : [16, 185, 129, 230];

  chrome.action.setBadgeText({ text: badgeText });
  chrome.action.setBadgeBackgroundColor({ color: badgeColor });

  // 如果浏览器支持设置文字颜色，设置为白色（Manifest V3 新特性）
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({ color: '#ffffff' });
  }
}

// 记录上一次提醒的价格和时间，以防重复轰炸
let lastAlert = {
  type: null,
  time: 0
};

// 检查价格预警
async function checkPriceAlerts(currentPrice) {
  console.log(`[Alert Check] 开始检查预警, 当前价格: ${currentPrice}`);
  if (isNaN(currentPrice)) {
    console.log("[Alert Check] 当前价格无效，退出");
    return;
  }

  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || {};
    console.log("[Alert Check] 提取到的原始设置:", settings);

    // 防御性解析高低价
    const rawHigh = settings.alertHigh ? String(settings.alertHigh).trim() : "";
    const rawLow = settings.alertLow ? String(settings.alertLow).trim() : "";

    const alertHigh = rawHigh ? parseFloat(rawHigh) : NaN;
    const alertLow = rawLow ? parseFloat(rawLow) : NaN;
    const now = new Date().getTime();

    // 冷却时间，同一个预警3分钟内不重复触发
    const COOLDOWN_MS = 10 * 60 * 1000;

    console.log(`[Alert Check] 解析后的受控阈值 - 高价: ${alertHigh}, 低价: ${alertLow}`);

    // 独立检查高价
    if (!isNaN(alertHigh) && alertHigh > 0 && currentPrice >= alertHigh) {
      console.log(`[Alert Check] 满足高价条件! 当前价 ${currentPrice} >= 设定的 ${alertHigh}`);
      if (lastAlert.type === 'high' && (now - lastAlert.time) < COOLDOWN_MS) {
        console.log(`[Alert Check] 拦截: 高价提醒仍在冷却中 (${Math.round((COOLDOWN_MS - (now - lastAlert.time)) / 1000)} 秒后恢复)`);
      } else {
        console.log("[Alert Check] 触发高价通知!");
        triggerNotification('金价飙升提醒', `当前金价 ${currentPrice} 元/克，已达到或超过您设定的目标高价 ${alertHigh} 元/克！考虑减仓。`);
        lastAlert = { type: 'high', time: now };
      }
    }

    // 独立检查低价
    if (!isNaN(alertLow) && alertLow > 0 && currentPrice <= alertLow) {
      console.log(`[Alert Check] 满足低价条件! 当前价 ${currentPrice} <= 设定的 ${alertLow}`);
      if (lastAlert.type === 'low' && (now - lastAlert.time) < COOLDOWN_MS) {
        console.log(`[Alert Check] 拦截: 低价提醒仍在冷却中 (${Math.round((COOLDOWN_MS - (now - lastAlert.time)) / 1000)} 秒后恢复)`);
      } else {
        console.log("[Alert Check] 触发低价通知!");
        triggerNotification('金价下跌提醒', `当前金价 ${currentPrice} 元/克，已达到或低于您设定的目标低价 ${alertLow} 元/克！考虑加仓。`);
        lastAlert = { type: 'low', time: now };
      }
    }
  });
}

function triggerNotification(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon.png'), // 使用绝对路径获取图标，防止路径错误导致静默失败
    title: title,
    message: message,
    priority: 2,
    requireInteraction: true // 强制通知停留在屏幕上，直到用户点击关闭
  }, (notificationId) => {
    if (chrome.runtime.lastError) {
      console.error("通知发送失败:", chrome.runtime.lastError.message);
      // 如果因为图标原因失败，尝试不要图标再发一次
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // 1x1 透明像素作为后备
        title: title,
        message: message,
        priority: 2,
        requireInteraction: true
      });
    } else {
      console.log("通知发送成功, ID:", notificationId);
    }
  });
}

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log("金价监控插件已安装");

  // 初始化默认数据
  chrome.storage.local.set({
    goldData: {
      price: "--",
      upAndDownAmt: "0",
      upAndDownRate: "0%",
      yesterdayPrice: "--",
      lastUpdate: new Date().getTime(),
      success: false
    }
  });

  // 立即获取一次数据
  fetchGoldPrice();

  // 创建定时刷新
  chrome.alarms.create("refreshGoldPrice", {
    periodInMinutes: REFRESH_INTERVAL / 60000
  });
});

// 定时器触发时获取数据
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "refreshGoldPrice") {
    fetchGoldPrice();
  }
});

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("收到消息:", request);

  if (request.action === "getGoldData") {
    chrome.storage.local.get("goldData").then((result) => {
      console.log("返回数据:", result.goldData);
      sendResponse(result.goldData);
    });
    return true; // 保持消息通道开放
  }

  if (request.action === "manualRefresh") {
    fetchGoldPrice().then((result) => {
      sendResponse(result);
    });
    return true;
  }

  // 默认响应
  sendResponse({ error: "未知操作" });
});
