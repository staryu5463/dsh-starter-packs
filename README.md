# dsh-starter-packs · 整合包

[中文](#中文) | [English](#english)

## 中文

给 DeepSeek Harness 插件页加一个 **「整合包」** 标签，就在「已安装 | 插件市场」旁边。每个整合包是一组经过实测、能一起运行、版本锁定的社区插件，勾选后点一次即可全部装好。

不额外开窗口，也不另做一个管理器：安装走插件市场（dshmarket）自己的安装接口，复用它的目录校验、试装校验、冲突检查和回滚。

### 当前的整合包

| 整合包 | 插件 | 说明 |
|---|---|---|
| 新手必备 | dsh-context、dsh-skills-manager、dsh-archive-manager、dsh-rewind-plugin、dsh-btw | 界面与会话增强，不增加模型上下文里的工具定义 |
| 编程开发 | dsh-code-review、dsh-mcp-connector、archify-dsh、cc-safety-net（可选） | 代码审查、MCP 管理、架构图、危险命令护栏 |
| 联网与浏览器 | modsearch、dsh-ego-browser、modlens | 联网搜索、驱动真实浏览器、给纯文本模型看图；工具定义较多，按需安装 |

### 收录规则

1. **只收录插件目录里的插件。** 来源是 [awesome-dsh-plugin](https://awesome-dsh-plugin.com/plugins.json)，插件市场也拒绝安装目录外的包。
2. **锁定版本。** 每个插件锁定到发布满 3 天的版本，避开 pnpm 的新版本等待期（`minimumReleaseAge`）。
3. **风险插件只能可选。** 目录的权限扫描报出风险（capability red lines）的插件，只能标为可选，默认不勾选，界面里用橙色显示风险说明。
4. **功能不重叠。** 同一类能力只放一个插件，比如技能管理只选一个。
5. **每次改动都要真装一遍。** 在全新的 profile 里把每个包单独装一遍，再把所有包一起装一遍，确认每个插件都进了 `dsh.profile.bundles`、配置能组合、没有重复的 loader id。

### 使用

在插件市场里安装 `dsh-starter-packs`，然后打开 **插件 → 整合包**。

如果没装插件市场，每个插件旁边会出现单独的「安装」按钮，走官方的安装对话框，一次装一个。

### 开发

```bash
npm run build     # 把 packs/*.json 嵌进 client.js
npm run check     # 检查 client.js 没过期，并做格式和目录校验
npm run verify    # 在独立的 DSH_HOME（.scratch-home/）里真装每个包，不会碰 ~/.dsh
```

`npm run verify` 需要本机装有 DeepSeek Harness 桌面端。安装路径不是默认位置时，用 `DSH_APP_DIR` 指定。

### 投稿一个整合包

1. 新建 `packs/<id>.json`，格式照现有文件：每个插件写 npm 名、精确版本、中英文的入选理由。
2. 运行 `npm run verify`，确认全部通过。
3. 提交 PR，说明这组插件适合谁、为什么要放在一起。

### 已知限制

- **不做会话级工具隔离。** 插件在全局注册的工具对所有 Agent 可见，Agent 预设只能添加自己的子插件，藏不住全局工具（见 `@deepseek-ai/dsh-scope`）。所以整合包解决的是「装什么」，不是「哪个会话用什么」。
- **还不能整组卸载。** 卸载请在「已安装」里逐个操作。
- **有 Agent 正在运行时不能安装。** 插件市场会拒绝安装，整合包会停下来并提示等 Agent 结束。
- **插件市场 1.71.1 的一个问题。** 安装后宿主会重新组合插件，市场偶尔因此返回 HTTP 500（`cannot get required service "loader" in inactive context`），但插件其实已经装好并在运行。整合包装完会重新读取实际状态来纠正显示。

## English

Adds a **Packs** tab to the DeepSeek Harness Plugins page, next to Installed and Plugin Market. Each pack is a tested, version-pinned set of community plugins that you install in one click.

There is no separate window or manager: installs go through dshmarket's own install route, so its catalog check, trial validation, conflict guard and rollback all apply.

Curation rules:
- Catalog plugins only.
- Every plugin is pinned to a release at least 3 days old.
- A plugin with capability red lines may only be optional.
- No two plugins with overlapping functions.
- Every change is installed for real into fresh profiles, one pack at a time and all packs together (`npm run verify`).

Known limits:
- Plugins that register tools globally are visible to every agent, so packs decide what is installed, not which session sees what.
- There is no pack-level uninstall yet.
- Installs are refused while an agent is running.

## License

MIT
