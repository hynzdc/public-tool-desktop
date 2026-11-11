<script setup>
import { useLandingEffects } from './composables/useLandingEffects'
import SiteHeader from './components/SiteHeader.vue'
import HeroSection from './components/HeroSection.vue'
import ToolsSection from './components/ToolsSection.vue'
import HowSection from './components/HowSection.vue'
import StudioSection from './components/StudioSection.vue'
import PrinciplesSection from './components/PrinciplesSection.vue'
import CtaSection from './components/CtaSection.vue'
import SiteFooter from './components/SiteFooter.vue'

const { headerScrolled, productFrameStyle, glowStyle } = useLandingEffects()
</script>

<template>
  <div>
    <div class="noise" aria-hidden="true" />
    <div class="cursor-glow" id="cursor-glow" aria-hidden="true" :style="glowStyle" />

    <SiteHeader :scrolled="headerScrolled" />

    <main id="top">
      <HeroSection :product-frame-style="productFrameStyle" />

      <section class="strip" aria-label="产品特点">
        <div class="strip-item reveal">
          <strong>0</strong>
          <span>账号注册</span>
        </div>
        <div class="strip-item reveal reveal-delay-1">
          <strong>本地</strong>
          <span>文件不出电脑</span>
        </div>
        <div class="strip-item reveal reveal-delay-2">
          <strong>5</strong>
          <span>核心工具</span>
        </div>
        <div class="strip-item reveal reveal-delay-3">
          <strong>∞</strong>
          <span>免费使用</span>
        </div>
      </section>

      <ToolsSection />
      <HowSection />
      <StudioSection />
      <PrinciplesSection />
      <CtaSection />
    </main>

    <SiteFooter />
  </div>
</template>
