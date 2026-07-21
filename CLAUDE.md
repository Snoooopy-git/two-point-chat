# 双点聊天 (Two-Point Chat) v0.1.2

## 项目概述

基于 Vue 3 + Node.js + Socket.io + SQLite 的双人在线聊天工具。支持文字/图片/emoji 消息、实时通信、消息提醒、管理员后台。

- 前端：Vue 3 (Composition API) + Vite + Pinia + Vue Router 4
- 后端：Node.js + Express 5 + Socket.io 4
- 数据库：SQLite (better-sqlite3)
- 认证：JWT + bcryptjs
- 部署：阿里云 Linux 3.2104 LTS，Nginx 反向代理，PM2 进程管理

## 技术约束

- Express 5 使用 `/{*path}` 通配符路由语法（非 Express 4 的 `*`）
- better-sqlite3 是原生模块，Windows 编译的 .node 文件不能在 Linux 使用，必须在目标服务器 `npm rebuild`
- 生产环境 Express 绑定 `127.0.0.1:3000`，由 Nginx 代理公网请求
- SQLite 单文件数据库，单进程模式（PM2 fork 模式，非 cluster）
- JWT_SECRET 生产环境必须通过环境变量覆盖默认值
- **Vue 3 + Web Component 集成**：
  - `vite.config.js` 中必须配置 `vue({ template: { compilerOptions: { isCustomElement: tag => tag === 'xxx' } } })`，否则 Vue 不会正确传递 HTML attribute
  - Web Component 事件绑定必须使用 Vue 模板语法 `@event-name="handler"`，禁止在 `onMounted` 中用 `addEventListener` 手动绑定（存在时序竞态）
  - Web Component 首次挂载时必须在可视区域内（禁止 `display:none` 或 off-screen 定位），否则内部布局检测会失败

---

# 开发治理原则

## 一、基础原则

1. **结论优先，细节后置**：结论和关键信息放最前面
2. **没有模糊空间**："必须"、"禁止"无任何例外
3. **调研先于方案，方案先于编码**：未确认信息充足、未消除隐藏假设，不得进入方案设计；未确认方案不得进入编码

## 二、交互要求

| 场景 | 行为 |
|------|------|
| 需求明确、无歧义、无架构冲突 | 输出精确范围清单，等用户确认 |
| 用户未确认或提出异议 | 重新分析并再次确认 |
| 需求模糊、缺参数、有歧义、与现有架构冲突 | 输出澄清问题，等回答 |
| 需要方案选择 | 必须输出 3 个方案（A / B / C），等字母确认 |
| 执行中偏离原定方案 | 停止，输出新方案，等确认 |

## 三、分析纪律

- 分析必须结构化：问题拆解、影响面、3 个方案对比（核心思路、改动范围、优势、风险、工作量、决策属性）、建议
- 每个方案回答主路径与异常路径；复杂任务额外回答回退策略

## 四、执行纪律

- 禁止擅自扩展或缩减已确认的方案范围
- 禁止在配置/脚本中写入绝对路径
- 禁止用主观判断绕过量化标准
- 禁止擅自修改项目版本号或执行发布/部署流程，除非用户明确确认
- 禁止引入未使用的依赖、导入或变量
- 禁止留下临时文件或调试代码

## 五、交付要求

1. 范围清单中的所有项已处理，清单外无任何改动
2. 所有相关文件无新增错误、无新增警告（允许与本次改动无关的已有警告保持不变）
3. 若存在类型检查、编译或测试入口，必须执行并通过最小相关验证；无法通过时按"同一个问题修复 2 次仍未通过"处理
4. 无临时文件、无调试代码、无未使用依赖、无未使用的导入或变量
5. 部署前必须通过前端构建（`npm run build`）验证

## 六、设计原则

- 前端设计应主动检索优秀的类似案例进行设计参考
- 设计交互感强，注重用户体验
- 保持与现有设计风格的一致性（紫色渐变主题）

## 七、发布纪律（开发-部署-上线流程）

开发与上线必须严格分离，禁止在收到明确上线指令前执行任何部署/上线动作。

### 7.1 开发阶段（必须完成，未完成不得进入部署）
1. 编码完成 → 本地构建验证（`npm run build`）通过
2. 本地启动调试 → 烟雾测试（health / 关键 API / 前端加载）通过
3. 端到端验证 → 按功能清单逐项确认行为符合预期
4. 自查 → 无临时文件、无调试代码、无未使用依赖

### 7.2 版本管理（每次功能交付必须执行）
1. 每个可交付版本必须对应一个语义化版本号（MAJOR.MINOR.PATCH）
2. 版本号变更必须经用户明确确认后，同步更新 `package.json` 与 `client/package.json`
3. 提交前必须 `git status` 确认改动范围与已确认范围清单一致
4. 每个 version 必须有对应的 git commit / tag，commit message 需描述本次变更
5. 禁止跳过版本号、禁止版本号倒退、禁止未经确认擅自 bump 版本

### 7.3 部署-上线阶段（必须由用户明确指令触发）
1. **禁止**在未收到用户明确"部署/上线"指令时，执行 `scp`、`ssh`、`pm2 restart`、`git push`、`deploy.sh` 等任何上线动作
2. 上线指令必须包含明确目标（哪次变更、部署到哪个环境）
3. 上线流程必须有序：代码提交 → 构建产物 → 传输 → 解包 → 依赖安装（如需）→ 重启服务 → 健康检查 → 冒烟验证
4. 上线后必须验证：健康检查返回 ok、前端可访问、关键功能可用
5. 上线失败必须立即停止，输出失败现象与回退方案，等用户确认后执行回退
6. 上线完成必须报告：变更内容、影响面、验证结果

### 7.4 流程边界
- 开发阶段的本地构建/本地调试属于开发动作，**不构成上线**，可自主执行
- 一旦涉及远程服务器、生产环境、对外发布，即为上线动作，**必须等用户指令**

## 八、Bug 修复纪律

1. **诊断先于修复**：收到 Bug 报告后，必须先完成完整诊断，列出所有独立根因，再逐一修复。禁止逐 symptom 试错式修复
2. **隔离验证**：涉及第三方库/组件时，必须先创建最小化隔离测试（纯 HTML/JS，排除框架干扰），确认库本身行为正常后再排查集成层
3. **多根因并行处理**：一个 Bug 可能由多个独立根因共同导致，必须全部识别并一次性修复，不得遗漏任何一个
4. **同一个 Bug 修复 2 次仍未通过**：必须停止，输出完整诊断报告（包含：问题复现路径、已排除的假设、剩余可能性、验证方法），等用户确认后再继续。禁止连续试错超过 2 次
5. **修复后必须端到端验证**：按用户报告的原始操作路径完整走一遍，确认行为符合预期。不能只验证"改动点"

---

# Bug 复盘

## 复盘 1：emoji-picker 集成 Bug（2026-07-20）

### 问题链

用户报告"点击表情包没有反应" → 修复 4 次才完全解决：
1. **第 1 次**：认为是 CDN 被墙 → blob URL 方案 → 导致页面卡死
2. **第 2 次**：认为是 blob URL 问题 → 改用 public 静态文件 → 依旧不工作
3. **第 3 次**：搜索发现 Vue 3 + Web Component 集成需配置 `isCustomElement` → picker 能打开，但点击表情无法插入输入框
4. **第 4 次**：发现 `addEventListener` 绑定事件存在时序竞态 → 改用 Vue 模板 `@emoji-click` → 彻底修复

### 四个独立根因

| # | 根因 | 类别 | 影响 |
|---|------|------|------|
| 1 | jsdelivr.net CDN 在国内被墙，picker 默认数据源无法访问 | 网络/环境 | picker 初始化失败，无数据 |
| 2 | Vue 3 未配置 `isCustomElement`，不识别 `<emoji-picker>` 为 Web Component，HTML attribute 无法正确传递 | 框架配置 | `data-source` 等属性不会生效 |
| 3 | Picker 首次挂载时在 off-screen 位置，Web Component 的 emoji 宽度检测依赖可见视口 | CSS/布局 | picker 渲染空白 |
| 4 | `onMounted` + `addEventListener` 手动绑定 Web Component 事件，存在 Vue 渲染周期与 Custom Element 初始化之间的时序竞态 | 事件绑定模式 | 点击 emoji 无法触发回调 |

### 反思：为什么修了 4 次

1. **违反"诊断先于修复"**：每次只看到表面症状，没有系统性排查所有可能原因
2. **没有做隔离验证**：应该先创建一个纯 HTML 测试页验证 emoji-picker-element 本身能否正常工作，再排查 Vue 集成层。实际上搜索之后才发现 `isCustomElement` 这一关键配置
3. **没有搜索已知问题**：emoji-picker-element 与 Vue 3 的集成问题是已知的（GitHub Issue #207），如果一开始就搜索，可以节省前 2 次失败的修复
4. **每次只能发现一个问题**：4 个根因是同时存在的，但因为只针对单个 symptom 修复，所以每次只能暴露下一个问题

### 后续防范措施

1. **遇第三方库集成问题，第一步是搜索"<库名> + <框架名> + known issues"**，而非直接改代码
2. **第二步是创建隔离测试**（如 `public/xxx-test.html`），排除框架干扰
3. **修复前列出所有可能的根因假设，逐一验证**，确认是单一根因还是多根因叠加
4. **代码审查时重点检查**：`isCustomElement` 配置、Web Component 事件绑定方式、CSS 定位是否导致元素不可见

---

## 项目结构

```
two-point/
├── server/
│   ├── index.js          # Express + Socket.io 入口
│   ├── db.js             # SQLite 初始化 + 迁移
│   ├── middleware/
│   │   └── auth.js       # JWT 认证中间件
│   ├── routes/
│   │   ├── auth.js       # 注册/登录
│   │   ├── users.js      # 用户搜索/好友管理
│   │   ├── messages.js   # 历史消息 + 未读管理
│   │   └── upload.js     # 图片上传
│   ├── socket/
│   │   └── chat.js       # Socket.io 实时聊天
│   └── uploads/          # 图片存储目录
├── client/
│   ├── src/
│   │   ├── App.vue       # 根组件（全局初始化）
│   │   ├── main.js       # Vue 入口
│   │   ├── style.css     # 全局样式
│   │   ├── router/index.js
│   │   ├── stores/
│   │   │   ├── auth.js   # 认证状态
│   │   │   └── chat.js   # 聊天状态 + 未读追踪
│   │   ├── utils/
│   │   │   ├── api.js    # HTTP 请求封装
│   │   │   ├── socket.js # Socket.io 客户端
│   │   │   └── notifications.js  # 浏览器通知
│   │   ├── views/
│   │   │   ├── Login.vue
│   │   │   ├── Register.vue
│   │   │   ├── Contacts.vue
│   │   │   └── Chat.vue
│   │   └── components/
│   │       └── ImageUpload.vue
│   └── vite.config.js
├── nginx.conf            # Nginx 反向代理配置
├── ecosystem.config.js   # PM2 配置
├── deploy.sh             # 一键部署脚本
└── package.json
```

## 部署信息

| 项目 | 值 |
|------|-----|
| 服务器 IP | 8.130.137.122 |
| 服务器系统 | Alibaba Cloud Linux 3.2104 LTS |
| 部署路径 | /opt/two-point-chat |
| 进程管理 | PM2 (fork 模式) |
| 反向代理 | Nginx (port 80) |
| GitHub 仓库 | https://github.com/Snoooopy-git/two-point-chat |

## 日常开发流程

```bash
# 本地开发
cd e:/Project-test/two-point
git add -A && git commit -m "feat: 描述"
git push

# 部署到服务器
ssh -i ~/.ssh/two_point_chat_key root@8.130.137.122 \
  "cd /opt/two-point-chat && git pull && cd client && npm install && npx vite build && cd .. && pm2 restart two-point-chat"
```
