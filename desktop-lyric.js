// SPDX-License-Identifier: MIT

// desktop-lyric.js
(function() {
  const container = document.getElementById("lyricContainer");
  const songInfo = document.getElementById("songInfo");
  const currentLine = document.getElementById("currentLine");
  const nextLine = document.getElementById("nextLine");
  const progressFill = document.getElementById("progressFill");
  const closeBtn = document.getElementById("closeBtn");

  // 监听歌词更新
  if (window.electronAPI && window.electronAPI.onLyricUpdate) {
    window.electronAPI.onLyricUpdate((data) => {
      updateLyric(data);
    });
  }

  function updateLyric(data) {
    // 更新歌曲信息
    if (data.songName) {
      songInfo.textContent = `${data.songName} - ${data.artist || "未知艺术家"}`;
    }
    
    // 更新进度条
    if (data.progress !== undefined) {
      progressFill.style.width = data.progress + "%";
    }

    // 更新当前行（支持逐字歌词）
    currentLine.innerHTML = "";
    if (data.words && data.words.length > 0) {
      data.words.forEach((word) => {
        const span = document.createElement("span");
        span.className = "word";
        if (word.played) span.classList.add("played");
        if (word.current) span.classList.add("current");
        span.textContent = word.text + " ";
        currentLine.appendChild(span);
      });
    } else if (data.currentLine) {
      currentLine.textContent = data.currentLine;
    } else {
      const waiting = document.createElement("span");
      waiting.className = "waiting";
      waiting.textContent = "🎵 等待歌词 🎵";
      currentLine.appendChild(waiting);
    }

    // 更新下一行
    nextLine.textContent = data.nextLine || "";
  }

  // 关闭按钮点击
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (window.electronAPI && window.electronAPI.toggleDesktopLyric) {
      window.electronAPI.toggleDesktopLyric(false);
    }
  });
})();