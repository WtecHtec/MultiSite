import { ipcMain, BrowserWindow } from 'electron';
import { PageWorkflow, Workflow, PageWorkflowStep, Action } from '../../common/types';

interface ExecutionPayload {
  pageWorkflow: PageWorkflow;
  workflow: Workflow;
  values: Record<string, any>;
}

const generateScript = (pageWorkflow: PageWorkflow, values: Record<string, any>) => {
  const stepsJson = JSON.stringify(pageWorkflow.steps);
  const valuesJson = JSON.stringify(values);

  return `
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
                    el.value = stepValue;
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                  } else if (action.mode === 'type') {
                    el.focus();
                    el.value = '';
                    for (const char of String(stepValue)) {
                      document.execCommand('insertText', false, char);
                      await sleep(50);
                    }
                  } else if (action.mode === 'inner_text') {
                    el.innerText = stepValue;
                  }
                  break;
                
                case 'click':
                  el.click();
                  break;
                
                case 'select':
                  el.value = stepValue;
                  el.dispatchEvent(new Event('change', { bubbles: true }));
                  break;

                // Add more action types as needed
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
};

export const ipcHandleExecution = () => {
  ipcMain.handle('execution:start', async (_event, payload: ExecutionPayload) => {
    const { pageWorkflow, values } = payload;
    
    const win = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false, // Sometimes needed for cross-origin iframes etc, but use with caution
      },
    });

    win.loadURL(pageWorkflow.url);

    win.webContents.on('did-finish-load', async () => {
      const script = generateScript(pageWorkflow, values);
      try {
        await win.webContents.executeJavaScript(script);
      } catch (err) {
        console.error('Failed to inject script:', err);
      }
    });

    return true;
  });
};
