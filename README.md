# 光遇小工具中心 Sky Tools Hub

這個專案是給《Sky 光遇》玩家使用的小工具網站，集中放置身高查詢、攻略整理與未來可能新增的功能。

Website: https://andyyang012.github.io/sky/

## 目前功能

- **身高查詢**：解析 Sky QR code 連結中的 `o=` token，換算角色 height、scale 與預估身高。
- **小金人攻略（未完成）**：依地圖整理攻略影片，方便玩家補齊小金人與翼能量。
- **中英切換**：主畫面與身高查詢頁支援繁中 / English，並會記住使用者選擇。
- **Discord 社群連結**：提供玩家回報問題與交流使用。

## 頁面

- `index.html`：主畫面與工具入口。
- `height.html`：身高查詢工具。
- `golden-guide.html`：小金人攻略影片頁。

## 小金人攻略影片上傳規則

影片檔需要放在 `videos/` 資料夾，且檔名必須和 `golden-guide.html` 裡 `GUIDE_VIDEOS` 設定的 `file` 路徑完全一致。

建議命名格式：

```text
videos/isle-of-dawn.mp4
videos/isle-of-dawn-01.mp4
videos/daylight-prairie-02.mp4
```

命名原則：

- 使用小寫英文、數字與連字號 `-`。
- 副檔名使用 `.mp4`。
- 避免空白、中文檔名、全形符號與大小寫混用。
- GitHub Pages 路徑會區分大小寫，所以 `Videos/File.MP4` 和 `videos/file.mp4` 是不同檔案。

新增影片時，在 `golden-guide.html` 的 `GUIDE_VIDEOS` 加一筆：

```js
{
  title: "晨島 2",
  description: "補充路線。",
  file: "videos/isle-of-dawn-02.mp4"
}
```

## 維護注意

- GitHub Pages 是靜態網站，不能自動掃描資料夾列出影片。
- 如果影片沒有出現，優先檢查 `file` 路徑、檔名大小寫、資料夾位置與副檔名是否一致。
- 目前 `main` 分支需要透過 Pull Request 更新。

## 社群

Discord: https://discord.gg/MWJ3z2HMRY

## Disclaimer

本工具與 thatgamecompany 無關，僅供玩家交流與學習使用。

This project is not affiliated with thatgamecompany. It is for player sharing and learning only.
