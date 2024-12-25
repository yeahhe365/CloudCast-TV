# CloudCast TV

> 一个简单、跨平台的 IPTV 在线播放网页。支持收藏频道、自定义直播源、主题切换等功能。

---

## 项目展示

![PixPin_2024-12-25_19-27-39](https://github.com/user-attachments/assets/b878d05c-7d68-4878-96c8-34864552261f)


![PixPin_2024-12-25_19-27-21](https://github.com/user-attachments/assets/d19b7a77-f49a-4f25-b2ed-cc6d7b988500)


---

## 功能概览

- **播放各类 m3u/m3u8 直播源**：通过选择或自定义输入直播源链接，即可加载频道列表并进行播放。
- **频道收藏**：可对喜欢的频道标注收藏，方便在“收藏频道”列表中快速访问。
- **主题切换**：一键在浅色与暗色主题间切换，舒适护眼。
- **频道搜索**：在列表中快速查找想要的频道。
- **自定义直播源**：在“设置”中可手动添加直播源，并持久化保存至浏览器缓存。
- **多端适配**：适配 PC、手机端，提供多种交互方式（滑动切换频道、上/下方向键切换、空格播放/暂停等）。

---

## 目录结构

```
CloudCast TV
├── favicon
│   ├── apple-touch-icon.png
│   ├── favicon-16x16.png
│   ├── favicon-32x32.png
│   └── favicon.ico
├── images
│   └── logo.png
├── index.html
├── script.js
└── styles.css
```

各文件功能说明：

- **index.html**：主页面，包含播放器、频道列表等核心 DOM 结构。
- **styles.css**：样式文件，包含主题切换、响应式布局等样式规则。
- **script.js**：主要交互逻辑，包含播放列表的加载、频道管理、收藏功能、主题切换等。
- **favicon/**：网站图标文件，可根据需要替换。
- **images/**：存放网站需要的图片素材（如 Logo、项目截图等）。

---

## 快速开始

1. **下载或克隆本仓库**  
   ```bash
   git clone https://github.com/YourName/YourRepo.git
   ```
2. **部署到本地或服务器**  
   - **本地预览**：直接打开 `index.html` 即可在浏览器中访问（建议使用任意本地服务器工具打开，避免跨域问题）。  
   - **部署到服务器**：将所有文件上传到支持静态资源托管的服务器或服务平台（如 GitHub Pages、Vercel、Netlify 等），再通过 URL 访问即可。

3. **访问页面并使用**  
   - 默认预置两个直播源“直播源1”和“直播源2”，也可以在 **设置** 中添加自定义直播源。  
   - 选择一个直播源后，会自动加载频道列表并开始播放。

---

## 主要功能及使用

1. **选择或切换播放列表**  
   - 顶部栏右侧下拉菜单可以选择不同的直播源；  
   - 切换后会自动重新加载频道列表。

2. **频道列表**  
   - 在左侧或下方（根据屏幕大小自适应）展示所有频道，可使用搜索框输入关键字快速筛选。  
   - 点击频道项即可播放对应频道；点击频道右侧的“星形”图标可以收藏/取消收藏。

3. **收藏频道**  
   - 切换到“收藏频道”选项卡，仅显示已收藏的频道，方便集中管理。  
   - 收藏状态会保存在浏览器缓存，下次打开仍然有效。

4. **主题切换**  
   - 点击顶部的“☀️/🌙”图标即可切换浅色/暗色主题，偏好会保存在浏览器，页面重载后仍旧保持相同主题。

5. **折叠/展开频道列表**  
   - 通过顶部“☰/✖️”按钮可以收起或展开频道列表，折叠状态会保存在浏览器缓存。

6. **自定义直播源**  
   - 点击顶部“⚙️”打开“设置”，填入“名称”和完整的 m3u/m3u8 直播源链接即可添加；  
   - 成功添加后会在下拉菜单中自动出现该自定义源，并立刻加载。

7. **缓存清理**  
   - 在“设置”中点击“清理缓存”可清除本地缓存的所有设置和收藏频道，恢复到初始状态。

8. **移动端/键盘操作**  
   - **键盘**：上/下方向键切换频道，空格键暂停/播放；  
   - **手机滑动**：左右滑动播放器区域可切换上下一个频道；  
   - **上下频道按钮**：在移动端可用“上一个频道”和“下一个频道”按钮进行切换。

---

## 部分技术说明

- **Video.js**：使用 [Video.js](https://videojs.com/) 来作为 HLS 流的播放器内核，自动加载并解析 m3u8 文件。
- **LocalStorage**：使用浏览器的 LocalStorage 来存储：
  - 用户的主题偏好（深色/浅色）；  
  - 收藏频道列表；  
  - 是否折叠频道列表；  
  - 上一次选择的直播源和自定义直播源集合。
- **CORS 问题**：项目中已移除任何代理配置，如果直播源有跨域问题需自行在服务端或访问链接中处理。  
- **响应式布局**：通过媒体查询（`@media`）在移动端进行布局调整，确保在大屏幕和小屏幕设备上均能良好使用。

---

## 常见问题

1. **播放失败或无法加载频道**  
   - 检查直播源链接是否可正常访问；  
   - 确认浏览器或服务器端是否存在跨域限制；  
   - 某些直播源可能有地区限制，需要梯子或特定网络环境。

2. **收藏频道或自定义源未持久化**  
   - 请检查浏览器是否禁用 LocalStorage；  
   - 如果在无痕/隐私模式下，浏览器可能不会持久保存本地数据。

3. **添加自定义播放列表后没显示频道**  
   - 请确认所添加的链接是否含有有效的 m3u/m3u8 内容；  
   - 如果链接内容无可用频道或包含错误格式，页面将不会生成频道列表。

---

## 贡献与许可

- 欢迎提交代码、修复错误或贡献新功能。可以通过 Pull Request 的形式进行协作。  
- 仅用于学习与个人使用，直播源版权或政策相关问题请使用者自行负责。

---

祝你使用愉快！如果对本项目有任何疑问或建议，欢迎在 Issue 中交流。

---
