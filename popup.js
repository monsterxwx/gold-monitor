class GoldPriceMonitor {
  constructor() {
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadGoldData();
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
    document.getElementById("updateTime").textContent = "--";

    document.getElementById("status").textContent = "连接失败";
    document.getElementById("status").style.color = "#e74c3c";
  }

  hideError() {
    document.getElementById("errorMessage").style.display = "none";
  }

  openSettings() {
    chrome.storage.local.get(['settings'], (result) => {
      const settings = result.settings || {};
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

    chrome.storage.local.set({ settings }, () => {
      const btn = document.getElementById('saveSettingsBtn');
      const originalText = btn.textContent;
      btn.textContent = '已保存！';
      btn.style.background = '#2ecc71';
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '#0ea5e9';
        this.closeSettings();
      }, 1000);
    });
  }

  async runAIAnalysis() {
    const aiBtn = document.getElementById('aiBtn');
    const aiResult = document.getElementById('aiResult');
    const aiContent = document.getElementById('aiContent');

    // 检查API Key
    const settingsResult = await new Promise(resolve => chrome.storage.local.get(['settings'], resolve));
    const apiKey = settingsResult.settings?.apiKey;
    const holdingsPrice = settingsResult.settings?.holdingsPrice;
    const holdingsAmount = settingsResult.settings?.holdingsAmount;
    const availableCapital = settingsResult.settings?.availableCapital;

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
      const dataResult = await new Promise(resolve => chrome.storage.local.get(['goldData'], resolve));
      const goldData = dataResult.goldData;

      if (!goldData || !goldData.success) {
        throw new Error("无有效的金价数据，无法分析");
      }
      let holdingsInfo = "【空仓或未知】用户未提供持仓数据。";
      let actionConstraint = "根据用户可用资金，给出明确的建仓仓位比例建议（例如建议动用可用资金的20%建仓）。如果当前点位不适合建仓，请明确建议「空仓观望」。";
      let capitalContext = availableCapital ? `用户的可用闲置资金为：${availableCapital} 元。` : "用户未提供闲置资金额度。";

      if (holdingsPrice && holdingsAmount) {
        holdingsInfo = `【持有黄金】买入均价：${holdingsPrice} 元/克，当前持仓：${holdingsAmount} 克。${capitalContext}`;
        actionConstraint = `请严格基于当前的盈亏比和资金利用效率，给出明确的网格/趋势交易策略：
  - 若处于横盘窄幅震荡（距离成本价1%内），指令：【持仓熬鹰】，说明主力资金意图，切忌乱动。
  - 若遇急速下杀触及强支撑且【资金充足】，指令：【分批左侧接多】，明确给出应动用总资金的百分之几（如动用10%买入XX克）平摊成本，并给出第二强支撑的防守位。
  - 若快速拉升且遇强阻力，指令：【梯次止盈做T】，给出建议逢高减仓的具体克数或比例，锁定利润。`;
      } else if (holdingsPrice) {
        holdingsInfo = `【持有黄金】买入均价：${holdingsPrice} 元/克，持仓量未知。${capitalContext}`;
        actionConstraint = "给出基于盈亏的安全边际建议：下杀至支撑位时主推【左侧低吸平摊成本】（结合剩余资金）；阻力位附近主推【逢高减仓】；其余垃圾时间主推【空仓/持仓观望】。";
      } else if (availableCapital) {
        holdingsInfo = `【空仓或未知】用户未提供持仓数据。${capitalContext}`;
      }

      const prompt = `你是一家顶级对冲基金的首席贵金属操盘手。请基于真实的盘面数据与用户头寸，输出机构级别的日内操作指令。

### 实时盘口与账户状态
- 现价：${goldData.price} 元/克 | 较昨收：${goldData.upAndDownAmt} 元 (${goldData.upAndDownRate})
- 昨收：${goldData.yesterdayPrice} 元/克
- 账户：${holdingsInfo}

### 任务说明
请输出高度浓缩的3段实战口令（总字数严控在180字内），拒绝散户情绪，采取绝对的机构理性思维：

1. 核心操作指令：${actionConstraint} （当前属于什么行情阶段？给出带明确数字的买卖/持有建议及资金分配比例）
2. 关键攻防位：精确指出当前最合理的建仓/防守支撑位（元/克）和抛压阻力位（元/克），并说明盈亏比。
3. 纪律与风控：一句话的铁血交易纪律提醒（如宏观风险、仓位红线或止损底线）。`;

      aiContent.innerHTML = '';
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
            { role: 'system', content: '你是一个具有10年实盘经验的顶级专业贵金属短线交易员，擅长通过价格异动精准制定支撑/阻力位及仓位管理策略。' },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 350,
          stream: true
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${errorText}`);
      }

      // 处理流式响应
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let partialLine = "";
      let fullResponseText = ""; // 新增：保存完整的返回文本以便正则替换

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialLine + chunk).split('\n');
        partialLine = lines.pop(); // 最后一行可能是不完整的

        for (const line of lines) {
          if (line.trim() === '') continue;
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            if (dataStr === '[DONE]') break;

            try {
              const data = JSON.parse(dataStr);
              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                const content = data.choices[0].delta.content;
                fullResponseText += content; // 累加

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
      console.log("发送消息:", message);

      chrome.runtime.sendMessage(message, (response) => {
        console.log("收到响应:", response);

        if (chrome.runtime.lastError) {
          console.error("消息发送错误:", chrome.runtime.lastError);
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response) {
          resolve(response);
        } else {
          reject(new Error("未收到响应"));
        }
      });
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
