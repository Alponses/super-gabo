const MARIO_SPEED = 120

const MARIO_ANIMATIONS = {
  grown: {
    idle: 'mario-grown-idle',
    walk: 'mario-grown-walk',
    jump: 'mario-grown-jump'
  },
  normal: {
    idle: 'mario-idle',
    walk: 'mario-walk',
    jump: 'mario-jump'
  }
}

export function checkControls ({ mario, keys, touchControls = {} }) {
  const isMarioTouchingFloor = mario.body.touching.down

  const isLeftKeyDown = keys.left.isDown || touchControls.left
  const isRightKeyDown = keys.right.isDown || touchControls.right
  const isUpKeyDown = keys.up.isDown || touchControls.up

  if (mario.isDead) return

  if (mario.isBlocked) {
    mario.setVelocityX(0)
    return
  }

  const marioAnimations = mario.isGrown
    ? MARIO_ANIMATIONS.grown
    : MARIO_ANIMATIONS.normal

  if (isLeftKeyDown) {
    isMarioTouchingFloor && mario.anims.play(marioAnimations.walk, true)
    mario.setVelocityX(-MARIO_SPEED)
    mario.flipX = true
  } else if (isRightKeyDown) {
    isMarioTouchingFloor && mario.anims.play(marioAnimations.walk, true)
    mario.setVelocityX(MARIO_SPEED)
    mario.flipX = false
  } else {
    if (isMarioTouchingFloor) {
      mario.setVelocityX(0)
      mario.anims.play(marioAnimations.idle, true)
    }
  }

  if (isUpKeyDown && isMarioTouchingFloor) {
    mario.setVelocityY(-300)
    mario.anims.play(marioAnimations.jump, true)
  }
}
