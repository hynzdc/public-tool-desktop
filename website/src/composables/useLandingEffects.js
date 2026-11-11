import { onMounted, onBeforeUnmount, ref } from 'vue'

export function useLandingEffects() {
  const headerScrolled = ref(false)
  const productFrameStyle = ref({ transform: 'rotateX(8deg)' })
  const glowStyle = ref({ opacity: '0', transform: 'translate(-200px, -200px)' })

  let rafIds = []
  let onScroll = null
  let onMouseMove = null
  let onMouseLeave = null
  let productMove = null
  let productLeave = null
  let io = null

  onMounted(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    onScroll = () => {
      headerScrolled.value = window.scrollY > 12
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    const reveals = document.querySelectorAll('.reveal')
    if (reduced) {
      reveals.forEach((el) => el.classList.add('in'))
    } else if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.classList.add('in')
              io.unobserve(e.target)
            }
          })
        },
        { threshold: 0.1, rootMargin: '0px 0px -32px 0px' }
      )
      reveals.forEach((el) => io.observe(el))
    } else {
      reveals.forEach((el) => el.classList.add('in'))
    }

    if (reduced) return

    if (window.matchMedia('(pointer: fine)').matches) {
      let gx = 0
      let gy = 0
      let tx = 0
      let ty = 0

      onMouseMove = (e) => {
        tx = e.clientX
        ty = e.clientY
        glowStyle.value = {
          ...glowStyle.value,
          opacity: '1'
        }
      }
      onMouseLeave = () => {
        glowStyle.value = {
          ...glowStyle.value,
          opacity: '0'
        }
      }
      window.addEventListener('mousemove', onMouseMove, { passive: true })
      window.addEventListener('mouseleave', onMouseLeave)

      const tickGlow = () => {
        gx += (tx - gx) * 0.12
        gy += (ty - gy) * 0.12
        glowStyle.value = {
          opacity: glowStyle.value.opacity,
          transform: `translate(${gx - 200}px, ${gy - 200}px)`
        }
        rafIds.push(requestAnimationFrame(tickGlow))
      }
      rafIds.push(requestAnimationFrame(tickGlow))

      const product = document.getElementById('hero-product')
      const frame = document.getElementById('product-frame')
      if (product && frame) {
        let rx = 8
        let ry = 0
        let trx = 8
        let try_ = 0

        productMove = (e) => {
          const r = product.getBoundingClientRect()
          const px = (e.clientX - r.left) / r.width - 0.5
          const py = (e.clientY - r.top) / r.height - 0.5
          trx = 8 - py * 8
          try_ = px * 10
        }
        productLeave = () => {
          trx = 8
          try_ = 0
        }
        product.addEventListener('mousemove', productMove)
        product.addEventListener('mouseleave', productLeave)

        const tickTilt = () => {
          rx += (trx - rx) * 0.08
          ry += (try_ - ry) * 0.08
          productFrameStyle.value = {
            transform: `rotateX(${rx}deg) rotateY(${ry}deg)`
          }
          rafIds.push(requestAnimationFrame(tickTilt))
        }
        rafIds.push(requestAnimationFrame(tickTilt))
      }
    }
  })

  onBeforeUnmount(() => {
    if (onScroll) window.removeEventListener('scroll', onScroll)
    if (onMouseMove) window.removeEventListener('mousemove', onMouseMove)
    if (onMouseLeave) window.removeEventListener('mouseleave', onMouseLeave)
    const product = document.getElementById('hero-product')
    if (product && productMove) product.removeEventListener('mousemove', productMove)
    if (product && productLeave) product.removeEventListener('mouseleave', productLeave)
    if (io) io.disconnect()
    rafIds.forEach((id) => cancelAnimationFrame(id))
  })

  return {
    headerScrolled,
    productFrameStyle,
    glowStyle
  }
}
