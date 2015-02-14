(function(){
    'use strict';
    var app = angular.module('SkySnippetStoreApp', ['ui.router', 'LocalStorageModule']);

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

    app.controller('SnippetsController', function($scope, $state, localStorageService) {
        $scope.snippets = localStorageService.keys().sort();

        $scope.openSnippet = function(snippetName) {
            $state.go('addNew', {name: snippetName});
        };
    });

    app.controller('AddNewController', function($scope, $state, $stateParams, localStorageService) {
        $scope.currentSnippet = new SnippetDTO();
        if ($stateParams.name != null) {
            $scope.currentSnippet = localStorageService.get($stateParams.name);
        }

        $scope.submit = function(){
            localStorageService.set($scope.currentSnippet.name, JSON.stringify($scope.currentSnippet));
            $state.go('allSnippets');
        };
    });

    app.controller('AboutController', function($scope) {
        $scope.createdDate = new Date();
        $scope.authorName = 'Maksym';
    });

    var SnippetDTO = function(name, source) {
        this.name = name;
        this.source = source;
        this.createdDate = new Date();
    }
})();
