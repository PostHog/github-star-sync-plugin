async function setupPlugin({ storage, config, global }) {
    if (!config.user || !config.repo) {
        throw new Error("Please set the 'user' or 'repo' config values")
    }

    // We need the project's ID in subsequent API calls. Make an API call to fetch if if it's not already saved.
    const { projectId, user, repo } = (await storage.get('projectCache')) || {}
    if (projectId && user === config.user && repo === config.repo) {
        global.projectId = projectId
    } else {
        const url = `https://api.github.com/repos/${config.user}/${config.repo}`
        const response = await fetch(url, {
            headers: {
                Accept: 'application/vnd.github.v3.star+json',
                ...(config.token ? { Authorization: `token ${config.token}` } : {}),
            },
        })
        const { id } = await response.json()
        await storage.set('projectCache', { projectId: id, user: config.user, repo: config.repo })
        global.projectId = id
    }

    if (!global.projectId) {
        throw new Error(`Could not get ID for Github project: ${config.user}/${config.repo}`)
    }
}

async function runEveryMinute({ cache, storage, global, config }) {
    // If we're still banned due to exceeding rate limits
    if (await cache.get('snoozing', false)) {
        return
    }

    // run every 10th minute
    // if (new Date().getMinutes() % 10 !== 0) {
    //     return
    // }

    const perPage = 100
    const page = await storage.get(`page-${global.projectId}`, 1)
    const url = `https://api.github.com/repositories/${global.projectId}/stargazers?page=${page}&per_page=${perPage}`

    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github.v3.star+json',
            ...(config.token ? { Authorization: `token ${config.token}` } : {}),
        },
    })

    const results = await response.json()
    if (results?.message?.includes('rate limit')) {
        await cache.set('snoozing', true, 600) // timeout for 10min
        return
    }

    const lastCapturedTime = await storage.get(`lastCapturedTime-${global.projectId}`, null)
    const dateValue = (dateString) => new Date(dateString).valueOf()
    const validResults = lastCapturedTime
        ? results.filter((r) => dateValue(r.starred_at) > dateValue(lastCapturedTime))
        : results
    const sortedResults = validResults.map((r) => r.starred_at).sort()
    const newLastCaptureTime = sortedResults[sortedResults.length - 1]

    for (const star of validResults) {
        const {
            started_at,
            user: { login, url, id, avatar_url },
        } = star

        posthog.capture('Github Star', {
            timestamp: star.starred_at,
            repository: `${config.user}/${config.repo}`,
            starred_at: star.starred_at,
            user: login,
            user_id: id,
            user_url: url,
            avatar: avatar_url,
        })
    }

    if (newLastCaptureTime) {
        await storage.set(`lastCapturedTime-${global.projectId}`, newLastCaptureTime)
    }

    if (validResults.length === 0 && results.length === perPage) {
        await storage.set(`page-${global.projectId}`, page + 1)
    }
}

module.exports = {
    setupPlugin,
    runEveryMinute
}
