# QQ Agent 0.4 聊天框技能候选

本目录为本机开发原型，不是已安装或已发布的插件。根据可访问的 QQ Agent 社区 fork 0.4 文档实现 `skill.json` + `setup(api)` / `registerTool`，不声称兼容 QQ Agent 0.5。模型仅可提交文字；必须是本轮明确请求，且只通过宿主 `ctx.sender.sendImage` 发送到当前会话。默认关闭，不监听所有消息、不替换原有聊天或擅自自动发表。

打包时需要将配套 `renderer` 目录完整放在本目录下 `renderer/`；它由另一个项目分支制作。技能通过 stdin 传 JSON（只含 text），由渲染器在独立的系统临时目录输出 PNG，核验生成文件路径、格式和尺寸，发送后仅清理自己生成且已校验的临时图片与空目录。异常时不递归删除；临时目录可能残留，可能包含本轮文字图片，需用户自行处理。不得把该路径放进 QQ Agent 的 `plugins/` 或 `skills/` 监视目录之外再通过软链绕过检查。

本机需预先可用的 Python 与 Pillow；可以由本机操作者设置 `CHATFRAME_PYTHON` 指向可信 Python 解释器，不向模型或 QQ 消息开放解释器、模板、输出路径或会话选择。默认使用 PATH 中的 `python`。不使用 shell、不传入账号凭据、不发送网络请求；stdin 和最终图片仍会经过本机进程及 QQ 消息发送队列，须按使用场景尊重群内聊天隐私。

离线测试：`node tests/mock_host_test.mjs`，使用模拟 QQ Agent 宿主和模拟渲染器，不连接 QQ、不调用模型；真实宿主、自然语言识别、实际 QQ 收件与各扩展的兼容需要后续验证。普通版本 v0.4 的正式上架规则与分发 Python 依赖方案仍需核对；不可将包含 Python 脚本或可执行文件的目录声称已符合市场上传规则。

可直接核验的社区 fork 文档：
https://raw.githubusercontent.com/710765989/QQ-agent-white/main/doc/extend_development/skill-development.md
https://raw.githubusercontent.com/710765989/QQ-agent-white/main/doc/extend_development/skill-reference.md
https://raw.githubusercontent.com/710765989/QQ-agent-white/main/src/sender.js
