/**
 * ============================================================
 * 入口：实例化游戏主控并启动主循环
 * ============================================================
 */
import { Game } from './core/game.js'

const container = document.getElementById('game-container')
new Game(container)
