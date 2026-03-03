<script setup lang="ts">
definePageMeta({ layout: false });
const { login, loading, error } = useAuth();
const email = ref("");
const password = ref("");
async function handleSubmit() {
  if (!email.value || !password.value) return;
  await login(email.value, password.value);
}
</script>
<template>
  <div
    style="
      min-height: 100vh;
      background: #060810;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
    "
  >
    <div style="width: 100%; max-width: 360px">
      <div style="text-align: center; margin-bottom: 40px">
        <div
          style="
            font-family: &quot;Bebas Neue&quot;, sans-serif;
            font-size: 3rem;
            letter-spacing: 0.1em;
          "
        >
          CARD<span style="color: #00ff87">DESK</span>
        </div>
        <p
          style="
            color: #3e4f68;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            margin-top: 4px;
          "
        >
          Your network. Gamified.
        </p>
      </div>
      <div
        style="
          background: #0d1018;
          border: 1px solid #1c2330;
          border-radius: 16px;
          padding: 32px;
        "
      >
        <h1
          style="
            font-size: 1.25rem;
            font-weight: 800;
            color: #f0f4ff;
            margin: 0 0 4px;
          "
        >
          Welcome back
        </h1>
        <p style="color: #3e4f68; font-size: 0.875rem; margin: 0 0 28px">
          Sign in to your account
        </p>
        <div
          v-if="error"
          style="
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.3);
            color: #f87171;
            font-size: 0.875rem;
            border-radius: 12px;
            padding: 12px 16px;
            margin-bottom: 20px;
          "
        >
          {{ error }}
        </div>
        <form
          style="display: flex; flex-direction: column; gap: 16px"
          @submit.prevent="handleSubmit"
        >
          <div>
            <label
              style="
                display: block;
                font-size: 0.7rem;
                font-weight: 700;
                color: #3e4f68;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-bottom: 8px;
              "
              >Email</label
            >
            <input
              v-model="email"
              type="email"
              placeholder="you@example.com"
              required
              style="
                width: 100%;
                background: #060810;
                border: 1px solid #1c2330;
                border-radius: 12px;
                color: #f0f4ff;
                font-size: 0.875rem;
                padding: 12px 16px;
                outline: none;
                box-sizing: border-box;
              "
            />
          </div>
          <div>
            <label
              style="
                display: block;
                font-size: 0.7rem;
                font-weight: 700;
                color: #3e4f68;
                text-transform: uppercase;
                letter-spacing: 0.1em;
                margin-bottom: 8px;
              "
              >Password</label
            >
            <input
              v-model="password"
              type="password"
              placeholder="••••••••"
              required
              style="
                width: 100%;
                background: #060810;
                border: 1px solid #1c2330;
                border-radius: 12px;
                color: #f0f4ff;
                font-size: 0.875rem;
                padding: 12px 16px;
                outline: none;
                box-sizing: border-box;
              "
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            style="
              width: 100%;
              background: #00ff87;
              color: #060810;
              font-weight: 800;
              font-size: 0.875rem;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              border: none;
              border-radius: 12px;
              padding: 14px;
              cursor: pointer;
              margin-top: 8px;
            "
          >
            {{ loading ? "Signing in..." : "Sign In →" }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
