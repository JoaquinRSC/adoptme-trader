<template>
  <div class="login-bg">
    <div class="login-card">
      <div class="login-logo">
        <img src="/favicon.ico" alt="logo" width="40" height="40" />
      </div>
      <h1 class="login-title">Adoptme Trader</h1>
      <p class="login-sub">Enter your password to continue</p>

      <form class="login-form" @submit.prevent="submit">
        <div class="input-wrap" :class="{ error: wrongPassword }">
          <input
            ref="inputRef"
            v-model="password"
            :type="showPassword ? 'text' : 'password'"
            placeholder="Password"
            autocomplete="current-password"
            spellcheck="false"
            @input="wrongPassword = false"
          />
          <button type="button" class="eye-btn" @click="showPassword = !showPassword">
            <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>

        <p v-if="wrongPassword" class="error-msg">Incorrect password</p>

        <button type="submit" class="login-btn" :disabled="loading || !password">
          <span v-if="!loading">Sign in</span>
          <span v-else class="spinner" />
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const inputRef = ref<HTMLInputElement | null>(null)
const password = ref('')
const showPassword = ref(false)
const wrongPassword = ref(false)
const loading = ref(false)

onMounted(() => inputRef.value?.focus())

async function submit () {
  if (!password.value || loading.value) return
  loading.value = true
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: password.value }),
    })
    if (res.ok) {
      await router.push('/')
    } else {
      wrongPassword.value = true
      password.value = ''
      inputRef.value?.focus()
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-bg {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
  padding: 16px;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border: 1px solid var(--border-hi);
  border-radius: 16px;
  padding: 40px 32px 36px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.4);
}

.login-logo {
  margin-bottom: 8px;
  opacity: 0.9;
}

.login-title {
  font-family: 'Nunito', sans-serif;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-1);
  margin: 0;
  letter-spacing: -0.3px;
}

.login-sub {
  font-size: 13px;
  color: var(--text-2);
  margin: 0 0 24px;
}

.login-form {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrap input {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border-hi);
  border-radius: 10px;
  padding: 11px 42px 11px 14px;
  font-family: 'Nunito', sans-serif;
  font-size: 15px;
  color: var(--text-1);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.input-wrap input:focus {
  border-color: var(--primary);
}

.input-wrap.error input {
  border-color: var(--negative);
}

.eye-btn {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: var(--text-3);
  display: flex;
  align-items: center;
  transition: color 0.15s;
}

.eye-btn:hover { color: var(--text-2); }
.eye-btn svg { width: 18px; height: 18px; }

.error-msg {
  font-size: 12px;
  color: var(--negative);
  margin: -4px 0 0 4px;
}

.login-btn {
  margin-top: 4px;
  background: var(--primary);
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 12px;
  font-family: 'Nunito', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, box-shadow 0.15s;
  box-shadow: 0 0 0 0 var(--primary-glow);
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
}

.login-btn:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 0 16px var(--primary-glow);
}

.login-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
