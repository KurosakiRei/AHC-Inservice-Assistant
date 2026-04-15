# AHC Inservice Assistant

> 一个为 **Always Home Care** 在职培训平台（Rise 360）设计的 Tampermonkey 用户脚本，可自动完成视频观看与知识测验，大幅节省培训时间。

## ✨ 功能特性

- 🎬 **自动播放视频** — 以 16 倍速静音播放所有课程视频，实时监控播放状态
- 📝 **自动答题** — 根据内置题库自动选择正确答案并提交
- ▶️ **自动翻页** — 自动点击"继续 / Continue / 完成"按钮，处理 Rise 360 懒加载内容
- 🔒 **智能防误触** — 视频播放中、测验未提交时，均不会误点继续按钮
- 🖱️ **可拖动浮窗** — 右上角浮窗可随意拖拽，不遮挡课程内容
- 🎉 **课程完成自动停止** — 检测到完成页面后自动停止

## 🚀 使用方法

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 将编译好的 `dist/*.user.js` 文件安装到 Tampermonkey
3. 打开 Always Home Care 培训平台课程页面
4. 页面右上角出现 **Inservice Assistant** 浮窗
5. 点击 **Start Automation** 开始，**Stop Automation** 随时停止

## 🛠️ 开发构建

```bash
# 安装依赖
npm install

# 开发模式（监听变化，实时构建）
npm run dev

# 生产构建
npm run build
```

构建产物位于 `dist/` 目录，安装 `dist/index.prod.user.js` 到 Tampermonkey 即可。

## 📚 技术栈

| 技术         | 说明             |
| ------------ | ---------------- |
| Vue 3        | 浮窗 UI 框架     |
| TypeScript   | 逻辑层类型安全   |
| Webpack 5    | 打包构建         |
| Tampermonkey | 用户脚本运行环境 |

## 📄 声明

本项目仅供个人学习与内部使用，请勿用于商业目的。

---

## 📝 更新日志

### v1.1.2（2026-04-15）

- 修复 Reach360 一次一题测验卡无法自动作答的问题
  - 根因：平台在提交前以 `opacity: 0` 预渲染"再试一次"按钮，旧逻辑仅检测高度 > 0 导致误判为已完成
  - 改为同时检测 `height > 0` 且 `computed opacity > 0`，准确识别提交状态

### v1.1.1（2026-04-15）

- 修复 Reach360 平台多项运行时兼容问题
  - **iframe 选择**：从始终取第一个 iframe 改为优先匹配 `reach360.com/frame/learn`
  - **滚动容器**：从 `window.scrollTo()` 改为滚动 `.page-wrap`（平台对 body 设 `overflow:hidden`）
  - **侧边栏查询**：从主文档改为在 iframe 内查询，修复进度百分比读取
  - **继续按钮可见性**：使用 iframe 自身 `innerHeight` 而非主窗口

### v1.1.0

- 新增 In Service B 课程全套题库
- 安全依赖更新，新增 CI/CD 自动部署

---

*Powered by KurosakiRei*
