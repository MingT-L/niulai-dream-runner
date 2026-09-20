/**
 * ============================================================
 * 云雀羽毛收集品（对象池 + 漂浮动画 + 收集判定）
 * ------------------------------------------------------------
 * 取材自《牛来》：从荒漠飞来的云雀是梦境的见证者，
 * 金色羽毛是赛道上唯一的暖色点缀——"拾羽"即收集成长记忆。
 *
 * 生成形态：
 *   - 直线波：4~6 根羽毛等高排成一线（奔跑可拾）
 *   - 弧线波：正弦拱形排列（需起跳收集，风险与回报并存）
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS, LANE, GAME } from '../config.js'
import { toonMat } from '../effects/materials.js'

/** 单根金羽：压扁圆锥羽片 + 深金羽轴 */
function createFeather() {
  const group = new THREE.Group()
  const mat = toonMat(COLORS.feather, { emissive: 0x5a4415 })
  // 羽片：扁平圆锥（羽毛的柔软轮廓）
  const vane = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.55, 7), mat)
  vane.scale.set(1, 1, 0.32)
  group.add(vane)
  // 羽轴：细杆贯穿
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.02, 0.02, 0.78, 5),
    toonMat(0xb8892f)
  )
  group.add(shaft)
  return group
}

export class Feathers {
  /**
   * @param {THREE.Scene} scene 主场景
   * @param {Object} callbacks 回调集合
   * @param {Function} [callbacks.onCollect] 拾取羽毛时触发（计分用）
   */
  constructor(scene, { onCollect } = {}) {
    this.scene = scene
    this.onCollect = onCollect
    this.active = []  // 场上羽毛：{ group, state, baseY, phase, collectT }
    this.free = []    // 空闲对象池
    this.nextSpawnDist = 18 // 开局稍晚于障碍生成羽毛
  }

  /**
   * 每帧更新：滚动 / 漂浮 / 收集判定与消散 / 生成
   * @param {number} dt 时间增量
   * @param {number} speed 当前速度
   * @param {number} distance 累计距离（生成节奏）
   * @param {number} time 累计时间（动画相位）
   * @param {number} playerX 玩家 x（收集判定）
   * @param {number} playerY 玩家跳跃高度（收集判定）
   * @param {number} playerZ 玩家 z（收集判定）
   */
  update(dt, speed, distance, time, playerX, playerY, playerZ) {
    const dz = speed * dt
    // 玩家碰撞中心（身体中部，约跳跃高度 + 半身高）
    const pcY = playerY + 0.75

    for (let i = this.active.length - 1; i >= 0; i--) {
      const f = this.active[i]
      const g = f.group
      g.position.z += dz

      if (f.state === 'idle') {
        // 漂浮动画：自转 + 上下轻浮（云雀之羽的灵动）
        g.rotation.y += dt * 2.6
        g.position.y = f.baseY + Math.sin(time * 3 + f.phase) * 0.09

        // 收集判定：玩家中心与羽毛中心的宽域距离检测
        if (
          Math.abs(playerX - g.position.x) < 0.85 &&
          Math.abs(pcY - g.position.y) < 1.05 &&
          Math.abs(playerZ - g.position.z) < 1.0
        ) {
          f.state = 'collecting'
          f.collectT = 0
          this.onCollect?.()
        }
      } else {
        // 收集消散动画：先放大后缩小并上浮（拾取的喜悦感）
        f.collectT += dt
        const t = f.collectT / 0.3
        g.position.y = f.baseY + t * 1.1
        const s = t < 0.4 ? 1 + t * 1.5 : Math.max(2.6 * (1 - (t - 0.4) / 0.6), 0.01)
        g.scale.setScalar(s)
        if (t >= 1) {
          this._release(f)
          this.active.splice(i, 1)
          continue
        }
      }

      // 滚出边界回收
      if (g.position.z > GAME.recycleZ) {
        this._release(f)
        this.active.splice(i, 1)
      }
    }

    // 生成节奏：每 16~34 米一波
    if (distance >= this.nextSpawnDist) {
      this._spawnWave()
      this.nextSpawnDist = distance + 16 + Math.random() * 18
    }
  }

  /** 生成一波羽毛：随机车道，直线或正弦弧线排列 */
  _spawnWave() {
    const x = LANE.xList[Math.floor(Math.random() * LANE.count)]
    const isArc = Math.random() < 0.45 // 45% 概率弧线波（需跳跃收集）
    const count = 4 + Math.floor(Math.random() * 3) // 4~6 根

    for (let i = 0; i < count; i++) {
      const group = this.free.pop() || createFeather()
      group.visible = true
      group.scale.setScalar(1)
      const t = count > 1 ? i / (count - 1) : 0.5
      // 直线波：恒定 1.0 高度；弧线波：正弦拱起（峰值 1.9，需跳跃）
      const y = isArc ? 0.9 + Math.sin(t * Math.PI) * 1.0 : 1.0
      group.position.set(x, y, GAME.spawnZ - i * 2.4)
      this.scene.add(group)
      this.active.push({
        group,
        state: 'idle',
        baseY: y,
        phase: Math.random() * Math.PI * 2,
        collectT: 0
      })
    }
  }

  /** 归还对象池 */
  _release(f) {
    f.group.visible = false
    f.group.scale.setScalar(1)
    this.free.push(f.group)
  }

  /** 清空场上羽毛（重新开局时调用） */
  reset() {
    for (const f of this.active) this._release(f)
    this.active = []
    this.nextSpawnDist = 18
  }
}
