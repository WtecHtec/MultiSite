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
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { Workflow, WorkflowStep } from '../../common/types';

const STEP_TYPES = ['click', 'input', 'select', 'upload', 'date'];

export default function WorkflowManager() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);

  const [form] = Form.useForm();

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await window.electron.ipcRenderer.invoke('workflow:get-all');
      setWorkflows(data || []);
    } catch (error) {
      message.error('Failed to load workflows');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const openEdit = (record: Workflow) => {
    setEditing(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const remove = async (id: string) => {
    try {
      await window.electron.ipcRenderer.invoke('workflow:delete', id);
      message.success('Deleted successfully');
      load();
    } catch (error) {
      message.error('Failed to delete');
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const now = Date.now();
      
      const workflow: Workflow = {
        id: editing ? editing.id : `flow_${now}`,
        createdAt: editing ? editing.createdAt : now,
        updatedAt: now,
        ...values,
      };

      await window.electron.ipcRenderer.invoke('workflow:save', workflow);
      message.success('Saved successfully');
      setModalVisible(false);
      load();
    } catch (error) {
      console.error(error);
      message.error('Failed to save');
    }
  };

  const runWorkflow = async (workflow: Workflow) => {
    try {
      await window.electron.ipcRenderer.invoke('workflow:open-runner', workflow.id);
    } catch (error) {
      console.error(error);
      message.error('Failed to open runner');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id' },
    { title: 'Title', dataIndex: 'title' },
    { title: 'Description', dataIndex: 'desc' },
    { title: 'Steps', render: (_: any, r: Workflow) => r.steps?.length || 0 },
    {
      title: 'Actions',
      render: (_: any, record: Workflow) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => runWorkflow(record)}
          >
            Run
          </Button>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEdit(record)}
          >
            Edit
          </Button>
          <Button
            danger
            type="link"
            icon={<DeleteOutlined />}
            onClick={() => remove(record.id)}
          >
            Delete
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Public Workflows</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Create Workflow
        </Button>
      </div>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns}
        dataSource={workflows}
      />

      <Modal
        title={editing ? 'Edit Workflow' : 'Create Workflow'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={save}
        width={800}
      >
        <Form layout="vertical" form={form}>
          <Form.Item
            label="Title"
            name="title"
            rules={[{ required: true, message: 'Please enter title' }]}
          >
            <Input placeholder="e.g., Product Review Flow" />
          </Form.Item>
          
          <Form.Item label="Description" name="desc">
            <Input.TextArea placeholder="Description of the workflow" />
          </Form.Item>

          <Card title="Steps" size="small" type="inner">
            <Form.List name="steps" initialValue={[]}>
              {(fields, { add, remove }) => (
                <div className="flex flex-col gap-4">
                  {fields.map(({ key, name, ...restField }) => (
                    <div
                      key={key}
                      className="border p-4 rounded bg-gray-50 flex gap-4 items-start"
                    >
                      <div className="flex-1 grid grid-cols-12 gap-2">
                        <Form.Item
                          {...restField}
                          name={[name, 'id']}
                          label="Step ID"
                          className="col-span-3 mb-0"
                          initialValue={`step_${Date.now()}_${key}`}
                          rules={[{ required: true }]}
                        >
                          <Input placeholder="ID" />
                        </Form.Item>
                        
                        <Form.Item
                          {...restField}
                          name={[name, 'type']}
                          label="Type"
                          className="col-span-3 mb-0"
                          rules={[{ required: true }]}
                        >
                          <Select options={STEP_TYPES.map(t => ({ label: t, value: t }))} />
                        </Form.Item>

                        <Form.Item
                          {...restField}
                          name={[name, 'desc']}
                          label="Description"
                          className="col-span-6 mb-0"
                        >
                          <Input placeholder="Step description" />
                        </Form.Item>
                      </div>
                      <Button danger icon={<DeleteOutlined />} onClick={() => remove(name)} />
                    </div>
                  ))}

                  <Button type="dashed" onClick={() => add()} block icon={<PlusOutlined />}>
                    Add Step
                  </Button>
                </div>
              )}
            </Form.List>
          </Card>
        </Form>
      </Modal>
    </div>
  );
}
