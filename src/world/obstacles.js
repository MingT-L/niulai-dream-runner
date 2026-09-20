/**
 * ============================================================
 * 障碍物系统（对象池 + 无限生成 + AABB 碰撞）
 * ------------------------------------------------------------
 * 四类障碍均取材自《牛来》电影意象：
 *   - 墨岩（rock） ：草原墨石，低矮 → 跳跃越过
 *   - 枯木（log）  ：横倒树干，低矮 → 跳跃越过
 *   - 草蛇（snake）：牛来童年阴影（被草蛇咬伤），地面蛇形 → 跳跃越过
 *   - 墨狼（wolf） ：袭击牛群的狼群化身，高大巨狼且迎面逼近 → 必须变道躲避
 *
 * 生成规则：以累计距离驱动节奏；每波 1~2 个车道，
 * 保证任意时刻至少一条车道可通行；间隔随速度缩放
 * （反应时间大体恒定）。碰撞盒较视觉收缩约 15%，避免误判。
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS, LANE, GAME } from '../config.js'
import { toonMat } from '../effects/materials.js'

// ---------------- 障碍类型定义表 ----------------
// halfW/H/D：碰撞半尺寸；factory：建模工厂（返回 { group, animate? }）
// selfSpeed：额外迎面速度（仅墨狼：向玩家缓慢逼近）
const TYPES = {
  rock: { halfW: 0.6, halfH: 0.5, halfD: 0.6, weight: 0.28, factory: createRock },
  log: { halfW: 0.72, halfH: 0.32, halfD: 0.32, weight: 0.22, factory: createLog },
  snake: { halfW: 0.75, halfH: 0.2, halfD: 0.22, weight: 0.2, factory: createSnake },
  wolf: { halfW: 0.45, halfH: 1.0, halfD: 0.55, weight: 0.3, selfSpeed: 2, factory: createWolf }
}

// ---------------- 建模工厂（全部面朝 +z，迎向玩家） ----------------

/** 墨岩：flatShading 多面体 + 底座小石，水墨山石质感 */
function createRock() {
  const group = new THREE.Group()
  const mat = toonMat(COLORS.rock, { flatShading: true })
  const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75, 0), mat)
  rock.scale.set(1.25, 0.8, 1.05)
  rock.position.y = 0.42
  rock.rotation.y = 0.6
  group.add(rock)
  const small = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 0), mat)
  small.scale.set(1.15, 0.7, 0.95)
  small.position.set(0.72, 0.16, 0.24)
  group.add(small)
  return { group }
}

/** 枯木：横跨车道的赭棕树干 + 枝杈 + 浅色年轮截面 */
function createLog() {
  const group = new THREE.Group()
  const mat = toonMat(COLORS.log)
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 1.72, 9), mat)
  trunk.rotation.z = Math.PI / 2 // 横向（沿 x 轴）
  trunk.position.y = 0.33
  group.add(trunk)
  // 两个上翘短枝
  for (const [x, rz] of [[-0.3, 0.55], [0.28, -0.4]]) {
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.52, 6), mat)
    branch.position.set(x, 0.66, 0)
    branch.rotation.z = rz
    group.add(branch)
  }
  // 两端浅赭截面（年轮示意）
  const capMat = toonMat(0xd9c9a8)
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.06, 9), capMat)
    cap.rotation.z = Math.PI / 2
    cap.position.set(sx * 0.87, 0.33, 0)
    group.add(cap)
  }
  return { group }
}

/** 草蛇：S 形蛇身（球体链）+ 蛇头 + 暖白小眼，轻微扭动动画 */
function createSnake() {
  const group = new THREE.Group()
  const mat = toonMat(COLORS.snake)
  const eyeMat = toonMat(0xf0e6c8)

  // 蛇身：6 段球体沿 x 排布成 S 形
  const segGeo = new THREE.SphereGeometry(0.15, 10, 8)
  for (let i = 0; i < 6; i++) {
    const t = i / 5
    const seg = new THREE.Mesh(segGeo, mat)
    seg.position.set(
      (t - 0.5) * 1.5,
      0.13 + Math.sin(t * Math.PI) * 0.05,
      Math.sin(t * Math.PI * 2) * 0.15
    )
    group.add(seg)
  }
  // 蛇头（+x 端，微微昂起）
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), mat)
  head.scale.set(1.3, 0.85, 0.9)
  head.position.set(0.86, 0.2, 0)
  group.add(head)
  for (const sz of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat)
    eye.position.set(0.98, 0.26, sz * 0.09)
    group.add(eye)
  }

  // 扭动动画：整体左右微摆（活的蛇，呼应童年阴影的"生动感"）
  const animate = (dt, time) => {
    group.rotation.y = Math.sin(time * 2.2) * 0.09
  }
  return { group, animate }
}

/** 墨狼：灰墨巨狼（面朝玩家，迎面逼近），尖耳 + 暖白眼 + 上翘尾，头部警觉摆动 */
function createWolf() {
  const group = new THREE.Group()
  const furMat = toonMat(COLORS.wolf)
  const eyeMat = toonMat(COLORS.wolfEye, { emissive: 0x7a6a3a })

  // 躯干：沿 z 拉长胶囊（狼的流线身形）
  const bodyGeo = new THREE.CapsuleGeometry(0.32, 0.72, 6, 12)
  bodyGeo.rotateX(Math.PI / 2)
  const body = new THREE.Mesh(bodyGeo, furMat)
  body.position.y = 1.0
  group.add(body)

  // 头部：头骨 + 锥形狼吻 + 尖耳 + 暖白双眼
  const head = new THREE.Group()
  head.position.set(0, 1.38, 0.6)
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), furMat)
  head.add(skull)
  const snoutGeo = new THREE.ConeGeometry(0.12, 0.34, 8)
  snoutGeo.rotateX(Math.PI / 2) // 锥尖朝 +z（玩家方向）
  const snout = new THREE.Mesh(snoutGeo, furMat)
  snout.position.set(0, -0.05, 0.32)
  head.add(snout)
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 6), furMat)
    ear.position.set(sx * 0.14, 0.3, -0.02)
    head.add(ear)
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 8), eyeMat)
    eye.position.set(sx * 0.13, 0.06, 0.2)
    head.add(eye)
  }
  group.add(head)

  // 四条细长腿
  const legGeo = new THREE.CylinderGeometry(0.065, 0.055, 0.85, 7)
  for (const p of [[-0.2, -0.34], [0.2, -0.34], [-0.2, 0.34], [0.2, 0.34]]) {
    const leg = new THREE.Mesh(legGeo, furMat)
    leg.position.set(p[0], 0.44, p[1])
    group.add(leg)
  }

  // 上翘尾巴（斜向后上方）
  const tailGeo = new THREE.CapsuleGeometry(0.06, 0.42, 4, 8)
  const tail = new THREE.Mesh(tailGeo, furMat)
  tail.position.set(0, 1.22, -0.62)
  tail.rotation.set(-0.9, 0, 0)
  group.add(tail)

  // 警觉动画：头部左右轻转（注视感）
  const animate = (dt, time) => {
    head.rotation.y = Math.sin(time * 1.6) * 0.16
  }
  return { group, animate }
}

// ---------------- 障碍管理器 ----------------
export class Obstacles {
  /**
   * @param {THREE.Scene} scene 主场景
   */
  constructor(scene) {
    this.scene = scene
    this.active = []      // 场上障碍：{ group, type, halfW/H/D, selfSpeed, animate }
    this.pools = {}       // 各类型空闲对象池：type -> Group[]
    for (const type of Object.keys(TYPES)) this.pools[type] = []
    this.nextSpawnDist = 35 // 开局保护：前 35 米不生成障碍
  }

  /**
   * 每帧更新：滚动 / 动画 / 回收 / 按距离节奏生成
   * @param {number} dt 时间增量
   * @param {number} speed 当前速度
   * @param {number} distance 累计奔跑距离（生成节奏依据）
   * @param {number} time 累计时间（动画相位）
   */
  update(dt, speed, distance, time) {
    const dz = speed * dt

    // ---- 滚动 + 动画 + 回收 ----
    for (let i = this.active.length - 1; i >= 0; i--) {
      const ob = this.active[i]
      // 墨狼额外迎面速度（selfSpeed），其余为 0
      ob.group.position.z += dz + (ob.selfSpeed || 0) * dt
      if (ob.animate) ob.animate(dt, time)
      if (ob.group.position.z > GAME.recycleZ) {
        this._release(ob)
        this.active.splice(i, 1)
      }
    }

    // ---- 生成节奏：间隔 = 速度 × (0.9~1.5 秒) 的路程 ----
    // 速度越快间隔越大，保证玩家反应时间大体恒定
    if (distance >= this.nextSpawnDist) {
      this._spawnWave()
      this.nextSpawnDist = distance + speed * (0.9 + Math.random() * 0.6)
    }
  }

  /** 生成一波障碍：1~2 条车道，永远保留至少一条通行道 */
  _spawnWave() {
    // 车道洗牌后取前 N 条
    const lanes = [0, 1, 2]
    for (let i = lanes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[lanes[i], lanes[j]] = [lanes[j], lanes[i]]
    }
    const count = Math.random() < 0.4 ? 2 : 1
    for (const lane of lanes.slice(0, count)) {
      this._spawn(this._randomType(), LANE.xList[lane])
    }
  }

  /** 加权随机选择障碍类型 */
  _randomType() {
    const entries = Object.entries(TYPES)
    let r = Math.random() * entries.reduce((s, [, d]) => s + d.weight, 0)
    for (const [type, def] of entries) {
      r -= def.weight
      if (r <= 0) return type
    }
    return 'rock'
  }

  /** 从对象池取一个障碍放置到指定车道（池空则新建） */
  _spawn(type, x) {
    const def = TYPES[type]
    const pooled = this.pools[type].pop()
    const inst = pooled || def.factory()
    inst.group.visible = true
    inst.group.position.set(x, 0, GAME.spawnZ - Math.random() * 4)
    this.scene.add(inst.group)
    this.active.push({
      group: inst.group,
      animate: inst.animate,
      type,
      halfW: def.halfW,
      halfH: def.halfH,
      halfD: def.halfD,
      selfSpeed: def.selfSpeed || 0
    })
  }

  /** 归还对象池（隐藏备用） */
  _release(ob) {
    ob.group.visible = false
    this.pools[ob.type].push({ group: ob.group, animate: ob.animate })
  }

  /**
   * AABB 碰撞检测：玩家盒与任一场上障碍盒相交即返回该障碍
   * @param {{minX,maxX,minY,maxY,minZ,maxZ}} playerAABB 玩家碰撞盒
   * @returns {Object|null} 命中的障碍（未命中返回 null）
   */
  checkCollision(playerAABB) {
    for (const ob of this.active) {
      const p = ob.group.position
      const hitX = playerAABB.minX < p.x + ob.halfW && playerAABB.maxX > p.x - ob.halfW
      const hitY = playerAABB.minY < ob.halfH * 2 && playerAABB.maxY > 0
      const hitZ = playerAABB.minZ < p.z + ob.halfD && playerAABB.maxZ > p.z - ob.halfD
      if (hitX && hitY && hitZ) return ob
    }
    return null
  }

  /** 清空场上障碍（重新开局时调用） */
  reset() {
    for (const ob of this.active) this._release(ob)
    this.active = []
    this.nextSpawnDist = 35
  }
}
