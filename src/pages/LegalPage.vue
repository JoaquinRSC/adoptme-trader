<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMeta } from 'quasar'
import { CONTACT_EMAIL } from 'src/config'

interface Section { h: string; paras: string[] }
interface Doc { title: string; intro: string; sections: Section[] }

const UPDATED = 'July 13, 2026'

const DOCS: Record<string, Doc> = {
  disclaimer: {
    title: 'Disclaimer',
    intro: 'Please read this before you rely on anything here to make a trade.',
    sections: [
      {
        h: 'Not affiliated with Roblox or Adopt Me!',
        paras: [
          'AM Trader is an independent, fan-made tool. It is not affiliated with, endorsed by, or sponsored by Roblox Corporation or Uplift Games LLC.',
          '"Roblox" and "Adopt Me!" are trademarks of their respective owners. All game content and names belong to them.',
        ],
      },
      {
        h: 'Values are community estimates',
        paras: [
          'There is no official price list in Adopt Me. The numbers shown here are community estimates pulled from AMV (amvgg.com) and Elve (elvebredd.com). They change often and can disagree.',
          'Treat them as a reference, not a guarantee. When the two sources differ a lot, a pet\'s value is unsettled — trade carefully. You are responsible for your own trades.',
        ],
      },
      {
        h: 'In-game items only',
        paras: [
          'Everything valued here is virtual, in-game content. AM Trader does not facilitate, encourage, or take part in trading for real money, and assigns no real-world monetary value to anything.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    intro: 'The short version: the app works without an account and keeps your data on your own device.',
    sections: [
      {
        h: 'What we store',
        paras: [
          'Your inventory and trade drafts are saved in your browser\'s local storage — on your device, not on our servers. Clearing your browser data removes them. No account is required to use the app.',
          'We do not ask for your name, email, or any personal information to use AM Trader.',
        ],
      },
      {
        h: 'Server logs',
        paras: [
          'Like most websites, our server keeps short-lived request logs (such as IP address and browser type) to keep the service running and to rate-limit abuse. We do not sell this data or use it to build profiles.',
        ],
      },
      {
        h: 'Cookies and tracking',
        paras: [
          'AM Trader does not use tracking cookies or third-party advertising. If that ever changes, this page will be updated first, and any analytics will be privacy-friendly and cookieless.',
        ],
      },
      {
        h: 'Children\'s privacy',
        paras: [
          'Adopt Me has a young audience. AM Trader is usable without an account and does not knowingly collect personal information from anyone, including children under 13. If you believe a child has provided us personal information, contact us and we will remove it.',
        ],
      },
      {
        h: 'Contact',
        paras: [`Questions about privacy? Reach us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    intro: 'By using AM Trader you agree to the following.',
    sections: [
      {
        h: 'Use at your own risk',
        paras: [
          'AM Trader is provided "as is", without warranty of any kind. The values and fairness verdicts are estimates to help you decide — they are not advice and not a guarantee. Any trade you make is your own decision and your own responsibility.',
        ],
      },
      {
        h: 'Fair use',
        paras: [
          'Please don\'t abuse the service: no automated scraping of the API, no attempts to overload or disrupt it, and no using it to break Roblox\'s or Adopt Me\'s own rules.',
        ],
      },
      {
        h: 'Changes',
        paras: [
          'The app and these terms may change over time. Continued use after a change means you accept the updated terms.',
        ],
      },
      {
        h: 'Contact',
        paras: [`Questions? Reach us at ${CONTACT_EMAIL}.`],
      },
    ],
  },
}

const route = useRoute()
const doc = computed<Doc>(() => DOCS[route.name as string] ?? DOCS.disclaimer!)

useMeta(() => ({
  title: `${doc.value.title} — AM Trader`,
  meta: {
    description: { name: 'description', content: doc.value.intro },
  },
}))
</script>

<template>
  <q-page class="legal-page">
    <article class="legal">
      <h1 class="legal-title">{{ doc.title }}</h1>
      <p class="legal-updated">Last updated {{ UPDATED }}</p>
      <p class="legal-intro">{{ doc.intro }}</p>

      <section v-for="s in doc.sections" :key="s.h" class="legal-section">
        <h2 class="legal-h">{{ s.h }}</h2>
        <p v-for="(p, i) in s.paras" :key="i" class="legal-p">{{ p }}</p>
      </section>

      <nav class="legal-nav" aria-label="Legal pages">
        <router-link :to="{ name: 'disclaimer' }">Disclaimer</router-link>
        <router-link :to="{ name: 'privacy' }">Privacy</router-link>
        <router-link :to="{ name: 'terms' }">Terms</router-link>
      </nav>
    </article>
  </q-page>
</template>

<style scoped>
.legal-page {
  padding: 24px 18px 48px;
  max-width: 720px;
  margin-inline: auto;
}
@media (min-width: 768px) {
  .legal-page { padding: 32px 24px 64px; }
}

.legal-title {
  --font-ui: var(--font-display);
  font-size: 28px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0;
}
.legal-updated {
  font-size: 12px;
  color: var(--text-3);
  margin: 6px 0 0;
}
.legal-intro {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-2);
  margin: 16px 0 0;
}

.legal-section { margin-top: 26px; }
.legal-h {
  font-size: 15px;
  font-weight: 800;
  color: var(--primary);
  letter-spacing: 0.2px;
  margin: 0 0 8px;
}
.legal-p {
  font-size: 14px;
  line-height: 1.65;
  color: var(--text-2);
  margin: 0 0 10px;
}

.legal-nav {
  display: flex;
  gap: 18px;
  margin-top: 36px;
  padding-top: 18px;
  border-top: 1px solid var(--border);
}
.legal-nav a {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-3);
  text-decoration: none;
}
@media (hover: hover) {
  .legal-nav a:hover { color: var(--gold); }
}
</style>
