(function(){
    'use strict';
    var app = angular.module('SkySnippetStoreApp', ['ui.router', 'LocalStorageModule', 'ui.ace', 'gapi']);

    app.config(['$urlRouterProvider', '$stateProvider','localStorageServiceProvider', 'gapiProvider', function($urlRouterProvider, $stateProvider, localStorageServiceProvider, gapiProvider) {
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
        gapiProvider.apiKey('AIzaSyAhkKUjOu8FQC_hWLBO7j9KMe7477zsYvM');
        gapiProvider.clientId('107996144740-gk5ip9tcm0qvm7mr4bse9jjg5tp0dc9m.apps.googleusercontent.com');
        gapiProvider.apiScope('https://www.googleapis.com/auth/drive');
    }]);

    app.controller('SnippetsController', function($scope, $state, $http, localStorageService, gapi) {
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
        $scope.driveLogin = function() {

            ////---------------------------------
            gapi.login().then(function() {
                $scope.login = 'success';

                gapi.call("drive", "v2", "files", "list").then(function(response) {
                    $scope.allFiles = response.items;
                    $scope.snippetStoreFolder  = Enumerable.from(response.items)
                        .firstOrDefault("$.title === 'SnippetStoreFolder'");

                    // get all files in SnippetStore folder
                    gapi.call("drive", "v2", "children", "list", {'folderId': $scope.snippetStoreFolder.id}).then(function(resp){
                        $scope.onlineSnippets = Enumerable.from($scope.allFiles)
                            .join(Enumerable.from(resp.items), '$.id', '$.id', '$')
                            .toArray();

                        // check files that presents both, local and gDrive
                        Enumerable.from($scope.snippets)
                            .join(Enumerable.from($scope.onlineSnippets), '$.name', '$.title', function(a, b) {
                                a.avaliableOnDrive = true;
                                a.fileId = b.id;
                                $scope.onlineSnippets.splice($scope.onlineSnippets.indexOf(b), 1);
                            }).toArray();

                        // add files that just on gDrive
                        $scope.onlineSnippets.forEach(function(item) {
                            var snippet = new SnippetDTO();
                            snippet.id = item.id;
                            snippet.name = item.title;
                            snippet.createdDate = item.createdDate;
                            snippet.modifiedDate = item.modifiedDate;
                            snippet.avaliableLocal = false;
                            snippet.avaliableOnDrive = true;

                            $scope.snippets.push(snippet);

                            //var token = window.gapi.auth.getToken().access_token;
                            //$http.get(item.downloadUrl, {headers: { Authorization: 'Bearer ' + token }})
                            //    .success(function(data, status, headers, config) {
                            //        var i = 5;
                            //    }).error(function(data, status, headers, config) { });
                        });
                    });

                })
            }, function() {
                $scope.login = 'fail';
            });
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
        this.modifiedDate = null;
        this.avaliableLocal = true;
        this.avaliableOnDrive = false;
        this.fileId = null;
    }
})();

