export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (to.path.startsWith("/login")) return
  if (!loggedIn.value) return navigateTo("/login")
})
