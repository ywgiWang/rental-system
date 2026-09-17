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
- **房屋管理**：新增 / 编辑 / 删除房屋（地址、面积、户型、照片、经纬度）
- **发布管理**：对已录入的房屋发布出租（标题、租金、可租日期），支持重新上架、下架
- 审核租客申请（通过 / 拒绝）
- 确认 / 取消 / 完成看房预约
- 创建 / 管理租期（支持上传合同扫描件、按租约记账）
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
- 房屋表（properties）内置 latitude / longitude / geom (PostGIS Point)
- 支持按距离搜索附近房源 (`/api/listings/nearby?lat=xx&lng=xx&radius=5000`)
- 房源详情页展示坐标位置（可接入腾讯/高德/百度地图 SDK 展示）

### 业务联动
- 新申请自动通知房东
- 申请通过 / 拒绝自动通知租客
- 创建租约时可勾选「同时将该发布标记为已出租」，自动将关联发布置为"已租"
- 终止 / 到期租约时，自动将关联发布恢复为"可租"

## 核心设计

### 房屋与上架分离

系统将「房屋」和「发布」拆成两张表，避免房东每次重新上架都重复填写房屋信息：

- **房屋（properties）**：记录一套房子的固定信息 —— 地址、面积、户型、类型、描述、照片、经纬度。
- **发布（listings）**：记录一次出租的变动信息 —— 标题、租金、可租日期、状态（`available` / `rented` / `offline`），通过 `property_id` 关联到房屋。

一套房租约到期后，只需对同一房屋再次「发布出租」（改价格 / 可租日期即可），无需重填房屋信息；已出租房源也可直接重新上架。

### 照片压缩策略

为控制存储成本，所有图片上传统一走前端 Canvas 压缩流程（`client/src/utils/image.js`）：

- 分辨率等比缩放至最长边 **1920px** 以内；
- 统一转为 **JPEG**，质量系数 `0.82`；
- 仅接受图片格式（`jpg / png / webp / gif`），单文件上限 10MB；
- 若压缩后体积反而更大，则保留原图；
- 文件落盘到 `server/uploads/`，数据库仅存访问 URL（`/uploads/...`）。

房屋照片与租约合同扫描件均复用该上传通道（`POST /api/upload`）。

### 发布出租与租约的绑定关系

租约（lease）采用「锚定房屋、可选关联发布」的松散设计，兼顾实际业务的灵活性：

- 租约必填 `property_id`（锚定到房屋），`listing_id` 为可选关联；
- 创建租约时若选择关联发布，可勾选「同时将该发布标记为已出租」，后端自动把该发布置为 `rented`；
- 终止 / 到期租约时，若该租约关联了发布，后端自动将发布恢复为 `available`。

这样既保留了「出租即下架」的自动联动，又不会因强绑定而限制「一套房多个发布」「历史发布追溯」等真实场景。

### 记账（Bills）

每个租约下可记录各月账单（水费 / 电费 / 燃气 / 物业 / 宽带 / 杂费）：

- 账单归属租约（`lease_id`），按月（`period`，格式 `YYYY-MM`）归档；
- 支持「一键生成该月账单」，默认只针对 `active` 且覆盖该月的租约生成水费 + 电费两条，幂等不重复；
- 账单标记「已缴」后锁定（不可改金额 / 删除），需先取消已缴再修改。

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
| POST | /api/upload | 上传图片（压缩后返回 URL） |
| GET | /api/properties | 房屋列表 |
| POST | /api/properties | 新增房屋 |
| PUT | /api/properties/:id | 编辑房屋 |
| DELETE | /api/properties/:id | 删除房屋 |
| GET | /api/listings | 发布列表（支持筛选 + 距离搜索） |
| GET | /api/listings/nearby | 附近房源（按距离排序） |
| GET | /api/listings/:id | 发布详情 |
| POST | /api/listings | 发布出租 |
| PUT | /api/listings/:id | 编辑发布 |
| DELETE | /api/listings/:id | 删除发布 |
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
| GET | /api/leases/:id/bills | 某租约账单列表 |
| POST | /api/leases/:id/bills | 新增账单 |
| POST | /api/bills/generate | 一键生成该月账单 |
| PUT | /api/bills/:id | 更新账单（金额 / 备注 / 缴费状态） |
| DELETE | /api/bills/:id | 删除账单 |
| GET | /api/users | 用户列表 |

## 数据库表

- **users** - 用户（房东 / 租客 / 中介）
- **properties** - 房屋（含 images JSONB、latitude、longitude、geom PostGIS Point）
- **listings** - 发布（引用 properties，含 title、price、available_from、status）
- **applications** - 租房申请
- **appointments** - 预约看房
- **messages** - 消息通知
- **leases** - 租约（锚定 properties，可选关联 listings，含 rent、deposit、contract_files JSONB）
- **bills** - 账单（归属 leases，按 period 归档，水/电/燃气/物业/宽带/杂费）
