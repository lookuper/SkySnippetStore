(function(){
    'use strict';
    var app = angular.module('SkySnippetStoreApp', ['ui.router', 'LocalStorageModule', 'ui.ace', 'angular-google-gapi']);

    app.config(['$urlRouterProvider', '$stateProvider','localStorageServiceProvider', function($urlRouterProvider, $stateProvider, localStorageServiceProvider) {
        localStorageServiceProvider.setPrefix('SkySnippetStoreApp');
        $urlRouterProvider.otherwise('/');

        $stateProvider.state('allSnippets', {
          url: '/',
          templateUrl: 'templates/snippets.html',
          controller: 'SnippetsController'
        }).state('addNew', {
            url: '/addNew/:name',
            templateUrl: 'templates/addnew.html',
            controller: 'AddNewController'
        }).state('about', {
            url: '/about',
            templateUrl: 'templates/about.html',
            controller: 'AboutController'
        });
    }]);

    app.run(['GAuth', 'GApi', '$state',
        function(GAuth, GApi, $state) {
            var CLIENT = '';
            var BASE = 'https://myGoogleAppEngine.appspot.com/_ah/api';

            GApi.load('drive','v2');
            GAuth.setClient(CLIENT);

            GAuth.checkAuth().then(
                function () {
                    $state.go('webapp.home'); // an example of action if it's possible to
                    // authenticate user at startup of the application
                },
                function() {
                    $state.go('login');       // an example of action if it's impossible to
                    // authenticate user at startup of the application
                }
            );

        }]);

    app.controller('SnippetsController', function($scope, $state, localStorageService, GApi) {

        $scope.snippets = [];
        localStorageService.keys().forEach(function(item) {
            $scope.snippets.push(localStorageService.get(item));
        });

        $scope.openSnippet = function(snippetName) {
            $state.go('addNew', {name: snippetName});
        };
        $scope.removeItem = function(index) {
           $scope.snippets.splice(index,1);
        };
    });

    app.controller('AddNewController', function($scope, $state, $stateParams, localStorageService) {
        $scope.currentSnippet = new SnippetDTO();
        if ($stateParams.name != null && $stateParams.name.length > 0) {
            $scope.currentSnippet = localStorageService.get($stateParams.name);
        }

        $scope.submit = function(){
            localStorageService.set($scope.currentSnippet.name, $scope.currentSnippet);
            $state.go('allSnippets');
        };
        $scope.remove = function() {
            if ($scope.currentSnippet.name != '') {
                localStorageService.remove($scope.currentSnippet.name);
                $state.go('allSnippets');
            }
        };
        $scope.aceLoaded = function(_editor) {
            ace.require("ace/ext/language_tools");
            _editor.setTheme("ace/theme/twilight");
            _editor.getSession().setMode("ace/mode/javascript");
            _editor.setOptions({
                useWrapMode: true,
                showGutter: true,
                enableBasicAutocompletion: true,
                enableSnippets: true,
                enableLiveAutocompletion: true
            });
        };
        $scope.aceChanged = function(e) {
            var i = 5;
        };
    });

    app.controller('AboutController', function($scope) {
        $scope.authorName = 'Maksym Chernenko';
        $scope.location = 'Kiev, Ukraine';
    });

    var SnippetDTO = function(name, source) {
        this.name = name;
        this.source = source;
        this.createdDate = new Date();
        this.avaliableLocal = true;
        this.avaliableOnDrive = false;
    }
})();

