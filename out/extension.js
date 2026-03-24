"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const GOLD_API_URL = "https://api.jdjygold.com/gw2/generic/jrm/h5/m/stdLatestPrice?productSku=1961543816";
const REFRESH_INTERVAL = 30000; // 30s
let statusBarItem;
let currentPanel = undefined;
function activate(context) {
    console.log('"vscode-gold-monitor" is now active!');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'gold-monitor.showUI';
    context.subscriptions.push(statusBarItem);
    statusBarItem.show();
    // 初始获取一次数据
    fetchGoldPrice(context);
    // 开启定时器
    const interval = setInterval(() => {
        fetchGoldPrice(context);
    }, REFRESH_INTERVAL);
    context.subscriptions.push({ dispose: () => clearInterval(interval) });
    context.subscriptions.push(vscode.commands.registerCommand('gold-monitor.showUI', () => {
        if (currentPanel) {
            currentPanel.reveal(vscode.ViewColumn.One);
        }
        else {
            currentPanel = vscode.window.createWebviewPanel('goldMonitor', '黄金猎手', vscode.ViewColumn.One, {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))]
            });
            const htmlPath = path.join(context.extensionPath, 'src', 'webview', 'popup.html');
            let html = fs.readFileSync(htmlPath, 'utf8');
            // 替换静态资源路径
            const scriptPathOnDisk = vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview', 'popup.js'));
            const scriptUri = currentPanel.webview.asWebviewUri(scriptPathOnDisk);
            html = html.replace('src="popup.js"', `src="${scriptUri}"`);
            // 为了避免 CSP 问题并注入 VS Code API，部分替换原来的 html
            // Webview 需要有权限运行脚本
            html = html.replace('<head>', `<head>
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https:; script-src 'nonce-webview' 'unsafe-eval' https:; style-src 'unsafe-inline' https:; connect-src https:;">
                `);
            // 把原本的 script 标签加上 nonce
            html = html.replace('<script src=', '<script nonce="webview" src=');
            // 注入 vscode API 实例对象
            html = html.replace('</body>', `
                <script nonce="webview">
                    window.vscodeApi = acquireVsCodeApi();
                </script>
                </body>`);
            currentPanel.webview.html = html;
            currentPanel.onDidDispose(() => {
                currentPanel = undefined;
            }, null, context.subscriptions);
            // 处理 Webview 传来的消息
            currentPanel.webview.onDidReceiveMessage(async (message) => {
                if (message.action === 'getGoldData') {
                    const goldData = context.globalState.get('goldData');
                    currentPanel?.webview.postMessage({ action: 'getGoldDataResponse', goldData });
                }
                else if (message.action === 'manualRefresh') {
                    const result = await fetchGoldPrice(context);
                    currentPanel?.webview.postMessage({ action: 'manualRefreshResponse', result });
                }
                else if (message.action === 'getSettings') {
                    const settings = context.globalState.get('settings') || {};
                    currentPanel?.webview.postMessage({ action: 'getSettingsResponse', settings });
                }
                else if (message.action === 'saveSettings') {
                    await context.globalState.update('settings', message.settings);
                    currentPanel?.webview.postMessage({ action: 'saveSettingsResponse', success: true });
                    // Trigger immediate refresh to update UI based on new settings
                    fetchGoldPrice(context);
                }
            });
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand('gold-monitor.refreshPrice', () => {
        fetchGoldPrice(context);
        vscode.window.showInformationMessage('正在刷新金价...');
    }));
}
// 记录上一次提醒的价格和时间，以防重复轰炸
let lastAlert = {
    type: '',
    time: 0
};
async function fetchGoldPrice(context) {
    try {
        const response = await fetch(GOLD_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
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
            await context.globalState.update('goldData', goldData);
            // 更新状态栏
            updateStatusBar(goldData.price, goldData.upAndDownRate);
            checkPriceAlerts(context, parseFloat(goldData.price));
            // 如果面板打开着，推送更新数据
            if (currentPanel) {
                currentPanel.webview.postMessage({ action: 'updatePrice', goldData });
            }
            return { success: true };
        }
        else {
            throw new Error("API返回数据格式错误");
        }
    }
    catch (error) {
        console.error("获取金价失败:", error);
        statusBarItem.text = `💰 获取失败`;
        statusBarItem.color = new vscode.ThemeColor('errorForeground');
        return { success: false, error: error.message };
    }
}
function updateStatusBar(price, rate) {
    statusBarItem.text = `💰 ${price}`;
    const rateNum = parseFloat(rate.replace('%', ''));
    if (rateNum >= 0) {
        // Red color for up (following Chinese stock market convention)
        statusBarItem.color = '#ef4444';
        statusBarItem.text = `💰 ${price} \u2191`; // up arrow
    }
    else {
        // Green color for down
        statusBarItem.color = '#10b981';
        statusBarItem.text = `💰 ${price} \u2193`; // down arrow
    }
}
async function checkPriceAlerts(context, currentPrice) {
    const settings = context.globalState.get('settings') || {};
    const alertHigh = parseFloat(settings.alertHigh);
    const alertLow = parseFloat(settings.alertLow);
    const now = new Date().getTime();
    const COOLDOWN_MS = 10 * 60 * 1000;
    if (!isNaN(alertHigh) && alertHigh > 0 && currentPrice >= alertHigh) {
        if (lastAlert.type === 'high' && (now - lastAlert.time) < COOLDOWN_MS) {
            // cooling down
        }
        else {
            vscode.window.showWarningMessage(`金价飙升提醒: 当前金价 ${currentPrice} 元/克，已达到或超过您设定的目标高价 ${alertHigh} 元/克！考虑减仓。`, '查看面板').then(selection => {
                if (selection === '查看面板') {
                    vscode.commands.executeCommand('gold-monitor.showUI');
                }
            });
            lastAlert = { type: 'high', time: now };
        }
    }
    if (!isNaN(alertLow) && alertLow > 0 && currentPrice <= alertLow) {
        if (lastAlert.type === 'low' && (now - lastAlert.time) < COOLDOWN_MS) {
            // cooling down
        }
        else {
            vscode.window.showInformationMessage(`金价下跌提醒: 当前金价 ${currentPrice} 元/克，已达到或低于您设定的目标低价 ${alertLow} 元/克！考虑加仓。`, '查看面板').then(selection => {
                if (selection === '查看面板') {
                    vscode.commands.executeCommand('gold-monitor.showUI');
                }
            });
            lastAlert = { type: 'low', time: now };
        }
    }
}
//# sourceMappingURL=extension.js.map