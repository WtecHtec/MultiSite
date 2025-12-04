export interface WorkflowStep {
  id: string;
  type: 'input' | 'click' | 'select' | 'upload' | 'date';
  desc?: string;
}

export interface Workflow {
  id: string;
  title: string;
  desc?: string;
  createdAt: number;
  updatedAt: number;
  steps: WorkflowStep[];
}

export interface Action {
  type: 'input' | 'click' | 'select' | 'upload' | 'date';
  selector: string;
  delay?: number;
  mode?: string; // e.g., "type" | "set" | "inner_text"
}

export interface PageWorkflowStep {
  id: string; // Matches WorkflowStep.id
  type: string;
  desc?: string;
  value?: any;
  actions?: Action[];
}

export interface PageWorkflow {
  id: string;
  title: string;
  url: string;
  workflowId: string;
  createdAt: number;
  updatedAt: number;
  pageWorkflowId?: string; // Optional reference if needed, though 'id' might suffice
  steps: PageWorkflowStep[];
}

export interface WorkflowStoreSchema {
  workflows: Workflow[];
  pageWorkflows: PageWorkflow[];
}
