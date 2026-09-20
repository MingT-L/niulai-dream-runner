# 开发说明（Development Guide）

> 本文档面向后续维护与扩展者，说明《牛来·梦境奔跑》的架构设计、
> 数据流、模块职责与扩展方式，并附 Loop Engineering 开发验证记录。

---

## 一、总体架构

游戏采用**"玩家固定、世界滚动"**的跑酷经典架构：牛来固定在 z≈0 位置，
所有世界元素（赛道虚线、障碍、羽毛、草原点缀）沿 +z 向玩家滚动，
越过回收线后回绕或归还对象池。此方案浮点精度稳定、回收逻辑简单。

```
main.js
  └── Game（core/game.js）────────── 状态机 + requestAnimationFrame 主循环
        ├── SceneManager ──────── 渲染器 / 相机 / 灯光 / 雾 / 渐变天空
        ├── Track ─────────────── 三车道底带（静态）+ 虚线/草簇（滚动）
        ├── Cow ───────────────── 牛来建模 / 程序化动画 / 车道与跳跃物理
        ├── Obstacles ─────────── 障碍对象池 + 生成节奏 + AABB 碰撞
        ├── Feathers ──────────── 金羽对象池 + 漂浮动画 + 收集判定
        ├── Environment ───────── 远山/飞鸟/太阳 + 入梦氛围渐变
        ├── Input ─────────────── 键盘 + 触摸手势 → 回调分发
        └── Hud ───────────────── 菜单/HUD/暂停/结算 DOM 管理
```

**状态机**：`menu → playing ⇄ paused`，`playing → gameover → restart → playing`。
主循环内按状态编排更新；`paused/gameover` 时画面定格（仅渲染不更新），
`menu` 时赛道与小牛以 0.35 倍速慢跑（氛围呼吸感）。

## 二、主循环与数据流

`Game.loop()` 每帧执行（dt 上限 50ms，防切后台穿模）：

1. `Track.update(dt, speed)` —— 赛道元素滚动 + 回绕
2. `Cow.update(dt, speed)` —— 车道插值 / 跳跃物理 / 程序化动画
3. `Environment.update(dt)` —— 飞鸟扇翅与横移
4. playing 时 `_updatePlaying(dt)`：
   - 难度曲线：`speed = min(base + floor(elapsed/10)×0.5, 22)`
   - `distance += speed × dt`（计分与生成节奏的统一驱动源）
   - `Obstacles.update` / `Feathers.update`：滚动 + 距离驱动生成
   - `Environment.setAtmosphere(distance/500)`：入梦渐变
   - `Obstacles.checkCollision(cow.getAABB())` → 命中即 `_gameOver()`
   - HUD 刷新（仅数值变化时写 DOM）

**生成节奏设计**：障碍间隔 = `speed × (0.9~1.5 秒)` 的路程——速度越快
间隔越大，玩家反应时间大体恒定；每波随机占用 1~2 条车道，**永远保留
至少一条通行道**；前 35 米为开局保护期。

## 三、模块要点

### config.js —— 一站式调参
所有可调参数集中于此：`COLORS`（水墨色彩体系）、`LANE`（车道布局）、
`PLAYER`（碰撞盒/变道参数）、`JUMP`（跳跃高度/重力）、`GAME`（速度曲线/
生成分区/计分）。调手感与配色只需改这一个文件。

### effects/materials.js —— 水墨材质工厂
- `toonMat(color, options)`：默认返回 `MeshToonMaterial`（三阶灰度
  gradientMap，柔和阶梯光影，贴水墨平涂质感）
- 传入 `flatShading: true` 时自动降级为 `MeshLambertMaterial`
  （MeshToonMaterial 不支持 flatShading；墨岩的块面山石质感）
- 相同配置全局缓存复用，降低内存与渲染状态切换开销

### player/cow.js —— 程序化动画
- 奔跑：对角步态（左前+右后同相），步频随速度；身体 bob + 前倾
- 跳跃：`v0 = √(2g·h)` 反推初速（height=1.8 / gravity=-30），
  空中前腿前伸、后腿后蹬
- 变道：`x += (target-x) × min(1, dt×14)` 指数平滑，身体随横移速率侧倾

### world/obstacles.js —— 障碍类型表
类型定义集中在 `TYPES` 表（碰撞半尺寸 / 权重 / 工厂 / 附加速度），
新增障碍只需添加一个工厂函数与一行注册。当前四类：
墨岩（跳）、枯木（跳）、草蛇（跳，带扭动动画）、墨狼（高 2.0 碰撞盒
+2 单位迎面速度，必须变道）。碰撞盒较视觉收缩约 15%，避免误判。

### core/scene-manager.js —— 水墨基调
渐变天空为自定义 ShaderMaterial 穹顶（宣纸色上下晕染，`fog:false`）；
`THREE.Fog` 宣纸色雾负责中景晕染；无阴影贴图（性能优先，
层次感由雾 + 远山墨阶承担）。

### ui/hud.js —— DOM overlay
四层界面（menu/hud/pause/gameover）通过 `showScreen()` 切换；
水墨晕染转场为 CSS 径向渐变动画；最高分键：`localStorage['niulai-best']`。

## 四、扩展指南

| 需求 | 做法 |
|------|------|
| 新增障碍 | `obstacles.js` 的 `TYPES` 表加一个工厂（返回 `{ group, animate? }`）并配 halfW/H/D 与权重 |
| 新增收集品 | 参考 `feathers.js`：对象池 + 距离驱动生成 + 收集判定回调 |
| 调整手感 | 改 `config.js` 的 `JUMP` / `PLAYER.laneSwitchTime` / `GAME.speedStep` |
| 场景阶段流转 | `Environment.setAtmosphere()` 扩展为分段（草原→荒漠→梦境），随 distance 切换色板 |
| 加入豹拉/牛妈妈 NPC | 参考 `cow.js` 建模方式，作为路边装饰或剧情彩蛋滚动元素 |
| 音效 | 新建 `utils/audio.js`，在 jump/collect/gameOver 事件点挂 Web Audio（无需引入库） |

## 五、性能设计

- **对象池**：障碍/羽毛/地砖点缀全部池化复用，零运行期 GC 压力
- **共享资源**：几何体与材质跨实例共享（材质缓存池见 materials.js）
- **渲染开销控制**：pixelRatio ≤ 2；无阴影；无后处理链；
  天空/远山/飞鸟均为 `fog:false` 的 BasicMaterial 剪影，极低 draw 成本
- 实测：桌面 Chrome 60.1 FPS 满帧（含 90 个草原点缀 + 4 飞鸟 + 三层远山）

## 六、Loop Engineering 开发验证记录

每个模块完成后均在浏览器（Vite dev server + 内置浏览器）验证通过后进入下一模块：

| 模块 | 内容 | 验证结论 |
|------|------|----------|
| M0 | 视觉参考文档 | 完成（docs/visual-design-reference.md） |
| M1 | 脚手架 + 基础水墨场景 | 宣纸天空渐变/草原/雾效正常，console 无游戏代码错误 |
| M2 | 三车道赛道 + 相机 | 虚线滚动速度感正常、无接缝闪烁 |
| M3 | 牛来角色建模 | 乳白小牛居中奔跑，对角步态动画流畅（像素分析验证） |
| M4 | 输入与物理 | 变道平滑无跳变；跳跃抛物线峰值 17.1% 屏高，与理论值 17% 吻合；~50FPS |
| M5 | 障碍系统 | 四类障碍正常生成滚动；撞击触发水墨晕染转场 + 结算；重开清场正确 |
| M6 | 羽毛与计分 | 收集判定生效（实测羽数 0→4），计分与最高分持久化正常 |
| M7 | 水墨视觉强化 | 三层墨阶远山/淡金太阳/飞鸟剪影正常；入梦渐变（雾浓 + 青墨调）可感知 |
| M8 | 状态流与 UI | 空格开始/P 暂停/恢复全流程正常；400×700 窄屏适配良好 |
| M9 | 最终验收 | 60.1 FPS 满帧；触摸手势（左滑/右滑/上滑）全部生效；强制刷新后 console 零报错 |

**开发中修复的问题**：
1. `pnpm` 忽略 esbuild 构建脚本 → `pnpm-workspace.yaml` 声明 `onlyBuiltDependencies` + `pnpm rebuild esbuild`
2. `MeshToonMaterial` 不支持 `flatShading` 警告 → 材质工厂按需降级 `MeshLambertMaterial`
3. 触摸手势误触 UI 按钮 → `touchend` 判定 `e.target.closest('#ui-overlay')` 排除

## 七、构建与部署

```bash
pnpm build    # 产物输出 dist/（纯静态站点）
```

`dist/` 可部署至任意静态托管（Nginx / Vercel / Netlify / GitHub Pages），
无服务端依赖、无环境变量、无外部 CDN 请求。
