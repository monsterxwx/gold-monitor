class GoldPriceMonitor {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadGoldData();
    
    // 监听从 VS Code 主动推送的数据更新
    window.addEventListener('message', (event) => {
        const message = event.data;
        if (message.action === 'updatePrice' && message.goldData) {
            this.updateDisplay(message.goldData);
        }
    });
  }

  bindEvents() {
    document.getElementById("refreshBtn").addEventListener("click", () => {
      this.manualRefresh();
    });

    document.getElementById("settingsBtn").addEventListener("click", () => {
      this.openSettings();
    });

    // 新增：AI 分析按钮绑定
    document.getElementById("aiBtn").addEventListener("click", () => {
      this.runAIAnalysis();
    });

    // 新增：设置窗口内部按钮绑定
    document.getElementById("closeSettingsBtn").addEventListener("click", () => {
      this.closeSettings();
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", () => {
      this.saveSettings();
    });
  }

  async loadGoldData() {
    try {
      console.log("开始加载金价数据...");

      // 从background获取数据
      const goldData = await this.sendMessage({ action: "getGoldData" });
      console.log("接收到数据:", goldData);

      if (goldData) {
        this.updateDisplay(goldData);
      } else {
        this.showError("未获取到数据");
      }
    } catch (error) {
      console.error("加载金价数据失败:", error);
      this.showError("加载数据失败: " + error.message);
    }
  }

  async manualRefresh() {
    const refreshBtn = document.getElementById("refreshBtn");
    const status = document.getElementById("status");

    refreshBtn.disabled = true;
    status.textContent = "刷新中...";
    status.style.color = "#3498db";

    try {
      console.log("开始手动刷新...");
      const result = await this.sendMessage({ action: "manualRefresh" });
      console.log("手动刷新结果:", result);

      if (result && result.success) {
        // 等待一下再获取新数据
        setTimeout(async () => {
          try {
            const goldData = await this.sendMessage({ action: "getGoldData" });
            this.updateDisplay(goldData);

            status.textContent = "刷新成功";
            status.style.color = "#27ae60";
          } catch (error) {
            console.error("获取刷新后数据失败:", error);
            status.textContent = "获取数据失败";
            status.style.color = "#e74c3c";
          }

          status.textContent = "自动监控中";
          status.style.color = "#ffeb3b";
          refreshBtn.disabled = false;
        }, 1000);
      } else {
        throw new Error("刷新失败");
      }
    } catch (error) {
      console.error("手动刷新失败:", error);
      this.showError("刷新失败: " + error.message);
      refreshBtn.disabled = false;
      status.textContent = "刷新失败";
      status.style.color = "#e74c3c";
    }
  }

  updateDisplay(goldData) {
    console.log("更新显示:", goldData);

    if (!goldData || goldData.error || !goldData.success) {
      const errorMsg = goldData?.error || "数据获取失败";
      this.showError(errorMsg);
      return;
    }

    this.hideError();

    // 更新价格显示
    document.getElementById("price").textContent = goldData.price || "--";

    // 更新涨跌金额
    const upAndDownAmt = goldData.upAndDownAmt || "0";
    const upAndDownAmtElement = document.getElementById("upAndDownAmt");
    upAndDownAmtElement.textContent = upAndDownAmt;
    this.setChangeColor(upAndDownAmtElement, upAndDownAmt);

    // 更新涨跌幅
    const upAndDownRate = goldData.upAndDownRate || "0%";
    const upAndDownRateElement = document.getElementById("upAndDownRate");
    upAndDownRateElement.textContent = upAndDownRate;
    this.setChangeColor(upAndDownRateElement, upAndDownRate);

    // 更新昨收价
    document.getElementById("yesterdayPrice").textContent =
      goldData.yesterdayPrice || "--";

    // 更新时间
    if (goldData.time) {
      const updateTime = new Date(parseInt(goldData.time));
      document.getElementById("updateTime").textContent =
        updateTime.toLocaleTimeString();
    } else if (goldData.lastUpdate) {
      const updateTime = new Date(goldData.lastUpdate);
      document.getElementById("updateTime").textContent =
        updateTime.toLocaleTimeString();
    } else {
      document.getElementById("updateTime").textContent =
        new Date().toLocaleTimeString();
    }

    // 更新状态
    document.getElementById("status").textContent = "数据已更新";
    document.getElementById("status").style.color = "#27ae60";

    // 更新当前盈亏
    this.sendMessage({ action: 'getSettings' }).then((settings) => {
      settings = settings || {};
      const holdingsPrice = parseFloat(settings.holdingsPrice);
      const holdingsAmount = parseFloat(settings.holdingsAmount);
      const plElement = document.getElementById("profitAndLoss");

      if (!isNaN(holdingsPrice) && !isNaN(holdingsAmount) && goldData.price) {
        const currentPrice = parseFloat(goldData.price);
        const profit = (currentPrice - holdingsPrice) * holdingsAmount;
        plElement.textContent = profit >= 0 ? `+${profit.toFixed(2)}` : profit.toFixed(2);
        this.setChangeColor(plElement, profit);
      } else {
        if (plElement) {
          plElement.textContent = "--";
          plElement.className = "value neutral";
        }
      }
    });
  }

  setChangeColor(element, value) {
    const numValue = parseFloat(value);
    if (numValue > 0) {
      element.className = "value price-up";
    } else if (numValue < 0) {
      element.className = "value price-down";
    } else {
      element.className = "value neutral";
    }
  }

  showError(message) {
    console.error("显示错误:", message);
    const errorElement = document.getElementById("errorMessage");
    errorElement.textContent = message;
    errorElement.style.display = "block";

    document.getElementById("price").textContent = "--";
    document.getElementById("upAndDownAmt").textContent = "--";
    document.getElementById("upAndDownRate").textContent = "--";
    document.getElementById("yesterdayPrice").textContent = "--";
    document.getElementById("profitAndLoss").textContent = "--";
    document.getElementById("updateTime").textContent = "--";

    document.getElementById("status").textContent = "连接失败";
    document.getElementById("status").style.color = "#e74c3c";
  }

  hideError() {
    document.getElementById("errorMessage").style.display = "none";
  }

  openSettings() {
    this.sendMessage({ action: 'getSettings' }).then((settings) => {
      settings = settings || {};
      document.getElementById('apiKeyInput').value = settings.apiKey || '';
      document.getElementById('alertHighInput').value = settings.alertHigh || '';
      document.getElementById('alertLowInput').value = settings.alertLow || '';
      document.getElementById('holdingsPriceInput').value = settings.holdingsPrice || '';
      document.getElementById('holdingsAmountInput').value = settings.holdingsAmount || '';
      document.getElementById('availableCapitalInput').value = settings.availableCapital || '';
      document.getElementById('settingsModal').style.display = 'flex';
    });
  }

  closeSettings() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const alertHigh = document.getElementById('alertHighInput').value.trim();
    const alertLow = document.getElementById('alertLowInput').value.trim();
    const holdingsPrice = document.getElementById('holdingsPriceInput').value.trim();
    const holdingsAmount = document.getElementById('holdingsAmountInput').value.trim();
    const availableCapital = document.getElementById('availableCapitalInput').value.trim();

    const settings = {
      apiKey,
      alertHigh,
      alertLow,
      holdingsPrice,
      holdingsAmount,
      availableCapital
    };

    this.sendMessage({ action: 'saveSettings', settings }).then(() => {
      const btn = document.getElementById('saveSettingsBtn');
      const originalText = btn.textContent;
      btn.textContent = '已保存！';
      btn.style.background = '#2ecc71';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#0ea5e9';
        this.closeSettings();
        this.loadGoldData();
      }, 1000);
    });
  }

  async runAIAnalysis() {
    const aiBtn = document.getElementById('aiBtn');
    const aiResult = document.getElementById('aiResult');
    const aiContent = document.getElementById('aiContent');

    // 检查API Key
    const settings = await this.sendMessage({ action: 'getSettings' });
    const apiKey = settings?.apiKey;
    const holdingsPrice = settings?.holdingsPrice;
    const holdingsAmount = settings?.holdingsAmount;
    const availableCapital = settings?.availableCapital;

    if (!apiKey) {
      alert("请先在设置中配置 DeepSeek API Key");
      this.openSettings();
      return;
    }

    aiBtn.disabled = true;
    aiBtn.textContent = '分析中...';
    aiResult.style.display = 'none';

    try {
      // 获取最新金价数据
      const goldData = await this.sendMessage({ action: 'getGoldData' });

      if (!goldData || !goldData.success) {
        throw new Error("无有效的金价数据，无法分析");
      }

      // 1. 梳理账户净数据
      let accountStatus = "";
      let strategyFocus = "";
      const capitalStr = availableCapital ? `可用闲置资金: ${availableCapital}元` : "可用闲置资金: 未知";

      if (holdingsPrice && holdingsAmount) {
        accountStatus = `【当前持仓】买入均价: ${holdingsPrice}元/克 | 持有量: ${holdingsAmount}克 | ${capitalStr}`;
        strategyFocus = "重点分析当前现价与买入均价的差距。如果被套，请直白说明是在支撑位用闲置资金补仓摊平亏损，还是止损；如果盈利，请给出逢高卖出获利了结的具体目标价和克数；如果在成本价附近震荡，请建议耐心持有。";
      } else if (holdingsPrice) {
        accountStatus = `【当前持仓】买入均价: ${holdingsPrice}元/克 | 持有量: 未知 | ${capitalStr}`;
        strategyFocus = "重点基于买入均价给出策略。明确提示到什么价格可以加仓拉低成本，到什么价格应该减仓落袋为安。";
      } else {
        accountStatus = `【当前空仓】${capitalStr}`;
        strategyFocus = "重点寻找高确定性的入场机会。如果当前价格偏高，请直白建议“空仓观望”；如果遇到较好的下跌回调，请给出具体在哪个价位买入、买入多少资金。";
      }

      // 2. 构造直白、逻辑清晰的 Prompt
      const prompt = `
【实时行情】
- 现价：${goldData.price} 元/克 (昨收: ${goldData.yesterdayPrice} 元/克)
- 今日涨跌：${goldData.upAndDownAmt} 元 (${goldData.upAndDownRate})

【账户情况】
- ${accountStatus}

【分析与策略要求】
1. 用户的“可用闲置资金”是专门用于炒金的钱。只要遇到了胜率极高、价格极具性价比的下跌位置，**允许建议动用最高100%的资金买入**，绝对不要出现“单品种不要超过总资产30%”这种刻板废话。
2. 语言必须**直白、接地气、通俗易懂**，像有经验的老师傅带徒弟一样。绝对禁止使用“持仓熬鹰”、“左侧接多”、“做T”等生僻生硬的交易黑话。
3. ${strategyFocus}

请严格按照以下4个模块输出你的分析和建议（总字数控制在500字以内）：

📊 【盘面简析】：用一两句话向普通人解释一下今天的涨跌意味着什么，处于什么状态（比如大涨后的回调、阴跌寻底等）。
🎯 【操作建议】：直接给出结论。买不买？卖不卖？继续拿还是立刻走？如果建议买卖，请明确给出动用多少可用资金（如50%、100%）。
🛡️ 【关键价位】：给出接下来最需要关注的一个上涨阻力位（元/克）和一个下跌支撑位（元/克）。
⚠️ 【风险提醒】：针对当前操作的一句大实话提醒（比如：跌破XX元必须认赔出局，千万别死扛；或者，目前追高风险极大等）。`;

      aiContent.innerHTML = '<div style="color:#64748b; font-size:14px;">正在结合盘面与您的仓位生成最新策略...</div>';
      aiResult.style.display = 'block';

      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              // 调整系统人设：从“冷酷”变为“专业且接地气的实战教练”
              role: 'system',
              content: '你是一位拥有10年一线实战经验的贵金属分析师。你的风格是：逻辑严密、极其务实、用词大白话、拒绝模棱两可。你的目标是让完全不懂专业术语的普通投资者也能看懂何时买、何时卖、买多少。'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.5, // 0.5 既能保证逻辑严谨，又能让语言表达比较自然流畅
          max_tokens: 800,  // 放大 token 限制，确保 500 字的中文能完整生成不断尾
          stream: true
        })
      });

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let partialLine = "";
      let fullResponseText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop();

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullResponseText += content;

                // 正则处理：把 Markdown 的 **加粗** 转换为 HTML 样式，并处理换行
                let formattedText = fullResponseText
                  .replace(/\*\*(.*?)\*\*/g, '<b style="color: #0f172a; font-weight: 700;">$1</b>')
                  .replace(/\n/g, '<br>');

                aiContent.innerHTML = formattedText;
              }
            } catch (e) {
              console.warn("解析流数据片段出错", e, dataStr);
            }
          }
        }
      }

    } catch (error) {
      console.error("AI 分析失败:", error);
      alert(`AI 分析失败: ${error.message}`);
    } finally {
      aiBtn.disabled = false;
      aiBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>AI 分析';
    }
  }

  sendMessage(message) {
    return new Promise((resolve, reject) => {
      console.log("发送消息到 VS Code:", message);
      const actionName = message.action + 'Response';
      
      const listener = (event) => {
        const data = event.data;
        if (data && data.action === actionName) {
          window.removeEventListener('message', listener);
          console.log("收到 VS Code 响应:", data);
          
          if (message.action === 'getGoldData') resolve(data.goldData);
          else if (message.action === 'manualRefresh') resolve(data.result);
          else if (message.action === 'getSettings') resolve(data.settings);
          else if (message.action === 'saveSettings') resolve(data.success);
          else resolve(data);
        }
      };
      
      window.addEventListener('message', listener);
      if (window.vscodeApi) {
        window.vscodeApi.postMessage(message);
      } else {
        console.warn("vscodeApi 未初始化");
      }
      
      setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error("VS Code 响应超时: " + message.action));
      }, 5000);
    });
  }
}

// 页面加载完成后初始化
document.addEventListener("DOMContentLoaded", () => {
  console.log("Popup页面加载完成");
  new GoldPriceMonitor();
});

// 添加错误监听
window.addEventListener("error", (event) => {
  console.error("全局错误:", event.error);
});
