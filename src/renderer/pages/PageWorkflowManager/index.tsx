import React, { useEffect, useState } from 'react';
import {
  Button,
  Table,
  Modal,
  Form,
  Input,
  Select,
  Space,
  message,
  Card,
  Divider,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { Workflow, PageWorkflow, PageWorkflowStep, Action, WorkflowStep } from '../../common/types';

export default function PageWorkflowManager() {
  const [pageWorkflows, setPageWorkflows] = useState<PageWorkflow[]>([]);
  const [publicWorkflows, setPublicWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<PageWorkflow | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);

  const [form] = Form.useForm();

  useEffect(() => {
    load();
    loadPublicWorkflows();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('page-workflow:get-all');
      setPageWorkflows(data || []);
    } catch (error) {
      message.error('Failed to load page workflows');
    } finally {
      setLoading(false);
    }
  };

  const loadPublicWorkflows = async () => {
    try {
      const data = await window.electron.ipcRenderer.invoke('workflow:get-all');
      setPublicWorkflows(data || []);
    } catch (error) {
      console.error('Failed to load public workflows');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setSelectedWorkflowId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (record: PageWorkflow) => {
    setEditing(record);
    setSelectedWorkflowId(record.workflowId);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleWorkflowChange = (workflowId: string) => {
    setSelectedWorkflowId(workflowId);
    const workflow = publicWorkflows.find(w => w.id === workflowId);
    if (workflow) {
      // Pre-fill steps from public workflow
      const steps = workflow.steps.map((step: WorkflowStep) => ({
        id: step.id,
        type: step.type,
        desc: step.desc,
        actions: [],
      }));
      form.setFieldsValue({ steps });
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const now = Date.now();
      
      const pageWorkflow: PageWorkflow = {
        id: editing ? editing.id : `pw_${now}`,
        createdAt: editing ? editing.createdAt : now,
        updatedAt: now,
        ...values,
      };

      await window.electron.ipcRenderer.invoke('page-workflow:save', pageWorkflow);
      message.success('Saved successfully');
      setModalVisible(false);
      load();
    } catch (error) {
      console.error(error);
      message.error('Failed to save');
    }
  };

  const remove = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('page-workflow:delete', id);
      message.success('Deleted successfully');
      load();
    } catch (error) {
      message.error('Failed to delete');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Title', dataIndex: 'title' },
    { title: 'URL', dataIndex: 'url' },
    { title: 'Workflow ID', dataIndex: 'workflowId' },
    {
      title: 'Actions',
      render: (_: any, record: PageWorkflow) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            Edit
          </Button>
          <Button danger type="link" icon={<DeleteOutlined />} onClick={() => remove(record.id)}>
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Page Workflows</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Create Page Workflow
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={pageWorkflows}
      />

      <Modal
        title={editing ? 'Edit Page Workflow' : 'Create Page Workflow'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={save}
        width={900}
      >
        <Form layout="vertical" form={form}>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              label="Title"
              name="title"
              rules={[{ required: true, message: 'Please enter title' }]}
            >
              <Input placeholder="e.g., Amazon Product Review" />
            </Form.Item>
            <Form.Item
              label="Target URL"
              name="url"
              rules={[{ required: true, message: 'Please enter URL' }]}
            >
              <Input placeholder="https://www.amazon.com/..." />
            </Form.Item>
          </div>

          <Form.Item
            label="Bind Public Workflow"
            name="workflowId"
            rules={[{ required: true, message: 'Please select a workflow' }]}
          >
            <Select
              onChange={handleWorkflowChange}
              options={publicWorkflows.map(w => ({ label: w.title, value: w.id }))}
              disabled={!!editing} // Disable changing workflow type after creation to avoid step mismatch
            />
          </Form.Item>

          {selectedWorkflowId && !editing && (
            <Form.Item label="Copy Configuration from (Optional)">
              <Select
                placeholder="Select an existing page workflow to copy steps from"
                allowClear
                onChange={(value) => {
                  if (!value) {
                    // Reset to default public workflow steps
                    handleWorkflowChange(selectedWorkflowId);
                    return;
                  }
                  const source = pageWorkflows.find(p => p.id === value);
                  if (source) {
                    form.setFieldsValue({ steps: source.steps });
                    message.info(`Copied configuration from ${source.title}`);
                  }
                }}
                options={pageWorkflows
                  .filter(p => p.workflowId === selectedWorkflowId)
                  .map(p => ({ label: p.title, value: p.id }))
                }
              />
            </Form.Item>
          )}

          <Divider>Steps Configuration</Divider>

          <Form.List name="steps">
            {(fields) => (
              <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto">
                {fields.map(({ key, name, ...restField }) => (
                  <Card key={key} size="small" title={`Step ${name + 1}`} className="bg-gray-50">
                    <div className="grid grid-cols-2 gap-4 mb-2">
                       <Form.Item
                        {...restField}
                        name={[name, 'id']}
                        label="Step ID"
                        className="mb-0"
                      >
                        <Input disabled />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, 'type']}
                        label="Type"
                        className="mb-0"
                      >
                        <Input disabled />
                      </Form.Item>
                    </div>
                    <Form.Item
                        {...restField}
                        name={[name, 'desc']}
                        label="Description"
                        className="mb-2"
                      >
                        <Input disabled />
                    </Form.Item>

                    <Form.List name={[name, 'actions']}>
                      {(actionFields, { add: addAction, remove: removeAction }) => (
                        <div className="pl-4 border-l-2 border-blue-200">
                          <div className="mb-2 font-semibold">Actions</div>
                          {actionFields.map(({ key: actionKey, name: actionName, ...actionRest }) => (
                            <div key={actionKey} className="flex gap-2 mb-2 items-start">
                              <Form.Item
                                {...actionRest}
                                name={[actionName, 'selector']}
                                label="Selector"
                                className="mb-0 flex-1"
                                rules={[{ required: true }]}
                              >
                                <Input placeholder="#submit-btn" />
                              </Form.Item>
                              <Form.Item
                                {...actionRest}
                                name={[actionName, 'type']}
                                label="Type"
                                className="mb-0 w-24"
                                initialValue="click"
                              >
                                <Select options={['click', 'input', 'select', 'upload', 'date'].map(t => ({ label: t, value: t }))} />
                              </Form.Item>
                              <Form.Item
                                shouldUpdate={(prev, curr) => {
                                  // Only update if the type of this specific action changes
                                  const prevActions = prev.steps?.[name]?.actions;
                                  const currActions = curr.steps?.[name]?.actions;
                                  return prevActions?.[actionKey]?.type !== currActions?.[actionKey]?.type;
                                }}
                                noStyle
                              >
                                {({ getFieldValue }) => {
                                  const type = getFieldValue(['steps', name, 'actions', actionKey, 'type']);
                                  let modeOptions: string[] = [];
                                  
                                  if (type === 'input') {
                                    modeOptions = ['set', 'type', 'inner_text'];
                                  } else if (type === 'select') {
                                    modeOptions = ['value', 'text', 'index'];
                                  }

                                  return (
                                    <Form.Item
                                      {...actionRest}
                                      name={[actionName, 'mode']}
                                      label="Mode"
                                      className="mb-0 w-32"
                                    >
                                      <Select 
                                        options={modeOptions.map(t => ({ label: t, value: t }))} 
                                        allowClear 
                                        placeholder={modeOptions.length ? "Select mode" : "Default"}
                                        disabled={modeOptions.length === 0}
                                      />
                                    </Form.Item>
                                  );
                                }}
                              </Form.Item>
                               <Form.Item
                                {...actionRest}
                                name={[actionName, 'delay']}
                                label="Delay (ms)"
                                className="mb-0 w-24"
                              >
                                <Input type="number" />
                              </Form.Item>
                              <Button danger icon={<DeleteOutlined />} onClick={() => removeAction(actionName)} className="mt-8" />
                            </div>
                          ))}
                          <Button type="dashed" size="small" onClick={() => addAction()} icon={<PlusOutlined />}>
                            Add Action
                          </Button>
                        </div>
                      )}
                    </Form.List>
                  </Card>
                ))}
              </div>
            )}
          </Form.List>
        </Form>
      </Modal>
    </div>
  );
}
