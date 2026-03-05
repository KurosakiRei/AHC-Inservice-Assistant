@echo off
git remote set-url origin https://github.com/KurosakiRei/AHC-Inservice-Assistant.git 2>nul
if errorlevel 1 git remote add origin https://github.com/KurosakiRei/AHC-Inservice-Assistant.git
git add .
git commit -m "feat: 完善完成课节后的检测，优化继续逻辑并新增悬浮窗版本号"
git branch -M main
git push -u origin main
