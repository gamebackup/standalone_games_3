// Yandex SDK stub - all ad functionality removed
console.log("Yandex SDK disabled by user request");
if (!window.YaGames) {
    window.YaGames = {
        init: function() { return Promise.resolve({}); }
    };
}
