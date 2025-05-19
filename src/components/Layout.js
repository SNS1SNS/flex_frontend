import React from 'react';
import PropTypes from 'prop-types';
import { Layout as AntLayout, Menu, Typography } from 'antd';
import { Link, useLocation } from 'react-router-dom';
import {
  EnvironmentOutlined,
  DashboardOutlined,
  SettingOutlined,
  GithubOutlined
} from '@ant-design/icons';

const { Header, Content, Footer } = AntLayout;
const { Title } = Typography;

/**
 * Компонент Layout для обертки страниц приложения
 * @param {Object} props - Свойства компонента
 * @param {React.ReactNode} props.children - Содержимое страницы
 * @returns {JSX.Element} Компонент Layout
 */
const Layout = ({ children }) => {
  const location = useLocation();
  const currentPath = location.pathname;

  // Определяем ключи для активного элемента меню
  const getSelectedKeys = () => {
    if (currentPath.includes('/track')) return ['track'];
    if (currentPath.includes('/settings')) return ['settings'];
    return ['dashboard'];
  };

  return (
    <AntLayout className="layout" style={{ minHeight: '100vh' }}>
      <Header style={{ display: 'flex', alignItems: 'center' }}>
        <div className="logo" style={{ marginRight: '20px' }}>
          <Link to="/">
            <Title level={4} style={{ color: 'white', margin: 0 }}>
              <EnvironmentOutlined /> FLEX Track
            </Title>
          </Link>
        </div>
        
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={getSelectedKeys()}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: <Link to="/">Дашборд</Link>
            },
            {
              key: 'track',
              icon: <EnvironmentOutlined />,
              label: <Link to="/track">Трекер</Link>
            },
            {
              key: 'settings',
              icon: <SettingOutlined />,
              label: <Link to="/settings">Настройки</Link>
            }
          ]}
        />
      </Header>
      
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content" style={{ padding: '24px', minHeight: 280 }}>
          {children}
        </div>
      </Content>
      
      <Footer style={{ textAlign: 'center' }}>
        FLEX Track ©{new Date().getFullYear()} Создано с <GithubOutlined /> и <span style={{ color: '#ff4d4f' }}>❤</span>
      </Footer>
    </AntLayout>
  );
};

Layout.propTypes = {
  children: PropTypes.node.isRequired
};

export default Layout; 