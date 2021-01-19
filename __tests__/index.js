const {
    createEvent,
    createIdentify,
    createPageview,
    createCache,
    getMeta,
    resetMeta,
    clone,
} = require('@posthog/plugin-scaffold/test/utils.js')
const { setupPlugin, runEveryMinute } = require('../index')

global.fetch = jest.fn(async (url) => ({
    json: async () => {
        if (url === 'https://api.github.com/repos/PostHog/posthog') {
            return require('./posthog.json')
        }
    },
}))

beforeEach(() => {
    fetch.mockClear()

    resetMeta({
        config: {
            user: 'PostHog',
            repo: 'posthog',
            token: 'TOKEN',
        },
    })
})

test('setupPlugin', async () => {
    expect(fetch).toHaveBeenCalledTimes(0)

    await setupPlugin(getMeta())
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/PostHog/posthog', {
        headers: { Accept: 'application/vnd.github.v3.star+json', Authorization: 'token TOKEN' },
    })

    await setupPlugin(getMeta())
    expect(fetch).toHaveBeenCalledTimes(1)

    // clear the cache and try again:
    getMeta().storage = createCache()

    await setupPlugin(getMeta())
    expect(fetch).toHaveBeenCalledTimes(2)

    expect(getMeta().global.projectId).toBe(235901813)
})
