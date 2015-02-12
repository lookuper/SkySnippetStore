(function(){
    'use strict';
    var app = angular.module('SkySnippetStoreApp', ['ui.router']);
    app.config(['$urlRouterProvider', '$stateProvider', function($urlRouterProvider, $stateProvider) {
        $urlRouterProvider.otherwise('/');
        $stateProvider.state('allSnippets', {
          url: '/',
          templateUrl: 'templates/snippets.html'
        }).state('addNew', {
            url: '/addNew',
            templateUrl: 'templates/addnew.html'
        });
    }]);
})();

