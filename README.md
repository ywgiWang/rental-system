# 悦居租房系统

多角色综合租房平台，支持房东、租客、中介三种角色，功能覆盖房源管理、租客申请、预约看房、消息通知和租期管理。

## 技术栈

- **后端**: Fastify (Node.js) + PostgreSQL + PostGIS
- **前端**: Vue 3 + Vite + Vue Router + Pinia
- **数据库**: PostgreSQL 12+ (需安装 PostGIS 扩展)

## 环境要求

- Node.js 18+
- PostgreSQL 12+ (需启用 PostGIS 扩展)
- 安装 PostGIS: `CREATE EXTENSION postgis;`

## 数据库配置

通过环境变量配置数据库连接：

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=rental
export PGUSER=postgres
export PGPASSWORD=ywkcy
```

## 项目结构

```
rental-system/
├── server/               # Fastify 后端
│   ├── index.js          # 服务入口 + API 路由
│   ├── db.js             # PostgreSQL 数据库初始化
│   └── package.json
├── client/               # Vue 3 前端
│   ├── src/
│   │   ├── api.js        # API 封装
│   │   ├── router/       # Vue Router
│   │   ├── stores/       # Pinia 状态管理
│   │   ├── composables/  # 组合式函数
│   │   ├── components/   # 公共组件
│   │   ├── pages/        # 页面组件
│   │   └── assets/       # 样式
│   ├── index.html
│   └── package.json
└── package.json          # 根目录脚本
```

## 快速开始

### 1. 准备数据库

```bash
# 创建数据库（需 PostgreSQL + PostGIS）
createdb rental
psql rental -c "CREATE EXTENSION postgis;"
```

### 2. 安装依赖

```bash
# 后端
cd server && npm install

# 前端
cd client && npm install
```

### 3. 启动开发环境

```bash
# 方式一：同时启动前后端
npm install -g concurrently
npm run dev

# 方式二：分别启动
# 终端 1 - 后端
cd server && npm run dev

# 终端 2 - 前端
cd client && npm run dev
```

- 前端地址: http://localhost:3000
- 后端地址: http://localhost:3001

### 4. 生产构建

```bash
# 构建前端
cd client && npm run build

# 启动后端
cd server && npm start
```

## 演示账号

| 角色 | 用户名 | 密码 |
|------|--------|------|
| 房东 | landlord1 | 123456 |
| 租客 | tenant1 | 123456 |
| 中介 | agent1 | 123456 |

首次启动时数据库会自动初始化并插入演示数据（含地理位置坐标）。

## 功能模块

### 房东视角
- 发布 / 编辑 / 删除房源（支持上传照片、设置可租日期、填写经纬度）
- 审核租客申请（通过 / 拒绝）
- 确认 / 取消 / 完成看房预约
- 创建 / 管理租期
- 接收系统通知（新申请、新预约等）

### 租客视角
- 按条件筛选房源（类型、价格、关键词）
- 查看房源详情（含地图位置展示）
- 提交租房申请
- 预约看房
- 查看申请 / 预约 / 租期状态
- 接收系统通知（申请结果等）

### 中介视角
- 协助发布房源
- 代管申请与预约
- 统筹租期跟进

### 地图与位置
- 房源表内置 latitude / longitude / geom (PostGIS Point)
- 支持按距离搜索附近房源 (`/api/listings/nearby?lat=xx&lng=xx&radius=5000`)
- 房源详情页展示坐标位置（可接入腾讯/高德/百度地图 SDK 展示）

### 业务联动
- 新申请自动通知房东
- 申请通过 / 拒绝自动通知租客
- 创建租约自动将房源置为"已租"
- 终止租约自动恢复房源为"可租"

## 前端特点（适配移动端）

- 移动端优先的底部 Tab 导航栏
- 顶部品牌栏
- 触摸友好的按钮和表单（最小 44px 点击区域）
- 卡片式布局，圆角阴影适配手机
- 底部上滑的 Modal 弹窗
- 桌面端自动切换为顶部导航
- **基于 Vue 3，方便后续迁移到 UniApp**

## API 列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册 |
| POST | /api/auth/login | 登录 |
| GET | /api/auth/me | 当前用户 |
| GET | /api/dashboard | 工作台统计 |
| GET | /api/listings | 房源列表（支持筛选 + 距离搜索） |
| GET | /api/listings/nearby | 附近房源（按距离排序） |
| GET | /api/listings/:id | 房源详情 |
| POST | /api/listings | 发布房源 |
| PUT | /api/listings/:id | 编辑房源 |
| DELETE | /api/listings/:id | 删除房源 |
| GET | /api/applications | 申请列表 |
| POST | /api/applications | 提交申请 |
| PUT | /api/applications/:id | 审核申请 |
| GET | /api/appointments | 预约列表 |
| POST | /api/appointments | 创建预约 |
| PUT | /api/appointments/:id | 更新预约状态 |
| GET | /api/messages | 消息列表 |
| PUT | /api/messages/:id/read | 标记已读 |
| PUT | /api/messages/read-all | 全部已读 |
| GET | /api/leases | 租期列表 |
| POST | /api/leases | 创建租约 |
| PUT | /api/leases/:id | 更新租约状态 |
| GET | /api/users | 用户列表 |

## 数据库表

- **users** - 用户（房东 / 租客 / 中介）
- **listings** - 房源（含 images JSONB、available_from、latitude、longitude、geom PostGIS Point）
- **applications** - 租房申请
- **appointments** - 预约看房
- **messages** - 消息通知
- **leases** - 租期管理
