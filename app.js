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

        gapiProvider.apiKey('AIzaSyCInQBUXglMLFDVXoKhMw_z79mzxnw70Vw');
        gapiProvider.clientId('929945743179-j55222c4ha33abbh64gg4rfvsahiojdl.apps.googleusercontent.com');
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
            var i = 5;
            //---------------------------------
            gapi.login().then(function() {
                $scope.login = 'success';
                $scope.snippetStoreFolder = null;

                gapi.call("drive", "v2", "files", "list").then(function(response) {
                    $scope.allFiles = [];
                    $scope.onlineSnippets = [];
                    for(var i=0; i<response.items.length; i++){
                        $scope.allFiles.push((response.items[i]));
                        if (response.items[i].title === 'SnippetStoreFolder') {
                            $scope.snippetStoreFolder = response.items[i];
                            break;
                        }
                    }
                    // get all files in SnippetStore folder
                    gapi.call("drive", "v2", "children", "list", {'folderId': $scope.snippetStoreFolder.id}).then(function(r){
                        for(var i=0; i < r.items.length; i++) {
                            for(var k=0; k < $scope.allFiles.length; k++) {
                                if (r.items[i].id === $scope.allFiles[k].id) {
                                    $scope.onlineSnippets.push($scope.allFiles[k]);
                                    break;
                                }
                            }
                        }

                        // check files that presents both, local and gDrive
                        for (var i=0; i < $scope.onlineSnippets.length; i++) {
                            var item = $scope.onlineSnippets[i];
                            for (var k=0; k < $scope.snippets.length; k++) {
                                if ($scope.snippets[k].name === item.title) {
                                    $scope.snippets[k].avaliableOnDrive = true;
                                    $scope.snippets[k].fileId = item.id;
                                    $scope.onlineSnippets.splice(i,1);
                                    break;
                                }
                            }
                        }
                        // add files that just on gDrive
                        for (var i=0; i < $scope.onlineSnippets.length; i++) {
                            var snippet = new SnippetDTO();
                            snippet.id = $scope.onlineSnippets[i].id;
                            snippet.name = $scope.onlineSnippets[i].title;
                            snippet.createdDate = $scope.onlineSnippets[i].createdDate;
                            snippet.modifiedDate = $scope.onlineSnippets[i].modifiedDate;
                            snippet.avaliableLocal = false;
                            snippet.avaliableOnDrive = true;

                            $scope.snippets.push(snippet);
                        }
                        var i = 6;
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

