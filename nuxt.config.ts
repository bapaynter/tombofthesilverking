// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },
  runtimeConfig: {
    openrouterApiKey: process.env.OPENROUTER_API_KEY,
  },
  app: {
    head: {
      title: 'The Tomb of the Silver King', // Fallback title
      htmlAttrs: {
        lang: 'en'
      },
      link: [
        {
          rel: 'icon',
          type: 'image/x-icon',
          href: '/favicon.ico' // Refers to public/favicon.ico
        }
      ],
      meta: [
        {
          name: 'description',
          content: 'The Tomb of the Silver King'
        }
      ]
    }
  }
});
