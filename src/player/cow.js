/**
 * ============================================================
 * 玩家角色：牛来（Niulai）
 * ------------------------------------------------------------
 * 致敬《牛来》主角——草原初生的孱弱小牛犊。
 * 用 Three.js 基础几何体拼装建模（乳白身体、大头大眼、
 * 淡赭小角、黑色小蹄），配程序化动画：
 *   - 奔跑：四腿对角摆动 + 身体起伏 + 头部轻晃 + 尾巴摇摆
 *   - 跳跃：前腿前伸、后腿后蹬的伸展姿态
 *   - 变道：身体侧倾（水墨画中"动势"的呼应）
 * 物理包含：车道插值移动 + 跳跃抛物线（自研轻量物理）。
 * ============================================================
 */
import * as THREE from 'three'
import { COLORS, LANE, PLAYER, JUMP } from '../config.js'
import { toonMat } from '../effects/materials.js'

export class Cow {
  /**
   * @param {THREE.Scene} scene 主场景
   */
  constructor(scene) {
    this.scene = scene

    // group：世界位置（x 车道 / y 跳跃高度），固定面朝 -z（奔跑方向）
    this.group = new THREE.Group()
    // bodyGroup：姿态容器（bob 起伏 / roll 侧倾 / pitch 前倾）
    this.bodyGroup = new THREE.Group()
    this.group.add(this.bodyGroup)

    // ---- 物理状态 ----
    this.laneIndex = 1            // 当前目标车道索引（0 左 / 1 中 / 2 右）
    this.x = LANE.xList[1]        // 实际 x（向目标车道平滑插值）
    this.y = 0                    // 跳跃高度（0 为地面）
    this.vy = 0                   // 竖直速度
    this.isJumping = false
    this.runPhase = 0             // 奔跑动画相位（随速度推进）
    this.time = 0                 // 累计时间（尾巴等慢速动画用）

    this._build()
    scene.add(this.group)
  }

  /** 几何体拼装建模（全部面朝 -z：奔跑方向） */
  _build() {
    const bodyMat = toonMat(COLORS.cowBody)
    const hoofMat = toonMat(COLORS.cowHoof)
    const hornMat = toonMat(COLORS.cowHorn)
    const snoutMat = toonMat(COLORS.cowSnout)
    const eyeMat = toonMat(COLORS.cowEye)
    const whiteMat = toonMat(0xffffff)

    // ---- 身体：横放胶囊（圆润幼犊体态）----
    const bodyGeo = new THREE.CapsuleGeometry(0.5, 0.6, 6, 14)
    bodyGeo.rotateX(Math.PI / 2) // 胶囊默认沿 y 轴 → 旋转为沿 z 轴（前后）
    const body = new THREE.Mesh(bodyGeo, bodyMat)
    body.position.y = 0.88
    this.bodyGroup.add(body)

    // ---- 头部（大头大眼：幼崽稚拙感）----
    this.head = new THREE.Group()
    this.head.position.set(0, 1.02, -0.72)
    this.bodyGroup.add(this.head)

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 20, 16), bodyMat)
    this.head.add(skull)

    // 鼻吻：浅粉椭球
    const snout = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), snoutMat)
    snout.scale.set(1, 0.72, 0.8)
    snout.position.set(0, -0.12, -0.3)
    this.head.add(snout)

    // 眼睛：浓墨大眼 + 白色高光点
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.058, 10, 8), eyeMat)
      eye.position.set(sx * 0.22, 0.1, -0.24)
      this.head.add(eye)
      const glint = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), whiteMat)
      glint.position.set(sx * 0.22, 0.12, -0.29)
      this.head.add(glint)
    }

    // 耳朵：两侧压扁椭球
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bodyMat)
      ear.scale.set(1, 0.5, 0.8)
      ear.position.set(sx * 0.36, 0.18, 0.08)
      ear.rotation.z = -sx * 0.5
      this.head.add(ear)
    }

    // 牛角：淡赭小圆锥（初生牛犊的角才冒尖）
    for (const sx of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 8), hornMat)
      horn.position.set(sx * 0.17, 0.33, 0.05)
      horn.rotation.set(-0.25, 0, -sx * 0.35)
      this.head.add(horn)
    }

    // ---- 尾巴：细圆柱 + 末端毛球（动画中轻轻摇摆）----
    this.tail = new THREE.Group()
    this.tail.position.set(0, 1.0, 0.72)
    const tailGeo = new THREE.CylinderGeometry(0.028, 0.018, 0.52, 6)
    const tail = new THREE.Mesh(tailGeo, bodyMat)
    tail.position.y = -0.26
    this.tail.add(tail)
    const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hoofMat)
    tuft.position.y = -0.55
    this.tail.add(tuft)
    this.tail.rotation.x = -0.55 // 斜向后下方
    this.bodyGroup.add(this.tail)

    // ---- 四条腿：pivot 在髋部（旋转即摆腿）----
    // 腿结构：白圆柱（大腿）+ 黑色小蹄
    this.legs = []
    const legPositions = [
      { x: -0.3, z: -0.42 }, // 左前
      { x: 0.3, z: -0.42 },  // 右前
      { x: -0.3, z: 0.42 },  // 左后
      { x: 0.3, z: 0.42 }    // 右后
    ]
    const legGeo = new THREE.CylinderGeometry(0.095, 0.08, 0.4, 8)
    const hoofGeo = new THREE.CylinderGeometry(0.1, 0.11, 0.1, 8)
    for (const p of legPositions) {
      const legGroup = new THREE.Group()
      legGroup.position.set(p.x, 0.48, p.z)
      const leg = new THREE.Mesh(legGeo, bodyMat)
      leg.position.y = -0.18
      legGroup.add(leg)
      const hoof = new THREE.Mesh(hoofGeo, hoofMat)
      hoof.position.y = -0.42
      legGroup.add(hoof)
      this.bodyGroup.add(legGroup)
      this.legs.push(legGroup)
    }
  }

  // ---------------- 玩家操作（由输入系统调用） ----------------

  /** 向左变道（已在最左车道则忽略） */
  moveLeft() {
    if (this.laneIndex > 0) this.laneIndex--
  }

  /** 向右变道（已在最右车道则忽略） */
  moveRight() {
    if (this.laneIndex < LANE.count - 1) this.laneIndex++
  }

  /**
   * 跳跃（仅地面状态可触发；空中不可二段跳）
   * @returns {boolean} 是否成功起跳
   */
  jump() {
    if (this.isJumping) return false
    this.isJumping = true
    // 由目标高度反推初速度：v0 = √(2·g·h)
    this.vy = Math.sqrt(2 * Math.abs(JUMP.gravity) * JUMP.height)
    return true
  }

  /** 重置到初始状态（重新入梦时调用） */
  reset() {
    this.laneIndex = 1
    this.x = LANE.xList[1]
    this.y = 0
    this.vy = 0
    this.isJumping = false
    this.runPhase = 0
    this.group.position.set(this.x, 0, PLAYER.z)
    this.bodyGroup.rotation.set(0, 0, 0)
    this.bodyGroup.position.y = 0
  }

  // ---------------- 每帧更新：物理 + 动画 ----------------

  /**
   * @param {number} dt 时间增量（秒）
   * @param {number} speed 当前前进速度（决定步频）
   */
  update(dt, speed) {
    this.time += dt

    // ---- 车道插值：指数平滑趋近目标车道 ----
    const targetX = LANE.xList[this.laneIndex]
    const prevX = this.x
    this.x += (targetX - this.x) * Math.min(1, dt * 14)
    const moveRate = (this.x - prevX) / Math.max(dt, 1e-6) // 横移速率（侧倾依据）

    // ---- 跳跃物理：竖直抛物线 + 落地检测 ----
    if (this.isJumping) {
      this.vy += JUMP.gravity * dt
      this.y += this.vy * dt
      if (this.y <= 0) {
        this.y = 0
        this.vy = 0
        this.isJumping = false
      }
    }

    this.group.position.x = this.x
    this.group.position.y = this.y

    this._animate(dt, speed, moveRate)
  }

  /** 程序化动画：腿摆动 / 身体起伏侧倾 / 头尾摆动 / 跳跃姿态 */
  _animate(dt, speed, moveRate) {
    // 步频与速度关联（最低保留轻微碎步，避免静止时僵直）
    const runSpeed = Math.max(speed, 3)
    this.runPhase += dt * runSpeed * 1.7

    const swing = Math.sin(this.runPhase)      // 对角步态主相位
    const swing2 = Math.sin(this.runPhase + Math.PI) // 反相位

    if (this.isJumping) {
      // 跳跃伸展姿态：前腿前伸、后腿后蹬，身体微仰
      this.legs[0].rotation.x = 0.85
      this.legs[1].rotation.x = 0.85
      this.legs[2].rotation.x = -0.75
      this.legs[3].rotation.x = -0.75
      this.bodyGroup.rotation.x = -0.1
    } else {
      // 对角步态：左前+右后 同相，右前+左后 反相
      this.legs[0].rotation.x = swing * 0.75
      this.legs[3].rotation.x = swing * 0.75
      this.legs[1].rotation.x = swing2 * 0.75
      this.legs[2].rotation.x = swing2 * 0.75
      // 身体：随步伐轻微起伏 + 前倾奔跑姿态
      this.bodyGroup.position.y = Math.abs(swing) * 0.05
      this.bodyGroup.rotation.x = 0.045 + swing * 0.02
    }

    // 变道侧倾：横移越快倾角越大（动势感）
    const targetLean = THREE.MathUtils.clamp(-moveRate * 0.06, -PLAYER.leanAngle, PLAYER.leanAngle)
    this.bodyGroup.rotation.z += (targetLean - this.bodyGroup.rotation.z) * Math.min(1, dt * 10)

    // 头部轻晃 + 尾巴摇摆（生命感细节）
    this.head.rotation.x = swing * 0.06
    this.head.rotation.z = swing2 * 0.03
    this.tail.rotation.z = Math.sin(this.time * 4) * 0.35
  }

  /**
   * 获取玩家碰撞盒（AABB，世界坐标）
   * @returns {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}}
   */
  getAABB() {
    return {
      minX: this.x - PLAYER.halfW,
      maxX: this.x + PLAYER.halfW,
      minY: this.y,
      maxY: this.y + PLAYER.halfH * 2,
      minZ: PLAYER.z - PLAYER.halfD,
      maxZ: PLAYER.z + PLAYER.halfD
    }
  }
}
