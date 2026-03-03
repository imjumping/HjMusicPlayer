// SPDX-License-Identifier: MIT

// script.js
(function() {
  // ---------- DOM 元素 ----------
  const playBtn = document.getElementById("playButton");
  const lyricContainer = document.getElementById("lyricContainer");
  const musicName = document.getElementById("musicname");
  const musicAuthor = document.getElementById("musicauthor");
  const progressBar = document.getElementById("progressBar");
  const progressContainer = document.getElementById("progressContainer");
  const progressHandle = document.getElementById("progressHandle");
  const timeDisplay = document.getElementById("timeDisplay");

  const lrcFileInput = document.getElementById("lrcFileInput");
  const selectFileBtn = document.getElementById("selectFileBtn");
  const selectedFileName = document.getElementById("selectedFileName");
  const uploadStatus = document.getElementById("uploadStatus");
  const desktopLyricBtn = document.getElementById('desktopLyricBtn');

  // ---------- 全局变量 ----------
  let isPlaying = false;
  let currentLyrics = [];
  let currentLyricIndex = -1;
  let currentWordIndex = -1;
  let lyricInterval = null;
  let startTime = 0;
  let currentTime = 0;
  let totalDuration = 0;
  let isDragging = false;
  let fadeTimer = null;
  let desktopLyricVisible = true;

  // ---------- 工具函数 ----------
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function showStatusMessage(html) {
    if (fadeTimer) clearTimeout(fadeTimer);
    uploadStatus.innerHTML = html;
    uploadStatus.classList.remove('hidden');
    fadeTimer = setTimeout(() => {
      uploadStatus.classList.add('hidden');
      fadeTimer = null;
    }, 5000);
  }

  // ---------- 歌词解析 ----------
  function processLyricLine(line, lyricLines) {
    const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/g;
    const matches = [...line.matchAll(timeRegex)];
    if (matches.length === 0) return;

    let lyricText = line;
    matches.forEach(m => lyricText = lyricText.replace(m[0], ''));
    lyricText = lyricText.trim();
    if (!lyricText) return;

    matches.forEach((match) => {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      const ms = parseInt(match[3]);
      const timeInSeconds = minutes * 60 + seconds + (match[3].length === 3 ? ms / 1000 : ms / 100);

      const words = [];
      const wordRegex = /<(\d+),(\d+)>([^<]+)|\[(\d+),(\d+)\]([^\[]+)/g;
      let wordMatch;

      while ((wordMatch = wordRegex.exec(lyricText)) !== null) {
        if (wordMatch[1] && wordMatch[2] && wordMatch[3]) {
          words.push({
            text: wordMatch[3].trim(),
            start: parseInt(wordMatch[1]) / 1000,
            end: parseInt(wordMatch[2]) / 1000
          });
        } else if (wordMatch[4] && wordMatch[5] && wordMatch[6]) {
          words.push({
            text: wordMatch[6].trim(),
            start: parseInt(wordMatch[4]) / 1000,
            end: parseInt(wordMatch[5]) / 1000
          });
        }
      }

      lyricLines.push({
        time: timeInSeconds,
        text: lyricText,
        words: words.length > 0 ? words : null
      });
    });
  }

  function parseLRC(lrcText, fileName) {
    currentLyrics = [];
    lyricContainer.innerHTML = "";

    let songName = fileName.replace(".lrc", "");
    let artist = "未知艺术家";

    const lines = lrcText.split("\n");
    const lyricLines = [];

    lines.forEach((line) => {
      if (line.startsWith("[ti:")) {
        songName = line.replace("[ti:", "").replace("]", "").trim();
      } else if (line.startsWith("[ar:")) {
        artist = line.replace("[ar:", "").replace("]", "").trim();
      } else {
        processLyricLine(line, lyricLines);
      }
    });

    lyricLines.sort((a, b) => a.time - b.time);

    if (lyricLines.length > 0) {
      currentLyrics = lyricLines;
      totalDuration = currentLyrics[currentLyrics.length - 1].time;
      if (totalDuration <= 0) totalDuration = 180;

      musicName.innerHTML = `歌曲：${songName}<span id="musicauthor">${artist}</span>`;
      renderLyrics();
      showStatusMessage(`<span class="success">✅ 成功加载 ${currentLyrics.length} 行歌词，总时长 ${formatTime(totalDuration)}</span>`);
    } else {
      showStatusMessage('<span class="error">⚠️ 未检测到时间标签</span>');
    }
  }

  function loadLRCFile(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      parseLRC(e.target.result, file.name);
      showStatusMessage('<span class="success" style="text-shadow:0 10px 10px rgba(0,0,0,0.5);">文件加载成功！(`OwO,)</span>');
    };
    reader.onerror = () => showStatusMessage('<span class="error">❌ 文件读取失败！</span>');
    reader.readAsText(file, 'utf-8');
  }

  // ---------- 渲染歌词 ----------
  function renderLyrics() {
    lyricContainer.innerHTML = "";
    currentLyrics.forEach((lyric, index) => {
      const lineDiv = document.createElement("div");
      lineDiv.className = "lyric-line unplayed";
      lineDiv.id = `lyric-${index}`;

      if (lyric.words && lyric.words.length > 0) {
        lyric.words.forEach((word, wordIndex) => {
          const wordSpan = document.createElement("span");
          wordSpan.className = "word";
          wordSpan.id = `word-${index}-${wordIndex}`;
          wordSpan.textContent = word.text + " ";
          lineDiv.appendChild(wordSpan);
        });
      } else {
        lineDiv.textContent = lyric.text;
      }
      lyricContainer.appendChild(lineDiv);
    });
    resetPlayback();
  }

  function resetPlayback() {
    if (lyricInterval) clearInterval(lyricInterval);
    isPlaying = false;
    playBtn.textContent = "▶";
    currentTime = 0;
    currentLyricIndex = -1;
    currentWordIndex = -1;
    startTime = 0;
    updateProgress(0);
    timeDisplay.textContent = `00:00 / ${formatTime(totalDuration)}`;
    document.querySelectorAll(".lyric-line").forEach(line => line.className = "lyric-line unplayed");
  }

  // ---------- 播放与更新 ----------
  function updateLyricsByTime(time) {
    let newIndex = -1;
    for (let i = currentLyrics.length - 1; i >= 0; i--) {
      if (time >= currentLyrics[i].time) {
        newIndex = i;
        break;
      }
    }

    if (newIndex !== currentLyricIndex) {
      document.querySelectorAll(".lyric-line").forEach((line, index) => {
        line.classList.remove("played", "unplayed", "current");
        if (index < newIndex) line.classList.add("played");
        else if (index === newIndex) {
          line.classList.add("current");
          setTimeout(() => line.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
        } else line.classList.add("unplayed");
      });
      currentLyricIndex = newIndex;
    }
  }

  function updateWordsByTime(time) {
    if (currentLyricIndex < 0) return;
    const currentLyric = currentLyrics[currentLyricIndex];
    if (!currentLyric.words) return;

    let newWordIndex = -1;
    for (let i = currentLyric.words.length - 1; i >= 0; i--) {
      if (time >= currentLyric.words[i].start) {
        newWordIndex = i;
        break;
      }
    }

    if (newWordIndex !== currentWordIndex) {
      currentLyric.words.forEach((word, idx) => {
        const el = document.getElementById(`word-${currentLyricIndex}-${idx}`);
        if (el) {
          el.classList.remove("played", "current-word");
          if (idx < newWordIndex) el.classList.add("played");
          else if (idx === newWordIndex) el.classList.add("current-word");
        }
      });
      currentWordIndex = newWordIndex;
    }
  }

  function updateProgress(value) {
    if (typeof value === "number") {
      const percentage = totalDuration > 0 ? (value / totalDuration) * 100 : 0;
      progressBar.style.width = Math.min(100, Math.max(0, percentage)) + "%";
      timeDisplay.textContent = `${formatTime(value)} / ${formatTime(totalDuration)}`;
    }
  }

  function startLyricScroll() {
    if (lyricInterval) clearInterval(lyricInterval);
    if (currentTime > totalDuration) {
      currentTime = 0;
      startTime = Date.now() / 1000;
    }

    lyricInterval = setInterval(() => {
      if (!isPlaying || currentLyrics.length === 0) return;
      currentTime = Date.now() / 1000 - startTime;
      if (currentTime < 0) currentTime = 0;
      if (currentTime >= totalDuration) {
        resetPlayback();
        return;
      }
      updateProgress(currentTime);
      updateLyricsByTime(currentTime);
      updateWordsByTime(currentTime);
      updateDesktopLyric();
    }, 50);
  }

  // ---------- 桌面歌词 (Electron) ----------
  function updateDesktopLyric() {
    if (!window.electronAPI) return;
    
    const currentLine = document.querySelector('.lyric-line.current');
    const nextLine = document.querySelector('.lyric-line.current + .lyric-line');
    
    let currentText = '', nextText = '', words = [];
    
    if (currentLine && currentLyricIndex >= 0 && currentLyrics[currentLyricIndex]) {
      const lyric = currentLyrics[currentLyricIndex];
      if (lyric.words && lyric.words.length > 0) {
        words = lyric.words.map((word, idx) => ({
          text: word.text,
          played: idx < currentWordIndex,
          current: idx === currentWordIndex
        }));
      } else {
        currentText = lyric.text;
      }
    }
    
    if (nextLine) {
      const nextIndex = currentLyricIndex + 1;
      if (nextIndex < currentLyrics.length) nextText = currentLyrics[nextIndex].text;
    }
    
    const songName = musicName.textContent.replace('歌曲：', '').split('<')[0] || '未知';
    const artist = document.getElementById('musicauthor')?.textContent || '未知';
    
    window.electronAPI.updateDesktopLyric({
      currentLine: currentText,
      nextLine: nextText,
      words: words,
      songName: songName,
      artist: artist,
      progress: totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0,
      lyrics: currentLyrics,
      currentIndex: currentLyricIndex
    });
  }

  // ---------- 事件绑定 ----------
  // 文件选择
  selectFileBtn.addEventListener("click", () => {
    lrcFileInput.click();
  });

  lrcFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith(".lrc")) {
        showStatusMessage('<span class="error">❌ 只允许上传.lrc文件！</span>');
        lrcFileInput.value = "";
        selectedFileName.textContent = "未选择文件";
        return;
      }
      selectedFileName.textContent = file.name;
      showStatusMessage('<span class="success">⏳ 正在加载LRC文件...</span>');
      loadLRCFile(file);
    } else {
      selectedFileName.textContent = "未选择文件";
      uploadStatus.innerHTML = "";
    }
  });

  // 播放/暂停
  playBtn.addEventListener("click", function() {
    if (currentLyrics.length === 0) {
      showStatusMessage('<span class="error">⚠️ 请先上传LRC文件</span>');
      return;
    }
    if (!isPlaying) {
      playBtn.textContent = "⏸";
      isPlaying = true;
      startTime = Date.now() / 1000 - currentTime;
      startLyricScroll();
    } else {
      playBtn.textContent = "▶";
      isPlaying = false;
      if (lyricInterval) clearInterval(lyricInterval);
    }
  });

  // 进度条拖拽
  function startDrag(e) {
    e.preventDefault();
    isDragging = true;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
  }

  function onDrag(e) {
    if (!isDragging) return;
    const rect = progressContainer.getBoundingClientRect();
    let pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    progressBar.style.width = pct + "%";
    currentTime = (pct / 100) * totalDuration;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
    if (isPlaying) startTime = Date.now() / 1000 - currentTime;
    updateLyricsByTime(currentTime);
    updateWordsByTime(currentTime);
    updateDesktopLyric();
  }

  function stopDrag() {
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);
  }

  progressContainer.addEventListener("mousedown", startDrag);
  progressHandle.addEventListener("mousedown", startDrag);

  progressContainer.addEventListener("click", (e) => {
    if (e.target === progressHandle) return;
    const rect = progressContainer.getBoundingClientRect();
    let pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    progressBar.style.width = pct + "%";
    currentTime = (pct / 100) * totalDuration;
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(totalDuration)}`;
    if (isPlaying) startTime = Date.now() / 1000 - currentTime;
    updateLyricsByTime(currentTime);
    updateWordsByTime(currentTime);
    updateDesktopLyric();
  });

  // 桌面歌词按钮
  desktopLyricBtn.addEventListener('click', () => {
    desktopLyricVisible = !desktopLyricVisible;
    desktopLyricBtn.style.opacity = desktopLyricVisible ? '1' : '0.5';
    desktopLyricBtn.style.backgroundColor = desktopLyricVisible ? 'rgba(0, 132, 255, 0.6)' : 'rgba(100, 100, 100, 0.6)';
    if (window.electronAPI) window.electronAPI.toggleDesktopLyric(desktopLyricVisible);
  });

  // 窗口控制 (Electron)
  if (window.electronAPI) {
    document.getElementById("minihua").addEventListener("click", () => window.electronAPI.minimizeWindow());
    const maxBtn = document.getElementById("maxhua");
    maxBtn.addEventListener("click", () => window.electronAPI.maximizeWindow());
    window.electronAPI.onMaximize((isMaximized) => maxBtn.textContent = isMaximized ? "😤" : "🙄");
    document.getElementById("closehua").addEventListener("click", () => window.electronAPI.closeWindow());
  }
})();