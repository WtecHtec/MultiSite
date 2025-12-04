import React, { useEffect, useState } from 'react';
import {
  Button,
  Select,
  Form,
  Input,
  Card,
  message,
  DatePicker,
  Upload,
} from 'antd';
import { PlayCircleOutlined, UploadOutlined } from '@ant-design/icons';
import { PageWorkflow, Workflow, WorkflowStep } from '../../common/types';

export default function ExecutionPage() {
  const [pageWorkflows, setPageWorkflows] = useState<PageWorkflow[]>([]);
  const [publicWorkflows, setPublicWorkflows] = useState<Workflow[]>([]);
  const [selectedPageWorkflow, setSelectedPageWorkflow] = useState<PageWorkflow | null>(null);
  const [relatedWorkflow, setRelatedWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [pw, w] = await Promise.all([
        window.electron.ipcRenderer.invoke('page-workflow:get-all'),
        window.electron.ipcRenderer.invoke('workflow:get-all'),
      ]);
      setPageWorkflows(pw || []);
      setPublicWorkflows(w || []);
    } catch (error) {
      message.error('Failed to load data');
    }
  };

  const handlePageWorkflowChange = (id: string) => {
    const pw = pageWorkflows.find(p => p.id === id);
    setSelectedPageWorkflow(pw || null);
    if (pw) {
      const w = publicWorkflows.find(wf => wf.id === pw.workflowId);
      setRelatedWorkflow(w || null);
      form.resetFields();
    } else {
      setRelatedWorkflow(null);
    }
  };

  const handleExecute = async () => {
    if (!selectedPageWorkflow || !relatedWorkflow) return;

    try {
      const values = await form.validateFields();
      setLoading(true);
      
      await window.electron.ipcRenderer.invoke('execution:start', {
        pageWorkflow: selectedPageWorkflow,
        workflow: relatedWorkflow,
        values,
      });
      
      message.success('Execution started');
    } catch (error) {
      console.error(error);
      message.error('Failed to start execution');
    } finally {
      setLoading(false);
    }
  };

  const renderFormItem = (step: WorkflowStep) => {
    const label = step.desc || step.type;
    const name = step.id;

    switch (step.type) {
      case 'input':
        return (
          <Form.Item label={label} name={name} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        );
      case 'date':
        return (
          <Form.Item label={label} name={name} rules={[{ required: true }]}>
            <DatePicker className="w-full" />
          </Form.Item>
        );
      case 'select':
        return (
          <Form.Item label={label} name={name} rules={[{ required: true }]}>
            <Select options={[]} mode="tags" tokenSeparators={[',']} placeholder="Enter options or values" />
          </Form.Item>
        );
       case 'upload':
        return (
          <Form.Item label={label} name={name} valuePropName="fileList" getValueFromEvent={(e) => {
             if (Array.isArray(e)) return e;
             return e?.fileList;
          }}>
            <Upload beforeUpload={() => false}>
                <Button icon={<UploadOutlined />}>Click to Upload</Button>
            </Upload>
          </Form.Item>
        );
      case 'click':
      default:
        // Click usually doesn't need input, but maybe we want to confirm?
        // Or maybe it's conditional? For now, skip input for click unless desc implies it.
        // Actually, if it's just a click action in the workflow, we don't need user input on this form,
        // unless the click depends on some condition.
        // But the user request says "fill corresponding form".
        // If step is "click", maybe we just show it as info?
        return null;
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6">Execute Workflow</h1>

      <Card className="mb-6">
        <Form layout="vertical">
          <Form.Item label="Select Page Workflow">
            <Select
              onChange={handlePageWorkflowChange}
              options={pageWorkflows.map(pw => ({ label: pw.title, value: pw.id }))}
              placeholder="Choose a workflow to execute"
            />
          </Form.Item>
        </Form>
      </Card>

      {selectedPageWorkflow && relatedWorkflow && (
        <Card title={selectedPageWorkflow.title}>
          <Form layout="vertical" form={form} onFinish={handleExecute}>
            {relatedWorkflow.steps.map((step: WorkflowStep) => (
              <React.Fragment key={step.id}>
                {renderFormItem(step)}
              </React.Fragment>
            ))}

            <div className="mt-6">
              <Button type="primary" htmlType="submit" loading={loading} block icon={<PlayCircleOutlined />} size="large">
                Execute
              </Button>
            </div>
          </Form>
        </Card>
      )}
    </div>
  );
}
