"use strict";
angular.module('gapi', []);
'use strict';

angular.module('gapi').factory('gapiModel', ['$timeout', 'gapi', '$log', function($timeout, gapi, $log) {
    /**
     * item model can work with promise and immediately available futureItemData.
     *
     */
    var Item = function Item(futureItemData) {
        /**
         * If futureItemData is not promise then fill model immediately.
         */
        if (futureItemData.$$state) {
            this.$unwrap(futureItemData);
        } else {
            _.extend(this, futureItemData);
        }
    };

    /**
     * Factory method.
     * @see gapi.call for more information.
     * This method only wrap call action in usable form.
     *
     * @param name API name for find action (example: youtube)
     * @param version API version (example: v3)
     * @param scope application scope (example: playlists)
     * @param action action in scope (example list)
     * @param options extended options (example {mine: true, part: snippet})
     */
    Item.$find = function(name, version, scope, action, options) {
        // get promise for query
        var futureItemData = gapi.call(name, version, scope, action, options);
        // return model with promise waiting
        var item =  new Item(futureItemData);
        // save options for later
        // we can use them in $query function
        item.callOptions(name, version, scope, action, options);
        return item;
    };

    /**
     * Fill model from futureItemData (promise only)
     * @param futureItemData
     */
    Item.prototype.$unwrap = function(futureItemData) {
        var self = this;
        this.$futureItemData = futureItemData;
        this.$futureItemData.then(function(data) {
            $timeout(function() {
                _.extend(self, data);
            })
        })
    };

    /**
     * Save $options for later (we can use them in $query function
     * @param name API name for find action (example: youtube)
     * @param version API version (example: v3)
     * @param scope application scope (example: playlists)
     * @param action action in scope (example list)
     * @param options extended options (example {mine: true, part: snippet})
     */
    Item.prototype.callOptions = function options(name, version, scope, action, options) {
        this.$apiOptions = {
            'name': name,
            'version': version,
            'scope': scope,
            'action': action,
            'options': options
        }
    };

    Item.prototype.$query = function($options) {
        var options = this.$apiOptions.options || {};

        _.extend(options, $options || {});

        var futureItemData = gapi.call(
            this.$apiOptions.name,
            this.$apiOptions.version,
            this.$apiOptions.scope,
            this.$apiOptions.action,
            options
        );

        this.$unwrap(futureItemData);
    };

    return Item;
}]);
angular.module('gapi').provider('gapi', function() {

    /**
     * Configuration options for gapi.
     *
     * For set config options use
     *
     * gapiProvider.apiKey()
     * gapiProvider.clientId()
     * gapiProvider.apiScope()
     *
     * in you config section
     *
     * @type {{}}
     * @private
     */
    var _config = {
    };

    /**
     * Setup api key (use only with gapiProvider)
     * @param key
     * @returns {*}
     */
    this.apiKey = function apiKey(key) {
        _config.api_key = key;
        return this;
    };

    /**
     * Setup client appliction id (use only with gapiProvider)
     * @param client_id
     * @returns {*}
     */
    this.clientId = function clientId(client_id) {
        _config.client_id = client_id;
        return this;
    };

    /**
     * Setup you appliction scope (use only with gapiProvider)
     * @param api_scope
     * @returns {*}
     */
    this.apiScope = function apiScope(api_scope) {
        _config.scope = api_scope;
        return this;
    };

    this.$get = ['$q', function ($q) {
        if (!_config['api_key']) {
            throw "API key for Google is not set correctly";
        }

        /*
         * Init api defer object which can be resolved only after init GAPI
         */
        var $apiDefer = $q.defer();
        var _apiReady = false;
        var _loggedIn = false;
        var api = $apiDefer.promise;

        window.handleGAPIInit = function () {
            gapi.client.setApiKey(_config.api_key);
            delete window.handleGAPIInit;
            _apiReady = true;
            $apiDefer.resolve();
        };

        // attach gapi script
        jQuery('<script></script>')
            .prop('src', 'https://apis.google.com/js/client.js?onload=handleGAPIInit')
            .prop('type', 'text/javascript')
            .appendTo('head');

        /**
         * Create handler for authorization process based on external $defer object.
         * Decision (resolve or reject) based on auth result status..
         *
         * @param $defer
         * @returns {Function}
         * @private
         */
        var _makeAuthHandler = function _makeAuthHandler($defer) {

            return function _handleAuth(result) {
                if (result && !result.error) {
                    $defer.resolve();
                } else {
                    $defer.reject();
                }
            }
        };

        /**
         * Start authorization process for current user.
         * Default config can be override in config variable.
         * You can pass custom client_id, scope and immediate variables
         *
         * @param config
         * @returns {jQuery.promise|promise.promise|d.promise|promise|.ready.promise|dd.g.promise|*}
         */
        var _login = function _login(config) {
            var query = angular.extend(_config, {immediate: false}, config || {});

            var $defer = $q.defer();

            api.then(function () {
                window.gapi.auth.authorize(query, _makeAuthHandler($defer));
            });
            return $defer.promise;
        };

        return {

            isAuth: function isAuth() {
                return _loggedIn;
            },

            login: function login() {
                var $defer = $q.defer();

                var _success = function _success() {
                    _loggedIn = true;
                    $defer.resolve();
                };

                // After create object try to make immediate authentication
                _login({immediate: true}).then(
                    _success,
                    function _fail() {
                        _login().then(_success, $defer.reject)
                    }
                );

                return $defer.promise;
            },

            /**
             * Call "action" from "scope" which defined in api "name" with "version".
             * Send list of "options" for "action".
             *
             * Result promise. Promise resolved with query result.
             *
             * For example;
             * You want to call gapi.client.youtube.playlists.list({mine: true});
             *
             * gapiService.call("youtube", "v3", "playlists", "list", {mine: true}).then(function(result) {
             *   // read content of result
             * })
             *
             * @param name API name
             * @param version API version
             * @param scope API scope
             * @param aciton Action in scope
             * @param options options for action
             * @returns {jQuery.promise|promise.promise|d.promise|promise|.ready.promise|dd.g.promise|*}
             */
            call: function call(name, version, scope, aciton, options) {
                var query = options || {};

                var $defer = $q.defer();

                window.gapi.client.load(name, version).then(function () {
                    window.gapi.client[name][scope][aciton](query).then(function (response) {
                        $defer.resolve(response.result);
                    })
                });
                return $defer.promise;
            }
        };
    }]
});
