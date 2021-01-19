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

const utcNow = (index) => `2021-01-19T20:07:10.${index.toString().padStart(3, '0')}Z`
function createMockStars(count, start = 0) {
    const user = require('./star.json')
    return Array.from(Array(count)).map((_, index) => ({
        starred_at: utcNow(start + index),
        user,
    }))
}

global.fetch = jest.fn(async (url) => ({
    json: async () => {
        if (url === 'https://api.github.com/repos/PostHog/posthog') {
            return require('./posthog.json')
        } else if (url === 'https://api.github.com/repositories/235901813/stargazers?page=1&per_page=100') {
            return createMockStars(100, 0)
        } else if (url === 'https://api.github.com/repositories/235901813/stargazers?page=2&per_page=100') {
            return createMockStars(40, 100)
        } else {
            console.error(url)
            throw new Exception('unknown url')
        }
    },
}))

global.posthog = {
    capture: jest.fn(),
}

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

test('setupPlugin with a token', async () => {
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

test('setupPlugin without a token', async () => {
    resetMeta({
        config: {
            user: 'PostHog',
            repo: 'posthog',
        },
    })
    await setupPlugin(getMeta())
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(fetch).toHaveBeenCalledWith('https://api.github.com/repos/PostHog/posthog', {
        headers: { Accept: 'application/vnd.github.v3.star+json' },
    })
    expect(getMeta().global.projectId).toBe(235901813)
})

test('runEveryMinute', async () => {
    const meta = getMeta()

    await setupPlugin(meta)
    await runEveryMinute(meta)

    expect(posthog.capture).toHaveBeenCalledTimes(100)
    expect(posthog.capture).toHaveBeenLastCalledWith('Github Star', {
        avatar: 'https://avatars1.githubusercontent.com/u/12345?v=4',
        repository: 'PostHog/posthog',
        starred_at: utcNow(99),
        timestamp: utcNow(99),
        user: 'USER',
        user_id: 12345,
        user_url: 'https://api.github.com/users/USER',
    })
    expect(await meta.storage.get(`lastCapturedTime-235901813`)).toBe(utcNow(99))
    expect(await meta.storage.get('page-235901813')).toBe(2)
    expect(await meta.cache.get('snoozing')).toBe(undefined)

    await runEveryMinute(meta)
    expect(posthog.capture).toHaveBeenCalledTimes(140)
    expect(await meta.storage.get(`lastCapturedTime-235901813`)).toBe(utcNow(139))
    expect(await meta.storage.get('page-235901813')).toBe(2)
    expect(await meta.cache.get('snoozing')).toBe(true)

    // disable snoozing, make sure fetching again doesn't do much
    await meta.cache.set('snoozing', false)

    await runEveryMinute(meta)
    expect(posthog.capture).toHaveBeenCalledTimes(140)
    expect(await meta.storage.get(`lastCapturedTime-235901813`)).toBe(utcNow(139))
    expect(await meta.storage.get('page-235901813')).toBe(2)
    expect(await meta.cache.get('snoozing')).toBe(true)
})
