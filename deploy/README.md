# 云服务器与 Node.js 托管配置

`service-config.enc.json` 是本地服务配置的 AES-256-GCM 加密备份，包含图片及视频各服务的密钥、模型、地址和当前所选服务。`service-settings.json` 是不含密钥的可读清单。

解密密钥保存在仓库的 GitHub Actions Secret：`ZHJ_DEPLOYMENT_KEY`。本机另有 Windows 加密副本 `.share/deployment-sync-key.dpapi`，不进入 Git。不要把解密密钥写入代码、前端 JS 或提交历史。

## 部署时必须设置

在目标托管平台的服务端环境变量中注入 `ZHJ_DEPLOYMENT_KEY`，再运行 `npm start`。如果经 GitHub Actions 部署，工作流可通过 `${{ secrets.ZHJ_DEPLOYMENT_KEY }}` 获取并安全注入目标服务器。**GitHub Secrets 不会自动变成托管平台的环境变量**；具体注入方式须按最终平台或服务器连接方式配置。

后台启动时先读取服务器已有的加密运行配置；首次部署没有运行配置时，从此加密备份恢复。服务器后续保存设置使用同一环境密钥进行 AES-GCM 加密，可在 Linux 使用。必须持久保存 `.share/` 与 `generated/` 并保持环境密钥稳定。已有 Windows 本地 DPAPI 配置照常工作。

## 当前本机中转依赖

当前主用图片服务是 Sub2API，地址是 `http://127.0.0.1:8080/v1`。这里的 API key 属于该中转，不能自动替代中转中配置的上游账号。

在云端达到相同效果，需要同时部署原 Sub2API 中转并迁移其必要账户/模型配置，或使用已部署且可访问的同一中转。仅克隆本仓库不能提供这项中转服务。

- 同机部署中转并仍监听 `127.0.0.1:8080` 时，原地址可沿用。
- 若中转在另一主机或容器，设置服务端环境变量 `SUB2API_BASE_URL` 为可访问的 `/v1` 地址。此变量只覆盖加密备份里的 Sub2API 地址，保留原密钥与模型。
- 中转更换后密钥必须属于新中转，不同中转的密钥不能互用。

## 部署检查

```sh
node tools/check-deployment-config.mjs
node tools/check-deployment-config.mjs --network
```

网络检查只访问图片服务的模型列表，不发送图片或生成任务，不消耗生图次数。输出只显示是否已配置、模型名和连接状态，不显示密钥。

## 其他运行条件

- 允许提交任务的网站地址保存在 `deploy/site-config.json`，当前为 `https://a17ca245dd955fa7e.app.workbuddy.host`。换域名后更新这个文件，或设置 `PUBLIC_ORIGIN=https://你的完整网站域名` 后重启。该值是用户浏览器打开的网址，不是图片接口地址。不读取不受信任的转发头，也不放开任意来源；本机入口及提示词后台原有访问限制保留。
- 更新代码后必须在 WorkBuddy 重新部署/重启 Node 服务，单独保存密钥不会更新任务入口。若仍提示来源不允许，请确认运行的是最新的 `server.mjs` 和 `request-source.mjs`。

- Node.js 22 或更新版本。
- 后端默认监听 `127.0.0.1:4173`，云服务器应通过带访问控制的 HTTPS 反向代理转发；还需提供目标域名和服务器/平台信息才能完成上线配置。
- 托管平台如要求监听所有网卡，可设置 `HOST=0.0.0.0`，同时使用平台的访问控制。`PORT` 沿用平台注入的端口。
- 内置面料、场景、产品机位、工艺示意和默认褶皱参考已随仓库提供。部署时须保留 `dist/assets/` 和清单中的两个 `styling-references/` 文件；不要在构建时只复制 JS/CSS。可运行 `node tools/check-builtin-assets.mjs --http` 验证完整性。用户上传、生成图片视频、原始素材源文件和旧版备份仍不入 Git。
- 视频剪辑需要在**实际运行网站的云端**安装 FFmpeg。先运行 `npm ci`，再运行 `npm run check:video`，最后运行 `npm start`；`ffmpeg-static` 会按部署机器的平台安装程序。安装时需允许依赖的安装脚本，并能访问其二进制下载地址。本机 Windows 的程序不会自动迁移到 Linux。
- 若平台已有 FFmpeg，可通过系统 PATH 自动检测，也可设置 `FFMPEG_PATH=/usr/bin/ffmpeg`；检测会实际运行程序并确认 H.264、AAC、ASS 字幕和稳定运镜功能。该变量设置错误时需修正或移除，不能填写本机 Windows 路径。
- 使用 Docker 部署可采用仓库的 `Dockerfile`，已安装系统 FFmpeg 和中文字体，保留内置参考素材。云端中文字幕还需要中文字体（例如 Noto CJK）。不要上传 `node_modules/` 或 `tools/video-python/` 代替云端安装。
- `/api/video/status` 的 `compositionReady` 必须为 `true` 才可提交分镜任务；默认稳定运镜无需视频 API 密钥。缺少组件时前端先提示，服务端也会返回 `VIDEO_COMPOSER_UNAVAILABLE`，不会提交付费分镜。WorkBuddy 需重新安装依赖并部署后才会应用这些变更。
- Linux 的原 Windows DPAPI 文件无法解密，使用本目录的加密部署备份及 `ZHJ_DEPLOYMENT_KEY`。

更新本地服务配置后，可以运行 `node tools/sync-deployment-config.mjs Hunforfee/zhijing-studio` 重新加密备份、更新仓库 Secret，然后提交更新的 `deploy/` 文件。
