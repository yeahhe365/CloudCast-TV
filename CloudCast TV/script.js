(function () {
  // DOM 元素
  const channelList = document.getElementById("channel-list");
  const playerElement = document.getElementById("my-video");
  const loadingIndicator = document.getElementById("loading-indicator");
  const searchInput = document.getElementById("search-input");
  const themeToggle = document.getElementById("theme-toggle");
  const toggleChannelListBtn = document.getElementById("toggle-channel-list");
  const channelListContainer = document.getElementById("channel-list-container");
  const playlistSelect = document.getElementById("playlist-select");
  const prevChannelBtn = document.getElementById("prev-channel");
  const nextChannelBtn = document.getElementById("next-channel");
  const allChannelsTab = document.getElementById("all-channels-tab");
  const favoriteChannelsTab = document.getElementById("favorite-channels-tab");
  const settingsButton = document.getElementById("settings-button");
  const settingsModal = document.getElementById("settings-modal");
  const closeSettingsBtn = document.getElementById("close-settings");
  const clearCacheBtn = document.getElementById("clear-cache");
  const playbackUserAgentInput = document.getElementById("playback-user-agent");
  const playbackProxyTemplateInput = document.getElementById("playback-proxy-template");
  const savePlaybackUserAgentBtn = document.getElementById("save-playback-user-agent");
  const playbackUaStatus = document.getElementById("playback-ua-status");

  // **新增：自定义直播源相关 DOM**
  const customPlaylistNameInput = document.getElementById("custom-playlist-name");
  const customPlaylistUrlInput = document.getElementById("custom-playlist-url");
  const addCustomPlaylistBtn = document.getElementById("add-custom-playlist");

  // 频道相关数据
  let channels = [];
  let currentChannelIndex = -1;
  let favorites = new Set();
  let currentPlaylistUrl = ''; // 将在初始化时设置
  let isShowingFavorites = false; // 是否显示收藏频道
  let playbackUserAgent = "";
  let playbackProxyTemplate = "";
  const PLAYBACK_USER_AGENT_KEY = "playbackUserAgent";
  const PLAYBACK_PROXY_TEMPLATE_KEY = "playbackProxyTemplate";

  // 定义播放列表选项（移除 CORS 代理）
  const playlistOptions = [
    { name: '直播源1', url: 'https://raw.githubusercontent.com/hujingguang/ChinaIPTV/main/cnTV_AutoUpdate.m3u8' },
    { name: '直播源2', url: 'https://ghgo.xyz/raw.githubusercontent.com/joevess/IPTV/main/home.m3u8' },
  ];

  // Video.js 播放器实例
  const player = videojs(playerElement, {
    html5: {
      hls: {
        overrideNative: true,
      },
    },
    autoplay: true,
    muted: true,
    controls: true,
    preload: "auto",
  });

  function normalizePlaybackUserAgent(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 512);
  }

  function normalizePlaybackProxyTemplate(value) {
    return String(value || "").trim().slice(0, 1024);
  }

  function replaceTemplateToken(template, token, value) {
    return template.split(token).join(value);
  }

  function initPlaybackUserAgent() {
    playbackUserAgent = normalizePlaybackUserAgent(
      localStorage.getItem(PLAYBACK_USER_AGENT_KEY)
    );
    playbackProxyTemplate = normalizePlaybackProxyTemplate(
      localStorage.getItem(PLAYBACK_PROXY_TEMPLATE_KEY)
    );
    if (playbackUserAgentInput) {
      playbackUserAgentInput.value = playbackUserAgent;
    }
    if (playbackProxyTemplateInput) {
      playbackProxyTemplateInput.value = playbackProxyTemplate;
    }
    applyPlaybackUserAgent();
  }

  function createPlaybackRequestHook() {
    return function beforeRequest(options) {
      if (!playbackUserAgent) {
        return options;
      }

      return {
        ...options,
        headers: {
          ...(options.headers || {}),
          "User-Agent": playbackUserAgent,
        },
      };
    };
  }

  function applyPlaybackUserAgent() {
    const beforeRequest = createPlaybackRequestHook();

    if (window.videojs?.Vhs?.xhr) {
      window.videojs.Vhs.xhr.beforeRequest = beforeRequest;
    }
    if (window.videojs?.Hls?.xhr) {
      window.videojs.Hls.xhr.beforeRequest = beforeRequest;
    }

    const tech = player.tech?.({ IWillNotUseThisInPlugins: true });
    if (tech?.vhs?.xhr) {
      tech.vhs.xhr.beforeRequest = beforeRequest;
    }
    if (tech?.hls?.xhr) {
      tech.hls.xhr.beforeRequest = beforeRequest;
    }
  }

  function resolvePlaybackUrl(streamUrl) {
    if (!playbackUserAgent || !playbackProxyTemplate) {
      return streamUrl;
    }

    return replaceTemplateToken(
      replaceTemplateToken(playbackProxyTemplate, "{url}", encodeURIComponent(streamUrl)),
      "{ua}",
      encodeURIComponent(playbackUserAgent)
    );
  }

  /**
   * 初始化收藏频道
   */
  function initFavorites() {
    try {
      const storedFavorites = localStorage.getItem("favoriteChannels");
      if (storedFavorites) {
        const favArray = JSON.parse(storedFavorites);
        favorites = new Set(favArray);
      }
    } catch (e) {
      console.error("无法解析收藏频道数据:", e);
      favorites = new Set();
    }
  }

  /**
   * 保存收藏频道
   */
  function saveFavorites() {
    try {
      localStorage.setItem(
        "favoriteChannels",
        JSON.stringify(Array.from(favorites))
      );
    } catch (e) {
      console.error("无法保存收藏频道:", e);
    }
  }

  /**
   * 显示/隐藏加载指示器
   */
  function showLoading(show) {
    if (show) {
      loadingIndicator.classList.add("active");
    } else {
      loadingIndicator.classList.remove("active");
    }
  }

  /**
   * 验证是否为有效的HTTP/HTTPS URL（简化处理，不包含IPv6）
   */
  function isValidHttpUrl(str) {
    try {
      const url = new URL(str);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.hostname.includes(":")
      );
    } catch (err) {
      return false;
    }
  }

  /**
   * 从一行文本中获取URL
   */
  function parseM3ULine(line) {
    const trimmed = line.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      return trimmed;
    }
    return null;
  }

  /**
   * 提取 EXTINF 中的 tvg 信息
   */
  function extractTvgInfo(extinf) {
    const logoMatch = extinf.match(/tvg-logo="([^"]+)"/i);
    const nameMatch = extinf.match(/tvg-name="([^"]+)"/i);
    return {
      logo: logoMatch ? logoMatch[1] : null,
      name: nameMatch ? nameMatch[1] : null,
    };
  }

  /**
   * 创建频道项
   */
  function createChannelItem(title, tvgInfo, channel) {
    const listItem = document.createElement("li");
    listItem.className = "channel-item";

    const button = document.createElement("button");
    button.setAttribute("aria-label", title);
    button.setAttribute("data-channel-url", channel.url);
    button.classList.add("channel-button");

    // 频道图标
    if (tvgInfo.logo) {
      const img = document.createElement("img");
      img.src = tvgInfo.logo;
      img.alt = `${title} Logo`;
      img.className = "channel-icon";
      img.loading = "lazy";
      img.onerror = function () {
        this.style.display = "none";
      };
      button.appendChild(img);
    }

    // 频道信息
    const infoDiv = document.createElement("div");
    infoDiv.className = "channel-info";

    const nameSpan = document.createElement("span");
    nameSpan.className = "channel-name";
    nameSpan.textContent = tvgInfo.name || title;
    infoDiv.appendChild(nameSpan);

    if (tvgInfo.name && tvgInfo.name !== title) {
      const descSpan = document.createElement("span");
      descSpan.className = "channel-description";
      descSpan.textContent = title;
      infoDiv.appendChild(descSpan);
    }

    button.appendChild(infoDiv);

    // 收藏图标
    const favoriteIcon = document.createElement("span");
    favoriteIcon.className = "favorite-icon";
    favoriteIcon.setAttribute("aria-label", "收藏频道");
    favoriteIcon.setAttribute("tabindex", "0");
    favoriteIcon.innerHTML = favorites.has(channel.url) ? "&#9733;" : "&#9734;";
    if (favorites.has(channel.url)) {
      favoriteIcon.classList.add("active");
    }
    button.appendChild(favoriteIcon);

    listItem.appendChild(button);
    channelList.appendChild(listItem);
  }

  /**
   * 解析 M3U8 播放列表
   */
  function parsePlaylist(data) {
    const lines = data.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.toUpperCase().startsWith("#EXTINF")) {
        // 提取频道信息
        const extinf = line;
        const tvgInfo = extractTvgInfo(extinf);

        // 解析频道标题
        const titleMatch = extinf.match(/,(.*)$/);
        const title = titleMatch ? titleMatch[1].trim() : "未知频道";
        let url = null;

        // 寻找下一行有效URL
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (!nextLine || nextLine.startsWith("#")) {
            continue;
          }
          const possibleUrl = parseM3ULine(nextLine);
          if (possibleUrl && isValidHttpUrl(possibleUrl)) {
            url = possibleUrl;
            break;
          }
        }

        // 如果找到有效URL且尚未存在于 channels 列表，加入
        if (url && !channels.find((ch) => ch.url === url)) {
          const channel = { title, url, tvgInfo };
          channels.push(channel);
          createChannelItem(title, tvgInfo, channel);
        }
      }
    }
  }

  /**
   * 载入播放列表
   */
  async function loadPlaylist(playlistUrl) {
    try {
      showLoading(true);
      const response = await fetch(playlistUrl);
      if (!response.ok) {
        throw new Error(`网络响应不是 OK: ${response.status}`);
      }
      const data = await response.text();
      parsePlaylist(data);

      if (channels.length > 0) {
        // **新增：尝试从 localStorage 中获取最后播放的频道**
        const lastChannelUrl = localStorage.getItem("lastChannelUrl");
        let indexToPlay = 0; // 默认播放第一个频道
        if (lastChannelUrl) {
          const foundIndex = channels.findIndex(ch => ch.url === lastChannelUrl);
          if (foundIndex !== -1) {
            indexToPlay = foundIndex;
          }
        }
        playChannel(indexToPlay);
      } else {
        // 不显示错误消息
        console.error("未检测到任何有效频道。");
      }
    } catch (err) {
      console.error(err);
      // 不显示错误消息
    } finally {
      showLoading(false);
    }
  }

  /**
   * 播放指定频道
   */
  function playChannel(index, options = {}) {
    if (index < 0 || index >= channels.length) return;
    const forceReload = options.forceReload === true;
    if (index === currentChannelIndex && !forceReload) {
      // 正在播放当前频道，无需再次播放
      return;
    }

    currentChannelIndex = index;
    const channel = channels[index];
    showLoading(true);
    applyPlaybackUserAgent();

    // 设置播放器源
    player.src({
      type: "application/x-mpegURL",
      src: resolvePlaybackUrl(channel.url),
    });

    // 尝试播放
    player
      .play()
      .then(() => {
        updateChannelActive(channel.url);
        showLoading(false);
        // **新增：保存当前播放的频道URL到 localStorage**
        localStorage.setItem("lastChannelUrl", channel.url);
      })
      .catch((error) => {
        console.error("播放失败: ", error);
        showLoading(false);
        // 不显示错误消息
      });
  }

  /**
   * 高亮当前播放频道
   */
  function updateChannelActive(channelUrl) {
    const buttons = channelList.querySelectorAll(".channel-button");
    buttons.forEach((btn) => btn.classList.remove("active"));
    const activeButton = channelList.querySelector(
      `.channel-button[data-channel-url="${CSS.escape(channelUrl)}"]`
    );
    if (activeButton) {
      activeButton.classList.add("active");
      activeButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }

  /**
   * 切换收藏状态
   */
  function toggleFavorite(favoriteIcon) {
    const button = favoriteIcon.closest(".channel-button");
    const channelUrl = button.getAttribute("data-channel-url");
    if (!channelUrl) return;

    if (favorites.has(channelUrl)) {
      favorites.delete(channelUrl);
      favoriteIcon.classList.remove("active");
      favoriteIcon.innerHTML = "&#9734;"; // ☆
    } else {
      favorites.add(channelUrl);
      favoriteIcon.classList.add("active");
      favoriteIcon.innerHTML = "&#9733;"; // ★
    }
    saveFavorites();

    // 如果当前在收藏频道视图，更新显示
    if (isShowingFavorites) {
      filterChannels();
    }
  }

  /**
   * 频道列表上的事件监听
   */
  function setupChannelListClick() {
    channelList.addEventListener("click", (event) => {
      const favoriteIcon = event.target.closest(".favorite-icon");
      if (favoriteIcon) {
        toggleFavorite(favoriteIcon);
        return;
      }

      const button = event.target.closest(".channel-button");
      if (!button) return;
      const channelUrl = button.getAttribute("data-channel-url");
      if (channelUrl) {
        const index = channels.findIndex((ch) => ch.url === channelUrl);
        if (index !== -1) {
          playChannel(index);
        }
      }
    });

    // 键盘事件（收藏 & 播放）
    channelList.addEventListener("keydown", (event) => {
      const favoriteIcon = event.target.closest(".favorite-icon");
      if (favoriteIcon && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        toggleFavorite(favoriteIcon);
        return;
      }

      const button = event.target.closest('.channel-button[data-channel-url]');
      if (button && event.key === "Enter") {
        event.preventDefault();
        const channelUrl = button.getAttribute("data-channel-url");
        const index = channels.findIndex((ch) => ch.url === channelUrl);
        if (index !== -1) {
          playChannel(index);
        }
      }
    });
  }

  /**
   * 键盘全局事件处理
   */
  function handleKeyDown(e) {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        if (currentChannelIndex > 0) {
          playChannel(currentChannelIndex - 1);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (currentChannelIndex < channels.length - 1) {
          playChannel(currentChannelIndex + 1);
        }
        break;
      case " ":
        // 使用空格键进行播放/暂停
        e.preventDefault();
        if (player.paused()) {
          player.play();
        } else {
          player.pause();
        }
        break;
      default:
        break;
    }
  }

  /**
   * 防抖函数
   */
  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

  /**
   * 触摸滑动事件（左右切换频道）
   */
  function setupTouchEvents() {
    let touchStartX = 0;
    let touchEndX = 0;

    playerElement.addEventListener(
      "touchstart",
      function (e) {
        touchStartX = e.changedTouches[0].screenX;
      },
      false
    );

    playerElement.addEventListener(
      "touchend",
      function (e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      },
      false
    );

    function handleSwipe() {
      const swipeThreshold = 50; // 最小滑动距离
      const deltaX = touchEndX - touchStartX;
      if (Math.abs(deltaX) > swipeThreshold) {
        if (deltaX < 0) {
          // 向左滑 -> 下一个频道
          if (currentChannelIndex < channels.length - 1) {
            playChannel(currentChannelIndex + 1);
          }
        } else {
          // 向右滑 -> 上一个频道
          if (currentChannelIndex > 0) {
            playChannel(currentChannelIndex - 1);
          }
        }
      }
    }
  }

  /**
   * 上/下频道按钮事件
   */
  function setupControlButtons() {
    prevChannelBtn.addEventListener("click", () => {
      if (currentChannelIndex > 0) {
        playChannel(currentChannelIndex - 1);
      }
    });

    nextChannelBtn.addEventListener("click", () => {
      if (currentChannelIndex < channels.length - 1) {
        playChannel(currentChannelIndex + 1);
      }
    });
  }

  /**
   * 搜索功能
   */
  function setupSearchFunction() {
    searchInput.addEventListener("input", debounce(function () {
      filterChannels();
    }, 300));
  }

  /**
   * 过滤频道列表，根据搜索关键词和是否显示收藏频道
   */
  function filterChannels() {
    const query = searchInput.value.toLowerCase();
    const items = channelList.querySelectorAll(".channel-item");
    items.forEach((item) => {
      const channelName = item.querySelector(".channel-name").textContent.toLowerCase();
      const channelUrl = item.querySelector(".channel-button").getAttribute("data-channel-url");
      const isFavorite = favorites.has(channelUrl);
      const matchesQuery = channelName.includes(query);
      const shouldDisplay = matchesQuery && (!isShowingFavorites || isFavorite);
      item.style.display = shouldDisplay ? "flex" : "none";
    });
  }

  /**
   * 主题切换功能
   */
  function setupThemeToggle() {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme === "dark") {
      document.documentElement.classList.add("dark");
      themeToggle.textContent = "☀️";
      themeToggle.setAttribute("aria-label", "切换到浅色主题");
    } else {
      document.documentElement.classList.remove("dark");
      themeToggle.textContent = "🌙";
      themeToggle.setAttribute("aria-label", "切换到暗色主题");
    }

    themeToggle.addEventListener("click", () => {
      const isDark = document.documentElement.classList.toggle("dark");
      if (isDark) {
        themeToggle.textContent = "☀️";
        themeToggle.setAttribute("aria-label", "切换到浅色主题");
        localStorage.setItem("theme", "dark");
      } else {
        themeToggle.textContent = "🌙";
        themeToggle.setAttribute("aria-label", "切换到暗色主题");
        localStorage.setItem("theme", "light");
      }
    });
  }

  /**
   * 频道列表展开/折叠功能
   */
  function setupChannelListToggle() {
    // 读取存储的状态
    const isCollapsed = localStorage.getItem("channelListCollapsed") === "true";
    if (isCollapsed) {
      channelListContainer.classList.add("collapsed");
      toggleChannelListBtn.textContent = "☰"; // 展开图标
      toggleChannelListBtn.setAttribute("aria-label", "展开频道列表");
    } else {
      channelListContainer.classList.remove("collapsed");
      toggleChannelListBtn.textContent = "✖️"; // 折叠图标
      toggleChannelListBtn.setAttribute("aria-label", "收起频道列表");
    }

    toggleChannelListBtn.addEventListener("click", () => {
      const collapsed = channelListContainer.classList.toggle("collapsed");
      localStorage.setItem("channelListCollapsed", collapsed);

      // 更新按钮图标和 ARIA 标签
      toggleChannelListBtn.textContent = collapsed ? "☰" : "✖️";
      toggleChannelListBtn.setAttribute("aria-label", collapsed ? "展开频道列表" : "收起频道列表");
    });
  }

  /**
   * 播放列表选择功能
   */
  function setupPlaylistSelect() {
    // 清空现有选项
    playlistSelect.innerHTML = '';

    // 动态添加选项
    playlistOptions.forEach(option => {
      const opt = document.createElement('option');
      opt.value = option.url;
      opt.textContent = option.name;
      playlistSelect.appendChild(opt);
    });

    // 初始化自定义直播源
    initCustomPlaylists();

    // 读取存储的播放列表选择
    const storedPlaylist = localStorage.getItem("selectedPlaylist");
    if (storedPlaylist) {
      playlistSelect.value = storedPlaylist;
      currentPlaylistUrl = storedPlaylist;
    } else {
      // 默认选择第一个选项
      currentPlaylistUrl = playlistOptions[0].url;
    }

    playlistSelect.addEventListener("change", () => {
      const selectedUrl = playlistSelect.value;
      if (selectedUrl !== currentPlaylistUrl) {
        currentPlaylistUrl = selectedUrl;
        localStorage.setItem("selectedPlaylist", selectedUrl);
        // 清空现有频道
        channels = [];
        channelList.innerHTML = "";
        // 载入新播放列表
        loadPlaylist(currentPlaylistUrl);
      }
    });
  }

  /**
   * 初始化自定义直播源：从 localStorage 读取并添加到 playlistSelect
   */
  function initCustomPlaylists() {
    const customPlaylistsJson = localStorage.getItem("customPlaylists");
    if (customPlaylistsJson) {
      try {
        const customPlaylists = JSON.parse(customPlaylistsJson);
        customPlaylists.forEach((item) => {
          addOptionToPlaylistSelect(item.name, item.url);
        });
      } catch (e) {
        console.error("自定义直播源解析失败：", e);
      }
    }
  }

  /**
   * 给 playlist-select 添加一个 option
   */
  function addOptionToPlaylistSelect(name, url) {
    const option = document.createElement("option");
    option.value = url;
    option.textContent = name;
    playlistSelect.appendChild(option);
  }

  /**
   * 设置频道列表选项卡功能
   */
  function setupChannelTabs() {
    allChannelsTab.addEventListener("click", () => {
      if (!allChannelsTab.classList.contains("active")) {
        allChannelsTab.classList.add("active");
        favoriteChannelsTab.classList.remove("active");
        isShowingFavorites = false;
        filterChannels();
      }
    });

    favoriteChannelsTab.addEventListener("click", () => {
      if (!favoriteChannelsTab.classList.contains("active")) {
        favoriteChannelsTab.classList.add("active");
        allChannelsTab.classList.remove("active");
        isShowingFavorites = true;
        filterChannels();
      }
    });
  }

  /**
   * 设置设置按钮和模态窗口功能
   */
  function setupSettings() {
    settingsButton.addEventListener("click", () => {
      if (playbackUserAgentInput) {
        playbackUserAgentInput.value = playbackUserAgent;
      }
      if (playbackProxyTemplateInput) {
        playbackProxyTemplateInput.value = playbackProxyTemplate;
      }
      if (playbackUaStatus) {
        playbackUaStatus.textContent = "";
      }
      openSettingsModal();
    });

    closeSettingsBtn.addEventListener("click", () => {
      closeSettingsModal();
    });

    // 点击模态窗口外部关闭
    window.addEventListener("click", (event) => {
      if (event.target === settingsModal) {
        closeSettingsModal();
      }
    });

    // 清理缓存功能
    clearCacheBtn.addEventListener("click", () => {
      if (confirm("确定要清理缓存吗？这将删除所有收藏的频道和设置。")) {
        localStorage.clear();
        location.reload();
      }
    });

    if (
      savePlaybackUserAgentBtn &&
      playbackUserAgentInput &&
      playbackProxyTemplateInput &&
      playbackUaStatus
    ) {
      savePlaybackUserAgentBtn.addEventListener("click", () => {
        playbackUserAgent = normalizePlaybackUserAgent(playbackUserAgentInput.value);
        playbackProxyTemplate = normalizePlaybackProxyTemplate(
          playbackProxyTemplateInput.value
        );
        if (playbackProxyTemplate && !playbackProxyTemplate.includes("{url}")) {
          playbackUaStatus.textContent = "播放代理模板需要包含 {url} 占位符。";
          return;
        }
        if (playbackUserAgent) {
          localStorage.setItem(PLAYBACK_USER_AGENT_KEY, playbackUserAgent);
        } else {
          localStorage.removeItem(PLAYBACK_USER_AGENT_KEY);
        }
        if (playbackProxyTemplate) {
          localStorage.setItem(PLAYBACK_PROXY_TEMPLATE_KEY, playbackProxyTemplate);
        } else {
          localStorage.removeItem(PLAYBACK_PROXY_TEMPLATE_KEY);
        }
        applyPlaybackUserAgent();

        if (currentChannelIndex !== -1) {
          playChannel(currentChannelIndex, { forceReload: true });
        }

        if (!playbackUserAgent) {
          playbackUaStatus.textContent = "已清空自定义播放 UA。";
        } else if (playbackProxyTemplate) {
          playbackUaStatus.textContent = "播放 UA 与代理模板已保存，当前频道已重新加载。";
        } else {
          playbackUaStatus.textContent =
            "播放 UA 已保存。浏览器可能拦截 User-Agent，建议配置播放代理模板。";
        }
      });
    }

    // 添加自定义直播源事件
    addCustomPlaylistBtn.addEventListener("click", () => {
      const customName = customPlaylistNameInput.value.trim();
      const customUrl = customPlaylistUrlInput.value.trim();

      if (!customName || !customUrl) {
        alert("请填写名称和链接！");
        return;
      }
      if (!isValidHttpUrl(customUrl)) {
        alert("请输入有效的直播源链接（http 或 https 开头）");
        return;
      }

      // 将新的直播源保存到 localStorage
      const customPlaylistsJson = localStorage.getItem("customPlaylists");
      let customPlaylists = [];
      if (customPlaylistsJson) {
        try {
          customPlaylists = JSON.parse(customPlaylistsJson);
        } catch (e) {
          console.error("自定义直播源解析失败：", e);
        }
      }

      // 防止重复添加相同名称+链接
      const alreadyExists = customPlaylists.some(
        (item) => item.url === customUrl || item.name === customName
      );
      if (alreadyExists) {
        alert("该自定义直播源已存在，或者名称/链接重复！");
        return;
      }

      // 加入并存储
      customPlaylists.push({ name: customName, url: customUrl });
      localStorage.setItem("customPlaylists", JSON.stringify(customPlaylists));
      
      // 在下拉框中新增并选中
      addOptionToPlaylistSelect(customName, customUrl);
      playlistSelect.value = customUrl;
      localStorage.setItem("selectedPlaylist", customUrl);

      // 切换到新源并加载
      currentPlaylistUrl = playlistSelect.value;
      channels = [];
      channelList.innerHTML = "";
      loadPlaylist(currentPlaylistUrl);

      // 清空输入框
      customPlaylistNameInput.value = "";
      customPlaylistUrlInput.value = "";
      alert(`已添加自定义直播源：${customName}`);
    });
  }

  function openSettingsModal() {
    settingsModal.classList.add("active");
    settingsModal.setAttribute("aria-hidden", "false");
  }

  function closeSettingsModal() {
    settingsModal.classList.remove("active");
    settingsModal.setAttribute("aria-hidden", "true");
  }

  /**
   * 初始化
   */
  function init() {
    initFavorites();
    setupChannelListClick();
    setupControlButtons();
    setupTouchEvents();
    setupSearchFunction();
    setupThemeToggle();
    setupChannelListToggle();
    setupChannelTabs();
    initPlaybackUserAgent();
    setupSettings();
    setupPlaylistSelect(); // 放在最后，确保都初始化后再去加载

    // 载入默认/上次选择的播放列表
    loadPlaylist(currentPlaylistUrl);

    document.addEventListener("keydown", handleKeyDown);

    // 监听播放器事件
    player.on("playing", () => {
      showLoading(false);
    });
    player.on("pause", () => {
      showLoading(false);
    });
    player.on("waiting", () => {
      showLoading(true);
    });

    // **新增：监听可见性变化事件以优化后台播放**
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        // 页面重新可见时，尝试恢复播放
        if (player.paused()) {
          player.play().catch((error) => {
            console.error("恢复播放失败:", error);
          });
        }
      } else {
        // 页面进入后台时，可以选择暂停播放以节省资源
        // 如果不希望暂停，可以注释掉以下代码
        // player.pause();
      }
    });

    // **新增：监听播放器错误事件以尝试恢复播放**
    player.on("error", () => {
      const error = player.error();
      console.error("播放器错误:", error);
      // 尝试重新加载当前频道
      if (currentChannelIndex !== -1) {
        playChannel(currentChannelIndex);
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
