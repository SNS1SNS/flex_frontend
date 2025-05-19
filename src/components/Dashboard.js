import React from 'react';
import { Typography, Row, Col, Card, Statistic, Button } from 'antd';
import { 
  CarOutlined, 
  EnvironmentOutlined, 
  ClockCircleOutlined, 
  BellOutlined,
  DashboardOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

/**
 * Компонент дашборда для главной страницы
 * @returns {JSX.Element} Компонент дашборда
 */
const Dashboard = () => {
  const navigate = useNavigate();

  // Мок-данные для статистики (в реальном приложении будут из API)
  const statistics = {
    activeVehicles: 12,
    tracksToday: 8,
    alertsCount: 3,
    onlineVehicles: 5
  };

  return (
    <div className="dashboard-container">
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Title level={2}>Дашборд</Title>
          <Paragraph>
            Добро пожаловать в панель управления FLEX Track. Здесь вы можете видеть общую информацию о системе,
            активных транспортных средствах и последних событиях.
          </Paragraph>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Активные ТС"
              value={statistics.activeVehicles}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
            <Button 
              type="link" 
              style={{ padding: 0, marginTop: 16 }}
              onClick={() => navigate('/vehicles')}
            >
              Посмотреть все
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Треки сегодня"
              value={statistics.tracksToday}
              prefix={<EnvironmentOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            <Button 
              type="link" 
              style={{ padding: 0, marginTop: 16 }}
              onClick={() => navigate('/track')}
            >
              Перейти к треку
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Оповещения"
              value={statistics.alertsCount}
              prefix={<BellOutlined />}
              valueStyle={{ color: statistics.alertsCount > 0 ? '#ff4d4f' : '#3f8600' }}
            />
            <Button 
              type="link" 
              style={{ padding: 0, marginTop: 16 }}
              onClick={() => navigate('/alerts')}
            >
              Просмотр оповещений
            </Button>
          </Card>
        </Col>

        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="ТС в сети"
              value={statistics.onlineVehicles}
              prefix={<ClockCircleOutlined />}
              suffix={`/ ${statistics.activeVehicles}`}
              valueStyle={{ color: '#722ed1' }}
            />
            <Button 
              type="link" 
              style={{ padding: 0, marginTop: 16 }}
              onClick={() => navigate('/status')}
            >
              Проверить статус
            </Button>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card
            title={
              <span>
                <DashboardOutlined /> Быстрые действия
              </span>
            }
          >
            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Button 
                  type="primary" 
                  icon={<EnvironmentOutlined />} 
                  size="large" 
                  block
                  onClick={() => navigate('/track')}
                >
                  Просмотр трека
                </Button>
              </Col>
              <Col span={8}>
                <Button 
                  icon={<CarOutlined />} 
                  size="large" 
                  block
                  onClick={() => navigate('/vehicles')}
                >
                  Управление ТС
                </Button>
              </Col>
              <Col span={8}>
                <Button 
                  icon={<BellOutlined />} 
                  size="large" 
                  block
                  onClick={() => navigate('/alerts')}
                >
                  Настройка оповещений
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 