const createAnimation = (game, animation) => {
  if (game.anims.exists(animation.key)) return

  game.anims.create(animation)
}

export const createAnimations = (game) => {
  createAnimation(game, {
    key: 'mario-walk',
    frames: game.anims.generateFrameNumbers(
      'mario',
      { start: 1, end: 3 }
    ),
    frameRate: 12,
    repeat: -1
  })

  createAnimation(game, {
    key: 'mario-grown-walk',
    frames: game.anims.generateFrameNumbers(
      'mario-grown',
      { start: 1, end: 3 }
    ),
    frameRate: 12,
    repeat: -1
  })

  createAnimation(game, {
    key: 'mario-idle',
    frames: [{ key: 'mario', frame: 0 }]
  })

  createAnimation(game, {
    key: 'mario-grown-idle',
    frames: [{ key: 'mario-grown', frame: 0 }]
  })

  createAnimation(game, {
    key: 'mario-jump',
    frames: [{ key: 'mario', frame: 5 }]
  })

  createAnimation(game, {
    key: 'mario-grown-jump',
    frames: [{ key: 'mario-grown', frame: 5 }]
  })

  createAnimation(game, {
    key: 'mario-dead',
    frames: [{ key: 'mario', frame: 4 }]
  })

  createAnimation(game, {
    key: 'goomba-walk',
    frames: game.anims.generateFrameNumbers(
      'goomba',
      { start: 0, end: 1 }
    ),
    frameRate: 12,
    repeat: -1
  })

  createAnimation(game, {
    key: 'goomba-hurt',
    frames: [{ key: 'goomba', frame: 2 }]
  })

  createAnimation(game, {
    key: 'coin-idle',
    frames: game.anims.generateFrameNumbers(
      'coin',
      { start: 0, end: 3 }
    ),
    frameRate: 12,
    repeat: -1
  })

  createAnimation(game, {
    key: 'supermushroom-idle',
    frames: [{ key: 'supermushroom' }]
  })
}
