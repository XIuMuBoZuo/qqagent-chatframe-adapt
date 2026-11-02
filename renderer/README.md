# 聊天框渲染核心：QQ Agent 本地原型 v001

沿用《霞沢涟的聊天框工作室》公开版的 Python 场景渲染代码及用户既有素材，提供无界面的单次文字转图。不连接QQ、模型、互联网或剪贴板，也不修改原工作室的源码、模板、工作区及用户数据。

## 调用协议

宿主用 Python 3.12 启动 `render_card.py --output-dir <受控目录>`，通过 stdin 写入一个 UTF-8 JSON 并关闭 stdin，例如 `{"text":"挚友，吾辈来了！"}`。仅接受 `text` 字段；消息无法指定图片、模板、字体或本机路径。调用时不要通过 shell 拼接文字。

stdout 仅一行 JSON。成功：`{"ok":true,"image_path":"绝对路径","width":1600,"height":1000}`；图片名为随机 UUID，调用方需核验结果属于自己指定的输出目录并检查 PNG 后再使用。失败时非零退出并输出 `{"ok":false,"error":{"code":"...","message":"..."}}`，错误不包含正文或文件路径。可能的错误码：`INVALID_REQUEST`、`TEXT_TOO_LONG`、`TEXT_OVERFLOW`、`TEMPLATE_INVALID`、`FONT_UNAVAILABLE`、`RENDER_FAILED`。

输入最多240字符，超过限制或文字小于24像素仍放不下时拒绝，不静默截断；保留句末标点。单张输出最多15MB。图片保存在调用方指定目录，调用方应为生成物设置合适的生命周期；本核心不删除生成图片。

## 模板、字体和限制

`templates/default/scene.json` 是基于原作12图层示例整理的轻量四层场景，背景、角色、底板素材直接取自原模板。场景的布局参数可在本机编辑；图片引用限制为3个经过哈希校验的随包素材，字体固定使用 Windows 已安装的微软雅黑等中文字体，不会随包分发系统字体。若字体不存在或无法加载，返回 `FONT_UNAVAILABLE`，不会静默改用不支持中文的字体。

本原型只支持该内置 scene.json。尚不支持从聊天消息导入任何模板，也不支持将任意用户 `.mscene` 作为插件输入。此前的完整 `.mscene`（约29MB）仅供本地开发参考，不能放入目标插件市场的8MB ZIP限制包中；轻量场景本身约3.30MB。未来支持任意 `.mscene` 前，应单独实现可信模板选择、归档大小/路径限制和隔离加载，并核验模板中的字体与图片许可。

## 依赖与打包

- Windows 10/11、Python 3.12、Pillow `>=12.0,<13`、Windows 中文字体。当前本机测试使用 `C:/Users/UU189/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe` 与 Pillow 12.3.0；此路径只是本机例子，对外不能假设用户也有。
- 仅打包 `render_card.py`、`engine/*.py`、`templates/default/*` 和 `licenses/*`。不要打包 `templates/霞沢涟_自由拼贴.mscene`、`test_evidence_*`、`参考_文字底板.png`、`build_default_template.py`、`test_renderer.py`、`.probe`、`__pycache__` 或任何本机用户数据。
- 原项目源码 MIT 授权；霞沢涟人物及原场景素材的适用范围见 `licenses/ASSETS_NOTICE.md`，字体及第三方条款见 `licenses/THIRD_PARTY_NOTICES.md` 和对应许可；MIT 不自动覆盖图片或字体。

## 本机验证

使用上方 Python 执行 `test_renderer.py`。已实际生成并完整解码1600×1000 PNG；短句与较长中文图均已人工查看，句末标点对比像素不同。超长文字、额外模板字段、控制字符、空内容和缺失系统字体均有错误返回。没有真实 QQ 消息、联网或模型调用。验收文件见 `test_evidence_e549f54a/result.json`；结果是离线渲染层验收，不等同于 QQ Agent 已安装或真实群聊收件通过。
