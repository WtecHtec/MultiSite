import Store from 'electron-store';
import { Workflow, PageWorkflow, WorkflowStoreSchema } from '../common/types';

const store = new Store<WorkflowStoreSchema>({
  defaults: {
    workflows: [],
    pageWorkflows: [],
  },
});

export class WorkflowStore {
  static getWorkflows(): Workflow[] {
    return store.get('workflows') || [];
  }

  static getWorkflowById(id: string): Workflow | undefined {
    const workflows = this.getWorkflows();
    return workflows.find((w) => w.id === id);
  }

  static saveWorkflow(workflow: Workflow): void {
    const workflows = this.getWorkflows();
    const index = workflows.findIndex((w) => w.id === workflow.id);
    if (index !== -1) {
      workflows[index] = workflow;
    } else {
      workflows.push(workflow);
    }
    store.set('workflows', workflows);
  }

  static deleteWorkflow(id: string): void {
    const workflows = this.getWorkflows().filter((w) => w.id !== id);
    store.set('workflows', workflows);
  }

  static getPageWorkflows(): PageWorkflow[] {
    return store.get('pageWorkflows');
  }

  static savePageWorkflow(pageWorkflow: PageWorkflow): void {
    const pageWorkflows = this.getPageWorkflows();
    const index = pageWorkflows.findIndex((pw) => pw.id === pageWorkflow.id);
    if (index !== -1) {
      pageWorkflows[index] = pageWorkflow;
    } else {
      pageWorkflows.push(pageWorkflow);
    }
    store.set('pageWorkflows', pageWorkflows);
  }

  static deletePageWorkflow(id: string): void {
    const pageWorkflows = this.getPageWorkflows().filter((pw) => pw.id !== id);
    store.set('pageWorkflows', pageWorkflows);
  }
}
