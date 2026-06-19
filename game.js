/* global Phaser */

import { createAnimations } from './animations.js'
import { initAudio, playAudio } from './audio.js'
import { checkControls } from './controls.js'
import { initSpritesheet } from './spritesheet.js'

const TILE_SIZE = 16
const VIEW_BLOCKS = 26
const WORLD_BLOCKS = 212
const GAME_WIDTH = VIEW_BLOCKS * TILE_SIZE
const GAME_HEIGHT = 240
const WORLD_WIDTH = WORLD_BLOCKS * TILE_SIZE
const GROUND_Y = GAME_HEIGHT - 32
const INITIAL_TIME = 400
const INITIAL_LIVES = 9
const WORLD_LABEL = '1-1'
const LOWER_BLOCK_Y = GROUND_Y - TILE_SIZE * 3.5
const UPPER_BLOCK_Y = LOWER_BLOCK_Y - TILE_SIZE * 4

// Floor pits (gaps Mario must jump). [startTile, widthTiles]
const FLOOR_GAPS = [
  [70, 2],
  [87, 3]
]
const FLAGPOLE_TILE = 198
const CASTLE_TILE = 203
const touchControls = {
  left: false,
  right: false,
  up: false,
  down: false
}

const IMAGE_ASSETS = [
  ['cloud1', 'assets/scenery/overworld/cloud1.png'],
  ['cloud2', 'assets/scenery/overworld/cloud2.png'],
  ['mountain1', 'assets/scenery/overworld/mountain1.png'],
  ['mountain2', 'assets/scenery/overworld/mountain2.png'],
  ['bush1', 'assets/scenery/overworld/bush1.png'],
  ['bush2', 'assets/scenery/overworld/bush2.png'],
  ['floorbricks', 'assets/scenery/overworld/floorbricks.png'],
  ['underground-floorbricks', 'assets/scenery/underground/floorbricks.png'],
  ['brick-block', 'assets/blocks/overworld/block.png'],
  ['immovable-block', 'assets/blocks/overworld/immovableBlock.png'],
  ['empty-block', 'assets/blocks/overworld/emptyBlock.png'],
  ['supermushroom', 'assets/collectibles/super-mushroom.png'],
  ['small-pipe', 'assets/scenery/vertical-small-tube.png'],
  ['medium-pipe', 'assets/scenery/vertical-medium-tube.png'],
  ['large-pipe', 'assets/scenery/vertical-large-tube.png'],
  ['flag-mast', 'assets/scenery/flag-mast.png'],
  ['final-flag', 'assets/scenery/final-flag.png'],
  ['castle', 'assets/scenery/castle.png']
]

let gameState = createInitialState()
let touchControlsInitialized = false

const config = {
  autoFocus: false,
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#5d94f5',
  parent: 'game',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 300 },
      debug: false
    }
  },
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true
  },
  scene: [
    { key: 'Main', preload, create, update },
    { key: 'Underground', preload: preloadUnderground, create: createUnderground, update: updateUnderground }
  ]
}

new Phaser.Game(config)

function createInitialState () {
  return {
    score: 0,
    coins: 0,
    time: INITIAL_TIME,
    lives: INITIAL_LIVES
  }
}

function preload () {
  IMAGE_ASSETS.forEach(([key, path]) => {
    this.load.image(key, path)
  })

  this.load.spritesheet(
    'question-block',
    'assets/blocks/overworld/misteryBlock.png',
    { frameWidth: TILE_SIZE, frameHeight: TILE_SIZE }
  )

  this.load.spritesheet(
    'brick-debris',
    'assets/blocks/overworld/brick-debris.png',
    { frameWidth: 8, frameHeight: 8 }
  )

  this.load.spritesheet(
    'koopa',
    'assets/entities/koopa.png',
    { frameWidth: 16, frameHeight: 24 }
  )

  this.load.spritesheet(
    'shell',
    'assets/entities/shell.png',
    { frameWidth: 16, frameHeight: 15 }
  )

  this.load.bitmapFont(
    'hud-font',
    'assets/fonts/carrier_command.png',
    'assets/fonts/carrier_command.xml'
  )

  initSpritesheet(this)
  initAudio(this)
}

function create () {
  createAnimations(this)
  createQuestionBlockAnimation(this)
  createKoopaAnimation(this)

  this.isRestarting = false
  this.isGameOver = false
  this.levelComplete = false

  createLevel(this)
  createHud(this)
  startTimer(this)

  this.keys = this.input.keyboard.createCursorKeys()
  this.touchControls = touchControls
  initTouchControls()
}

function createQuestionBlockAnimation (game) {
  if (game.anims.exists('question-block-idle')) return

  game.anims.create({
    key: 'question-block-idle',
    frames: game.anims.generateFrameNumbers(
      'question-block',
      { start: 0, end: 2 }
    ),
    frameRate: 4,
    repeat: -1
  })
}

function createKoopaAnimation (game) {
  if (game.anims.exists('koopa-walk')) return

  game.anims.create({
    key: 'koopa-walk',
    frames: game.anims.generateFrameNumbers('koopa', { start: 0, end: 1 }),
    frameRate: 6,
    repeat: -1
  })
}

function initTouchControls () {
  if (touchControlsInitialized) return

  const buttons = document.querySelectorAll('[data-control]')

  buttons.forEach((button) => {
    const control = button.dataset.control

    button.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      touchControls[control] = true
      button.classList.add('is-pressed')
    })

    const releaseControl = (event) => {
      event.preventDefault()
      touchControls[control] = false
      button.classList.remove('is-pressed')
    }

    button.addEventListener('pointerup', releaseControl)
    button.addEventListener('pointercancel', releaseControl)
    button.addEventListener('pointerleave', releaseControl)
  })

  window.addEventListener('blur', resetTouchControls)
  touchControlsInitialized = true
}

function resetTouchControls () {
  Object.keys(touchControls).forEach((control) => {
    touchControls[control] = false
  })

  document.querySelectorAll('[data-control]').forEach((button) => {
    button.classList.remove('is-pressed')
  })
}

function createLevel (game) {
  // Bounds collide on every side except the bottom (last arg = false) so Mario
  // can fall through the floor gaps into the kill zone — otherwise he gets
  // pinned at the world floor and never dies in a pit.
  game.physics.world.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT, true, true, true, false)

  createScenery(game)
  createFloor(game)
  createBlocks(game)
  createPlatforms(game)
  createPipes(game)
  createCollectibles(game)
  createEnemies(game)
  createFlagAndCastle(game)
  createPlayer(game)
  createColliders(game)

  game.cameras.main.setBounds(0, 0, WORLD_WIDTH, GAME_HEIGHT)
  game.cameras.main.startFollow(game.mario)
}

function createScenery (game) {
  addCloud(game, tileX(21), 42, 'cloud1', 0.17)
  addCloud(game, tileX(47), 36, 'cloud2', 0.16)
  addCloud(game, tileX(78), 52, 'cloud1', 0.15)
  addCloud(game, tileX(105), 40, 'cloud2', 0.16)
  addCloud(game, tileX(135), 48, 'cloud1', 0.15)
  addCloud(game, tileX(168), 38, 'cloud2', 0.16)
  addCloud(game, tileX(190), 50, 'cloud1', 0.15)

  addGroundScenery(game, tileX(1), 'mountain2', tileSize(5))
  addGroundScenery(game, tileX(13), 'bush1', tileSize(6))
  addGroundScenery(game, tileX(19), 'mountain1', tileSize(4))
  addGroundScenery(game, tileX(25), 'bush2', tileSize(3))

  // Background hills sit in the gaps between the pipes (tiles 29/38/46/57)
  // so they never overlap a pipe and make it look crooked.
  addGroundScenery(game, tileX(32), 'mountain2', tileSize(5))
  addGroundScenery(game, tileX(48), 'bush1', tileSize(6))
  addGroundScenery(game, tileX(41), 'mountain1', tileSize(4))
  addGroundScenery(game, tileX(62), 'bush2', tileSize(3))
  addGroundScenery(game, tileX(83), 'bush1', tileSize(5))

  // Placed in clear areas (avoiding the pyramids at 106-114 / 134-143,
  // the high bricks, and the final staircase at 183-190).
  addGroundScenery(game, tileX(100), 'mountain1', tileSize(4))
  addGroundScenery(game, tileX(124), 'bush2', tileSize(3))
  addGroundScenery(game, tileX(150), 'mountain2', tileSize(5))
  addGroundScenery(game, tileX(165), 'bush1', tileSize(6))
  addGroundScenery(game, tileX(178), 'bush2', tileSize(3))
  addGroundScenery(game, tileX(193), 'mountain1', tileSize(4)) // hill beside the flag
}

function addCloud (game, x, y, key, scale) {
  game.add.image(x, y, key)
    .setOrigin(0, 0)
    .setScale(scale)
    .setDepth(0)
}

function addGroundScenery (game, x, key, width) {
  const sourceImage = game.textures.get(key).getSourceImage()
  const scale = width / sourceImage.width

  game.add.image(x, GROUND_Y, key)
    .setOrigin(0, 1)
    .setScale(scale)
    .setDepth(0)
}

function createFloor (game) {
  game.floor = game.physics.add.staticGroup()

  // Build floor as solid segments, leaving the gaps (pits) open.
  const gapRanges = FLOOR_GAPS.map(([startTile, width]) => ({
    start: tileX(startTile),
    end: tileX(startTile) + width * TILE_SIZE
  }))

  let segmentStart = 0
  gapRanges.forEach(({ start, end }) => {
    if (start > segmentStart) {
      addFloorSegment(game, segmentStart, start - segmentStart)
    }
    segmentStart = end
  })

  if (segmentStart < WORLD_WIDTH) {
    addFloorSegment(game, segmentStart, WORLD_WIDTH - segmentStart)
  }
}

function addFloorSegment (game, x, width) {
  // Visible tiled bricks (no stretching)
  game.add
    .tileSprite(x, GROUND_Y, width, 32, 'floorbricks')
    .setOrigin(0, 0)
    .setDepth(2)

  // Invisible matching static body for collision
  const body = game.floor
    .create(x, GROUND_Y, 'floorbricks')
    .setOrigin(0, 0)
    .setVisible(false)
    .setDisplaySize(width, 32)
    .setDepth(2)

  body.refreshBody()
}

function createBlocks (game) {
  game.solidBlocks = game.physics.add.staticGroup()
  game.questionBlocks = game.physics.add.staticGroup()

  // ── Opening section ──
  createQuestionBlock(game, tileX(12), LOWER_BLOCK_Y)
  createBrickBlock(game, tileX(14), LOWER_BLOCK_Y)
  createQuestionBlock(game, tileX(15), LOWER_BLOCK_Y, 'mushroom')
  createBrickBlock(game, tileX(16), LOWER_BLOCK_Y)
  createQuestionBlock(game, tileX(17), LOWER_BLOCK_Y)
  createBrickBlock(game, tileX(18), LOWER_BLOCK_Y)
  createQuestionBlock(game, tileX(16), UPPER_BLOCK_Y)

  // ── After the pipes: lone coin block + brick cluster ──
  createQuestionBlock(game, tileX(63), LOWER_BLOCK_Y)
  createBrickBlock(game, tileX(65), LOWER_BLOCK_Y)
  createQuestionBlock(game, tileX(66), LOWER_BLOCK_Y, 'mushroom')
  createBrickBlock(game, tileX(67), LOWER_BLOCK_Y)

  // ── High brick "ceiling" run with hidden coins (between the pits) ──
  createBrickBlock(game, tileX(77), UPPER_BLOCK_Y)
  createQuestionBlock(game, tileX(78), UPPER_BLOCK_Y)
  createBrickBlock(game, tileX(79), UPPER_BLOCK_Y)
  createQuestionBlock(game, tileX(80), UPPER_BLOCK_Y)
  createBrickBlock(game, tileX(81), UPPER_BLOCK_Y)

  // ── Lower coin/brick row past the second pit ──
  createBrickBlock(game, tileX(94), LOWER_BLOCK_Y)
  createQuestionBlock(game, tileX(95), LOWER_BLOCK_Y)
  createBrickBlock(game, tileX(96), LOWER_BLOCK_Y)

  // ── Long brick platform before the staircases ──
  createBrickBlock(game, tileX(118), UPPER_BLOCK_Y)
  createBrickBlock(game, tileX(119), UPPER_BLOCK_Y)
  createQuestionBlock(game, tileX(120), UPPER_BLOCK_Y)
  createBrickBlock(game, tileX(121), UPPER_BLOCK_Y)
  createBrickBlock(game, tileX(122), UPPER_BLOCK_Y)

  createBrickBlock(game, tileX(129), LOWER_BLOCK_Y)
  createBrickBlock(game, tileX(130), LOWER_BLOCK_Y)
}

function createPipes (game) {
  game.pipes = game.physics.add.staticGroup()

  // Authentic SMB 1-1 heights: short pipes (2-3 tiles), never the giant 6-tile one
  createPipe(game, tileX(29), 'small-pipe')
  createPipe(game, tileX(38), 'medium-pipe')
  game.warpPipe = createPipe(game, tileX(46), 'medium-pipe')
  createPipe(game, tileX(57), 'medium-pipe')
}

function createPipe (game, x, key) {
  const sourceImage = game.textures.get(key).getSourceImage()

  const pipe = game.pipes
    .create(x, GROUND_Y, key)
    .setOrigin(0, 1)
    .setDepth(3)

  pipe.body.setSize(sourceImage.width, sourceImage.height)
  pipe.body.reset(x, GROUND_Y)

  return pipe
}

function createPlatforms (game) {
  game.platforms = game.physics.add.staticGroup()

  // Two facing pyramids (classic 1-1 mid-level)
  buildStaircase(game, tileX(106), 4, 'ascending')
  buildStaircase(game, tileX(111), 4, 'descending')

  // A taller pyramid pair
  buildStaircase(game, tileX(134), 4, 'ascending')
  buildStaircase(game, tileX(140), 4, 'descending')

  // Final ascending staircase before the flagpole (8 high)
  buildStaircase(game, tileX(183), 8, 'ascending')
}

function buildStaircase (game, startX, steps, direction) {
  for (let i = 0; i < steps; i++) {
    const height = direction === 'ascending' ? i + 1 : steps - i

    for (let j = 0; j < height; j++) {
      createPlatformBlock(game, startX + i * TILE_SIZE, GROUND_Y - TILE_SIZE * (j + 1))
    }
  }
}

function createPlatformBlock (game, x, y) {
  const block = game.platforms
    .create(x, y, 'immovable-block')
    .setOrigin(0, 0)
    .setDepth(3)

  block.refreshBody()

  return block
}

function createBrickBlock (game, x, y) {
  const block = game.solidBlocks
    .create(x, y, 'brick-block')
    .setOrigin(0, 0)
    .setDepth(3)

  block.isBumping = false
  block.isBreaking = false
  block.refreshBody()

  return block
}

function createQuestionBlock (game, x, y, content = 'coin') {
  const block = game.questionBlocks
    .create(x, y, 'question-block', 0)
    .setOrigin(0, 0)
    .setDepth(3)

  block.isUsed = false
  block.content = content
  block.anims.play('question-block-idle', true)
  block.refreshBody()

  return block
}

function createCollectibles (game) {
  game.collectibles = game.physics.add.staticGroup()
  game.powerups = game.physics.add.group()
}

function createCoin (game, x, y) {
  const coin = game.collectibles
    .create(x, y, 'coin')
    .setDepth(4)

  coin.anims.play('coin-idle', true)

  return coin
}

function createEnemies (game) {
  game.enemies = game.physics.add.group()

  // 16 Goombas spread across the level, matching SMB 1-1.
  // All spawn on flat ground, clear of the pipes (29/38/46/57),
  // the floor pits (70-71 / 87-89) and the staircases.
  addGoomba(game, tileX(22))
  addGoomba(game, tileX(34))
  addGoomba(game, tileX(40))
  addGoomba(game, tileX(51))
  addGoomba(game, tileX(53))
  addGoomba(game, tileX(60))
  addGoomba(game, tileX(67))
  addGoomba(game, tileX(80))
  addGoomba(game, tileX(82))
  addGoomba(game, tileX(97))
  addGoomba(game, tileX(117))
  addGoomba(game, tileX(125))
  addGoomba(game, tileX(127))
  addGoomba(game, tileX(147))
  addGoomba(game, tileX(160))
  addGoomba(game, tileX(174))

  // A single green Koopa Troopa, like the original level
  addKoopa(game, tileX(100))
}

function addGoomba (game, x) {
  const enemy = game.enemies
    .create(x, GROUND_Y, 'goomba')
    .setOrigin(0, 1)
    .setGravityY(300)
    .setVelocityX(-35)
    .setDepth(4)

  enemy.enemyType = 'goomba'
  enemy.anims.play('goomba-walk', true)
  return enemy
}

function addKoopa (game, x) {
  const enemy = game.enemies
    .create(x, GROUND_Y, 'koopa')
    .setOrigin(0, 1)
    .setGravityY(300)
    .setVelocityX(-30)
    .setDepth(4)

  enemy.enemyType = 'koopa'
  enemy.anims.play('koopa-walk', true)
  return enemy
}

function createFlagAndCastle (game) {
  const mastX = tileX(FLAGPOLE_TILE)
  game.flagpoleX = mastX

  // Solid base block under the pole (like the original)
  const base = game.platforms
    .create(mastX, GROUND_Y, 'immovable-block')
    .setOrigin(0.5, 1)
    .setDepth(2)
  base.refreshBody()

  // Flag mast (~9 tiles tall so the ball + flag sit in view, like the original)
  const mast = game.add
    .image(mastX, GROUND_Y - TILE_SIZE, 'flag-mast')
    .setOrigin(0.5, 1)
    .setDisplaySize(TILE_SIZE, TILE_SIZE * 9)
    .setDepth(2)

  game.flagTopY = mast.getBounds().top

  // The flag itself, slides down on win
  game.flag = game.add
    .image(mastX - TILE_SIZE / 2, game.flagTopY + TILE_SIZE, 'final-flag')
    .setOrigin(1, 0)
    .setDepth(2)

  // Castle
  game.add
    .image(tileX(CASTLE_TILE), GROUND_Y, 'castle')
    .setOrigin(0, 1)
    .setDepth(1)
}

function createPlayer (game) {
  const startX = gameState.warpReturn || tileX(3)
  gameState.warpReturn = null

  game.mario = game.physics.add.sprite(startX, GROUND_Y, 'mario')
    .setOrigin(0, 1)
    .setCollideWorldBounds(true)
    .setGravityY(300)
    .setDepth(5)
}

function createColliders (game) {
  game.physics.add.collider(game.mario, game.floor)
  game.physics.add.collider(game.mario, game.solidBlocks, hitBrickBlock, null, game)
  game.physics.add.collider(game.mario, game.questionBlocks, hitQuestionBlock, null, game)
  game.physics.add.collider(game.mario, game.pipes)
  game.physics.add.collider(game.mario, game.platforms)
  game.physics.add.collider(game.enemies, game.floor)
  game.physics.add.collider(game.enemies, game.solidBlocks, onEnemyHitWall, null, game)
  game.physics.add.collider(game.enemies, game.questionBlocks, onEnemyHitWall, null, game)
  game.physics.add.collider(game.enemies, game.pipes, onEnemyHitWall, null, game)
  game.physics.add.collider(game.enemies, game.platforms, onEnemyHitWall, null, game)
  game.physics.add.collider(game.enemies, game.enemies, onEnemyVsEnemy, null, game)
  game.physics.add.collider(game.powerups, game.floor)
  game.physics.add.collider(game.powerups, game.solidBlocks)
  game.physics.add.collider(game.powerups, game.questionBlocks)
  game.physics.add.collider(game.powerups, game.pipes)
  game.physics.add.collider(game.powerups, game.platforms)
  game.physics.add.collider(game.mario, game.enemies, onHitEnemy, processHitEnemy, game)
  game.physics.add.overlap(game.mario, game.collectibles, collectItem, null, game)
  game.physics.add.overlap(game.mario, game.powerups, collectItem, null, game)
}

function createHud (game) {
  game.hud = {
    score: addHudColumn(game, 42),
    coins: addHudColumn(game, 126),
    world: addHudColumn(game, 208),
    time: addHudColumn(game, 290),
    lives: addHudColumn(game, 374)
  }

  updateHud(game)
}

function addHudColumn (game, x) {
  return game.add.bitmapText(x, 8, 'hud-font', '', 9)
    .setOrigin(0.5, 0)
    .setScrollFactor(0)
    .setCenterAlign()
    .setLetterSpacing(-2)
    .setLineSpacing(-5)
    .setDepth(20)
}

function updateHud (game) {
  if (!game.hud) return

  game.hud.score.setText(`SCORE\n${gameState.score.toString().padStart(3, '0')}`)
  game.hud.coins.setText(`COINS\n${gameState.coins.toString().padStart(2, '0')}`)
  game.hud.world.setText(`WORLD\n${WORLD_LABEL}`)
  game.hud.time.setText(`TIME\n${gameState.time.toString().padStart(3, '0')}`)
  game.hud.lives.setText(`LIVES\n${gameState.lives}`)
}

function startTimer (game) {
  game.time.addEvent({
    delay: 1000,
    loop: true,
    callback: () => {
      if (game.isGameOver || game.mario.isDead) return

      gameState.time = Math.max(0, gameState.time - 1)
      updateHud(game)

      if (gameState.time === 0) {
        killMario(game)
      }
    }
  })
}

function collectItem (mario, item) {
  const { texture: { key }, x, y } = item
  item.destroy()

  if (key === 'coin') {
    addCoinToState(this, { x, y })
  } else if (key === 'supermushroom') {
    growPlayer(this, mario)
  }
}

function addCoinToState (game, origin) {
  gameState.coins++
  addScore(game, 100, origin)
  playAudio('coin-pickup', game, { volume: 0.1 })
  updateHud(game)
}

// Switch Mario to his grown form. setTexture MUST run before setDisplaySize:
// the grown sheet has 18x32 frames, so the scale stays 1:1 and the grown
// animations render at the right height (otherwise the sprite ends up
// double-stretched once a 'mario-grown-*' frame plays).
function setMarioGrown (player) {
  player.isGrown = true
  player.setTexture('mario-grown')
  player.setDisplaySize(18, 32)
  player.body.setSize(18, 32)
}

// Revert Mario to his small form, keeping his feet on the ground (origin 0,1).
function setMarioSmall (player) {
  player.isGrown = false
  player.setTexture('mario')
  player.setDisplaySize(18, 16)
  player.body.setSize(18, 16)
}

function growPlayer (game, player) {
  if (player.isGrown) return

  game.physics.world.pause()
  game.anims.pauseAll()

  playAudio('powerup', game, { volume: 0.1 })

  let i = 0
  const interval = setInterval(() => {
    i++
    player.anims.play(i % 2 === 0
      ? 'mario-grown-idle'
      : 'mario-idle'
    )
  }, 100)

  player.isBlocked = true
  player.isGrown = true

  setTimeout(() => {
    setMarioGrown(player)

    game.anims.resumeAll()
    player.isBlocked = false
    clearInterval(interval)
    game.physics.world.resume()
  }, 1000)
}

// Big Mario takes a hit: shrink back to small instead of dying, then flash
// briefly while intangible so the same enemy can't immediately finish him off.
function shrinkPlayer (game, player) {
  setMarioSmall(player)
  player.isInvincible = true

  playAudio('powerdown', game, { volume: 0.2 })

  const blink = game.tweens.add({
    targets: player,
    alpha: 0.3,
    duration: 90,
    yoyo: true,
    repeat: -1
  })

  game.time.delayedCall(1500, () => {
    blink.stop()
    player.alpha = 1
    player.isInvincible = false
  })
}

// Central damage handler: grown Mario shrinks, small Mario dies.
function hurtMario (game, player) {
  if (player.isDead || player.isInvincible || player.isBlocked) return

  if (player.isGrown) {
    shrinkPlayer(game, player)
  } else {
    killMario(game)
  }
}

function hitQuestionBlock (mario, block) {
  if (block.isUsed) return
  if (!isHittingBlockFromBelow(mario, block)) return

  block.isUsed = true
  block.anims.stop()
  block.setTexture('empty-block')
  block.refreshBody()

  mario.setVelocityY(90)
  bumpBlock(this, block)

  if (block.content === 'coin') {
    addCoinToState(this, getBlockCenter(block))
  } else if (block.content === 'mushroom') {
    spawnMushroom(this, block)
  }
}

function spawnMushroom (game, block) {
  const mushroom = game.powerups.create(
    block.x + TILE_SIZE / 2,
    block.y,
    'supermushroom'
  )
    .setOrigin(0.5, 1)
    .setDepth(5)

  mushroom.body.allowGravity = false
  mushroom.body.checkCollision.none = true
  mushroom.anims.play('supermushroom-idle', true)

  playAudio('powerup', game, { volume: 0.1 })

  game.tweens.add({
    targets: mushroom,
    y: block.y - TILE_SIZE,
    duration: 450,
    ease: 'Sine.easeOut',
    onComplete: () => {
      mushroom.body.allowGravity = true
      mushroom.body.checkCollision.none = false
      mushroom.setVelocityX(45)
      mushroom.setBounceX(1)
    }
  })
}

function hitBrickBlock (mario, block) {
  if (block.isBreaking) return
  if (!isHittingBlockFromBelow(mario, block)) return

  mario.setVelocityY(90)

  if (mario.isGrown) {
    breakBrickBlock(this, block)
    return
  }

  playAudio('block-bump', this, { volume: 0.15 })
  bumpBlock(this, block)
}

function checkHeadBlockHits (game) {
  const { mario } = game

  if (!mario || mario.isDead || mario.isBlocked || mario.body.touching.down) {
    return
  }

  if (mario.body.velocity.y > 80 && !mario.body.touching.up) return

  const blockHit = getNearestHeadBlock(game, mario)

  if (!blockHit) return

  if (blockHit.type === 'question') {
    hitQuestionBlock.call(game, mario, blockHit.block)
  } else {
    hitBrickBlock.call(game, mario, blockHit.block)
  }
}

function getNearestHeadBlock (game, mario) {
  const candidates = [
    ...getHeadBlockCandidates(game.questionBlocks, mario, 'question'),
    ...getHeadBlockCandidates(game.solidBlocks, mario, 'brick')
  ]

  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.distance - b.distance)

  return candidates[0]
}

function getHeadBlockCandidates (group, mario, type) {
  if (!group) return []

  const marioCenterX = mario.body.center.x

  return group.getChildren()
    .filter((block) => isMarioHeadNearBlock(mario, block))
    .map((block) => ({
      block,
      type,
      distance: Math.abs(marioCenterX - getBlockCenterX(block))
    }))
}

function isHittingBlockFromBelow (mario, block) {
  const blockBody = block.body
  const blockLeft = blockBody ? blockBody.left : block.x
  const blockRight = blockBody ? blockBody.right : block.x + TILE_SIZE
  const blockBottom = blockBody ? blockBody.bottom : block.y + TILE_SIZE
  const previousMarioTop = mario.body.prev ? mario.body.prev.y : mario.body.top

  const touchedBlockBottom =
    mario.body.touching.up ||
    mario.body.blocked.up ||
    (blockBody && blockBody.touching.down)

  const cameFromBelow = previousMarioTop >= blockBottom - 2
  const reachedBlockBottom = mario.body.top <= blockBottom + 10
  const isBelowBlock = mario.body.center.y > blockBottom - 4
  const overlapsHorizontally = isMarioHorizontallyOverBlock(
    mario,
    blockLeft,
    blockRight
  )

  return (
    isMarioHeadNearBlock(mario, block) ||
    ((touchedBlockBottom || (cameFromBelow && reachedBlockBottom)) &&
    isBelowBlock &&
    overlapsHorizontally)
  )
}

function isMarioHeadNearBlock (mario, block) {
  const blockBody = block.body

  if (!block.active || !blockBody || blockBody.enable === false) return false

  const blockLeft = blockBody.left
  const blockRight = blockBody.right
  const blockBottom = blockBody.bottom
  const headTop = mario.body.top
  const headBottom = headTop + 8
  const isBelowBlock = mario.body.center.y > blockBottom - 2
  const reachesBlockBottom =
    headTop <= blockBottom + 8 &&
    headBottom >= blockBottom - 6

  return (
    isBelowBlock &&
    reachesBlockBottom &&
    isMarioHorizontallyOverBlock(mario, blockLeft, blockRight)
  )
}

function isMarioHorizontallyOverBlock (mario, blockLeft, blockRight) {
  const horizontalForgiveness = 5

  return (
    mario.body.right > blockLeft - horizontalForgiveness &&
    mario.body.left < blockRight + horizontalForgiveness
  )
}

function getBlockCenterX (block) {
  return block.x + TILE_SIZE / 2
}

function bumpBlock (game, block) {
  if (block.isBumping) return

  block.isBumping = true

  game.tweens.add({
    targets: block,
    y: block.y - 4,
    duration: 70,
    yoyo: true,
    ease: 'Sine.easeOut',
    onComplete: () => {
      block.isBumping = false
    }
  })
}

function breakBrickBlock (game, block) {
  block.isBreaking = true
  playAudio('break-block', game, { volume: 0.2 })
  createBrickDebris(game, block.x + TILE_SIZE / 2, block.y + TILE_SIZE / 2)
  block.disableBody(true, true)
}

function createBrickDebris (game, x, y) {
  const debrisConfig = [
    { frame: 0, velocityX: -90, velocityY: -170 },
    { frame: 1, velocityX: -45, velocityY: -130 },
    { frame: 2, velocityX: 45, velocityY: -130 },
    { frame: 3, velocityX: 90, velocityY: -170 }
  ]

  debrisConfig.forEach(({ frame, velocityX, velocityY }) => {
    const debris = game.physics.add.sprite(x, y, 'brick-debris', frame)
      .setDepth(6)
      .setVelocity(velocityX, velocityY)
      .setGravityY(450)

    debris.body.checkCollision.none = true

    game.time.delayedCall(700, () => {
      debris.destroy()
    })
  })
}

function getBlockCenter (block) {
  return {
    x: block.x + TILE_SIZE / 2,
    y: block.y
  }
}

function addScore (game, scoreToAdd, origin) {
  gameState.score += scoreToAdd
  updateHud(game)
  addFloatingScore(scoreToAdd, origin, game)
}

function addFloatingScore (scoreToAdd, origin, game) {
  const scoreText = game.add.text(
    origin.x,
    origin.y,
    scoreToAdd,
    {
      fontFamily: 'pixel',
      fontSize: '7px',
      fill: '#ffffff'
    }
  )
    .setOrigin(0.5, 0.5)
    .setDepth(10)

  game.tweens.add({
    targets: scoreText,
    duration: 500,
    y: scoreText.y - 20,
    onComplete: () => {
      game.tweens.add({
        targets: scoreText,
        duration: 100,
        alpha: 0,
        onComplete: () => {
          scoreText.destroy()
        }
      })
    }
  })
}

const SHELL_SPEED = 200

function onHitEnemy (mario, enemy) {
  // Koopa shells have their own rules (kick / stop / hurt)
  if (enemy.enemyType === 'koopa' && enemy.shellState) {
    handleShellHit(this, mario, enemy)
    return
  }

  if (enemy.isDead) return

  const stomped = mario.body.touching.down && enemy.body.touching.up

  if (!stomped) {
    hurtMario(this, mario)
    return
  }

  mario.setVelocityY(-200)
  playAudio('goomba-stomp', this)

  if (enemy.enemyType === 'koopa') {
    // Stomped koopa retreats into a stationary shell (not dead — can be kicked)
    enemy.shellState = 'idle'
    enemy.setVelocityX(0)
    enemy.anims.stop()
    enemy.setTexture('shell', 0)
    enemy.setOrigin(0, 1)
    addScore(this, 100, enemy)
    return
  }

  enemy.isDead = true
  enemy.anims.play('goomba-hurt', true)
  enemy.setVelocityX(0)
  enemy.body.enable = false
  addScore(this, 100, enemy)

  this.time.delayedCall(400, () => {
    enemy.destroy()
  })
}

// Process callback for the Mario/enemy collider: while Mario is flashing after
// a power-down he is intangible, so skip the collision entirely (he passes
// through enemies just like in the original game).
function processHitEnemy (mario, enemy) {
  return !mario.isInvincible
}

function handleShellHit (game, mario, shell) {
  const stomped = mario.body.touching.down && shell.body.touching.up

  if (shell.shellState === 'idle') {
    // Kick the shell away from Mario
    if (stomped) mario.setVelocityY(-200)
    const dir = mario.body.center.x <= shell.body.center.x ? 1 : -1
    shell.shellState = 'moving'
    shell.setVelocityX(SHELL_SPEED * dir)
    playAudio('goomba-stomp', game)
    addScore(game, 400, shell)
    return
  }

  // Shell is already moving
  if (stomped) {
    // Stomp again to stop it
    shell.shellState = 'idle'
    shell.setVelocityX(0)
    mario.setVelocityY(-200)
    playAudio('goomba-stomp', game)
    return
  }

  // A moving shell only hurts Mario when it's heading toward him
  const towardMario =
    (shell.body.velocity.x > 0 && shell.body.center.x < mario.body.center.x) ||
    (shell.body.velocity.x < 0 && shell.body.center.x > mario.body.center.x)

  if (towardMario) hurtMario(game, mario)
}

// Reverse an enemy's direction when it bumps a wall (pipe, block, stair).
// Moving shells keep their (fast) speed; a stationary shell stays put.
function onEnemyHitWall (enemy, other) {
  if (enemy.isDead || enemy.shellState === 'idle') return

  const speed = enemy.shellState === 'moving' ? SHELL_SPEED : Math.abs(enemy.body.velocity.x) || 30

  if (enemy.body.blocked.right || enemy.body.touching.right) {
    enemy.setVelocityX(-speed)
    enemy.flipX = false
  } else if (enemy.body.blocked.left || enemy.body.touching.left) {
    enemy.setVelocityX(speed)
    enemy.flipX = true
  }
}

// Enemy-vs-enemy: a moving shell wipes out other enemies; otherwise both turn around
function onEnemyVsEnemy (a, b) {
  const aShell = a.shellState === 'moving'
  const bShell = b.shellState === 'moving'

  if (aShell && !bShell) {
    killEnemyByShell(this, b)
    return
  }
  if (bShell && !aShell) {
    killEnemyByShell(this, a)
    return
  }
  if (aShell && bShell) return

  onEnemyHitWall(a, b)
  onEnemyHitWall(b, a)
}

function killEnemyByShell (game, enemy) {
  if (enemy.isDead || enemy.shellState) return

  enemy.isDead = true
  enemy.setVelocityX(0)
  enemy.body.enable = false
  enemy.anims.stop()

  if (enemy.enemyType === 'koopa') {
    enemy.setTexture('shell', 0).setOrigin(0, 1)
  } else {
    enemy.anims.play('goomba-hurt', true)
  }

  addScore(game, 200, enemy)

  game.time.delayedCall(400, () => {
    enemy.destroy()
  })
}

function update () {
  const { mario } = this

  if (!mario) return

  checkControls(this)
  checkHeadBlockHits(this)
  checkWarpPipe(this)
  checkFlag(this)
  cleanupFallenEnemies(this)

  if (!this.levelComplete && mario.y >= GAME_HEIGHT + 32) {
    killMario(this)
  }
}

function cleanupFallenEnemies (game) {
  if (!game.enemies) return

  game.enemies.getChildren().forEach((enemy) => {
    if (enemy.y > GAME_HEIGHT + 50) enemy.destroy()
  })
}

function killMario (game) {
  const { mario } = game

  if (!mario || mario.isDead || game.isRestarting || game.isGameOver) return

  mario.isDead = true
  mario.anims.play('mario-dead')
  mario.setCollideWorldBounds(false)
  mario.body.checkCollision.none = true
  mario.setVelocityX(0)

  playAudio('gameover', game, { volume: 0.05 })

  // The whole scene freezes during the death, like the original
  freezeEnemies(game)

  // If Mario already dropped off the bottom of the screen (a pit), he just keeps
  // falling — no hop. Otherwise: hold the death pose, then hop up and fall through.
  if (mario.y >= GAME_HEIGHT) {
    game.time.delayedCall(1400, () => loseLife(game))
    return
  }

  mario.setVelocityY(0)
  mario.body.allowGravity = false

  game.time.delayedCall(500, () => {
    mario.body.allowGravity = true
    mario.setVelocityY(-300)
  })

  game.time.delayedCall(1900, () => loseLife(game))
}

function freezeEnemies (game) {
  if (!game.enemies) return

  game.enemies.getChildren().forEach((enemy) => {
    if (enemy.body) enemy.setVelocity(0, 0)
    if (enemy.anims) enemy.anims.pause()
  })
}

function loseLife (game) {
  if (game.isRestarting || game.isGameOver) return

  game.isRestarting = true
  gameState.lives = Math.max(0, gameState.lives - 1)
  updateHud(game)

  if (gameState.lives === 0) {
    showGameOver(game)
    return
  }

  gameState.time = INITIAL_TIME
  updateHud(game)

  game.time.delayedCall(500, () => {
    game.scene.restart()
  })
}

function showGameOver (game) {
  game.isGameOver = true
  game.physics.world.pause()

  game.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2,
    'GAME OVER',
    {
      fontFamily: 'pixel',
      fontSize: '12px',
      fill: '#ffffff'
    }
  )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(30)

  game.time.delayedCall(2200, () => {
    gameState = createInitialState()
    game.scene.restart()
  })
}

function checkFlag (game) {
  const { mario } = game
  if (game.levelComplete || !game.flagpoleX || !mario || mario.isDead) return

  // Trigger as Mario reaches the pole (before the solid base block stops him)
  if (mario.body.right >= game.flagpoleX - TILE_SIZE) {
    winLevel(game)
  }
}

function winLevel (game) {
  game.levelComplete = true
  const { mario } = game

  mario.isBlocked = true
  mario.setVelocityX(0)
  mario.setVelocityY(0)
  mario.body.allowGravity = false
  mario.body.checkCollision.none = true
  mario.flipX = false
  mario.x = game.flagpoleX - TILE_SIZE
  mario.anims.play('mario-idle', true)

  playAudio('powerup', game, { volume: 0.1 })

  // Mario and the flag slide down the pole together
  game.tweens.add({
    targets: mario,
    y: GROUND_Y,
    duration: 900,
    ease: 'Sine.easeIn'
  })

  if (game.flag) {
    game.tweens.add({
      targets: game.flag,
      y: GROUND_Y - TILE_SIZE * 2,
      duration: 900,
      ease: 'Sine.easeIn'
    })
  }

  // Then walk right into the castle
  game.time.delayedCall(1100, () => {
    mario.flipX = false
    mario.anims.play('mario-walk', true)
    game.tweens.add({
      targets: mario,
      x: tileX(CASTLE_TILE) + TILE_SIZE * 2,
      duration: 1600,
      ease: 'Linear',
      onComplete: () => {
        mario.anims.play('mario-idle', true)
        showLevelClear(game)
      }
    })
  })
}

function showLevelClear (game) {
  addScore(game, 5000, { x: game.cameras.main.scrollX + GAME_WIDTH / 2, y: GAME_HEIGHT / 2 })

  game.add.text(
    GAME_WIDTH / 2,
    GAME_HEIGHT / 2 - 20,
    'COURSE CLEAR!',
    {
      fontFamily: 'pixel',
      fontSize: '14px',
      fill: '#ffffff'
    }
  )
    .setOrigin(0.5, 0.5)
    .setScrollFactor(0)
    .setDepth(30)

  game.time.delayedCall(4000, () => {
    gameState = createInitialState()
    game.scene.start('Main')
  })
}

function checkWarpPipe (game) {
  const { mario, warpPipe } = game
  if (!warpPipe || !mario || mario.isDead || mario.isBlocked || game.isWarping) return

  const isDownPressed = game.keys.down.isDown || (game.touchControls && game.touchControls.down)
  if (!isDownPressed || !mario.body.touching.down) return

  const pipeBody = warpPipe.body
  const marioCX = mario.body.center.x

  if (marioCX >= pipeBody.left && marioCX <= pipeBody.right) {
    enterWarpPipe(game)
  }
}

function enterWarpPipe (game) {
  game.isWarping = true
  const { mario } = game

  mario.isBlocked = true
  mario.setVelocityX(0)
  mario.body.allowGravity = false
  mario.body.checkCollision.none = true

  game.tweens.add({
    targets: mario,
    y: mario.y + 32,
    duration: 700,
    ease: 'Linear',
    onComplete: () => {
      game.cameras.main.fadeOut(300, 0, 0, 0)
      game.time.delayedCall(300, () => {
        game.scene.start('Underground', { gameState })
      })
    }
  })
}

// ─── Underground Scene ────────────────────────────────────────────────────────

function preloadUnderground () {
  // All textures already loaded in main scene preload (shared cache)
}

function createUnderground () {
  this.cameras.main.setBackgroundColor('#000000')
  this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT)
  this.isExiting = false

  const data = this.scene.settings.data
  if (data && data.gameState) Object.assign(gameState, data.gameState)

  createAnimations(this)
  createQuestionBlockAnimation(this)

  this.keys = this.input.keyboard.createCursorKeys()
  this.touchControls = touchControls

  // Enclosed coin room (matches SMB 1-1 bonus room): ceiling, floor,
  // a raised platform with 3 coin rows, and the exit pipe on the right.
  this.solids = this.physics.add.staticGroup()

  // Ceiling (full width, below the HUD)
  for (let x = 0; x < GAME_WIDTH; x += 128) {
    this.solids.create(x, 0, 'underground-floorbricks').setOrigin(0, 0).setDepth(2).refreshBody()
  }

  // Floor (full width)
  for (let x = 0; x < GAME_WIDTH; x += 128) {
    this.solids.create(x, GROUND_Y, 'underground-floorbricks').setOrigin(0, 0).setDepth(2).refreshBody()
  }

  // Left wall column (encloses the room)
  addUndergroundBlock(this, this.solids, 0, 0, TILE_SIZE, GAME_HEIGHT)

  // Raised platform — the bottom coin row sits just above it (1 tile tall step)
  addUndergroundBlock(this, this.solids, tileX(4), GROUND_Y - TILE_SIZE, TILE_SIZE * 7, TILE_SIZE)

  // Coins in 3 rows (5 / 7 / 7), all within jump reach from the platform.
  // setFrame(0) = full-coin face so they never flicker to thin side-view frames.
  this.collectibles = this.physics.add.staticGroup()
  const coinRows = [
    { y: GROUND_Y - TILE_SIZE * 6, startTile: 5, count: 5 },
    { y: GROUND_Y - TILE_SIZE * 4, startTile: 4, count: 7 },
    { y: GROUND_Y - TILE_SIZE * 2, startTile: 4, count: 7 }
  ]
  coinRows.forEach(({ y, startTile, count }) => {
    for (let i = 0; i < count; i++) {
      this.collectibles
        .create(tileX(startTile) + i * TILE_SIZE, y, 'coin')
        .setFrame(0)
        .setDepth(5)
        .refreshBody()
    }
  })

  // Exit pipe on the right (Mario rides it back up to the overworld)
  const exitPipeX = tileX(14)
  this.exitPipeX = exitPipeX
  this.exitPipes = this.physics.add.staticGroup()
  const exitSrc = this.textures.get('medium-pipe').getSourceImage()
  const exitPipe = this.exitPipes.create(exitPipeX, GROUND_Y, 'medium-pipe')
    .setOrigin(0, 1)
    .setDepth(3)
  exitPipe.body.setSize(exitSrc.width, exitSrc.height)
  exitPipe.body.reset(exitPipeX, GROUND_Y)

  // Mario — starts on the left floor (just right of the wall)
  this.mario = this.physics.add.sprite(tileX(2), GROUND_Y, 'mario')
    .setOrigin(0, 1)
    .setCollideWorldBounds(true)
    .setGravityY(300)
    .setDepth(5)

  if (gameState.warpMarioGrown) {
    setMarioGrown(this.mario)
  }

  this.physics.add.collider(this.mario, this.solids)
  this.physics.add.collider(this.mario, this.exitPipes)
  this.physics.add.overlap(this.mario, this.collectibles, onUndergroundCoin, null, this)

  createHud(this)
  startTimer(this)
  updateHud(this)

  this.cameras.main.fadeIn(300, 0, 0, 0)
}

function addUndergroundBlock (scene, group, x, y, width, height) {
  const block = group
    .create(x, y, 'underground-floorbricks')
    .setOrigin(0, 0)
    .setDisplaySize(width, height)
    .setDepth(2)

  block.refreshBody()

  return block
}

function onUndergroundCoin (mario, coin) {
  const { x, y } = coin
  coin.destroy()
  addCoinToState(this, { x, y })
}

function updateUnderground () {
  const { mario } = this
  if (!mario) return

  checkControls(this)
  checkUndergroundExit(this)

  if (mario.y >= GAME_HEIGHT + 32) killMario(this)
}

function checkUndergroundExit (game) {
  const { mario } = game
  if (!mario || mario.isDead || mario.isBlocked || game.isExiting) return

  const isUpPressed = game.keys.up.isDown || (game.touchControls && game.touchControls.up)
  if (!isUpPressed || !mario.body.touching.down) return

  if (mario.body.right >= game.exitPipeX - 4) {
    exitUnderground(game)
  }
}

function exitUnderground (game) {
  game.isExiting = true
  const { mario } = game

  mario.isBlocked = true
  mario.setVelocityX(0)
  mario.body.allowGravity = false
  mario.body.checkCollision.none = true

  game.tweens.add({
    targets: mario,
    y: mario.y - 32,
    duration: 700,
    ease: 'Linear',
    onComplete: () => {
      game.cameras.main.fadeOut(300, 0, 0, 0)
      game.time.delayedCall(300, () => {
        gameState.warpReturn = tileX(50)
        gameState.warpMarioGrown = mario.isGrown || false
        game.scene.start('Main', { gameState })
      })
    }
  })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tileX (blockNumber) {
  return (blockNumber - 1) * TILE_SIZE
}

function tileSize (blocks) {
  return Math.round(blocks * TILE_SIZE)
}
