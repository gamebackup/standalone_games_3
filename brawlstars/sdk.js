// sdk.js - Mock Yandex Games SDK (Updated with serverTime)

let _mockPurchases = [];

const _defaultCatalog = [
    { id: 'passPremium', title: 'Brawl Pass', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'noAds', title: 'No Ads', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '30gems', title: '30 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '80gems', title: '80 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '170gems', title: '170 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '360gems', title: '360 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '950gems', title: '950 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '2000gems', title: '2000 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: '5000gems', title: '5000 Gems', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'starterPack', title: 'Starter Pack', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'starterPack2', title: 'Starter Pack 2', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'starterPack3', title: 'Starter Pack 3', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'boxOmega', title: 'Omega Box', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'boxBlingUltra', title: 'Ultra Trophy Box', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
    { id: 'starrLegendary', title: 'Legendary Starr Drop', description: '', imageURI: '', price: '0 YAN', priceValue: 0, priceCurrencyCode: 'YAN', getPriceCurrencyImage: (size) => '' },
];

const YaGames = {
    init: () => Promise.resolve({
        // Core player
        getPlayer: () => Promise.resolve({
            isAuthorized: () => false,
            getName: () => "Guest",
            getUniqueID: () => "guest-" + Date.now(),
            getPhoto: (size) => "",
            getPayingStatus: () => "unknown",
            setData: (data, flush) => {
                try {
                    localStorage.setItem('yg_saves', JSON.stringify(data));
                } catch (e) {
                    console.error('[YG Mock] setData error:', e);
                }
                return Promise.resolve();
            },
            getData: (keys) => {
                try {
                    const raw = localStorage.getItem('yg_saves');
                    const saves = raw ? JSON.parse(raw) : { saves: null };
                    return Promise.resolve(saves);
                } catch (e) {
                    console.error('[YG Mock] getData error:', e);
                    return Promise.resolve({ saves: null });
                }
            },
            getStats: () => {
                try {
                    const raw = localStorage.getItem('yg_stats');
                    const stats = raw ? JSON.parse(raw) : {};
                    return Promise.resolve(stats);
                } catch (e) {
                    console.error('[YG Mock] getStats error:', e);
                    return Promise.resolve({});
                }
            },
            setStats: (stats) => {
                try {
                    localStorage.setItem('yg_stats', JSON.stringify(stats));
                } catch (e) {
                    console.error('[YG Mock] setStats error:', e);
                }
                return Promise.resolve();
            },
        }),

        // Auth
        auth: {
            openAuthDialog: () => Promise.resolve()
        },

        // Ads
        adv: {
            showFullscreenAdv: (options) => {
                console.log("[YG Mock] Fullscreen ad requested");
                options?.callbacks?.onOpen?.();
                options?.callbacks?.onClose?.(true);
            },
            showRewardedVideo: (options) => {
                console.log("[YG Mock] Rewarded video requested");
                options?.callbacks?.onOpen?.();
                options?.callbacks?.onRewarded?.();
                options?.callbacks?.onClose?.();
            },
            getBannerAdvStatus: () => Promise.resolve({ stickyAdvIsShowing: false }),
            showBannerAdv: () => {},
            hideBannerAdv: () => {}
        },

        // Payments (in-memory mock — purchase then consume so OnPurchaseSuccess fires)
        getPayments: () => Promise.resolve({
            getCatalog: () => Promise.resolve(_defaultCatalog),
            getPurchases: () => Promise.resolve(_mockPurchases),
            purchase: (id) => {
                _mockPurchases.push({
                    productID: id,
                    purchaseToken: 'mock-token-' + Date.now()
                });
                return Promise.resolve();
            },
            consumePurchase: (token) => {
                _mockPurchases = _mockPurchases.filter(p => p.purchaseToken !== token);
                return Promise.resolve();
            }
        }),

        // Leaderboards
        leaderboards: {
            setScore: (name, score, extra) => Promise.resolve(),
            getDescription: (name) => Promise.resolve({
                default: false,
                description: {
                    invert_sort_order: false,
                    score_format: { options: { decimal_offset: 0 } },
                    type: "numeric"
                }
            }),
            getEntries: (name, options) => Promise.resolve({ entries: [] })
        },

        // Feedback & Shortcuts
        feedback: {
            canReview: () => Promise.resolve({ value: false }),
            requestReview: () => Promise.resolve({ feedbackSent: false })
        },
        shortcut: {
            canShowPrompt: () => Promise.resolve({ canShow: false }),
            showPrompt: () => Promise.resolve({ outcome: "rejected" })
        },

        // Features & Environment
        features: {
            GamesAPI: {
                getAllGames: () => Promise.resolve({ games: [], developerURL: "" })
            }
        },
        deviceInfo: {
            type: "desktop",
            isMobile: () => false,
            isDesktop: () => true,
            isTablet: () => false,
            isTV: () => false
        },
        environment: {
            i18n: { lang: "en", tld: "com" },
            app: { id: "mock" },
            browser: { lang: "en" },
            payload: null
        },

        // Event handling
        on: (event, callback) => {
            console.log(`[YG Mock] Event "${event}" registered`);
        },

        // ** NEW: Server time method **
        serverTime: () => {
            // Return current Unix timestamp in milliseconds
            // (Yandex SDK returns server time to prevent client clock cheating)
            return Date.now();
        },

        // Some games also call these methods; include stubs to be safe
        isInitialized: () => true,
        getLanguage: () => "en",
        getPlatform: () => "mock"
    })
};

console.log("[YG Mock] SDK loaded – YaGames defined with serverTime");
