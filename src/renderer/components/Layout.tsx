import React from 'react';
import { Layout as AntLayout, Menu } from 'antd';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { AppstoreOutlined, LinkOutlined, PlayCircleOutlined } from '@ant-design/icons';

const { Header, Content, Sider } = AntLayout;

export default function Layout() {
  const location = useLocation();

  const items = [
    {
      key: '/',
      icon: <AppstoreOutlined />,
      label: <Link to="/">Public Workflows</Link>,
    },
    {
      key: '/page-workflows',
      icon: <LinkOutlined />,
      label: <Link to="/page-workflows">Page Workflows</Link>,
    },
    // {
    //   key: '/execution',
    //   icon: <PlayCircleOutlined />,
    //   label: <Link to="/execution">Execution</Link>,
    // },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider theme="dark">
        <div className="h-16 flex items-center justify-center text-white font-bold text-lg">
          Workflow System
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={items}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: '#fff' }} />
        <Content style={{ margin: '16px' }}>
          <div style={{ padding: 24, minHeight: 360, background: '#fff' }}>
            <Outlet />
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}
