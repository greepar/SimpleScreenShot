# 本机定制版

基于 https://github.com/Aero123421/SimpleScreenShot 。

- Ctrl + Alt + A 打开截图，悬停自动识别窗口，支持原生 Wayland 和 XWayland。
- 鼠标不在窗口上时默认框选全屏。选区外有黑色遮罩，选区内保持原始颜色。
- 单击固定选区；按住拖动自选区域。固定后可拖动选区或拉边调整尺寸。
- 浮动工具栏：矩形、椭圆、箭头、画笔、马赛克、文字、撤销、保存、取消、完成。
- 选择标注工具后出现颜色和粗细选项。文字支持中文输入，Enter 提交文字。
- 选区内双击 / Enter / Ctrl+C / 勾号完成并复制；Ctrl+S / 下载按钮保存到图片文件夹并复制。
- Ctrl+Z 撤销、Ctrl+Shift+Z 重做；Esc / 右键取消截图。
- 无独立编辑窗口，无快门声。遮罩、边框、工具栏不会写进最终截图。
- 完成操作默认只复制；临时 PNG 在 /run/user/1000/simple-screenshot。

源码在此目录，安装目录为 ~/.local/share/gnome-shell/extensions/simple-screenshot@local。

静态检查：GDK_BACKEND=wayland sh scripts/check.sh。
安装：sh scripts/install.sh。重新登录后加载此目录打包的正式入口。

实测：GNOME 46 Wayland 上的浏览器、终端和 QQ 悬停识别；选区移动和缩放；六类标注、中文、撤销/重做、PNG 导出和原始颜色保持。标注预览和导出共用 annotations.js 渲染逻辑。
