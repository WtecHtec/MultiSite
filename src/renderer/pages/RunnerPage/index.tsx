import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Button,
  Select,
  Form,
  Input,
  message,
  DatePicker,
  Typography,
  Timeline,
  Tag,
  Space,
} from 'antd';
import { PlayCircleOutlined, DesktopOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { PageWorkflow, Workflow, WorkflowStep } from '../../common/types';

const { Title, Text } = Typography;

interface ActiveSession {
  windowId: string;
  pageWorkflow: PageWorkflow;
}

export default function RunnerPage() {
  const [searchParams] = useSearchParams();
  const workflowId = searchParams.get('workflowId');
  
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [pageWorkflows, setPageWorkflows] = useState<PageWorkflow[]>([]);
  
  // Multiple active sessions
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (workflowId) {
      loadData(workflowId);
    }

    // The preload script strips the event object, so we receive arguments directly
    const handleViewClosed = (windowId: string) => {
      console.log('[Renderer] Received view:closed for:', windowId);
      setSessions(prev => prev.filter(s => s.windowId !== windowId));
    };

    const removeListener = window.electron.ipcRenderer.on('view:closed', handleViewClosed);

    return () => {
      removeListener();
    };
  }, [workflowId]);

  const loadData = async (id: string) => {
    try {
      const targetWorkflow = await window.electron.ipcRenderer.invoke('workflow:get-by-id', id);
      setWorkflow(targetWorkflow || null);

      const allPageWorkflows = await window.electron.ipcRenderer.invoke('page-workflow:get-all');
      const related = allPageWorkflows.filter((pw: PageWorkflow) => pw.workflowId === id);
      setPageWorkflows(related);
    } catch (error) {
      console.error('RunnerPage: Failed to load data', error);
      message.error('Failed to load data');
    }
  };

  const handleOpenSession = async (pwId: string) => {
    const pw = pageWorkflows.find(p => p.id === pwId);
    if (!pw) return;

    try {
      setLoading(true);
      const windowId = await window.electron.ipcRenderer.invoke('view:create', pw.url);
      
      const newSession: ActiveSession = { windowId, pageWorkflow: pw };
      setSessions(prev => [...prev, newSession]);
      
      message.success(`Opened ${pw.title}`);
    } catch (error) {
      console.error(error);
      message.error('Failed to open site');
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSession = async (windowId: string) => {
    try {
      await window.electron.ipcRenderer.invoke('view:remove', windowId);
      setSessions(prev => prev.filter(s => s.windowId !== windowId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleExecute = async () => {
    if (sessions.length === 0) {
      message.warning('Please open at least one target website.');
      return;
    }

    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // Broadcast execution to all open sessions
      const promises = sessions.map(session => 
        window.electron.ipcRenderer.invoke('execution:inject', {
          windowId: session.windowId,
          pageWorkflow: session.pageWorkflow,
          values,
        })
      );

      await Promise.all(promises);
      
      message.success(`Execution started on ${sessions.length} windows`);
    } catch (error) {
      console.error(error);
      message.error('Failed to execute');
    } finally {
      setLoading(false);
    }
  };

  const renderFormItem = (step: WorkflowStep) => {
    const label = step.desc || step.type;
    const name = step.id;
    
    // Only render inputs for specific types
    if (!['input', 'date', 'select'].includes(step.type)) {
      return null;
    }

    let inputNode = <Input placeholder={`Enter ${label}`} variant="filled" />;

    if (step.type === 'date') {
      inputNode = <DatePicker className="w-full" variant="filled" />;
    } else if (step.type === 'select') {
      inputNode = <Select options={[]} mode="tags" tokenSeparators={[',']} placeholder="Enter options" variant="filled" />;
    }

    return (
      <Form.Item name={name} rules={[{ required: true }]} noStyle>
        {inputNode}
      </Form.Item>
    );
  };

  if (!workflow) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex h-screen flex-col bg-white">
      <div className="p-4 border-b bg-gray-50">
        <Title level={4} className="mb-1">{workflow.title}</Title>
        <Text type="secondary" className="block mb-4">{workflow.desc}</Text>

        <div className="flex gap-2 items-center mb-2">
          <Select
            className="flex-1"
            placeholder="Select a target to open"
            onChange={handleOpenSession}
            options={pageWorkflows.map(pw => ({ label: `${pw.title} (${pw.url})`, value: pw.id }))}
            value={null}
          />
        </div>

        {/* Active Targets List */}
        {sessions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {sessions.map(session => (
              <Tag 
                key={session.windowId} 
                color="blue" 
                closable 
                onClose={() => handleCloseSession(session.windowId)}
                icon={<DesktopOutlined />}
                className="py-1 my-2 px-2 flex items-center"
              >
                {session.pageWorkflow.title}
              </Tag>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Form layout="vertical" form={form} onFinish={handleExecute}>
          <Timeline
            items={workflow.steps.map((step) => {
              const formItem = renderFormItem(step);
              return {
                dot: <PlayCircleOutlined className="text-blue-500" />,
                children: (
                  <div className="mb-8">
                    <div className="mb-1 font-medium text-gray-700">{step.desc || `Step: ${step.id}`}</div>
                    {formItem && (
                      <div className="mt-1">
                        {formItem}
                      </div>
                    )}
                  </div>
                ),
              };
            })}
          />

          <div className="sticky bottom-0 bg-white pt-4 border-t mt-4">
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading} 
              block 
              icon={<PlayCircleOutlined />} 
              size="large"
              disabled={sessions.length === 0}
            >
              {sessions.length > 0 
                ? `Execute on ${sessions.length} Active Window${sessions.length > 1 ? 's' : ''}` 
                : 'Open a target to execute'}
            </Button>
          </div>
        </Form>
      </div>
    </div>
  );
}
