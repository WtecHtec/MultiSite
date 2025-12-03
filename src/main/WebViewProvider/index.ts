import { shell, BrowserWindow, WebContentsView } from "electron";
import { ensureSessionUA, injectAntiDetection } from "./common";

type AiProvider = { id: string; name: string; url: string; handler?: string };

export function createAiView(ai: AiProvider, mainWindow: BrowserWindow,  patchedPartitions: Set<string>): WebContentsView {
    const partition = `persist:${ai.id}`;
    ensureSessionUA(partition, patchedPartitions);
  
    const view = new WebContentsView({
      webPreferences: {
        partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        webSecurity: true,
      },
    });
  
    // 使用 CDP 注入反检测脚本（在所有页面脚本执行前生效）
    view.webContents.once('did-start-loading', () => {
      injectAntiDetection(view.webContents).catch(() => {});
    });
  
    // 加载默认入口
    try {
      view.webContents.loadURL(ai.url);
    } catch (e) {
      // 忽略加载异常，后续可上报给渲染器
    }
  
    // 处理登录弹窗：对 accounts.google.com 使用同分区的原生窗口进行登录
    try {
      view.webContents.setWindowOpenHandler((details) => {
        const url = details?.url || '';
        let host = '';
        try { host = new URL(url).hostname; } catch {}
        if (host.endsWith('accounts.google.com') || host.endsWith('id.google.com')) {
          // 在同分区创建一个模态登录窗口，完成后关闭并回到原视图
          const loginWin = new BrowserWindow({
            parent: mainWindow ?? undefined,
            modal: !!mainWindow,
            show: true,
            width: 900,
            height: 680,
            autoHideMenuBar: true,
            webPreferences: {
              partition,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
              webSecurity: true,
            },
          });
  
          // 使用 CDP 注入反检测脚本
          loginWin.webContents.once('did-start-loading', () => {
            injectAntiDetection(loginWin.webContents).catch(() => {});
          });
  
          const maybeClose = (nextUrl: string) => {
            if (!nextUrl) return;
            // 登录完成通常会跳回 gemini.google.com/app 或 google.com
            if (nextUrl.startsWith('https://gemini.google.com') || nextUrl.includes('gemini.google.com/app')) {
              try { loginWin.close(); } catch {}
              // 重新加载原视图，利用同分区下的已设置 Cookie
              try { view.webContents.loadURL(ai.url); } catch {}
            }
          };
  
          loginWin.webContents.on('will-redirect', (_e, nextUrl) => {
            maybeClose(nextUrl);
          });
          loginWin.webContents.on('did-navigate', (_e, nextUrl) => {
            maybeClose(nextUrl);
          });
  
          try { loginWin.loadURL(url); } catch {}
          return { action: 'deny' };
        }
  
        // 其它新窗口统一外部打开，避免遮挡
        try { shell.openExternal(url); } catch {}
        return { action: 'deny' };
      });
    } catch {}
  
    return view;
}

export  function applyLayout(mainWindow: BrowserWindow, view: WebContentsView, workspaceBounds: { x: number; y: number; width: number; height: number }) {
    if (!mainWindow) return;
    mainWindow.contentView.addChildView(view);
    view.setBounds({
      x: workspaceBounds.x,
      y: workspaceBounds.y,
      width: workspaceBounds.width,
      height: workspaceBounds.height,
    });
}