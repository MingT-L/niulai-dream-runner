/**
 * ============================================================
 * 游戏主控：状态机 + 主循环
 * ------------------------------------------------------------
 * 状态流：menu（主菜单）→ playing（奔跑）⇄ paused（暂停）
 *                            ↘ gameover（结算）→ restart → playing
 * 主循环内按状态编排各子系统（赛道 / 角色 / 障碍 / 羽毛 / HUD）更新。
 * ============================================================
 */
import * as THREE from 'three'
import { GAME, PLAYER } from '../config.js'
import { SceneManager } from './scene-manager.js'
import { Track } from '../world/track.js'
import { Obstacles } from '../world/obstacles.js'
import { Feathers } from '../world/feathers.js'
import { Environment } from '../world/environment.js'
import { Input } from './input.js'
import { Cow } from '../player/cow.js'
import { Hud } from '../ui/hud.js'

export class Game {
  /**
   * @param {HTMLElement} container 画布挂载容器
   */
  constructor(container) {
    // ---- 核心系统 ----
    this.sceneManager = new SceneManager(container)
    this.track = new Track(this.sceneManager.scene)
    this.cow = new Cow(this.sceneManager.scene)
    this.obstacles = new Obstacles(this.sceneManager.scene)
    this.feathers = new Feathers(this.sceneManager.scene, {
      onCollect: () => { this.featherCount++ }
    })
    this.environment = new Environment(this.sceneManager)
    this.hud = new Hud(this)
    this.input = new Input({
      onLeft: () => { if (this.state === 'playing') this.cow.moveLeft() },
      onRight: () => { if (this.state === 'playing') this.cow.moveRight() },
      onJump: () => {
        // 跳跃键兼任"确认"：菜单入梦 / 结算重开 / 游戏内起跳
        if (this.state === 'playing') this.cow.jump()
        else if (this.state === 'menu') this.start()
        else if (this.state === 'gameover') this.restart()
      },
      onPause: () => {
        if (this.state === 'playing' || this.state === 'paused') this.togglePause()
      }
    })

    // 切后台 / 最小化时自动暂停（防误伤 + 移动端友好）
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.state === 'playing') this.togglePause()
    })

    // ---- 运行时状态 ----
    this.state = 'menu'        // menu | playing | paused | gameover
    this.speed = GAME.baseSpeed
    this.distance = 0          // 累计奔跑距离（米）
    this.featherCount = 0      // 本局拾取羽毛数
    this.elapsed = 0           // 本局用时（难度提速计时）
    this.bestScoreKey = GAME.bestScoreKey
    this.clock = new THREE.Clock()

    this.loop = this.loop.bind(this)
    requestAnimationFrame(this.loop)
  }

  /** 开始新的一局：重置全部运行数据 */
  start() {
    this.state = 'playing'
    this.speed = GAME.baseSpeed
    this.distance = 0
    this.featherCount = 0
    this.elapsed = 0
    this.cow.reset()
    this.obstacles.reset()
    this.feathers.reset()
    this.environment.setAtmosphere(0) // 氛围重置：新梦从宣纸色开始
    this.hud.showScreen('hud')
  }

  /** 暂停 / 继续（仅 playing 与 paused 间切换） */
  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused'
      this.hud.showScreen('pause')
    } else if (this.state === 'paused') {
      this.state = 'playing'
      this.hud.showScreen('hud')
    }
  }

  /** 重新入梦：水墨晕染转场后重开一局 */
  restart() {
    this.hud.playInkTransition()
    setTimeout(() => {
      this.start()
    }, 600)
  }

  /** 主循环：单帧 dt 上限 50ms，防止切后台回来穿模 */
  loop() {
    const dt = Math.min(this.clock.getDelta(), 0.05)
    this.time = (this.time || 0) + dt // 全局累计时间（动画相位用）

    if (this.state !== 'paused' && this.state !== 'gameover') {
      // 菜单界面背景保持缓慢滚动 + 小牛慢跑（水墨氛围呼吸感）
      const scrollSpeed = this.state === 'playing' ? this.speed : GAME.baseSpeed * 0.35
      this.track.update(dt, scrollSpeed)
      this.cow.update(dt, scrollSpeed)
      this.environment.update(dt) // 飞鸟扇翅等氛围动画

      if (this.state === 'playing') {
        this._updatePlaying(dt)
      }
    }

    this.sceneManager.render()
    requestAnimationFrame(this.loop)
  }

  /** playing 状态逻辑：难度递增 / 距离 / 障碍 / 羽毛 / 碰撞 / HUD */
  _updatePlaying(dt) {
    this.elapsed += dt

    // 难度递增：每 speedUpEvery 秒 +speedStep，封顶 maxSpeed
    this.speed = Math.min(
      GAME.baseSpeed + Math.floor(this.elapsed / GAME.speedUpEvery) * GAME.speedStep,
      GAME.maxSpeed
    )

    // 距离累计（速度 × 时间）
    this.distance += this.speed * dt

    // 障碍与羽毛滚动、生成、收集
    this.obstacles.update(dt, this.speed, this.distance, this.time)
    this.feathers.update(
      dt, this.speed, this.distance, this.time,
      this.cow.x, this.cow.y, PLAYER.z
    )

    // 入梦渐变：随奔跑距离推进（500 米完成全程渐变）
    this.environment.setAtmosphere(this.distance / 500)

    // 碰撞检测：命中障碍 → 梦醒（游戏结束）
    if (this.obstacles.checkCollision(this.cow.getAABB())) {
      this._gameOver()
      return
    }

    // HUD 刷新：分数 = 距离分 + 羽毛分
    const score = this.distance * GAME.scorePerUnit + this.featherCount * GAME.featherScore
    this.hud.updateScore(score, this.featherCount)
  }

  /** 梦醒结算：水墨晕染转场 → 结算界面 + 最高分持久化 */
  _gameOver() {
    this.state = 'gameover'
    const score = Math.floor(
      this.distance * GAME.scorePerUnit + this.featherCount * GAME.featherScore
    )
    const best = Number(localStorage.getItem(this.bestScoreKey) || 0)
    const isNewRecord = score > best
    if (isNewRecord) localStorage.setItem(this.bestScoreKey, String(score))

    this.hud.playInkTransition()
    setTimeout(() => {
      this.hud.showGameOver({
        score,
        distance: this.distance,
        featherCount: this.featherCount,
        isNewRecord
      })
    }, 700)
  }
}
