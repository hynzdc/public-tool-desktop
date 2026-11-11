# 公益工具站（Electron + Vue）

从 Java/Swing 重构而来的桌面工具与官方首页，技术栈：

- **Electron** — 跨平台桌面壳
- **Vue 3 + Vite** — 桌面 UI 与官方首页
- **Node.js 本地处理** — Excel / PDF / 图片，全程不上传

## 功能

- Excel 链接下载：读取 Excel 指定表头下的链接，下载并打包为 ZIP
- 发票识别导出：批量读取 PDF 发票内容，按文件夹导出 Excel
- PDF 关键字筛选：按关键字包含或不包含筛选 PDF，并输出 ZIP
- PDF 内容提取：批量提取 PDF 文本字段并导出 Excel
- 图片压缩：单张输出 JPG，多张输出 ZIP

## 环境要求

- Node.js 18+
- macOS / Windows

## 桌面端开发

```bash
npm install
npm run dev
```

## 官方首页（Vue）

```bash
# 开发预览 http://127.0.0.1:4177
npm run website:dev

# 构建静态站到 website/dist
npm run website:build
```

首页源码在 `website/`，下载包放在 `website/public/downloads/`。

## 打包桌面应用

```bash
# 当前平台
npm run build

# macOS / Windows
npm run build:mac
npm run build:win
```

产物输出到 `release/`。

## 目录结构

```text
electron/                 # 主进程 + 业务服务
  main.js
  preload.js
  services/
src/                      # 桌面端 Vue 界面
website/                  # 官方首页（Vue 3 + Vite）
  src/
  public/
    assets/
    downloads/
build/icon.png
```

## 与 Java 版的关系

- 业务行为对齐原 `public-tool` Java 桌面版
- 官网从静态 HTML 重构为 Vue 组件化页面
- 文件始终在本地处理，无需账号
