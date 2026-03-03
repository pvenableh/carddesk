export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (to.path.startsWith("/login") || to.path.startsWith("/auth")) return
  if (!loggedIn.value) return navigateTo("/login")
})
