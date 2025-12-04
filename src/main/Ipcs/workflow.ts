import { ipcMain } from 'electron';
import { WorkflowStore } from '../store';
import { Workflow, PageWorkflow } from '../../common/types';

export const ipcHandleWorkflow = () => {
  ipcMain.handle('workflow:get-all', () => {
    console.log('IPC: workflow:get-all called');
    try {
      return WorkflowStore.getWorkflows();
    } catch (e) {
      console.error('Error in workflow:get-all:', e);
      throw e;
    }
  });

  ipcMain.handle('workflow:get-by-id', (_event, id: string) => {
    console.log('IPC: workflow:get-by-id called with id:', id);
    return WorkflowStore.getWorkflowById(id);
  });

  ipcMain.handle('workflow:save', (_event, workflow: Workflow) => {
    WorkflowStore.saveWorkflow(workflow);
    return true;
  });

  ipcMain.handle('workflow:delete', (_event, id: string) => {
    WorkflowStore.deleteWorkflow(id);
    return true;
  });

  ipcMain.handle('page-workflow:get-all', () => {
    return WorkflowStore.getPageWorkflows();
  });

  ipcMain.handle('page-workflow:save', (_event, pageWorkflow: PageWorkflow) => {
    WorkflowStore.savePageWorkflow(pageWorkflow);
    return true;
  });

  ipcMain.handle('page-workflow:delete', (_event, id: string) => {
    WorkflowStore.deletePageWorkflow(id);
    return true;
  });
};
