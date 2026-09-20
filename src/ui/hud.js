/**
 * ============================================================
 * HUD 与界面管理
 * ------------------------------------------------------------
 * 统一管理主菜单 / HUD / 暂停 / 结算界面的显示切换与数据刷新，
 * 并把按钮点击转发给 Game 状态机处理。
 * ============================================================
 */

// DOM 快捷取用
const $ = (id) => document.getElementById(id)

export class Hud {
  /**
   * @param {import('../core/game.js').Game} game 游戏主控实例
   */
  constructor(game) {
    this.game = game

    // 四个界面层
    this.screens = {
      menu: $('screen-menu'),
      hud: $('screen-hud'),
      pause: $('screen-pause'),
      gameover: $('screen-gameover')
    }
    // 数据展示元素
    this.el = {
      score: $('hud-score'),
      feather: $('hud-feather'),
      finalScore: $('final-score'),
      finalDistance: $('final-distance'),
      finalFeather: $('final-feather'),
      bestScore: $('best-score'),
      bestScoreMenu: $('best-score-menu'),
      newRecord: $('new-record'),
      inkTransition: $('ink-transition')
    }

    // ---- 按钮事件 → 转发状态机 ----
    $('btn-start').addEventListener('click', () => game.start())
    $('btn-pause').addEventListener('click', () => game.togglePause())
    $('btn-resume').addEventListener('click', () => game.togglePause())
    $('btn-restart').addEventListener('click', () => game.restart())
    $('btn-restart-pause').addEventListener('click', () => game.restart())

    this.showScreen('menu')
    this.refreshBest()
  }

  /** 只显示指定界面层，其余隐藏 */
  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('hidden', key !== name)
    }
  }

  /** 从 localStorage 读取并展示最高分 */
  refreshBest() {
    const best = Number(localStorage.getItem(this.game.bestScoreKey) || 0)
    this.el.bestScore.textContent = best
    this.el.bestScoreMenu.textContent = best > 0 ? `梦境纪录 ${best}` : ''
  }

  /**
   * HUD 实时刷新（游戏循环每帧调用；仅数值变化时写 DOM，减少重排）
   * @param {number} score 当前分数
   * @param {number} featherCount 当前羽毛数
   */
  updateScore(score, featherCount) {
    if (this._lastScore !== score) {
      this.el.score.textContent = Math.floor(score)
      this._lastScore = score
    }
    if (this._lastFeather !== featherCount) {
      this.el.feather.textContent = featherCount
      this._lastFeather = featherCount
    }
  }

  /** 水墨晕染转场：墨团扩散（结束时加深，随后淡出） */
  playInkTransition() {
    const el = this.el.inkTransition
    el.classList.remove('hidden')
    el.style.opacity = '1'
    setTimeout(() => { el.style.opacity = '0' }, 650)
    setTimeout(() => el.classList.add('hidden'), 1200)
  }

  /**
   * 展示结算界面
   * @param {Object} data 结算数据
   * @param {number} data.score 最终分数
   * @param {number} data.distance 奔跑距离（米）
   * @param {number} data.featherCount 拾取羽毛数
   * @param {boolean} data.isNewRecord 是否刷新纪录
   */
  showGameOver({ score, distance, featherCount, isNewRecord }) {
    this.el.finalScore.textContent = Math.floor(score)
    this.el.finalDistance.textContent = Math.floor(distance)
    this.el.finalFeather.textContent = featherCount
    this.el.newRecord.classList.toggle('hidden', !isNewRecord)
    this.refreshBest()
    this.showScreen('gameover')
  }
}
