import { ipcMain, BrowserWindow, app, WebContentsView } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';
import { PageWorkflow, Workflow } from '../../common/types';
import { v4 as uuidv4 } from 'uuid';
import { createAiView, applyLayout } from '../WebViewProvider';

let runnerWindow: BrowserWindow | null = null;
// Store both the shell window and the content view
const targetWindows = new Map<string, { window: BrowserWindow; view: WebContentsView }>();
const patchedPartitions = new Set<string>();

export const ipcHandleRunner = (mainWindow: BrowserWindow) => {
  ipcMain.handle('workflow:open-runner', (_event, workflowId: string) => {
    if (runnerWindow) {
      runnerWindow.focus();
      return;
    }

    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');

    const getAssetPath = (...paths: string[]): string => {
      return path.join(RESOURCES_PATH, ...paths);
    };

    runnerWindow = new BrowserWindow({
      width: 600,
      height: 900,
      icon: getAssetPath('icon.png'),
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
      },
    });

    runnerWindow.loadURL(`${resolveHtmlPath('index.html')}#/runner?workflowId=${workflowId}`);

    runnerWindow.on('closed', () => {
      runnerWindow = null;
      // Close all target windows when runner is closed
      targetWindows.forEach(({ window }) => window.close());
      targetWindows.clear();
    });
  });

  ipcMain.handle('view:create', (_event, url: string) => {
    const windowId = uuidv4();
    
    // Create a shell window
    const win = new BrowserWindow({
      width: 1024,
      height: 768,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      }
    });

    // Create the AI View (WebContentsView)
    // Mocking AiProvider interface: { id, name, url }
    const aiProvider = {
      id: windowId,
      name: 'Target Window',
      url: url
    };

    const view = createAiView(aiProvider, win, patchedPartitions);
    
    // Attach view to window
    win.contentView.addChildView(view);
    
    // Initial layout
    const bounds = win.getContentBounds();
    view.setBounds({ x: 0, y: 0, width: bounds.width, height: bounds.height });

    // Handle resize
    win.on('resize', () => {
      const newBounds = win.getContentBounds();
      view.setBounds({ x: 0, y: 0, width: newBounds.width, height: newBounds.height });
    });
    
    win.on('closed', () => {
      console.log(`[Main] Target window ${windowId} closed`);
      targetWindows.delete(windowId);
      if (runnerWindow && !runnerWindow.isDestroyed()) {
        console.log(`[Main] Sending view:closed to runner window`);
        runnerWindow.webContents.send('view:closed', windowId);
      } else {
        console.warn(`[Main] Runner window not available to send view:closed`);
      }
    });

    targetWindows.set(windowId, { window: win, view });
    return windowId;
  });

  ipcMain.handle('view:focus', (_event, windowId: string) => {
    const target = targetWindows.get(windowId);
    if (target) target.window.focus();
  });

  ipcMain.handle('view:resize', () => {
    // No-op, handled by window resize event
  });

  ipcMain.handle('view:remove', (_event, windowId: string) => {
    const target = targetWindows.get(windowId);
    if (target) {
      target.window.close();
      targetWindows.delete(windowId);
    }
  });

  ipcMain.handle('execution:inject', async (_event, payload: { windowId: string, pageWorkflow: PageWorkflow, values: Record<string, any> }) => {
    const { windowId, pageWorkflow, values } = payload;
    const target = targetWindows.get(windowId);
    
    if (!target) throw new Error('Target window not found');
    
    const { view } = target;

    // Re-use the generation logic (we should probably extract this to a shared utility)
    const stepsJson = JSON.stringify(pageWorkflow.steps);
    const valuesJson = JSON.stringify(values);

    const script = `
      (async () => {
        const steps = ${stepsJson};
        const values = ${valuesJson};

        const sleep = (ms) => new Promise(r => setTimeout(r, ms));
        const waitForElement = async (selector, timeout = 5000) => {
          const start = Date.now();
          while (Date.now() - start < timeout) {
            const el = document.querySelector(selector);
            if (el) return el;
            await sleep(100);
          }
          return null;
        };

        console.log('Starting workflow execution...', steps);

        for (const step of steps) {
          console.log('Executing step:', step.id);
          const stepValue = values[step.id] || step.value;
          
          if (step.actions) {
            for (const action of step.actions) {
              try {
                if (action.delay) await sleep(action.delay);
                
                const el = await waitForElement(action.selector);
                if (!el) {
                  console.warn('Element not found:', action.selector);
                  continue;
                }

                switch (action.type) {
                  case 'input':
                    if (action.mode === 'set' || !action.mode) {
                      // Mode: set (Direct value assignment)
                      el.value = stepValue;
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    } else if (action.mode === 'type') {
                      // Mode: type (Simulate typing)
                      el.focus();
                      el.value = '';
                      for (const char of String(stepValue)) {
                        document.execCommand('insertText', false, char);
                        await sleep(50);
                      }
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    } else if (action.mode === 'inner_text') {
                      // Mode: inner_text (Direct innerText assignment)
                      el.innerText = stepValue;
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                    break;
                  
                  case 'click':
                    el.click();
                    break;
                  
                  case 'select':
                    if (action.mode === 'text') {
                      // Mode: text (Select by option text)
                      const option = Array.from(el.options).find(opt => opt.text === stepValue);
                      if (option) {
                        el.value = option.value;
                      }
                    } else if (action.mode === 'index') {
                      // Mode: index (Select by index)
                      const idx = parseInt(stepValue, 10);
                      if (!isNaN(idx) && el.options[idx]) {
                        el.selectedIndex = idx;
                      }
                    } else {
                      // Mode: value (Default - Select by value)
                      el.value = stepValue;
                    }
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    break;
                }
              } catch (err) {
                console.error('Error in action:', action, err);
              }
            }
          }
        }
        console.log('Workflow execution completed.');
      })();
    `;

    try {
      await view.webContents.executeJavaScript(script);
    } catch (err) {
      console.error('Failed to inject script:', err);
      throw err;
    }
  });
};
