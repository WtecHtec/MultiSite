import { app, session, } from 'electron';
import log from 'electron-log';
function getSafariUA(): string {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36`;
  }
  function getChromeUA(): string {
    return `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`;
  }

export function ensureSessionUA(partition: string , patchedPartitions: Set<string>) {
    if (patchedPartitions.has(partition)) return;
    const s = session.fromPartition(partition);
    s.webRequest.onBeforeSendHeaders((details, callback) => {
      // 只有访问 accounts.google.com 时才使用 Safari UA，其他情况使用 Chrome UA
      let ua = getChromeUA();
      try {
        const url = new URL(details.url);
        if (url.hostname.includes('accounts.google.com')) {
          ua = getSafariUA();
        }
      } catch {
        // URL 解析失败时使用默认的 Chrome UA
      }
      const headers = {
        ...details.requestHeaders,
        'User-Agent': ua,
        // 模拟真实浏览器的语言首选项，减少指纹异常
        'Accept-Language': `${app.getLocale() || 'zh-CN'},en;q=0.9`,
      };
      callback({ cancel: false, requestHeaders: headers });
    });
    patchedPartitions.add(partition);
}

/**
 * 生成完整的反检测脚本：在页面加载前注入，绕过 Cloudflare 等检测
 */
function getAntiDetectionScript(): string {
    return `
  (() => {
    // 1. 彻底移除 navigator.webdriver
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
    } catch {}
  
    // 2. 伪造 navigator.plugins（空数组是自动化特征）
    try {
      const mockPlugins = [
        { name: 'PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chromium PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Microsoft Edge PDF Viewer', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'WebKit built-in PDF', filename: 'internal-pdf-viewer', description: 'Portable Document Format' }
      ];
      Object.defineProperty(navigator, 'plugins', {
        get: () => mockPlugins,
        configurable: true
      });
    } catch {}
  
    // 3. 伪造 navigator.languages（单语言是可疑特征）
    try {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'zh-CN', 'zh'],
        configurable: true
      });
    } catch {}
  
    // 4. 修复 WebGL 渲染器指纹（屏蔽 SwiftShader/llvmpipe 等 Headless 特征）
    try {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) { // UNMASKED_VENDOR_WEBGL
          return 'Intel Inc.';
        }
        if (parameter === 37446) { // UNMASKED_RENDERER_WEBGL
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter.apply(this, arguments);
      };
    } catch {}
  
    try {
      const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
      WebGL2RenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) {
          return 'Intel Inc.';
        }
        if (parameter === 37446) {
          return 'Intel Iris OpenGL Engine';
        }
        return getParameter2.apply(this, arguments);
      };
    } catch {}
  
    // 5. 伪造 chrome 对象（部分检测会查找此对象）
    try {
      if (!window.chrome) {
        window.chrome = {
          runtime: {},
          loadTimes: function() {},
          csi: function() {},
          app: {}
        };
      }
    } catch {}
  
    // 6. 修复 permissions.query（自动化环境可能返回异常）
    try {
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) => (
        parameters.name === 'notifications' ?
          Promise.resolve({ state: Notification.permission, onchange: null }) :
          originalQuery(parameters)
      );
    } catch {}
  
    // 7. 隐藏 automation extension（Chromium 特征）
    try {
      Object.defineProperty(navigator, 'maxTouchPoints', {
        get: () => 1,
        configurable: true
      });
    } catch {}
  
    // 8. 伪造 outerWidth/outerHeight（headless 特征：与 innerWidth 完全相等）
    try {
      if (window.outerWidth === 0 || window.outerHeight === 0) {
        Object.defineProperty(window, 'outerWidth', {
          get: () => window.innerWidth,
          configurable: true
        });
        Object.defineProperty(window, 'outerHeight', {
          get: () => window.innerHeight + 85,
          configurable: true
        });
      }
    } catch {}
  })();
    `;
  }

  
/**
 * 使用 CDP 在页面脚本执行前注入反检测代码
 */
export async function injectAntiDetection(webContents: any): Promise<void> {
    const dbg = webContents.debugger;
    let attached = false;
    try {
      if (!dbg.isAttached()) {
        await dbg.attach('1.3');
        attached = true;
      }
      await dbg.sendCommand('Page.enable');
      await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', {
        source: getAntiDetectionScript()
      });
      log.info('[anti-detection] CDP script injected successfully');
    } catch (err: any) {
      log.warn(`[anti-detection] injection failed: ${String(err?.message || err)}`);
    } finally {
      // 注入后可以 detach，脚本已持久化到会话中
      if (attached && dbg.isAttached()) {
        try {
          dbg.detach();
        } catch {}
      }
    }
  }