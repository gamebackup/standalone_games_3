var bridge = {
    engine: 'unity',
    platform: {
        id: 'web',
        language: 'en',
        payload: '',
        tld: '',
        isAudioEnabled: true,
        isGetAllGamesSupported: false,
        isGetGameByIdSupported: false,
        sendMessage: function(message) {},
        getServerTime: function() { return Promise.resolve(Date.now()); },
        getAllGames: function() { return Promise.resolve([]); },
        getGameById: function() { return Promise.resolve(null); },
        on: function(event, callback) {}
    },
    device: {
        type: 'desktop',
        safeArea: { x: 0, y: 0, width: 0, height: 0 }
    },
    player: {
        isAuthorizationSupported: false,
        isAuthorized: false,
        id: null,
        name: null,
        photos: [],
        extra: null,
        authorize: function() { return Promise.resolve(); },
        on: function(event, callback) {}
    },
    game: {
        visibilityState: 'visible',
        on: function(event, callback) {}
    },
    storage: {
        defaultType: 'local_storage',
        isSupported: function() { return true; },
        isAvailable: function() { return true; },
        get: function(keys, storageType, fallback) { return Promise.resolve(keys.map(function() { return null; })); },
        set: function(keys, values, storageType) { return Promise.resolve(); },
        delete: function(keys, storageType) { return Promise.resolve(); }
    },
    advertisement: {
        interstitialState: '',
        isBannerSupported: false,
        isInterstitialSupported: false,
        isRewardedSupported: false,
        minimumDelayBetweenInterstitial: 0,
        rewardedPlacement: null,
        showBanner: function(position, placement) {},
        hideBanner: function() {},
        showInterstitial: function(placement) { return Promise.resolve(); },
        showRewarded: function(placement) { return Promise.resolve(); },
        checkAdBlock: function() { return Promise.resolve(false); },
        on: function(event, callback) {}
    },
    social: {
        isShareSupported: false,
        isInviteFriendsSupported: false,
        isJoinCommunitySupported: false,
        isCreatePostSupported: false,
        isAddToHomeScreenSupported: false,
        isAddToFavoritesSupported: false,
        isRateSupported: false,
        isExternalLinksAllowed: false,
        share: function() { return Promise.resolve(); },
        inviteFriends: function() { return Promise.resolve(); },
        joinCommunity: function() { return Promise.resolve(); },
        createPost: function() { return Promise.resolve(); },
        addToHomeScreen: function() { return Promise.resolve(); },
        addToFavorites: function() { return Promise.resolve(); },
        rate: function() { return Promise.resolve(); }
    },
    leaderboards: {
        type: 'none',
        setScore: function(id, score) { return Promise.resolve(); },
        getEntries: function(id) { return Promise.resolve(null); },
        showNativePopup: function(id) { return Promise.resolve(); }
    },
    payments: {
        isSupported: false,
        purchase: function(id, options) { return Promise.resolve(null); },
        consumePurchase: function(id) { return Promise.resolve(null); },
        getCatalog: function() { return Promise.resolve([]); },
        getPurchases: function() { return Promise.resolve([]); }
    },
    remoteConfig: {
        isSupported: false,
        get: function(options) { return Promise.resolve(null); }
    },
    achievements: {
        isSupported: false,
        isGetListSupported: false,
        isNativePopupSupported: false,
        unlock: function(options) { return Promise.resolve(); },
        showNativePopup: function(options) { return Promise.resolve(); },
        getList: function(options) { return Promise.resolve([]); }
    },
    initialize: function() {
        return Promise.resolve();
    }
};
