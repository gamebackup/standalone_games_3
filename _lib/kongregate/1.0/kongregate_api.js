var kongregateAPI = {
    loadAPI: function(callback) {
        if (typeof callback === 'function') {
            callback();
        }
    },
    getAPI: function() {
        return {
            services: {
                getUsername: function() { return 'OfflinePlayer'; },
                getUserId: function() { return '0'; },
                getGameAuthToken: function() { return ''; },
                isGuest: function() { return true; },
                isPremium: function() { return false; },
                getAppData: function() { return null; }
            },
            shared: {
                getContent: function() { return null; },
                setContent: function() {}
            },
            stats: {
                submit: function(name, value) {},
                submitAll: function(stats) {}
            },
            store: {
                items: function() { return []; },
                purchase: function(item) {}
            },
            advertisement: {
                showAd: function() {}
            }
        };
    }
};

window.kongregate = kongregateAPI.getAPI();
