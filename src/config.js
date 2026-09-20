/**
 * ============================================================
 * 全局配置常量（牛来·梦境奔跑）
 * ------------------------------------------------------------
 * 集中管理所有可调参数：色彩方案、车道布局、玩家物理、跳跃、
 * 速度曲线与障碍参数。调优手感与视觉时只需修改本文件。
 * 色彩依据：docs/visual-design-reference.md（水墨体系）
 * ============================================================
 */

// ---------------- 色彩方案（水墨体系） ----------------
export const COLORS = {
  // 天空与雾
  skyTop: 0xede7d8,       // 天空上部：略深宣纸色
  skyBottom: 0xf7f2e4,    // 地平线：暖白晕染
  fog: 0xf5f0e6,          // 宣纸米白（初始雾色）
  fogDeep: 0xc9d2cc,      // 青墨色（入梦后雾色）
  // 草原与赛道
  grass: 0x9db98a,        // 淡彩草原
  road: 0xc2cfa4,         // 车道色带（略亮黄绿）
  roadEdge: 0x6b726c,     // 路肩墨线（中墨）
  dash: 0xf5f0e6,         // 车道虚线（宣纸白）
  grassTuft: 0x7a9268,    // 草簇（深一度墨绿）
  // 牛来（玩家角色）
  cowBody: 0xf7f4ec,      // 乳白
  cowHorn: 0xd9c9a8,      // 淡赭牛角
  cowSnout: 0xe8b8b0,     // 浅粉鼻吻
  cowHoof: 0x4a443c,      // 深墨蹄子
  cowEye: 0x2b2b28,       // 浓墨眼睛
  // 障碍物
  rock: 0x6f7570,         // 墨岩
  log: 0x8a6f52,          // 枯木（赭棕）
  snake: 0x5c7a52,        // 草蛇（墨绿）
  wolf: 0x5a5f5c,         // 墨狼（灰墨）
  wolfEye: 0xf0e6c8,      // 狼眼（暖白）
  // 收集品
  feather: 0xd4a94e,      // 云雀金羽
  // 远山（墨分五色：由近及远离散）
  mountains: [0x8a9088, 0xa8ada6, 0xd3d6cf],
  // 氛围元素
  bird: 0x4a4f4c,         // 飞鸟剪影
  sun: 0xf0dcb4           // 留白太阳
}

// ---------------- 车道布局 ----------------
export const LANE = {
  count: 3,     // 三车道
  width: 2.2,   // 单车道宽（世界单位）
  // 三条车道的 x 坐标（左 / 中 / 右）
  xList: [-2.2, 0, 2.2]
}

// ---------------- 玩家（牛来）参数 ----------------
export const PLAYER = {
  z: 0,                 // 玩家固定 z 坐标（世界向玩家滚动）
  halfW: 0.42,          // 碰撞盒半宽（略小于视觉，避免误判）
  halfH: 0.75,          // 碰撞盒半高
  halfD: 0.55,          // 碰撞盒半深
  laneSwitchTime: 0.15, // 变道平滑时间（秒）
  leanAngle: 0.18       // 变道时身体侧倾角（弧度）
}

// ---------------- 跳跃物理 ----------------
export const JUMP = {
  height: 1.8,   // 跳跃峰值高度（世界单位）
  gravity: -30   // 重力加速度（单位/秒²）
}

// ---------------- 速度与难度曲线 ----------------
export const GAME = {
  baseSpeed: 10,        // 初始前进速度（单位/秒）
  maxSpeed: 22,         // 速度上限
  speedStep: 0.5,       // 每次提速增量
  speedUpEvery: 10,     // 提速间隔（秒）
  spawnZ: -140,         // 障碍 / 羽毛生成 z（远处雾中）
  recycleZ: 16,         // 超过此 z 即回收（相机身后）
  worldWrapZ: 20,       // 装饰物回绕边界
  worldWrapLength: 180, // 装饰物回绕总长（保持场景密度）
  scorePerUnit: 1,      // 每单位距离得分
  featherScore: 10,     // 每根羽毛得分
  bestScoreKey: 'niulai-best' // localStorage 最高分键名
}

// ---------------- 相机（第三人称跟随） ----------------
export const CAMERA = {
  fov: 60,
  pos: { x: 0, y: 5.2, z: 8.5 },
  lookAt: { x: 0, y: 2.0, z: -8 }
}
